import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import User from "@/lib/database/models/user.model";
import { getCurrentUser } from "@/lib/auth";
import { dualWritePostgresFirst } from "@/lib/server/dualWrite";
import { publishEvent, TOPICS } from "@/lib/kafka";
import { sendMail } from "@/lib/email";
import { statusUpdateTemplate } from "@/lib/emailTemplates";

/**
 * POST /api/head/incidents/assign
 * Body: { incidentId, workerId, workerName }
 * Assigns a worker to an incident
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const { incidentId, workerName, workerNames } = body;

  if (!incidentId) {
    return NextResponse.json({ error: "incidentId is required" }, { status: 400 });
  }

  // Support both single workerName and multiple workerNames
  const namesToAssign: string[] = workerNames?.length ? workerNames : (workerName ? [workerName] : []);
  if (namesToAssign.length === 0) {
    return NextResponse.json({ error: "At least one worker name is required" }, { status: 400 });
  }

  const incident = await IncidentModel.findOne({ incidentId });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  // Dual-write: PG first, then Mongo, then Kafka
  await dualWritePostgresFirst({
    pg: async (client) => {
      // Update incident status and metadata in PG
      await client.query(
        `UPDATE incidents
         SET status = 'Active',
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{assignedTo}',
               $1::jsonb
             ),
             updated_at = now()
         WHERE incident_code = $2`,
        [JSON.stringify(namesToAssign), incidentId]
      );
    },
    primary: async () => {
      // Add workers to the assignedTo array (avoid duplicates)
      await IncidentModel.updateOne(
        { incidentId },
        {
          $addToSet: { assignedTo: { $each: namesToAssign } },
          $set: { status: "Active", updatedAt: new Date() },
        }
      );
      return null;
    },
  });

  // Send status update email to citizen (fire-and-forget)
  const citizenId = incident.citizenId;
  if (citizenId) {
    // Look up citizen email from the shared users collection
    let citizenUser: Record<string, unknown> | null = null;
    if (mongoose.Types.ObjectId.isValid(citizenId)) {
      citizenUser = await User.findById(citizenId).lean() as Record<string, unknown> | null;
    }
    if (!citizenUser) {
      citizenUser = await User.findOne({ email: citizenId }).lean() as Record<string, unknown> | null;
    }
    const citizenEmail = citizenUser?.email as string;
    if (citizenEmail) {
      const emailContent = statusUpdateTemplate({
        citizenEmail,
        citizenName: (citizenUser?.name as string) || "Citizen",
        title: incident.title,
        incidentId: incident.incidentId,
        oldStatus: incident.status,
        newStatus: "Active",
        remark: `Workers assigned: ${namesToAssign.join(", ")}`,
        updatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      });
      sendMail({ to: citizenEmail, ...emailContent });
    }
  }

  // Publish to Kafka for Mongo replication
  publishEvent(TOPICS.INCIDENT_ASSIGNED, incidentId, {
    incidentId,
    assignedTo: namesToAssign,
    newStatus: "Active",
    assignedBy: me.userId,
  });

  return NextResponse.json({
    success: true,
    message: `${namesToAssign.length} worker(s) assigned to ${incidentId}`,
    assigned: namesToAssign,
  });
}

/**
 * GET /api/head/incidents/assign?department=...&severity=...&category=...&location=...
 * Fetches real workers from DB, sends them to CityPulse /assign-team for AI-ranked recommendation
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const url = new URL(req.url);
  const department = url.searchParams.get("department") || "";
  const location = url.searchParams.get("location") || "";

  try {
    // 1. Get all active workers from DB
    const dbWorkers = await User.find({ role: "WORKER", isActive: true }).lean();

    // 2. Count active assigned incidents per worker
    const assignedIncidents = await IncidentModel.find(
      { assignedTo: { $exists: true, $ne: [] }, status: { $ne: "Resolved" } },
      { assignedTo: 1 }
    ).lean();

    const workloadMap: Record<string, number> = {};
    for (const inc of assignedIncidents) {
      const names: string[] = (inc as Record<string, unknown>).assignedTo as string[] ?? [];
      for (const name of names) {
        workloadMap[name] = (workloadMap[name] || 0) + 1;
      }
    }

    // 3. Build worker list
    const workers = dbWorkers.map((w) => ({
      name: w.name,
      zone: w.zone ?? "",
      workload: workloadMap[w.name] || 0,
      email: w.email,
    }));

    if (workers.length === 0) {
      return NextResponse.json({ error: "No active workers found in database" }, { status: 404 });
    }

    // 4. Rank workers locally using MongoDB data (zone match + workload)
    const rankedWorkers = workers
      .map((w) => {
        let score = 2; // base score
        // Zone proximity bonus
        if (w.zone && location && w.zone.toLowerCase().trim() === location.toLowerCase().trim()) {
          score += 3;
        }
        // Lower workload = higher score (0 tasks → +3, 1 → +2, 2 → +1, 3+ → 0)
        score += Math.max(0, 3 - w.workload);
        return { ...w, assignment_score: score };
      })
      .sort((a, b) => b.assignment_score - a.assignment_score);

    const recommended = rankedWorkers[0];
    const zoneNote = recommended.zone && location &&
      recommended.zone.toLowerCase().trim() === location.toLowerCase().trim()
        ? " (same zone)" : "";
    const justification = `Recommended based on zone proximity${zoneNote} and current workload (${recommended.workload} active task${recommended.workload !== 1 ? "s" : ""}). Lower workload workers are preferred for balanced distribution.`;

    return NextResponse.json({
      recommended_worker: recommended,
      all_workers_ranked: rankedWorkers,
      justification,
      department,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to compute worker recommendations" },
      { status: 500 }
    );
  }
}

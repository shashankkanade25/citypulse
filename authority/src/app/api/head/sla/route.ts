import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import User from "@/lib/database/models/user.model";
import { getCurrentUser } from "@/lib/auth";
import { seedWorkersAndHistory } from "@/lib/server/workerSeed";

// Severity-based SLA deadlines (hours)
const SLA_HOURS: Record<string, number> = {
  Critical: 24,
  High: 48,
  Medium: 72,
  Low: 120,
};

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Auto-seed if no workers exist
  const workerCount = await User.countDocuments({ role: "WORKER" });
  if (workerCount === 0) {
    await seedWorkersAndHistory();
  }

  const now = new Date();

  // fetch all non-resolved incidents
  const incidents = await IncidentModel.find({ status: { $ne: "Resolved" } })
    .sort({ createdAt: 1 })
    .lean();

  const rows = incidents.map((i: any) => {
    const created = new Date(i.createdAt);
    const slaHours = SLA_HOURS[i.severity] ?? 72;
    const deadline = new Date(created.getTime() + slaHours * 60 * 60 * 1000);

    const breached = now > deadline;
    const diffMs = deadline.getTime() - now.getTime();
    const absDiffMs = Math.abs(diffMs);
    const totalHours = Math.floor(absDiffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

    let timeRemaining: string;
    let slaStatus: "breached" | "at-risk" | "on-track";

    if (breached) {
      timeRemaining = `BREACHED by ${days > 0 ? `${days}d ` : ""}${hours}h ${minutes}m`;
      slaStatus = "breached";
    } else if (totalHours < 24) {
      // Less than 24h remaining = at risk
      timeRemaining = `${hours}h ${minutes}m remaining`;
      slaStatus = "at-risk";
    } else {
      timeRemaining = `${days}d ${hours}h remaining`;
      slaStatus = "on-track";
    }

    // Urgency score: higher = more urgent (for sorting)
    const urgencyScore = breached ? (10000 + totalHours) : (1000 - totalHours);

    return {
      _id: i._id?.toString(),
      incidentId: i.incidentId,
      title: i.title,
      severity: i.severity,
      zone: i.zone,
      department: i.department ?? "Unknown",
      status: i.status,
      assignedTo: i.assignedTo ?? [],
      createdAt: i.createdAt,
      deadline: deadline.toISOString(),
      slaHours,
      breached,
      slaStatus,
      timeRemaining,
      urgencyScore,
      progressPercent: breached ? 100 : Math.round(((slaHours * 3600000 - diffMs) / (slaHours * 3600000)) * 100),
    };
  });

  // Sort by urgency: breached first (by how much), then at-risk, then on-track
  rows.sort((a, b) => b.urgencyScore - a.urgencyScore);

  const breachedCount = rows.filter((r) => r.slaStatus === "breached").length;
  const atRisk = rows.filter((r) => r.slaStatus === "at-risk").length;
  const onTrack = rows.filter((r) => r.slaStatus === "on-track").length;

  return NextResponse.json({
    items: rows,
    stats: { breached: breachedCount, atRisk, onTrack, total: rows.length },
    slaRules: SLA_HOURS,
  });
}

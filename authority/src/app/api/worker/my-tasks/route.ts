import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import WorkerUpdate from "@/lib/database/models/worker-update.model";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/worker/my-tasks
 * Returns incidents assigned to the current worker, plus their EOD update status
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || !['WORKER', 'AUTHORITY_HEAD'].includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized — please sign in as a Worker" }, { status: 401 });
  }

  await connectDB();

  // Find incidents assigned to this user by name
  // For AUTHORITY_HEAD, also show incidents they assigned (for preview)
  let incidents;
  if (me.role === 'WORKER') {
    incidents = await IncidentModel.find({ assignedTo: me.name })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  } else {
    // AUTHORITY_HEAD: show all active incidents with assignments so they can preview the worker experience
    incidents = await IncidentModel.find({
      assignedTo: { $exists: true, $ne: [] },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  // Get today's start for checking EOD submissions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get all worker updates for these incidents
  const incidentIds = incidents.map((i) => i.incidentId);
  const todayUpdates = await WorkerUpdate.find({
    incidentId: { $in: incidentIds },
    workerName: me.name,
    date: { $gte: todayStart },
  }).lean();

  const todayUpdateMap = new Map(
    todayUpdates.map((u) => [u.incidentId, u])
  );

  const slaThreshold = new Date();
  slaThreshold.setDate(slaThreshold.getDate() - 3);

  const rows = incidents.map((i) => {
    const update = todayUpdateMap.get(i.incidentId);
    return {
      _id: (i as Record<string, unknown>)._id?.toString(),
      incidentId: i.incidentId,
      title: i.title,
      description: i.description,
      zone: i.zone,
      department: i.department,
      severity: i.severity,
      status: i.status,
      images: i.images,
      assignedTo: (i as Record<string, unknown>).assignedTo ?? [],
      createdAt: i.createdAt,
      slaBreached:
        i.status !== "Resolved" &&
        new Date(i.createdAt as unknown as string) < slaThreshold,
      todayEodSubmitted: !!update,
      todayEodStatus: update?.status ?? null,
    };
  });

  const active = rows.filter((r) => r.status === "Active");
  const resolved = rows.filter((r) => r.status === "Resolved");
  const onHold = rows.filter((r) => r.status === "On Hold");

  return NextResponse.json({
    incidents: rows,
    stats: {
      total: rows.length,
      active: active.length,
      resolved: resolved.length,
      onHold: onHold.length,
      eodPending: active.filter((r) => !r.todayEodSubmitted).length,
    },
  });
}

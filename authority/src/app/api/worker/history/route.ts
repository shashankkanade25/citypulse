import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import WorkerUpdate from "@/lib/database/models/worker-update.model";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/worker/history
 * Returns the worker's historical task data — all EOD updates grouped by incident
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !['WORKER', 'AUTHORITY_HEAD'].includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized — please sign in as a Worker" }, { status: 401 });
  }

  await connectDB();

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const statusFilter = url.searchParams.get("status"); // approved, pending, rejected

  // Get all incidents assigned to this worker
  const incidents = await IncidentModel.find({
    assignedTo: me.name,
  })
    .sort({ createdAt: -1 })
    .lean();

  const incidentIds = incidents.map((i) => i.incidentId);
  const incidentMap = new Map(
    incidents.map((i) => [
      i.incidentId,
      {
        _id: (i as Record<string, unknown>)._id?.toString(),
        incidentId: i.incidentId,
        title: i.title,
        description: i.description,
        zone: i.zone,
        department: i.department,
        severity: i.severity,
        status: i.status,
        createdAt: i.createdAt,
      },
    ])
  );

  // Get all EOD updates for this worker
  const updateFilter: Record<string, unknown> = {
    workerName: me.name,
    incidentId: { $in: incidentIds },
  };
  if (statusFilter && statusFilter !== "all") {
    updateFilter.status = statusFilter;
  }

  const totalUpdates = await WorkerUpdate.countDocuments(updateFilter);
  const updates = await WorkerUpdate.find(updateFilter)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Enrich updates with incident details
  const enrichedUpdates = updates.map((u) => ({
    _id: u._id?.toString(),
    incidentId: u.incidentId,
    incident: incidentMap.get(u.incidentId) ?? null,
    description: u.description,
    images: u.images,
    date: u.date,
    submittedAt: u.submittedAt,
    status: u.status,
    headRemarks: u.headRemarks,
    publishedToTransparency: u.publishedToTransparency,
  }));

  // Aggregate stats
  const allUpdates = await WorkerUpdate.find({ workerName: me.name }).lean();
  const stats = {
    totalUpdates: allUpdates.length,
    approved: allUpdates.filter((u) => u.status === "approved").length,
    pending: allUpdates.filter((u) => u.status === "pending").length,
    rejected: allUpdates.filter((u) => u.status === "rejected").length,
    totalIncidentsWorked: new Set(allUpdates.map((u) => u.incidentId)).size,
    resolvedIncidents: incidents.filter((i) => i.status === "Resolved").length,
  };

  return NextResponse.json({
    updates: enrichedUpdates,
    stats,
    pagination: {
      page,
      limit,
      total: totalUpdates,
      totalPages: Math.ceil(totalUpdates / limit),
    },
  });
}

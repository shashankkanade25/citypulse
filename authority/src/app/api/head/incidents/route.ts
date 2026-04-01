import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const severity = url.searchParams.get("severity");
  const zone = url.searchParams.get("zone");
  const sla = url.searchParams.get("sla");
  const sortBy = url.searchParams.get("sort") ?? "createdAt";

  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = status;
  if (severity && severity !== "all") filter.severity = severity;
  if (zone && zone !== "all") filter.zone = zone;
  if (sla === "breached") {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 3);
    filter.createdAt = { $lt: threshold };
    filter.status = { $ne: "Resolved" };
  }

  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  if (sortBy === "severity") sort = { severity: -1, createdAt: -1 };
  if (sortBy === "confidence") sort = { confidence: 1, createdAt: -1 };

  const incidents = await IncidentModel.find(filter).sort(sort).limit(200).lean();

  const slaThreshold = new Date();
  slaThreshold.setDate(slaThreshold.getDate() - 3);

  const rows = incidents.map((i) => ({
    _id: (i as Record<string, unknown>)._id?.toString(),
    incidentId: i.incidentId,
    title: i.title,
    description: i.description,
    zone: i.zone,
    department: i.department,
    severity: i.severity,
    status: i.status,
    confidence: i.confidence,
    citizenId: i.citizenId,
    images: i.images,
    assignedTo: (i as Record<string, unknown>).assignedTo ?? null,
    createdAt: i.createdAt,
    slaBreached: i.status !== "Resolved" && new Date(i.createdAt as unknown as string) < slaThreshold,
  }));

  // get unique zones for filter dropdown
  const allZones = await IncidentModel.distinct("zone");

  return NextResponse.json({ incidents: rows, zones: allZones });
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Pending moderation items act as "verification" queue
  const pending = await IncidentModel.find({ "moderation.status": "pending" })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const rows = pending.map((i) => ({
    _id: (i as Record<string, unknown>)._id?.toString(),
    incidentId: i.incidentId,
    title: i.title,
    description: i.description,
    zone: i.zone,
    department: i.department,
    severity: i.severity,
    confidence: i.confidence,
    images: i.images,
    citizenId: i.citizenId,
    createdAt: i.createdAt,
    moderation: i.moderation,
  }));

  const approvedToday = await IncidentModel.countDocuments({
    "moderation.status": "approved",
    "moderation.lastActionAt": { $gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) },
  });
  const rejectedToday = await IncidentModel.countDocuments({
    "moderation.status": "rejected",
    "moderation.lastActionAt": { $gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) },
  });

  return NextResponse.json({
    items: rows,
    stats: { pending: rows.length, approvedToday, rejectedToday },
  });
}

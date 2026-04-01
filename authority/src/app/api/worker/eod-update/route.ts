import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import WorkerUpdate from "@/lib/database/models/worker-update.model";
import User from "@/lib/database/models/user.model";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/worker/eod-update
 * Submit an EOD (End of Day) work update for an assigned incident
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !['WORKER', 'AUTHORITY_HEAD'].includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized — please sign in as a Worker" }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const { incidentId, description, images } = body;

  if (!incidentId || !description) {
    return NextResponse.json(
      { error: "incidentId and description are required" },
      { status: 400 }
    );
  }

  if (description.length < 10) {
    return NextResponse.json(
      { error: "Description must be at least 10 characters" },
      { status: 400 }
    );
  }

  // Verify the incident exists and is assigned to this worker
  const incident = await IncidentModel.findOne({ incidentId }).lean();
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const assignedTo = (incident as Record<string, unknown>).assignedTo as string[] | undefined;
  if (!assignedTo?.includes(me.name)) {
    return NextResponse.json(
      { error: "This incident is not assigned to you" },
      { status: 403 }
    );
  }

  // Get worker's ObjectId
  const workerUser = await User.findOne({ email: me.email }).lean();
  if (!workerUser) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  // Today's date (start of day for the date field)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if already submitted today for this incident
  const existing = await WorkerUpdate.findOne({
    incidentId,
    workerName: me.name,
    date: today,
  });

  if (existing) {
    // Update the existing submission
    existing.description = description;
    existing.images = images ?? [];
    existing.submittedAt = new Date();
    existing.status = "pending"; // Reset to pending on re-submit
    await existing.save();

    return NextResponse.json({
      success: true,
      message: "EOD update re-submitted successfully",
      update: existing,
    });
  }

  // Create new EOD update
  const update = await WorkerUpdate.create({
    incidentId,
    workerId: workerUser._id,
    workerName: me.name,
    description,
    images: images ?? [],
    date: today,
    submittedAt: new Date(),
    status: "pending",
  });

  return NextResponse.json({
    success: true,
    message: "EOD update submitted successfully",
    update,
  });
}

/**
 * GET /api/worker/eod-update
 * Get EOD updates for the current worker
 * Query params: incidentId (optional), date (optional)
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !['WORKER', 'AUTHORITY_HEAD'].includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized — please sign in as a Worker" }, { status: 401 });
  }

  await connectDB();

  const url = new URL(req.url);
  const incidentId = url.searchParams.get("incidentId");
  const dateStr = url.searchParams.get("date");

  const filter: Record<string, unknown> = {
    workerName: me.name,
  };

  if (incidentId) filter.incidentId = incidentId;
  if (dateStr) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    filter.date = { $gte: date, $lt: nextDay };
  }

  const updates = await WorkerUpdate.find(filter)
    .sort({ date: -1, submittedAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({ updates });
}

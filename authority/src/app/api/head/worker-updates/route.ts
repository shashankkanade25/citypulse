import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import WorkerUpdate from "@/lib/database/models/worker-update.model";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/head/worker-updates
 * Head can view all pending/approved/rejected EOD updates from workers
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  const filter: Record<string, unknown> = {};
  if (status !== "all") filter.status = status;

  const updates = await WorkerUpdate.find(filter)
    .sort({ submittedAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ updates });
}

/**
 * PATCH /api/head/worker-updates
 * Head can approve/reject a worker's EOD update and optionally publish to transparency
 */
export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const { updateId, action, remarks, publishToTransparency } = body;

  if (!updateId || !action) {
    return NextResponse.json(
      { error: "updateId and action are required" },
      { status: 400 }
    );
  }

  if (!["approved", "rejected"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  const update = await WorkerUpdate.findById(updateId);
  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  update.status = action;
  if (remarks) update.headRemarks = remarks;

  // Auto-publish approved updates to the transparency dashboard;
  // for rejections honour the (unlikely) explicit flag only.
  if (action === "approved") {
    update.publishedToTransparency =
      publishToTransparency !== undefined ? !!publishToTransparency : true;
  } else if (publishToTransparency) {
    update.publishedToTransparency = true;
  }

  await update.save();

  return NextResponse.json({
    success: true,
    message: `Update ${action} successfully`,
    update,
  });
}

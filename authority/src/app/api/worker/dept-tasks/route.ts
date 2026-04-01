import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import User from "@/lib/database/models/user.model";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/worker/dept-tasks
 * Returns all ongoing incidents in the worker's department
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || !['WORKER', 'AUTHORITY_HEAD'].includes(me.role)) {
    return NextResponse.json({ error: "Unauthorized — please sign in as a Worker" }, { status: 401 });
  }

  await connectDB();

  // Get the user record from DB for zone/department info
  const workerUser = await User.findOne({ email: me.email }).lean();

  // Build a department filter
  const filter: Record<string, unknown> = {
    status: { $ne: "Resolved" },
  };

  let deptLabel = "All Departments";

  if (workerUser?.zone) {
    filter.zone = workerUser.zone;
    deptLabel = workerUser.zone;
  }

  if (workerUser?.departmentId) {
    const { default: Department } = await import(
      "@/lib/database/models/department.model"
    );
    const dept = await Department.findById(workerUser.departmentId).lean();
    if (dept) {
      filter.department = dept.name;
      deptLabel = dept.name;
    }
  }

  // If no zone or department, show all active incidents (fallback)
  // This ensures data always shows up

  const incidents = await IncidentModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

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
    images: i.images,
    assignedTo: (i as Record<string, unknown>).assignedTo ?? [],
    createdAt: i.createdAt,
    slaBreached:
      i.status !== "Resolved" &&
      new Date(i.createdAt as unknown as string) < slaThreshold,
    isAssignedToMe:
      ((i as Record<string, unknown>).assignedTo as string[] | undefined)?.includes(me.name) ?? false,
  }));

  return NextResponse.json({
    incidents: rows,
    department: deptLabel,
    stats: {
      total: rows.length,
      myTasks: rows.filter((r) => r.isAssignedToMe).length,
      critical: rows.filter((r) => r.severity === "Critical").length,
      high: rows.filter((r) => r.severity === "High").length,
    },
  });
}

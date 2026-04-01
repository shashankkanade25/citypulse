import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/lib/database/models/user.model";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { getCurrentUser } from "@/lib/auth";
import { seedWorkersAndHistory } from "@/lib/server/workerSeed";

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

  const workers = await User.find({ role: "WORKER", isActive: true }).lean();

  // count active incidents per zone to estimate workload
  const zoneAgg = await IncidentModel.aggregate([
    { $match: { status: "Active" } },
    { $group: { _id: "$zone", count: { $sum: 1 } } },
  ]);
  const zoneMap = Object.fromEntries(
    zoneAgg.map((z: { _id: string; count: number }) => [z._id, z.count])
  );

  // Fetch all incidents that have workers assigned
  const assignedIncidents = await IncidentModel.find(
    { assignedTo: { $exists: true, $ne: [] } },
    { incidentId: 1, title: 1, severity: 1, status: 1, zone: 1, department: 1, assignedTo: 1, createdAt: 1, updatedAt: 1 }
  ).sort({ updatedAt: -1 }).lean();

  // Build a map of worker name -> their assigned incidents
  const workerIncidentMap: Record<string, typeof assignedIncidents> = {};
  for (const inc of assignedIncidents) {
    const names: string[] = (inc as any).assignedTo ?? [];
    for (const name of names) {
      if (!workerIncidentMap[name]) workerIncidentMap[name] = [];
      workerIncidentMap[name].push(inc);
    }
  }

  const rows = workers.map((w) => ({
    _id: w._id.toString(),
    name: w.name,
    email: w.email,
    phone: w.phone ?? null,
    zone: w.zone ?? "Unassigned",
    isActive: w.isActive,
    createdAt: w.createdAt,
    workload: zoneMap[w.zone ?? ""] ?? 0,
    history: (workerIncidentMap[w.name] ?? []).map((inc: any) => ({
      incidentId: inc.incidentId,
      title: inc.title,
      severity: inc.severity,
      status: inc.status,
      zone: inc.zone,
      department: inc.department,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    })),
  }));

  const totalWorkers = rows.length;
  const available = rows.filter((w) => w.workload === 0).length;
  const busy = totalWorkers - available;

  return NextResponse.json({
    workers: rows,
    stats: { totalWorkers, available, busy },
  });
}

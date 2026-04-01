import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import User from "@/lib/database/models/user.model";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  /* ── KPIs ───────────────────────────────────── */
  const [totalActive, highSeverity, resolved, onHold, totalIncidents] =
    await Promise.all([
      IncidentModel.countDocuments({ status: "Active" }),
      IncidentModel.countDocuments({ severity: { $in: ["High", "Critical"] }, status: "Active" }),
      IncidentModel.countDocuments({ status: "Resolved" }),
      IncidentModel.countDocuments({ status: "On Hold" }),
      IncidentModel.countDocuments(),
    ]);

  /* ── SLA breaches (active incidents older than 3 days) ─── */
  const slaThreshold = new Date();
  slaThreshold.setDate(slaThreshold.getDate() - 3);
  const slaBreached = await IncidentModel.countDocuments({
    status: { $ne: "Resolved" },
    createdAt: { $lt: slaThreshold },
  });

  /* ── Resolved today ─────────────────────────── */
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const resolvedToday = await IncidentModel.countDocuments({
    status: "Resolved",
    updatedAt: { $gte: todayStart },
  });

  /* ── 7-day incident trend ───────────────────── */
  const weekAgo = new Date();
  weekAgo.setUTCHours(0, 0, 0, 0);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);

  const trendAgg = await IncidentModel.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    {
      $group: {
        _id: {
          y: { $year: "$createdAt" },
          m: { $month: "$createdAt" },
          d: { $dayOfMonth: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
  ]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const trend = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(weekAgo);
    d.setUTCDate(weekAgo.getUTCDate() + idx);
    const hit = trendAgg.find(
      (t: { _id: { y: number; m: number; d: number }; count: number }) =>
        t._id.y === d.getUTCFullYear() && t._id.m === d.getUTCMonth() + 1 && t._id.d === d.getUTCDate()
    );
    return { day: dayNames[d.getUTCDay()], count: (hit?.count as number) ?? 0 };
  });

  /* ── Status distribution ────────────────────── */
  const statusAgg = await IncidentModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const statusDist = Object.fromEntries(
    statusAgg.map((s: { _id: string; count: number }) => [s._id, s.count])
  );

  /* ── Severity distribution ──────────────────── */
  const severityAgg = await IncidentModel.aggregate([
    { $match: { status: "Active" } },
    { $group: { _id: "$severity", count: { $sum: 1 } } },
  ]);
  const severityDist = Object.fromEntries(
    severityAgg.map((s: { _id: string; count: number }) => [s._id, s.count])
  );

  /* ── Zone distribution (top 5) ──────────────── */
  const zoneAgg = await IncidentModel.aggregate([
    { $group: { _id: "$zone", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);
  const zones = zoneAgg.map((z: { _id: string; count: number }) => ({
    zone: z._id,
    count: z.count,
  }));

  /* ── Worker utilisation ─────────────────────── */
  const totalWorkers = await User.countDocuments({ role: "WORKER", isActive: true });
  // workers with at least one active incident in their zone (approximation)
  const busyWorkerCount = totalWorkers > 0 ? Math.min(totalWorkers, totalActive) : 0;
  const workerUtilization = totalWorkers > 0 ? Math.round((busyWorkerCount / totalWorkers) * 100) : 0;

  return NextResponse.json({
    kpis: {
      totalIncidents,
      totalActive,
      highSeverity,
      slaBreached,
      resolvedToday,
      resolved,
      onHold,
    },
    trend,
    statusDist,
    severityDist,
    zones,
    workerUtilization,
    totalWorkers,
  });
}

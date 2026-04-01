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

  /* ── Key metrics ─────────────────────────── */
  const [total, resolved] = await Promise.all([
    IncidentModel.countDocuments(),
    IncidentModel.countDocuments({ status: "Resolved" }),
  ]);
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const SLA_DAYS = 3;
  const slaThreshold = new Date();
  slaThreshold.setDate(slaThreshold.getDate() - SLA_DAYS);
  const slaBreached = await IncidentModel.countDocuments({
    status: { $ne: "Resolved" },
    createdAt: { $lt: slaThreshold },
  });
  const slaCompliance = total > 0 ? Math.round(((total - slaBreached) / total) * 100) : 100;

  /* ── Zone performance ───────────────────── */
  const zoneAgg = await IncidentModel.aggregate([
    {
      $group: {
        _id: "$zone",
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 6 },
  ]);
  const zonePerf = zoneAgg.map((z: { _id: string; total: number; resolved: number }) => ({
    zone: z._id,
    total: z.total,
    resolved: z.resolved,
    efficiency: z.total > 0 ? Math.round((z.resolved / z.total) * 100) : 0,
  }));

  /* ── Category distribution ──────────────── */
  const catAgg = await IncidentModel.aggregate([
    { $group: { _id: "$department", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 6 },
  ]);
  const categories = catAgg.map((c: { _id: string; count: number }) => ({
    category: c._id,
    count: c.count,
    percentage: total > 0 ? Math.round((c.count / total) * 100) : 0,
  }));

  /* ── Severity distribution ──────────────── */
  const sevAgg = await IncidentModel.aggregate([
    { $group: { _id: "$severity", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const severityDist = Object.fromEntries(
    sevAgg.map((s: { _id: string; count: number }) => [s._id, s.count])
  );

  /* ── Top repeat hotspots ────────────────── */
  const hotspotAgg = await IncidentModel.aggregate([
    { $group: { _id: "$zone", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 4 },
  ]);
  const hotspots = hotspotAgg.map((h: { _id: string; count: number }) => ({
    zone: h._id,
    incidents: h.count,
  }));

  /* ── Worker ranking ─────────────────────── */
  const workers = await User.find({ role: "WORKER", isActive: true })
    .sort({ createdAt: 1 })
    .limit(10)
    .lean();

  const workerRanking = workers.map((w) => ({
    _id: w._id.toString(),
    name: w.name,
    zone: w.zone ?? "—",
  }));

  return NextResponse.json({
    kpis: { total, resolved, resolutionRate, slaCompliance },
    zonePerf,
    categories,
    severityDist,
    hotspots,
    workerRanking,
  });
}

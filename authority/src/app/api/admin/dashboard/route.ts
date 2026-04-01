import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { AuditEventModel } from "@/lib/database/models/auditEvent.model";
import { ensureAdminSeeded } from "@/lib/server/adminSeed";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { cacheGet, cacheKey, CACHE_TTLS } from "@/lib/admin/cache";

export async function GET() {
  const ck = cacheKey("dashboard");
  const data = await cacheGet(ck, CACHE_TTLS.dashboard, async () => {
  /* ───── Postgres path ───── */
  const pgResult = await pgReadOrNull(async (client) => {
    const counts = await client.query(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE status IN ('Active','OPEN','IN_PROGRESS')) AS active,
        count(*) FILTER (WHERE status IN ('Resolved','RESOLVED')) AS resolved,
        count(*) FILTER (WHERE moderation_status = 'pending') AS flagged
      FROM incidents
    `);
    const r = counts.rows[0];

    const trendRows = await client.query(`
      SELECT date_trunc('day', created_at)::date AS d, count(*)::int AS count
      FROM incidents
      WHERE created_at >= (current_date - interval '6 days')
      GROUP BY 1 ORDER BY 1
    `);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const trend = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - 6 + idx);
      const hit = trendRows.rows.find((t: any) => new Date(t.d).toISOString().slice(0, 10) === d.toISOString().slice(0, 10));
      return { day: dayNames[d.getUTCDay()], count: hit?.count ?? 0 };
    });

    const auditRows = await client.query(`
      SELECT type FROM audit_events ORDER BY ts DESC LIMIT 20
    `);
    const alerts = [] as Array<{ title: string; detail: string; severity: "High" | "Medium" | "Low" }>;
    const approvedCount = auditRows.rows.filter((e: any) => e.type === "MODERATION_APPROVED").length;
    const rejectedCount = auditRows.rows.filter((e: any) => e.type === "MODERATION_REJECTED").length;
    const citizenFlaggedCount = auditRows.rows.filter((e: any) => e.type === "CITIZEN_FLAGGED").length;
    if (rejectedCount >= 3) alerts.push({ title: "High rejection rate", detail: `${rejectedCount} moderation rejections recently`, severity: "Medium" });
    if (citizenFlaggedCount >= 2) alerts.push({ title: "Abuse indicator", detail: `${citizenFlaggedCount} citizen flags recently`, severity: "Medium" });
    if (approvedCount >= 5) alerts.push({ title: "Processing volume", detail: `${approvedCount} approvals recently`, severity: "Low" });
    if (alerts.length === 0) alerts.push({ title: "No anomalies", detail: "No integrity warnings detected in the recent window", severity: "Low" });

    return {
      kpis: { totalReported: Number(r.total), active: Number(r.active), resolved: Number(r.resolved), flagged: Number(r.flagged) },
      trend,
      alerts,
    };
  });

  if (pgResult !== null) return pgResult;

  /* ───── Mongo fallback ───── */
  await connectDB();
  await ensureAdminSeeded();

  const [totalReported, active, resolved, flagged] = await Promise.all([
    IncidentModel.countDocuments(),
    IncidentModel.countDocuments({ status: "Active" }),
    IncidentModel.countDocuments({ status: "Resolved" }),
    IncidentModel.countDocuments({ "moderation.status": "pending" }),
  ]);

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);

  const trendAgg = await IncidentModel.aggregate([
    { $match: { createdAt: { $gte: start } } },
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
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + idx);

    const hit = trendAgg.find(
      (t) => t._id.y === d.getUTCFullYear() && t._id.m === d.getUTCMonth() + 1 && t._id.d === d.getUTCDate()
    );

    return { day: dayNames[d.getUTCDay()], count: hit?.count ?? 0 };
  });

  const recentAudit = await AuditEventModel.find({}).sort({ ts: -1 }).limit(20);

  const alerts = [] as Array<{ title: string; detail: string; severity: "High" | "Medium" | "Low" }>;
  const approvedCount = recentAudit.filter((e) => e.type === "MODERATION_APPROVED").length;
  const rejectedCount = recentAudit.filter((e) => e.type === "MODERATION_REJECTED").length;
  const citizenFlaggedCount = recentAudit.filter((e) => e.type === "CITIZEN_FLAGGED").length;

  if (rejectedCount >= 3) {
    alerts.push({ title: "High rejection rate", detail: `${rejectedCount} moderation rejections recently`, severity: "Medium" });
  }
  if (citizenFlaggedCount >= 2) {
    alerts.push({ title: "Abuse indicator", detail: `${citizenFlaggedCount} citizen flags recently`, severity: "Medium" });
  }
  if (approvedCount >= 5) {
    alerts.push({ title: "Processing volume", detail: `${approvedCount} approvals recently`, severity: "Low" });
  }
  if (alerts.length === 0) {
    alerts.push({ title: "No anomalies", detail: "No integrity warnings detected in the recent window", severity: "Low" });
  }

  return {
    kpis: { totalReported, active, resolved, flagged },
    trend,
    alerts,
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

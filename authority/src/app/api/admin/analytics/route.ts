import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { ensureAdminSeeded } from "@/lib/server/adminSeed";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { cacheGet, cacheKey, CACHE_TTLS } from "@/lib/admin/cache";

function normalizeCategory(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "Other";
  const lc = v.toLowerCase();

  // If Postgres `category` enum is used
  if (v === "WATER") return "Water";
  if (v === "POWER") return "Electricity";
  if (v === "ROAD") return "Roads";

  // Free-form departments / categories
  if (lc.includes("water")) return "Water";
  if (lc.includes("electric") || lc.includes("power")) return "Electricity";
  if (lc.includes("road") || lc.includes("pothole") || lc.includes("transport")) return "Roads";
  if (lc.includes("sanitation") || lc.includes("waste") || lc.includes("garbage") || lc.includes("trash")) return "Sanitation";
  if (lc.includes("drain") || lc.includes("sewer")) return "Drainage";
  if (lc.includes("traffic") || lc.includes("signal")) return "Traffic";
  if (lc.includes("streetlight") || lc.includes("street light") || lc.includes("lamp")) return "Streetlight";

  return "Other";
}

export async function GET() {
  const ck = cacheKey("analytics");
  const data = await cacheGet(ck, CACHE_TTLS.analytics, async () => {
  const pgResult = await pgReadOrNull(async (client) => {
    const { rows } = await client.query<{
      zone: string;
      category: string;
      count: number;
    }>(`
      SELECT
        zone,
        COALESCE(category, department_name, 'Other') AS category,
        count(*)::int AS count
      FROM incidents
      WHERE zone IS NOT NULL AND zone <> ''
        AND zone <> 'UNKNOWN'
      GROUP BY zone, COALESCE(category, department_name, 'Other')
    `);

    const zoneToTotals = new Map<string, number>();
    const zoneToCategoryCounts = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const zone = row.zone;
      const category = normalizeCategory(row.category);
      const count = row.count;
      if (typeof zone !== "string" || zone.length === 0) continue;
      if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue;

      zoneToTotals.set(zone, (zoneToTotals.get(zone) ?? 0) + count);

      const bucket = zoneToCategoryCounts.get(zone) ?? new Map<string, number>();
      bucket.set(category, (bucket.get(category) ?? 0) + count);
      zoneToCategoryCounts.set(zone, bucket);
    }

    const totalReports = Array.from(zoneToTotals.values()).reduce((sum, n) => sum + n, 0);
    const zonesTracked = zoneToTotals.size;

    const zones = Array.from(zoneToTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([zone, total]) => {
        const categoryCounts = zoneToCategoryCounts.get(zone) ?? new Map<string, number>();
        const topCategories = Array.from(categoryCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([category, count]) => ({ category, count }));

        return { zone, total, topCategories };
      });

    return {
      generatedAt: new Date().toISOString(),
      totalReports,
      zonesTracked,
      zones,
    };
  });

  if (pgResult !== null) return pgResult;

  await connectDB();
  await ensureAdminSeeded();

  type ZoneCategoryAggRow = {
    _id: { zone: string; category: string | null };
    count: number;
  };

  const raw = (await IncidentModel.aggregate([
    {
      $match: {
        zone: { $type: "string", $ne: "" },
      },
    },
    {
      $project: {
        zone: 1,
        resolvedCategory: { $ifNull: ["$category", "$department"] },
      },
    },
    {
      $group: {
        _id: { zone: "$zone", category: "$resolvedCategory" },
        count: { $sum: 1 },
      },
    },
  ])) as ZoneCategoryAggRow[];

  const zoneToTotals = new Map<string, number>();
  const zoneToCategoryCounts = new Map<string, Map<string, number>>();

  for (const row of raw) {
    const zone = row?._id?.zone;
    if (typeof zone !== "string" || zone.length === 0) continue;

    const category = normalizeCategory(typeof row?._id?.category === "string" ? row._id.category : null);
    const count = typeof row?.count === "number" ? row.count : 0;

    zoneToTotals.set(zone, (zoneToTotals.get(zone) ?? 0) + count);

    const bucket = zoneToCategoryCounts.get(zone) ?? new Map<string, number>();
    bucket.set(category, (bucket.get(category) ?? 0) + count);
    zoneToCategoryCounts.set(zone, bucket);
  }

  const totalReports = Array.from(zoneToTotals.values()).reduce((sum, n) => sum + n, 0);
  const zonesTracked = zoneToTotals.size;

  const zones = Array.from(zoneToTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zone, total]) => {
      const categoryCounts = zoneToCategoryCounts.get(zone) ?? new Map<string, number>();
      const topCategories = Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([category, count]) => ({ category, count }));

      return { zone, total, topCategories };
    });

  return {
    generatedAt: new Date().toISOString(),
    totalReports,
    zonesTracked,
    zones,
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

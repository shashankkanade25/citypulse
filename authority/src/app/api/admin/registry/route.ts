import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { ensureAdminSeeded } from "@/lib/server/adminSeed";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { cacheGet, cacheKey, CACHE_TTLS } from "@/lib/admin/cache";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const department = url.searchParams.get("department") ?? "All";
  const zone = url.searchParams.get("zone") ?? "All";
  const severity = url.searchParams.get("severity") ?? "All";

  const ck = cacheKey("registry", `q=${q}&s=${status}&d=${department}&z=${zone}&sv=${severity}`);
  const data = await cacheGet(ck, CACHE_TTLS.registry, async () => {
  const pgResult = await pgReadOrNull(async (client) => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.length > 0) {
      conditions.push(`(incident_code ILIKE $${idx} OR title ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }
    if (status !== "All") { conditions.push(`status = $${idx}`); params.push(status); idx++; }
    if (department !== "All") { conditions.push(`department_name = $${idx}`); params.push(department); idx++; }
    if (zone !== "All") { conditions.push(`zone = $${idx}`); params.push(zone); idx++; }
    if (severity !== "All") { conditions.push(`severity = $${idx}`); params.push(severity); idx++; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await client.query(
      `SELECT incident_code AS id, title, status, department_name AS department,
              zone, severity, confidence_score AS confidence, created_at AS "createdAt"
       FROM incidents ${where}
       ORDER BY created_at DESC LIMIT 200`,
      params
    );
    return { incidents: rows };
  });

  if (pgResult !== null) return pgResult;

  await connectDB();
  await ensureAdminSeeded();

  const and: Record<string, unknown>[] = [];

  if (q.length > 0) {
    and.push({
      $or: [
        { incidentId: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
      ],
    });
  }
  if (status !== "All") and.push({ status });
  if (department !== "All") and.push({ department });
  if (zone !== "All") and.push({ zone });
  if (severity !== "All") and.push({ severity });

  const filter = and.length > 0 ? { $and: and } : {};

  const incidents = await IncidentModel.find(filter).sort({ createdAt: -1 }).limit(200);

  return {
    incidents: incidents.map((i) => ({
      rowId: i._id.toString(),
      id: i.incidentId,
      title: i.title,
      status: i.status,
      department: i.department,
      zone: i.zone,
      severity: i.severity,
      confidence: i.confidence,
      createdAt: i.createdAt,
    })),
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

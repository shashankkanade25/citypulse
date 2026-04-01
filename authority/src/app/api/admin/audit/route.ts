import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { AuditEventModel } from "@/lib/database/models/auditEvent.model";
import { withPgClient } from "@/lib/postgres";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { cacheGet, cacheKey, CACHE_TTLS } from "@/lib/admin/cache";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "All";
  const scope = (url.searchParams.get("scope") ?? "admin").toLowerCase();

  const ck = cacheKey("audit", `${scope}:${type}`);
  const data = await cacheGet(ck, CACHE_TTLS.audit, async () => {
  // Citizen activity stream should come from Postgres even when READ_FROM_POSTGRES is off,
  // otherwise admins see an empty table while incidents exist in Supabase.
  if (scope === "citizens") {
    try {
      const result = await withPgClient(async (client) => {
        const { rows } = await client.query(
          `SELECT
             i.created_at AS ts,
             COALESCE(i.citizen_external_id, i.reported_by_user_id::text, 'citizen') AS actor,
             'CITIZEN_REPORTED' AS type,
             'incident' AS "entityType",
             i.incident_code AS "entityId",
             i.title AS remark,
             jsonb_build_object(
               'department', i.department_name,
               'category', i.category,
               'status', i.status,
               'latitude', i.latitude,
               'longitude', i.longitude,
               'dedupeKey', COALESCE(i.metadata->>'dedupeKey', NULL),
               'reportCount', CASE
                 WHEN (i.metadata->>'reportCount') ~ '^[0-9]+$' THEN (i.metadata->>'reportCount')::int
                 ELSE 1
               END
             ) AS metadata
           FROM incidents i
           WHERE
             i.citizen_external_id IS NOT NULL
             OR i.incident_code LIKE 'citizen_%'
             OR COALESCE(i.metadata->>'source','') IN ('citizens-live','citizens-report')
           ORDER BY i.created_at DESC
           LIMIT 300`,
        );

        return { events: rows.map((e: any) => ({ ...e, metadata: e.metadata ?? {} })) };
      });

      return result;
    } catch (error) {
      console.error("[admin/audit] citizens pg query failed:", error);
      return { events: [] };
    }
  }

  const pgResult = await pgReadOrNull(async (client) => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (type !== "All") { conditions.push("type = $1"); params.push(type); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await client.query(
      `SELECT ts, actor, type, entity_type AS "entityType", entity_id AS "entityId",
              remark, metadata
       FROM audit_events ${where}
       ORDER BY ts DESC LIMIT 300`,
      params
    );
    return { events: rows.map((e: any) => ({ ...e, metadata: e.metadata ?? {} })) };
  });

  if (pgResult !== null) return pgResult;

  await connectDB();

  if (scope === "citizens") {
    // Mongo fallback has no citizen audit stream right now.
    return { events: [] };
  }

  const filter: Record<string, unknown> = {};
  if (type !== "All") filter.type = type;

  const events = await AuditEventModel.find(filter).sort({ ts: -1 }).limit(300);

  return {
    events: events.map((e) => ({
      ts: e.ts,
      actor: e.actor,
      type: e.type,
      entityType: e.entityType,
      entityId: e.entityId,
      remark: e.remark,
      metadata: e.metadata ?? {},
    })),
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

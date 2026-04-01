import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { ensureAdminSeeded } from "@/lib/server/adminSeed";
import { SystemConfigModel } from "@/lib/database/models/systemConfig.model";
import { writeAuditEvent } from "@/lib/server/adminAudit";
import { dualWritePostgresFirst } from "@/lib/server/dualWrite";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { publishEvent, TOPICS } from "@/lib/kafka";
import { cacheGet, cacheKey, CACHE_TTLS, invalidateDomain } from "@/lib/admin/cache";

export async function GET() {
  const ck = cacheKey("config");
  const data = await cacheGet(ck, CACHE_TTLS.config, async () => {
  const pgResult = await pgReadOrNull(async (client) => {
    const { rows } = await client.query(`SELECT key, value FROM system_config LIMIT 200`);
    const cfg: Record<string, unknown> = {};
    for (const r of rows) {
      try { cfg[r.key] = JSON.parse(r.value); } catch { cfg[r.key] = r.value; }
    }
    return { cfg };
  });

  if (pgResult !== null) return pgResult;

  await connectDB();
  await ensureAdminSeeded();

  const entries = await SystemConfigModel.find({}).limit(200);
  const cfg: Record<string, unknown> = {};
  for (const e of entries) cfg[e.key] = e.value;

  return { cfg };
  }); // end cacheGet

  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  await connectDB();
  await ensureAdminSeeded();

  const body = (await req.json()) as { cfg?: Record<string, unknown>; remark?: string };
  if (!body.cfg) {
    return NextResponse.json({ error: "cfg is required" }, { status: 400 });
  }

  const updates = Object.entries(body.cfg);
  const remark = (body.remark ?? "").trim() || "Config updated";
  const now = new Date();

  await dualWritePostgresFirst({
    pg: async (client) => {
      for (const [key, value] of updates) {
        await client.query(
          `INSERT INTO system_config(key, value, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, JSON.stringify(value)]
        );
      }

      await client.query(
        `INSERT INTO audit_events(ts, actor, type, entity_type, entity_id, remark, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [now, "admin-demo", "CONFIG_UPDATED", "config", "system", remark, JSON.stringify({ keys: updates.map(([k]) => k) })]
      );
    },
    primary: async () => {
      await Promise.all(
        updates.map(async ([key, value]) => {
          await SystemConfigModel.updateOne({ key }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
        })
      );

      await writeAuditEvent({
        type: "CONFIG_UPDATED",
        entityType: "config",
        entityId: "system",
        remark,
        metadata: { keys: updates.map(([k]) => k) },
      });
    },
  });

  publishEvent(TOPICS.CONFIG_UPDATED, "system", {
    keys: updates.map(([k]) => k),
    remark,
  });

  // Invalidate config and flagged cache (config can change flagging thresholds)
  await invalidateDomain("config", "flagged");

  return NextResponse.json({ ok: true });
}

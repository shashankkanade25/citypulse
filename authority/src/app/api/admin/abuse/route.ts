import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { ensureAdminSeeded } from "@/lib/server/adminSeed";
import { AbuseCaseModel } from "@/lib/database/models/abuseCase.model";
import { writeAuditEvent } from "@/lib/server/adminAudit";
import { dualWritePostgresFirst } from "@/lib/server/dualWrite";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { publishEvent, TOPICS } from "@/lib/kafka";
import { cacheGet, cacheKey, CACHE_TTLS, invalidateDomain } from "@/lib/admin/cache";

export async function GET() {
  const ck = cacheKey("abuse");
  const data = await cacheGet(ck, CACHE_TTLS.abuse, async () => {
  const pgResult = await pgReadOrNull(async (client) => {
    const { rows } = await client.query(`
      SELECT case_id AS id, citizen_id AS "citizenId", reason, risk,
             last_seen AS "lastSeen", status, blocked_until AS "blockedUntil"
      FROM abuse_cases
      ORDER BY last_seen DESC LIMIT 200
    `);
    return { cases: rows };
  });

  if (pgResult !== null) return pgResult;

  await connectDB();
  await ensureAdminSeeded();

  const cases = await AbuseCaseModel.find({}).sort({ lastSeen: -1 }).limit(200);

  return {
    cases: cases.map((c) => ({
      id: c.caseId,
      citizenId: c.citizenId,
      reason: c.reason,
      risk: c.risk,
      lastSeen: c.lastSeen,
      status: c.status,
      blockedUntil: c.blockedUntil,
    })),
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  await connectDB();
  await ensureAdminSeeded();

  const body = (await req.json()) as {
    caseId?: string;
    action?: "Warned" | "Blocked" | "Unblocked";
    note?: string;
  };

  if (!body.caseId || !body.action) {
    return NextResponse.json({ error: "caseId and action are required" }, { status: 400 });
  }

  const abuseCase = await AbuseCaseModel.findOne({ caseId: body.caseId });
  if (!abuseCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const note = (body.note ?? "").trim() || "(no note)";

  const now = new Date();
  const nextStatus =
    body.action === "Warned"
      ? "Warned"
      : body.action === "Blocked"
        ? "Temporarily blocked"
        : "Monitoring";
  const nextBlockedUntil = body.action === "Blocked" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;
  const remark = `${body.action}: ${note}`;

  await dualWritePostgresFirst({
    pg: async (client) => {
      await client.query(
        `INSERT INTO abuse_cases(
          case_id, citizen_id, reason, risk, status, last_seen, blocked_until, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,now(),now()
        )
        ON CONFLICT (case_id)
        DO UPDATE SET status = EXCLUDED.status, blocked_until = EXCLUDED.blocked_until, updated_at = now(), last_seen = GREATEST(abuse_cases.last_seen, EXCLUDED.last_seen)`,
        [
          abuseCase.caseId,
          abuseCase.citizenId,
          abuseCase.reason,
          abuseCase.risk,
          nextStatus,
          abuseCase.lastSeen ?? now,
          nextBlockedUntil,
        ]
      );

      await client.query(
        `INSERT INTO audit_events(ts, actor, type, entity_type, entity_id, remark, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          now,
          "admin-demo",
          "ABUSE_ACTION",
          "abuse_case",
          abuseCase.caseId,
          remark,
          JSON.stringify({
            citizenId: abuseCase.citizenId,
            status: nextStatus,
            blockedUntil: nextBlockedUntil ? nextBlockedUntil.toISOString() : null,
          }),
        ]
      );
    },
    primary: async () => {
      if (body.action === "Warned") {
        abuseCase.status = "Warned";
        await abuseCase.save();
      }

      if (body.action === "Blocked") {
        abuseCase.status = "Temporarily blocked";
        abuseCase.blockedUntil = nextBlockedUntil ?? undefined;
        await abuseCase.save();
      }

      if (body.action === "Unblocked") {
        abuseCase.status = "Monitoring";
        abuseCase.blockedUntil = undefined;
        await abuseCase.save();
      }

      await writeAuditEvent({
        type: "ABUSE_ACTION",
        entityType: "abuse_case",
        entityId: abuseCase.caseId,
        remark,
        metadata: {
          citizenId: abuseCase.citizenId,
          status: abuseCase.status,
          blockedUntil: abuseCase.blockedUntil?.toISOString() ?? null,
        },
      });
    },
  });

  publishEvent(TOPICS.ABUSE_ACTION, abuseCase.caseId, {
    caseId: abuseCase.caseId,
    citizenId: abuseCase.citizenId,
    action: body.action,
    status: nextStatus,
    blockedUntil: nextBlockedUntil?.toISOString() ?? null,
  });

  // Invalidate abuse cache
  await invalidateDomain("abuse", "dashboard");

  return NextResponse.json({ ok: true, blockedUntil: abuseCase.blockedUntil ?? null, status: abuseCase.status });
}

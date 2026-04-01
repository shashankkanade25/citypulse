import { AuditEventModel } from "@/lib/database/models/auditEvent.model";
import { mongoWriteAllowed } from "@/lib/server/dualWrite";
import { withPgClient } from "@/lib/postgres";
import { publishEvent, TOPICS } from "@/lib/kafka";

export type AuditEventType =
  | "MODERATION_APPROVED"
  | "MODERATION_REJECTED"
  | "CITIZEN_FLAGGED"
  | "USER_UPDATED"
  | "ABUSE_ACTION"
  | "CONFIG_UPDATED";

export async function writeAuditEvent(input: {
  type: AuditEventType;
  entityType: string;
  entityId: string;
  remark: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Always write to PG when dual-write or read-only mode is on
  try {
    await withPgClient(async (client) => {
      await client.query(
        `INSERT INTO audit_events (actor, type, entity_type, entity_id, remark, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.actor ?? "admin-demo",
          input.type,
          input.entityType,
          input.entityId,
          input.remark,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
    });
  } catch (err) {
    console.error("[writeAuditEvent] PG write failed:", err);
  }

  // Write to Mongo only when not read-only
  if (mongoWriteAllowed()) {
    await AuditEventModel.create({
      ts: new Date(),
      actor: input.actor ?? "admin-demo",
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      remark: input.remark,
      metadata: input.metadata ?? {},
    });
  }

  // Fire-and-forget Kafka event
  publishEvent(TOPICS.AUDIT_EVENT, input.entityId, {
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    actor: input.actor ?? "admin-demo",
    remark: input.remark,
    metadata: input.metadata,
  });
}

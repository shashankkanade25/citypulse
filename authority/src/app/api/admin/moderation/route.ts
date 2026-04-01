import { NextResponse } from "next/server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import User from "@/lib/database/models/user.model";
import { ensureAdminSeeded } from "@/lib/server/adminSeed";
import { writeAuditEvent } from "@/lib/server/adminAudit";
import { dualWritePostgresFirst } from "@/lib/server/dualWrite";
import { publishEvent, TOPICS } from "@/lib/kafka";
import { invalidateDomain } from "@/lib/admin/cache";
import { sendMail } from "@/lib/email";
import { moderationActionTemplate } from "@/lib/emailTemplates";

function toDepartmentCode(name: string): string {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 32) || "GENERAL";
}

export async function POST(req: Request) {
  await connectDB();
  await ensureAdminSeeded();

  const body = (await req.json()) as {
    incidentId?: string;
    action?: "Approved" | "Rejected" | "Citizen flagged";
    remark?: string;
  };

  if (!body.incidentId || !body.action) {
    return NextResponse.json({ error: "incidentId and action are required" }, { status: 400 });
  }

  const incident = await IncidentModel.findOne({ incidentId: body.incidentId });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const remark = (body.remark ?? "").trim() || "(no remark)";

  const now = new Date();
  const moderationStatus = body.action === "Approved" ? "approved" : body.action === "Rejected" ? "rejected" : incident.moderation.status;
  const citizenFlagged = body.action === "Citizen flagged" ? true : incident.moderation.citizenFlagged;
  const auditType =
    body.action === "Approved"
      ? "MODERATION_APPROVED"
      : body.action === "Rejected"
        ? "MODERATION_REJECTED"
        : "CITIZEN_FLAGGED";
  const auditEntityType = body.action === "Citizen flagged" ? "citizen" : "incident";
  const auditEntityId = body.action === "Citizen flagged" ? incident.citizenId : incident.incidentId;
  const auditMetadata = body.action === "Citizen flagged" ? { incidentId: incident.incidentId } : undefined;

  await dualWritePostgresFirst({
    pg: async (client) => {
      const departmentCode = toDepartmentCode(incident.department);
      const dep = await client.query(
        `INSERT INTO departments(name, code, category, updated_at)
         VALUES ($1, $2, NULL, now())
         ON CONFLICT (code)
         DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id`,
        [incident.department, departmentCode]
      );
      const departmentId: string = dep.rows[0]?.id;

      const reasonsJson = JSON.stringify(incident.reasons ?? []);
      const metadataJson = JSON.stringify({
        source: "authority-mongo",
        images: incident.images ?? [],
        duplicateClusterId: incident.duplicateClusterId ?? null,
      });

      await client.query(
        `INSERT INTO incidents(
          incident_code,
          title,
          description,
          severity,
          status,
          department_id,
          zone,
          created_by_user_id,
          reported_by_user_id,
          department_name,
          speech_to_text,
          confidence_score,
          reasons,
          citizen_external_id,
          citizen_report_count_30d,
          moderation_status,
          moderation_last_action_at,
          moderation_last_remark,
          moderation_citizen_flagged,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,NULL,NULL,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        ON CONFLICT (incident_code)
        DO UPDATE SET
          moderation_status = EXCLUDED.moderation_status,
          moderation_last_action_at = EXCLUDED.moderation_last_action_at,
          moderation_last_remark = EXCLUDED.moderation_last_remark,
          moderation_citizen_flagged = EXCLUDED.moderation_citizen_flagged,
          updated_at = now()`,
        [
          incident.incidentId,
          incident.title,
          incident.description,
          incident.severity,
          incident.status,
          departmentId,
          incident.zone,
          incident.department,
          incident.speechToText,
          incident.confidence,
          reasonsJson,
          incident.citizenId,
          incident.citizenReportCount30d,
          moderationStatus,
          now,
          remark,
          citizenFlagged,
          metadataJson,
          incident.createdAt ?? now,
          now,
        ]
      );

      await client.query(
        `INSERT INTO audit_events(ts, actor, type, entity_type, entity_id, remark, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [now, "admin-demo", auditType, auditEntityType, auditEntityId, remark, auditMetadata ? JSON.stringify(auditMetadata) : null]
      );
    },
    primary: async () => {
      if (body.action === "Approved") {
        incident.moderation.status = "approved";
        incident.moderation.lastActionAt = now;
        incident.moderation.lastRemark = remark;
        await incident.save();
        await writeAuditEvent({ type: "MODERATION_APPROVED", entityType: "incident", entityId: incident.incidentId, remark });
        return;
      }

      if (body.action === "Rejected") {
        incident.moderation.status = "rejected";
        incident.moderation.lastActionAt = now;
        incident.moderation.lastRemark = remark;
        await incident.save();
        await writeAuditEvent({ type: "MODERATION_REJECTED", entityType: "incident", entityId: incident.incidentId, remark });
        return;
      }

      incident.moderation.citizenFlagged = true;
      incident.moderation.lastActionAt = now;
      incident.moderation.lastRemark = remark;
      await incident.save();
      await writeAuditEvent({
        type: "CITIZEN_FLAGGED",
        entityType: "citizen",
        entityId: incident.citizenId,
        remark,
        metadata: { incidentId: incident.incidentId },
      });
    },
  });

  // Send moderation email to citizen (fire-and-forget)
  if (incident.citizenId) {
    let citizenUser: Record<string, unknown> | null = null;
    if (mongoose.Types.ObjectId.isValid(incident.citizenId)) {
      citizenUser = await User.findById(incident.citizenId).lean() as Record<string, unknown> | null;
    }
    if (!citizenUser) {
      citizenUser = await User.findOne({ email: incident.citizenId }).lean() as Record<string, unknown> | null;
    }
    const citizenEmail = citizenUser?.email as string;
    if (citizenEmail) {
      const emailContent = moderationActionTemplate({
        citizenEmail,
        citizenName: (citizenUser?.name as string) || "Citizen",
        title: incident.title,
        incidentId: incident.incidentId,
        action: body.action!,
        remark: remark !== "(no remark)" ? remark : undefined,
        updatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      });
      sendMail({ to: citizenEmail, ...emailContent });
    }
  }

  // Fire-and-forget Kafka event
  publishEvent(TOPICS.INCIDENT_MODERATED, incident.incidentId, {
    incidentId: incident.incidentId,
    action: body.action,
    moderationStatus,
    citizenFlagged,
    remark,
  });

  // Invalidate caches affected by moderation changes
  await invalidateDomain("flagged", "dashboard", "registry", "audit");

  return NextResponse.json({ ok: true });
}

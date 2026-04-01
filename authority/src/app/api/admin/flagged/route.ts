import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { IncidentModel } from "@/lib/database/models/incident.model";
import { ensureAdminSeeded } from "@/lib/server/adminSeed";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { SystemConfigModel } from "@/lib/database/models/systemConfig.model";
import { cacheGet, cacheKey, CACHE_TTLS } from "@/lib/admin/cache";

export async function GET() {
  const ck = cacheKey("flagged");
  const data = await cacheGet(ck, CACHE_TTLS.flagged, async () => {
  const pgResult = await pgReadOrNull(async (client) => {
    const { rows } = await client.query(`
      SELECT incident_code AS id, title, zone, department_name AS department,
             confidence_score AS confidence, reasons, citizen_external_id AS "citizenId",
             citizen_report_count_30d AS "citizenReportCount30d",
             grouped_incident_id AS "duplicateClusterId",
             description, speech_to_text AS "speechToText",
             moderation_status, moderation_last_action_at, moderation_last_remark,
             moderation_citizen_flagged, metadata,
             created_at AS "createdAt"
      FROM incidents
      WHERE moderation_status = 'pending'
      ORDER BY created_at DESC
      LIMIT 100
    `);
    return {
      incidents: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        zone: r.zone,
        department: r.department,
        confidence: r.confidence,
        reasons: typeof r.reasons === "string" ? JSON.parse(r.reasons) : (r.reasons ?? []),
        citizenId: r.citizenId,
        citizenReportCount30d: r.citizenReportCount30d,
        duplicateClusterId: r.duplicateClusterId,
        description: r.description,
        speechToText: r.speechToText,
        images: r.metadata?.images ?? [],
        moderation: {
          status: r.moderation_status,
          lastActionAt: r.moderation_last_action_at,
          lastRemark: r.moderation_last_remark,
          citizenFlagged: r.moderation_citizen_flagged,
        },
        createdAt: r.createdAt,
      })),
    };
  });

  if (pgResult !== null) return pgResult;

  await connectDB();
  await ensureAdminSeeded();

  const entry = await SystemConfigModel.findOne({ key: "ml.confidenceThreshold" }).lean();
  const minMlConfidence = typeof entry?.value === "number" ? (entry.value as number) : 0.6;

  const flagged = await IncidentModel.find({
    "moderation.status": "pending",
    confidence: { $lt: minMlConfidence },
  })
    .sort({ createdAt: -1 })
    .limit(100);

  return {
    minMlConfidence,
    incidents: flagged.map((i) => ({
      rowId: i._id.toString(),
      id: i.incidentId,
      title: i.title,
      zone: i.zone,
      department: i.department,
      confidence: i.confidence,
      reasons: i.reasons,
      citizenId: i.citizenId,
      citizenReportCount30d: i.citizenReportCount30d,
      duplicateClusterId: i.duplicateClusterId,
      description: i.description,
      speechToText: i.speechToText,
      images: i.images,
      moderation: i.moderation,
      createdAt: i.createdAt,
    })),
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

import { NextRequest } from 'next/server';
import { errorResponse, handleApiError, successResponse } from '@/lib/utils/response';
import { pgReadOrNull } from '@/lib/server/readSwitch';
import { withPgClient } from '@/lib/postgres';
import { connectDB } from '@/lib/db';
import Issue from '@/lib/models/Issue';
import WorkerUpdate from '@/lib/models/WorkerUpdate';

type TimelineItem = {
  type: 'REPORTED' | 'STATUS_UPDATE' | 'WORKER_UPDATE';
  at: string;
  title: string;
  remark?: string | null;
  citizenImages: string[];
  authorityImages: string[];
  workerName?: string;
};

type IncidentRow = {
  id: string;
  incident_code: string;
  title: string;
  description: string;
  severity: string | null;
  status: string | null;
  department_name: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type StatusHistoryRow = {
  from_status: string | null;
  to_status: string | null;
  remark: string | null;
  metadata: unknown;
  created_at: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ incidentCode: string }> }) {
  try {
    const { incidentCode } = await ctx.params;
    if (!incidentCode) return errorResponse('Missing incidentCode', 400);

    // Postgres path (only when READ_FROM_POSTGRES=true)
    const pgData = await pgReadOrNull(async () => {
      return withPgClient(async (client) => {
        const incRes = await client.query(
          `SELECT id, incident_code, title, description, severity, status, department_name, category,
                  latitude, longitude, metadata, created_at, updated_at
           FROM incidents
           WHERE incident_code = $1
           LIMIT 1`,
          [incidentCode],
        );

        const incident = incRes.rows[0] as IncidentRow | undefined;
        if (!incident) return null;

        const historyRes = await client.query(
          `SELECT from_status, to_status, remark, metadata, created_at
           FROM incident_status_history
           WHERE incident_id = $1
           ORDER BY created_at ASC`,
          [incident.id],
        );

        return { incident, history: historyRes.rows as StatusHistoryRow[] };
      });
    });

    if (pgData) {
      const { incident, history } = pgData;
      const metadata = incident.metadata && typeof incident.metadata === 'object'
        ? (incident.metadata as Record<string, unknown>)
        : {};

      const citizenImages = asStringArray(metadata.citizenImages ?? metadata.images);

      const timeline: TimelineItem[] = [
        {
          type: 'REPORTED',
          at: new Date(incident.created_at).toISOString(),
          title: 'Reported',
          remark: 'Citizen reported the issue',
          citizenImages,
          authorityImages: [],
        },
      ];

      for (const h of history) {
        const hm = h.metadata && typeof h.metadata === 'object'
          ? (h.metadata as Record<string, unknown>)
          : {};
        const imgs = asStringArray(hm.images ?? hm.authorityImages);
        const toStatus = h.to_status ? String(h.to_status) : 'UPDATE';

        timeline.push({
          type: 'STATUS_UPDATE',
          at: new Date(h.created_at).toISOString(),
          title: toStatus,
          remark: h.remark ?? null,
          citizenImages: [],
          authorityImages: imgs,
        });
      }

      const latestAuthorityImages = [...timeline]
        .reverse()
        .find((t) => t.authorityImages.length > 0)?.authorityImages ?? [];

      // Fetch approved worker updates published to transparency (from shared MongoDB)
      await connectDB();
      const workerUpdates = await WorkerUpdate.find({
        incidentId: incidentCode,
        status: 'approved',
        publishedToTransparency: true,
      })
        .sort({ date: 1 })
        .lean();

      for (const wu of workerUpdates) {
        const wuDate = wu.submittedAt ?? wu.date;
        timeline.push({
          type: 'WORKER_UPDATE',
          at: new Date(wuDate).toISOString(),
          title: 'Worker Update',
          remark: wu.description ?? null,
          citizenImages: [],
          authorityImages: Array.isArray(wu.images) ? wu.images : [],
          workerName: wu.workerName ?? undefined,
        });
      }

      // Re-sort the timeline chronologically after merging worker updates
      timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      return successResponse({
        incident: {
          incidentCode: incident.incident_code,
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          status: incident.status,
          department: incident.department_name,
          category: incident.category,
          latitude: incident.latitude,
          longitude: incident.longitude,
          createdAt: incident.created_at,
          updatedAt: incident.updated_at,
        },
        images: {
          citizen: citizenImages,
          authority: latestAuthorityImages,
        },
        timeline,
        source: 'postgres',
      });
    }

    // Fallback: Mongo Issue detail (when READ_FROM_POSTGRES is off)
    await connectDB();
    const isObjectId = /^[a-fA-F0-9]{24}$/.test(incidentCode);
    const doc = isObjectId
      ? await Issue.findById(incidentCode).lean()
      : await Issue.findOne({ incidentCode }).lean();

    if (!doc) return errorResponse('Not found', 404);

    const d = doc as unknown as Record<string, unknown>;
    console.log('[Works Detail] Mongo doc fields:', { citizenImageUrl: d.citizenImageUrl, citizenImageUrls: d.citizenImageUrls, _id: d._id, incidentCode: d.incidentCode });
    const citizenImageUrls = Array.isArray(d.citizenImageUrls)
      ? (d.citizenImageUrls as unknown[]).map((v) => String(v)).filter(Boolean)
      : [];
    const citizenImageUrl = typeof d.citizenImageUrl === 'string' ? d.citizenImageUrl : null;
    const citizenImages = citizenImageUrls.length ? citizenImageUrls : (citizenImageUrl ? [citizenImageUrl] : []);
    console.log('[Works Detail] Resolved citizenImages:', citizenImages);
    const createdAt = d.createdAt ? new Date(String(d.createdAt)).toISOString() : new Date().toISOString();
    const updatedAt = d.updatedAt ? new Date(String(d.updatedAt)).toISOString() : createdAt;

    const timeline: TimelineItem[] = [
      {
        type: 'REPORTED',
        at: createdAt,
        title: 'Reported',
        remark: 'Citizen reported the issue',
        citizenImages,
        authorityImages: [],
      },
    ];

    // Fetch approved worker updates for this incident
    const mongoCode = typeof d.incidentCode === 'string' && d.incidentCode.trim()
      ? d.incidentCode
      : incidentCode;
    const workerUpdatesMongo = await WorkerUpdate.find({
      incidentId: mongoCode,
      status: 'approved',
      publishedToTransparency: true,
    })
      .sort({ date: 1 })
      .lean();

    for (const wu of workerUpdatesMongo) {
      const wuDate = wu.submittedAt ?? wu.date;
      timeline.push({
        type: 'WORKER_UPDATE',
        at: new Date(wuDate).toISOString(),
        title: 'Worker Update',
        remark: wu.description ?? null,
        citizenImages: [],
        authorityImages: Array.isArray(wu.images) ? wu.images : [],
        workerName: wu.workerName ?? undefined,
      });
    }

    // Sort chronologically
    timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const latestWorkerImages = [...workerUpdatesMongo]
      .reverse()
      .flatMap((wu) => (Array.isArray(wu.images) ? wu.images : []))
      .slice(0, 4);

    return successResponse({
      incident: {
        incidentCode,
        title: typeof d.title === 'string' ? d.title : '',
        description: typeof d.description === 'string' ? d.description : '',
        severity: typeof d.severityLevel === 'string' ? d.severityLevel : null,
        status: typeof d.status === 'string' ? d.status : null,
        department: typeof d.department === 'string' ? d.department : null,
        category: typeof d.category === 'string' ? d.category : null,
        latitude: null,
        longitude: null,
        createdAt,
        updatedAt,
      },
      images: {
        citizen: citizenImages,
        authority: latestWorkerImages,
      },
      timeline,
      source: 'mongo',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

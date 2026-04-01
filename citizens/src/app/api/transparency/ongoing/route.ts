import { handleApiError, successResponse } from '@/lib/utils/response';
import { pgReadOrNull } from '@/lib/server/readSwitch';
import { withPgClient } from '@/lib/postgres';
import { connectDB } from '@/lib/db';
import Issue from '@/lib/models/Issue';
import WorkerUpdate from '@/lib/models/WorkerUpdate';

type IncidentRow = {
  incident_code: string;
  title: string | null;
  description: string | null;
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

function normalizeStatus(status: string | null): string {
  if (!status) return 'UNKNOWN';
  return String(status).toUpperCase();
}

function asFirstString(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first != null) {
      const s = String(first).trim();
      return s ? s : null;
    }
    return null;
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

export async function GET() {
  try {
    const rows = await pgReadOrNull(async () => {
      return withPgClient(async (client) => {
        const res = await client.query(
          `SELECT
             incident_code,
             title,
             description,
             severity,
             status,
             department_name,
             category,
             latitude,
             longitude,
             metadata,
             created_at,
             updated_at
           FROM incidents
           WHERE UPPER(COALESCE(status,'')) NOT IN ('RESOLVED','REJECTED')
           ORDER BY updated_at DESC
           LIMIT 200`,
        );
        return res.rows as IncidentRow[];
      });
    });

    if (rows) {
      // Fetch approved worker update counts from shared MongoDB
      await connectDB();
      const incidentCodes = rows.map((r) => String(r.incident_code));
      const workerUpdateAgg = await WorkerUpdate.aggregate([
        { $match: { incidentId: { $in: incidentCodes }, status: 'approved', publishedToTransparency: true } },
        { $group: { _id: '$incidentId', count: { $sum: 1 }, lastUpdate: { $max: '$submittedAt' } } },
      ]);
      const updateMap = new Map(workerUpdateAgg.map((u: { _id: string; count: number; lastUpdate: Date }) => [u._id, u]));

      const works = rows.map((r) => {
        const metadata = r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : null;
        const reportCount = metadata && typeof metadata.reportCount === 'number' ? metadata.reportCount : null;
        const previewImage = metadata ? asFirstString(metadata.citizenImages ?? metadata.images) : null;
        const wuInfo = updateMap.get(String(r.incident_code));

        return {
          incidentCode: String(r.incident_code),
          title: r.title ?? '',
          department: r.department_name ?? 'General',
          category: r.category ?? null,
          severity: r.severity ?? null,
          status: normalizeStatus(r.status),
          latitude: typeof r.latitude === 'number' ? r.latitude : null,
          longitude: typeof r.longitude === 'number' ? r.longitude : null,
          reportCount,
          previewImage,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          workerUpdatesCount: wuInfo?.count ?? 0,
          lastWorkerUpdate: wuInfo?.lastUpdate ? new Date(wuInfo.lastUpdate).toISOString() : null,
        };
      });

      return successResponse({ works, source: 'postgres' });
    }

    // Fallback: Mongo Issues (when READ_FROM_POSTGRES is off)
    await connectDB();
    const docs = (await Issue.find({ status: { $nin: ['resolved', 'rejected'] } })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean()) as unknown as Array<Record<string, unknown>>;

    // Collect all incident codes to batch-fetch worker update counts
    const mongoCodes = docs.map((d) =>
      typeof d.incidentCode === 'string' && d.incidentCode.trim() ? d.incidentCode : String(d._id),
    );
    const wuAggMongo = await WorkerUpdate.aggregate([
      { $match: { incidentId: { $in: mongoCodes }, status: 'approved', publishedToTransparency: true } },
      { $group: { _id: '$incidentId', count: { $sum: 1 }, lastUpdate: { $max: '$submittedAt' } } },
    ]);
    const wuMapMongo = new Map(wuAggMongo.map((u: { _id: string; count: number; lastUpdate: Date }) => [u._id, u]));

    const works = docs.map((d) => {
      const incidentCode = typeof d.incidentCode === 'string' && d.incidentCode.trim()
        ? d.incidentCode
        : String(d._id);

      const location = d.location && typeof d.location === 'object' ? (d.location as Record<string, unknown>) : null;
      const lat = location && typeof location.lat === 'number' ? location.lat : null;
      const lng = location && typeof location.lng === 'number' ? location.lng : null;
      const wuInfo = wuMapMongo.get(incidentCode);

      return {
        incidentCode,
        title: typeof d.title === 'string' ? d.title : '',
        department: typeof d.department === 'string' ? d.department : 'General',
        category: typeof d.category === 'string' ? d.category : null,
        severity: typeof d.severityLevel === 'string' ? d.severityLevel : null,
        status: normalizeStatus(typeof d.status === 'string' ? d.status : null),
        latitude: lat,
        longitude: lng,
        reportCount: typeof d.reportCount === 'number' ? d.reportCount : null,
        previewImage:
          Array.isArray(d.citizenImageUrls) && d.citizenImageUrls.length
            ? String(d.citizenImageUrls[0] ?? '').trim() || null
            : (typeof d.citizenImageUrl === 'string' && d.citizenImageUrl.trim() ? d.citizenImageUrl.trim() : null),
        createdAt: d.createdAt ? String(d.createdAt) : '',
        updatedAt: d.updatedAt ? String(d.updatedAt) : '',
        workerUpdatesCount: wuInfo?.count ?? 0,
        lastWorkerUpdate: wuInfo?.lastUpdate ? new Date(wuInfo.lastUpdate).toISOString() : null,
      };
    });

    return successResponse({ works, source: 'mongo' });
  } catch (error) {
    return handleApiError(error);
  }
}

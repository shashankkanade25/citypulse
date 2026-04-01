import { handleApiError, successResponse } from '@/lib/utils/response';
import { pgReadOrNull } from '@/lib/server/readSwitch';
import { withPgClient } from '@/lib/postgres';
import { connectDB } from '@/lib/db';
import Issue from '@/lib/models/Issue';

type IncidentRow = {
  incident_code: string;
  title: string | null;
  severity: string | null;
  status: string | null;
  department_name: string | null;
  category: string | null;
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
             severity,
             status,
             department_name,
             category,
             metadata,
             created_at,
             updated_at
           FROM incidents
           ORDER BY created_at DESC
           LIMIT 200`,
        );
        return res.rows as IncidentRow[];
      });
    });

    if (rows) {
      const issues = rows.map((r) => {
        const metadata = r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : null;
        const reportCount = metadata && typeof metadata.reportCount === 'number' ? metadata.reportCount : null;
        const previewImage = metadata ? asFirstString(metadata.citizenImages ?? metadata.images) : null;

        return {
          incidentCode: String(r.incident_code),
          title: r.title ?? '',
          department: r.department_name ?? 'General',
          category: r.category ?? null,
          severity: r.severity ?? null,
          status: normalizeStatus(r.status),
          reportCount,
          previewImage,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });

      return successResponse({ issues, source: 'postgres' });
    }

    // Fallback: Mongo Issues (when READ_FROM_POSTGRES is off)
    await connectDB();
    const docs = (await Issue.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()) as unknown as Array<Record<string, unknown>>;

    const issues = docs.map((d) => {
      const incidentCode = typeof d.incidentCode === 'string' && d.incidentCode.trim()
        ? d.incidentCode
        : String(d._id);

      return {
        incidentCode,
        title: typeof d.title === 'string' ? d.title : '',
        department: typeof d.department === 'string' ? d.department : 'General',
        category: typeof d.category === 'string' ? d.category : null,
        severity: typeof d.severityLevel === 'string' ? d.severityLevel : null,
        status: normalizeStatus(typeof d.status === 'string' ? d.status : null),
        reportCount: typeof d.reportCount === 'number' ? d.reportCount : null,
        previewImage:
          Array.isArray(d.citizenImageUrls) && d.citizenImageUrls.length
            ? String(d.citizenImageUrls[0] ?? '').trim() || null
            : (typeof d.citizenImageUrl === 'string' && d.citizenImageUrl.trim() ? d.citizenImageUrl.trim() : null),
        createdAt: d.createdAt ? String(d.createdAt) : '',
        updatedAt: d.updatedAt ? String(d.updatedAt) : '',
      };
    });

    return successResponse({ issues, source: 'mongo' });
  } catch (error) {
    return handleApiError(error);
  }
}

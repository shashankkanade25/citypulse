import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import Issue from '@/lib/models/Issue';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPaginationParams,
  handleApiError,
} from '@/lib/utils/response';
import { getCurrentUser } from '@/lib/auth';
import { dualWritePostgresFirst } from '@/lib/server/dualWrite';
import { publishEvent, TOPICS } from '@/lib/kafka';
import { buildDedupeKey, jaccardSimilarity } from '@/lib/utils/dedupe';

type DedupeCandidate = {
  _id: unknown;
  dedupeText?: string | null;
  dedupeKey?: string | null;
  status?: string | null;
};
import { sendMail } from '@/lib/email';
import { complaintFiledTemplate } from '@/lib/emailTemplates';

function toDepartmentCode(name: string): string {
  const cleaned = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 32) || 'GENERAL';
}

/**
 * GET /api/issues - Get all issues with pagination
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse('Unauthorized', 401);

    const searchParams = req.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);

    // Get filter parameters
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    await connectDB();

    // Build query
    const query: Record<string, unknown> = {
      $or: [{ reportedBy: user.userId }, { reporterUserIds: user.userId }],
    };
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    // Get total count and paginated data
    const [total, issues] = await Promise.all([
      Issue.countDocuments(query),
      Issue.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return paginatedResponse(issues, page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/issues - Create a new issue
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse('Unauthorized', 401);

    await connectDB();

    const body = await req.json();

    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || 'other').trim();
    const priority = String(body.priority || 'medium').trim();
    const citizenImageUrl = body.citizenImageUrl ? String(body.citizenImageUrl).trim() : (body.imageUrl ? String(body.imageUrl).trim() : null);
    console.log('[Issue] Image fields received:', { bodyImageUrl: body.imageUrl, bodyCitizenImageUrl: body.citizenImageUrl, resolved: citizenImageUrl });

    if (!title || !description || !category) {
      return errorResponse('Missing required fields (title, description, category)', 400);
    }

    const locationObj = body.location && typeof body.location === 'object' ? (body.location as Record<string, unknown>) : null;
    const locationAddress = String((locationObj?.address as unknown) ?? body.location ?? '').trim();
    const latRaw = (locationObj?.lat as unknown) ?? (locationObj?.latitude as unknown);
    const lngRaw = (locationObj?.lng as unknown) ?? (locationObj?.longitude as unknown);
    const locationLat = typeof latRaw === 'number' ? latRaw : null;
    const locationLng = typeof lngRaw === 'number' ? lngRaw : null;

    const canDedupe = typeof locationLat === 'number' && typeof locationLng === 'number';
    const dedupe = canDedupe
      ? buildDedupeKey({ lat: locationLat, lng: locationLng, title, description })
      : null;

    // Find a recent matching issue to group into (Mongo is the source of truth for UI right now)
    let matchedIssue: DedupeCandidate | null = null;
    if (dedupe) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const candidates = await Issue.find({
        dedupeGeoCell: dedupe.geo,
        status: { $nin: ['resolved', 'rejected'] },
        createdAt: { $gte: cutoff },
      })
        .select('dedupeText dedupeKey status')
        .sort({ updatedAt: -1 })
        .limit(25)
        .lean();

      const typedCandidates = candidates as unknown as DedupeCandidate[];
      let best: { issue: DedupeCandidate; score: number } | null = null;
      for (const c of typedCandidates) {
        const score = jaccardSimilarity(dedupe.text, String(c.dedupeText || ''));
        if (!best || score > best.score) best = { issue: c, score };
      }

      if (best && best.score >= 0.85) {
        matchedIssue = best.issue;
      }
    }

    const incidentCode = matchedIssue ? null : 'citizen_' + Date.now();

    const issue = await dualWritePostgresFirst({
      pg: async (client) => {
        const departmentName = String(body.department || 'General').trim();
        const departmentCode = toDepartmentCode(departmentName);
        const category = String(body.category || 'other').trim().toUpperCase();

        // Upsert department
        const dep = await client.query(
          `INSERT INTO departments(name, code, category, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (code)
           DO UPDATE SET name = EXCLUDED.name, updated_at = now()
           RETURNING id`,
          [departmentName, departmentCode, ['POWER','WATER','ROAD'].includes(category) ? category : null]
        );
        const departmentId = dep.rows[0]?.id;

        // If we matched an existing issue, avoid creating another incident in PG.
        if (dedupe) {
          const existing = await client.query(
            `SELECT incident_code
             FROM incidents
             WHERE (metadata->>'dedupeKey') = $1
               AND status NOT IN ('RESOLVED','resolved','rejected','REJECTED')
               AND created_at >= (now() - interval '7 days')
             ORDER BY updated_at DESC
             LIMIT 1`,
            [dedupe.key],
          );

          const existingCode = existing.rows[0]?.incident_code as string | undefined;
          if (existingCode) {
            const reporter = {
              userId: user.userId,
              email: user.email,
              name: user.name,
              ts: new Date().toISOString(),
            };

            if (citizenImageUrl) {
              await client.query(
                `UPDATE incidents
                 SET metadata = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       COALESCE(metadata, '{}'::jsonb),
                       '{reportCount}',
                       to_jsonb(COALESCE(NULLIF((metadata->>'reportCount')::int, NULL), 1) + 1),
                       true
                     ),
                     '{reporters}',
                     (COALESCE(metadata->'reporters','[]'::jsonb) || $2::jsonb),
                     true
                   ),
                   '{citizenImages}',
                   (COALESCE(metadata->'citizenImages','[]'::jsonb) || $3::jsonb),
                   true
                 ),
                 updated_at = now()
                 WHERE incident_code = $1`,
                [existingCode, JSON.stringify([reporter]), JSON.stringify([citizenImageUrl])],
              );
            } else {
              await client.query(
                `UPDATE incidents
                 SET metadata = jsonb_set(
                   jsonb_set(
                     COALESCE(metadata, '{}'::jsonb),
                     '{reportCount}',
                     to_jsonb(COALESCE(NULLIF((metadata->>'reportCount')::int, NULL), 1) + 1),
                     true
                   ),
                   '{reporters}',
                   (COALESCE(metadata->'reporters','[]'::jsonb) || $2::jsonb),
                   true
                 ),
                 updated_at = now()
                 WHERE incident_code = $1`,
                [existingCode, JSON.stringify([reporter])],
              );
            }
            return;
          }
        }

        // New canonical incident
        const reporter = {
          userId: user.userId,
          email: user.email,
          name: user.name,
          ts: new Date().toISOString(),
        };

        await client.query(
          `INSERT INTO incidents(
            incident_code, title, description, severity, status,
            department_id, zone, department_name, category,
            confidence_score, citizen_external_id,
            latitude, longitude, metadata, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now()
          )
          ON CONFLICT (incident_code) DO NOTHING`,
          [
            incidentCode,
            title,
            description,
            body.severityLevel || 'MEDIUM',
            'OPEN',
            departmentId,
            'UNKNOWN',
            departmentName,
            ['POWER','WATER','ROAD'].includes(category) ? category : null,
            typeof body.aiConfidence === 'number' ? body.aiConfidence : null,
            user.userId,
            locationLat,
            locationLng,
            JSON.stringify({
              source: 'citizens-live',
              dedupeKey: dedupe?.key ?? null,
              dedupeGeoCell: dedupe?.geo ?? null,
              dedupeTextHash: dedupe?.textHash ?? null,
              reportCount: 1,
              reporters: [reporter],
              citizenImages: citizenImageUrl ? [citizenImageUrl] : [],
            }),
          ]
        );
      },
      primary: async () => {
        if (matchedIssue) {
          const now = new Date();

          const update: {
            $addToSet: Record<string, unknown>;
            $inc: { reportCount: number };
            $set: Record<string, unknown>;
          } = {
            $addToSet: { reporterUserIds: user.userId },
            $inc: { reportCount: 1 },
            $set: { lastReportedAt: now },
          };

          if (citizenImageUrl) {
            update.$set.citizenImageUrl = citizenImageUrl;
            update.$addToSet.citizenImageUrls = citizenImageUrl;
          }

          const updated = await Issue.findByIdAndUpdate(
            String(matchedIssue._id),
            update,
            { new: true },
          );

          return updated;
        }

        console.log('[Issue] Creating new Mongo doc with citizenImageUrl:', citizenImageUrl);
        return await Issue.create({
          title,
          description,
          category,
          priority,
          status: body.status || 'pending',
          severityLevel: body.severityLevel || 'MEDIUM',
          department: body.department || 'General',
          aiConfidence: typeof body.aiConfidence === 'number' ? body.aiConfidence : 0,
          location: locationAddress ? { address: locationAddress, lat: locationLat, lng: locationLng } : undefined,
          reportedBy: user.userId,
          reporterEmail: user.email,
          reporterName: user.name,
          reporterRole: user.role,

          incidentCode,
          citizenImageUrl,
          citizenImageUrls: citizenImageUrl ? [citizenImageUrl] : [],

          dedupeKey: dedupe?.key ?? null,
          dedupeGeoCell: dedupe?.geo ?? null,
          dedupeText: dedupe?.text ?? null,
          dedupeTextHash: dedupe?.textHash ?? null,
          reporterUserIds: [user.userId],
          reportCount: 1,
          lastReportedAt: new Date(),
        });
      },
    });

    // Send confirmation email (awaited so logs appear before function exits)
    if (user.email) {
      console.log(`[Issue] Attempting to send confirmation email to ${user.email}`);
      const emailContent = complaintFiledTemplate({
        name: user.name || "Citizen",
        title,
        category,
        description: description.length > 200 ? description.slice(0, 200) + "..." : description,
        department: String(body.department || "General"),
        priority,
        date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        imageUrl: body.imageUrl || undefined,
      });
      await sendMail({ to: user.email, ...emailContent });
      console.log(`[Issue] Email send attempt completed for ${user.email}`);
    } else {
      console.log(`[Issue] No email on user — skipping confirmation email. user:`, JSON.stringify({ userId: user.userId, email: user.email, name: user.name }));
    }

    // Only publish "created" for new canonical issues.
    if (incidentCode) {
      publishEvent(TOPICS.ISSUE_CREATED, incidentCode, {
        reportedBy: user.userId,
        reporterEmail: user.email,
        reporterName: user.name,
        reporterRole: user.role,
        title,
        description,
        category,
        priority,
        status: body.status || 'pending',
        severityLevel: body.severityLevel || 'MEDIUM',
        department: body.department || 'General',
        aiConfidence: typeof body.aiConfidence === 'number' ? body.aiConfidence : 0,
        location: locationAddress ? { address: locationAddress, lat: locationLat, lng: locationLng } : undefined,
        dedupeKey: dedupe?.key ?? null,
      });
    }

    return successResponse(
      issue,
      matchedIssue ? 'Issue grouped with an existing report' : 'Issue created successfully',
    );
  } catch (error) {
    return handleApiError(error);
  }
}

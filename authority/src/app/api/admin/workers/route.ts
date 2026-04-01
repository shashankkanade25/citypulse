import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/database/models/user.model';
import IncidentStatusHistory from '@/lib/database/models/incident-status-history.model';
import Incident from '@/lib/database/models/incident.model';
import { pgReadOrNull } from '@/lib/server/readSwitch';
import { cacheGet, cacheKey, CACHE_TTLS } from '@/lib/admin/cache';

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can access this endpoint
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const ck = cacheKey('workers');
    const data = await cacheGet(ck, CACHE_TTLS.workers, async () => {
    /* ---- Postgres read path ---- */
    const pgResult = await pgReadOrNull(async (client) => {
      // Fetch workers with department info
      const { rows: workers } = await client.query(
        `SELECT
           u.id, u.external_id, u.name, u.email, u.username, u.phone,
           u.role, u.is_active AS active, u.photo, u.zone,
           d.id AS "departmentId_id", d.name AS "departmentId_name", d.category AS "departmentId_category",
           u.created_at AS "createdAt", u.updated_at AS "updatedAt"
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.role = 'WORKER'
         ORDER BY u.name ASC`,
      );

      // For each worker, compute stats using a single aggregated query
      const workerIds = workers.map((w: any) => w.id);
      if (workerIds.length === 0) return [];

      // Get per-worker stats in one shot: incidents they changed status on
      const { rows: statsRows } = await client.query(
        `WITH worker_incidents AS (
           SELECT DISTINCT ON (h.incident_id, h.changed_by_user_id)
             h.changed_by_user_id AS worker_id,
             h.incident_id,
             -- latest status for this incident (regardless of who changed it)
             (SELECT ish.to_status FROM incident_status_history ish
              WHERE ish.incident_id = h.incident_id
              ORDER BY ish.created_at DESC LIMIT 1) AS latest_status
           FROM incident_status_history h
           WHERE h.changed_by_user_id = ANY($1::uuid[])
         ),
         worker_resolved_times AS (
           SELECT
             h.changed_by_user_id AS worker_id,
             h.incident_id,
             EXTRACT(EPOCH FROM (
               (SELECT MAX(ish.created_at) FROM incident_status_history ish
                WHERE ish.incident_id = h.incident_id AND ish.to_status = 'RESOLVED')
               - i.created_at
             )) / 3600 AS resolution_hours
           FROM incident_status_history h
           JOIN incidents i ON i.id = h.incident_id
           WHERE h.changed_by_user_id = ANY($1::uuid[])
             AND (SELECT ish2.to_status FROM incident_status_history ish2
                  WHERE ish2.incident_id = h.incident_id
                  ORDER BY ish2.created_at DESC LIMIT 1) = 'RESOLVED'
           GROUP BY h.changed_by_user_id, h.incident_id, i.created_at
         )
         SELECT
           wi.worker_id,
           count(DISTINCT wi.incident_id)::int AS "totalAssigned",
           count(DISTINCT wi.incident_id) FILTER (WHERE wi.latest_status = 'OPEN')::int AS open,
           count(DISTINCT wi.incident_id) FILTER (WHERE wi.latest_status = 'IN_PROGRESS')::int AS "inProgress",
           count(DISTINCT wi.incident_id) FILTER (WHERE wi.latest_status = 'ON_HOLD')::int AS "onHold",
           count(DISTINCT wi.incident_id) FILTER (WHERE wi.latest_status = 'RESOLVED')::int AS resolved,
           COALESCE(
             (SELECT avg(wrt.resolution_hours) FROM worker_resolved_times wrt WHERE wrt.worker_id = wi.worker_id),
             0
           ) AS "avgResolutionTime"
         FROM worker_incidents wi
         GROUP BY wi.worker_id`,
        [workerIds],
      );

      const statsMap = new Map(statsRows.map((s: any) => [s.worker_id, s]));

      // Recent activity per worker (last 5 status changes)
      const { rows: activityRows } = await client.query(
        `SELECT
           h.changed_by_user_id AS worker_id,
           h.incident_id AS "incidentId",
           h.to_status AS status,
           h.created_at AS "updatedAt",
           i.description
         FROM incident_status_history h
         JOIN incidents i ON i.id = h.incident_id
         WHERE h.changed_by_user_id = ANY($1::uuid[])
         ORDER BY h.created_at DESC`,
        [workerIds],
      );

      // Group activity by worker, keep first 5
      const activityMap = new Map<string, any[]>();
      for (const a of activityRows) {
        const list = activityMap.get(a.worker_id) || [];
        if (list.length < 5) {
          list.push({
            incidentId: a.incidentId,
            status: a.status,
            updatedAt: a.updatedAt,
            description: a.description || 'No description',
          });
          activityMap.set(a.worker_id, list);
        }
      }

      return workers.map((w: any) => {
        const s = statsMap.get(w.id) || {
          totalAssigned: 0, open: 0, inProgress: 0, onHold: 0, resolved: 0, avgResolutionTime: 0,
        };
        return {
          _id: w.id,
          name: w.name,
          email: w.email,
          username: w.username,
          phone: w.phone,
          role: w.role,
          active: w.active,
          photo: w.photo,
          zone: w.zone,
          departmentId: w.departmentId_id
            ? { _id: w.departmentId_id, name: w.departmentId_name, category: w.departmentId_category }
            : null,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          stats: {
            totalAssigned: s.totalAssigned,
            open: s.open,
            inProgress: s.inProgress,
            onHold: s.onHold,
            resolved: s.resolved,
            avgResolutionTime: Number(s.avgResolutionTime) || 0,
          },
          recentActivity: activityMap.get(w.id) || [],
        };
      });
    });

    if (pgResult) {
      return { success: true, workers: pgResult };
    }

    /* ---- Mongo fallback ---- */
    await connectDB();

    // Fetch all workers
    const workers = await User.find({ role: 'WORKER' })
      .select('-password')
      .populate('departmentId', 'name category')
      .sort({ name: 1 })
      .lean();

    // For each worker, fetch their incident statistics
    const workersWithStats = await Promise.all(
      workers.map(async (worker) => {
        // Get all status history entries where this worker made changes
        const statusHistories = await IncidentStatusHistory.find({
          changedBy: worker._id,
        })
          .populate({
            path: 'incidentId',
            select: 'description category severity createdAt',
          })
          .sort({ createdAt: -1 })
          .lean();

        // Get unique incident IDs
        const incidentIds = [...new Set(statusHistories.map(h => h.incidentId?._id?.toString()).filter(Boolean))];

        // Count incidents by status (get latest status for each incident)
        const incidentStatuses: { [key: string]: string } = {};
        for (const incidentId of incidentIds) {
          const latestStatus = await IncidentStatusHistory.findOne({
            incidentId,
          })
            .sort({ createdAt: -1 })
            .lean();

          if (latestStatus) {
            incidentStatuses[incidentId] = latestStatus.status;
          }
        }

        const stats = {
          totalAssigned: incidentIds.length,
          open: Object.values(incidentStatuses).filter(s => s === 'OPEN').length,
          inProgress: Object.values(incidentStatuses).filter(s => s === 'IN_PROGRESS').length,
          onHold: Object.values(incidentStatuses).filter(s => s === 'ON_HOLD').length,
          resolved: Object.values(incidentStatuses).filter(s => s === 'RESOLVED').length,
          avgResolutionTime: 0,
        };

        // Calculate average resolution time for resolved incidents
        if (stats.resolved > 0) {
          let totalResolutionTime = 0;
          let resolvedCount = 0;

          for (const incidentId of incidentIds) {
            if (incidentStatuses[incidentId] === 'RESOLVED') {
              const incident = await Incident.findById(incidentId).lean();
              const resolvedStatus = await IncidentStatusHistory.findOne({
                incidentId,
                status: 'RESOLVED',
              })
                .sort({ createdAt: -1 })
                .lean();

              if (incident && resolvedStatus) {
                const resolutionTime = 
                  (new Date(resolvedStatus.createdAt).getTime() - new Date(incident.createdAt).getTime()) / 
                  (1000 * 60 * 60); // Convert to hours
                totalResolutionTime += resolutionTime;
                resolvedCount++;
              }
            }
          }

          stats.avgResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;
        }

        // Get recent activity (last 5 status changes)
        const recentActivity = statusHistories
          .slice(0, 5)
          .filter(h => h.incidentId)
          .map(h => ({
            incidentId: h.incidentId._id.toString(),
            status: h.status,
            updatedAt: h.createdAt,
            description: (h.incidentId as any).description || 'No description',
          }));

        return {
          ...worker,
          stats,
          recentActivity,
        };
      })
    );

    return {
      success: true,
      workers: workersWithStats,
    };
    }); // end cacheGet

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching workers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch workers' },
      { status: 500 }
    );
  }
}

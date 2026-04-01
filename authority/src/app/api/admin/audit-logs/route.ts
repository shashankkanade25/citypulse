import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import AuditLog from '@/lib/database/models/audit-log.model';
// Ensure referenced model is registered before populate
import User from '@/lib/database/models/user.model';
import { pgReadOrNull } from '@/lib/server/readSwitch';
import { cacheGet, cacheKey, CACHE_TTLS } from '@/lib/admin/cache';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam) || 200, 1), 500);

    // Optional query params (kept minimal): action, tableName
    const action = searchParams.get('action');
    const tableName = searchParams.get('tableName');

    const ck = cacheKey('audit-logs', `a=${action ?? ''}&t=${tableName ?? ''}&l=${limit}`);
    const data = await cacheGet(ck, CACHE_TTLS['audit-logs'], async () => {
    /* ---- Postgres read path ---- */
    const pgResult = await pgReadOrNull(async (client) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (action) {
        conditions.push(`al.action = $${idx++}`);
        params.push(action);
      }
      if (tableName) {
        conditions.push(`al.table_name = $${idx++}`);
        params.push(tableName);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const { rows } = await client.query(
        `SELECT
           al.id AS "_id",
           al.action, al.table_name AS "tableName",
           al.record_id AS "recordId",
           al.old_value AS "oldValue", al.new_value AS "newValue",
           al.ip_address AS "ipAddress", al.user_agent AS "userAgent",
           al.created_at AS "createdAt",
           -- joined user
           u.id   AS "userId__id",
           u.name AS "userId_name",
           u.email AS "userId_email",
           u.username AS "userId_username",
           u.role AS "userId_role"
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT $${idx}`,
        [...params, limit],
      );

      return rows.map((r: any) => ({
        _id: r._id,
        action: r.action,
        tableName: r.tableName,
        recordId: r.recordId,
        oldValue: r.oldValue,
        newValue: r.newValue,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        userId: r.userId__id
          ? { _id: r.userId__id, name: r.userId_name, email: r.userId_email, username: r.userId_username, role: r.userId_role }
          : null,
      }));
    });

    if (pgResult) {
      return { success: true, logs: pgResult };
    }

    /* ---- Mongo fallback ---- */
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (tableName) filter.tableName = tableName;

    // Touch the import so it isn't tree-shaken away in some builds
    void User;

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name email username role')
      .lean();

    return { success: true, logs };
    }); // end cacheGet

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

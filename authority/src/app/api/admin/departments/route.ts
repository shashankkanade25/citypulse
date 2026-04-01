import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Department from '@/lib/database/models/department.model';
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

    const ck = cacheKey('departments');
    const data = await cacheGet(ck, CACHE_TTLS.departments, async () => {
    /* ---- Postgres read path ---- */
    const pgResult = await pgReadOrNull(async (client) => {
      const { rows: depts } = await client.query(
        `SELECT
           d.id AS "_id", d.name, d.code, d.category,
           d.head_id,
           d.created_at AS "createdAt", d.updated_at AS "updatedAt",
           -- head info
           hu.id   AS "head__id",
           hu.name AS "head_name",
           hu.email AS "head_email",
           hu.username AS "head_username",
           hu.role AS "head_role"
         FROM departments d
         LEFT JOIN users hu ON hu.id = d.head_id
         ORDER BY d.created_at DESC`,
      );

      // Fetch workers per department via join table
      const deptIds = depts.map((d: any) => d._id);
      const workerMap = new Map<string, any[]>();

      if (deptIds.length > 0) {
        const { rows: workerRows } = await client.query(
          `SELECT
             dw.department_id,
             u.id AS "_id", u.name, u.email, u.username, u.role
           FROM department_workers dw
           JOIN users u ON u.id = dw.worker_user_id
           WHERE dw.department_id = ANY($1::uuid[])
           ORDER BY u.name ASC`,
          [deptIds],
        );
        for (const w of workerRows) {
          const list = workerMap.get(w.department_id) || [];
          list.push({ _id: w._id, name: w.name, email: w.email, username: w.username, role: w.role });
          workerMap.set(w.department_id, list);
        }
      }

      return depts.map((d: any) => ({
        _id: d._id,
        name: d.name,
        code: d.code,
        category: d.category,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        headId: d.head__id
          ? { _id: d.head__id, name: d.head_name, email: d.head_email, username: d.head_username, role: d.head_role }
          : null,
        workers: workerMap.get(d._id) || [],
      }));
    });

    if (pgResult) {
      return { success: true, departments: pgResult };
    }

    /* ---- Mongo fallback ---- */
    await connectDB();

    // Fetch all departments with populated head and workers
    const departments = await Department.find({})
      .populate('headId', 'name email username role')
      .populate('workers', 'name email username role')
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      departments,
    };
    }); // end cacheGet

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

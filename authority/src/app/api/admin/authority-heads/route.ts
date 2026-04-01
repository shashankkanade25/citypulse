import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import User from "@/lib/database/models/user.model";
import Department from "@/lib/database/models/department.model";
import { dualWritePostgresFirst } from "@/lib/server/dualWrite";
import { pgReadOrNull } from "@/lib/server/readSwitch";
import { publishEvent, TOPICS } from "@/lib/kafka";
import { writeAuditEvent } from "@/lib/server/adminAudit";
import { cacheGet, cacheKey, CACHE_TTLS, invalidateDomain } from "@/lib/admin/cache";

type HeadRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  isActive: boolean;
  department: { id: string; name: string; category?: string | null } | null;
  createdAt?: string;
};

function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeUsername(username: unknown): string {
  return String(username ?? "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (current.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ck = cacheKey("authority-heads");
  const data = await cacheGet(ck, CACHE_TTLS["authority-heads"], async () => {
  /* ---- Postgres read path ---- */
  const pgResult = await pgReadOrNull(async (client) => {
    const { rows } = await client.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.username,
         u.phone,
         u.is_active AS "isActive",
         u.created_at AS "createdAt",
         d.id AS "department_id",
         d.name AS "department_name",
         d.category AS "department_category"
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.role = 'AUTHORITY_HEAD'
       ORDER BY u.created_at DESC
       LIMIT 500`,
    );

    return rows.map((r: any) => {
      const dept = r.department_id
        ? { id: r.department_id, name: r.department_name, category: r.department_category ?? null }
        : null;
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        username: r.username,
        phone: r.phone ?? null,
        isActive: Boolean(r.isActive),
        department: dept,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
      } satisfies HeadRow;
    });
  });

  if (pgResult) {
    return { success: true, heads: pgResult };
  }

  /* ---- Mongo fallback ---- */
  await connectDB();
  const heads = await User.find({ role: "AUTHORITY_HEAD" })
    .select("name email username phone role isActive departmentId createdAt")
    .populate("departmentId", "name category")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  return {
    success: true,
    heads: heads.map((h: any) => ({
      id: h._id.toString(),
      name: h.name,
      email: h.email,
      username: h.username,
      phone: h.phone ?? null,
      isActive: Boolean(h.isActive),
      createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : undefined,
      department: h.departmentId
        ? {
            id: h.departmentId?._id?.toString?.() ?? "",
            name: h.departmentId?.name ?? "",
            category: h.departmentId?.category ?? null,
          }
        : null,
    })) satisfies HeadRow[],
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (current.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | {
        name?: string;
        email?: string;
        username?: string;
        password?: string;
        phone?: string;
        departmentId?: string | null;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const email = normalizeEmail(body.email);
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  const phone = body.phone ? String(body.phone).trim() : null;
  const departmentId = (body.departmentId ?? null) ? String(body.departmentId).trim() : null;

  if (!name || !email || !username || !password) {
    return NextResponse.json(
      { error: "name, email, username and password are required" },
      { status: 400 },
    );
  }

  if (username.length < 3 || username.length > 30) {
    return NextResponse.json({ error: "Username must be 3-30 characters" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  await connectDB();

  if (departmentId) {
    const exists = await Department.exists({ _id: departmentId });
    if (!exists) return NextResponse.json({ error: "Department not found" }, { status: 400 });
  }

  const existing = await User.findOne({ $or: [{ username }, { email }] }).select("_id username email").lean();
  if (existing) {
    const field = existing.username === username ? "Username" : "Email";
    return NextResponse.json({ error: `${field} already exists` }, { status: 400 });
  }

  const hashedPassword = await hashPassword(password);

  let createdPgId: string | null = null;

  const created: any = await dualWritePostgresFirst({
    pg: async (client) => {
      // Enforce uniqueness in PG as well
      const { rows: checkRows } = await client.query(
        `SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
        [username, email],
      );
      if (checkRows.length > 0) {
        throw new Error("Username or Email already exists");
      }

      if (departmentId) {
        const { rows: deptRows } = await client.query(`SELECT id FROM departments WHERE id = $1 LIMIT 1`, [departmentId]);
        if (deptRows.length === 0) throw new Error("Department not found");
      }

      const { rows } = await client.query(
        `INSERT INTO users (
           name, email, username, password_hash, phone,
           role, department_id,
           is_active, active,
           created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,
           'AUTHORITY_HEAD',$6,
           true,true,
           now(),now()
         )
         RETURNING id, name, email, username, is_active AS "isActive"`,
        [name, email, username, hashedPassword, phone, departmentId],
      );

      const row = rows[0];
      createdPgId = row.id;

      if (departmentId) {
        await client.query(
          `UPDATE departments SET head_id = $1, updated_at = now() WHERE id = $2`,
          [createdPgId, departmentId],
        );
      }
    },
    primary: async () => {
      const user = await User.create({
        name,
        email,
        username,
        password: hashedPassword,
        phone: phone ?? undefined,
        role: "AUTHORITY_HEAD",
        isActive: true,
        departmentId: departmentId ? (departmentId as any) : null,
      });

      if (departmentId) {
        await Department.updateOne({ _id: departmentId }, { $set: { headId: user._id } });
      }

      return user;
    },
  });

  const createdId = createdPgId ?? created?._id?.toString?.();
  if (!createdId) {
    return NextResponse.json({ error: "Failed to create authority head" }, { status: 500 });
  }

  await writeAuditEvent({
    type: "USER_UPDATED",
    entityType: "user",
    entityId: createdId,
    actor: current.email,
    remark: "Authority Head created",
    metadata: { role: "AUTHORITY_HEAD", email, username, departmentId: departmentId ?? null },
  });

  publishEvent(TOPICS.USER_CREATED, createdId, {
    userId: createdId,
    name,
    email,
    username,
    phone,
    role: "AUTHORITY_HEAD",
    isActive: true,
    departmentId: departmentId ?? null,
    passwordHash: hashedPassword,
  });

  // Invalidate cached authority-heads and users lists
  await invalidateDomain("authority-heads", "users", "departments");

  return NextResponse.json({
    success: true,
    head: {
      id: createdId,
      name,
      email,
      username,
      phone,
      role: "AUTHORITY_HEAD",
      isActive: true,
      departmentId: departmentId ?? null,
    },
  });
}

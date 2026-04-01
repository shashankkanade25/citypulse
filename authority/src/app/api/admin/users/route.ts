import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import User, { type UserRole } from "@/lib/database/models/user.model";
import Department from "@/lib/database/models/department.model";
import { writeAuditEvent } from "@/lib/server/adminAudit";
import { dualWritePostgresFirst } from "@/lib/server/dualWrite";
import { publishEvent, TOPICS } from "@/lib/kafka";
import { cacheGet, cacheKey, CACHE_TTLS, invalidateDomain } from "@/lib/admin/cache";

type Scope = "authority" | "citizens";

function parseScope(req: NextRequest): Scope {
  const scope = (req.nextUrl.searchParams.get("scope") ?? "authority").toLowerCase();
  return scope === "citizens" ? "citizens" : "authority";
}

export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (current.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = parseScope(req);
  const ck = cacheKey("users", scope);
  const data = await cacheGet(ck, CACHE_TTLS.users, async () => {
  await connectDB();
  const roleFilter: Record<string, unknown> =
    scope === "citizens"
      ? { role: "CITIZEN" }
      : { role: { $in: ["ADMIN", "AUTHORITY_HEAD", "WORKER"] } };

  const users = await User.find(roleFilter)
    .select("name email username role phone zone isActive departmentId createdAt")
    .populate("departmentId", "name category")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  return {
    users: users.map((u: any) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      phone: u.phone ?? null,
      zone: u.zone ?? null,
      isActive: Boolean(u.isActive),
      department: u.departmentId?.name ?? null,
      departmentId: u.departmentId?._id?.toString?.() ?? null,
      createdAt: u.createdAt,
    })),
  };
  }); // end cacheGet

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (current.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();

  const body = (await req.json()) as {
    userId?: string;
    patch?: { role?: UserRole; departmentId?: string | null; isActive?: boolean };
    remark?: string;
  };

  if (!body.userId || !body.patch) {
    return NextResponse.json({ error: "userId and patch are required" }, { status: 400 });
  }

  const user = await User.findById(body.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const before = {
    role: user.role,
    departmentId: user.departmentId?.toString?.() ?? null,
    isActive: user.isActive,
  };

  if (typeof body.patch.role !== "undefined") user.role = body.patch.role;
  if (typeof body.patch.isActive !== "undefined") user.isActive = body.patch.isActive;
  if (typeof body.patch.departmentId !== "undefined") {
    if (body.patch.departmentId === null || body.patch.departmentId === "") {
      user.departmentId = null;
    } else {
      const deptExists = await Department.exists({ _id: body.patch.departmentId });
      if (!deptExists) {
        return NextResponse.json({ error: "Department not found" }, { status: 400 });
      }
      user.departmentId = body.patch.departmentId as any;
    }
  }

  const department = user.departmentId ? await Department.findById(user.departmentId).select("name").lean() : null;
  const departmentName = department?.name ?? null;

  const after = {
    role: user.role,
    departmentId: user.departmentId?.toString?.() ?? null,
    department: departmentName,
    isActive: Boolean(user.isActive),
  };

  const remark = (body.remark ?? "").trim() || "User updated";
  const now = new Date();

  await dualWritePostgresFirst({
    pg: async (client) => {
      await client.query(
        `INSERT INTO admin_users(user_id, name, email, role, department, active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,now(),now())
         ON CONFLICT (user_id)
         DO UPDATE SET role = EXCLUDED.role, department = EXCLUDED.department, active = EXCLUDED.active, updated_at = now()`,
        [user._id.toString(), user.name, user.email, user.role, departmentName, Boolean(user.isActive)],
      );

      await client.query(
        `INSERT INTO audit_events(ts, actor, type, entity_type, entity_id, remark, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          now,
          current.email,
          "USER_UPDATED",
          "user",
          user._id.toString(),
          remark,
          JSON.stringify({ before, after }),
        ],
      );
    },
    primary: async () => {
      await user.save();
      await writeAuditEvent({
        type: "USER_UPDATED",
        entityType: "user",
        entityId: user._id.toString(),
        remark,
        metadata: { before, after },
      });
    },
  });

  await publishEvent(TOPICS.USER_UPDATED, user._id.toString(), {
    userId: user._id.toString(),
    before,
    after,
    remark,
  });

  // Invalidate cached user/worker/head lists
  await invalidateDomain("users", "workers", "authority-heads", "dashboard");

  return NextResponse.json({ ok: true });
}

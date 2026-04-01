import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AuditEventModel } from "@/lib/database/models/auditEvent.model";
import AuditLog from "@/lib/database/models/audit-log.model";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Combine both audit sources into one timeline
  const [events, logs] = await Promise.all([
    AuditEventModel.find({}).sort({ ts: -1 }).limit(50).lean(),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  type Row = {
    _id: string;
    timestamp: string;
    action: string;
    actor: string;
    entityId: string;
    details: string;
  };

  const rows: Row[] = [];

  for (const e of events) {
    rows.push({
      _id: (e as Record<string, unknown>)._id?.toString() ?? "",
      timestamp: (e.ts as Date)?.toISOString?.() ?? new Date().toISOString(),
      action: e.type as string,
      actor: (e.actor as string) ?? "system",
      entityId: (e.entityId as string) ?? "",
      details: (e.remark as string) ?? "",
    });
  }

  for (const l of logs) {
    rows.push({
      _id: l._id.toString(),
      timestamp: l.createdAt?.toISOString?.() ?? new Date().toISOString(),
      action: l.action,
      actor: l.userId?.toString() ?? "system",
      entityId: l.recordId?.toString() ?? "",
      details: `${l.action} on ${l.tableName}`,
    });
  }

  // sort descending by timestamp
  rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ logs: rows.slice(0, 75) });
}

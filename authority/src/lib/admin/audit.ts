export type AdminAuditCategory =
  | "Moderation"
  | "User & Role"
  | "Abuse"
  | "Config"
  | "System";

export type AdminAuditEvent = {
  id: string;
  ts: string;
  actor: string;
  category: AdminAuditCategory;
  action: string;
  target: string;
  details?: Record<string, unknown>;
};

const STORAGE_KEY = "pp_admin_audit_v1";

function safeParse(json: string): AdminAuditEvent[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as AdminAuditEvent[];
  } catch {
    return [];
  }
}

export function readAdminAuditEvents(): AdminAuditEvent[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return safeParse(raw);
}

export function appendAdminAuditEvent(event: Omit<AdminAuditEvent, "id" | "ts"> & Partial<Pick<AdminAuditEvent, "id" | "ts">>) {
  if (typeof window === "undefined") return;

  const now = event.ts ?? new Date().toISOString();
  const id = event.id ?? `${now}-${Math.random().toString(16).slice(2)}`;

  const next: AdminAuditEvent = {
    id,
    ts: now,
    actor: event.actor,
    category: event.category,
    action: event.action,
    target: event.target,
    details: event.details,
  };

  const current = readAdminAuditEvents();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...current]));
}

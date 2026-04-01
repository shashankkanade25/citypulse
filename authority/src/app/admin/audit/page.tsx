"use client";

import { useEffect, useMemo, useState } from "react";

type AuditEvent = {
  ts: string;
  actor: string;
  type: string;
  entityType: string;
  entityId: string;
  remark: string;
  metadata?: Record<string, unknown>;
};

export default function AuditLogViewerPage() {
  const [scope, setScope] = useState<"citizens" | "admin">("citizens");
  const [type, setType] = useState<string>("All");
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(
        `/api/admin/audit?scope=${encodeURIComponent(scope)}&type=${encodeURIComponent(type)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as { events: AuditEvent[] };
      if (!cancelled) {
        setEvents(json.events ?? []);
        setLoading(false);
      }
    }

    void refreshKey;
    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [scope, type, refreshKey]);

  const types = useMemo(
    () => [
      "All",
      "CITIZEN_REPORTED",
      "MODERATION_APPROVED",
      "MODERATION_REJECTED",
      "CITIZEN_FLAGGED",
      "USER_UPDATED",
      "ABUSE_ACTION",
      "CONFIG_UPDATED",
    ],
    []
  );

  function exportJson() {
    const payload = JSON.stringify(events, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Audit <span style={{ color: "#09E0F7" }}>Log</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Append-only viewer. Admins cannot edit or delete audit entries.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between" style={{ borderColor: "#F4F5F7" }}>
              <div>
                <div className="font-bold" style={{ color: "#131C15" }}>Entries</div>
                <div className="text-xs mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                  Append-only server log.
                </div>
              </div>
              <div className="flex gap-3">
                <select
                  value={scope}
                  onChange={(e) => {
                    const next = e.target.value === "admin" ? "admin" : "citizens";
                    setScope(next);
                    setType("All");
                  }}
                  className="rounded-2xl px-4 py-2 font-semibold"
                  style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}
                >
                  <option value="citizens">Citizens</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="rounded-2xl px-4 py-2 font-semibold"
                  style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}
                  disabled={scope === "citizens" && type !== "All"}
                >
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  className="px-4 py-2 rounded-2xl font-bold"
                  style={{ backgroundColor: "rgba(9, 224, 247, 0.12)", color: "#131C15", border: "1px solid rgba(9, 224, 247, 0.3)" }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={exportJson}
                  className="px-4 py-2 rounded-2xl font-bold"
                  style={{ backgroundColor: "#131C15", color: "#FFFFFF" }}
                >
                  Export JSON
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F5F7" }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Time</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Actor</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Category</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Action</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Target</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-6 py-6 text-sm" colSpan={6} style={{ color: "#131C15", opacity: 0.7 }}>
                        Loading…
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td className="px-6 py-6 text-sm" colSpan={6} style={{ color: "#131C15", opacity: 0.7 }}>
                        No audit entries yet.
                      </td>
                    </tr>
                  ) : (
                    events.map((e) => (
                      <tr key={`${e.ts}-${e.type}-${e.entityId}`} className="border-b" style={{ borderColor: "#F4F5F7" }}>
                        <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.75 }}>
                          {new Date(e.ts).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#131C15" }}>{e.actor}</td>
                        <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{e.type}</td>
                        <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#131C15" }}>{e.entityType}</td>
                        <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{e.entityId}</td>
                        <td className="px-6 py-4 text-xs" style={{ color: "#131C15", opacity: 0.7 }}>
                          {e.remark}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
              Entries shown: {events.length}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

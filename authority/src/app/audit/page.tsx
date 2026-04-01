"use client";

import { useEffect, useState } from "react";

type AuditRow = {
  _id: string;
  timestamp: string;
  action: string;
  actor: string;
  entityId: string;
  details: string;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/head/audit", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes("Approved") || action.includes("Created") || action.includes("create")) return "#10B981";
    if (action.includes("Rejected") || action.includes("delete")) return "#EF4444";
    if (action.includes("Assigned") || action.includes("update") || action.includes("Updated")) return "#09E0F7";
    return "#6B7280";
  };

  const getActionIcon = (action: string) => {
    if (action.includes("Assigned") || action.includes("assign")) return "👥";
    if (action.includes("Approved") || action.includes("approve")) return "✅";
    if (action.includes("Rejected") || action.includes("reject")) return "❌";
    if (action.includes("Status") || action.includes("update")) return "🔄";
    if (action.includes("Created") || action.includes("create")) return "📝";
    return "📋";
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
      <div className="text-xl font-bold animate-pulse" style={{ color: "#09E0F7" }}>Loading audit trail...</div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Audit <span style={{ color: "#09E0F7" }}>Trail</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>Complete read-only history of all system actions and changes</p>
          </div>

          {/* Info Banner */}
          <div className="rounded-3xl p-6 mb-8" style={{ background: "linear-gradient(to right, rgba(9,224,247,0.1), rgba(9,224,247,0.2))" }}>
            <div className="flex items-start gap-4">
              <div className="text-3xl">🔒</div>
              <div>
                <h3 className="font-bold mb-1" style={{ color: "#131C15" }}>Read-Only Audit Logs</h3>
                <p className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                  All actions are permanently recorded. Authority Heads can view but cannot edit or delete audit entries.
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>{logs.length}</div>
              <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Total Actions</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#10B981" }}>
                {logs.filter((l) => l.action.toLowerCase().includes("approve") || l.action.toLowerCase().includes("create")).length}
              </div>
              <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Approvals / Creates</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#EF4444" }}>
                {logs.filter((l) => l.action.toLowerCase().includes("reject") || l.action.toLowerCase().includes("delete")).length}
              </div>
              <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Rejections / Deletes</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            {logs.map((log, idx) => (
              <div key={log._id + idx} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: getActionColor(log.action) + "20" }}>
                      {getActionIcon(log.action)}
                    </div>
                    {idx < logs.length - 1 && <div className="w-0.5 h-8 my-2" style={{ backgroundColor: "#F4F5F7" }} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>{log.action}</h3>
                          <span className="px-3 py-1 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: getActionColor(log.action) }}>{log.action.split(" ")[0]}</span>
                        </div>
                        <p className="text-sm mb-1" style={{ color: "#131C15", opacity: 0.7 }}>{log.details}</p>
                        {log.entityId && (
                          <p className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>Entity: <span className="font-semibold">{log.entityId}</span></p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold" style={{ color: "#131C15" }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                        <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>{new Date(log.timestamp).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "#F4F5F7" }}>
                      <div className="text-xs font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Actor: {log.actor}</div>
                      <div className="text-xs font-mono" style={{ color: "#131C15", opacity: 0.5 }}>ID: {log._id?.slice(0, 12)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {logs.length === 0 && (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>No Audit Logs Yet</h3>
              <p style={{ color: "#131C15", opacity: 0.7 }}>Actions will appear here as they occur in the system.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

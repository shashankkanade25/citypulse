"use client";

import { useEffect, useState } from "react";

type IncidentHistory = {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  zone: string;
  department: string;
  createdAt: string;
  updatedAt: string;
};

type WorkerRow = {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  zone: string;
  isActive: boolean;
  createdAt: string;
  workload: number;
  history: IncidentHistory[];
};

type WorkerStats = { totalWorkers: number; available: number; busy: number };

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [stats, setStats] = useState<WorkerStats>({ totalWorkers: 0, available: 0, busy: 0 });
  const [loading, setLoading] = useState(true);
  const [historyModal, setHistoryModal] = useState<WorkerRow | null>(null);

  useEffect(() => {
    fetch("/api/head/workers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setWorkers(d.workers ?? []); setStats(d.stats ?? { totalWorkers: 0, available: 0, busy: 0 }); })
      .finally(() => setLoading(false));
  }, []);

  const getWorkloadLevel = (wl: number) => {
    if (wl === 0) return { level: "Free", color: "#10B981" };
    if (wl <= 3) return { level: "Light", color: "#09E0F7" };
    if (wl <= 5) return { level: "Moderate", color: "#F59E0B" };
    return { level: "Heavy", color: "#EF4444" };
  };

  const sevColor: Record<string, string> = { Critical: "#EF4444", High: "#F59E0B", Medium: "#09E0F7", Low: "#10B981" };
  const statColor: Record<string, string> = { Active: "#09E0F7", Resolved: "#10B981", "On Hold": "#F59E0B" };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
      <div className="text-xl font-bold animate-pulse" style={{ color: "#09E0F7" }}>Loading workers...</div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Worker <span style={{ color: "#09E0F7" }}>Management</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>Task assignment and load balancing for field workers</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Total Workers", value: stats.totalWorkers, color: "#09E0F7" },
              { label: "Available", value: stats.available, color: "#10B981" },
              { label: "Busy", value: stats.busy, color: "#F59E0B" },
              { label: "Avg Workload", value: workers.length > 0 ? (workers.reduce((a, w) => a + w.workload, 0) / workers.length).toFixed(1) : "0", color: "#09E0F7" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-4xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: s.color }}>{s.value}</div>
                <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Workers List */}
          <div className="space-y-4">
            {workers.map((worker) => {
              const wlInfo = getWorkloadLevel(worker.workload);
              return (
                <div key={worker._id} className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-md transition-all">
                  <div className="grid lg:grid-cols-12 gap-6">
                    {/* Info */}
                    <div className="lg:col-span-5">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white" style={{ backgroundColor: "#09E0F7" }}>
                          {worker.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>{worker.name}</h3>
                            <div className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: worker.workload > 0 ? "#F59E0B" : "#10B981" }}>
                              {worker.workload > 0 ? "Busy" : "Available"}
                            </div>
                          </div>
                          <p className="text-sm mb-1" style={{ color: "#131C15", opacity: 0.7 }}>📧 {worker.email}</p>
                          {worker.phone && <p className="text-sm mb-1" style={{ color: "#131C15", opacity: 0.7 }}>📱 {worker.phone}</p>}
                          <p className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>📍 {worker.zone}</p>
                        </div>
                      </div>
                    </div>

                    {/* Workload */}
                    <div className="lg:col-span-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold" style={{ color: "#131C15" }}>Zone Workload</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: wlInfo.color }}>{worker.workload}</span>
                            <span className="text-xs font-bold px-2 py-1 rounded text-white" style={{ backgroundColor: wlInfo.color }}>{wlInfo.level}</span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (worker.workload / 10) * 100)}%`, backgroundColor: wlInfo.color }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: "#131C15" }}>Joined</span>
                        <span className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>{new Date(worker.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="lg:col-span-3 flex flex-col gap-2 justify-center">
                      <button
                        onClick={() => setHistoryModal(worker)}
                        className="px-6 py-3 rounded-xl font-semibold text-sm transition-all border-2 hover:shadow-md"
                        style={{ borderColor: "#131C15", color: "#131C15" }}
                      >
                        View History ({worker.history?.length ?? 0})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {workers.length === 0 && (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-6xl mb-4">👷</div>
              <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>No Workers Found</h3>
              <p style={{ color: "#131C15", opacity: 0.7 }}>No active workers registered in the system.</p>
            </div>
          )}
        </div>
      </main>

      {/* ── Worker History Modal ── */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setHistoryModal(null)}>
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(9,224,247,0.2)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white" style={{ backgroundColor: "#09E0F7" }}>
                    {historyModal.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                      {historyModal.name}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "#131C15", opacity: 0.5 }}>
                      {historyModal.email} · {historyModal.zone}
                    </p>
                  </div>
                </div>
                <button onClick={() => setHistoryModal(null)} className="text-2xl" style={{ color: "#131C15", opacity: 0.4 }}>✕</button>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "rgba(9,224,247,0.08)" }}>
                  <div className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>
                    {historyModal.history?.length ?? 0}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: "#131C15", opacity: 0.6 }}>Total Assigned</div>
                </div>
                <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "rgba(9,224,247,0.08)" }}>
                  <div className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#F59E0B" }}>
                    {historyModal.history?.filter(h => h.status === "Active").length ?? 0}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: "#131C15", opacity: 0.6 }}>Active</div>
                </div>
                <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "rgba(16,185,129,0.08)" }}>
                  <div className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#10B981" }}>
                    {historyModal.history?.filter(h => h.status === "Resolved").length ?? 0}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: "#131C15", opacity: 0.6 }}>Resolved</div>
                </div>
              </div>
            </div>

            {/* Incident list */}
            <div className="px-6 py-5">
              <h4 className="text-xs font-bold mb-3" style={{ color: "#131C15", opacity: 0.5, letterSpacing: "0.05em" }}>
                ASSIGNED INCIDENTS
              </h4>
              {historyModal.history?.length > 0 ? (
                <div className="space-y-3">
                  {historyModal.history.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="rounded-xl px-4 py-3 border"
                      style={{ borderColor: "rgba(9,224,247,0.15)", borderLeft: `4px solid ${sevColor[inc.severity] ?? "#6B7280"}` }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold" style={{ color: "#09E0F7" }}>{inc.incidentId}</span>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded text-white"
                              style={{ backgroundColor: statColor[inc.status] ?? "#6B7280" }}
                            >
                              {inc.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: "#131C15" }}>{inc.title}</p>
                        </div>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded text-white flex-shrink-0"
                          style={{ backgroundColor: sevColor[inc.severity] ?? "#6B7280" }}
                        >
                          {inc.severity}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>📍 {inc.zone}</span>
                        <span className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>🏢 {inc.department}</span>
                        <span className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>Reported {timeAgo(inc.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.5 }}>No incidents assigned yet</p>
                  <p className="text-xs mt-1" style={{ color: "#131C15", opacity: 0.4 }}>Incidents will appear here once assigned from the Incident Management page</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

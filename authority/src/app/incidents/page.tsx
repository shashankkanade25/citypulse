"use client";

import { useEffect, useState, useCallback } from "react";

type IncidentRow = {
  _id: string;
  incidentId: string;
  title: string;
  description: string;
  zone: string;
  department: string;
  severity: string;
  status: string;
  confidence: number;
  citizenId: string;
  images: string[];
  createdAt: string;
  slaBreached: boolean;
  assignedTo: string[];
};

type WorkerRow = {
  _id: string;
  name: string;
  email: string;
  zone: string;
  workload: number;
};

type AIWorker = {
  name: string;
  zone: string;
  workload: number;
  email: string;
  assignment_score: number;
};

type AIAssignResult = {
  recommended_worker: AIWorker;
  all_workers_ranked: AIWorker[];
  justification: string;
  department: string;
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "all", severity: "all", zone: "all", sla: "all" });
  const [sortBy, setSortBy] = useState("createdAt");

  // Assignment modal state
  const [assignModal, setAssignModal] = useState<IncidentRow | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [aiResult, setAiResult] = useState<AIAssignResult | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.severity !== "all") params.set("severity", filters.severity);
    if (filters.zone !== "all") params.set("zone", filters.zone);
    if (filters.sla === "breached") params.set("sla", "breached");
    params.set("sort", sortBy);
    fetch(`/api/head/incidents?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setIncidents(d.incidents ?? []); setZones(d.zones ?? []); })
      .finally(() => setLoading(false));
  }, [filters, sortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAssignModal = async (inc: IncidentRow) => {
    setAssignModal(inc);
    setAiResult(null);
    setSelectedWorkers(new Set());
    setLoadingWorkers(true);
    setLoadingAI(true);

    // Fetch workers and AI suggestion in parallel
    const [workersRes, aiRes] = await Promise.allSettled([
      fetch("/api/head/workers").then(r => r.json()),
      fetch(`/api/head/incidents/assign?department=${encodeURIComponent(inc.department)}&severity=${encodeURIComponent(inc.severity)}&category=${encodeURIComponent(inc.title)}&location=${encodeURIComponent(inc.zone)}`).then(r => r.json()),
    ]);

    if (workersRes.status === "fulfilled") {
      setWorkers(workersRes.value.workers ?? []);
    }
    setLoadingWorkers(false);

    if (aiRes.status === "fulfilled" && aiRes.value.recommended_worker) {
      setAiResult(aiRes.value);
    }
    setLoadingAI(false);
  };

  const toggleWorker = (name: string) => {
    setSelectedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleAssignSelected = async () => {
    if (!assignModal || selectedWorkers.size === 0) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/head/incidents/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: assignModal.incidentId,
          workerNames: Array.from(selectedWorkers),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIncidents(prev =>
          prev.map(inc =>
            inc.incidentId === assignModal.incidentId
              ? { ...inc, assignedTo: [...new Set([...(inc.assignedTo ?? []), ...Array.from(selectedWorkers)])], status: "Active" }
              : inc
          )
        );
        setAssignModal(null);
      } else {
        alert(data.error || "Failed to assign workers");
      }
    } catch {
      alert("Failed to assign workers. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAssign = async (workerName: string, _workerId: string) => {
    if (!assignModal) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/head/incidents/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: assignModal.incidentId,
          workerNames: [workerName],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIncidents(prev =>
          prev.map(inc =>
            inc.incidentId === assignModal.incidentId
              ? { ...inc, assignedTo: [...new Set([...(inc.assignedTo ?? []), workerName])], status: "Active" }
              : inc
          )
        );
        setAssignModal(null);
      } else {
        alert(data.error || "Failed to assign worker");
      }
    } catch {
      alert("Failed to assign worker. Please try again.");
    } finally {
      setAssigning(false);
    }
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
      <div className="text-xl font-bold animate-pulse" style={{ color: "#09E0F7" }}>Loading incidents...</div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Incident <span style={{ color: "#09E0F7" }}>Management</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>Full control over department incidents — assign, prioritize, and manage</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-3xl px-6 py-6 shadow-sm mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-4 py-2 border-2 rounded-xl font-semibold text-sm focus:outline-none" style={{ borderColor: "rgba(9,224,247,0.3)", color: "#131C15" }}>
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Resolved">Resolved</option>
                <option value="On Hold">On Hold</option>
              </select>
              <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })} className="px-4 py-2 border-2 rounded-xl font-semibold text-sm focus:outline-none" style={{ borderColor: "rgba(9,224,247,0.3)", color: "#131C15" }}>
                <option value="all">All Severity</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} className="px-4 py-2 border-2 rounded-xl font-semibold text-sm focus:outline-none" style={{ borderColor: "rgba(9,224,247,0.3)", color: "#131C15" }}>
                <option value="all">All Zones</option>
                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              <select value={filters.sla} onChange={(e) => setFilters({ ...filters, sla: e.target.value })} className="px-4 py-2 border-2 rounded-xl font-semibold text-sm focus:outline-none" style={{ borderColor: "rgba(9,224,247,0.3)", color: "#131C15" }}>
                <option value="all">All SLA</option>
                <option value="breached">SLA Breached</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2 border-2 rounded-xl font-semibold text-sm focus:outline-none" style={{ borderColor: "rgba(9,224,247,0.3)", color: "#131C15" }}>
                <option value="createdAt">Sort by Time</option>
                <option value="severity">Sort by Severity</option>
                <option value="confidence">Sort by Confidence</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Showing {incidents.length} incidents</p>
          </div>

          {/* Incidents Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {incidents.map((inc) => (
              <div key={inc._id} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all" style={{ borderLeft: `4px solid ${sevColor[inc.severity] ?? "#6B7280"}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold" style={{ color: "#09E0F7" }}>{inc.incidentId}</span>
                      {inc.slaBreached && <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: "#EF4444" }}>SLA BREACHED</span>}
                    </div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>{inc.title}</h3>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-lg text-white" style={{ backgroundColor: statColor[inc.status] ?? "#6B7280" }}>{inc.status}</span>
                </div>

                <p className="text-sm mb-4" style={{ color: "#131C15", opacity: 0.7 }}>{inc.description?.slice(0, 120)}{inc.description?.length > 120 ? "..." : ""}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: sevColor[inc.severity] ?? "#6B7280", color: "#fff" }}>{inc.severity}</span>
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>📍 {inc.zone}</span>
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>🏢 {inc.department}</span>
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>🤖 {Math.round(inc.confidence * 100)}%</span>
                </div>

                {/* Assigned Workers Badges */}
                {inc.assignedTo?.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {inc.assignedTo.map((w) => (
                      <span key={w} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }}>
                        👷 {w}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
                  <span>Reported {timeAgo(inc.createdAt)}</span>
                  <div className="flex items-center gap-3">
                    <span>{inc.images?.length ?? 0} image{(inc.images?.length ?? 0) !== 1 ? "s" : ""}</span>
                    {inc.status !== "Resolved" && (
                      <button
                        onClick={() => openAssignModal(inc)}
                        className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all hover:shadow-md"
                        style={{ backgroundColor: "#09E0F7", color: "#131C15" }}
                      >
                        {inc.assignedTo?.length > 0 ? "Add / Reassign" : "Assign Workers"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {incidents.length === 0 && (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>No Incidents Found</h3>
              <p style={{ color: "#131C15", opacity: 0.7 }}>Try adjusting your filters to see more results.</p>
            </div>
          )}
        </div>
      </main>

      {/* ── Worker Assignment Modal ── */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAssignModal(null)}>
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(9,224,247,0.2)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                    Assign Workers
                  </h3>
                  <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                    {assignModal.incidentId} — {assignModal.title}
                  </p>
                </div>
                <button onClick={() => setAssignModal(null)} className="text-2xl" style={{ color: "#131C15", opacity: 0.4 }}>✕</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: sevColor[assignModal.severity] ?? "#6B7280", color: "#fff" }}>{assignModal.severity}</span>
                <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>🏢 {assignModal.department}</span>
                <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>📍 {assignModal.zone}</span>
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(9,224,247,0.2)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h4 className="text-sm font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                  AI Worker Recommendation
                </h4>
              </div>
              {loadingAI ? (
                <div className="px-5 py-6 rounded-xl text-center" style={{ backgroundColor: "rgba(9,224,247,0.06)" }}>
                  <div className="text-2xl mb-2 animate-pulse">🤖</div>
                  <p className="text-sm font-bold" style={{ color: "#131C15" }}>Analyzing workers...</p>
                  <p className="text-xs mt-1" style={{ color: "#131C15", opacity: 0.5 }}>Checking zone match, workload &amp; severity</p>
                </div>
              ) : aiResult ? (
                <div className="space-y-3">
                  {/* AI Justification */}
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "#F4F5F7", color: "#131C15", opacity: 0.85 }}>
                    <span className="font-bold">AI Reasoning:</span> {aiResult.justification}
                  </div>

                  {/* Ranked workers with checkboxes */}
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {aiResult.all_workers_ranked.slice(0, 8).map((w, idx) => {
                      const isRecommended = idx === 0;
                      const isAlready = assignModal?.assignedTo?.includes(w.name);
                      const isSelected = selectedWorkers.has(w.name);
                      return (
                        <label
                          key={w.name}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${isSelected ? "ring-2" : "hover:bg-gray-50"}`}
                          style={{
                            borderColor: isRecommended ? "#09E0F7" : isSelected ? "#09E0F7" : "rgba(0,0,0,0.06)",
                            backgroundColor: isRecommended && !isSelected ? "rgba(9,224,247,0.06)" : isSelected ? "rgba(9,224,247,0.08)" : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleWorker(w.name)}
                              className="w-4 h-4 rounded accent-[#09E0F7]"
                            />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "#131C15" }}>
                                <span className="mr-1 text-xs font-bold" style={{ color: "#09E0F7" }}>#{idx + 1}</span>
                                {w.name}
                                {isRecommended && (
                                  <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#09E0F7", color: "#131C15" }}>RECOMMENDED</span>
                                )}
                                {isAlready && <span className="ml-2 text-xs font-normal" style={{ color: "#059669" }}>(already assigned)</span>}
                              </p>
                              <p className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>
                                {w.zone || "No zone"} · {w.workload} active task{w.workload !== 1 ? "s" : ""} · Score: +2
                              </p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="px-5 py-4 rounded-xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.05)", color: "#dc2626" }}>
                  ⚠️ Could not get AI recommendation. You can still manually assign a worker below.
                </div>
              )}
            </div>

            {/* Manual Worker List — Fallback when AI ranking unavailable */}
            {!aiResult && !loadingAI && (
              <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(9,224,247,0.2)" }}>
                <h4 className="text-sm font-bold mb-3" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                  Select Workers ({workers.length})
                </h4>

                {/* Already assigned notice */}
                {assignModal && assignModal.assignedTo?.length > 0 && (
                  <div className="mb-3 px-4 py-2 rounded-xl text-xs" style={{ backgroundColor: "rgba(16,185,129,0.06)", color: "#059669" }}>
                    Already assigned: {assignModal.assignedTo.join(", ")}
                  </div>
                )}

                {loadingWorkers ? (
                  <div className="text-center py-4">
                    <p className="text-sm animate-pulse" style={{ color: "#131C15", opacity: 0.5 }}>Loading workers...</p>
                  </div>
                ) : workers.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {workers.map((w) => {
                      const isAlready = assignModal?.assignedTo?.includes(w.name);
                      const isSelected = selectedWorkers.has(w.name);
                      return (
                        <label
                          key={w._id}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${isSelected ? "ring-2" : "hover:bg-gray-50"}`}
                          style={{
                            borderColor: isSelected ? "#09E0F7" : "rgba(0,0,0,0.06)",
                            backgroundColor: isSelected ? "rgba(9,224,247,0.06)" : isAlready ? "rgba(16,185,129,0.04)" : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleWorker(w.name)}
                              className="w-4 h-4 rounded accent-[#09E0F7]"
                            />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "#131C15" }}>
                                {w.name}
                                {isAlready && <span className="ml-2 text-xs font-normal" style={{ color: "#059669" }}>(already assigned)</span>}
                              </p>
                              <p className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>
                                {w.email} · {w.zone} · {w.workload} active task{w.workload !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-sm py-4" style={{ color: "#131C15", opacity: 0.5 }}>No workers found</p>
                )}
              </div>
            )}

            {/* Assign Button */}
            <div className="px-6 py-5">
              {/* Already assigned notice */}
              {aiResult && assignModal && assignModal.assignedTo?.length > 0 && (
                <div className="mb-3 px-4 py-2 rounded-xl text-xs" style={{ backgroundColor: "rgba(16,185,129,0.06)", color: "#059669" }}>
                  Already assigned: {assignModal.assignedTo.join(", ")}
                </div>
              )}
              {selectedWorkers.size > 0 ? (
                <button
                  onClick={handleAssignSelected}
                  disabled={assigning}
                  className="w-full px-4 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-md disabled:opacity-50"
                  style={{ backgroundColor: "#09E0F7", color: "#131C15" }}
                >
                  {assigning ? "Assigning..." : `Assign ${selectedWorkers.size} Worker${selectedWorkers.size > 1 ? "s" : ""}`}
                </button>
              ) : (
                <p className="text-center text-sm py-2" style={{ color: "#131C15", opacity: 0.4 }}>
                  Select one or more workers above to assign
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

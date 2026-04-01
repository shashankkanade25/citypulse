"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/* ─── Types ─── */
type Incident = {
  _id: string;
  incidentId: string;
  title: string;
  description: string;
  zone: string;
  department: string;
  severity: string;
  status: string;
  images: string[];
  assignedTo: string[];
  createdAt: string;
  slaBreached: boolean;
  todayEodSubmitted?: boolean;
  todayEodStatus?: string | null;
  isAssignedToMe?: boolean;
};

type DeptIncident = Incident & { isAssignedToMe: boolean };

type HistoryUpdate = {
  _id: string;
  incidentId: string;
  incident: {
    incidentId: string;
    title: string;
    department: string;
    zone: string;
    severity: string;
    status: string;
    createdAt: string;
  } | null;
  description: string;
  images: string[];
  date: string;
  submittedAt: string;
  status: string;
  headRemarks?: string;
  publishedToTransparency: boolean;
};

type Stats = {
  total: number;
  active: number;
  resolved: number;
  onHold: number;
  eodPending: number;
};

type HistoryStats = {
  totalUpdates: number;
  approved: number;
  pending: number;
  rejected: number;
  totalIncidentsWorked: number;
  resolvedIncidents: number;
};

type Tab = "my-tasks" | "dept-tasks" | "eod" | "history";

/* ─── Palette ─── */
const C = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  accent: "#09E0F7",
  dark: "#131C15",
  muted: "rgba(19,28,21,0.55)",
  sev: { Critical: "#EF4444", High: "#F59E0B", Medium: "#09E0F7", Low: "#10B981" } as Record<string, string>,
  status: { pending: "#F59E0B", approved: "#10B981", rejected: "#EF4444" } as Record<string, string>,
};

/* ─── Main Component ─── */
export default function WorkerDashboard() {
  const [tab, setTab] = useState<Tab>("my-tasks");

  /* My Tasks */
  const [myIncidents, setMyIncidents] = useState<Incident[]>([]);
  const [myStats, setMyStats] = useState<Stats>({ total: 0, active: 0, resolved: 0, onHold: 0, eodPending: 0 });
  const [loadingMy, setLoadingMy] = useState(true);
  const [errorMy, setErrorMy] = useState<string | null>(null);

  /* Dept Tasks */
  const [deptIncidents, setDeptIncidents] = useState<DeptIncident[]>([]);
  const [deptName, setDeptName] = useState("");
  const [loadingDept, setLoadingDept] = useState(false);
  const [errorDept, setErrorDept] = useState<string | null>(null);

  /* EOD */
  const [eodIncidentId, setEodIncidentId] = useState("");
  const [eodDescription, setEodDescription] = useState("");
  const [eodImages, setEodImages] = useState<string[]>([]);
  const [eodUploading, setEodUploading] = useState(false);
  const [eodSubmitting, setEodSubmitting] = useState(false);
  const [eodMessage, setEodMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* History */
  const [historyUpdates, setHistoryUpdates] = useState<HistoryUpdate[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);

  /* ─── Fetch My Tasks ─── */
  const fetchMyTasks = useCallback(async () => {
    setLoadingMy(true);
    setErrorMy(null);
    try {
      const res = await fetch("/api/worker/my-tasks", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMy(data.error || `Error ${res.status}`);
        return;
      }
      setMyIncidents(data.incidents ?? []);
      setMyStats(data.stats ?? { total: 0, active: 0, resolved: 0, onHold: 0, eodPending: 0 });
    } catch {
      setErrorMy("Failed to connect to server. Please check your connection.");
    } finally {
      setLoadingMy(false);
    }
  }, []);

  /* ─── Fetch Dept Tasks ─── */
  const fetchDeptTasks = useCallback(async () => {
    setLoadingDept(true);
    setErrorDept(null);
    try {
      const res = await fetch("/api/worker/dept-tasks", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErrorDept(data.error || `Error ${res.status}`);
        return;
      }
      setDeptIncidents(data.incidents ?? []);
      setDeptName(data.department ?? "");
    } catch {
      setErrorDept("Failed to connect to server. Please check your connection.");
    } finally {
      setLoadingDept(false);
    }
  }, []);

  /* ─── Fetch History ─── */
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    setErrorHistory(null);
    try {
      const res = await fetch(
        `/api/worker/history?page=${historyPage}&limit=15&status=${historyFilter}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorHistory(data.error || `Error ${res.status}`);
        return;
      }
      setHistoryUpdates(data.updates ?? []);
      setHistoryStats(data.stats ?? null);
      setHistoryTotalPages(data.pagination?.totalPages ?? 1);
    } catch {
      setErrorHistory("Failed to connect to server. Please check your connection.");
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPage, historyFilter]);

  /* ─── Data loading per tab ─── */
  useEffect(() => {
    if (tab === "my-tasks") fetchMyTasks();
  }, [tab, fetchMyTasks]);

  useEffect(() => {
    if (tab === "dept-tasks") fetchDeptTasks();
  }, [tab, fetchDeptTasks]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  /* ─── EOD Image upload (base64 or URL) ─── */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setEodUploading(true);
    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(dataUrl);
    }
    setEodImages((prev) => [...prev, ...newImages]);
    setEodUploading(false);
  };

  /* ─── Submit EOD ─── */
  const submitEod = async () => {
    if (!eodIncidentId || !eodDescription) {
      setEodMessage({ type: "error", text: "Please select a task and enter a description." });
      return;
    }
    if (eodDescription.length < 10) {
      setEodMessage({ type: "error", text: "Description must be at least 10 characters." });
      return;
    }
    setEodSubmitting(true);
    setEodMessage(null);
    try {
      const res = await fetch("/api/worker/eod-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: eodIncidentId,
          description: eodDescription,
          images: eodImages,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEodMessage({ type: "success", text: data.message });
        setEodDescription("");
        setEodImages([]);
        setEodIncidentId("");
        fetchMyTasks();
      } else {
        setEodMessage({ type: "error", text: data.error || "Failed to submit." });
      }
    } catch {
      setEodMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setEodSubmitting(false);
    }
  };

  /* ─── Helpers ─── */
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "my-tasks", label: "My Tasks", icon: "📋" },
    { key: "dept-tasks", label: "Department", icon: "🏢" },
    { key: "eod", label: "EOD Update", icon: "📝" },
    { key: "history", label: "My History", icon: "📊" },
  ];

  const activeMyTasks = myIncidents.filter((i) => i.status === "Active");

  /* ─── Render ─── */
  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: C.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Tab Nav ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all"
              style={{
                backgroundColor: tab === t.key ? C.accent : C.card,
                color: tab === t.key ? "#FFF" : C.dark,
                boxShadow: tab === t.key ? "0 4px 14px rgba(9,224,247,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <span>{t.icon}</span> {t.label}
              {t.key === "my-tasks" && myStats.eodPending > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: "#EF4444", color: "#FFF" }}
                >
                  {myStats.eodPending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/*  TAB 1 — MY TASKS                              */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === "my-tasks" && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Total Assigned", value: myStats.total, color: C.accent },
                { label: "Active", value: myStats.active, color: "#F59E0B" },
                { label: "Resolved", value: myStats.resolved, color: "#10B981" },
                { label: "On Hold", value: myStats.onHold, color: "#6B7280" },
                { label: "EOD Pending", value: myStats.eodPending, color: "#EF4444" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs font-semibold" style={{ color: C.muted }}>{s.label}</div>
                </div>
              ))}
            </div>

            {loadingMy ? (
              <LoadingSpinner />
            ) : errorMy ? (
              <ErrorState message={errorMy} onRetry={fetchMyTasks} />
            ) : myIncidents.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: C.dark }}>
                  Your Assigned Tasks
                </h2>
                {myIncidents.map((inc) => (
                  <IncidentCard
                    key={inc._id}
                    incident={inc}
                    showEodBadge
                    onSubmitEod={() => {
                      setEodIncidentId(inc.incidentId);
                      setTab("eod");
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon="✅" title="No Tasks Assigned" message="You're all caught up! Tasks will appear here when assigned by your department head." />
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  TAB 2 — DEPARTMENT TASKS                      */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === "dept-tasks" && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: C.dark }}>
                Department Incidents {deptName && <span style={{ color: C.accent }}>— {deptName}</span>}
              </h2>
              <p className="text-sm mt-1" style={{ color: C.muted }}>
                All ongoing incidents in your zone/department
              </p>
            </div>

            {loadingDept ? (
              <LoadingSpinner />
            ) : errorDept ? (
              <ErrorState message={errorDept} onRetry={fetchDeptTasks} />
            ) : deptIncidents.length > 0 ? (
              <div className="space-y-4">
                {deptIncidents.map((inc) => (
                  <div key={inc._id} className="relative">
                    {inc.isAssignedToMe && (
                      <div
                        className="absolute -top-2 right-4 px-2 py-0.5 rounded-full text-xs font-bold z-10"
                        style={{ backgroundColor: C.accent, color: "#FFF" }}
                      >
                        Assigned to you
                      </div>
                    )}
                    <IncidentCard incident={inc} showAssignees />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="🏢" title="No Department Incidents" message="No ongoing incidents in your department right now." />
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  TAB 3 — EOD UPDATE                            */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === "eod" && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: C.dark }}>
                Submit <span style={{ color: C.accent }}>EOD Update</span>
              </h2>
              <p className="text-sm mt-1" style={{ color: C.muted }}>
                Report your daily work progress with images and description. This will be reviewed by your department head.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
              {/* Task picker */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: C.dark }}>
                  Select Task <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  value={eodIncidentId}
                  onChange={(e) => setEodIncidentId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm"
                  style={{ borderColor: "rgba(9,224,247,0.3)", color: C.dark }}
                >
                  <option value="">— Select an active task —</option>
                  {activeMyTasks.map((inc) => (
                    <option key={inc.incidentId} value={inc.incidentId}>
                      [{inc.incidentId}] {inc.title}
                      {inc.todayEodSubmitted ? " ✅ (already submitted)" : ""}
                    </option>
                  ))}
                </select>
                {activeMyTasks.length === 0 && (
                  <p className="text-xs mt-2" style={{ color: "#EF4444" }}>
                    No active tasks to report on. Tasks will appear after being assigned by your head.
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: C.dark }}>
                  Work Description <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <textarea
                  value={eodDescription}
                  onChange={(e) => setEodDescription(e.target.value)}
                  rows={5}
                  placeholder="Describe the work you did today — what was completed, what's pending, any blockers..."
                  className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
                  style={{ borderColor: "rgba(9,224,247,0.3)", color: C.dark }}
                />
                <div className="text-xs mt-1" style={{ color: eodDescription.length < 10 ? "#EF4444" : "#10B981" }}>
                  {eodDescription.length}/10 min characters
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: C.dark }}>
                  Upload Work Photos
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={eodUploading}
                  className="w-full py-4 rounded-xl border-2 border-dashed text-sm font-semibold transition-all hover:border-solid"
                  style={{
                    borderColor: "rgba(9,224,247,0.4)",
                    color: C.accent,
                    backgroundColor: "rgba(9,224,247,0.05)",
                  }}
                >
                  {eodUploading ? "Processing images..." : "📷 Click to upload images"}
                </button>

                {/* Image Preview Grid */}
                {eodImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {eodImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img}
                          alt={`upload-${idx}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => setEodImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Message */}
              {eodMessage && (
                <div
                  className="px-4 py-3 rounded-xl text-sm font-semibold"
                  style={{
                    backgroundColor: eodMessage.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: eodMessage.type === "success" ? "#10B981" : "#EF4444",
                  }}
                >
                  {eodMessage.type === "success" ? "✅" : "⚠️"} {eodMessage.text}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={submitEod}
                disabled={eodSubmitting || !eodIncidentId || eodDescription.length < 10}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: C.accent,
                  boxShadow: "0 4px 14px rgba(9,224,247,0.3)",
                }}
              >
                {eodSubmitting ? "Submitting..." : "📤 Submit EOD Report"}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  TAB 4 — PERSONAL HISTORY                      */}
        {/* ═══════════════════════════════════════════════ */}
        {tab === "history" && (
          <>
            {/* History Stats */}
            {historyStats && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                {[
                  { label: "Total Updates", value: historyStats.totalUpdates, color: C.accent },
                  { label: "Approved", value: historyStats.approved, color: "#10B981" },
                  { label: "Pending", value: historyStats.pending, color: "#F59E0B" },
                  { label: "Rejected", value: historyStats.rejected, color: "#EF4444" },
                  { label: "Incidents Worked", value: historyStats.totalIncidentsWorked, color: "#6366F1" },
                  { label: "Resolved", value: historyStats.resolvedIncidents, color: "#10B981" },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs font-semibold" style={{ color: C.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-semibold" style={{ color: C.dark }}>Filter:</span>
              {["all", "approved", "pending", "rejected"].map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setHistoryFilter(f);
                    setHistoryPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all"
                  style={{
                    backgroundColor: historyFilter === f ? C.accent : C.card,
                    color: historyFilter === f ? "#FFF" : C.dark,
                    boxShadow: historyFilter === f ? "0 2px 8px rgba(9,224,247,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {loadingHistory ? (
              <LoadingSpinner />
            ) : errorHistory ? (
              <ErrorState message={errorHistory} onRetry={fetchHistory} />
            ) : historyUpdates.length > 0 ? (
              <div className="space-y-4">
                {historyUpdates.map((upd) => (
                  <div key={upd._id} className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold" style={{ color: C.accent }}>
                            {upd.incidentId}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold text-white capitalize"
                            style={{ backgroundColor: C.status[upd.status] ?? "#6B7280" }}
                          >
                            {upd.status}
                          </span>
                          {upd.publishedToTransparency && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(9,224,247,0.15)", color: C.accent }}>
                              🌐 Published
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm" style={{ color: C.dark }}>
                          {upd.incident?.title ?? "Incident"}
                        </h3>
                      </div>
                      <div className="text-xs text-right" style={{ color: C.muted }}>
                        <div>{formatDate(upd.date)}</div>
                        <div>{timeAgo(upd.submittedAt)}</div>
                      </div>
                    </div>

                    <p className="text-sm mb-3" style={{ color: C.dark, opacity: 0.8 }}>
                      {upd.description}
                    </p>

                    {/* Images */}
                    {upd.images.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto">
                        {upd.images.map((img, idx) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={idx}
                            src={img}
                            alt={`work-${idx}`}
                            className="h-20 w-20 object-cover rounded-lg flex-shrink-0"
                          />
                        ))}
                      </div>
                    )}

                    {/* Head remarks */}
                    {upd.headRemarks && (
                      <div
                        className="px-3 py-2 rounded-lg text-xs"
                        style={{ backgroundColor: "rgba(9,224,247,0.06)", color: C.dark }}
                      >
                        <span className="font-bold">Head remarks:</span> {upd.headRemarks}
                      </div>
                    )}

                    {/* Incident meta */}
                    {upd.incident && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: C.bg, color: C.dark }}>
                          📍 {upd.incident.zone}
                        </span>
                        <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: C.bg, color: C.dark }}>
                          🏢 {upd.incident.department}
                        </span>
                        <span
                          className="text-xs font-bold px-2 py-1 rounded text-white"
                          style={{ backgroundColor: C.sev[upd.incident.severity] ?? "#6B7280" }}
                        >
                          {upd.incident.severity}
                        </span>
                        <span
                          className="text-xs font-bold px-2 py-1 rounded"
                          style={{
                            backgroundColor: upd.incident.status === "Resolved" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                            color: upd.incident.status === "Resolved" ? "#10B981" : "#F59E0B",
                          }}
                        >
                          {upd.incident.status}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Pagination */}
                {historyTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                      style={{ backgroundColor: C.card, color: C.dark }}
                    >
                      ← Prev
                    </button>
                    <span className="text-sm font-semibold" style={{ color: C.muted }}>
                      {historyPage} / {historyTotalPages}
                    </span>
                    <button
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                      disabled={historyPage >= historyTotalPages}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                      style={{ backgroundColor: C.card, color: C.dark }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon="📊"
                title="No History Yet"
                message="Your submitted EOD updates and work history will appear here."
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function LoadingSpinner() {
  return (
    <div className="text-center py-16">
      <div className="text-xl font-bold animate-pulse" style={{ color: C.accent }}>
        Loading...
      </div>
    </div>
  );
}

function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="bg-white rounded-2xl px-6 py-16 text-center shadow-sm">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: C.dark }}>
        {title}
      </h3>
      <p style={{ color: C.muted }}>{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-2xl px-6 py-12 text-center shadow-sm" style={{ borderLeft: "4px solid #EF4444" }}>
      <div className="text-5xl mb-4">⚠️</div>
      <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#EF4444" }}>
        Something went wrong
      </h3>
      <p className="text-sm mb-4" style={{ color: C.muted }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-xl font-bold text-sm text-white transition-all hover:shadow-md"
          style={{ backgroundColor: C.accent }}
        >
          🔄 Retry
        </button>
      )}
    </div>
  );
}

function IncidentCard({
  incident,
  showEodBadge,
  showAssignees,
  onSubmitEod,
}: {
  incident: Incident;
  showEodBadge?: boolean;
  showAssignees?: boolean;
  onSubmitEod?: () => void;
}) {
  const [now] = useState(() => Date.now());
  const timeAgo = (iso: string) => {
    const diff = now - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm transition-all hover:shadow-md"
      style={{ borderLeft: `4px solid ${C.sev[incident.severity] ?? "#6B7280"}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono font-bold" style={{ color: C.accent }}>
              {incident.incidentId}
            </span>
            {incident.slaBreached && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                ⚠ SLA Breached
              </span>
            )}
            {showEodBadge && incident.status === "Active" && (
              incident.todayEodSubmitted ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10B981" }}>
                  ✅ EOD Submitted
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                  ⏳ EOD Pending
                </span>
              )
            )}
          </div>
          <h3 className="text-base font-bold" style={{ color: C.dark }}>
            {incident.title}
          </h3>
        </div>
        <span
          className="text-xs font-bold px-3 py-1 rounded-lg text-white flex-shrink-0 ml-3"
          style={{ backgroundColor: C.sev[incident.severity] ?? "#6B7280" }}
        >
          {incident.severity}
        </span>
      </div>

      <p className="text-sm mb-3" style={{ color: C.dark, opacity: 0.7 }}>
        {incident.description?.slice(0, 180)}
        {incident.description?.length > 180 ? "..." : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: C.bg, color: C.dark }}>
          📍 {incident.zone}
        </span>
        <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: C.bg, color: C.dark }}>
          🏢 {incident.department}
        </span>
        <span
          className="text-xs font-bold px-2 py-1 rounded"
          style={{
            backgroundColor: incident.status === "Resolved" ? "rgba(16,185,129,0.15)" : incident.status === "On Hold" ? "rgba(107,114,128,0.15)" : "rgba(245,158,11,0.15)",
            color: incident.status === "Resolved" ? "#10B981" : incident.status === "On Hold" ? "#6B7280" : "#F59E0B",
          }}
        >
          {incident.status}
        </span>
        <span className="text-xs" style={{ color: C.muted }}>
          {timeAgo(incident.createdAt)}
        </span>

        {showAssignees && incident.assignedTo?.length > 0 && (
          <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: "rgba(9,224,247,0.1)", color: C.accent }}>
            👷 {incident.assignedTo.join(", ")}
          </span>
        )}

        {/* EOD submit shortcut on task card */}
        {showEodBadge && incident.status === "Active" && !incident.todayEodSubmitted && onSubmitEod && (
          <button
            onClick={onSubmitEod}
            className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:shadow-md"
            style={{ backgroundColor: C.accent }}
          >
            📝 Submit EOD
          </button>
        )}
      </div>
    </div>
  );
}

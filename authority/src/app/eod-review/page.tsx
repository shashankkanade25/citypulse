"use client";

import { useEffect, useState, useCallback } from "react";

/* ───── Types ─────────────────────────────────────────────────── */

type WorkerUpdate = {
  _id: string;
  incidentId: string;
  workerId: string;
  workerName: string;
  description: string;
  images: string[];
  date: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  headRemarks?: string;
  publishedToTransparency: boolean;
};

type TabKey = "pending" | "approved" | "rejected" | "all";

/* ───── Helpers ───────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(s: string) {
  if (s === "approved") return { bg: "#D1FAE5", text: "#065F46" };
  if (s === "rejected") return { bg: "#FEE2E2", text: "#991B1B" };
  return { bg: "#FEF3C7", text: "#92400E" }; // pending
}

/* ───── Sub-components ────────────────────────────────────────── */

function Spinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div
        className="w-10 h-10 border-4 rounded-full animate-spin"
        style={{ borderColor: "#E5E7EB", borderTopColor: "#09E0F7" }}
      />
    </div>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const msgs: Record<TabKey, string> = {
    pending: "No pending EOD updates to review.",
    approved: "No approved updates yet.",
    rejected: "No rejected updates.",
    all: "No EOD updates found.",
  };
  return (
    <div className="py-20 text-center" style={{ color: "#131C15", opacity: 0.5 }}>
      <svg className="mx-auto mb-4 w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <p className="text-lg font-semibold">{msgs[tab]}</p>
    </div>
  );
}

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div className="relative max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow text-lg font-bold flex items-center justify-center hover:bg-gray-100 cursor-pointer"
        >
          ×
        </button>
        <img src={src} alt="EOD evidence" className="max-h-[80vh] rounded-xl shadow-2xl object-contain" />
      </div>
    </div>
  );
}

/* ───── Main Page ─────────────────────────────────────────────── */

export default function EODReviewPage() {
  const [tab, setTab] = useState<TabKey>("pending");
  const [updates, setUpdates] = useState<WorkerUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 });

  // Action state
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approved" | "rejected" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [publish, setPublish] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Image modal
  const [modalImage, setModalImage] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/head/worker-updates?status=${tab}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setUpdates(data.updates ?? []);
    } catch {
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  // Fetch counts for all tabs
  const fetchCounts = useCallback(async () => {
    try {
      const [pending, approved, rejected, all] = await Promise.all([
        fetch("/api/head/worker-updates?status=pending").then((r) => r.json()),
        fetch("/api/head/worker-updates?status=approved").then((r) => r.json()),
        fetch("/api/head/worker-updates?status=rejected").then((r) => r.json()),
        fetch("/api/head/worker-updates?status=all").then((r) => r.json()),
      ]);
      setCounts({
        pending: pending.updates?.length ?? 0,
        approved: approved.updates?.length ?? 0,
        rejected: rejected.updates?.length ?? 0,
        all: all.updates?.length ?? 0,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleAction = async () => {
    if (!actionId || !actionType) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/head/worker-updates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateId: actionId,
          action: actionType,
          remarks: remarks.trim() || undefined,
          publishToTransparency: publish,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to update");
        return;
      }
      // Reset action modal
      setActionId(null);
      setActionType(null);
      setRemarks("");
      setPublish(false);
      // Refresh
      fetchUpdates();
      fetchCounts();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAction = (id: string, type: "approved" | "rejected") => {
    setActionId(id);
    setActionType(type);
    setRemarks("");
    setPublish(type === "approved"); // default to publish on approve
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F4F5F7" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
          >
            EOD Review
          </h1>
          <p style={{ color: "#131C15", opacity: 0.6 }}>
            Review and verify daily work updates submitted by field workers.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Pending Review", count: counts.pending, color: "#F59E0B", bg: "#FEF3C7" },
            { label: "Approved", count: counts.approved, color: "#10B981", bg: "#D1FAE5" },
            { label: "Rejected", count: counts.rejected, color: "#EF4444", bg: "#FEE2E2" },
            { label: "Total", count: counts.all, color: "#09E0F7", bg: "#E0FAFE" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-5 flex flex-col"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(19,28,21,0.08)" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#131C15", opacity: 0.5 }}>
                {stat.label}
              </span>
              <span className="text-3xl font-bold" style={{ color: stat.color }}>
                {stat.count}
              </span>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
          style={{ backgroundColor: "#E5E7EB" }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-5 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer flex items-center gap-2"
              style={{
                backgroundColor: tab === t.key ? "#FFFFFF" : "transparent",
                color: tab === t.key ? "#131C15" : "rgba(19,28,21,0.5)",
                boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {t.label}
              {t.key !== "all" && counts[t.key] > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    backgroundColor:
                      t.key === "pending" ? "#FEF3C7" : t.key === "approved" ? "#D1FAE5" : "#FEE2E2",
                    color: t.key === "pending" ? "#92400E" : t.key === "approved" ? "#065F46" : "#991B1B",
                  }}
                >
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <Spinner />
        ) : updates.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-4">
            {updates.map((u) => {
              const sc = statusColor(u.status);
              return (
                <div
                  key={u._id}
                  className="rounded-2xl p-6 transition-all hover:shadow-md"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(19,28,21,0.08)" }}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: "#09E0F7", color: "#fff" }}
                      >
                        {u.workerName
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: "#131C15" }}>
                          {u.workerName}
                        </div>
                        <div className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>
                          Incident: {u.incidentId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                      </span>
                      {u.publishedToTransparency && (
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full"
                          style={{ backgroundColor: "#DBEAFE", color: "#1E40AF" }}
                        >
                          Published
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date Row */}
                  <div className="flex flex-wrap gap-4 mb-3 text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
                    <span>
                      📅 Report Date: <strong>{formatDate(u.date)}</strong>
                    </span>
                    <span>
                      🕐 Submitted: <strong>{formatDateTime(u.submittedAt)}</strong>
                    </span>
                  </div>

                  {/* Description */}
                  <div
                    className="rounded-xl p-4 mb-4 text-sm leading-relaxed"
                    style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}
                  >
                    {u.description}
                  </div>

                  {/* Images */}
                  {u.images.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold mb-2" style={{ color: "#131C15", opacity: 0.5 }}>
                        Evidence Photos ({u.images.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {u.images.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => setModalImage(img)}
                            className="cursor-pointer rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-[#09E0F7] transition-all"
                          >
                            <img
                              src={img}
                              alt={`Evidence ${idx + 1}`}
                              className="w-20 h-20 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Head Remarks (if already reviewed) */}
                  {u.headRemarks && (
                    <div
                      className="rounded-xl p-3 mb-4 text-sm"
                      style={{
                        backgroundColor: u.status === "approved" ? "#F0FDF4" : "#FEF2F2",
                        border: `1px solid ${u.status === "approved" ? "#BBF7D0" : "#FECACA"}`,
                        color: "#131C15",
                      }}
                    >
                      <span className="font-bold text-xs" style={{ opacity: 0.6 }}>
                        Head&apos;s Remarks:
                      </span>{" "}
                      {u.headRemarks}
                    </div>
                  )}

                  {/* Action Buttons (only for pending) */}
                  {u.status === "pending" && (
                    <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "rgba(19,28,21,0.06)" }}>
                      <button
                        onClick={() => openAction(u._id, "approved")}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all hover:shadow-md"
                        style={{ backgroundColor: "#10B981", color: "#fff" }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => openAction(u._id, "rejected")}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all hover:shadow-md"
                        style={{ backgroundColor: "#EF4444", color: "#fff" }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-xl font-bold mb-4"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
            >
              {actionType === "approved" ? "Approve" : "Reject"} Update
            </h3>

            <div className="mb-4">
              <label
                className="block text-sm font-semibold mb-1"
                style={{ color: "#131C15", opacity: 0.7 }}
              >
                Remarks (optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#09E0F7]"
                style={{
                  border: "1px solid rgba(19,28,21,0.15)",
                  backgroundColor: "#F4F5F7",
                  color: "#131C15",
                }}
                placeholder={
                  actionType === "approved"
                    ? "e.g. Good work, verified on site..."
                    : "e.g. Insufficient evidence, please resubmit..."
                }
              />
            </div>

            {actionType === "approved" && (
              <label className="flex items-center gap-2 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#09E0F7]"
                />
                <span className="text-sm" style={{ color: "#131C15" }}>
                  Publish to Transparency Dashboard
                </span>
              </label>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setActionId(null);
                  setActionType(null);
                }}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all"
                style={{
                  border: "1px solid rgba(19,28,21,0.15)",
                  color: "#131C15",
                  backgroundColor: "#fff",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all hover:shadow-md disabled:opacity-60"
                style={{
                  backgroundColor: actionType === "approved" ? "#10B981" : "#EF4444",
                  color: "#fff",
                }}
              >
                {submitting
                  ? "Processing..."
                  : actionType === "approved"
                    ? "Confirm Approve"
                    : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {modalImage && <ImageModal src={modalImage} onClose={() => setModalImage(null)} />}
    </div>
  );
}

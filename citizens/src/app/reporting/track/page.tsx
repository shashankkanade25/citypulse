"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type IssueRow = {
  _id: string;
  title?: string;
  category?: string;
  status?: string;
  priority?: string;
  department?: string;
  location?: { address?: string };
  createdAt?: string;
};

export default function TrackPage() {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "progress" | "resolved">("all");
  const [reports, setReports] = useState<IssueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/issues?limit=50");
      const json: unknown = await res.json().catch(() => null);
      const payload =
        json && typeof json === "object"
          ? (json as { success?: boolean; data?: IssueRow[]; error?: string })
          : null;

      if (!res.ok || !payload?.success) {
        setError(payload?.error || "Failed to load reports");
        return;
      }
      setReports(Array.isArray(payload.data) ? payload.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const normalizeStatus = (status?: string): "pending" | "in_progress" | "resolved" | "rejected" | "unknown" => {
    const s = status?.toLowerCase();
    if (!s) return "unknown";
    if (s === "pending" || s === "open") return "pending";
    if (s === "in_progress" || s === "in-progress" || s === "in progress") return "in_progress";
    if (s === "resolved") return "resolved";
    if (s === "rejected") return "rejected";
    return "unknown";
  };

  const getStatusColor = (status: string) => {
    switch (normalizeStatus(status)) {
      case "resolved":
        return "#10B981";
      case "in_progress":
        return "#09E0F7";
      case "pending":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getPriorityColor = (priority: string) => {
    const p = priority?.toLowerCase();
    if (p === "critical" || p === "emergency") return "#EF4444";
    if (p === "high") return "#F59E0B";
    if (p === "medium") return "#09E0F7";
    return "#6B7280";
  };

  const getStatusLabel = (status: string) => {
    const s = normalizeStatus(status);
    if (s === "in_progress") return "In Progress";
    if (s === "pending") return "Pending";
    if (s === "resolved") return "Resolved";
    if (s === "rejected") return "Rejected";
    return "Unknown";
  };

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (activeTab === "all") return true;
      const s = normalizeStatus(report.status);
      if (activeTab === "pending") return s === "pending";
      if (activeTab === "progress") return s === "in_progress";
      if (activeTab === "resolved") return s === "resolved";
      return true;
    });
  }, [reports, activeTab]);

  const formatDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  };

  const tabs: Array<{ key: "all" | "pending" | "progress" | "resolved"; label: string }> = [
    { key: "all", label: "All Reports" },
    { key: "pending", label: "Pending" },
    { key: "progress", label: "In Progress" },
    { key: "resolved", label: "Resolved" },
  ];

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      roads: "Roads & Transportation",
      water: "Water Supply",
      electricity: "Electricity",
      streetlights: "Street Lights",
      drainage: "Drainage",
      waste: "Waste Management",
      other: "Other",
    };
    return map[cat?.toLowerCase()] || cat || "Other";
  };

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: '#F4F5F7' }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-3 lg:px-4">
          {/* Header */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1
                  className="text-4xl lg:text-5xl font-bold mb-4"
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                >
                  Track Your <span style={{ color: '#09E0F7' }}>Reports</span>
                </h1>
                <p className="text-lg" style={{ color: '#131C15', opacity: 0.7 }}>
                  Monitor the status and progress of all submitted reports in real-time.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchReports}
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all border-2"
                  style={{ borderColor: '#131C15', color: '#131C15' }}
                >
                  🔄 Refresh
                </button>
                <Link
                  href="/reporting"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold transition-all border-2 whitespace-nowrap"
                  style={{ borderColor: '#09E0F7', color: '#09E0F7' }}
                >
                  <span className="text-xl">+</span>
                  New Report
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div
                className="text-3xl lg:text-4xl font-bold mb-2"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
              >
                {reports.length}
              </div>
              <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>Total Reports</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div
                className="text-3xl lg:text-4xl font-bold mb-2"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#F59E0B' }}
              >
                {reports.filter((r) => normalizeStatus(r.status) === "pending").length}
              </div>
              <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>Pending</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div
                className="text-3xl lg:text-4xl font-bold mb-2"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
              >
                {reports.filter((r) => normalizeStatus(r.status) === "in_progress").length}
              </div>
              <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>In Progress</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div
                className="text-3xl lg:text-4xl font-bold mb-2"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#10B981' }}
              >
                {reports.filter((r) => normalizeStatus(r.status) === "resolved").length}
              </div>
              <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>Resolved</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-6 shadow-sm mb-6">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap"
                  style={{
                    backgroundColor: activeTab === tab.key ? '#09E0F7' : 'transparent',
                    color: activeTab === tab.key ? '#FFFFFF' : '#131C15',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <p className="text-lg" style={{ color: '#131C15', opacity: 0.7 }}>
                Loading reports from database...
              </p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-4xl mb-4">⚠️</div>
              <h3
                className="text-2xl font-bold mb-3"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                Connection Error
              </h3>
              <p className="mb-6" style={{ color: '#131C15', opacity: 0.7 }}>
                {error}
              </p>
              <button
                onClick={fetchReports}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all"
                style={{ backgroundColor: '#09E0F7', color: '#FFFFFF' }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Reports List */}
          {!isLoading && !error && (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report._id}
                  className="bg-white rounded-2xl px-5 lg:px-6 py-5 shadow-sm hover:shadow-md transition-all border"
                  style={{ borderColor: "rgba(19, 28, 21, 0.08)" }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Main */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: getStatusColor(report.status ?? ""), color: "#FFFFFF" }}
                        >
                          {getStatusLabel(report.status ?? "")}
                        </span>
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: getPriorityColor(report.priority ?? ""), color: "#FFFFFF" }}
                        >
                          {(report.priority || "Medium").toLowerCase()}
                        </span>
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold border"
                          style={{ borderColor: "rgba(19, 28, 21, 0.14)", color: "#131C15" }}
                        >
                          ID {report._id.slice(-8).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className="text-lg lg:text-xl font-bold leading-snug truncate"
                          title={report.title || "Untitled Report"}
                          style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
                        >
                          {report.title || "Untitled Report"}
                        </h3>
                        <div className="text-sm font-semibold whitespace-nowrap" style={{ color: "#131C15", opacity: 0.7 }}>
                          {formatDate(report.createdAt)}
                        </div>
                      </div>

                      <div className="mt-2 text-sm" style={{ color: "#131C15", opacity: 0.72 }}>
                        <span className="font-semibold">📍</span>{" "}
                        <span className="wrap-break-word">
                          {report.location?.address || "Location not specified"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl px-4 py-3 border" style={{ borderColor: "rgba(19, 28, 21, 0.10)" }}>
                          <div className="text-xs font-bold mb-1" style={{ color: "#131C15", opacity: 0.5 }}>
                            Category
                          </div>
                          <div className="text-sm font-semibold" style={{ color: "#131C15" }}>
                            {categoryLabel(report.category ?? "")}
                          </div>
                        </div>
                        <div className="rounded-xl px-4 py-3 border" style={{ borderColor: "rgba(19, 28, 21, 0.10)" }}>
                          <div className="text-xs font-bold mb-1" style={{ color: "#131C15", opacity: 0.5 }}>
                            Assigned To
                          </div>
                          <div className="text-sm font-semibold" style={{ color: "#131C15" }}>
                            {report.department || "Pending Assignment"}
                          </div>
                        </div>
                        <div className="rounded-xl px-4 py-3 border" style={{ borderColor: "rgba(19, 28, 21, 0.10)" }}>
                          <div className="text-xs font-bold mb-1" style={{ color: "#131C15", opacity: 0.5 }}>
                            Status
                          </div>
                          <div className="text-sm font-semibold" style={{ color: "#131C15" }}>
                            {getStatusLabel(report.status ?? "")}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex lg:flex-col gap-2 lg:w-48 shrink-0">
                      <button
                        className="flex-1 px-5 py-3 rounded-xl font-bold text-sm transition-all"
                        style={{ backgroundColor: "#09E0F7", color: "#FFFFFF" }}
                      >
                        View Details
                      </button>
                      <button
                        className="flex-1 px-5 py-3 rounded-xl font-bold text-sm transition-all border-2"
                        style={{ borderColor: "#131C15", color: "#131C15" }}
                      >
                        Updates
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredReports.length === 0 && (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-6xl mb-4">📋</div>
              <h3
                className="text-2xl font-bold mb-3"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                No Reports Found
              </h3>
              <p className="mb-6" style={{ color: '#131C15', opacity: 0.7 }}>
                {activeTab === "all"
                  ? "No reports have been submitted yet. Be the first to report an issue!"
                  : "There are no reports in this category yet."}
              </p>
              <Link
                href="/reporting"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all"
                style={{ backgroundColor: '#09E0F7', color: '#FFFFFF' }}
              >
                Submit Your First Report
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

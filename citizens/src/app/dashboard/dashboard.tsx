"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface ReportStats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rejected: number;
}

interface Report {
  _id: string;
  title: string;
  category: string;
  status: string;
  priority?: string;
  createdAt: string;
  location?: { address?: string };
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getStatusInfo(status: string) {
  const map: Record<string, { bg: string; text: string; label: string; dot: string }> = {
    pending: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Pending", dot: "#f59e0b" },
    in_progress: { bg: "rgba(9,224,247,0.1)", text: "#09E0F7", label: "In Progress", dot: "#09E0F7" },
    resolved: { bg: "rgba(34,197,94,0.1)", text: "#22c55e", label: "Resolved", dot: "#22c55e" },
    rejected: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", label: "Rejected", dot: "#ef4444" },
  };
  return map[status] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280", label: status, dot: "#6b7280" };
}

function getPriorityInfo(priority?: string) {
  const p = priority?.toLowerCase();
  if (p === "urgent" || p === "critical") return { label: "Critical", color: "#ef4444" };
  if (p === "high") return { label: "High", color: "#f59e0b" };
  if (p === "medium") return { label: "Medium", color: "#09E0F7" };
  return { label: "Low", color: "#6b7280" };
}

export default function CitizenDashboard() {
  const [stats, setStats] = useState<ReportStats>({ total: 0, pending: 0, inProgress: 0, resolved: 0, rejected: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const [userRes, reportsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/reports"),
      ]);
      const userData = await userRes.json().catch(() => null);
      if (userData?.success && userData.name) setUserName(userData.name);

      const json = await reportsRes.json().catch(() => ({ success: false, data: [] }));
      if (json.success && Array.isArray(json.data)) {
        const all = json.data as Report[];
        setAllReports(all);
        setReports(all.slice(0, 5));
        setStats({
          total: all.length,
          pending: all.filter((r) => r.status === "pending").length,
          inProgress: all.filter((r) => r.status === "in_progress").length,
          resolved: all.filter((r) => r.status === "resolved").length,
          rejected: all.filter((r) => r.status === "rejected").length,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Resolution rate
  const resolutionRate = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.resolved / stats.total) * 100);
  }, [stats]);

  // Activity over last 7 days
  const weeklyActivity = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short" });
      const count = allReports.filter((r) => r.createdAt?.slice(0, 10) === dateStr).length;
      days.push({ label: dayLabel, count });
    }
    return days;
  }, [allReports]);

  const maxWeekly = Math.max(...weeklyActivity.map((d) => d.count), 1);

  // Check for saved draft
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    try {
      const draft = localStorage.getItem("citypulse_report_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.title || parsed.description || parsed.location) {
          setHasDraft(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-10 gap-4">
          <div>
            <h1
              className="text-3xl lg:text-4xl font-bold mb-2"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
            >
              {userName ? `${greeting}, ${userName.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="text-base" style={{ color: "#131C15", opacity: 0.7 }}>
              Track your reported issues and view your activity overview.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "#131C15", opacity: 0.4 }}>
              Updated {timeAgo(lastRefreshed.toISOString())}
            </span>
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
              style={{ color: "#131C15" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Draft Banner */}
        {hasDraft && (
          <Link
            href="/reporting"
            className="flex items-center gap-4 bg-white rounded-2xl px-6 py-4 shadow-sm border border-amber-200 mb-6 hover:shadow-md transition-all"
            style={{ backgroundColor: "rgba(245,158,11,0.04)" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(245,158,11,0.12)" }}>
              <span className="text-lg">📝</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm" style={{ color: "#131C15" }}>You have an unsaved draft</div>
              <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>Your previous report was auto-saved. Click to continue editing.</div>
            </div>
            <svg className="w-5 h-5" style={{ color: "#f59e0b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="text-3xl lg:text-4xl font-bold mb-1" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>
              {loading ? <span className="inline-block w-12 h-9 rounded-lg bg-gray-100 animate-pulse" /> : stats.total}
            </div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#131C15", opacity: 0.5 }}>Total</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="text-3xl lg:text-4xl font-bold mb-1" style={{ fontFamily: "'Unbounded', sans-serif", color: "#f59e0b" }}>
              {loading ? <span className="inline-block w-12 h-9 rounded-lg bg-gray-100 animate-pulse" /> : stats.pending}
            </div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#131C15", opacity: 0.5 }}>Pending</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="text-3xl lg:text-4xl font-bold mb-1" style={{ fontFamily: "'Unbounded', sans-serif", color: "#3b82f6" }}>
              {loading ? <span className="inline-block w-12 h-9 rounded-lg bg-gray-100 animate-pulse" /> : stats.inProgress}
            </div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#131C15", opacity: 0.5 }}>In Progress</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="text-3xl lg:text-4xl font-bold mb-1" style={{ fontFamily: "'Unbounded', sans-serif", color: "#22c55e" }}>
              {loading ? <span className="inline-block w-12 h-9 rounded-lg bg-gray-100 animate-pulse" /> : stats.resolved}
            </div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#131C15", opacity: 0.5 }}>Resolved</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
            <div className="text-3xl lg:text-4xl font-bold mb-1" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>
              {loading ? <span className="inline-block w-12 h-9 rounded-lg bg-gray-100 animate-pulse" /> : `${resolutionRate}%`}
            </div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#131C15", opacity: 0.5 }}>Resolved Rate</div>
          </div>
        </div>

        {/* Middle Row: Activity Chart + Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Weekly Activity Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                Weekly Activity
              </h2>
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(9,224,247,0.1)", color: "#09E0F7" }}>
                Last 7 days
              </span>
            </div>
            {loading ? (
              <div className="flex items-end gap-3 h-40">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex-1 bg-gray-100 rounded-lg animate-pulse" style={{ height: `${30 + Math.random() * 70}%` }} />
                ))}
              </div>
            ) : (
              <div className="flex items-end gap-3 h-40">
                {weeklyActivity.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: "#131C15", opacity: 0.5 }}>{day.count}</span>
                    <div
                      className="w-full rounded-lg transition-all duration-500"
                      style={{
                        height: `${Math.max((day.count / maxWeekly) * 100, 8)}%`,
                        backgroundColor: day.count > 0 ? "#09E0F7" : "rgba(9,224,247,0.15)",
                        minHeight: "8px",
                      }}
                    />
                    <span className="text-xs font-semibold" style={{ color: "#131C15", opacity: 0.5 }}>{day.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-5" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Quick Actions
            </h2>
            <div className="flex flex-col gap-3">
              <Link
                href="/reporting"
                className="flex items-center gap-3 p-4 rounded-xl hover:shadow-md transition-all group"
                style={{ backgroundColor: "rgba(9,224,247,0.06)", border: "1px solid rgba(9,224,247,0.15)" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform" style={{ backgroundColor: "#09E0F7" }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: "#131C15" }}>New Report</div>
                  <div className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>Submit an issue</div>
                </div>
              </Link>
              <Link
                href="/reporting/track"
                className="flex items-center gap-3 p-4 rounded-xl hover:shadow-md transition-all group"
                style={{ backgroundColor: "rgba(19,28,21,0.03)", border: "1px solid rgba(19,28,21,0.08)" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform" style={{ backgroundColor: "#131C15" }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: "#131C15" }}>Track Reports</div>
                  <div className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>View all submissions</div>
                </div>
              </Link>
              <Link
                href="/reporting/transparency"
                className="flex items-center gap-3 p-4 rounded-xl hover:shadow-md transition-all group"
                style={{ backgroundColor: "rgba(9,224,247,0.06)", border: "1px solid rgba(9,224,247,0.15)" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform" style={{ backgroundColor: "#09E0F7" }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: "#131C15" }}>Transparency</div>
                  <div className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>City-wide view</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Recent Reports
            </h2>
            <Link
              href="/reporting/track"
              className="text-sm font-semibold hover:underline"
              style={{ color: "#09E0F7" }}
            >
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-20 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-5xl mb-4">📋</div>
              <div className="font-bold text-lg mb-2" style={{ color: "#131C15" }}>No reports yet</div>
              <div style={{ color: "#131C15", opacity: 0.6 }} className="mb-5 text-sm">
                You haven&apos;t submitted any reports. Start making your city better!
              </div>
              <Link
                href="/reporting"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
                style={{ backgroundColor: "#09E0F7", color: "#fff" }}
              >
                Report an Issue
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map((report) => {
                const si = getStatusInfo(report.status);
                const pi = getPriorityInfo(report.priority);
                return (
                  <div key={report._id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Status dot */}
                      <div className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: si.dot }} />
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-base truncate" style={{ color: "#131C15" }}>
                            {report.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "#131C15", opacity: 0.5 }}>
                          <span className="capitalize">{report.category}</span>
                          {report.location?.address && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[200px]">{report.location.address}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{timeAgo(report.createdAt)}</span>
                        </div>
                      </div>
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: si.bg, color: si.text }}
                        >
                          {si.label}
                        </span>
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-bold hidden sm:inline-block"
                          style={{ backgroundColor: `${pi.color}15`, color: pi.color }}
                        >
                          {pi.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
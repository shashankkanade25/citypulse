"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface DepartmentStats {
  name: string;
  total: number;
  resolved: number;
  pending: number;
  inProgress: number;
}

interface RecentResolution {
  title: string;
  department: string;
  time: string;
}

interface StatsData {
  departments: DepartmentStats[];
  totals: {
    total: number;
    resolved: number;
    pending: number;
    inProgress: number;
  };
  recentResolutions: RecentResolution[];
}

type OngoingWork = {
  incidentCode: string;
  title: string;
  department: string;
  category: string | null;
  severity: string | null;
  status: string;
  reportCount: number | null;
  previewImage?: string | null;
  createdAt: string;
  updatedAt: string;
};

type RaisedIssue = OngoingWork;

function isValidIncidentCode(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  return lower !== 'undefined' && lower !== 'null';
}

export default function TransparencyPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ongoing, setOngoing] = useState<OngoingWork[]>([]);
  const [isLoadingOngoing, setIsLoadingOngoing] = useState(false);
  const [raised, setRaised] = useState<RaisedIssue[]>([]);
  const [isLoadingRaised, setIsLoadingRaised] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchOngoing();
    fetchRaised();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/reports/stats");
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to load statistics");
      }
    } catch {
      setError("Failed to connect to database");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOngoing = async () => {
    try {
      setIsLoadingOngoing(true);
      const res = await fetch('/api/transparency/ongoing', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success) {
        setOngoing((json.data?.works ?? []) as OngoingWork[]);
      }
    } finally {
      setIsLoadingOngoing(false);
    }
  };

  const fetchRaised = async () => {
    try {
      setIsLoadingRaised(true);
      const res = await fetch('/api/transparency/issues', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success) {
        setRaised((json.data?.issues ?? []) as RaisedIssue[]);
      }
    } finally {
      setIsLoadingRaised(false);
    }
  };

  const calculatePercentage = (resolved: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((resolved / total) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4F5F7' }}>
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">📊</div>
          <p className="text-lg" style={{ color: '#131C15', opacity: 0.7 }}>
            Loading transparency data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4F5F7' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-2xl font-bold mb-3" style={{ color: '#131C15' }}>
            Connection Error
          </h3>
          <p className="mb-6" style={{ color: '#131C15', opacity: 0.7 }}>{error}</p>
          <button
            onClick={fetchStats}
            className="px-8 py-4 rounded-xl font-bold"
            style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const departments = data?.departments || [];
  const totals = data?.totals || { total: 0, resolved: 0, pending: 0, inProgress: 0 };
  const recentResolutions = data?.recentResolutions || [];

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
                  Transparency <span style={{ color: '#09E0F7' }}>Dashboard</span>
                </h1>
                <p className="text-lg" style={{ color: '#131C15', opacity: 0.7 }}>
                  Real-time performance metrics and accountability data for all city departments.
                </p>
              </div>
              <button
                onClick={fetchStats}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all border-2"
                style={{ borderColor: '#131C15', color: '#131C15' }}
              >
                🔄 Refresh Data
              </button>
            </div>
          </div>

          {/* Ongoing Works */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <h2
                className="text-3xl font-bold"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                Ongoing <span style={{ color: '#09E0F7' }}>Works</span>
              </h2>
              <button
                onClick={fetchOngoing}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all border-2"
                style={{ borderColor: '#131C15', color: '#131C15' }}
              >
                🔄 Refresh
              </button>
            </div>

            {isLoadingOngoing ? (
              <div className="text-sm" style={{ color: '#131C15', opacity: 0.7 }}>Loading ongoing works...</div>
            ) : ongoing.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-4">✅</div>
                <p style={{ color: '#131C15', opacity: 0.7 }}>
                  No ongoing works right now.
                </p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {ongoing.filter((w) => isValidIncidentCode(w.incidentCode)).map((w) => (
                  <Link
                    key={w.incidentCode}
                    href={`/reporting/transparency/${encodeURIComponent(w.incidentCode)}`}
                    className="block rounded-2xl border p-5 hover:shadow-sm transition-all"
                    style={{ borderColor: 'rgba(9, 224, 247, 0.25)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono font-bold" style={{ color: '#09E0F7' }}>{w.incidentCode}</div>
                        <div className="text-lg font-bold mt-1" style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}>
                          {w.title}
                        </div>
                        <div className="text-sm mt-1" style={{ color: '#131C15', opacity: 0.7 }}>
                          {w.department}
                          {typeof w.reportCount === 'number' && w.reportCount > 1 ? ` • ${w.reportCount} reports` : ''}
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        {w.previewImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={w.previewImage}
                            alt="Citizen report"
                            className="h-14 w-14 rounded-xl object-cover border"
                            style={{ borderColor: 'rgba(9, 224, 247, 0.25)' }}
                          />
                        ) : null}
                        <div className="text-xs font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: '#F4F5F7', color: '#131C15' }}>
                          {w.status}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {w.severity ? (
                        <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: 'rgba(9, 224, 247, 0.15)', color: '#131C15' }}>
                          Severity: {w.severity}
                        </span>
                      ) : null}
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: '#F4F5F7', color: '#131C15' }}>
                        Updated: {new Date(w.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Issues Raised */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <h2
                className="text-3xl font-bold"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                Issues <span style={{ color: '#09E0F7' }}>Raised</span>
              </h2>
              <button
                onClick={fetchRaised}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all border-2"
                style={{ borderColor: '#131C15', color: '#131C15' }}
              >
                🔄 Refresh
              </button>
            </div>

            {isLoadingRaised ? (
              <div className="text-sm" style={{ color: '#131C15', opacity: 0.7 }}>Loading issues...</div>
            ) : raised.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-4">🧾</div>
                <p style={{ color: '#131C15', opacity: 0.7 }}>
                  No issues found.
                </p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {raised.filter((w) => isValidIncidentCode(w.incidentCode)).map((w) => (
                  <Link
                    key={w.incidentCode}
                    href={`/reporting/transparency/${encodeURIComponent(w.incidentCode)}`}
                    className="block rounded-2xl border p-5 hover:shadow-sm transition-all"
                    style={{ borderColor: 'rgba(9, 224, 247, 0.25)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono font-bold" style={{ color: '#09E0F7' }}>{w.incidentCode}</div>
                        <div className="text-lg font-bold mt-1" style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}>
                          {w.title}
                        </div>
                        <div className="text-sm mt-1" style={{ color: '#131C15', opacity: 0.7 }}>
                          {w.department}
                          {typeof w.reportCount === 'number' && w.reportCount > 1 ? ` • ${w.reportCount} reports` : ''}
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        {w.previewImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={w.previewImage}
                            alt="Citizen report"
                            className="h-14 w-14 rounded-xl object-cover border"
                            style={{ borderColor: 'rgba(9, 224, 247, 0.25)' }}
                          />
                        ) : null}
                        <div className="text-xs font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: '#F4F5F7', color: '#131C15' }}>
                          {w.status}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {w.severity ? (
                        <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: 'rgba(9, 224, 247, 0.15)', color: '#131C15' }}>
                          Severity: {w.severity}
                        </span>
                      ) : null}
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: '#F4F5F7', color: '#131C15' }}>
                        Raised: {new Date(w.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* City-Wide Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div
              className="rounded-3xl px-6 py-8"
              style={{ background: 'linear-gradient(135deg, #09E0F7 0%, #0BC5E0 100%)' }}
            >
              <div
                className="text-4xl lg:text-5xl font-bold mb-2 text-white"
                style={{ fontFamily: "'Unbounded', sans-serif" }}
              >
                {totals.total}
              </div>
              <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>Total Issues Reported</div>
            </div>
            <div
              className="rounded-3xl px-6 py-8"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              <div
                className="text-4xl lg:text-5xl font-bold mb-2 text-white"
                style={{ fontFamily: "'Unbounded', sans-serif" }}
              >
                {totals.resolved}
              </div>
              <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>Successfully Resolved</div>
            </div>
            <div
              className="rounded-3xl px-6 py-8"
              style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
            >
              <div
                className="text-4xl lg:text-5xl font-bold mb-2 text-white"
                style={{ fontFamily: "'Unbounded', sans-serif" }}
              >
                {totals.pending}
              </div>
              <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>Currently Pending</div>
            </div>
            <div
              className="rounded-3xl px-6 py-8"
              style={{ background: 'linear-gradient(135deg, #131C15 0%, #1F2937 100%)' }}
            >
              <div
                className="text-4xl lg:text-5xl font-bold mb-2 text-white"
                style={{ fontFamily: "'Unbounded', sans-serif" }}
              >
                {totals.inProgress}
              </div>
              <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>In Progress</div>
            </div>
          </div>

          {/* Department Performance */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm mb-6">
            <h2
              className="text-3xl font-bold mb-8"
              style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
            >
              Department Performance
            </h2>

            {departments.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📊</div>
                <p style={{ color: '#131C15', opacity: 0.7 }}>
                  No department data available. Reports will appear here once issues are submitted.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {departments.map((dept) => {
                  const percentage = calculatePercentage(dept.resolved, dept.total);
                  return (
                    <div key={dept.name}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3
                            className="text-lg font-bold"
                            style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                          >
                            {dept.name}
                          </h3>
                          <p className="text-sm" style={{ color: '#131C15', opacity: 0.6 }}>
                            {dept.resolved} resolved of {dept.total} total
                          </p>
                        </div>
                        <div
                          className="text-2xl font-bold"
                          style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                        >
                          {percentage}%
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#F4F5F7' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: percentage >= 85 ? '#10B981' : percentage >= 70 ? '#09E0F7' : '#F59E0B'
                          }}
                        />
                      </div>

                      {/* Stats Row */}
                      <div className="flex gap-6 mt-3 text-sm">
                        <div>
                          <span style={{ color: '#131C15', opacity: 0.6 }}>Resolved: </span>
                          <span className="font-bold" style={{ color: '#10B981' }}>{dept.resolved}</span>
                        </div>
                        <div>
                          <span style={{ color: '#131C15', opacity: 0.6 }}>In Progress: </span>
                          <span className="font-bold" style={{ color: '#09E0F7' }}>{dept.inProgress}</span>
                        </div>
                        <div>
                          <span style={{ color: '#131C15', opacity: 0.6 }}>Pending: </span>
                          <span className="font-bold" style={{ color: '#F59E0B' }}>{dept.pending}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Resolutions */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 shadow-sm">
            <h2
              className="text-2xl font-bold mb-6"
              style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
            >
              Recent <span style={{ color: '#09E0F7' }}>Resolutions</span>
            </h2>
            {recentResolutions.length === 0 ? (
              <p className="text-center py-4" style={{ color: '#131C15', opacity: 0.7 }}>
                No resolved issues yet.
              </p>
            ) : (
              <div className="space-y-4">
                {recentResolutions.map((resolution, idx) => (
                  <div
                    key={idx}
                    className="border-l-4 pl-4 py-2"
                    style={{ borderColor: '#09E0F7' }}
                  >
                    <h3 className="font-bold mb-1" style={{ color: '#131C15' }}>
                      {resolution.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm" style={{ color: '#131C15', opacity: 0.6 }}>
                      <span>{resolution.department}</span>
                      <span>•</span>
                      <span>{resolution.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <div
            className="mt-6 rounded-3xl px-6 lg:px-8 py-12 text-center"
            style={{ backgroundColor: '#131C15' }}
          >
            <h2
              className="text-3xl lg:text-4xl font-bold mb-4 text-white"
              style={{ fontFamily: "'Unbounded', sans-serif" }}
            >
              Help Us Improve Your City
            </h2>
            <p className="text-lg mb-8 text-white" style={{ opacity: 0.8 }}>
              Your reports help us identify and resolve issues faster. Be part of the solution.
            </p>
            <Link
              href="/reporting"
              className="inline-flex items-center gap-2 px-10 py-5 rounded-xl font-bold text-lg transition-all shadow-lg"
              style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
            >
              Report an Issue
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

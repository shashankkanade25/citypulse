"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardData = {
  kpis: {
    totalIncidents: number;
    totalActive: number;
    highSeverity: number;
    slaBreached: number;
    resolvedToday: number;
    resolved: number;
    onHold: number;
  };
  trend: { day: string; count: number }[];
  statusDist: Record<string, number>;
  severityDist: Record<string, number>;
  zones: { zone: string; count: number }[];
  workerUtilization: number;
  totalWorkers: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/head/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
        <div className="text-lg font-semibold" style={{ color: "#131C15", opacity: 0.6 }}>Loading dashboard…</div>
      </div>
    );
  }

  const k = data?.kpis ?? { totalIncidents: 0, totalActive: 0, highSeverity: 0, slaBreached: 0, resolvedToday: 0, resolved: 0, onHold: 0 };
  const trend = data?.trend ?? [];
  const statusDist = data?.statusDist ?? {};
  const severityDist = data?.severityDist ?? {};
  const zones = data?.zones ?? [];
  const workerUtil = data?.workerUtilization ?? 0;
  const totalWorkers = data?.totalWorkers ?? 0;

  const trendMax = Math.max(1, ...trend.map((t) => t.count));
  const sevColors: Record<string, string> = { Critical: "#EF4444", High: "#F59E0B", Medium: "#09E0F7", Low: "#10B981" };
  const sevEntries = Object.entries(severityDist).sort((a, b) => b[1] - a[1]);
  const sevTotal = Math.max(1, sevEntries.reduce((a, [, c]) => a + c, 0));
  const statColors: Record<string, string> = { Active: "#09E0F7", Resolved: "#10B981", "On Hold": "#F59E0B" };
  const statEntries = Object.entries(statusDist);
  const statTotal = Math.max(1, statEntries.reduce((a, [, c]) => a + c, 0));

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _unused = null;

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Department <span style={{ color: "#09E0F7" }}>Overview</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Real-time department health and incident management dashboard
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Active Incidents", value: k.totalActive, color: "#09E0F7", icon: "📊" },
              { label: "High / Critical", value: k.highSeverity, color: "#EF4444", icon: "🚨" },
              { label: "SLA Breached", value: k.slaBreached, color: "#F59E0B", icon: "⚠️" },
              { label: "Resolved Today", value: k.resolvedToday, color: "#10B981", icon: "✅" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-3xl px-6 py-8 shadow-sm">
                <div className="text-4xl mb-4">{c.icon}</div>
                <div className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: c.color }}>
                  {c.value}
                </div>
                <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Trend + Status */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>Incident Trend</h2>
              <p className="text-sm mb-6" style={{ color: "#131C15", opacity: 0.6 }}>Daily counts — last 7 days</p>
              <div className="flex items-end gap-3 h-48">
                {trend.map((t) => (
                  <div key={t.day} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs font-bold" style={{ color: "#131C15" }}>{t.count}</div>
                    <div className="w-full rounded-xl" style={{ height: `${Math.max(8, Math.round((t.count / trendMax) * 160))}px`, backgroundColor: "rgba(9,224,247,0.35)", border: "1px solid rgba(9,224,247,0.55)" }} />
                    <div className="text-xs font-bold" style={{ color: "#131C15", opacity: 0.7 }}>{t.day}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span style={{ color: "#131C15", opacity: 0.7 }}>Avg: {(trend.reduce((a, t) => a + t.count, 0) / Math.max(1, trend.length)).toFixed(1)} / day</span>
                <Link href="/analytics" className="font-semibold" style={{ color: "#09E0F7" }}>Full Analytics →</Link>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>By Status</h2>
              <div className="space-y-4">
                {statEntries.map(([label, count]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: "#131C15" }}>{label}</span>
                      <span className="text-sm font-bold" style={{ color: statColors[label] ?? "#131C15" }}>{count}</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                      <div className="h-full rounded-full" style={{ width: `${(count / statTotal) * 100}%`, backgroundColor: statColors[label] ?? "#6B7280" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <div className="text-4xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>{k.totalIncidents}</div>
                <div className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>Total incidents</div>
              </div>
            </div>
          </div>

          {/* Severity + Zone */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>Active by Severity</h2>
              <div className="space-y-4">
                {sevEntries.map(([label, count]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sevColors[label] ?? "#6B7280" }} />
                        <span className="text-sm font-semibold" style={{ color: "#131C15" }}>{label}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#131C15" }}>{count} ({Math.round((count / sevTotal) * 100)}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                      <div className="h-full rounded-full" style={{ width: `${(count / sevTotal) * 100}%`, backgroundColor: sevColors[label] ?? "#6B7280" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>Top Zones</h2>
              {zones.length === 0 ? (
                <p className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>No zone data yet.</p>
              ) : (
                <div className="space-y-4">
                  {zones.map((z, idx) => {
                    const zoneMax = Math.max(1, ...zones.map((zz) => zz.count));
                    return (
                      <div key={z.zone}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold" style={{ color: "#131C15" }}>{idx + 1}. {z.zone}</span>
                          <span className="text-sm font-bold" style={{ color: "#09E0F7" }}>{z.count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                          <div className="h-full rounded-full" style={{ width: `${(z.count / zoneMax) * 100}%`, backgroundColor: "#09E0F7" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Worker Util + Quick Summary */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-3xl p-8" style={{ background: "linear-gradient(to bottom right, rgba(9,224,247,0.1), rgba(9,224,247,0.2))" }}>
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>Worker Utilization</h3>
              <div className="flex items-end gap-3 mb-4">
                <div className="text-5xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>{workerUtil}%</div>
                <div className="text-sm pb-2" style={{ color: "#131C15", opacity: 0.7 }}>of {totalWorkers} workers</div>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.5)" }}>
                <div className="h-full transition-all" style={{ width: `${workerUtil}%`, backgroundColor: "#09E0F7" }} />
              </div>
              <Link href="/workers" className="inline-block mt-4 font-semibold text-sm" style={{ color: "#09E0F7" }}>Manage Workers →</Link>
            </div>

            <div className="rounded-3xl p-8 text-white" style={{ backgroundColor: "#131C15" }}>
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "'Unbounded', sans-serif" }}>Quick Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-3xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>{k.totalIncidents}</div><div className="text-xs mt-1" style={{ opacity: 0.7 }}>Total reported</div></div>
                <div><div className="text-3xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#10B981" }}>{k.resolved}</div><div className="text-xs mt-1" style={{ opacity: 0.7 }}>Resolved</div></div>
                <div><div className="text-3xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#F59E0B" }}>{k.onHold}</div><div className="text-xs mt-1" style={{ opacity: 0.7 }}>On Hold</div></div>
                <div><div className="text-3xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#EF4444" }}>{k.slaBreached}</div><div className="text-xs mt-1" style={{ opacity: 0.7 }}>SLA Breached</div></div>
              </div>
              <Link href="/sla" className="inline-block mt-4 font-semibold text-sm" style={{ color: "#09E0F7" }}>SLA Monitor →</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type AnalyticsData = {
  kpis: { total: number; resolved: number; resolutionRate: number; slaCompliance: number };
  zonePerf: { zone: string; total: number; resolved: number; efficiency: number }[];
  categories: { category: string; count: number; percentage: number }[];
  severityDist: Record<string, number>;
  hotspots: { zone: string; incidents: number }[];
  workerRanking: { _id: string; name: string; zone: string }[];
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/head/analytics", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
      <div className="text-xl font-bold animate-pulse" style={{ color: "#09E0F7" }}>Loading analytics...</div>
    </div>
  );

  const { kpis, zonePerf, categories, severityDist, hotspots, workerRanking } = data;
  const sevEntries = Object.entries(severityDist);
  const sevTotal = Math.max(1, sevEntries.reduce((a, [, c]) => a + c, 0));
  const sevColors: Record<string, string> = { Critical: "#EF4444", High: "#F59E0B", Medium: "#09E0F7", Low: "#10B981" };

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Performance <span style={{ color: "#09E0F7" }}>Analytics</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>Comprehensive department performance metrics and insights</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Total Incidents", value: kpis.total, gradient: "linear-gradient(135deg, #09E0F7 0%, #0BC5E0 100%)" },
              { label: "Resolved", value: kpis.resolved, gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)" },
              { label: "Resolution Rate", value: `${kpis.resolutionRate}%`, gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" },
              { label: "SLA Compliance", value: `${kpis.slaCompliance}%`, gradient: "linear-gradient(135deg, #131C15 0%, #1F2937 100%)" },
            ].map((m) => (
              <div key={m.label} className="rounded-3xl p-8" style={{ background: m.gradient }}>
                <div className="text-5xl font-bold mb-2 text-white" style={{ fontFamily: "'Unbounded', sans-serif" }}>{m.value}</div>
                <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>{m.label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Zone Performance */}
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>Zone Performance</h2>
              {zonePerf.length === 0 ? (
                <p className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>No zone data yet.</p>
              ) : (
                <div className="space-y-6">
                  {zonePerf.map((z) => (
                    <div key={z.zone}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold" style={{ color: "#131C15" }}>{z.zone}</h3>
                          <p className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>{z.resolved} / {z.total} resolved</p>
                        </div>
                        <div className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>{z.efficiency}%</div>
                      </div>
                      <div className="w-full h-3 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${z.efficiency}%`, backgroundColor: "#09E0F7" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Distribution */}
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>Incident by Category</h2>
              {categories.length === 0 ? (
                <p className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>No category data yet.</p>
              ) : (
                <div className="space-y-4">
                  {categories.map((cat) => (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold" style={{ color: "#131C15" }}>{cat.category ?? "Unknown"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: "#09E0F7" }}>{cat.count}</span>
                          <span className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>({cat.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, backgroundColor: "#09E0F7" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Severity Distribution */}
          <div className="bg-white rounded-3xl p-8 shadow-sm mb-8">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>Severity Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {sevEntries.map(([label, count]) => (
                <div key={label} className="text-center">
                  <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: (sevColors[label] ?? "#6B7280") + "20" }}>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: sevColors[label] ?? "#6B7280" }}>{count}</div>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: "#131C15" }}>{label}</div>
                  <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>{Math.round((count / sevTotal) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hotspots + Worker Ranking */}
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>📍 Top Hotspot Zones</h2>
              {hotspots.length === 0 ? (
                <p className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>No hotspot data.</p>
              ) : (
                <div className="space-y-4">
                  {hotspots.map((h, idx) => {
                    const max = Math.max(1, ...hotspots.map((hh) => hh.incidents));
                    return (
                      <div key={h.zone}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold" style={{ color: "#131C15" }}>{idx + 1}. {h.zone}</span>
                          <span className="text-sm font-bold" style={{ color: "#09E0F7" }}>{h.incidents}</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                          <div className="h-full rounded-full" style={{ width: `${(h.incidents / max) * 100}%`, backgroundColor: "#09E0F7" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>👷 Worker Directory</h2>
              {workerRanking.length === 0 ? (
                <p className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>No workers found.</p>
              ) : (
                <div className="space-y-4">
                  {workerRanking.map((w, idx) => (
                    <div key={w._id} className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: idx === 0 ? "rgba(9,224,247,0.1)" : "#F4F5F7" }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: idx === 0 ? "#09E0F7" : "#6B7280" }}>{idx + 1}</div>
                      <div className="flex-1">
                        <h3 className="font-bold" style={{ color: "#131C15" }}>{w.name}</h3>
                        <p className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>Zone: {w.zone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

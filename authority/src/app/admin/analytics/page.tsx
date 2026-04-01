"use client";

import { useEffect, useState } from "react";

type TopCategory = { category: string; count: number };
type ZoneAnalytics = { zone: string; total: number; topCategories: TopCategory[] };

const CATEGORY_ICONS: Record<string, string> = {
  Water: "💧",
  Sanitation: "🚮",
  Roads: "🛣️",
  Electricity: "⚡",
  Drainage: "🌊",
  Traffic: "🚦",
  Garbage: "🗑️",
  Streetlight: "💡",
  Other: "📋",
};

const CATEGORY_COLORS: Record<string, string> = {
  Water: "#3B82F6",
  Sanitation: "#10B981",
  Roads: "#F59E0B",
  Electricity: "#8B5CF6",
  Drainage: "#06B6D4",
  Traffic: "#EF4444",
  Garbage: "#84CC16",
  Streetlight: "#F97316",
  Other: "#6B7280",
};

export default function AnalyticsPage() {
  const [zones, setZones] = useState<ZoneAnalytics[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [totalReports, setTotalReports] = useState<number | null>(null);
  const [zonesTracked, setZonesTracked] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      const json = (await res.json()) as {
        generatedAt?: string;
        zones?: ZoneAnalytics[];
        totalReports?: number;
        zonesTracked?: number;
      };
      if (!cancelled) {
        setZones(json.zones ?? []);
        setGeneratedAt(typeof json.generatedAt === "string" ? json.generatedAt : null);
        setTotalReports(typeof json.totalReports === "number" ? json.totalReports : null);
        setZonesTracked(typeof json.zonesTracked === "number" ? json.zonesTracked : null);
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate summary stats
  const computedTotalReports = zones.reduce((sum, z) => sum + z.total, 0);
  const computedZonesTracked = zones.length;
  const effectiveTotalReports = totalReports ?? computedTotalReports;
  const effectiveZonesTracked = zonesTracked ?? computedZonesTracked;
  const topZone = zones.length > 0 ? zones[0] : null;
  const allCategories = zones.flatMap(z => z.topCategories);
  const categoryTotals = allCategories.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + c.count;
    return acc;
  }, {} as Record<string, number>);
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              System <span style={{ color: "#09E0F7" }}>Analytics</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Read-only trends and heatmaps. Admin cannot change incident status or outcomes.
            </p>
          </div>

          {/* Summary Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: "rgba(9, 224, 247, 0.1)" }}>
                  📊
                </div>
                <div className="text-sm font-bold" style={{ color: "#131C15", opacity: 0.6 }}>Total Reports</div>
              </div>
              <div className="text-4xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>
                {loading ? "—" : effectiveTotalReports}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}>
                  🔥
                </div>
                <div className="text-sm font-bold" style={{ color: "#131C15", opacity: 0.6 }}>Hottest Zone</div>
              </div>
              <div className="text-4xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#EF4444" }}>
                {loading || !topZone ? "—" : topZone.zone}
              </div>
              {topZone && <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>{topZone.total} reports</div>}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}>
                  🏆
                </div>
                <div className="text-sm font-bold" style={{ color: "#131C15", opacity: 0.6 }}>Top Category</div>
              </div>
              <div className="text-3xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#F59E0B" }}>
                {loading || !topCategory ? "—" : topCategory[0]}
              </div>
              {topCategory && <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>{topCategory[1]} reports</div>}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)" }}>
                  🗺️
                </div>
                <div className="text-sm font-bold" style={{ color: "#131C15", opacity: 0.6 }}>Zones Tracked</div>
              </div>
              <div className="text-4xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#10B981" }}>
                {loading ? "—" : effectiveZonesTracked}
              </div>
            </div>
          </div>

          {/* Hotspots Section */}
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                    🗺️ Hotspots by Zone
                  </h2>
                  <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                    Top zones by report volume, with category breakdown
                  </p>
                </div>
                {generatedAt && (
                  <div className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(9, 224, 247, 0.1)", color: "#131C15" }}>
                    Updated {new Date(generatedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            <div className="p-8">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-4xl mb-3 animate-pulse">📊</div>
                    <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Loading analytics...</div>
                  </div>
                </div>
              ) : zones.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-4xl mb-3">📭</div>
                    <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>No analytics data available</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {zones.map((z, index) => (
                    <div
                      key={z.zone}
                      className="rounded-2xl p-6 transition-all hover:shadow-md"
                      style={{
                        border: "1px solid rgba(19, 28, 21, 0.08)",
                        backgroundColor: index === 0 ? "rgba(239, 68, 68, 0.03)" : "rgba(9, 224, 247, 0.03)"
                      }}
                    >
                      <div className="flex items-start justify-between gap-6 mb-5">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold"
                            style={{
                              backgroundColor: index === 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(9, 224, 247, 0.1)",
                              color: index === 0 ? "#EF4444" : "#09E0F7"
                            }}
                          >
                            #{index + 1}
                          </div>
                          <div>
                            <div className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                              {z.zone}
                            </div>
                            {index === 0 && (
                              <div className="text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block" style={{ backgroundColor: "#EF4444", color: "white" }}>
                                🔥 HOTSPOT
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-4xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}>
                            {z.total}
                          </div>
                          <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.6 }}>total reports</div>
                        </div>
                      </div>

                      {/* Category Breakdown with Progress Bars */}
                      <div className="space-y-3">
                        <div className="text-sm font-bold mb-2" style={{ color: "#131C15", opacity: 0.8 }}>
                          Category Breakdown
                        </div>
                        {(z.topCategories ?? []).map((c) => {
                          const percentage = z.total > 0 ? (c.count / z.total) * 100 : 0;
                          const color = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other;
                          const icon = CATEGORY_ICONS[c.category] || CATEGORY_ICONS.Other;

                          return (
                            <div key={`${z.zone}-${c.category}`} className="group">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{icon}</span>
                                  <span className="text-sm font-semibold" style={{ color: "#131C15" }}>{c.category}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold" style={{ color }}>{c.count}</span>
                                  <span className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>({percentage.toFixed(0)}%)</span>
                                </div>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(19, 28, 21, 0.08)" }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%`, backgroundColor: color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {(!z.topCategories || z.topCategories.length === 0) && (
                          <div className="text-sm" style={{ color: "#131C15", opacity: 0.5 }}>
                            No category breakdown available
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs mt-8 pt-4 border-t flex items-center gap-2" style={{ borderColor: "rgba(19, 28, 21, 0.08)", color: "#131C15", opacity: 0.5 }}>
                <span>📈</span>
                <span>Derived from incident reports. {generatedAt ? `Last updated: ${new Date(generatedAt).toLocaleString()}` : ""}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

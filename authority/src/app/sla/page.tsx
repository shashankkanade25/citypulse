"use client";

import { useEffect, useState, useCallback } from "react";

type SLAItem = {
  _id: string;
  incidentId: string;
  title: string;
  severity: string;
  zone: string;
  department: string;
  status: string;
  assignedTo: string[];
  createdAt: string;
  deadline: string;
  slaHours: number;
  breached: boolean;
  slaStatus: "breached" | "at-risk" | "on-track";
  timeRemaining: string;
  urgencyScore: number;
  progressPercent: number;
};

type SLAStats = { breached: number; atRisk: number; onTrack: number; total: number };
type SLARules = Record<string, number>;
type FilterTab = "all" | "breached" | "at-risk" | "on-track";

export default function SLAMonitorPage() {
  const [items, setItems] = useState<SLAItem[]>([]);
  const [stats, setStats] = useState<SLAStats>({ breached: 0, atRisk: 0, onTrack: 0, total: 0 });
  const [slaRules, setSlaRules] = useState<SLARules>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchSLA = useCallback(() => {
    fetch("/api/head/sla", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setStats(d.stats ?? { breached: 0, atRisk: 0, onTrack: 0, total: 0 });
        setSlaRules(d.slaRules ?? {});
        setLastRefresh(new Date());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSLA();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchSLA, 60000);
    return () => clearInterval(interval);
  }, [fetchSLA]);

  const sevColor: Record<string, string> = { Critical: "#EF4444", High: "#F59E0B", Medium: "#09E0F7", Low: "#10B981" };
  const slaStatusColor: Record<string, string> = { breached: "#EF4444", "at-risk": "#F59E0B", "on-track": "#09E0F7" };
  const slaStatusLabel: Record<string, string> = { breached: "BREACHED", "at-risk": "AT RISK", "on-track": "ON TRACK" };

  const filteredItems = activeTab === "all" ? items : items.filter((i) => i.slaStatus === activeTab);

  const breachRate = stats.total > 0 ? Math.round((stats.breached / stats.total) * 100) : 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
      <div className="text-xl font-bold animate-pulse" style={{ color: "#09E0F7" }}>Loading SLA data...</div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                SLA <span style={{ color: "#09E0F7" }}>Monitor</span>
              </h1>
              <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>Track and prevent SLA breaches with real-time monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: "#131C15", opacity: 0.4 }}>
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={fetchSLA}
                className="px-4 py-2 rounded-xl font-semibold text-sm transition-all hover:shadow-md"
                style={{ backgroundColor: "#09E0F7", color: "#131C15" }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div
              className="rounded-3xl p-8 cursor-pointer transition-all hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)", outline: activeTab === "breached" ? "3px solid #131C15" : "none" }}
              onClick={() => setActiveTab(activeTab === "breached" ? "all" : "breached")}
            >
              <div className="text-5xl font-bold mb-2 text-white" style={{ fontFamily: "'Unbounded', sans-serif" }}>{stats.breached}</div>
              <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>SLA Breached</div>
              <div className="text-xs text-white mt-2" style={{ opacity: 0.8 }}>⚠️ Immediate action required</div>
            </div>
            <div
              className="rounded-3xl p-8 cursor-pointer transition-all hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", outline: activeTab === "at-risk" ? "3px solid #131C15" : "none" }}
              onClick={() => setActiveTab(activeTab === "at-risk" ? "all" : "at-risk")}
            >
              <div className="text-5xl font-bold mb-2 text-white" style={{ fontFamily: "'Unbounded', sans-serif" }}>{stats.atRisk}</div>
              <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>At Risk (&lt; 24h)</div>
              <div className="text-xs text-white mt-2" style={{ opacity: 0.8 }}>⏰ Escalate soon</div>
            </div>
            <div
              className="rounded-3xl p-8 cursor-pointer transition-all hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #09E0F7 0%, #0BC5E0 100%)", outline: activeTab === "on-track" ? "3px solid #131C15" : "none" }}
              onClick={() => setActiveTab(activeTab === "on-track" ? "all" : "on-track")}
            >
              <div className="text-5xl font-bold mb-2 text-white" style={{ fontFamily: "'Unbounded', sans-serif" }}>{stats.onTrack}</div>
              <div className="text-sm font-semibold text-white" style={{ opacity: 0.9 }}>On Track</div>
              <div className="text-xs text-white mt-2" style={{ opacity: 0.8 }}>✓ Within SLA</div>
            </div>
          </div>

          {/* SLA Rules + Breakdown Row */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Breakdown Bar */}
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>SLA Breakdown</h2>
              {stats.total > 0 ? (
                <>
                  <div className="w-full h-6 flex rounded-full overflow-hidden mb-4">
                    {stats.breached > 0 && <div style={{ width: `${(stats.breached / stats.total) * 100}%`, backgroundColor: "#EF4444" }} />}
                    {stats.atRisk > 0 && <div style={{ width: `${(stats.atRisk / stats.total) * 100}%`, backgroundColor: "#F59E0B" }} />}
                    {stats.onTrack > 0 && <div style={{ width: `${(stats.onTrack / stats.total) * 100}%`, backgroundColor: "#09E0F7" }} />}
                  </div>
                  <div className="flex flex-wrap gap-6 text-sm mb-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#EF4444" }} /><span style={{ color: "#131C15" }}>Breached ({stats.breached})</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#F59E0B" }} /><span style={{ color: "#131C15" }}>At Risk ({stats.atRisk})</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#09E0F7" }} /><span style={{ color: "#131C15" }}>On Track ({stats.onTrack})</span></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{ color: "#131C15" }}>Breach Rate:</span>
                    <span className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: breachRate > 30 ? "#EF4444" : breachRate > 10 ? "#F59E0B" : "#10B981" }}>
                      {breachRate}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-sm" style={{ color: "#131C15", opacity: 0.5 }}>No active incidents to track</p>
                </div>
              )}
            </div>

            {/* SLA Rules Reference */}
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>SLA Deadlines by Severity</h2>
              <div className="space-y-3">
                {Object.entries(slaRules).length > 0
                  ? Object.entries(slaRules).map(([severity, hours]) => (
                      <div key={severity} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ backgroundColor: "#F4F5F7" }}>
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sevColor[severity] ?? "#6B7280" }} />
                          <span className="text-sm font-bold" style={{ color: "#131C15" }}>{severity}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: sevColor[severity] ?? "#6B7280" }}>
                            {hours}h
                          </span>
                          <span className="text-xs ml-1" style={{ color: "#131C15", opacity: 0.5 }}>({hours / 24}d)</span>
                        </div>
                      </div>
                    ))
                  : [
                      { sev: "Critical", h: 24 },
                      { sev: "High", h: 48 },
                      { sev: "Medium", h: 72 },
                      { sev: "Low", h: 120 },
                    ].map(({ sev, h }) => (
                      <div key={sev} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ backgroundColor: "#F4F5F7" }}>
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sevColor[sev] ?? "#6B7280" }} />
                          <span className="text-sm font-bold" style={{ color: "#131C15" }}>{sev}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: sevColor[sev] ?? "#6B7280" }}>
                          {h}h
                        </span>
                      </div>
                    ))}
              </div>
              <p className="text-xs mt-4" style={{ color: "#131C15", opacity: 0.4 }}>
                SLA clock starts at incident creation. Breached = past deadline. At Risk = &lt;24h remaining.
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-6">
            {(["all", "breached", "at-risk", "on-track"] as FilterTab[]).map((tab) => {
              const labels: Record<FilterTab, string> = { all: "All", breached: "Breached", "at-risk": "At Risk", "on-track": "On Track" };
              const counts: Record<FilterTab, number> = { all: stats.total, breached: stats.breached, "at-risk": stats.atRisk, "on-track": stats.onTrack };
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    backgroundColor: isActive ? (tab === "all" ? "#131C15" : slaStatusColor[tab] ?? "#131C15") : "#fff",
                    color: isActive ? "#fff" : "#131C15",
                    border: isActive ? "none" : "2px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {labels[tab]} ({counts[tab]})
                </button>
              );
            })}
          </div>

          {/* Incident SLA Cards */}
          {filteredItems.length > 0 ? (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
                  style={{ borderLeft: `4px solid ${slaStatusColor[item.slaStatus]}` }}
                >
                  <div className="grid lg:grid-cols-12 gap-4 items-center">
                    {/* Incident Info */}
                    <div className="lg:col-span-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold" style={{ color: "#09E0F7" }}>{item.incidentId}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: sevColor[item.severity] ?? "#6B7280" }}>{item.severity}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: slaStatusColor[item.slaStatus] }}>{slaStatusLabel[item.slaStatus]}</span>
                      </div>
                      <h3 className="text-base font-bold mb-1" style={{ color: "#131C15" }}>{item.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>📍 {item.zone}</span>
                        <span className="text-xs" style={{ color: "#131C15", opacity: 0.5 }}>🏢 {item.department}</span>
                      </div>
                    </div>

                    {/* SLA Progress */}
                    <div className="lg:col-span-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: "#131C15", opacity: 0.5 }}>SLA: {item.slaHours}h</span>
                        <span className="text-xs font-bold" style={{ color: slaStatusColor[item.slaStatus] }}>{item.progressPercent}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: "#F4F5F7" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, item.progressPercent)}%`,
                            backgroundColor: slaStatusColor[item.slaStatus],
                          }}
                        />
                      </div>
                      <p className="text-xs font-bold mt-1" style={{ color: slaStatusColor[item.slaStatus] }}>
                        {item.timeRemaining}
                      </p>
                    </div>

                    {/* Assigned Workers */}
                    <div className="lg:col-span-3">
                      {item.assignedTo?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.assignedTo.map((w) => (
                            <span key={w} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>
                              👷 {w}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
                          ⚠️ Unassigned
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="lg:col-span-2 flex flex-col gap-2">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-lg text-center text-white" style={{ backgroundColor: item.status === "Active" ? "#09E0F7" : item.status === "On Hold" ? "#F59E0B" : "#6B7280" }}>{item.status}</span>
                      <span className="text-xs text-center" style={{ color: "#131C15", opacity: 0.4 }}>
                        Deadline: {new Date(item.deadline).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-6xl mb-4">{activeTab === "all" ? "✅" : activeTab === "breached" ? "🎉" : "📊"}</div>
              <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                {activeTab === "all" ? "All Clear!" : activeTab === "breached" ? "No Breaches!" : `No ${activeTab === "at-risk" ? "At-Risk" : "On-Track"} Items`}
              </h3>
              <p style={{ color: "#131C15", opacity: 0.7 }}>
                {activeTab === "all"
                  ? "No active SLA items to track at the moment."
                  : activeTab === "breached"
                    ? "Great! No SLA deadlines have been breached."
                    : `No incidents in the ${activeTab === "at-risk" ? "at-risk" : "on-track"} category right now.`}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import UserDirectoryPanel from "@/components/admin/UserDirectoryPanel";

type DashboardPayload = {
  kpis: { totalReported: number; active: number; resolved: number; flagged: number };
  trend: { day: string; count: number }[];
  alerts: { title: string; detail: string; severity: "High" | "Medium" | "Low" }[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const json = (await res.json()) as DashboardPayload;
      if (!cancelled) {
        setData(json);
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

  const kpis = data?.kpis ?? { totalReported: 0, active: 0, resolved: 0, flagged: 0 };
  const trend = data?.trend ?? [];
  const alerts = data?.alerts ?? [];

  const max = Math.max(1, ...trend.map((t) => t.count));

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1
              className="text-4xl lg:text-5xl font-bold mb-2"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
            >
              System <span style={{ color: "#09E0F7" }}>Overview</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Read-only visibility. Admins protect integrity; they do not resolve incidents.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Total reported", value: kpis.totalReported },
              { label: "Active incidents", value: kpis.active },
              { label: "Resolved", value: kpis.resolved },
              { label: "Flagged / suspicious", value: kpis.flagged },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-6 shadow-sm">
                <div
                  className="text-4xl font-bold mb-2"
                  style={{ fontFamily: "'Unbounded', sans-serif", color: "#09E0F7" }}
                >
                  {card.value}
                </div>
                <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>
                  {card.label}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                  Incident trend
                </h2>
                <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                  Daily counts (last 7 days)
                </p>
              </div>
              <div className="p-8">
                {loading ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    Loading…
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-3 items-end h-56">
                    {trend.map((t) => (
                      <div key={t.day} className="flex flex-col items-center gap-2">
                        <div
                          className="w-full rounded-xl"
                          style={{
                            height: `${Math.max(8, Math.round((t.count / max) * 180))}px`,
                            backgroundColor: "rgba(9, 224, 247, 0.35)",
                            border: "1px solid rgba(9, 224, 247, 0.55)",
                          }}
                          title={`${t.count}`}
                        />
                        <div className="text-xs font-bold" style={{ color: "#131C15", opacity: 0.7 }}>
                          {t.day}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                  Alerts
                </h2>
                <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                  System integrity indicators
                </p>
              </div>
              <div className="p-6 space-y-4">
                {loading ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    Loading…
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    No alerts.
                  </div>
                ) : (
                  alerts.map((a) => (
                  <div
                    key={a.title}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "rgba(9, 224, 247, 0.08)", border: "1px solid rgba(9, 224, 247, 0.2)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold" style={{ color: "#131C15" }}>
                        {a.title}
                      </div>
                      <div
                        className="text-xs font-bold px-2 py-1 rounded"
                        style={{ backgroundColor: "#131C15", color: "#FFFFFF" }}
                      >
                        {a.severity}
                      </div>
                    </div>
                    <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.7 }}>
                      {a.detail}
                    </div>
                  </div>
                  ))
                )}
                <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
                  Read-only. Take actions only in Flagged / Abuse panels.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                Users
              </h2>
              <p className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>
                Quick directory view (Authority and Citizens)
              </p>
            </div>

            <UserDirectoryPanel embedded />
          </div>
        </div>
      </main>
    </div>
  );
}

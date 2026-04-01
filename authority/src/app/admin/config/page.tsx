"use client";

import { useEffect, useMemo, useState } from "react";

type ConfigState = {
  minMlConfidence: number;
  duplicateSensitivity: number;
  autoFlagReportCount30d: number;
};

export default function ConfigPage() {
  const defaults = useMemo<ConfigState>(
    () => ({
      minMlConfidence: 0.6,
      duplicateSensitivity: 0.7,
      autoFlagReportCount30d: 20,
    }),
    []
  );

  const [cfg, setCfg] = useState<ConfigState>(defaults);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/config", { cache: "no-store" });
      const json = (await res.json()) as { cfg: Record<string, unknown> };
      if (!cancelled) {
        const remote = json.cfg ?? {};
        setCfg({
          minMlConfidence: typeof remote["ml.confidenceThreshold"] === "number" ? (remote["ml.confidenceThreshold"] as number) : defaults.minMlConfidence,
          duplicateSensitivity:
            typeof remote["duplicateSensitivity"] === "number" ? (remote["duplicateSensitivity"] as number) : defaults.duplicateSensitivity,
          autoFlagReportCount30d:
            typeof remote["abuse.maxReportsPerDay"] === "number" ? (remote["abuse.maxReportsPerDay"] as number) : defaults.autoFlagReportCount30d,
        });
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [defaults]);

  async function save() {
    await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        remark: "Thresholds updated",
        cfg: {
          "ml.confidenceThreshold": cfg.minMlConfidence,
          duplicateSensitivity: cfg.duplicateSensitivity,
          "abuse.maxReportsPerDay": cfg.autoFlagReportCount30d,
        },
      }),
    });
    setSavedAt(new Date().toISOString());
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              System <span style={{ color: "#09E0F7" }}>Config</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Future-only thresholds. Changes never rewrite existing incidents. All edits are audited.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
              <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                Thresholds
              </h2>
              <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                Keep conservative values to avoid suppressing genuine reports.
              </p>
            </div>

            <div className="p-8 space-y-8">
              {loading ? (
                <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                  Loading…
                </div>
              ) : null}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold" style={{ color: "#131C15" }}>Minimum ML confidence</div>
                  <div className="text-sm font-bold" style={{ color: "#131C15" }}>{Math.round(cfg.minMlConfidence * 100)}%</div>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={0.95}
                  step={0.01}
                  value={cfg.minMlConfidence}
                  onChange={(e) => setCfg((p) => ({ ...p, minMlConfidence: Number(e.target.value) }))}
                  className="w-full mt-3"
                />
                <div className="text-xs mt-2" style={{ color: "#131C15", opacity: 0.6 }}>
                  Lower confidence reports may be routed to the Flagged panel.
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold" style={{ color: "#131C15" }}>Duplicate sensitivity</div>
                  <div className="text-sm font-bold" style={{ color: "#131C15" }}>{Math.round(cfg.duplicateSensitivity * 100)}%</div>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={0.95}
                  step={0.01}
                  value={cfg.duplicateSensitivity}
                  onChange={(e) => setCfg((p) => ({ ...p, duplicateSensitivity: Number(e.target.value) }))}
                  className="w-full mt-3"
                />
                <div className="text-xs mt-2" style={{ color: "#131C15", opacity: 0.6 }}>
                  Higher means stricter duplicate clustering.
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold" style={{ color: "#131C15" }}>Auto-flag citizen (reports in 30d)</div>
                  <div className="text-sm font-bold" style={{ color: "#131C15" }}>{cfg.autoFlagReportCount30d}</div>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={1}
                  value={cfg.autoFlagReportCount30d}
                  onChange={(e) => setCfg((p) => ({ ...p, autoFlagReportCount30d: Number(e.target.value) }))}
                  className="w-full mt-3"
                />
                <div className="text-xs mt-2" style={{ color: "#131C15", opacity: 0.6 }}>
                  If exceeded, moderation may flag the citizen account for review.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <button
                  type="button"
                  onClick={save}
                  className="px-5 py-3 rounded-2xl font-bold"
                  style={{ backgroundColor: "#131C15", color: "#FFFFFF" }}
                >
                  Save changes
                </button>
                <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
                  {savedAt ? `Saved at ${new Date(savedAt).toLocaleString()} (audited)` : "Not saved yet"}
                </div>
              </div>

              <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
                Config is optional; keep it minimal until policy is finalized.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

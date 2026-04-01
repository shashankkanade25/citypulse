"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type FlagReason = "Low confidence" | "Conflicting media" | "Duplicate cluster" | "User abuse";

type FlaggedIncident = {
  rowId: string;
  id: string;
  title: string;
  zone: string;
  department: string;
  confidence: number;
  reasons: FlagReason[];
  citizenId: string;
  citizenReportCount30d: number;
  duplicateClusterId?: string;
  description: string;
  speechToText: string;
  images: string[];
  createdAt?: string;
};

type ModerationAction = {
  ts: string;
  incidentId: string;
  action: "Approved" | "Rejected" | "Citizen flagged";
  remark: string;
};

export default function FlaggedPanelPage() {
  const [incidents, setIncidents] = useState<FlaggedIncident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [remark, setRemark] = useState<string>("");
  const [actions, setActions] = useState<ModerationAction[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/flagged", { cache: "no-store" });
      const json = (await res.json()) as { incidents: FlaggedIncident[] };
      if (!cancelled) {
        const list = json.incidents ?? [];
        setIncidents(list);
        setSelectedRowId((prev) => prev || list[0]?.rowId || "");
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

  const selected = incidents.find((i) => i.rowId === selectedRowId) ?? incidents[0];

  async function appendAction(action: ModerationAction["action"]) {
    if (!selected) return;
    const trimmed = remark.trim();
    const remarkToSend = trimmed.length > 0 ? trimmed : "(no remark)";

    await fetch("/api/admin/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId: selected.id, action, remark: remarkToSend }),
    });

    setActions((prev) => [
      {
        ts: new Date().toISOString(),
        incidentId: selected.id,
        action,
        remark: remarkToSend,
      },
      ...prev,
    ]);
    setRemark("");

    if (action === "Approved" || action === "Rejected") {
      setIncidents((prev) => {
        const next = prev.filter((i) => i.rowId !== selected.rowId);
        setSelectedRowId(next[0]?.rowId ?? "");
        return next;
      });
    }
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Flagged <span style={{ color: "#09E0F7" }}>Incidents</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              ML-flagged / suspicious reports. Moderation only. No silent deletion; all actions are audited.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b-2" style={{ borderColor: "#F4F5F7" }}>
                <div className="font-bold" style={{ color: "#131C15" }}>Queue</div>
                <div className="text-xs mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                  Select an incident to review
                </div>
              </div>
              <div className="p-4 space-y-3">
                {loading ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    Loading…
                  </div>
                ) : incidents.length === 0 ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    No flagged incidents.
                  </div>
                ) : (
                  incidents.map((i) => {
                  const active = i.rowId === selectedRowId;
                  return (
                    <button
                      key={i.rowId}
                      type="button"
                      onClick={() => setSelectedRowId(i.rowId)}
                      className="w-full text-left rounded-2xl p-4 transition-all"
                      style={{
                        border: active ? "2px solid #09E0F7" : "1px solid rgba(19, 28, 21, 0.12)",
                        backgroundColor: active ? "rgba(9, 224, 247, 0.08)" : "#FFFFFF",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-bold" style={{ color: "#131C15" }}>{i.id}</div>
                        <div className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#131C15", color: "#FFFFFF" }}>
                          {Math.round(i.confidence * 100)}%
                        </div>
                      </div>
                      <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.8 }}>{i.title}</div>
                      <div className="text-xs mt-2" style={{ color: "#131C15", opacity: 0.65 }}>
                        {i.zone} • {i.department}
                      </div>
                    </button>
                  );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                    Review
                  </h2>
                  <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                    Approve forwards to Authority Head. Reject stays logged forever.
                  </p>
                </div>
                {selected && (
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <div className="text-sm font-bold" style={{ color: "#131C15" }}>Citizen submission</div>
                        <div className="text-sm mt-2" style={{ color: "#131C15", opacity: 0.8 }}>{selected.description}</div>

                        <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: "rgba(9, 224, 247, 0.08)", border: "1px solid rgba(9, 224, 247, 0.2)" }}>
                          <div className="text-xs font-bold" style={{ color: "#131C15" }}>Speech-to-text</div>
                          <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.75 }}>{selected.speechToText}</div>
                        </div>

                        <div className="mt-6">
                          <div className="text-sm font-bold" style={{ color: "#131C15" }}>Images</div>
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            {selected.images.map((src) => (
                              <div key={src} className="relative rounded-2xl overflow-hidden aspect-video" style={{ border: "1px solid rgba(19, 28, 21, 0.12)" }}>
                                <Image src={src} alt="Citizen evidence" fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: "cover" }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="rounded-2xl p-5" style={{ border: "1px solid rgba(19, 28, 21, 0.12)" }}>
                          <div className="text-sm font-bold" style={{ color: "#131C15" }}>ML signals</div>
                          <div className="text-sm mt-2" style={{ color: "#131C15", opacity: 0.8 }}>
                            Confidence: <span className="font-bold">{Math.round(selected.confidence * 100)}%</span>
                          </div>
                          <div className="text-xs mt-3" style={{ color: "#131C15", opacity: 0.65 }}>
                            Reasons
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selected.reasons.map((r) => (
                              <span key={r} className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "rgba(9, 224, 247, 0.14)", color: "#131C15" }}>
                                {r}
                              </span>
                            ))}
                          </div>

                          {selected.duplicateClusterId && (
                            <div className="text-xs mt-4" style={{ color: "#131C15", opacity: 0.7 }}>
                              Duplicate cluster: <span className="font-bold">{selected.duplicateClusterId}</span>
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl p-5 mt-4" style={{ border: "1px solid rgba(19, 28, 21, 0.12)" }}>
                          <div className="text-sm font-bold" style={{ color: "#131C15" }}>Citizen summary</div>
                          <div className="text-sm mt-2" style={{ color: "#131C15", opacity: 0.8 }}>
                            ID: <span className="font-bold">{selected.citizenId}</span>
                          </div>
                          <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.8 }}>
                            Reports (30d): <span className="font-bold">{selected.citizenReportCount30d}</span>
                          </div>
                          <div className="text-xs mt-3" style={{ color: "#131C15", opacity: 0.65 }}>
                            Summary only. Admin cannot impersonate.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 rounded-3xl p-6" style={{ backgroundColor: "#F4F5F7" }}>
                      <div className="text-sm font-bold" style={{ color: "#131C15" }}>Moderation remarks</div>
                      <textarea
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        className="w-full mt-3 rounded-2xl p-4 outline-none"
                        style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(19, 28, 21, 0.12)", color: "#131C15" }}
                        rows={3}
                        placeholder="Add a remark (will be audited)"
                      />

                      <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => appendAction("Approved")}
                          className="px-5 py-3 rounded-2xl font-bold"
                          style={{ backgroundColor: "#131C15", color: "#FFFFFF" }}
                        >
                          Approve (forward)
                        </button>
                        <button
                          type="button"
                          onClick={() => appendAction("Rejected")}
                          className="px-5 py-3 rounded-2xl font-bold"
                          style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#131C15", border: "1px solid rgba(239, 68, 68, 0.35)" }}
                        >
                          Reject (logged)
                        </button>
                        <button
                          type="button"
                          onClick={() => appendAction("Citizen flagged")}
                          className="px-5 py-3 rounded-2xl font-bold"
                          style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#131C15", border: "1px solid rgba(245, 158, 11, 0.35)" }}
                        >
                          Flag citizen
                        </button>
                      </div>

                      <div className="text-xs mt-3" style={{ color: "#131C15", opacity: 0.65 }}>
                        Hard rules: no silent delete; rejected incidents remain; all actions audited.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                    Moderation log (local)
                  </h2>
                  <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                    UI-only demo. In production, these are append-only audit events.
                  </p>
                </div>
                <div className="p-6">
                  {actions.length === 0 ? (
                    <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                      No actions taken yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {actions.map((a) => (
                        <div key={`${a.ts}-${a.incidentId}-${a.action}`} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(9, 224, 247, 0.08)" }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-bold" style={{ color: "#131C15" }}>{a.action}</div>
                            <div className="text-xs" style={{ color: "#131C15", opacity: 0.65 }}>{new Date(a.ts).toLocaleString()}</div>
                          </div>
                          <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.8 }}>
                            {a.incidentId} • {a.remark}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type AbuseCase = {
  id: string;
  citizenId: string;
  reason: "Spam" | "Manipulated media" | "Repeated low-confidence" | "Harassment";
  risk: "Low" | "Medium" | "High";
  lastSeen: string;
  status: "Monitoring" | "Warned" | "Temporarily blocked";
  blockedUntil?: string;
};

type AbuseAction = {
  ts: string;
  caseId: string;
  action: "Warned" | "Blocked" | "Unblocked";
  note: string;
};

export default function AbuseManagementPage() {
  const [cases, setCases] = useState<AbuseCase[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<AbuseAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/abuse", { cache: "no-store" });
      const json = (await res.json()) as { cases: AbuseCase[] };
      if (!cancelled) {
        setCases(json.cases ?? []);
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

  function record(caseId: string, action: AbuseAction["action"], note: string) {
    setHistory((prev) => [{ ts: new Date().toISOString(), caseId, action, note }, ...prev]);
  }

  async function send(caseId: string, action: AbuseAction["action"], note: string) {
    const res = await fetch("/api/admin/abuse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, action, note }),
    });
    const json = (await res.json()) as { ok?: boolean; blockedUntil?: string | null; status?: AbuseCase["status"] };
    if (json.ok) {
      setCases((prev) =>
        prev.map((c) =>
          c.id !== caseId
            ? c
            : {
                ...c,
                status: (json.status ?? c.status) as AbuseCase["status"],
                blockedUntil: json.blockedUntil ? String(json.blockedUntil) : undefined,
              }
        )
      );
    }
  }

  function warn(caseId: string) {
    const note = (notes[caseId] ?? "").trim() || "(no note)";
    record(caseId, "Warned", note);
    void send(caseId, "Warned", note);
    setNotes((prev) => ({ ...prev, [caseId]: "" }));
  }

  function block(caseId: string) {
    const note = (notes[caseId] ?? "").trim() || "(no note)";
    record(caseId, "Blocked", `${note} | duration=7d`);
    void send(caseId, "Blocked", note);
    setNotes((prev) => ({ ...prev, [caseId]: "" }));
  }

  function unblock(caseId: string) {
    const note = (notes[caseId] ?? "").trim() || "(no note)";
    record(caseId, "Unblocked", note);
    void send(caseId, "Unblocked", note);
    setNotes((prev) => ({ ...prev, [caseId]: "" }));
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Abuse & <span style={{ color: "#09E0F7" }}>Misuse</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Issue warnings and temporary blocks only. Actions are logged; incident data remains immutable.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                  Cases
                </h2>
                <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                  Enforcement is limited and transparent.
                </p>
              </div>
              <div className="p-6 space-y-4">
                {loading ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    Loading…
                  </div>
                ) : cases.length === 0 ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    No abuse cases.
                  </div>
                ) : (
                  cases.map((c) => (
                  <div key={c.id} className="rounded-3xl p-5" style={{ border: "1px solid rgba(19, 28, 21, 0.12)" }}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="font-bold" style={{ color: "#131C15" }}>{c.id} • {c.citizenId}</div>
                        <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.75 }}>
                          {c.reason} • Risk: <span className="font-bold">{c.risk}</span>
                        </div>
                        <div className="text-xs mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                          Last seen: {new Date(c.lastSeen).toLocaleString()}
                          {c.blockedUntil ? ` • Blocked until: ${new Date(c.blockedUntil).toLocaleString()}` : ""}
                        </div>
                      </div>
                      <div className="text-sm font-bold" style={{ color: "#131C15" }}>{c.status}</div>
                    </div>

                    <textarea
                      value={notes[c.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="w-full mt-4 rounded-2xl p-4 outline-none"
                      style={{ backgroundColor: "#F4F5F7", border: "1px solid rgba(19, 28, 21, 0.12)", color: "#131C15" }}
                      rows={2}
                      placeholder="Add a note (audited)"
                    />

                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => warn(c.id)}
                        className="px-5 py-3 rounded-2xl font-bold"
                        style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#131C15", border: "1px solid rgba(245, 158, 11, 0.35)" }}
                      >
                        Warn
                      </button>
                      <button
                        type="button"
                        onClick={() => block(c.id)}
                        className="px-5 py-3 rounded-2xl font-bold"
                        style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#131C15", border: "1px solid rgba(239, 68, 68, 0.35)" }}
                      >
                        Temporary block (7d)
                      </button>
                      <button
                        type="button"
                        onClick={() => unblock(c.id)}
                        className="px-5 py-3 rounded-2xl font-bold"
                        style={{ backgroundColor: "rgba(9, 224, 247, 0.12)", color: "#131C15", border: "1px solid rgba(9, 224, 247, 0.3)" }}
                      >
                        Unblock
                      </button>
                    </div>

                    <div className="text-xs mt-3" style={{ color: "#131C15", opacity: 0.6 }}>
                      No permanent bans in this UI-only build.
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
                  History (local)
                </h2>
                <p className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.6 }}>
                  Also written to Audit Log.
                </p>
              </div>
              <div className="p-6">
                {history.length === 0 ? (
                  <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                    No actions yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((h) => (
                      <div key={`${h.ts}-${h.caseId}-${h.action}`} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(9, 224, 247, 0.08)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-bold" style={{ color: "#131C15" }}>{h.action}</div>
                          <div className="text-xs" style={{ color: "#131C15", opacity: 0.65 }}>{new Date(h.ts).toLocaleString()}</div>
                        </div>
                        <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.8 }}>
                          {h.caseId} • {h.note}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type RegistryIncident = {
  rowId: string;
  id: string;
  title: string;
  status: "Active" | "Resolved" | "On Hold";
  department: string;
  zone: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  confidence: number;
  createdAt: string;
};

export default function IncidentRegistryPage() {
  const [rows, setRows] = useState<RegistryIncident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [q, setQ] = useState<string>("");
  const [status, setStatus] = useState<string>("All");
  const [dept, setDept] = useState<string>("All");
  const [zone, setZone] = useState<string>("All");
  const [severity, setSeverity] = useState<string>("All");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("status", status);
    params.set("department", dept);
    params.set("zone", zone);
    params.set("severity", severity);
    return params.toString();
  }, [q, status, dept, zone, severity]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/registry?${queryString}`, { cache: "no-store" });
      const json = (await res.json()) as { incidents: RegistryIncident[] };
      if (!cancelled) {
        setRows(json.incidents ?? []);
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Incident <span style={{ color: "#09E0F7" }}>Registry</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Read-only master view across all departments. Admin cannot modify active incident data.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="lg:col-span-2 rounded-2xl px-4 py-3 outline-none"
                  style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}
                  placeholder="Search by Incident ID / title"
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#F4F5F7" }}>
                  <option>All</option>
                  <option>Active</option>
                  <option>Resolved</option>
                  <option>On Hold</option>
                </select>
                <select value={dept} onChange={(e) => setDept(e.target.value)} className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#F4F5F7" }}>
                  <option>All</option>
                  <option>Roads</option>
                  <option>Water</option>
                  <option>Sanitation</option>
                  <option>Electricity</option>
                </select>
                <select value={zone} onChange={(e) => setZone(e.target.value)} className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#F4F5F7" }}>
                  <option>All</option>
                  <option>Zone A</option>
                  <option>Zone B</option>
                  <option>Zone C</option>
                  <option>Zone D</option>
                </select>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#F4F5F7" }}>
                  <option>All</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F5F7" }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>ID</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Title</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Status</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Department</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Zone</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Severity</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Confidence</th>
                    <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-6 py-6 text-sm" colSpan={8} style={{ color: "#131C15", opacity: 0.7 }}>
                        Loading…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-6 text-sm" colSpan={8} style={{ color: "#131C15", opacity: 0.7 }}>
                        No incidents match the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((i) => (
                    <tr key={i.rowId} className="border-b" style={{ borderColor: "#F4F5F7" }}>
                      <td className="px-6 py-4 text-sm font-bold" style={{ color: "#131C15" }}>{i.id}</td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{i.title}</td>
                      <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#131C15" }}>{i.status}</td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{i.department}</td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{i.zone}</td>
                      <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#131C15" }}>{i.severity}</td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{Math.round(i.confidence * 100)}%</td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.65 }}>{new Date(i.createdAt).toLocaleString()}</td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
              Showing {rows.length}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

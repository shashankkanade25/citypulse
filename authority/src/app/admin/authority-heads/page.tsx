"use client";

import { useEffect, useMemo, useState } from "react";

type DepartmentRow = {
  _id: string;
  name: string;
  category?: string | null;
};

type HeadRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  isActive: boolean;
  createdAt?: string;
  department: { id: string; name: string; category?: string | null } | null;
};

export default function AuthorityHeadsAdminPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [heads, setHeads] = useState<HeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    phone: "",
    departmentId: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [deptRes, headRes] = await Promise.all([
        fetch("/api/admin/departments", { cache: "no-store" }),
        fetch("/api/admin/authority-heads", { cache: "no-store" }),
      ]);

      const deptJson = (await deptRes.json().catch(() => null)) as any;
      const headJson = (await headRes.json().catch(() => null)) as any;

      if (cancelled) return;

      if (!deptRes.ok) {
        setError(deptJson?.error || "Failed to load departments");
        setLoading(false);
        return;
      }
      if (!headRes.ok) {
        setError(headJson?.error || "Failed to load authority heads");
        setLoading(false);
        return;
      }

      const deptRows: DepartmentRow[] = Array.isArray(deptJson?.departments)
        ? deptJson.departments.map((d: any) => ({ _id: String(d._id), name: String(d.name), category: d.category ?? null }))
        : [];

      const headRows: HeadRow[] = Array.isArray(headJson?.heads)
        ? headJson.heads.map((h: any) => ({
            id: String(h.id),
            name: String(h.name ?? ""),
            email: String(h.email ?? ""),
            username: String(h.username ?? ""),
            phone: h.phone ? String(h.phone) : null,
            isActive: Boolean(h.isActive),
            createdAt: h.createdAt ? String(h.createdAt) : undefined,
            department: h.department
              ? { id: String(h.department.id), name: String(h.department.name), category: h.department.category ?? null }
              : null,
          }))
        : [];

      setDepartments(deptRows);
      setHeads(headRows);
      setLoading(false);
    }

    load().catch((e: unknown) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : "Failed to load data");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedHeads = useMemo(() => {
    return [...heads].sort((a, b) => (a.createdAt && b.createdAt ? b.createdAt.localeCompare(a.createdAt) : 0));
  }, [heads]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOk(null);

    try {
      const res = await fetch("/api/admin/authority-heads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          username: form.username,
          password: form.password,
          phone: form.phone || undefined,
          departmentId: form.departmentId || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;

      if (!res.ok || !json?.success) {
        setError(json?.error || "Failed to create authority head");
        return;
      }

      setOk("Authority head created");
      setForm({ name: "", email: "", username: "", password: "", phone: "", departmentId: "" });

      const listRes = await fetch("/api/admin/authority-heads", { cache: "no-store" });
      const listJson = (await listRes.json().catch(() => null)) as any;
      if (listRes.ok && Array.isArray(listJson?.heads)) {
        setHeads(
          listJson.heads.map((h: any) => ({
            id: String(h.id),
            name: String(h.name ?? ""),
            email: String(h.email ?? ""),
            username: String(h.username ?? ""),
            phone: h.phone ? String(h.phone) : null,
            isActive: Boolean(h.isActive),
            createdAt: h.createdAt ? String(h.createdAt) : undefined,
            department: h.department
              ? { id: String(h.department.id), name: String(h.department.name), category: h.department.category ?? null }
              : null,
          })) as HeadRow[],
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1
              className="text-4xl lg:text-5xl font-bold mb-2"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
            >
              Authority <span style={{ color: "#09E0F7" }}>Heads</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Create authority head accounts and assign a department.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: "#FFF1F2", borderColor: "#FCA5A5", color: "#991B1B" }}>
              {error}
            </div>
          )}
          {ok && (
            <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.35)", color: "#065F46" }}>
              {ok}
            </div>
          )}

          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm mb-8">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Add Authority Head
            </h2>

            <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border"
                  style={{ borderColor: "rgba(19, 28, 21, 0.18)" }}
                  placeholder="e.g. Asha Patil"
                  required
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border"
                  style={{ borderColor: "rgba(19, 28, 21, 0.18)" }}
                  placeholder="asha@example.com"
                  required
                />
              </Field>

              <Field label="Username">
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border"
                  style={{ borderColor: "rgba(19, 28, 21, 0.18)" }}
                  placeholder="asha.patil"
                  required
                />
              </Field>

              <Field label="Temporary Password">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border"
                  style={{ borderColor: "rgba(19, 28, 21, 0.18)" }}
                  placeholder="Min 6 characters"
                  required
                />
              </Field>

              <Field label="Phone (optional)">
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border"
                  style={{ borderColor: "rgba(19, 28, 21, 0.18)" }}
                  placeholder="e.g. +91 98xxxxxx"
                />
              </Field>

              <Field label="Department (optional)">
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border bg-white"
                  style={{ borderColor: "rgba(19, 28, 21, 0.18)" }}
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-60"
                  style={{ backgroundColor: "#09E0F7", color: "#FFFFFF" }}
                >
                  {submitting ? "Creating..." : "Create Authority Head"}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Existing Authority Heads
            </h2>

            {loading ? (
              <div className="py-8 text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
                Loading...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ color: "#131C15", opacity: 0.7 }}>
                      <th className="text-left text-xs font-bold py-3">Name</th>
                      <th className="text-left text-xs font-bold py-3">Email</th>
                      <th className="text-left text-xs font-bold py-3">Username</th>
                      <th className="text-left text-xs font-bold py-3">Department</th>
                      <th className="text-left text-xs font-bold py-3">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHeads.map((h) => (
                      <tr key={h.id} className="border-t" style={{ borderColor: "rgba(19, 28, 21, 0.10)" }}>
                        <td className="py-3 text-sm font-semibold" style={{ color: "#131C15" }}>
                          {h.name}
                        </td>
                        <td className="py-3 text-sm" style={{ color: "#131C15", opacity: 0.8 }}>
                          {h.email}
                        </td>
                        <td className="py-3 text-sm" style={{ color: "#131C15", opacity: 0.8 }}>
                          {h.username}
                        </td>
                        <td className="py-3 text-sm" style={{ color: "#131C15", opacity: 0.8 }}>
                          {h.department?.name ?? "—"}
                        </td>
                        <td className="py-3 text-sm" style={{ color: "#131C15", opacity: 0.8 }}>
                          {h.isActive ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                    {sortedHeads.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm" style={{ color: "#131C15", opacity: 0.6 }}>
                          No authority heads yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-bold mb-2" style={{ color: "#131C15", opacity: 0.6 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

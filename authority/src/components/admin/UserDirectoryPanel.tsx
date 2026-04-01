"use client";

import { useEffect, useMemo, useState } from "react";

type Scope = "authority" | "citizens";

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "CITIZEN" | "AUTHORITY_HEAD" | "WORKER" | "ADMIN";
  phone: string | null;
  zone: string | null;
  isActive: boolean;
  department: string | null;
  departmentId: string | null;
  createdAt: string;
};

export default function UserDirectoryPanel({ embedded }: { embedded?: boolean }) {
  const [scope, setScope] = useState<Scope>("authority");
  const [rows, setRows] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const tabs = useMemo(
    () => [
      { id: "authority" as const, label: "Authority Users" },
      { id: "citizens" as const, label: "Citizens" },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/users?scope=${scope}`, { cache: "no-store" });
      const json = (await res.json()) as { users: DirectoryUser[] };
      if (!cancelled) {
        setRows(json.users ?? []);
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const shellClassName = embedded ? "bg-white rounded-3xl shadow-sm overflow-hidden" : "bg-white rounded-3xl shadow-sm overflow-hidden";

  return (
    <div className={shellClassName}>
      <div className="p-6 border-b-2" style={{ borderColor: "#F4F5F7" }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>
            Directory view from MongoDB. Authority users (ADMIN / HEAD / WORKER) and Citizens.
          </div>

          <div className="inline-flex rounded-2xl p-1" style={{ backgroundColor: "#F4F5F7" }}>
            {tabs.map((t) => {
              const active = t.id === scope;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setScope(t.id)}
                  className="px-4 py-2 rounded-2xl text-sm font-bold transition-all"
                  style={{
                    backgroundColor: active ? "#FFFFFF" : "transparent",
                    color: "#131C15",
                    border: active ? "1px solid rgba(19, 28, 21, 0.12)" : "1px solid transparent",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {scope === "authority" ? (
          <table className="w-full">
            <thead style={{ backgroundColor: "#F4F5F7" }}>
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>User</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Username</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Role</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Department</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Zone</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Status</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-6 py-6 text-sm" colSpan={7} style={{ color: "#131C15", opacity: 0.7 }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-sm" colSpan={7} style={{ color: "#131C15", opacity: 0.7 }}>
                    No authority users found.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b" style={{ borderColor: "#F4F5F7" }}>
                    <td className="px-6 py-4">
                      <div className="font-bold" style={{ color: "#131C15" }}>{u.name}</div>
                      <div className="text-xs" style={{ color: "#131C15", opacity: 0.65 }}>{u.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{u.username}</td>
                    <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#131C15" }}>{u.role}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{u.department ?? "—"}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{u.zone ?? "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#131C15" }}>{u.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.65 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead style={{ backgroundColor: "#F4F5F7" }}>
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Citizen</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Username</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Phone</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Zone</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Status</th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: "#131C15" }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-6 py-6 text-sm" colSpan={6} style={{ color: "#131C15", opacity: 0.7 }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-sm" colSpan={6} style={{ color: "#131C15", opacity: 0.7 }}>
                    No citizens found.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b" style={{ borderColor: "#F4F5F7" }}>
                    <td className="px-6 py-4">
                      <div className="font-bold" style={{ color: "#131C15" }}>{u.name}</div>
                      <div className="text-xs" style={{ color: "#131C15", opacity: 0.65 }}>{u.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{u.username}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{u.phone ?? "—"}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.85 }}>{u.zone ?? "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#131C15" }}>{u.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: "#131C15", opacity: 0.65 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-6 py-4 text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
        Tip: switch tabs to view Authority vs Citizen accounts.
      </div>
    </div>
  );
}

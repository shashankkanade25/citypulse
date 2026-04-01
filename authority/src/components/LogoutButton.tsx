"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      router.replace("/sign-in");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={className}
      style={{
        backgroundColor: "#EF4444",
        color: "#FFFFFF",
        border: "1px solid rgba(239, 68, 68, 0.35)",
      }}
    >
      {loading ? "Logging out…" : "Logout"}
    </button>
  );
}

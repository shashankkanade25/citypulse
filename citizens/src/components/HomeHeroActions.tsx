"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomeHeroActions() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/auth/me", { signal: controller.signal });
        const json = await res.json().catch(() => null);
        setIsAuthed(Boolean(res.ok && json?.success));
      } catch {
        setIsAuthed(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
      <Link
        href="/reporting"
        className="inline-flex w-full sm:w-auto items-center justify-center gap-3 px-6 py-3 sm:px-8 sm:py-4 rounded-2xl transition-all font-semibold shadow-sm"
        style={{ backgroundColor: "#131C15", color: "#FFFFFF", border: "1px solid rgba(19, 28, 21, 0.12)" }}
      >
        Report an Issue
        <svg className="w-5 h-5 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>

      {isAuthed === null ? null : isAuthed ? (
        <Link
          href="/dashboard"
          className="inline-flex w-full sm:w-auto items-center justify-center px-6 py-3 sm:px-6 sm:py-4 rounded-2xl transition-all font-semibold shadow-sm"
          style={{ backgroundColor: "#FFFFFF", color: "#131C15", border: "1px solid #09E0F7" }}
        >
          Go to Dashboard
        </Link>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Link
            href="/sign-in"
            className="inline-flex w-full sm:w-auto items-center justify-center px-6 py-3 sm:px-6 sm:py-4 rounded-2xl transition-all font-semibold shadow-sm"
            style={{ backgroundColor: "#FFFFFF", color: "#131C15", border: "1px solid rgba(19, 28, 21, 0.12)" }}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex w-full sm:w-auto items-center justify-center px-6 py-3 sm:px-6 sm:py-4 rounded-2xl transition-all font-semibold shadow-sm"
            style={{ backgroundColor: "#09E0F7", color: "#131C15" }}
          >
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}

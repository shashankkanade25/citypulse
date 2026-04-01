"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "@/components/LogoutButton";

type MePayload = { name?: string; email?: string; role?: string } | null;

export default function Navbar() {
  const pathname = usePathname();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [me, setMe] = useState<MePayload>(null);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d)).catch(() => {});
  }, []);

  // close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (me?.name ?? "AH").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/incidents", label: "Incidents" },
    { href: "/workers", label: "Workers" },
    { href: "/eod-review", label: "EOD Reviews" },
    { href: "/sla", label: "SLA Monitor" },
    { href: "/verification", label: "Verification" },
    { href: "/analytics", label: "Analytics" },
    { href: "/audit", label: "Audit Log" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-2xl"
              style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
            >
              A
            </div>
            <div>
              <div
                className="text-xl font-bold"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                Authority Head
              </div>
              <div className="text-xs" style={{ color: '#131C15', opacity: 0.6 }}>
                Department Control Panel
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const isHovered = hoveredLink === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHoveredLink(link.href)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    color: isActive || isHovered ? '#09E0F7' : '#131C15',
                    backgroundColor: isActive ? 'rgba(9, 224, 247, 0.1)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Avatar + Dropdown */}
          <div className="flex items-center gap-3" ref={profileRef}>
            <LogoutButton className="px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-60" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfile(p => !p)}
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold cursor-pointer transition-all hover:ring-2 hover:ring-[#09E0F7]"
                style={{ backgroundColor: '#09E0F7', color: '#FFFFFF' }}
                title={me?.name ?? "Profile"}
              >
                {initials}
              </button>

              {showProfile && (
                <div
                  className="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-lg p-5 z-50"
                  style={{ border: '1px solid rgba(19,28,21,0.1)' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: '#09E0F7', color: '#fff' }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#131C15' }}>{me?.name ?? "—"}</div>
                      <div className="text-xs" style={{ color: '#131C15', opacity: 0.6 }}>{me?.email ?? ""}</div>
                    </div>
                  </div>
                  <div className="text-xs px-1 py-1 rounded" style={{ backgroundColor: '#F4F5F7', color: '#131C15' }}>
                    Role: {me?.role ?? "AUTHORITY_HEAD"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

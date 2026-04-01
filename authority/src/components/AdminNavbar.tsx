"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function AdminNavbar() {
  const pathname = usePathname();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const navLinks = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/flagged", label: "Flagged" },
    { href: "/admin/registry", label: "Registry" },
    { href: "/admin/authority-heads", label: "Authority Heads" },
    { href: "/admin/audit", label: "Audit" },
    { href: "/admin/abuse", label: "Abuse" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/config", label: "Config" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-2xl"
              style={{ backgroundColor: "#09E0F7", color: "#131C15" }}
            >
              🛡️
            </div>
            <div>
              <div
                className="text-xl font-bold"
                style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
              >
                Admin
              </div>
              <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
                Neutral oversight • No incident resolution
              </div>
            </div>
          </Link>

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
                    color: isActive || isHovered ? "#09E0F7" : "#131C15",
                    backgroundColor: isActive ? "rgba(9, 224, 247, 0.1)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold" style={{ color: "#131C15" }}>
                System Admin
              </div>
              <div className="text-xs" style={{ color: "#131C15", opacity: 0.6 }}>
                Read-only + moderation only
              </div>
            </div>

            <LogoutButton className="px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-60" />

            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
              style={{ backgroundColor: "#09E0F7", color: "#FFFFFF" }}
            >
              AD
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

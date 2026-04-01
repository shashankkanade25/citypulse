'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch('/api/auth/me', { signal: controller.signal });
        const json = await res.json().catch(() => null);
        setIsAuthed(Boolean(res.ok && json?.success));
      } catch {
        // If request is aborted or fails, treat as signed out.
        setIsAuthed(false);
      }
    }

    load();
    return () => controller.abort();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setIsAuthed(false);
      setMobileOpen(false);
      router.push('/sign-in');
      router.refresh();
    }
  };

  const showAuthButtons = useMemo(() => {
    // While auth is loading, keep layout stable (avoid flashing buttons)
    return isAuthed !== null;
  }, [isAuthed]);

  return (
    <header className="sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-4 py-3 lg:py-4">
        <nav className="border border-gray-200 bg-white/80 backdrop-blur-md rounded-2xl lg:rounded-3xl px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3 group"
              onClick={() => setMobileOpen(false)}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center transform group-hover:scale-105 transition-transform"
                style={{ backgroundColor: '#09E0F7' }}
              >
                <span className="font-bold text-lg" style={{ color: '#131C15' }}>C</span>
              </div>
              <div className="hidden xs:block">
                <div
                  className="text-xl font-bold leading-none"
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                >
                  CityPulse
                </div>
                <div className="text-xs text-gray-500 font-medium">Citizen Portal</div>
              </div>
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-8">
              {isAuthed && (
                <>
                  <Link
                    href="/dashboard"
                    className="text-sm font-semibold transition-colors"
                    style={{ color: pathname?.startsWith('/dashboard') ? '#09E0F7' : '#131C15' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#09E0F7'}
                    onMouseLeave={(e) => e.currentTarget.style.color = pathname?.startsWith('/dashboard') ? '#09E0F7' : '#131C15'}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/reporting"
                    className="text-sm font-semibold transition-colors"
                    style={{ color: pathname === '/reporting' ? '#09E0F7' : '#131C15' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#09E0F7'}
                    onMouseLeave={(e) => e.currentTarget.style.color = pathname === '/reporting' ? '#09E0F7' : '#131C15'}
                  >
                    Report
                  </Link>
                  <Link
                    href="/reporting/track"
                    className="text-sm font-semibold transition-colors"
                    style={{ color: pathname?.includes('/track') ? '#09E0F7' : '#131C15' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#09E0F7'}
                    onMouseLeave={(e) => e.currentTarget.style.color = pathname?.includes('/track') ? '#09E0F7' : '#131C15'}
                  >
                    Track
                  </Link>
                  <Link
                    href="/reporting/transparency"
                    className="text-sm font-semibold transition-colors"
                    style={{ color: pathname?.includes('/transparency') ? '#09E0F7' : '#131C15' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#09E0F7'}
                    onMouseLeave={(e) => e.currentTarget.style.color = pathname?.includes('/transparency') ? '#09E0F7' : '#131C15'}
                  >
                    Transparency
                  </Link>
                </>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Desktop CTA: hide on small devices (hero already has it) */}
              <Link
                href="/reporting"
                className="hidden md:inline-flex px-6 py-3 text-white rounded-xl font-semibold text-sm transition-all"
                style={{ backgroundColor: '#131C15' }}
              >
                Report Issue
              </Link>

              {/* Desktop auth */}
              {showAuthButtons ? (
                isAuthed ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="hidden md:inline-flex px-5 py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Logout
                  </button>
                ) : (
                  <div className="hidden md:flex items-center gap-2">
                    <Link
                      href="/sign-in"
                      className="px-5 py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/sign-up"
                      className="px-5 py-3 rounded-xl font-semibold text-sm transition-all"
                      style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
                    >
                      Sign up
                    </Link>
                  </div>
                )
              ) : null}

              {/* Mobile menu toggle */}
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl border border-gray-200"
                style={{ color: '#131C15', backgroundColor: 'rgba(255, 255, 255, 0.75)' }}
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? (
                  <span className="text-xl">✕</span>
                ) : (
                  <span className="text-2xl leading-none">≡</span>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile dropdown */}
        {mobileOpen ? (
          <div className="md:hidden mt-3 border border-gray-200 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-4">
            <div className="flex flex-col gap-2">
              {isAuthed && (
                <>
                  <Link
                    href="/dashboard"
                    className="px-4 py-3 rounded-xl font-semibold"
                    style={{ color: '#131C15', backgroundColor: pathname?.startsWith('/dashboard') ? 'rgba(9, 224, 247, 0.12)' : 'transparent' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/reporting"
                    className="px-4 py-3 rounded-xl font-semibold"
                    style={{ color: '#131C15', backgroundColor: pathname === '/reporting' ? 'rgba(9, 224, 247, 0.12)' : 'transparent' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    Report
                  </Link>
                  <Link
                    href="/reporting/track"
                    className="px-4 py-3 rounded-xl font-semibold"
                    style={{ color: '#131C15', backgroundColor: pathname?.includes('/track') ? 'rgba(9, 224, 247, 0.12)' : 'transparent' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    Track
                  </Link>
                  <Link
                    href="/reporting/transparency"
                    className="px-4 py-3 rounded-xl font-semibold"
                    style={{ color: '#131C15', backgroundColor: pathname?.includes('/transparency') ? 'rgba(9, 224, 247, 0.12)' : 'transparent' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    Transparency
                  </Link>
                </>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              {isAuthed ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Logout
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/sign-in"
                    className="px-4 py-3 rounded-xl font-semibold text-center border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="px-4 py-3 rounded-xl font-semibold text-center transition-all"
                    style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

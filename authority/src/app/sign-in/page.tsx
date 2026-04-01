'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      const redirectTo = typeof data.redirectTo === "string" && data.redirectTo.length > 0 ? data.redirectTo : "/dashboard";
      router.replace(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-[#E2E8F0] p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#0F172A] mx-auto mb-4 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">AUTHORITY PORTAL</h1>
            <p className="text-[#64748B] text-sm mt-2">Sign in to your authority account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[#FEF2F2] border-l-4 border-[#DC2626] text-[#991B1B] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 border border-[#CBD5E1] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] outline-none transition text-[#0F172A] bg-white"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-[#CBD5E1] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] outline-none transition text-[#0F172A] bg-white"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F172A] text-white py-3 px-4 font-semibold hover:bg-[#1E293B] focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm uppercase tracking-wider"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[#64748B] text-sm mt-6 pt-6 border-t border-[#E2E8F0]">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-[#2563EB] hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>

        <p className="text-center text-[#64748B] text-sm mt-6">
          Are you a citizen?{' '}
          <a
            href={process.env.NEXT_PUBLIC_CITIZENS_URL || 'http://localhost:3000'}
            className="text-[#2563EB] hover:underline font-medium"
          >
            Go to Citizens Portal
          </a>
        </p>
      </div>
    </div>
  );
}

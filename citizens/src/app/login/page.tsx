"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setError(json?.error || "Failed to sign in");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo/Brand */}
          <div className="mb-12">
            <h3 className="text-2xl font-light text-gray-800 mb-8">CityPulse</h3>
            <h1 className="text-4xl md:text-5xl font-normal text-gray-900 mb-4">
              Welcome to<br />CityPulse
            </h1>
            <p className="text-gray-500 text-sm">
              Report and track urban infrastructure issues in real-time
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {/* Email Input */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-[#00bcd4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email or username"
                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-full text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00bcd4] transition-colors"
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-12 pr-12 py-4 border border-gray-200 rounded-full text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00bcd4] transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#00bcd4] hover:bg-[#00acc1] text-white py-4 rounded-full font-medium transition-colors shadow-sm"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-sm text-gray-400">or</span>
              </div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              className="w-full border border-gray-200 hover:border-gray-300 py-4 rounded-full font-medium transition-colors flex items-center justify-center gap-3 text-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Signin with Google
            </button>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-gray-600 pt-2">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[#00bcd4] hover:text-[#00acc1] font-medium">
                Signup
              </Link>
            </p>
          </form>

          {/* Bottom Badge */}
          <div className="mt-12 flex items-center gap-4">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-white"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-white"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Join with 20k+ Users!</p>
              <p className="text-xs text-gray-500">Let's see our happy customer</p>
            </div>
            <button className="ml-auto w-10 h-10 border border-gray-200 rounded-full flex items-center justify-center hover:border-gray-300 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Cyan Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#7dd3c0] to-[#5bc0be] p-16 items-center justify-center">
        <div className="max-w-xl w-full">
          <h2 className="text-white text-4xl font-light leading-relaxed mb-16">
            AI Revolutionizing the way we create, render, and experience content.
          </h2>

          {/* Isometric 3D Illustration */}
          <div className="relative mb-16">
            {/* Main 3D shapes */}
            <div className="relative w-full aspect-square max-w-md mx-auto">
              {/* Background shape - light */}
              <div className="absolute top-8 left-8 w-64 h-64">
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#f5f1e8] to-[#e8e4dc] rounded-3xl transform rotate-12 shadow-2xl">
                    <div className="absolute top-12 left-12 w-24 h-24 bg-gradient-to-br from-gray-500 to-gray-700 rounded-lg"></div>
                  </div>
                </div>
              </div>
              
              {/* Foreground shape - dark */}
              <div className="absolute top-16 right-8 w-64 h-64">
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#e8e4dc] to-[#d4cfc7] rounded-3xl transform -rotate-12 shadow-2xl">
                    <div className="absolute bottom-12 right-12 w-24 h-24 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg"></div>
                  </div>
                </div>
              </div>

              {/* Interlocking center piece */}
              <div className="absolute top-32 left-32 w-32 h-32 bg-gradient-to-br from-gray-600 to-gray-800 rounded-2xl shadow-2xl z-10"></div>
            </div>

            {/* Bottom decorative elements */}
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full border border-white/30">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-white font-medium">Creating</span>
              </div>
              <button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </button>
            </div>
          </div>

          <p className="text-white/90 text-lg leading-relaxed mt-8">
            Create design brief with AI voice command to make awesome 3d images that suits your needs.
          </p>
        </div>
      </div>
    </div>
  );
}

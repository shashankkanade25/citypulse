"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

type VerificationItem = {
  _id: string;
  incidentId: string;
  title: string;
  description: string;
  zone: string;
  department: string;
  severity: string;
  confidence: number;
  images: string[];
  citizenId: string;
  createdAt: string;
  moderation?: { status: string; lastActionAt?: string };
};

type VStats = { pending: number; approvedToday: number; rejectedToday: number };

export default function VerificationPage() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [stats, setStats] = useState<VStats>({ pending: 0, approvedToday: 0, rejectedToday: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    fetch("/api/head/verification", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setStats(d.stats ?? { pending: 0, approvedToday: 0, rejectedToday: 0 }); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id: string) => {
    // For now, just remove from list — you can wire a PATCH endpoint later
    setItems((prev) => prev.filter((i) => i._id !== id));
    setStats((prev) => ({ ...prev, pending: prev.pending - 1, approvedToday: prev.approvedToday + 1 }));
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    setItems((prev) => prev.filter((i) => i._id !== id));
    setStats((prev) => ({ ...prev, pending: prev.pending - 1, rejectedToday: prev.rejectedToday + 1 }));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
      <div className="text-xl font-bold animate-pulse" style={{ color: "#09E0F7" }}>Loading verification queue...</div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Incident <span style={{ color: "#09E0F7" }}>Verification</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>Review and approve pending moderation items before publishing</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-4xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#F59E0B" }}>{stats.pending}</div>
              <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Pending Review</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-4xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#10B981" }}>{stats.approvedToday}</div>
              <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Approved Today</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-4xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#EF4444" }}>{stats.rejectedToday}</div>
              <div className="text-sm font-semibold" style={{ color: "#131C15", opacity: 0.7 }}>Rejected Today</div>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-6">
            {items.map((item) => (
              <div key={item._id} className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>{item.incidentId} — {item.title}</h3>
                      <span className="px-3 py-1 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: "#F59E0B" }}>Pending</span>
                    </div>
                    <p className="text-sm mb-1" style={{ color: "#131C15", opacity: 0.7 }}>📍 Zone: {item.zone} • 🏢 Dept: {item.department}</p>
                    <p className="text-sm" style={{ color: "#131C15", opacity: 0.6 }}>⏰ {new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-bold mb-2" style={{ color: "#131C15" }}>Description</h4>
                  <p className="text-sm leading-relaxed" style={{ color: "#131C15", opacity: 0.8 }}>{item.description}</p>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-xs font-bold px-2 py-1 rounded text-white" style={{ backgroundColor: item.severity === "Critical" ? "#EF4444" : item.severity === "High" ? "#F59E0B" : "#09E0F7" }}>{item.severity}</span>
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>🤖 Confidence: {Math.round(item.confidence * 100)}%</span>
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>📸 {item.images?.length ?? 0} image(s)</span>
                </div>

                {/* Images */}
                {item.images?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold mb-3" style={{ color: "#131C15" }}>Attached Images</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {item.images.map((img, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden aspect-video bg-gray-100">
                          <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.images?.length === 0 && (
                  <div className="mb-6 p-4 rounded-xl border-2 border-dashed text-center" style={{ borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,0.05)" }}>
                    <p className="text-sm font-semibold" style={{ color: "#F59E0B" }}>⚠️ No images provided</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4 pt-6 border-t-2" style={{ borderColor: "#F4F5F7" }}>
                  <button onClick={() => handleApprove(item._id)} className="flex-1 px-6 py-4 rounded-xl font-bold transition-all hover:shadow-lg" style={{ backgroundColor: "#10B981", color: "#FFFFFF" }}>✓ Approve</button>
                  <button onClick={() => handleReject(item._id)} className="flex-1 px-6 py-4 rounded-xl font-bold transition-all hover:shadow-lg border-2" style={{ borderColor: "#EF4444", color: "#EF4444" }}>✗ Reject</button>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 && (
            <div className="bg-white rounded-3xl px-6 py-16 text-center shadow-sm">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>All Caught Up!</h3>
              <p style={{ color: "#131C15", opacity: 0.7 }}>No pending items to review at this time.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TimelineItem = {
  type: "REPORTED" | "STATUS_UPDATE";
  at: string;
  title: string;
  remark?: string | null;
  citizenImages: string[];
  authorityImages: string[];
};

type WorkDetail = {
  incident: {
    incidentCode: string;
    title: string;
    description: string;
    severity: string | null;
    status: string | null;
    department: string | null;
    category: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
    updatedAt: string;
  };
  images: {
    citizen: string[];
    authority: string[];
  };
  timeline: TimelineItem[];
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ImageStrip({ urls }: { urls: string[] }) {
  if (!urls.length) return <div className="text-sm" style={{ color: "#131C15", opacity: 0.65 }}>No images available.</div>;

  const first = urls[0];

  return (
    <div className="flex flex-wrap gap-3">
      <div
        className="h-28 w-28 rounded-xl border overflow-hidden"
        style={{ borderColor: "rgba(9, 224, 247, 0.3)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={first}
          alt="Evidence"
          className="h-full w-full object-cover"
          style={{ transform: "scale(1.12)", transformOrigin: "center" }}
          loading="lazy"
        />
      </div>
    </div>
  );
}

function AuthorityImageGrid({ urls, max = 2 }: { urls: string[]; max?: number }) {
  const items = urls.slice(0, max);
  if (!items.length) return <div className="text-sm" style={{ color: "#131C15", opacity: 0.65 }}>No images available.</div>;

  if (items.length <= 2) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {items.map((u, idx) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${u}-${idx}`}
            src={u}
            alt="Authority update"
            className={(items.length === 1 ? "col-span-2 h-56" : "h-40") + " w-full rounded-2xl object-cover border"}
            style={{ borderColor: "rgba(9, 224, 247, 0.3)" }}
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((u, idx) => {
        const hero = idx === 0;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${u}-${idx}`}
            src={u}
            alt="Authority update"
            className={(hero ? "col-span-3 h-56" : "h-28") + " w-full rounded-2xl object-cover border"}
            style={{ borderColor: "rgba(9, 224, 247, 0.3)" }}
            loading="lazy"
          />
        );
      })}
    </div>
  );
}

export default function TransparencyWorkDetailPage() {
  const params = useParams<{ incidentCode?: string | string[] }>();
  const incidentCode = useMemo(() => {
    const raw = params?.incidentCode;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (!v) return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return null;
    return s;
  }, [params]);

  const [data, setData] = useState<WorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentCode) {
      setData(null);
      setLoading(false);
      setError("Invalid link (missing incident code)");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/transparency/works/${encodeURIComponent(incidentCode)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.error || "Failed to load work detail");
        if (!cancelled) setData(json.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incidentCode]);

  const latestAuthorityImages = useMemo(() => data?.images?.authority ?? [], [data]);
  const citizenImages = useMemo(() => data?.images?.citizen ?? [], [data]);

  const comparisonCitizenImages = citizenImages;
  const comparisonAuthorityImages = latestAuthorityImages;

  const timelineToRender = useMemo(() => {
    return data?.timeline?.length ? [...data.timeline] : [];
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🧾</div>
          <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>Loading work details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F5F7" }}>
        <div className="text-center max-w-xl px-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-2xl font-bold mb-3" style={{ color: "#131C15" }}>Could not load</h3>
          <p className="mb-6" style={{ color: "#131C15", opacity: 0.7 }}>{error || "Not found"}</p>
          <Link
            href="/reporting/transparency"
            className="inline-flex items-center justify-center px-6 py-4 rounded-xl font-bold border-2"
            style={{ borderColor: "#131C15", color: "#131C15" }}
          >
            ← Back to Transparency
          </Link>
        </div>
      </div>
    );
  }

  const inc = data.incident;


  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-3 lg:px-4">
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color: "#09E0F7" }}>{inc.incidentCode}</div>
                  <h1
                    className="text-3xl lg:text-4xl font-bold"
                    style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}
                  >
                    Work Details
                  </h1>
                </div>
                <Link
                  href="/reporting/transparency"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl font-bold border-2"
                  style={{ borderColor: "#131C15", color: "#131C15" }}
                >
                  ← Back
                </Link>
              </div>

              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>{inc.title}</h2>
                <p className="mt-2" style={{ color: "#131C15", opacity: 0.7 }}>{inc.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>🏢 {inc.department || "General"}</span>
                <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>⚑ {inc.status || "UNKNOWN"}</span>
                {inc.severity ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: "rgba(9, 224, 247, 0.15)", color: "#131C15" }}>Severity: {inc.severity}</span>
                ) : null}
                <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: "#F4F5F7", color: "#131C15" }}>🕒 Reported: {formatDateTime(inc.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm mb-6">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Image Comparison
            </h2>

            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                <div className="text-sm font-bold mb-3" style={{ color: "#131C15" }}>Citizen (at report time)</div>
                <ImageStrip urls={comparisonCitizenImages} />
              </div>
              <div>
                <div className="text-sm font-bold mb-3" style={{ color: "#131C15" }}>Authority (latest update)</div>
                <AuthorityImageGrid urls={comparisonAuthorityImages} />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Timeline
            </h2>

            <div className="space-y-8">
              {timelineToRender.map((t, idx) => {
                const isLast = idx === timelineToRender.length - 1;
                const isReported = t.type === "REPORTED";

                return (
                  <div key={`${t.at}-${idx}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className="h-11 w-11 rounded-2xl border flex items-center justify-center text-xl"
                        style={{ borderColor: "rgba(9, 224, 247, 0.35)", backgroundColor: isReported ? "rgba(9, 224, 247, 0.12)" : "#F4F5F7" }}
                      >
                        {isReported ? "🧾" : "🏛️"}
                      </div>
                      {!isLast ? (
                        <div className="w-px flex-1 mt-2" style={{ backgroundColor: "rgba(9, 224, 247, 0.25)", minHeight: 24 }} />
                      ) : (
                        <div className="w-px flex-1 mt-2" style={{ backgroundColor: "transparent", minHeight: 24 }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl border p-5" style={{ borderColor: "rgba(9, 224, 247, 0.25)" }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <div
                              className="text-base lg:text-lg font-extrabold tracking-tight"
                              style={{ color: "#131C15", fontFamily: "'Unbounded', sans-serif" }}
                            >
                              {t.title}
                            </div>
                            <div className="text-sm mt-1" style={{ color: "#131C15", opacity: 0.65 }}>
                              {formatDateTime(t.at)}
                            </div>
                          </div>
                          <span
                            className="text-xs font-bold px-3 py-1 rounded-lg"
                            style={{ backgroundColor: isReported ? "rgba(9, 224, 247, 0.12)" : "#F4F5F7", color: "#131C15" }}
                          >
                            {isReported ? "Citizen Report" : "Authority Update"}
                          </span>
                        </div>

                        {t.remark ? (
                          <p className="mt-3 text-sm lg:text-base" style={{ color: "#131C15", opacity: 0.78 }}>
                            {t.remark}
                          </p>
                        ) : null}

                        <div className="mt-4">
                          {isReported ? (
                            <>
                              <div className="text-xs font-bold mb-2" style={{ color: "#131C15" }}>
                                Citizen images
                              </div>
                              <ImageStrip urls={t.citizenImages} />
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-bold mb-2" style={{ color: "#131C15" }}>
                                Authority update images
                              </div>
                              <AuthorityImageGrid urls={t.authorityImages} max={2} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  classifyImage,
  generateReport,
  generateReportStream,
  isCityPulseAvailable,
  resetCityPulseAvailabilityCache,
  categoryToDropdown,
  filterReportSections,
  saveReportToDB,
  type ClassifyResponse,
} from "@/lib/citypulse";

export default function ReportingPage() {
  const DRAFT_KEY = "citypulse_report_draft";
  const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    location: "",
    locationLat: null as number | null,
    locationLng: null as number | null,
    image: null as File | null,
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // AI mode toggle
  const [aiMode, setAiMode] = useState<"auto" | "manual">("auto");
  const [isAiAvailable, setIsAiAvailable] = useState<boolean | null>(null);
  const [isCheckingAi, setIsCheckingAi] = useState(false);

  // Classify-on-upload state
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<ClassifyResponse | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Full pipeline state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedReport, setSavedReport] = useState<unknown | null>(null);

  // Location state
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check AI availability on mount
  useEffect(() => {
    checkAiAvailability();
  }, []);

  // ── DRAFT PERSISTENCE: Restore draft from localStorage on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      // Check expiry
      if (draft._savedAt && Date.now() - draft._savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const restored = {
        title: draft.title || "",
        description: draft.description || "",
        category: draft.category || "",
        location: draft.location || "",
        locationLat: typeof draft.locationLat === "number" ? draft.locationLat : null,
        locationLng: typeof draft.locationLng === "number" ? draft.locationLng : null,
        image: null as File | null,
      };
      // Only restore if there's actual content
      if (restored.title || restored.description || restored.location || restored.category) {
        setFormData(restored);
        setDraftRestored(true);
        // Auto-dismiss the banner after 5 seconds
        setTimeout(() => setDraftRestored(false), 5000);
      }
    } catch {
      // corrupt data — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── DRAFT PERSISTENCE: Auto-save form data to localStorage (debounced) ──
  useEffect(() => {
    // Don't save empty forms or after successful submit
    if (isSaved) return;
    const hasContent = formData.title || formData.description || formData.location || formData.category;
    if (!hasContent) return;

    const timeout = setTimeout(() => {
      try {
        const draft = {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          location: formData.location,
          locationLat: formData.locationLat,
          locationLng: formData.locationLng,
          _savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // localStorage full or unavailable — ignore
      }
    }, 1000); // debounce 1 second

    return () => clearTimeout(timeout);
  }, [formData.title, formData.description, formData.category, formData.location, formData.locationLat, formData.locationLng, isSaved]);

  const checkAiAvailability = async () => {
    setIsCheckingAi(true);
    resetCityPulseAvailabilityCache();
    const available = await isCityPulseAvailable();
    setIsAiAvailable(available);
    setIsCheckingAi(false);
    if (available) {
      setError(null);
    }
  };

  const buildLocalReportFallback = (
    category: string,
    severity: string,
    department: string,
    priority: string,
    location?: string
  ) => {
    const safeLocation = location?.trim() ? location : "Location not provided";
    return [
      "INCIDENT SUMMARY:",
      `${category} has been detected and requires ${severity.toLowerCase()} priority handling.`,
      "",
      "ISSUE DETAILS:",
      `Category: ${category}`,
      `Severity: ${severity}`,
      `Department: ${department}`,
      `Priority: ${priority}`,
      `Location: ${safeLocation}`,
      "",
      "RECOMMENDED ACTIONS:",
      "- Dispatch field team to validate and assess on-site conditions.",
      "- Secure the area and perform immediate risk mitigation.",
      "- Log progress updates with evidence until resolution.",
      "",
      "ESTIMATED URGENCY & REASONING:",
      `Urgency: ${severity}`,
      "Reasoning: Severity and category indicate the issue should be addressed promptly to reduce public risk.",
    ].join("\n");
  };

  const generateDescriptionWithFallback = async (result: ClassifyResponse) => {
    const top = result.top_prediction;
    const reportParams = {
      category: top.category,
      confidence: top.confidence,
      department: top.department,
      priority: top.effective_priority,
      severity: result.severity.level,
      location: formData.location,
    };

    setIsGeneratingReport(true);
    setFormData((prev) => ({ ...prev, description: "" }));

    try {
      const chunks: string[] = [];
      const streamed = await generateReportStream(reportParams, (chunk) => {
        chunks.push(chunk);
        setFormData((prev) => ({ ...prev, description: chunks.join("") }));
      });

      const filtered = filterReportSections(streamed).trim();
      if (filtered) {
        setFormData((prev) => ({ ...prev, description: filtered }));
        return;
      }
      throw new Error("Stream returned empty report");
    } catch {
      try {
        const normal = await generateReport(reportParams);
        const filtered = filterReportSections(normal.report).trim();
        if (filtered) {
          setFormData((prev) => ({ ...prev, description: filtered }));
          return;
        }
        throw new Error("Report endpoint returned empty report");
      } catch (err) {
        setError(err instanceof Error ? `AI report generation failed: ${err.message}` : "AI report generation failed. A local fallback report was added.");
        const fallback = buildLocalReportFallback(
          top.category,
          result.severity.level,
          top.department,
          top.effective_priority,
          formData.location
        );
        setFormData((prev) => ({ ...prev, description: fallback }));
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Retry AI classification for existing image
  const retryAiClassification = async () => {
    if (!formData.image) return;

    setError(null);
    setIsCheckingAi(true);
    resetCityPulseAvailabilityCache();
    const available = await isCityPulseAvailable();
    setIsAiAvailable(available);
    setIsCheckingAi(false);

    if (!available) {
      setError("AI service is still unavailable. Please ensure CityPulse backend is running on localhost:8000");
      return;
    }

    setIsClassifying(true);
    try {
      const result = await classifyImage(formData.image);
      setClassifyResult(result);

      // Auto-fill form fields from classification
      const top = result.top_prediction;
      setFormData((prev) => ({
        ...prev,
        title: top.category,
        category: categoryToDropdown(top.category),
      }));
      setIsClassifying(false);

      // Chain: generate AI report
      await generateDescriptionWithFallback(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to classify image");
      setIsClassifying(false);
    }
  };

  // ── Get user location via browser Geolocation API ──
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsFetchingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode via server proxy (avoids CORS)
          const res = await fetch(
            `/api/geocode/reverse?lat=${latitude}&lon=${longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            // Build a readable address string
            const parts = [
              addr.road || addr.pedestrian || addr.neighbourhood,
              addr.suburb || addr.village || addr.town,
              addr.city || addr.county,
              addr.state,
            ].filter(Boolean);
            const locationStr = parts.length > 0
              ? parts.join(", ")
              : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            setFormData((prev) => ({
              ...prev,
              location: locationStr,
              locationLat: latitude,
              locationLng: longitude,
            }));
          } else {
            // Fallback to raw coordinates
            setFormData((prev) => ({
              ...prev,
              location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
              locationLat: latitude,
              locationLng: longitude,
            }));
          }
        } catch {
          // Fallback to raw coordinates on network error
          setFormData((prev) => ({
            ...prev,
            location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            locationLat: latitude,
            locationLng: longitude,
          }));
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (err) => {
        setIsFetchingLocation(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access denied. Please allow location permission or type your address manually.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location unavailable. Please type your address manually.");
            break;
          case err.TIMEOUT:
            setError("Location request timed out. Please try again or type your address manually.");
            break;
          default:
            setError("Could not get your location. Please type your address manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const stopLiveTracking = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsLiveTracking(false);
  }, []);

  const startLiveTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setError(null);
    setIsLiveTracking(true);

    // If a previous watch exists, clear it first.
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData((prev) => ({
          ...prev,
          locationLat: latitude,
          locationLng: longitude,
          // Don't spam reverse-geocoding on every update; keep user's typed address.
          location: prev.location || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        }));
      },
      (err) => {
        stopLiveTracking();
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Live location denied. Please allow location permission or type your address manually.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Live location unavailable. Please type your address manually.");
            break;
          case err.TIMEOUT:
            setError("Live location timed out. Please try again.");
            break;
          default:
            setError("Could not start live location tracking.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [stopLiveTracking]);

  // Cleanup live tracking watcher on unmount.
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // ── Instant classify when image is uploaded ──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    // Show preview
    setImagePreview(URL.createObjectURL(file));
    setFormData((prev) => ({ ...prev, image: file }));
    setError(null);
    setClassifyResult(null);

    // Skip AI if manual mode
    if (aiMode === "manual") {
      return;
    }

    // Check AI availability
    const available = await isCityPulseAvailable();
    setIsAiAvailable(available);

    if (!available) {
      setError("AI service is unavailable. Click 'Retry Connection' or switch to Manual mode.");
      return;
    }

    setIsClassifying(true);

    try {
      const result = await classifyImage(file);
      setClassifyResult(result);

      // Auto-fill form fields from classification
      const top = result.top_prediction;
      setFormData((prev) => ({
        ...prev,
        image: file,
        title: top.category,
        category: categoryToDropdown(top.category),
      }));
      setIsClassifying(false);

      // Chain: generate AI report → auto-fill description
      await generateDescriptionWithFallback(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to classify image. Is the CityPulse backend running?"
      );
      setIsClassifying(false);
    }
  };

  // ── Submit form — save to DB using already-classified data ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaved(false);
    setSavedReport(null);

    if (!formData.title.trim() || !formData.description.trim() || !formData.category.trim() || !formData.location.trim()) {
      setError("Please fill Title, Description, Category, and Location.");
      return;
    }

    if (!formData.image) {
      setError("Please upload a photo before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Use data already filled by AI classification (or manual entry)
      let severityLevel = "MEDIUM";
      let department = "General";
      let priority = "medium";
      let aiConfidence = 0;

      if (classifyResult) {
        const top = classifyResult.top_prediction;
        const priorityMap: Record<string, string> = { Critical: "urgent", High: "high", Medium: "medium", Low: "low" };
        severityLevel = classifyResult.severity.level || severityLevel;
        department = top.department || department;
        priority = priorityMap[top.effective_priority] || priority;
        // Confidence from CLIP is a percentage (0-100); normalize to 0-1 for DB
        const rawConf = top.confidence ?? 0;
        aiConfidence = rawConf > 1 ? rawConf / 100 : rawConf;
      }

      // Upload image to Cloudinary if present
      let imageUrl: string | undefined;
      if (formData.image) {
        try {
          const uploadForm = new FormData();
          uploadForm.append("file", formData.image);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
          const uploadJson = await uploadRes.json();
          if (uploadJson.success && uploadJson.url) {
            imageUrl = uploadJson.url;
          } else {
            console.warn("[Report] Image upload failed:", uploadJson.error);
          }
        } catch (uploadErr) {
          console.warn("[Report] Image upload error:", uploadErr);
        }
      }

      const saveResult = await saveReportToDB({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: formData.location,
        locationLat: formData.locationLat,
        locationLng: formData.locationLng,
        severityLevel,
        department,
        priority,
        aiConfidence,
        imageUrl,
      });

      if (saveResult.success) {
        setIsSaved(true);
        setSavedReport(saveResult.data || null);
        // Clear draft on successful submit
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      } else {
        setError(saveResult.error || "Could not save report");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit report. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const savedId =
    savedReport && typeof savedReport === 'object' && '_id' in savedReport
      ? String((savedReport as any)._id)
      : null;

  const resetForm = () => {
    setClassifyResult(null);
    setImagePreview(null);
    setError(null);
    setIsSaved(false);
    setSavedReport(null);
    setDraftRestored(false);
    setFormData({ title: "", description: "", category: "", location: "", locationLat: null, locationLng: null, image: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Clear saved draft
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  // ── SUCCESS VIEW ──
  if (isSaved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: '#F4F5F7' }}>
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl px-8 py-12 shadow-sm text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <span className="text-4xl">✅</span>
            </div>
            <h1
              className="text-3xl font-bold mb-3"
              style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
            >
              Report Submitted!
            </h1>
            <p className="text-base mb-2" style={{ color: '#131C15', opacity: 0.7 }}>
              Your report has been saved and is now being reviewed.
            </p>
            <p className="text-sm mb-1" style={{ color: '#131C15', opacity: 0.5 }}>
              Status: <span className="font-semibold" style={{ color: '#f59e0b' }}>Pending</span>
            </p>
            {savedId && (
              <p className="text-xs mb-6 font-mono" style={{ color: '#131C15', opacity: 0.4 }}>
                ID: {savedId}
              </p>
            )}

            {/* Summary card */}
            <div className="text-left rounded-2xl px-5 py-4 mb-8" style={{ backgroundColor: '#F4F5F7' }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>ISSUE</div>
                  <div className="font-semibold" style={{ color: '#131C15' }}>{formData.title}</div>
                </div>
                <div>
                  <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>CATEGORY</div>
                  <div className="font-semibold" style={{ color: '#131C15' }}>{formData.category}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>LOCATION</div>
                  <div className="font-semibold" style={{ color: '#131C15' }}>{formData.location}</div>
                </div>
                {classifyResult && (
                  <>
                    <div>
                      <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>SEVERITY</div>
                      <div className="font-semibold" style={{ color: '#131C15' }}>
                        {classifyResult.severity.level === 'Critical' && '🔴 '}
                        {classifyResult.severity.level === 'High' && '🟠 '}
                        {classifyResult.severity.level === 'Medium' && '🟡 '}
                        {classifyResult.severity.level === 'Low' && '🟢 '}
                        {classifyResult.severity.level}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>DEPARTMENT</div>
                      <div className="font-semibold" style={{ color: '#131C15' }}>{classifyResult.top_prediction.department}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href="/reporting/track"
                className="flex-1 px-6 py-4 rounded-xl font-bold text-center text-white transition-all hover:shadow-lg"
                style={{ backgroundColor: '#131C15' }}
              >
                View My Reports
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-6 py-4 rounded-xl font-bold transition-all border-2 hover:shadow-md"
                style={{ borderColor: '#09E0F7', color: '#09E0F7' }}
              >
                Submit Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: '#F4F5F7' }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-3 lg:px-4">
          {/* Header */}
          <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm mb-6">
            <div className="max-w-3xl">
              <h1
                className="text-4xl lg:text-5xl font-bold mb-4"
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                Report an <span style={{ color: '#09E0F7' }}>Issue</span>
              </h1>
              <p className="text-lg" style={{ color: '#131C15', opacity: 0.7 }}>
                Help us improve your city. Submit a detailed report and we&apos;ll ensure it reaches the right authorities.
              </p>
            </div>
          </div>

          {/* Draft Restored Banner */}
          {draftRestored && (
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-3 mb-6 transition-all"
              style={{ backgroundColor: "rgba(9,224,247,0.08)", border: "1px solid rgba(9,224,247,0.2)" }}
            >
              <span className="text-lg">📝</span>
              <div className="flex-1">
                <span className="text-sm font-bold" style={{ color: "#131C15" }}>Draft restored! </span>
                <span className="text-sm" style={{ color: "#131C15", opacity: 0.7 }}>Your previous work was auto-saved and has been loaded back.</span>
              </div>
              <button
                type="button"
                onClick={() => { resetForm(); setDraftRestored(false); }}
                className="text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/60 transition-all"
                style={{ color: "#ef4444" }}
              >
                Clear Draft
              </button>
              <button
                type="button"
                onClick={() => setDraftRestored(false)}
                className="text-xs font-bold px-2 py-1 rounded-lg hover:bg-white/60 transition-all"
                style={{ color: "#131C15", opacity: 0.4 }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* ── AI Status & Mode Toggle ── */}
                  <div className="rounded-2xl px-5 py-4" style={{ backgroundColor: isAiAvailable ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isCheckingAi ? 'animate-pulse bg-yellow-400' : isAiAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <div className="text-sm font-bold" style={{ color: '#131C15' }}>
                            {isCheckingAi ? 'Checking AI Service...' : isAiAvailable ? '🤖 AI Service Connected' : '⚠️ AI Service Unavailable'}
                          </div>
                          <div className="text-xs" style={{ color: '#131C15', opacity: 0.6 }}>
                            {isAiAvailable ? 'CLIP + Ollama ready for auto-classification' : 'localhost:8000 not responding'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isAiAvailable && !isCheckingAi && (
                          <button
                            type="button"
                            onClick={checkAiAvailability}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:shadow-sm"
                            style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
                          >
                            🔄 Retry Connection
                          </button>
                        )}

                        {/* Mode Toggle */}
                        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(19, 28, 21, 0.1)' }}>
                          <button
                            type="button"
                            onClick={() => setAiMode("auto")}
                            className={`px-3 py-1.5 text-xs font-bold transition-all ${aiMode === "auto" ? 'text-white' : ''}`}
                            style={{ backgroundColor: aiMode === "auto" ? '#131C15' : 'white', color: aiMode === "auto" ? 'white' : '#131C15' }}
                          >
                            🤖 Auto AI
                          </button>
                          <button
                            type="button"
                            onClick={() => setAiMode("manual")}
                            className={`px-3 py-1.5 text-xs font-bold transition-all ${aiMode === "manual" ? 'text-white' : ''}`}
                            style={{ backgroundColor: aiMode === "manual" ? '#131C15' : 'white', color: aiMode === "manual" ? 'white' : '#131C15' }}
                          >
                            ✏️ Manual
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Retry Classification Button (when image exists but no classification) */}
                    {formData.image && !classifyResult && !isClassifying && aiMode === "auto" && isAiAvailable && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(19, 28, 21, 0.1)' }}>
                        <button
                          type="button"
                          onClick={retryAiClassification}
                          className="w-full px-4 py-2 rounded-lg text-sm font-bold transition-all hover:shadow-md"
                          style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
                        >
                          🔍 Analyze Image with AI
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── STEP 1: Image Upload (FIRST) ── */}
                  <div>
                    <label
                      className="block text-sm font-bold mb-2"
                      style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                    >
                      Upload Photo *
                    </label>
                    <div
                      className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-opacity-100 transition-colors"
                      style={{ borderColor: isClassifying ? '#09E0F7' : 'rgba(9, 224, 247, 0.3)' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {imagePreview ? (
                        <div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreview}
                            alt="Upload preview"
                            className="mx-auto max-h-48 rounded-lg object-cover mb-3"
                          />
                          <p className="font-semibold text-sm" style={{ color: '#131C15' }}>
                            {formData.image?.name}
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#09E0F7' }}>
                            Click to change photo
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="text-5xl mb-3">📸</div>
                          <p className="font-semibold mb-1" style={{ color: '#131C15' }}>
                            Click to upload a photo
                          </p>
                          <p className="text-sm" style={{ color: '#131C15', opacity: 0.6 }}>
                            PNG, JPG up to 10MB — AI will instantly analyze it
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Classifying Spinner ── */}
                  {isClassifying && (
                    <div className="px-5 py-5 rounded-xl text-center" style={{ backgroundColor: 'rgba(9,224,247,0.06)' }}>
                      <div className="text-3xl mb-2 animate-pulse">🔍</div>
                      <p className="font-bold text-sm" style={{ color: '#131C15' }}>
                        CLIP is analyzing your image...
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#131C15', opacity: 0.6 }}>
                        This takes 1–2 seconds
                      </p>
                    </div>
                  )}

                  {/* ── Generating Report Spinner (after classify, before description fills) ── */}
                  {isGeneratingReport && !isClassifying && (
                    <div className="px-5 py-4 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'rgba(9,224,247,0.06)' }}>
                      <div className="text-2xl animate-pulse">📝</div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: '#131C15' }}>
                          Generating AI report for description...
                        </p>
                        <p className="text-xs" style={{ color: '#131C15', opacity: 0.6 }}>
                          Ollama is writing a detailed incident report (10–15s)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── AI Classification Preview (shows after upload) ── */}
                  {classifyResult && !isClassifying && (
                    <div className="rounded-2xl px-5 py-5" style={{ backgroundColor: 'rgba(9,224,247,0.06)' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-lg">🤖</span>
                        <h4 className="text-sm font-bold" style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}>
                          AI Classification
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#09E0F7', color: '#131C15' }}>
                          {classifyResult.inference_time_ms}ms
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl px-4 py-3 bg-white">
                          <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>DETECTED ISSUE</div>
                          <div className="font-semibold text-sm" style={{ color: '#131C15' }}>
                            {classifyResult.top_prediction.category}
                          </div>
                        </div>
                        <div className="rounded-xl px-4 py-3 bg-white">
                          <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>SEVERITY</div>
                          <div className="font-semibold text-sm" style={{ color: '#131C15' }}>
                            {classifyResult.severity.level === 'Critical' && '🔴 '}
                            {classifyResult.severity.level === 'High' && '🟠 '}
                            {classifyResult.severity.level === 'Medium' && '🟡 '}
                            {classifyResult.severity.level === 'Low' && '🟢 '}
                            {classifyResult.severity.level}
                          </div>
                        </div>
                        <div className="rounded-xl px-4 py-3 bg-white">
                          <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>CONFIDENCE</div>
                          <div className="font-semibold text-sm" style={{ color: '#131C15' }}>
                            {classifyResult.top_prediction.confidence.toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-xl px-4 py-3 bg-white">
                          <div className="text-xs font-bold mb-1" style={{ color: '#09E0F7' }}>DEPARTMENT</div>
                          <div className="font-semibold text-sm" style={{ color: '#131C15' }}>
                            {classifyResult.top_prediction.department}
                          </div>
                        </div>
                      </div>

                      {/* Top matches bar chart */}
                      {classifyResult.all_predictions && classifyResult.all_predictions.length > 1 && (
                        <div className="mt-4">
                          <div className="text-xs font-bold mb-2" style={{ color: '#131C15', opacity: 0.5 }}>TOP MATCHES</div>
                          <div className="space-y-1.5">
                            {classifyResult.all_predictions.slice(0, 3).map((pred, i) => (
                              <div key={i} className="flex items-center gap-3 min-w-0">
                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${pred.confidence.toFixed(0)}%`,
                                      backgroundColor: i === 0 ? '#09E0F7' : i === 1 ? 'rgba(9,224,247,0.5)' : 'rgba(9,224,247,0.25)',
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-semibold w-28 sm:w-44 text-right truncate" style={{ color: '#131C15' }}>
                                  {pred.category} ({pred.confidence.toFixed(1)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Routing info */}
                      <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-white" style={{ color: '#131C15', opacity: 0.7 }}>
                        ⚡ {classifyResult.confidence_routing.reason}
                      </div>
                    </div>
                  )}

                  {/* ── Severity Level (auto-detected, read-only) ── */}
                  {classifyResult && !isClassifying && (
                    <div>
                      <label
                        className="block text-sm font-bold mb-2"
                        style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                      >
                        Severity Level
                        <span className="ml-2 text-xs font-normal" style={{ color: '#09E0F7' }}>
                          auto-detected by AI
                        </span>
                      </label>
                      <div
                        className="w-full px-4 py-3 border-2 rounded-xl flex items-center gap-2 cursor-not-allowed"
                        style={{ borderColor: 'rgba(9, 224, 247, 0.3)', color: '#131C15', backgroundColor: '#F9FAFB' }}
                      >
                        {classifyResult.severity.level === 'Critical' && <span>🔴</span>}
                        {classifyResult.severity.level === 'High' && <span>🟠</span>}
                        {classifyResult.severity.level === 'Medium' && <span>🟡</span>}
                        {classifyResult.severity.level === 'Low' && <span>🟢</span>}
                        <span className="font-semibold">{classifyResult.severity.level}</span>
                        <span className="text-xs ml-auto hidden sm:inline" style={{ opacity: 0.5 }}>
                          Read-only — determined by AI analysis
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ── Title (auto-filled from classification) ── */}
                  <div>
                    <label
                      className="block text-sm font-bold mb-2"
                      style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                    >
                      Issue Title *
                      {classifyResult && (
                        <span className="ml-2 text-xs font-normal" style={{ color: '#09E0F7' }}>
                          auto-filled by AI
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Brief description of the issue"
                      className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-opacity-100 transition-colors"
                      style={{ borderColor: 'rgba(9, 224, 247, 0.3)', color: '#131C15' }}
                    />
                  </div>

                  {/* ── Category (auto-filled from classification) ── */}
                  <div>
                    <label
                      className="block text-sm font-bold mb-2"
                      style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                    >
                      Category *
                      {classifyResult && (
                        <span className="ml-2 text-xs font-normal" style={{ color: '#09E0F7' }}>
                          auto-filled by AI
                        </span>
                      )}
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-opacity-100 transition-colors"
                      style={{ borderColor: 'rgba(9, 224, 247, 0.3)', color: '#131C15' }}
                    >
                      <option value="">Select a category</option>
                      <option value="pothole">Pothole / Road Damage</option>
                      <option value="water">Water Leak / Pipe Burst</option>
                      <option value="streetlight">Broken Streetlight</option>
                      <option value="power">Power Outage / Downed Line</option>
                      <option value="tree">Fallen Tree / Debris on Road</option>
                      <option value="sidewalk">Damaged Sidewalk / Pavement</option>
                      <option value="drainage">Drain / Sewer Blockage</option>
                      <option value="traffic">Damaged Traffic Signal</option>
                      <option value="graffiti">Graffiti / Vandalism</option>
                      <option value="garbage">Garbage / Illegal Dumping</option>
                      <option value="furniture">Damaged Public Furniture</option>
                      <option value="flooding">Flooded Road / Waterlogging</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* ── Location (with geolocation) ── */}
                  <div>
                    <label
                      className="block text-sm font-bold mb-2"
                      style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                    >
                      Location *
                      {formData.locationLat && formData.locationLng && (
                        <span className="ml-2 text-xs font-normal" style={{ color: '#09E0F7' }}>
                          ✓ GPS captured
                        </span>
                      )}
                    </label>
                      <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                      <input
                        type="text"
                        required
                        value={formData.location}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: e.target.value,
                            locationLat: isLiveTracking ? formData.locationLat : null,
                            locationLng: isLiveTracking ? formData.locationLng : null,
                          })
                        }
                        placeholder="Street address or landmark"
                        className="flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-opacity-100 transition-colors"
                        style={{ borderColor: 'rgba(9, 224, 247, 0.3)', color: '#131C15' }}
                      />
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isFetchingLocation}
                        className="w-full sm:w-auto px-4 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed sm:whitespace-nowrap"
                        style={{ backgroundColor: '#09E0F7', color: '#131C15' }}
                        title="Use my current location"
                      >
                        {isFetchingLocation ? "📍 Locating..." : "📍 Use My Location"}
                      </button>
                      <button
                        type="button"
                        onClick={isLiveTracking ? stopLiveTracking : startLiveTracking}
                        className="w-full sm:w-auto px-4 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-md sm:whitespace-nowrap"
                        style={{ backgroundColor: '#131C15', color: '#FFFFFF' }}
                        title={isLiveTracking ? "Stop live location" : "Enable live location"}
                      >
                        {isLiveTracking ? "⏹ Stop Live" : "📡 Live"}
                      </button>
                    </div>

                    {/* Location permission hint */}
                    {!formData.locationLat && !isFetchingLocation && (
                      <p className="mt-2 text-xs" style={{ color: '#131C15', opacity: 0.5 }}>
                        💡 Click &quot;Use My Location&quot; and allow browser permission when prompted
                      </p>
                    )}
                  </div>

                  {/* ── Description (auto-filled with AI report after classify) ── */}
                  <div>
                    <label
                      className="block text-sm font-bold mb-2"
                      style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                    >
                      Detailed Report
                      {formData.description && classifyResult && (
                        <span className="ml-2 text-xs font-normal" style={{ color: '#09E0F7' }}>
                          AI-generated from image
                        </span>
                      )}
                      {isGeneratingReport && (
                        <span className="ml-2 text-xs font-normal animate-pulse" style={{ color: '#09E0F7' }}>
                          generating...
                        </span>
                      )}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={isGeneratingReport ? "AI is generating detailed report from image..." : "AI will auto-generate a detailed report after image upload"}
                      rows={formData.description.length > 200 ? 12 : 6}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-opacity-100 transition-colors resize-none"
                      style={{ borderColor: 'rgba(9, 224, 247, 0.3)', color: '#131C15' }}
                    />
                  </div>

                  {/* ── Submit Button ── */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                      type="submit"
                      disabled={isSubmitting || isClassifying || isGeneratingReport}
                      className="w-full sm:flex-1 px-8 py-4 rounded-xl font-bold text-white transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#131C15' }}
                    >
                      {isSubmitting ? "Submitting..." : isGeneratingReport ? "📝 Generating description..." : "Submit Report"}
                    </button>
                    <Link
                      href="/dashboard"
                      className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold transition-all border-2 text-center"
                      style={{ borderColor: '#131C15', color: '#131C15' }}
                    >
                      Cancel
                    </Link>
                  </div>

                  {/* Auto-save indicator */}
                  {(formData.title || formData.description || formData.location) && !isSaved && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#131C15", opacity: 0.4 }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Draft auto-saved · Your progress is safe if browser closes
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div className="px-5 py-4 rounded-xl text-sm font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
                      ⚠️ {error}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              {/* Guidelines */}
              <div className="bg-white rounded-3xl px-6 py-8 shadow-sm">
                <h3
                  className="text-xl font-bold mb-4"
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                >
                  Reporting Guidelines
                </h3>
                <ul className="space-y-3 text-sm" style={{ color: '#131C15', opacity: 0.7 }}>
                  <li className="flex items-start gap-2">
                    <span style={{ color: '#09E0F7' }}>✓</span>
                    <span>Provide accurate location details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: '#09E0F7' }}>✓</span>
                    <span>Include clear photos when possible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: '#09E0F7' }}>✓</span>
                    <span>Be specific about the problem</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: '#09E0F7' }}>✓</span>
                    <span>Avoid duplicate reports</span>
                  </li>
                </ul>
              </div>

              {/* Response Time */}
              <div
                className="rounded-3xl px-6 py-8"
                style={{ background: 'linear-gradient(to bottom right, rgba(9, 224, 247, 0.1), rgba(9, 224, 247, 0.2))' }}
              >
                <h3
                  className="text-xl font-bold mb-4"
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                >
                  Expected Response
                </h3>
                <div className="space-y-3 text-sm" style={{ color: '#131C15' }}>
                  <div>
                    <div className="font-bold">Emergency Issues</div>
                    <div style={{ opacity: 0.7 }}>Within 2 hours</div>
                  </div>
                  <div>
                    <div className="font-bold">High Priority</div>
                    <div style={{ opacity: 0.7 }}>Within 24 hours</div>
                  </div>
                  <div>
                    <div className="font-bold">Standard Issues</div>
                    <div style={{ opacity: 0.7 }}>Within 3-5 days</div>
                  </div>
                </div>
              </div>

              {/* Track Reports */}
              <div className="bg-white rounded-3xl px-6 py-8 shadow-sm">
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                >
                  Track Your Reports
                </h3>
                <p className="text-sm mb-4" style={{ color: '#131C15', opacity: 0.7 }}>
                  Monitor the status of your submitted reports in real-time.
                </p>
                <Link
                  href="/reporting/track"
                  className="block text-center px-6 py-3 rounded-xl font-bold transition-all border-2"
                  style={{ borderColor: '#09E0F7', color: '#09E0F7' }}
                >
                  View My Reports
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

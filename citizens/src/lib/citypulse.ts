/**
 * CityPulse AI/ML Backend API Client
 * Connects to the FastAPI backend running CLIP + Ollama
 */

const API_BASE = process.env.NEXT_PUBLIC_CITYPULSE_API || "http://localhost:8000";

let cityPulseAvailabilityCache: { ok: boolean; checkedAt: number } | null = null;

export async function isCityPulseAvailable(timeoutMs: number = 6000): Promise<boolean> {
  const now = Date.now();
  // Cache successful checks for 15s, but failed checks only for 5s (retry sooner)
  const cacheTtl = cityPulseAvailabilityCache?.ok ? 15_000 : 5_000;
  if (cityPulseAvailabilityCache && now - cityPulseAvailabilityCache.checkedAt < cacheTtl) {
    return cityPulseAvailabilityCache.ok;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    const ok = res.ok;
    cityPulseAvailabilityCache = { ok, checkedAt: now };
    return ok;
  } catch {
    cityPulseAvailabilityCache = { ok: false, checkedAt: now };
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Force refresh availability check
export function resetCityPulseAvailabilityCache() {
  cityPulseAvailabilityCache = null;
}

// ──── Types (matching actual app.py responses) ─────────────────────

export interface TopPrediction {
  category: string;
  confidence: number;
  department: string;
  priority: string;
  effective_priority: string;
}

export interface ClassifyResponse {
  top_prediction: TopPrediction;
  severity: {
    level: string;
    scores: Record<string, number>;
  };
  confidence_routing: {
    action: string;
    reason: string;
  };
  all_predictions: TopPrediction[];
  timestamp: string;
  filename: string;
  inference_time_ms: number;
  device: string;
}

export interface FullPipelineResponse {
  classification: ClassifyResponse;
  report: string;                       // plain text report from Ollama
  confidence_scores: {
    image_confidence: number;
    text_relevance: number;
    combined_confidence: number;
  };
  metadata: {
    location: string;
    citizen_description: string;
    generated_at: string;
    filename: string;
    device: string;
  };
}

export interface GenerateReportResponse {
  report: string;
  metadata: {
    category: string;
    department: string;
    priority: string;
    severity: string;
    location: string;
    generated_at: string;
    model: string;
  };
}

export interface ChatResponse {
  reply: string;
  timestamp: string;
}

export interface SummarizeIncidentsRequest {
  incidents: Array<{
    category: string;
    location: string;
    severity: string;
    count?: number;
  }>;
}

export interface SummarizeIncidentsResponse {
  summary: string;
  incident_count: number;
  generated_at: string;
}

export interface ZoneIncident {
  category: string;
  severity: string;
  lat: number;
  lng: number;
  zone?: string;
}

export interface ZoneHotspot {
  zone: string;
  incident_count: number;
  severity_score: number;
  density_rating: string;
  top_issue_type: string;
  center: { lat: number; lng: number };
}

export interface ZoneAnalysisResponse {
  hotspots: ZoneHotspot[];
  total_incidents: number;
  total_zones: number;
  ai_insight: string;
  generated_at: string;
}

export interface RecentIncident {
  incidentCode?: string | null;
  title?: string;
  description?: string;
  category?: string;
  severityLevel?: string;
  priority?: string;
  department?: string;
  status?: string;
  createdAt?: string | Date;
  location?:
    | string
    | {
        address?: string;
      };
}

// ──── API Functions ────────────────────────────────────────────────

/**
 * Classify image only — instant CLIP classification (0.5-2s)
 */
export async function classifyImage(file: File): Promise<ClassifyResponse> {
  const available = await isCityPulseAvailable();
  if (!available) {
    throw new Error('CityPulse backend is unavailable');
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/classify`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Generate report from classification data (5-15s, Ollama)
 */
export async function generateReport(params: {
  category: string;
  confidence: number;
  department: string;
  priority: string;
  severity?: string;
  location?: string;
  description?: string;
}): Promise<GenerateReportResponse> {
  const available = await isCityPulseAvailable();
  if (!available) {
    throw new Error('CityPulse backend is unavailable');
  }

  const res = await fetch(`${API_BASE}/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Full pipeline: classify image + generate AI report (6-18s)
 */
export async function classifyAndReport(
  file: File,
  location: string,
  description: string
): Promise<FullPipelineResponse> {
  const available = await isCityPulseAvailable();
  if (!available) {
    throw new Error('CityPulse backend is unavailable');
  }

  const form = new FormData();
  form.append("file", file);
  form.append("location", location);
  form.append("description", description);

  const res = await fetch(`${API_BASE}/classify-and-report`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * Stream report generation - calls onChunk for each piece of text as it arrives
 */
export async function generateReportStream(
  params: {
    category: string;
    confidence: number;
    department: string;
    priority: string;
    severity?: string;
    location?: string;
    description?: string;
  },
  onChunk: (chunk: string) => void
): Promise<string> {
  const res = await fetch(`${API_BASE}/generate-report-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok || !res.body) {
    throw new Error("Failed to start streaming");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.chunk) {
            fullText += data.chunk;
            onChunk(data.chunk);
          }
          if (data.done) {
            return data.full_text || fullText;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return fullText;
}

/**
 * Fetch recent incidents from MongoDB (via Next.js API route)
 */
export async function fetchRecentIncidents(): Promise<RecentIncident[]> {
  try {
    const res = await fetch("/api/reports/recent");
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: RecentIncident[] };
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Build a context string from incident data for the chatbot
 */
export function buildIncidentContext(incidents: RecentIncident[]): string {
  if (!incidents.length) return "";
  const maxItems = 25;
  const slice = incidents.slice(0, maxItems);
  const lines = slice.map((inc: RecentIncident, i: number) => {
    const loc =
      typeof inc.location === 'string'
        ? (inc.location.trim() || "Not provided")
        : (inc.location?.address || "Not provided");
    const date = inc.createdAt ? new Date(inc.createdAt).toISOString().slice(0, 10) : "Unknown";
    const status = (inc.status || "pending").toString().toUpperCase();
    const title = inc.title || inc.category || "Untitled";
    const code = (inc.incidentCode || "").toString().trim();
    const desc = (inc.description || "").toString().trim();
    const descSnippet = desc ? (desc.length > 160 ? `${desc.slice(0, 160)}…` : desc) : "";
    return [
      `${i + 1}) ${title}${code ? ` (Code: ${code})` : ""}`,
      `- Status: ${status}`,
      `- Category: ${inc.category || "other"}`,
      `- Severity: ${inc.severityLevel || "Unknown"}`,
      `- Priority: ${inc.priority || "medium"}`,
      `- Department: ${inc.department || "N/A"}`,
      `- Location: ${loc}`,
      `- Reported: ${date}`,
      descSnippet ? `- Description: ${descSnippet}` : null,
    ].filter(Boolean).join("\n");
  });

  return [
    `INCIDENT SNAPSHOT (${slice.length} most recent reports):`,
    "Rules: Use ONLY this snapshot for incident-specific facts. If a detail is missing, say so. When referencing an incident, cite its item number and/or Code.",
    "",
    lines.join("\n\n"),
  ].join("\n");
}

/**
 * Chat with AI assistant about city issues
 */
export async function chat(message: string, context?: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context: context || "" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Stream chat reply chunks (SSE) so the UI can render incremental text.
 */
export async function chatStream(
  message: string,
  context: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const res = await fetch(`${API_BASE}/chat-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context: context || "" }),
  });

  const simulateTyping = async (text: string) => {
    const parts = text.split(/(\s+)/).filter((p) => p.length > 0);
    let full = "";
    for (const part of parts) {
      full += part;
      onChunk(part);
      // Small delay for a "typing" feel (kept minimal so it doesn't feel slow)
      await new Promise<void>((resolve) => setTimeout(resolve, 18));
    }
    return full;
  };

  // Backward compatibility: if the backend doesn't have /chat-stream yet,
  // fall back to /chat and simulate incremental output.
  if (res.status === 404 || res.status === 405) {
    const full = await chat(message, context);
    return simulateTyping(full.reply || "");
  }

  if (!res.ok || !res.body) {
    // If we got a non-stream response but it's still usable, fall back.
    if (res.ok) {
      const full = await chat(message, context);
      return simulateTyping(full.reply || "");
    }
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.chunk) {
            fullText += data.chunk;
            onChunk(data.chunk);
          }
          if (data.done) {
            return data.full_text || fullText;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  return fullText;
}

/**
 * Get team assignment for a department
 */
export async function assignTeam(
  department: string,
  severity: string,
  location: string
) {
  const res = await fetch(`${API_BASE}/assign-team`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ department, severity, location }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend unreachable");
  return res.json();
}

/**
 * Summarize grouped incidents for executive dashboard
 */
export async function summarizeIncidents(
  incidents: SummarizeIncidentsRequest["incidents"]
): Promise<SummarizeIncidentsResponse> {
  const res = await fetch(`${API_BASE}/summarize-incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidents }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Zone-wise hotspot analysis for heatmap/analytics
 */
export async function zoneAnalysis(
  incidents: ZoneIncident[]
): Promise<ZoneAnalysisResponse> {
  const res = await fetch(`${API_BASE}/zone-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidents }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Save report to database via /api/issues (PostgreSQL first, then MongoDB)
 */
export async function saveReportToDB(data: {
  title: string;
  description: string;
  category: string;
  location: string;
  locationLat?: number | null;
  locationLng?: number | null;
  citizenImageUrl?: string | null;
  severityLevel: string;
  department: string;
  priority: string;
  aiConfidence: number;
  imageUrl?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const locationPayload =
    typeof data.locationLat === 'number' && typeof data.locationLng === 'number'
      ? { address: data.location, lat: data.locationLat, lng: data.locationLng }
      : { address: data.location };

  const res = await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      location: locationPayload,
    }),
  });
  return res.json();
}

// ──── Helpers ──────────────────────────────────────────────────────

/**
 * Filter AI report to show only these sections:
 * INCIDENT SUMMARY, ISSUE DETAILS, RECOMMENDED ACTIONS, ESTIMATED URGENCY & REASONING
 */
export function filterReportSections(report: string): string {
  const wanted = [
    'INCIDENT SUMMARY',
    'ISSUE DETAILS',
    'RECOMMENDED ACTIONS',
    'ESTIMATED URGENCY',
  ];
  const unwanted = [
    'SAFETY ADVISORY',
    'ESTIMATED RESOLUTION TIME',
    'RESOLUTION TIME',
  ];

  const lines = report.split('\n');
  const result: string[] = [];
  let keep = false;

  for (const line of lines) {
    const normalized = line.toUpperCase().replace(/[*#\-_:]/g, '').replace(/^\d+\.\s*/, '').trim();
    const isWanted = wanted.some((kw) => normalized.includes(kw));
    const isUnwanted = unwanted.some((kw) => normalized.includes(kw));

    if (isWanted) {
      keep = true;
      result.push(line);
    } else if (isUnwanted) {
      keep = false;
    } else if (keep) {
      result.push(line);
    }
  }

  const filtered = result.join('\n').trim();

  const text = (filtered || report).trim();
  if (!text) return report;

  // ---- Formatting pass (plain text, readable in textarea) ----
  // Normalize headings and clean up list formatting.
  const lines2 = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd());

  const headingMap: Array<{ match: RegExp; title: string }> = [
    { match: /INCIDENT\s+SUMMARY/i, title: "INCIDENT SUMMARY" },
    { match: /ISSUE\s+DETAILS/i, title: "ISSUE DETAILS" },
    { match: /RECOMMENDED\s+ACTIONS?/i, title: "RECOMMENDED ACTIONS" },
    { match: /ESTIMATED\s+URGENCY(\s*&\s*REASONING)?/i, title: "ESTIMATED URGENCY & REASONING" },
  ];

  const out: string[] = [];
  let inActions = false;

  const pushBlank = () => {
    if (out.length > 0 && out[out.length - 1] !== "") out.push("");
  };

  for (const rawLine of lines2) {
    const line = rawLine.trim();
    if (!line) {
      // Collapse multiple blank lines.
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }

    const normalized = line.replace(/^[*#\-\s]+/, "");
    const heading = headingMap.find((h) => h.match.test(normalized));
    if (heading) {
      pushBlank();
      out.push(`${heading.title}:`);
      out.push("");
      inActions = heading.title === "RECOMMENDED ACTIONS";
      continue;
    }

    // Convert numbered steps under RECOMMENDED ACTIONS into bullet points.
    if (inActions) {
      const m = normalized.match(/^\s*(\d+)\.[\s]+(.+)$/);
      if (m) {
        out.push(`- ${m[2].trim()}`);
        continue;
      }
      // Also accept existing bullets.
      const b = normalized.match(/^[-•]\s+(.+)$/);
      if (b) {
        out.push(`- ${b[1].trim()}`);
        continue;
      }
    }

    // Fix occasional run-on glue like "damage.imperove" → "damage."
    const cleaned = normalized.replace(/\.(?=[A-Za-z]{2,})/g, ". ");
    out.push(cleaned);
  }

  // Trim leading/trailing blank lines.
  while (out[0] === "") out.shift();
  while (out[out.length - 1] === "") out.pop();

  return out.join("\n").trim();
}

/** Map CLIP category → form dropdown value */
export function categoryToDropdown(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("pothole") || lower.includes("road damage")) return "pothole";
  if (lower.includes("water") || lower.includes("pipe")) return "water";
  if (lower.includes("streetlight")) return "streetlight";
  if (lower.includes("power") || lower.includes("electric") || lower.includes("downed line")) return "power";
  if (lower.includes("fallen tree") || lower.includes("debris")) return "tree";
  if (lower.includes("sidewalk") || lower.includes("pavement")) return "sidewalk";
  if (lower.includes("drain") || lower.includes("sewer")) return "drainage";
  if (lower.includes("traffic") || lower.includes("signal")) return "traffic";
  if (lower.includes("graffiti") || lower.includes("vandalism")) return "graffiti";
  if (lower.includes("garbage") || lower.includes("dumping") || lower.includes("waste")) return "garbage";
  if (lower.includes("bench") || lower.includes("furniture")) return "furniture";
  if (lower.includes("flood") || lower.includes("waterlog")) return "flooding";
  return "other";
}

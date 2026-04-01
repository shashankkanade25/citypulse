import crypto from "crypto";

export function normalizeIssueText(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function roundCoord(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function geoCell(lat: number, lng: number, decimals = 3): string {
  return `${roundCoord(lat, decimals)},${roundCoord(lng, decimals)}`;
}

export function sha1Hex(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function jaccardSimilarity(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 && bTokens.size === 0) return 1;
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) intersection++;
  }
  const union = aTokens.size + bTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function buildDedupeKey(input: {
  lat: number;
  lng: number;
  title: string;
  description: string;
}): {
  key: string;
  geo: string;
  text: string;
  textHash: string;
} {
  const text = normalizeIssueText(`${input.title} ${input.description}`);
  const geo = geoCell(input.lat, input.lng, 3);
  const textHash = sha1Hex(text);
  // Key is stable + short, and avoids leaking full text into indexed fields.
  const key = `${geo}:${textHash}`;

  return { key, geo, text, textHash };
}

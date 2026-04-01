import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geocode/reverse?lat=...&lon=...
 * Server-side proxy for Nominatim reverse geocoding.
 * Avoids browser CORS blocks and sets a proper User-Agent.
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "CityPulse/1.0 (citypulse-citizen-portal)",
        "Accept-Language": "en",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Nominatim returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Geocode] Reverse geocoding failed:", error);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
}

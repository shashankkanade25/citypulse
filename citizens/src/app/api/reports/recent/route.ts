import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Issue from "@/lib/models/Issue";

/**
 * GET /api/reports/recent — Fetch all incidents from MongoDB
 * Returns issues sorted by newest first (used as chatbot context)
 */
export async function GET() {
  try {
    await connectDB();

    const issues = await Issue.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .select("incidentCode title description category priority status severityLevel department aiConfidence location createdAt reporterName")
      .lean();

    return NextResponse.json({ success: true, data: issues });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch incidents";
    console.error("Fetch incidents error:", error);
    return NextResponse.json(
      { success: false, error: message, data: [] },
      { status: 500 }
    );
  }
}

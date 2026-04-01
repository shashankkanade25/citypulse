import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { seedWorkersAndHistory, cleanupAndReseed } from "@/lib/server/workerSeed";

/**
 * POST /api/head/seed
 * Seeds fake workers + incident history for demo / AI recommendation testing.
 * Add ?reset=true to clean up all junk data first and force re-seed.
 * Only accessible by AUTHORITY_HEAD.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "AUTHORITY_HEAD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "true";

  if (reset) {
    const result = await cleanupAndReseed();
    return NextResponse.json({
      message: `Cleanup complete! Deleted ${result.deletedWorkers} junk workers + ${result.deletedIncidents} bad incidents. Re-seeded ${result.workersCreated} workers + ${result.incidentsCreated} incidents.`,
      ...result,
    });
  }

  const result = await seedWorkersAndHistory();

  if (result.skipped) {
    return NextResponse.json({
      message: "Seed data already exists. Use ?reset=true to force cleanup + re-seed.",
      ...result,
    });
  }

  return NextResponse.json({
    message: `Seeded ${result.workersCreated} workers and ${result.incidentsCreated} incidents successfully!`,
    ...result,
  });
}

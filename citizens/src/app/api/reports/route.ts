import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import Issue from "@/lib/models/Issue";
import { dualWritePostgresFirst } from "@/lib/server/dualWrite";
import { publishEvent, TOPICS } from "@/lib/kafka";
import { sendMail } from "@/lib/email";
import { complaintFiledTemplate } from "@/lib/emailTemplates";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const conn = await connectDB();
    const dbName = conn.connection.db?.databaseName;
    const collectionName = Issue.collection.name;

    const items = await Issue.find({ reportedBy: user.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: items,
        metadata: { dbName, collectionName, count: items.length },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reports";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/reports — Save a citizen report to MongoDB
 * Requires JWT cookie auth
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "other").trim();
    const priority = String(body.priority || "medium").trim();

    const locationObj = body.location && typeof body.location === "object" ? (body.location as Record<string, unknown>) : null;
    const locationAddress = String((locationObj?.address as unknown) ?? body.location ?? "").trim();
    const latRaw = (locationObj?.lat as unknown) ?? (locationObj?.latitude as unknown);
    const lngRaw = (locationObj?.lng as unknown) ?? (locationObj?.longitude as unknown);
    const locationLat = typeof latRaw === "number" ? latRaw : null;
    const locationLng = typeof lngRaw === "number" ? lngRaw : null;

    if (!title || !description || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (title, description, category)" },
        { status: 400 }
      );
    }

    const incidentCode = "report_" + Date.now();

    const issue = await dualWritePostgresFirst({
      pg: async (client) => {
        // Upsert department
        const departmentName = String(body.department || "General").trim();
        const departmentCode = departmentName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "GENERAL";
        const catUpper = category.trim().toUpperCase();

        const dep = await client.query(
          `INSERT INTO departments(name, code, category, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (code)
           DO UPDATE SET name = EXCLUDED.name, updated_at = now()
           RETURNING id`,
          [departmentName, departmentCode, ["POWER", "WATER", "ROAD"].includes(catUpper) ? catUpper : null]
        );
        const departmentId = dep.rows[0]?.id;

        await client.query(
          `INSERT INTO incidents(
            incident_code, title, description, severity, status,
            department_id, zone, department_name, category,
            confidence_score, citizen_external_id,
            latitude, longitude, metadata, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now()
          )
          ON CONFLICT (incident_code) DO NOTHING`,
          [
            incidentCode,
            title,
            description,
            body.severityLevel || "MEDIUM",
            "OPEN",
            departmentId,
            "UNKNOWN",
            departmentName,
            ["POWER", "WATER", "ROAD"].includes(catUpper) ? catUpper : null,
            typeof body.aiConfidence === "number" ? body.aiConfidence : null,
            user.userId,
            locationLat,
            locationLng,
            JSON.stringify({ source: "citizens-report" }),
          ]
        );
      },
      primary: async () => {
        return await Issue.create({
          reportedBy: user.userId,
          reporterEmail: user.email,
          reporterName: user.name,
          reporterRole: user.role,
          title,
          description,
          category,
          priority,
          status: "pending",
          severityLevel: body.severityLevel,
          department: body.department,
          aiConfidence: typeof body.aiConfidence === "number"
            ? (body.aiConfidence > 1 ? body.aiConfidence / 100 : body.aiConfidence)
            : 0,
          location: locationAddress
            ? { address: locationAddress, lat: locationLat, lng: locationLng }
            : undefined,
        });
      },
    });

    // Send confirmation email (awaited so logs appear before function exits)
    if (user.email) {
      console.log(`[Report] Attempting to send confirmation email to ${user.email}`);
      const emailContent = complaintFiledTemplate({
        name: user.name || "Citizen",
        title,
        category,
        description: description.length > 200 ? description.slice(0, 200) + "..." : description,
        department: String(body.department || "General"),
        priority,
        date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        imageUrl: body.imageUrl || undefined,
      });
      await sendMail({ to: user.email, ...emailContent });
      console.log(`[Report] Email send attempt completed for ${user.email}`);
    } else {
      console.log(`[Report] No email on user — skipping confirmation email. user:`, JSON.stringify({ userId: user.userId, email: user.email, name: user.name }));
    }

    return NextResponse.json(
      { success: true, data: issue, message: "Report saved successfully" },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to save report";
    console.error("Save report error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

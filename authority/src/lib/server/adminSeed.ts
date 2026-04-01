import { IncidentModel } from "@/lib/database/models/incident.model";
import { AdminUserModel } from "@/lib/database/models/adminUser.model";
import { SystemConfigModel } from "@/lib/database/models/systemConfig.model";
import { AbuseCaseModel } from "@/lib/database/models/abuseCase.model";
import { mongoWriteAllowed } from "@/lib/server/dualWrite";

export async function ensureAdminSeeded(): Promise<void> {
  // Skip Mongo seeding when Mongo is read-only
  if (!mongoWriteAllowed()) {
    console.info("[adminSeed] Skipped — MONGO_READ_ONLY is enabled.");
    return;
  }
  const [incidentCount, userCount, configCount] = await Promise.all([
    IncidentModel.countDocuments(),
    AdminUserModel.countDocuments(),
    SystemConfigModel.countDocuments(),
  ]);

  const abuseCount = await AbuseCaseModel.countDocuments();

  if (incidentCount === 0) {
    await IncidentModel.insertMany([
      {
        incidentId: "INC-FLG-1021",
        title: "Water leak near Ward 12",
        description: "Leakage reported near the main road. Water pooling observed.",
        speechToText: "water leaking near ward twelve main road",
        zone: "Zone B",
        department: "Water",
        severity: "High",
        status: "Active",
        confidence: 0.42,
        reasons: ["Low confidence", "Duplicate cluster"],
        citizenId: "CIT-0441",
        citizenReportCount30d: 14,
        duplicateClusterId: "DUP-77",
        images: [
          "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?w=1200&auto=format&fit=crop",
        ],
        moderation: { status: "pending", citizenFlagged: false },
      },
      {
        incidentId: "INC-FLG-1044",
        title: "Streetlight outage claim",
        description: "Citizen claims multiple lights are off but images appear unrelated.",
        speechToText: "all lights are off in my street",
        zone: "Zone D",
        department: "Electricity",
        severity: "Low",
        status: "Active",
        confidence: 0.33,
        reasons: ["Conflicting media", "User abuse"],
        citizenId: "CIT-0209",
        citizenReportCount30d: 22,
        images: [
          "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&auto=format&fit=crop",
        ],
        moderation: { status: "pending", citizenFlagged: false },
      },
      {
        incidentId: "INC-001",
        title: "Pothole on Main St",
        description: "Reported pothole causing traffic disruption.",
        speechToText: "pothole on main street",
        zone: "Zone A",
        department: "Roads",
        severity: "High",
        status: "Active",
        confidence: 0.93,
        reasons: [],
        citizenId: "CIT-0101",
        citizenReportCount30d: 3,
        images: [],
        moderation: { status: "approved", citizenFlagged: false, lastRemark: "auto-approved seed" },
      },
      {
        incidentId: "INC-002",
        title: "Garbage overflow near market",
        description: "Overflowing bins reported near the main market.",
        speechToText: "garbage overflow in market",
        zone: "Zone B",
        department: "Sanitation",
        severity: "Medium",
        status: "On Hold",
        confidence: 0.88,
        reasons: [],
        citizenId: "CIT-0110",
        citizenReportCount30d: 6,
        images: [],
        moderation: { status: "approved", citizenFlagged: false, lastRemark: "auto-approved seed" },
      },
      {
        incidentId: "INC-003",
        title: "Water leak reported",
        description: "Pipeline leak suspected behind the school.",
        speechToText: "pipeline leak behind school",
        zone: "Zone B",
        department: "Water",
        severity: "High",
        status: "Active",
        confidence: 0.61,
        reasons: [],
        citizenId: "CIT-0122",
        citizenReportCount30d: 5,
        images: [],
        moderation: { status: "approved", citizenFlagged: false, lastRemark: "auto-approved seed" },
      },
      {
        incidentId: "INC-004",
        title: "Streetlight out",
        description: "Streetlight outage reported on 5th Avenue.",
        speechToText: "streetlight out",
        zone: "Zone D",
        department: "Electricity",
        severity: "Low",
        status: "Resolved",
        confidence: 0.79,
        reasons: [],
        citizenId: "CIT-0188",
        citizenReportCount30d: 2,
        images: [],
        moderation: { status: "approved", citizenFlagged: false, lastRemark: "auto-approved seed" },
      },
      {
        incidentId: "INC-005",
        title: "Drain blockage",
        description: "Drain blocked and overflowing after rain.",
        speechToText: "drain blockage overflow",
        zone: "Zone C",
        department: "Water",
        severity: "Critical",
        status: "Active",
        confidence: 0.84,
        reasons: [],
        citizenId: "CIT-0211",
        citizenReportCount30d: 4,
        images: [],
        moderation: { status: "approved", citizenFlagged: false, lastRemark: "auto-approved seed" },
      },
    ]);
  }

  if (userCount === 0) {
    await AdminUserModel.insertMany([
      {
        userId: "ADM-0001",
        name: "System Admin",
        email: "admin@protocol.local",
        role: "Admin",
        department: "All",
        active: true,
      },
      {
        userId: "AUD-0001",
        name: "Audit Reviewer",
        email: "audit@protocol.local",
        role: "Auditor",
        department: "All",
        active: true,
      },
    ]);
  }

  if (configCount === 0) {
    await SystemConfigModel.insertMany([
      { key: "ml.confidenceThreshold", value: 0.5 },
      { key: "abuse.maxReportsPerDay", value: 20 },
      { key: "moderation.requireRemark", value: false },
    ]);
  }

  if (abuseCount === 0) {
    await AbuseCaseModel.insertMany([
      {
        caseId: "AB-001",
        citizenId: "CIT-0209",
        reason: "Repeated low-confidence",
        risk: "High",
        lastSeen: new Date("2026-02-07T07:10:00Z"),
        status: "Monitoring",
      },
      {
        caseId: "AB-004",
        citizenId: "CIT-0441",
        reason: "Spam",
        risk: "Medium",
        lastSeen: new Date("2026-02-06T22:40:00Z"),
        status: "Warned",
      },
      {
        caseId: "AB-007",
        citizenId: "CIT-0102",
        reason: "Harassment",
        risk: "High",
        lastSeen: new Date("2026-02-07T05:55:00Z"),
        status: "Temporarily blocked",
        blockedUntil: new Date("2026-02-10T00:00:00Z"),
      },
    ]);
  }
}

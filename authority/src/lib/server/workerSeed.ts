import User from "@/lib/database/models/user.model";
import { IncidentModel } from "@/lib/database/models/incident.model";
import bcrypt from "bcryptjs";

const WORKER_PASSWORD = "worker123"; // All seed workers share a password for demo

const SEED_WORKERS = [
  { username: "rajesh.patil",  name: "Rajesh Patil",   email: "rajesh.patil@citypulse.in",  zone: "Zone A", phone: "9876543210" },
  { username: "priya.sharma",  name: "Priya Sharma",   email: "priya.sharma@citypulse.in",  zone: "Zone A", phone: "9876543211" },
  { username: "amit.deshmukh", name: "Amit Deshmukh",  email: "amit.deshmukh@citypulse.in", zone: "Zone B", phone: "9876543212" },
  { username: "sonal.joshi",   name: "Sonal Joshi",    email: "sonal.joshi@citypulse.in",   zone: "Zone B", phone: "9876543213" },
  { username: "vikram.more",   name: "Vikram More",    email: "vikram.more@citypulse.in",   zone: "Zone C", phone: "9876543214" },
  { username: "neha.kulkarni", name: "Neha Kulkarni",  email: "neha.kulkarni@citypulse.in", zone: "Zone C", phone: "9876543215" },
  { username: "suresh.gaikwad",name: "Suresh Gaikwad", email: "suresh.gaikwad@citypulse.in",zone: "Zone D", phone: "9876543216" },
  { username: "anjali.pawar",  name: "Anjali Pawar",   email: "anjali.pawar@citypulse.in",  zone: "Zone D", phone: "9876543217" },
];

function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}
function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

/**
 * Seed incidents that give workers varied history:
 * - Some resolved (past work), some active (current load)
 * - Different severities, zones, departments
 * - Different assignedTo arrays so workers have different workloads
 */
const SEED_INCIDENTS = [
  // ── Active incidents (create current workload) ──
  {
    incidentId: "INC-SEED-101",
    title: "Major pothole on MG Road",
    description: "Large pothole causing vehicle damage near MG Road junction. Multiple citizens affected.",
    speechToText: "big pothole on mg road causing accidents",
    zone: "Zone A", department: "Roads", severity: "Critical", status: "Active",
    confidence: 0.92, reasons: [], citizenId: "CIT-0301", citizenReportCount30d: 2,
    images: [], assignedTo: ["Rajesh Patil", "Priya Sharma"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(18), updatedAt: hoursAgo(16),
  },
  {
    incidentId: "INC-SEED-102",
    title: "Water pipe burst at Shivaji Nagar",
    description: "Main pipeline burst flooding the street. Water supply disrupted to 200+ homes.",
    speechToText: "pipe burst in shivaji nagar water everywhere",
    zone: "Zone B", department: "Water", severity: "Critical", status: "Active",
    confidence: 0.95, reasons: [], citizenId: "CIT-0310", citizenReportCount30d: 1,
    images: [], assignedTo: ["Amit Deshmukh"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(10), updatedAt: hoursAgo(8),
  },
  {
    incidentId: "INC-SEED-103",
    title: "Drain overflow near school",
    description: "Blocked drain causing sewage overflow near primary school entrance.",
    speechToText: "drain overflowing near school very dirty",
    zone: "Zone C", department: "Water", severity: "High", status: "Active",
    confidence: 0.87, reasons: [], citizenId: "CIT-0322", citizenReportCount30d: 3,
    images: [], assignedTo: ["Vikram More"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(36), updatedAt: hoursAgo(30),
  },
  {
    incidentId: "INC-SEED-104",
    title: "Streetlights out on Ring Road",
    description: "Section of 8 streetlights not working. Unsafe for pedestrians at night.",
    speechToText: "all street lights off on ring road very dark",
    zone: "Zone D", department: "Electricity", severity: "Medium", status: "Active",
    confidence: 0.81, reasons: [], citizenId: "CIT-0335", citizenReportCount30d: 1,
    images: [], assignedTo: ["Suresh Gaikwad"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: daysAgo(2), updatedAt: daysAgo(1),
  },
  {
    incidentId: "INC-SEED-105",
    title: "Garbage dumping near lake",
    description: "Illegal waste dumping spotted near City Lake polluting the water body.",
    speechToText: "garbage being thrown near the lake",
    zone: "Zone A", department: "Sanitation", severity: "High", status: "Active",
    confidence: 0.89, reasons: [], citizenId: "CIT-0341", citizenReportCount30d: 2,
    images: [], assignedTo: ["Rajesh Patil"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: daysAgo(1), updatedAt: hoursAgo(20),
  },
  {
    incidentId: "INC-SEED-106",
    title: "Traffic signal malfunction at Deccan",
    description: "Traffic signal stuck on red for all directions causing major congestion.",
    speechToText: "traffic signal not working at deccan junction",
    zone: "Zone B", department: "Roads", severity: "Critical", status: "Active",
    confidence: 0.94, reasons: [], citizenId: "CIT-0350", citizenReportCount30d: 1,
    images: [], assignedTo: ["Sonal Joshi", "Amit Deshmukh"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(6), updatedAt: hoursAgo(4),
  },
  {
    incidentId: "INC-SEED-107",
    title: "Fallen tree blocking road",
    description: "Large tree fallen after last night's storm blocking the entire road.",
    speechToText: "tree fell on the road cannot pass",
    zone: "Zone C", department: "Roads", severity: "High", status: "Active",
    confidence: 0.91, reasons: [], citizenId: "CIT-0355", citizenReportCount30d: 1,
    images: [], assignedTo: ["Vikram More", "Neha Kulkarni"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(14), updatedAt: hoursAgo(12),
  },
  {
    incidentId: "INC-SEED-108",
    title: "Power cable hanging dangerously",
    description: "Low hanging power cable at eye level near bus stop. Immediate electrocution risk.",
    speechToText: "electric cable hanging near bus stop very dangerous",
    zone: "Zone D", department: "Electricity", severity: "Critical", status: "Active",
    confidence: 0.96, reasons: [], citizenId: "CIT-0360", citizenReportCount30d: 1,
    images: [], assignedTo: ["Anjali Pawar", "Suresh Gaikwad"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(4), updatedAt: hoursAgo(3),
  },

  // ── Resolved incidents (past history) ──
  {
    incidentId: "INC-SEED-201",
    title: "Pothole fixed on FC Road",
    description: "Medium pothole repaired on FC Road near college.",
    speechToText: "pothole on fc road",
    zone: "Zone A", department: "Roads", severity: "Medium", status: "Resolved",
    confidence: 0.85, reasons: [], citizenId: "CIT-0401", citizenReportCount30d: 1,
    images: [], assignedTo: ["Rajesh Patil"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "resolved" },
    createdAt: daysAgo(10), updatedAt: daysAgo(8),
  },
  {
    incidentId: "INC-SEED-202",
    title: "Water leak resolved at Market Yard",
    description: "Underground pipe leak sealed at Market Yard area.",
    speechToText: "water leak at market yard",
    zone: "Zone B", department: "Water", severity: "High", status: "Resolved",
    confidence: 0.90, reasons: [], citizenId: "CIT-0402", citizenReportCount30d: 2,
    images: [], assignedTo: ["Amit Deshmukh", "Sonal Joshi"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "resolved" },
    createdAt: daysAgo(15), updatedAt: daysAgo(14),
  },
  {
    incidentId: "INC-SEED-203",
    title: "Streetlight replaced at Kothrud",
    description: "Damaged streetlight bulb replaced on main road.",
    speechToText: "light not working in kothrud",
    zone: "Zone C", department: "Electricity", severity: "Low", status: "Resolved",
    confidence: 0.78, reasons: [], citizenId: "CIT-0403", citizenReportCount30d: 1,
    images: [], assignedTo: ["Neha Kulkarni"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "resolved" },
    createdAt: daysAgo(20), updatedAt: daysAgo(19),
  },
  {
    incidentId: "INC-SEED-204",
    title: "Garbage cleared from Baner Road",
    description: "Illegal dump site cleaned up near Baner residential area.",
    speechToText: "garbage dump on baner road",
    zone: "Zone A", department: "Sanitation", severity: "Medium", status: "Resolved",
    confidence: 0.82, reasons: [], citizenId: "CIT-0404", citizenReportCount30d: 3,
    images: [], assignedTo: ["Priya Sharma"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "resolved" },
    createdAt: daysAgo(12), updatedAt: daysAgo(11),
  },
  {
    incidentId: "INC-SEED-205",
    title: "Drain unclogged at Camp area",
    description: "Storm drain blockage cleared preventing possible flooding.",
    speechToText: "drain blocked in camp area",
    zone: "Zone D", department: "Water", severity: "High", status: "Resolved",
    confidence: 0.88, reasons: [], citizenId: "CIT-0405", citizenReportCount30d: 1,
    images: [], assignedTo: ["Suresh Gaikwad", "Anjali Pawar"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "resolved" },
    createdAt: daysAgo(7), updatedAt: daysAgo(5),
  },
  {
    incidentId: "INC-SEED-206",
    title: "Road resurfaced at Hadapsar",
    description: "Complete road resurfacing done after multiple pothole reports.",
    speechToText: "road is very bad at hadapsar",
    zone: "Zone C", department: "Roads", severity: "Critical", status: "Resolved",
    confidence: 0.93, reasons: [], citizenId: "CIT-0406", citizenReportCount30d: 5,
    images: [], assignedTo: ["Vikram More", "Neha Kulkarni"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "resolved" },
    createdAt: daysAgo(25), updatedAt: daysAgo(22),
  },
  {
    incidentId: "INC-SEED-207",
    title: "Power lines repaired post-storm",
    description: "Downed power lines restored after storm damage in residential area.",
    speechToText: "power lines down after storm",
    zone: "Zone B", department: "Electricity", severity: "Critical", status: "Resolved",
    confidence: 0.97, reasons: [], citizenId: "CIT-0407", citizenReportCount30d: 1,
    images: [], assignedTo: ["Amit Deshmukh"],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "resolved" },
    createdAt: daysAgo(18), updatedAt: daysAgo(17),
  },

  // ── Unassigned active incidents (need assignment) ──
  {
    incidentId: "INC-SEED-301",
    title: "Broken bench at Aga Khan Park",
    description: "Public bench broken and sharp edges exposed. Risk of injury.",
    speechToText: "broken bench in the park",
    zone: "Zone A", department: "Roads", severity: "Low", status: "Active",
    confidence: 0.74, reasons: [], citizenId: "CIT-0501", citizenReportCount30d: 1,
    images: [], assignedTo: [],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(48), updatedAt: hoursAgo(48),
  },
  {
    incidentId: "INC-SEED-302",
    title: "Overflowing dustbins near hospital",
    description: "Multiple dustbins overflowing near the district hospital entrance.",
    speechToText: "dustbins full near hospital very dirty",
    zone: "Zone B", department: "Sanitation", severity: "Medium", status: "Active",
    confidence: 0.83, reasons: [], citizenId: "CIT-0502", citizenReportCount30d: 2,
    images: [], assignedTo: [],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(30), updatedAt: hoursAgo(30),
  },
  {
    incidentId: "INC-SEED-303",
    title: "Damaged sidewalk near bus stand",
    description: "Cracked and uneven sidewalk causing tripping hazard for pedestrians.",
    speechToText: "sidewalk broken near bus stop",
    zone: "Zone C", department: "Roads", severity: "Medium", status: "Active",
    confidence: 0.79, reasons: [], citizenId: "CIT-0503", citizenReportCount30d: 1,
    images: [], assignedTo: [],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
  },
  {
    incidentId: "INC-SEED-304",
    title: "Waterlogging after heavy rain",
    description: "Knee-deep waterlogging on main road after rainfall. Vehicles stuck.",
    speechToText: "road flooded knee deep water vehicles stuck",
    zone: "Zone D", department: "Water", severity: "High", status: "Active",
    confidence: 0.86, reasons: [], citizenId: "CIT-0504", citizenReportCount30d: 1,
    images: [], assignedTo: [],
    moderation: { status: "approved", citizenFlagged: false, lastRemark: "AI auto-approved" },
    createdAt: hoursAgo(8), updatedAt: hoursAgo(8),
  },
];

/**
 * Seeds 8 workers (across 4 zones) and 20 incidents with varied assignments.
 * Idempotent: skips if seed workers already exist.
 */
export async function seedWorkersAndHistory(): Promise<{
  workersCreated: number;
  incidentsCreated: number;
  skipped: boolean;
}> {
  // Check if seed workers already exist
  const existing = await User.findOne({ username: "rajesh.patil" });
  if (existing) {
    return { workersCreated: 0, incidentsCreated: 0, skipped: true };
  }

  const hashedPassword = await bcrypt.hash(WORKER_PASSWORD, 12);

  // Create workers
  const workerDocs = SEED_WORKERS.map((w) => ({
    ...w,
    password: hashedPassword,
    role: "WORKER" as const,
    isActive: true,
  }));

  await User.insertMany(workerDocs);

  // Create incidents (skip any that already exist by incidentId)
  const existingIds = await IncidentModel.find(
    { incidentId: { $in: SEED_INCIDENTS.map((i) => i.incidentId) } },
    { incidentId: 1 }
  ).lean();
  const existingIdSet = new Set(existingIds.map((i: Record<string, unknown>) => i.incidentId));

  const newIncidents = SEED_INCIDENTS.filter((i) => !existingIdSet.has(i.incidentId));

  if (newIncidents.length > 0) {
    await IncidentModel.insertMany(newIncidents);
  }

  return {
    workersCreated: workerDocs.length,
    incidentsCreated: newIncidents.length,
    skipped: false,
  };
}


/**
 * Cleans up all bad/stale data and re-seeds fresh workers + incidents.
 * Removes:
 *  - Generic "WORKER User" workers from old seeds
 *  - "INC-SEED-2xxx" incidents from old bulk seed
 *  - Incidents with invalid status (IN_PROGRESS, OPEN, ON_HOLD) or missing fields
 *  - Duplicate incidents (keeps first by incidentId)
 * Then force-seeds our clean workers + incidents.
 */
export async function cleanupAndReseed(): Promise<{
  deletedWorkers: number;
  deletedIncidents: number;
  workersCreated: number;
  incidentsCreated: number;
}> {
  // 1. Delete generic "WORKER User" workers (from old teammate seeds)
  const delWorkers = await User.deleteMany({
    role: "WORKER",
    $or: [
      { name: { $regex: /^WORKER User/i } },
      { email: { $regex: /@authority\.local$/i } },
    ],
  });

  // 2. Delete old bulk-seeded incidents (INC-SEED-2xxx pattern)
  const delOldSeed = await IncidentModel.deleteMany({
    incidentId: { $regex: /^INC-SEED-2\d{3}$/ },
  });

  // 3. Delete incidents with bad status values (from citizens app with different schema)
  const delBadStatus = await IncidentModel.deleteMany({
    status: { $in: ["IN_PROGRESS", "OPEN", "ON_HOLD", "RESOLVED"] },
  });

  // 4. Delete incidents missing required fields (no incidentId, no createdAt, etc.)
  const delBadFields = await IncidentModel.deleteMany({
    $or: [
      { incidentId: { $exists: false } },
      { createdAt: { $exists: false } },
      { confidence: { $exists: false } },
    ],
  });

  // 5. Remove duplicate incidents — keep first occurrence of each incidentId
  const allIncidents = await IncidentModel.find({}, { incidentId: 1 }).sort({ createdAt: 1 }).lean();
  const seenIds = new Set<string>();
  const dupIds: string[] = [];
  for (const inc of allIncidents) {
    const id = (inc as Record<string, unknown>).incidentId as string;
    if (seenIds.has(id)) {
      dupIds.push((inc as Record<string, unknown>)._id?.toString() ?? "");
    } else {
      seenIds.add(id);
    }
  }
  if (dupIds.length > 0) {
    await IncidentModel.deleteMany({ _id: { $in: dupIds } });
  }

  const totalDeleted = (delOldSeed.deletedCount ?? 0) + (delBadStatus.deletedCount ?? 0) + (delBadFields.deletedCount ?? 0) + dupIds.length;

  // 6. Delete our old seed workers so we can re-create them fresh
  await User.deleteMany({
    username: { $in: SEED_WORKERS.map((w) => w.username) },
  });

  // 7. Re-seed workers
  const hashedPassword = await bcrypt.hash(WORKER_PASSWORD, 12);
  const workerDocs = SEED_WORKERS.map((w) => ({
    ...w,
    password: hashedPassword,
    role: "WORKER" as const,
    isActive: true,
  }));
  await User.insertMany(workerDocs);

  // 8. Re-seed incidents (skip any that already exist)
  const existingIds = await IncidentModel.find(
    { incidentId: { $in: SEED_INCIDENTS.map((i) => i.incidentId) } },
    { incidentId: 1 }
  ).lean();
  const existingIdSet = new Set(existingIds.map((i: Record<string, unknown>) => i.incidentId));
  const newIncidents = SEED_INCIDENTS.filter((i) => !existingIdSet.has(i.incidentId));
  if (newIncidents.length > 0) {
    await IncidentModel.insertMany(newIncidents);
  }

  // 9. Update any existing incidents that reference old worker names in assignedTo
  await IncidentModel.updateMany(
    { assignedTo: { $regex: /^WORKER User/i } },
    { $set: { assignedTo: [] } }
  );

  return {
    deletedWorkers: delWorkers.deletedCount ?? 0,
    deletedIncidents: totalDeleted,
    workersCreated: workerDocs.length,
    incidentsCreated: newIncidents.length,
  };
}

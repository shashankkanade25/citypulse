#!/usr/bin/env node
/**
 * Kafka consumer – polls Upstash Kafka topics and replicates
 * PostgreSQL writes into MongoDB so the frontend reads from Mongo.
 *
 * Architecture: PG (write) → Kafka → this consumer → MongoDB (read replica)
 *
 * Usage:
 *   KAFKA_ENABLED=true \
 *   UPSTASH_KAFKA_REST_URL=... \
 *   UPSTASH_KAFKA_REST_USERNAME=... \
 *   UPSTASH_KAFKA_REST_PASSWORD=... \
 *   MONGODB_URL=... \
 *   node infra/kafka/kafka-consumer.mjs
 *
 * Each topic handler receives the parsed KafkaEvent and MUST be
 * idempotent (duplicate delivery is possible with at-least-once).
 */

import { Kafka } from "@upstash/kafka";
import mongoose from "mongoose";

/* ---------- Config ---------- */

const CONSUMER_GROUP = "citypulse-consumer";
const INSTANCE_ID = `consumer-${Date.now()}`;

const SUBSCRIBED_TOPICS = [
  "incident.moderated",
  "incident.status_changed",
  "user.created",
  "user.updated",
  "abuse.action",
  "config.updated",
  "audit.event",
  "issue.created",
  "issue.status_changed",
  "citizen.created",
  "citizen.updated",
  "citizen.deleted",
];

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5_000;

/* ---------- MongoDB ---------- */

let mongoReady = false;

async function connectMongo() {
  if (mongoReady) return;
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error("MONGODB_URL is not set");
  await mongoose.connect(url, {
    bufferCommands: false,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  });
  mongoReady = true;
  console.log("[mongo] Connected to MongoDB");
}

/* --- Mongoose schemas (lightweight, schemaless-ish for flexibility) --- */

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, sparse: true },
    password: String,
    name: String,
    email: { type: String, unique: true, sparse: true },
    phone: String,
    role: String,
    departmentId: mongoose.Schema.Types.ObjectId,
    zone: String,
    isActive: { type: Boolean, default: true },
    photo: String,
    pgId: { type: String, index: true }, // track PG origin id
  },
  { timestamps: true, strict: false }
);
const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

const IncidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, unique: true, sparse: true, index: true },
    title: String,
    description: String,
    speechToText: String,
    zone: String,
    department: String,
    severity: String,
    status: String,
    confidence: Number,
    reasons: [String],
    citizenId: String,
    citizenReportCount30d: Number,
    duplicateClusterId: String,
    images: [String],
    assignedTo: [String],
    moderation: {
      status: { type: String, default: "pending" },
      lastActionAt: Date,
      lastRemark: String,
      citizenFlagged: { type: Boolean, default: false },
    },
    pgId: { type: String, index: true },
  },
  { timestamps: true, strict: false }
);
const IncidentModel =
  mongoose.models.Incident || mongoose.model("Incident", IncidentSchema);

// Issue model (citizens' reports — different collection)
const IssueSchema = new mongoose.Schema(
  {
    reportedBy: mongoose.Schema.Types.ObjectId,
    reporterEmail: String,
    reporterName: String,
    reporterRole: String,
    title: String,
    description: String,
    category: String,
    priority: String,
    status: { type: String, default: "pending" },
    severityLevel: String,
    department: String,
    aiConfidence: Number,
    location: {
      address: String,
      lat: Number,
      lng: Number,
    },
    pgId: { type: String, index: true },
  },
  { timestamps: true, strict: false }
);
const IssueModel = mongoose.models.Issue || mongoose.model("Issue", IssueSchema);

const CitizenSchema = new mongoose.Schema(
  {
    clerkId: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, sparse: true },
    firstName: String,
    lastName: String,
    username: String,
    photo: String,
    phone: String,
    status: { type: String, default: "active" },
    role: { type: String, default: "citizen" },
    pgId: { type: String, index: true },
  },
  { timestamps: true, strict: false }
);
const CitizenModel =
  mongoose.models.Citizen || mongoose.model("Citizen", CitizenSchema);

const AuditEventSchema = new mongoose.Schema({}, { timestamps: true, strict: false });
const AuditEventModel =
  mongoose.models.AuditEvent || mongoose.model("AuditEvent", AuditEventSchema);

const SystemConfigSchema = new mongoose.Schema({}, { timestamps: true, strict: false });
const SystemConfigModel =
  mongoose.models.SystemConfig || mongoose.model("SystemConfig", SystemConfigSchema);

const AbuseCaseSchema = new mongoose.Schema({}, { timestamps: true, strict: false });
const AbuseCaseModel =
  mongoose.models.AbuseCase || mongoose.model("AbuseCase", AbuseCaseSchema);

/* ---------- Kafka client ---------- */

const kafka = new Kafka({
  url: process.env.UPSTASH_KAFKA_REST_URL,
  username: process.env.UPSTASH_KAFKA_REST_USERNAME,
  password: process.env.UPSTASH_KAFKA_REST_PASSWORD,
});

/* ---------- Handlers (idempotent upserts) ---------- */

/** @type {Record<string, (event: any) => Promise<void>>} */
const handlers = {
  /* ---- Authority domain ---- */

  "incident.moderated": async (event) => {
    const d = event.data;
    console.log(`[handler] incident.moderated key=${event.key}`);
    if (d.incidentId || d.incident_code) {
      await IncidentModel.findOneAndUpdate(
        { $or: [{ incidentId: d.incidentId || d.incident_code }, { pgId: event.key }] },
        {
          $set: {
            "moderation.status": d.moderationStatus || d.moderation_status || d.status,
            "moderation.lastActionAt": d.moderatedAt || new Date(),
            "moderation.lastRemark": d.remark || d.reason || "",
            "moderation.citizenFlagged": d.citizenFlagged ?? false,
            status: d.newStatus || undefined,
            updatedAt: new Date(),
          },
        },
        { upsert: false }
      );
    }
  },

  "incident.status_changed": async (event) => {
    const d = event.data;
    console.log(`[handler] incident.status_changed key=${event.key}`);
    if (d.incidentId || d.incident_code) {
      await IncidentModel.findOneAndUpdate(
        { $or: [{ incidentId: d.incidentId || d.incident_code }, { pgId: event.key }] },
        { $set: { status: d.newStatus || d.to_status, updatedAt: new Date() } },
        { upsert: false }
      );
    }
  },

  "user.created": async (event) => {
    const d = event.data;
    console.log(`[handler] user.created key=${event.key}`);
    await UserModel.findOneAndUpdate(
      { $or: [{ email: d.email }, { pgId: event.key }] },
      {
        $setOnInsert: { createdAt: d.createdAt || new Date() },
        $set: {
          username: d.username,
          password: d.passwordHash || d.password,
          name: d.name,
          email: d.email,
          phone: d.phone || undefined,
          role: d.role,
          isActive: d.isActive ?? d.is_active ?? true,
          zone: d.zone || undefined,
          photo: d.photo || undefined,
          pgId: event.key,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  },

  "user.updated": async (event) => {
    const d = event.data;
    console.log(`[handler] user.updated key=${event.key}`);
    const filter = d.email
      ? { $or: [{ email: d.email }, { pgId: event.key }] }
      : { pgId: event.key };
    await UserModel.findOneAndUpdate(
      filter,
      { $set: { ...d, pgId: event.key, updatedAt: new Date() } },
      { upsert: false }
    );
  },

  "abuse.action": async (event) => {
    const d = event.data;
    console.log(`[handler] abuse.action key=${event.key}`);
    await AbuseCaseModel.findOneAndUpdate(
      { pgId: event.key },
      { $set: { ...d, pgId: event.key, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
  },

  "config.updated": async (event) => {
    const d = event.data;
    console.log(`[handler] config.updated key=${event.key}`);
    await SystemConfigModel.findOneAndUpdate(
      { key: d.key || event.key },
      { $set: { ...d, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
  },

  "audit.event": async (event) => {
    const d = event.data;
    console.log(`[handler] audit.event key=${event.key}`);
    // Audit events are append-only — always insert
    await AuditEventModel.create({
      ...d,
      pgId: event.key,
      kafkaTs: event.ts,
      source: event.source,
    });
  },

  /* ---- Citizens domain ---- */

  "issue.created": async (event) => {
    const d = event.data;
    console.log(`[handler] issue.created key=${event.key}`);
    // Upsert by pgId to be idempotent
    await IssueModel.findOneAndUpdate(
      { pgId: event.key },
      {
        $setOnInsert: { createdAt: d.createdAt || new Date() },
        $set: {
          reportedBy: d.reportedBy || undefined,
          reporterEmail: d.reporterEmail,
          reporterName: d.reporterName,
          reporterRole: d.reporterRole,
          title: d.title,
          description: d.description,
          category: d.category,
          priority: d.priority || "medium",
          status: d.status || "pending",
          severityLevel: d.severityLevel || "MEDIUM",
          department: d.department || "General",
          aiConfidence: d.aiConfidence ?? 0,
          location: d.location || undefined,
          pgId: event.key,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  },

  "issue.status_changed": async (event) => {
    const d = event.data;
    console.log(`[handler] issue.status_changed key=${event.key}`);
    await IssueModel.findOneAndUpdate(
      { pgId: event.key },
      { $set: { status: d.newStatus || d.status, updatedAt: new Date() } },
      { upsert: false }
    );
  },

  "citizen.created": async (event) => {
    const d = event.data;
    console.log(`[handler] citizen.created key=${event.key}`);
    await CitizenModel.findOneAndUpdate(
      { $or: [{ clerkId: d.clerkId || event.key }, { email: d.email }] },
      {
        $setOnInsert: { createdAt: d.createdAt || new Date() },
        $set: {
          clerkId: d.clerkId || event.key,
          email: d.email,
          firstName: d.firstName,
          lastName: d.lastName,
          username: d.username || undefined,
          photo: d.photo || undefined,
          phone: d.phone || undefined,
          status: "active",
          role: "citizen",
          pgId: event.key,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  },

  "citizen.updated": async (event) => {
    const d = event.data;
    console.log(`[handler] citizen.updated key=${event.key}`);
    await CitizenModel.findOneAndUpdate(
      { $or: [{ clerkId: d.clerkId || event.key }, { pgId: event.key }] },
      { $set: { ...d, pgId: event.key, updatedAt: new Date() } },
      { upsert: false }
    );
  },

  "citizen.deleted": async (event) => {
    const d = event.data;
    console.log(`[handler] citizen.deleted key=${event.key}`);
    await CitizenModel.findOneAndDelete({
      $or: [{ clerkId: d.clerkId || event.key }, { pgId: event.key }],
    });
  },

  // Fallback for unrecognised topics
  __default: async (event) => {
    console.log(
      `[handler] UNHANDLED ${event.topic}/${event.key}:`,
      JSON.stringify(event.data).slice(0, 200)
    );
  },
};

/* ---------- Poll loop ---------- */

async function poll() {
  const consumer = kafka.consumer();

  for (const topic of SUBSCRIBED_TOPICS) {
    try {
      const messages = await consumer.consume({
        consumerGroupId: CONSUMER_GROUP,
        instanceId: INSTANCE_ID,
        topics: [topic],
        autoOffsetReset: "latest",
      });

      for (const msg of messages) {
        try {
          const event = JSON.parse(msg.value);
          const handler = handlers[topic] ?? handlers.__default;
          await handler(event);
        } catch (err) {
          console.error(`[consumer] Failed to process message on ${topic}:`, err);
        }
      }
    } catch (err) {
      // Topic might not exist yet — that's fine
      if (!String(err).includes("does not exist")) {
        console.error(`[consumer] Error polling ${topic}:`, err);
      }
    }
  }
}

async function main() {
  // Connect to MongoDB first
  await connectMongo();

  console.log(`[consumer] Starting — group=${CONSUMER_GROUP}, instance=${INSTANCE_ID}`);
  console.log(`[consumer] Subscribed topics: ${SUBSCRIBED_TOPICS.join(", ")}`);
  console.log(`[consumer] Poll interval: ${POLL_INTERVAL_MS}ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await poll();
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("[consumer] Fatal error:", err);
  process.exit(1);
});

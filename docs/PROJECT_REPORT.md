# CityPulse — Comprehensive Project Report

**Project Name:** CityPulse (Puranpoli Protocol)  
**Team:** Puranpoli Protocol  
**Date:** February 8, 2026  
**Version:** 1.0.0  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [System Architecture](#4-system-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Application Structure](#6-application-structure)
7. [Database Design](#7-database-design)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [API Layer — Authority App](#9-api-layer--authority-app)
10. [API Layer — Citizens App](#10-api-layer--citizens-app)
11. [AI/ML Pipeline — CityPulse Backend](#11-aiml-pipeline--citypulse-backend)
12. [Dual-Write Architecture](#12-dual-write-architecture)
13. [Event-Driven Architecture (Kafka)](#13-event-driven-architecture-kafka)
14. [Caching Layer (Redis)](#14-caching-layer-redis)
15. [Rate Limiting](#15-rate-limiting)
16. [Proxy & Request Routing (Next.js 16)](#16-proxy--request-routing-nextjs-16)
17. [Citizens Portal — Features & Implementation](#17-citizens-portal--features--implementation)
18. [Authority Head Dashboard — Features & Implementation](#18-authority-head-dashboard--features--implementation)
19. [Worker Dashboard — Features & Implementation](#19-worker-dashboard--features--implementation)
20. [Admin Panel — Features & Implementation](#20-admin-panel--features--implementation)
21. [Transparency Dashboard](#21-transparency-dashboard)
22. [Issue Deduplication System](#22-issue-deduplication-system)
23. [SLA Monitoring](#23-sla-monitoring)
24. [Audit & Compliance](#24-audit--compliance)
25. [Infrastructure & Deployment](#25-infrastructure--deployment)
26. [Environment Variables](#26-environment-variables)
27. [Use Cases](#27-use-cases)
28. [Data Flow Diagrams](#28-data-flow-diagrams)
29. [Security Measures](#29-security-measures)
30. [Future Scope](#30-future-scope)

---

## 1. Executive Summary

CityPulse is a full-stack civic incident management platform designed to bridge the gap between citizens and municipal authorities. The platform enables citizens to report infrastructure issues (potholes, broken water pipes, power outages, etc.) with AI-powered image classification, while providing authority heads, field workers, and system administrators with dedicated dashboards to triage, assign, track, and resolve these incidents in real-time.

**Key Highlights:**
- **Two independent Next.js 16 applications** — Citizens Portal (port 5101) and Authority Portal (port 5100)
- **Dual-database architecture** — MongoDB (primary) + PostgreSQL (secondary with PostGIS)
- **AI/ML integration** — CLIP-based image classification + Ollama LLM for report generation
- **Event-driven** — Upstash Kafka for cross-service event streaming
- **In-memory caching** — Redis (ioredis) for admin API response caching
- **Rate limiting** — Sliding-window in-memory rate limiter on all routes
- **Role-based access** — 4 roles: CITIZEN, AUTHORITY_HEAD, WORKER, ADMIN
- **Real-time deduplication** — Geo-cell + Jaccard similarity for duplicate report grouping

---

## 2. Problem Statement

Urban municipalities face significant challenges in managing civic infrastructure complaints:

1. **Fragmented reporting** — Citizens report via phone, email, social media, and walk-ins, making it impossible to track or deduplicate reports.
2. **No accountability** — Workers operate without transparent daily activity logging, making performance evaluation subjective.
3. **Delayed response** — Without SLA tracking, critical issues like power outages or water leaks go unresolved for days.
4. **Duplicate flooding** — The same pothole may be reported 50 times, wasting triage effort.
5. **Lack of transparency** — Citizens have no visibility into what the municipality is doing about their complaints.
6. **No AI assistance** — Manual classification of incident types and severity is slow and inconsistent.

---

## 3. Solution Overview

CityPulse addresses every problem above with a modular, role-based platform:

| Problem | Solution |
|---------|----------|
| Fragmented reporting | Unified citizen portal with structured forms, image upload, and geolocation |
| No accountability | Worker EOD (End-of-Day) update system with head approval workflow |
| Delayed response | SLA monitoring with severity-based deadlines and breach alerts |
| Duplicate flooding | Automatic deduplication using geo-cell hashing + text similarity |
| Lack of transparency | Public transparency dashboard showing all incidents and work progress |
| No AI assistance | CLIP image classification + Ollama LLM report generation + AI chatbot |

---

## 4. System Architecture

### High-Level Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Citizens Portal   │     │   Authority Portal    │
│   (Next.js 16)      │     │   (Next.js 16)        │
│   Port: 5101        │     │   Port: 5100          │
│                     │     │                       │
│ • Report Issues     │     │ • Admin Panel         │
│ • My Reports        │     │ • Head Dashboard      │
│ • Transparency      │     │ • Worker Dashboard    │
│ • AI Chatbot        │     │ • EOD Review          │
│ • Dashboard         │     │ • SLA Monitor         │
└────────┬────────────┘     └────────┬──────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────────┐
│              Shared Backend Services                │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ MongoDB  │  │PostgreSQL│  │ CityPulse AI/ML  │  │
│  │(Primary) │  │(PostGIS) │  │ (FastAPI+CLIP+   │  │
│  │          │  │          │  │  Ollama)          │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Redis   │  │  Kafka   │  │   Cloudinary     │  │
│  │ (Cache)  │  │(Upstash) │  │ (Image Storage)  │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Request Flow

```
Client Request → Next.js Proxy (proxy.ts)
                    │
                    ├── Rate Limiter (in-memory sliding window)
                    ├── JWT Verification (jose)
                    ├── Role-Based Routing
                    │
                    ▼
              API Route Handler
                    │
                    ├── Redis Cache Check (GET requests)
                    ├── PostgreSQL Query (pgReadOrNull)
                    ├── MongoDB Fallback (if PG unavailable)
                    │
                    ▼
              Dual-Write Layer
                    │
                    ├── PostgreSQL (BEGIN → INSERT → COMMIT)
                    ├── MongoDB Write
                    ├── Kafka Event Publish
                    └── Cache Invalidation
```

---

## 5. Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.1.6 | Full-stack React framework (App Router) |
| React | 19.2.3 | UI component library |
| TypeScript | 5.x | Type-safe JavaScript |
| Tailwind CSS | 4.x | Utility-first CSS framework |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js API Routes | 16.1.6 | RESTful API endpoints (App Router) |
| jose | 6.1.3 | JWT creation and verification (Edge-compatible) |
| bcryptjs | 3.0.3 | Password hashing (12 salt rounds) |

### Databases
| Technology | Version | Purpose |
|-----------|---------|---------|
| MongoDB | Latest | Primary document database (Mongoose 9.1.6 ODM) |
| PostgreSQL | 14 | Secondary relational database with PostGIS |
| PostGIS | 3.4 | Geographic/spatial queries |

### Infrastructure
| Technology | Version | Purpose |
|-----------|---------|---------|
| Redis (ioredis) | 5.9.2 | In-memory caching for admin APIs |
| Upstash Kafka | 1.3.5 | Event streaming (REST-based) |
| Cloudinary | 2.9.0 | Image upload, storage, and optimization |
| Docker Compose | — | PostgreSQL container orchestration |

### AI/ML (External Backend)
| Technology | Purpose |
|-----------|---------|
| FastAPI | Python API server for ML endpoints |
| CLIP (OpenAI) | Zero-shot image classification |
| Ollama | Local LLM for report generation and chatbot |

### Design System
| Element | Value |
|---------|-------|
| Accent Color | `#09E0F7` (Cyan) |
| Dark Color | `#131C15` (Near-black green) |
| Background | `#F4F5F7` (Light gray) |
| Heading Font | Unbounded (Google Fonts) |
| Body Font | Open Sans (Google Fonts) |

---

## 6. Application Structure

### Monorepo Layout

```
Puranpoli_Protocol/
├── authority/               # Authority Portal (Admin + Head + Worker)
│   ├── src/
│   │   ├── proxy.ts         # Request proxy (auth + rate limiting)
│   │   ├── app/
│   │   │   ├── layout.tsx   # Root layout with fonts
│   │   │   ├── page.tsx     # Landing (redirects by role)
│   │   │   ├── admin/       # Admin panel (13 sub-pages)
│   │   │   ├── dashboard/   # Authority Head dashboard
│   │   │   ├── incidents/   # Incident management
│   │   │   ├── workers/     # Worker management
│   │   │   ├── worker/      # Worker's own dashboard
│   │   │   ├── eod-review/  # EOD review page (Head)
│   │   │   ├── sla/         # SLA monitoring
│   │   │   ├── verification/# Moderation queue
│   │   │   ├── analytics/   # Analytics dashboard
│   │   │   ├── audit/       # Audit log viewer
│   │   │   ├── sign-in/     # Login page
│   │   │   ├── sign-up/     # Registration page
│   │   │   └── api/         # 31 API routes
│   │   │       ├── auth/    # 4 auth routes
│   │   │       ├── admin/   # 13 admin routes
│   │   │       ├── head/    # 10 head routes
│   │   │       └── worker/  # 4 worker routes
│   │   ├── components/
│   │   │   ├── AppNavbar.tsx     # Route-based navbar switcher
│   │   │   ├── AdminNavbar.tsx   # Admin navigation
│   │   │   ├── Navbar.tsx        # Authority Head navigation
│   │   │   ├── WorkerNavbar.tsx  # Worker navigation
│   │   │   ├── LogoutButton.tsx  # Shared logout component
│   │   │   ├── IncidentCard.tsx  # Incident display card
│   │   │   └── StatCard.tsx      # Statistics display card
│   │   └── lib/
│   │       ├── auth.ts           # JWT auth utilities
│   │       ├── db.ts             # MongoDB connection
│   │       ├── postgres.ts       # PostgreSQL pool
│   │       ├── kafka.ts          # Kafka producer
│   │       ├── redis.ts          # Redis client singleton
│   │       ├── rate-limit.ts     # Sliding-window rate limiter
│   │       ├── admin/
│   │       │   ├── cache.ts      # Redis cache-aside helpers
│   │       │   └── audit.ts      # Audit event logger
│   │       ├── server/
│   │       │   ├── dualWrite.ts  # Dual-write orchestrator
│   │       │   ├── readSwitch.ts # PG-read fallback
│   │       │   ├── adminSeed.ts  # Admin demo data seeder
│   │       │   └── workerSeed.ts # Worker demo data seeder
│   │       └── database/models/  # 12 Mongoose models
│   └── package.json
│
├── citizens/                # Citizens Portal
│   ├── src/
│   │   ├── proxy.ts         # Request proxy (auth + rate limiting)
│   │   ├── app/
│   │   │   ├── layout.tsx   # Root layout
│   │   │   ├── page.tsx     # Public landing page
│   │   │   ├── dashboard/   # Citizen dashboard
│   │   │   ├── reporting/   # AI-powered incident reporting (1077 lines)
│   │   │   ├── my-reports/  # User's own reports
│   │   │   ├── transparency/# Public transparency dashboard
│   │   │   ├── sign-in/     # Login page
│   │   │   ├── sign-up/     # Registration page
│   │   │   └── api/         # 10 API routes
│   │   │       ├── auth/    # 5 auth routes
│   │   │       ├── issues/  # Issue CRUD with deduplication
│   │   │       ├── reports/ # Report APIs (recent, stats)
│   │   │       ├── transparency/ # Public data APIs
│   │   │       ├── uploads/ # Cloudinary upload
│   │   │       └── health/  # Health check
│   │   ├── components/
│   │   │   ├── AppNavbar.tsx     # Main navbar
│   │   │   ├── ChatBot.tsx       # AI chatbot (242 lines)
│   │   │   ├── HomeHeroActions.tsx
│   │   │   ├── Navbar.tsx
│   │   │   └── RootChrome.tsx
│   │   └── lib/
│   │       ├── auth.ts           # JWT auth (citizens-auth-token)
│   │       ├── db.ts             # MongoDB connection
│   │       ├── postgres.ts       # PostgreSQL pool
│   │       ├── kafka.ts          # Kafka producer
│   │       ├── cloudinary.ts     # Image upload service
│   │       ├── citypulse.ts      # AI/ML API client (488 lines)
│   │       ├── utils.ts          # General utilities
│   │       ├── utils/
│   │       │   ├── dedupe.ts     # Deduplication logic
│   │       │   └── response.ts   # Standardized API responses
│   │       ├── server/
│   │       │   ├── dualWrite.ts  # Dual-write orchestrator
│   │       │   ├── readSwitch.ts # PG-read fallback
│   │       │   └── postgisDuplicates.ts
│   │       └── models/
│   │           └── Issue.ts      # Issue Mongoose model
│   └── package.json
│
├── infra/
│   ├── kafka/
│   │   └── kafka-consumer.mjs    # Kafka→MongoDB replicator (290 lines)
│   └── postgres/
│       ├── docker-compose.yml    # PostgreSQL + PostGIS container
│       └── initdb/
│           ├── 00_extensions.sql # uuid-ossp, pgcrypto, postgis
│           ├── 10_schema.sql     # Core OLTP schema (237 lines)
│           └── 11_schema_from_ts_models.sql # Extended schema (308 lines)
│
└── docs/
    └── migrations/
        └── mysql-to-postgres.md
```

---

## 7. Database Design

### 7.1 MongoDB Models (Authority App — 12 Models)

#### User Model (`user.model.ts`)
```
Fields:
├── username    (String, unique, lowercase, 3–30 chars)
├── password    (String, bcrypt hash, min 6 chars)
├── name        (String, required)
├── email       (String, unique, lowercase)
├── phone       (String, optional, sparse index)
├── role        (Enum: CITIZEN | AUTHORITY_HEAD | WORKER | ADMIN)
├── departmentId (ObjectId → Department, nullable)
├── zone        (String, optional)
├── isActive    (Boolean, default true)
├── photo       (String, optional URL)
├── createdAt   (Date, auto)
└── updatedAt   (Date, auto)

Indexes: email, {role + isActive}
```

#### Incident Model (`incident.model.ts`)
```
Fields:
├── incidentId       (String, unique)
├── title            (String)
├── description      (String)
├── speechToText     (String — AI-generated)
├── zone             (String, indexed)
├── department       (String, indexed)
├── severity         (Enum: Low | Medium | High | Critical)
├── status           (Enum: Active | Resolved | On Hold)
├── confidence       (Number, 0–1, AI confidence score)
├── reasons          ([String] — AI reasoning)
├── citizenId        (String, indexed)
├── citizenReportCount30d (Number)
├── duplicateClusterId (String)
├── images           ([String] — URLs)
├── assignedTo       ([String] — worker IDs)
├── moderation       (Embedded)
│   ├── status       (pending | approved | rejected)
│   ├── lastActionAt (Date)
│   ├── lastRemark   (String)
│   └── citizenFlagged (Boolean)
├── createdAt        (Date, indexed)
└── updatedAt        (Date)
```

#### Department Model (`department.model.ts`)
```
Fields:
├── name     (String, unique, max 100)
├── category (Enum: POWER | WATER | ROAD)
├── headId   (ObjectId → User, nullable)
├── workers  ([ObjectId] → User)
└── createdAt (Date, auto)

Indexes: name, category
```

#### WorkerUpdate Model (`worker-update.model.ts`)
```
Fields:
├── incidentId              (String, indexed)
├── workerId                (ObjectId → User, indexed)
├── workerName              (String)
├── description             (String, min 10 chars)
├── images                  ([String] — evidence photo URLs)
├── date                    (Date, indexed)
├── submittedAt             (Date, auto)
├── status                  (Enum: pending | approved | rejected)
├── headRemarks             (String, optional)
├── publishedToTransparency (Boolean, default false)
├── createdAt               (Date, auto)
└── updatedAt               (Date, auto)

Indexes: {workerId, date desc}, {incidentId, workerId, date} (unique)
```

#### Other Models
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `AbuseCase` | Spam/harassment tracking | caseId, citizenId, reason (Spam/Manipulated/Harassment), risk (Low/Medium/High), status (Monitoring/Warned/Blocked), blockedUntil |
| `AdminUser` | Admin user profiles | userId, name, email, role (Admin/Auditor), department, active |
| `AuditLog` | CRUD-level audit trail | userId, action (USER_CREATED/UPDATED/DELETED, INCIDENT_*, etc.), tableName, recordId, oldValue, newValue, ipAddress |
| `AuditEvent` | Moderation/config events | ts, actor, type (MODERATION_APPROVED/REJECTED, CITIZEN_FLAGGED, etc.), entityId, remark, metadata |
| `IncidentImage` | Photo evidence | incidentId, uploadedBy, imageUrl, isGeotagged |
| `IncidentStatusHistory` | Status change log (append-only) | incidentId, status (OPEN/IN_PROGRESS/ON_HOLD/RESOLVED), changedBy, remarks |
| `SystemConfig` | System-wide settings | key, value (Mixed), updatedAt |

### 7.2 MongoDB Models (Citizens App — 1 Model)

#### Issue Model (`Issue.ts`)
```
Fields:
├── reportedBy       (String — user ID)
├── reporterEmail    (String)
├── reporterName     (String)
├── reporterRole     (String)
├── title            (String, required)
├── description      (String, required)
├── category         (String, indexed)
├── priority         (Enum: low | medium | high | critical)
├── status           (Enum: pending | in_progress | resolved | rejected)
├── severityLevel    (String — AI severity)
├── department       (String — AI department)
├── aiConfidence     (Number, 0–1)
├── location         (Embedded: address, lat, lng)
├── citizenImageUrl  (String)
├── citizenImageUrls ([String] — dedupe accumulates)
├── incidentCode     (String — cross-reference)
├── dedupeKey        (String — hash for dedup)
├── dedupeGeoCell    (String — geo bucket)
├── dedupeText       (String — normalized text)
├── dedupeTextHash   (String — SHA-1 of text)
├── reporterUserIds  ([String] — all reporters)
├── reportCount      (Number)
├── lastReportedAt   (Date)
├── createdAt        (Date, auto)
└── updatedAt        (Date, auto)

Indexes:
  {reportedBy, createdAt desc}
  {status, createdAt desc}
  {dedupeGeoCell, status, createdAt desc}
```

### 7.3 PostgreSQL Schema

The PostgreSQL schema is initialized via Docker initdb scripts:

**Tables (from `10_schema.sql` + `11_schema_from_ts_models.sql`):**

| Table | Purpose | Key Constraints |
|-------|---------|----------------|
| `users` | All users (both apps) | email unique, external_id unique, role CHECK, username unique, password_hash |
| `departments` | Department registry | code unique, category (POWER/WATER/ROAD), head_id FK |
| `department_workers` | Many-to-many join | (department_id, user_id) unique |
| `incidents` | All incidents | incident_code unique, PostGIS geography, metadata JSONB, moderation fields |
| `incident_reports` | Citizen reports | Many per incident, attachments JSONB |
| `incident_images` | Photo evidence | Append-only (trigger) |
| `incident_status_history` | Status tracking | Append-only (trigger), status CHECK |
| `incident_assignments` | Worker assignments | Partial unique index (one active per incident) |
| `worker_updates` | EOD work logs | Append-only |
| `audit_logs` | CRUD audit trail | Append-only |
| `admin_users` | Admin profiles | role (Admin/Auditor) |
| `system_config` | Key/value settings | key unique, value JSONB |
| `abuse_cases` | Abuse tracking | status (Monitoring/Warned/Blocked), risk enum |
| `audit_events` | Moderation events | Append-only |

**PostGIS Features:**
- `geography(Point, 4326)` column on incidents
- Trigger `incidents_set_location` that auto-creates the geography point from latitude/longitude on INSERT/UPDATE

**Append-Only Enforcement:**
- `prevent_update_delete()` trigger function prevents UPDATEs and DELETEs on:
  - `incident_status_history`
  - `incident_images`
  - `worker_updates`
  - `audit_logs`
  - `audit_events`

---

## 8. Authentication & Authorization

### 8.1 Implementation

Authentication is fully custom (no third-party auth provider) using:

- **jose** (v6.1.3) — Edge-compatible JWT library for token creation and verification
- **bcryptjs** (v3.0.3) — Password hashing with 12 salt rounds
- **HTTP-only cookies** — Separate cookies for each app

### 8.2 Token Structure

```typescript
interface TokenPayload {
  userId: string;    // MongoDB ObjectId as string
  email: string;     // User's email address
  role: string;      // CITIZEN | AUTHORITY_HEAD | WORKER | ADMIN
  name: string;      // Display name
}
```

- **Algorithm:** HS256
- **Expiry:** 7 days
- **Secret:** `JWT_SECRET` environment variable (shared between both apps)

### 8.3 Cookie Configuration

| App | Cookie Name | Settings |
|-----|------------|----------|
| Authority | `authority-auth-token` | httpOnly, secure (prod), sameSite: lax, maxAge: 7d |
| Citizens | `citizens-auth-token` | httpOnly, secure (prod), sameSite: lax, maxAge: 7d |

### 8.4 Auth Functions

Both apps implement identical auth utility functions in `lib/auth.ts`:

```
hashPassword(password)      → bcrypt hash (12 rounds)
verifyPassword(pwd, hash)   → bcrypt compare
createToken(payload)        → JWT (HS256, 7-day expiry)
verifyToken(token)          → TokenPayload | null
setAuthCookie(token)        → Set HTTP-only cookie
getAuthCookie()             → Read cookie value
removeAuthCookie()          → Delete cookie
getCurrentUser()            → getAuthCookie → verifyToken → TokenPayload | null
```

### 8.5 Role-Based Access Control

| Role | Authority App Access | Citizens App Access |
|------|---------------------|-------------------|
| `CITIZEN` | Blocked → Redirected to Citizens Portal | Full access to dashboard, reporting, my-reports |
| `AUTHORITY_HEAD` | Dashboard, Incidents, Workers, EOD Reviews, SLA, Verification, Analytics, Audit | Blocked → Redirected to Authority Portal |
| `WORKER` | Worker Dashboard (My Tasks, Dept Tasks, EOD Update, History) | Blocked → Redirected to Authority Portal |
| `ADMIN` | Full Admin Panel (all 13 admin sub-pages) | Blocked → Redirected to Authority Portal |

### 8.6 Registration Flow

**Citizens App:**
1. User submits name, email, phone, password
2. Auto-generates unique username from email (e.g., `john.doe` or `john.doe_472`)
3. Password hashed with bcrypt (12 rounds)
4. Dual-write: PostgreSQL INSERT → MongoDB `User.create()`
5. Kafka event published: `user.created`
6. JWT created and set as HTTP-only cookie
7. `isActive` set to `true` (citizens are active immediately)

**Authority App:**
1. User submits username, password, name, email, phone, role
2. Role must be `AUTHORITY_HEAD`, `WORKER`, or `ADMIN`
3. Password hashed, dual-write PG → Mongo
4. `isActive` set to `false` (requires admin approval)
5. JWT created but user can't access protected routes until admin activates account

---

## 9. API Layer — Authority App

### 9.1 Auth Routes (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/sign-up` | Register new authority user (AUTHORITY_HEAD/WORKER/ADMIN) |
| `POST` | `/api/auth/sign-in` | Login with username + password; role-based redirect |
| `POST` | `/api/auth/sign-out` | Clear auth cookie |
| `GET` | `/api/auth/me` | Return current user payload from JWT |

**Sign-in Logic:**
- Validates username/password
- Rejects CITIZEN role ("use Citizens Portal")
- Rejects inactive accounts ("pending admin approval")
- Returns role-specific redirect: ADMIN→`/admin/dashboard`, WORKER→`/worker`, HEAD→`/dashboard`

### 9.2 Admin Routes (13 endpoints)

All admin routes are auth-gated (ADMIN role). All GET routes use Redis caching.

| Method | Endpoint | Description | Cache TTL |
|--------|----------|-------------|-----------|
| `GET` | `/api/admin/dashboard` | KPIs: total/active/resolved/flagged incidents, 7-day trend, integrity alerts | 30s |
| `GET` | `/api/admin/analytics` | Zone × department incident heatmap | 30s |
| `GET` | `/api/admin/registry` | Full incident registry with search/filter (q, status, department, zone, severity) | 20s |
| `GET` | `/api/admin/flagged` | Incidents pending moderation (confidence below threshold) | 20s |
| `POST` | `/api/admin/moderation` | Approve/Reject/Flag citizen on incident | Invalidates cache |
| `GET` | `/api/admin/users` | List users by scope (authority/citizens) | 60s |
| `PATCH` | `/api/admin/users` | Update user role/department/isActive | Invalidates cache |
| `GET` | `/api/admin/workers` | All workers with computed stats (assigned/open/resolved/avgResolutionTime) | 60s |
| `GET/POST` | `/api/admin/authority-heads` | List/create authority heads with department info | 60s |
| `GET` | `/api/admin/departments` | All departments with head and workers | 120s |
| `GET/PUT` | `/api/admin/config` | System config key/value pairs | 300s |
| `GET/POST` | `/api/admin/abuse` | Abuse case management (Warn/Block/Unblock) | 60s |
| `GET` | `/api/admin/audit` | Audit event stream | 30s |
| `GET` | `/api/admin/audit-logs` | CRUD-level audit logs | 30s |

**Implementation Pattern (every admin GET route):**
```typescript
export async function GET(req: NextRequest) {
  // 1. Auth check (getCurrentUser → verify ADMIN role)
  // 2. Build cache key from domain + query params
  // 3. Call cacheGet(key, TTL, async fetcher)
  //    Inside fetcher:
  //      a. Try pgReadOrNull → PostgreSQL query
  //      b. If null, fallback to MongoDB query
  //      c. Return formatted data
  // 4. Return JSON response
}
```

**Implementation Pattern (every admin write route):**
```typescript
export async function POST/PATCH/PUT(req: NextRequest) {
  // 1. Auth check
  // 2. Validate request body
  // 3. dualWritePostgresFirst({
  //      pg: (client) → PostgreSQL INSERT/UPDATE in transaction
  //      primary: () → MongoDB create/update
  //    })
  // 4. Write audit event (AuditEventModel + AuditLog)
  // 5. publishEvent(TOPICS.*, key, data) → Kafka
  // 6. invalidateDomain('dashboard', 'registry', ...) → Redis
  // 7. Return success response
}
```

### 9.3 Head Routes (10 endpoints)

All routes auth-gated for `AUTHORITY_HEAD` role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/head/dashboard` | Head KPIs: incidents, active, high-severity, SLA breaches, resolved today, worker utilization, 7-day trend, distributions |
| `GET` | `/api/head/incidents` | Filterable incident list (status, severity, zone, SLA breached) |
| `GET/POST` | `/api/head/incidents/assign` | Assign workers to incidents. GET calls CityPulse AI `/assign-team` for ranked recommendations |
| `GET` | `/api/head/workers` | Active workers with zone workload + assigned incidents |
| `GET` | `/api/head/sla` | SLA tracker: deadline computation, breach status, urgency scoring |
| `GET` | `/api/head/verification` | Pending moderation queue |
| `GET` | `/api/head/analytics` | KPIs, zone performance, category/severity distribution, hotspots, worker ranking |
| `GET` | `/api/head/audit` | Combined audit timeline (AuditEvent + AuditLog) |
| `GET/PATCH` | `/api/head/worker-updates` | EOD update review: GET (filter by status), PATCH (approve/reject with remarks) |
| `POST` | `/api/head/seed` | Demo data seeder |

**Worker Assignment with AI:**
```
GET /api/head/incidents/assign?incidentId=xyz
  1. Fetches all WORKER users from DB
  2. Sends { department, severity, location, available_workers } to CityPulse /assign-team
  3. CityPulse AI returns ranked worker recommendations with scores
  4. Returns merged worker data + AI scores to frontend
```

### 9.4 Worker Routes (4 endpoints)

Auth-gated for `WORKER` and `AUTHORITY_HEAD` roles.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/worker/my-tasks` | Incidents assigned to current worker with today's EOD status |
| `GET` | `/api/worker/dept-tasks` | All non-resolved incidents in worker's department; flags `isAssignedToMe` and `slaBreached` |
| `GET/POST` | `/api/worker/eod-update` | Submit/fetch daily work updates (min 10 chars, prevents same-day duplicates) |
| `GET` | `/api/worker/history` | Historical EOD updates grouped by incident, paginated, with aggregate stats |

---

## 10. API Layer — Citizens App

### 10.1 Auth Routes (5 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register citizen account (auto-generates username from email) |
| `POST` | `/api/auth/login` | Login with email or username |
| `GET` | `/api/auth/me` | Current user from JWT |
| `POST` | `/api/auth/logout` | Clear cookie |
| `POST` | `/api/auth/sign-out` | Alternate sign-out endpoint |

### 10.2 Issue & Report Routes (5 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/issues` | Create issues with AI data + deduplication; list user's issues with pagination |
| `GET/POST` | `/api/reports` | Simpler report create/list (without deduplication) |
| `GET` | `/api/reports/recent` | Last 50 incidents (PG first → Mongo fallback) |
| `GET` | `/api/reports/stats` | Department stats, totals, recent resolutions |
| `POST` | `/api/uploads` | Upload image to Cloudinary, returns secure_url |

### 10.3 Transparency Routes (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/transparency/issues` | All incidents (200 max) for public dashboard |
| `GET` | `/api/transparency/ongoing` | Non-resolved incidents with location data |
| `GET` | `/api/transparency/works/[incidentCode]` | Individual incident details with work updates |

### 10.4 Health Route

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | MongoDB connection status + env variable checks |

---

## 11. AI/ML Pipeline — CityPulse Backend

The CityPulse AI backend is a separate FastAPI application that provides ML-powered services:

### 11.1 API Client (`citypulse.ts` — 488 lines)

The citizens app communicates with CityPulse via a dedicated API client:

```
CityPulse FastAPI Backend (port 8000)
├── /health          → Health check (cached 30s)
├── /classify        → CLIP image classification
├── /generate-report → Ollama LLM report generation
├── /classify-and-report → Full pipeline (image → classification → report)
├── /generate-report-stream → SSE streaming report
├── /chat            → AI chatbot with incident context
├── /assign-team     → AI-powered worker assignment ranking
├── /summarize-incidents → Incident summary generation
└── /zone-analysis   → Zone hotspot analysis
```

### 11.2 Image Classification

**How it works:**
1. Citizen uploads an image of an infrastructure issue
2. Image sent to `/classify` endpoint as multipart form data
3. CLIP model performs zero-shot classification against municipal categories:
   - Pothole, Water leak, Broken streetlight, Power outage, Fallen tree, Drainage, etc.
4. Returns:
   - `top_prediction`: category, confidence (0–1), department, priority, effective_priority
   - `severity`: level + scores per level
   - `confidence_routing`: action (auto-approve / manual-review / reject) based on confidence thresholds
   - `all_predictions`: ranked list of all category scores
   - `inference_time_ms`, `device` (CPU/GPU)

### 11.3 Report Generation

**How it works:**
1. After classification, results + citizen description + location sent to `/generate-report`
2. Ollama LLM generates a structured incident report with sections:
   - Incident Summary, Issue Details, Recommended Actions, Estimated Urgency
3. `filterReportSections()` strips unwanted sections (Safety Advisory, Resolution Time)
4. Streaming supported via `/generate-report-stream` (SSE)

### 11.4 AI Chatbot

**How it works:**
1. On chatbot open, fetches all recent incidents from `/api/reports/recent`
2. Builds context string with `buildIncidentContext()`:
   ```
   LIVE INCIDENT DATABASE (50 recent reports):
   1. [OPEN] Pothole on MG Road | Category: roads | Severity: HIGH | ...
   2. [RESOLVED] Water leak at Block 5 | ...
   ```
3. Sends user message + full context to `/chat` endpoint
4. Ollama generates context-aware response about real city data

### 11.5 Worker Assignment AI

**How it works:**
1. Head clicks "Assign Workers" on an incident
2. Frontend calls `GET /api/head/incidents/assign?incidentId=xyz`
3. Backend fetches all active workers from DB with their current workload
4. Sends `{ department, severity, location, available_workers }` to CityPulse `/assign-team`
5. AI ranks workers by relevance, proximity, workload balance
6. Returns sorted worker list with scores for head to select from

---

## 12. Dual-Write Architecture

### 12.1 Design Philosophy

CityPulse uses a **dual-write, PostgreSQL-first** architecture to enable a gradual migration from MongoDB to PostgreSQL without downtime:

```
Write Path:
  1. BEGIN PostgreSQL transaction
  2. Execute PG INSERT/UPDATE
  3. Execute MongoDB write (if MONGO_READ_ONLY ≠ true)
  4. COMMIT PostgreSQL transaction
  5. If any step fails → ROLLBACK

Read Path:
  1. Try pgReadOrNull() → PostgreSQL query
  2. If returns null (PG disabled or error) → MongoDB query
```

### 12.2 Environment Toggles

| Env Variable | Values | Effect |
|-------------|--------|--------|
| `DUAL_WRITE_POSTGRES` | `true`/`false` | Enables PG writes (default: false = Mongo-only) |
| `MONGO_READ_ONLY` | `true`/`false` | Disables Mongo writes (PG becomes sole write target) |
| `READ_FROM_POSTGRES` | `true`/`false` | Enables PG reads via `pgReadOrNull()` |

### 12.3 Implementation (`dualWrite.ts`)

```typescript
export async function dualWritePostgresFirst<T>(input: {
  pg: (client: PoolClient) => Promise<void>;
  primary: () => Promise<T>;
}): Promise<T> {
  // If dual-write disabled → Mongo-only write
  if (!isDualWritePostgresEnabled()) {
    return await input.primary();
  }

  // Otherwise: PG first, then Mongo, in a transaction
  return await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await input.pg(client);          // PostgreSQL write
      const result = await input.primary(); // MongoDB write
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
```

### 12.4 Read Switch (`readSwitch.ts`)

```typescript
export async function pgReadOrNull<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T | null> {
  if (!isReadFromPostgres()) return null; // Skip PG → use Mongo
  return withPgClient(fn);
}
```

Used in every admin and head GET route:
```typescript
const pgResult = await pgReadOrNull(async (client) => {
  const { rows } = await client.query(`SELECT ... FROM incidents ...`);
  return rows;
});

if (pgResult) return NextResponse.json(pgResult); // PG succeeded

// PG unavailable → fallback to Mongo
await connectDB();
const docs = await IncidentModel.find({}).lean();
return NextResponse.json(docs);
```

---

## 13. Event-Driven Architecture (Kafka)

### 13.1 Kafka Setup

CityPulse uses **Upstash Kafka** (REST-based managed Kafka) for async event streaming:

```typescript
const kafka = new Kafka({
  url: process.env.UPSTASH_KAFKA_REST_URL,
  username: process.env.UPSTASH_KAFKA_REST_USERNAME,
  password: process.env.UPSTASH_KAFKA_REST_PASSWORD,
});
```

### 13.2 Topics

**Authority App Topics:**
| Topic | Triggered By |
|-------|-------------|
| `incident.moderated` | Admin approves/rejects/flags incident |
| `incident.status_changed` | Status change or worker assignment |
| `user.created` | New user registration |
| `user.updated` | Admin updates user role/status |
| `abuse.action` | Admin takes action on abuse case |
| `config.updated` | System config changed |
| `audit.event` | Audit event logged |

**Citizens App Topics:**
| Topic | Triggered By |
|-------|-------------|
| `issue.created` | Citizen creates a new report |
| `issue.status_changed` | Issue status changes |
| `user.created` | Citizen registration |

### 13.3 Event Structure

```typescript
interface KafkaEvent<T> {
  ts: string;           // ISO timestamp
  source: "authority" | "citizens";
  topic: TopicName;
  key: string;          // Entity ID (incident code, user ID)
  data: T;              // Event payload
}
```

### 13.4 Kafka Consumer (`kafka-consumer.mjs`)

A standalone Node.js script (290 lines) that:
1. Polls Upstash Kafka REST API for new messages
2. Routes events by topic to handler functions
3. Replicates changes into MongoDB (for cross-service sync)
4. Handles: incident moderation sync, user replication, abuse action sync, config sync

---

## 14. Caching Layer (Redis)

### 14.1 Redis Client (`redis.ts`)

```typescript
// Singleton pattern with globalThis persistence for Next.js hot-reload
const client = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;  // Stop retrying after 5 attempts
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
  enableReadyCheck: true,
  connectTimeout: 5000,
});
```

- **Disable toggle:** `REDIS_DISABLED=true` → `getRedisClient()` returns null → all cache ops become no-ops
- **Graceful degradation:** If Redis is down, all routes fallback to database queries

### 14.2 Cache-Aside Pattern (`admin/cache.ts`)

```typescript
async function cacheGet<T>(key, ttlSeconds, fetcher): Promise<T> {
  // 1. Try Redis GET
  // 2. If hit → parse JSON and return
  // 3. If miss → call fetcher() → get fresh data
  // 4. SET in Redis with TTL
  // 5. Return data
}
```

### 14.3 Cache TTLs

| Domain | TTL | Rationale |
|--------|-----|-----------|
| Dashboard | 30s | KPIs need near-real-time data |
| Analytics | 30s | Aggregation results change frequently |
| Registry | 20s | Incident list is highly dynamic |
| Flagged | 20s | Moderation queue changes rapidly |
| Users | 60s | User list changes less frequently |
| Workers | 60s | Worker stats update on task changes |
| Authority-Heads | 60s | Head list rarely changes |
| Departments | 120s | Department structure is stable |
| Config | 300s | System config rarely changes |
| Audit | 30s | Audit events stream continuously |
| Audit-Logs | 30s | CRUD logs accumulate steadily |
| Abuse | 60s | Abuse cases change on admin action |

### 14.4 Cache Invalidation

On every write operation, related cache domains are invalidated:

```typescript
// Example: After approving moderation
await invalidateDomain('dashboard', 'registry', 'flagged', 'moderation');
```

`invalidateDomain()` uses Redis SCAN to find and delete all keys matching `citypulse:admin:{domain}*`.

---

## 15. Rate Limiting

### 15.1 Algorithm

CityPulse implements a **sliding-window rate limiter** using an in-memory Map:

```typescript
const store = new Map<string, { timestamps: number[] }>();

function rateLimit(key, limit, windowMs): RateLimitResult {
  // 1. Periodic cleanup (every 60s) removes expired entries
  // 2. Get/create entry for key
  // 3. Filter timestamps to keep only those within window
  // 4. If count >= limit → return { allowed: false, retryAfter }
  // 5. Else → push current timestamp, return { allowed: true, remaining }
}
```

### 15.2 Rate Limit Tiers

**Authority App:**
| Tier | Pattern | Limit | Window |
|------|---------|-------|--------|
| Auth | `/api/auth/*` | 15 req | 60s |
| API | `/api/*` | 60 req | 60s |
| Page | `/*` (all others) | 120 req | 60s |

**Citizens App:**
| Tier | Pattern | Limit | Window |
|------|---------|-------|--------|
| Auth | `/api/auth/*` | 15 req | 60s |
| Report | `/api/report*` | 10 req | 60s |
| API | `/api/*` | 60 req | 60s |
| Page | `/*` (all others) | 120 req | 60s |

### 15.3 Response Headers

Every response includes:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1738950000
```

When rate-limited (HTTP 429):
```json
{
  "error": "Too many requests. Please slow down.",
  "retryAfter": 23
}
```
With `Retry-After` header.

---

## 16. Proxy & Request Routing (Next.js 16)

### 16.1 Background

Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`. CityPulse migrated all authentication and rate-limiting logic from middleware to proxy.

### 16.2 Authority Proxy (`authority/src/proxy.ts`)

```
Incoming Request
    │
    ├── Get client IP (X-Forwarded-For → X-Real-IP → 127.0.0.1)
    ├── Determine tier (auth/api/page)
    ├── Apply rate limiting
    │   └── If exceeded → 429 + Retry-After
    │
    ├── Public routes (/sign-in, /sign-up, /api/auth) → Pass through
    │
    ├── No token → Redirect to /sign-in
    │
    ├── Valid token:
    │   ├── CITIZEN role → Redirect to Citizens Portal
    │   ├── "/" path → Role-based redirect:
    │   │   ├── ADMIN → /admin/dashboard
    │   │   ├── WORKER → /worker
    │   │   └── HEAD → /dashboard
    │   └── Other paths → Pass through
    │
    └── Invalid/expired token → Delete cookie, redirect to /sign-in
```

### 16.3 Citizens Proxy (`citizens/src/proxy.ts`)

```
Incoming Request
    │
    ├── Rate limiting (4 tiers including /api/report → 10 req/60s)
    │
    ├── Auth API paths → Pass through
    │
    ├── No token:
    │   ├── Protected path (/dashboard, /my-reports, /reporting) → Redirect to /sign-in
    │   └── Public path → Pass through
    │
    ├── Valid token:
    │   ├── Non-CITIZEN role → Redirect to Authority Portal
    │   └── CITIZEN → Pass through
    │
    └── Invalid token:
        ├── Protected path → Delete cookie, redirect to /sign-in
        └── Public path → Delete cookie, pass through
```

### 16.4 Route Matcher

Both proxies use the same matcher to exclude static assets:
```typescript
matcher: [
  "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  "/(api|trpc)(.*)",
]
```

---

## 17. Citizens Portal — Features & Implementation

### 17.1 Landing Page (`page.tsx`)

- Public homepage with hero section
- CTA buttons: "Report an Issue", "Track Progress"
- Overview of platform capabilities

### 17.2 Citizen Registration & Login

**Registration (`/sign-up`):**
- Fields: name, email, phone, password
- Auto-username generation from email
- Immediate activation (no admin approval)
- Dual-write to PG + Mongo
- Kafka event: `user.created`

**Login (`/sign-in`):**
- Accepts email or username
- CITIZEN-only gate
- JWT cookie set on success

### 17.3 AI-Powered Incident Reporting (`/reporting` — 1,077 lines)

This is the most complex citizen-facing feature. The reporting flow:

1. **Image Upload**
   - Citizen takes/uploads a photo of the infrastructure issue
   - Image uploaded to Cloudinary via `/api/uploads`
   - Returns `secure_url`

2. **AI Classification (automatic on upload)**
   - Image sent to CityPulse `/classify` endpoint
   - CLIP model classifies the issue type (pothole, water leak, etc.)
   - Returns: category, confidence, department, priority, severity

3. **AI Report Generation**
   - Classification results + citizen description + location → `/generate-report`
   - Ollama generates structured incident report
   - Report sections filtered to: Incident Summary, Issue Details, Recommended Actions, Estimated Urgency

4. **Geolocation**
   - Browser `watchPosition` for live GPS tracking
   - Latitude, longitude, and address captured
   - Used for deduplication geo-cell

5. **Form Fields**
   - Title (auto-filled from AI, editable)
   - Description (citizen's own words)
   - Category (auto-selected by AI, dropdown override)
   - Priority (auto-selected, override available)
   - Location (auto-detected, manual override)

6. **Submission**
   - `saveReportToDB()` → `POST /api/issues`
   - Deduplication check (geo-cell + Jaccard similarity ≥ 0.85)
   - If duplicate found → report count incremented, reporter added
   - If new → full issue created with dual-write
   - Kafka event: `issue.created`

### 17.4 My Reports (`/my-reports`)

- Lists all issues reported by the current citizen
- Filtered by `reportedBy: user.userId`
- Shows status, category, priority, date

### 17.5 Dashboard (`/dashboard`)

- Citizen's personalized dashboard
- Stats: total reports, resolved, in-progress, pending
- Recent activity

### 17.6 AI Chatbot (`ChatBot.tsx` — 242 lines)

Floating chatbot widget available on all pages:

1. **Initialization:** Fetches all recent incidents from database
2. **Context Building:** Constructs a context string with all live incident data
3. **Conversation:** User types questions → sent to CityPulse `/chat` with full context
4. **Capabilities:**
   - "What's the status of the pothole on MG Road?"
   - "How many water issues are open?"
   - "Which department handles streetlights?"
   - Contextual answers grounded in real city data

---

## 18. Authority Head Dashboard — Features & Implementation

### 18.1 Main Dashboard (`/dashboard`)

**API:** `GET /api/head/dashboard`

Displays:
- **KPI Cards:** Total incidents, active, high-severity, SLA breached, resolved today
- **7-Day Trend:** Line chart of daily incident counts
- **Status Distribution:** Pie chart (Active / Resolved / On Hold)
- **Severity Distribution:** Bar chart (Low / Medium / High / Critical)
- **Zone Distribution:** Geographic breakdown
- **Worker Utilization:** Bar chart of worker workloads

### 18.2 Incident Management (`/incidents`)

**API:** `GET /api/head/incidents`

- Filterable table with columns: ID, title, severity, status, zone, assigned workers
- Filters: status, severity, zone, SLA breached
- Each incident expandable for full details + assignment

### 18.3 Worker Assignment

**API:** `GET/POST /api/head/incidents/assign`

1. Head clicks "Assign" on an incident
2. System fetches all available workers with current workload
3. Sends to CityPulse AI `/assign-team` for ranking
4. Displays ranked worker list with AI scores
5. Head selects workers → `POST` with `{ incidentId, workerIds }`
6. Dual-write assignment to PG + Mongo

### 18.4 Worker Management (`/workers`)

**API:** `GET /api/head/workers`

- All active workers with:
  - Zone assignment
  - Current workload (assigned incidents)
  - Availability status
- Stats summary: total, available, busy

### 18.5 EOD Review (`/eod-review`)

**API:** `GET/PATCH /api/head/worker-updates`

Full review page for EOD submissions:
- **4 tabs:** Pending, Approved, Rejected, All
- **Stats cards** with count per status
- **Card per submission:**
  - Worker avatar + name
  - Incident ID
  - Date and submission time
  - Description text
  - Evidence photos (clickable for full-size modal)
  - Status badge + published badge
  - Head remarks (if already reviewed)
- **Action buttons** on pending:
  - Approve → Modal with optional remarks + "Publish to Transparency" checkbox
  - Reject → Modal with optional remarks
- Auto-refresh after each action

### 18.6 SLA Monitor (`/sla`)

**API:** `GET /api/head/sla`

SLA computation per incident:
```
Severity → Deadline Hours:
  Critical: 24 hours
  High:     48 hours
  Medium:   72 hours
  Low:      120 hours

Computed Fields:
  deadline     = createdAt + deadlineHours
  isBreached   = now > deadline && status ≠ Resolved
  timeRemaining = deadline - now (or 0 if breached)
  urgencyScore = 1 - (timeRemaining / totalAllottedTime)
  progressPct  = min(urgencyScore * 100, 100)
```

Display:
- Table sorted by urgency (most urgent first)
- Color-coded: Red (breached), Yellow (at-risk), Green (on-track)
- Columns: incident, severity, status, deadline, time remaining, breach status

### 18.7 Verification Queue (`/verification`)

**API:** `GET /api/head/verification`

- Pending moderation items (AI confidence below threshold)
- Today's approved/rejected counts
- Each item shows confidence score + AI reasoning

### 18.8 Analytics (`/analytics`)

**API:** `GET /api/head/analytics`

- Zone performance (top 6 zones)
- Category distribution (top 6 categories)
- Severity distribution
- Hotspots (top 4 problem areas)
- Worker ranking (top 10 by performance)

### 18.9 Audit Log (`/audit`)

**API:** `GET /api/head/audit`

- Combined timeline from AuditEvent + AuditLog models
- Last 75 entries, sorted descending by timestamp
- Shows: actor, action type, entity, remark, timestamp

### 18.10 Navigation

**Navbar (`Navbar.tsx`):**
Links: Dashboard → Incidents → Workers → **EOD Reviews** → SLA Monitor → Verification → Analytics → Audit Log

**AppNavbar routing (`AppNavbar.tsx`):**
```
/admin/*  → AdminNavbar
/worker/* → WorkerNavbar
/sign-in, /sign-up → null (no navbar)
default   → Navbar (Authority Head)
```

---

## 19. Worker Dashboard — Features & Implementation

### 19.1 Dashboard Structure (`worker.tsx` — ~840 lines)

The worker dashboard is a single-page tabbed interface with 4 tabs:

### 19.2 Tab 1: My Tasks

**API:** `GET /api/worker/my-tasks`

- Lists all incidents assigned to the current worker
- Each task card shows:
  - Incident title, severity, status
  - SLA breach indicator
  - Today's EOD submission status (submitted / not submitted)
- Stats bar: total assigned, active, resolved, on hold, EOD pending

### 19.3 Tab 2: Department Tasks

**API:** `GET /api/worker/dept-tasks`

- All non-resolved incidents in the worker's department/zone
- Flags `isAssignedToMe` for highlighting
- SLA breach indicator per task
- Helps workers see the bigger picture

### 19.4 Tab 3: EOD Update

**API:** `POST /api/worker/eod-update`

EOD submission form:
1. **Task picker:** Select from assigned incidents (dropdown)
2. **Description:** Textarea (minimum 10 characters) describing today's work
3. **Image upload:** Evidence photos (multiple, uploaded to Cloudinary)
4. **Validation:**
   - Prevents duplicate same-day submissions for same incident
   - Allows re-submission (overwrites previous same-day entry)
   - Must be assigned to the incident

### 19.5 Tab 4: History

**API:** `GET /api/worker/history`

- All past EOD updates grouped by incident
- Each entry shows: date, description, images, status (pending/approved/rejected), head remarks
- Aggregate stats: total updates, approved, pending, rejected, incidents worked, resolved

### 19.6 Worker Navigation (`WorkerNavbar.tsx`)

Dedicated navbar for workers with:
- Dashboard link
- Profile avatar with dropdown (name, email, role)
- Logout button

---

## 20. Admin Panel — Features & Implementation

### 20.1 Admin Structure (`admin.tsx` — 309 lines)

Multi-tab admin panel accessible only to `ADMIN` role users:

### 20.2 Sub-pages

| Path | Feature | Description |
|------|---------|-------------|
| `/admin/dashboard` | Dashboard | KPIs, incident trends, integrity alerts |
| `/admin/registry` | Incident Registry | Full searchable/filterable incident list |
| `/admin/flagged` | Flagged Items | Incidents pending moderation |
| `/admin/abuse` | Abuse Management | Spam/harassment cases with actions (Warn/Block) |
| `/admin/users` | User Management | List all users, change roles, activate/deactivate |
| `/admin/workers` | Worker Stats | Worker performance metrics |
| `/admin/authority-heads` | Authority Heads | Manage department heads |
| `/admin/departments` | Departments | Department registry with head/worker assignments |
| `/admin/config` | System Config | Key/value system settings |
| `/admin/analytics` | Analytics | Zone heatmaps, department comparisons |
| `/admin/audit` | Audit Events | Moderation and config change events |
| `/admin/audit-logs` | CRUD Audit Logs | Detailed table-level change logs |

### 20.3 Moderation Workflow

**API:** `POST /api/admin/moderation`

```
Citizen reports issue
    │
    ├── AI confidence ≥ threshold → Auto-approved
    │
    └── AI confidence < threshold → Pending moderation
        │
        ├── Admin reviews in /admin/flagged
        │
        ├── Action: APPROVE
        │   └── moderation.status = 'approved'
        │
        ├── Action: REJECT
        │   └── moderation.status = 'rejected'
        │
        └── Action: FLAG_CITIZEN
            └── moderation.citizenFlagged = true
            └── May trigger abuse case creation
```

### 20.4 User Lifecycle

```
1. User signs up → isActive = false (authority users)
2. Admin sees in /admin/users
3. Admin activates user → isActive = true
4. Admin can change role (WORKER ↔ AUTHORITY_HEAD)
5. Admin can deactivate → user can't log in
6. All changes dual-written + audit-logged + published to Kafka
```

---

## 21. Transparency Dashboard

### 21.1 Purpose

Publicly accessible dashboard showing what the municipality is doing about reported issues, building citizen trust.

### 21.2 Implementation

**Citizens App:** `/transparency` page + 3 API routes

**API Routes:**
- `GET /api/transparency/issues` — All incidents (PG → Mongo fallback)
- `GET /api/transparency/ongoing` — Non-resolved incidents with location
- `GET /api/transparency/works/[incidentCode]` — Individual incident with worker updates

**Page Features:**
- City-wide stats: total incidents, resolved, in-progress, open
- Department performance table with resolution rates
- Hotspot zones with trend indicators
- Recent resolutions with citizen ratings
- Zone and time-range filters

**Worker Update Publishing:**
When heads approve worker EOD updates with "Publish to Transparency" checked:
```
PATCH /api/head/worker-updates
  → publishedToTransparency = true
  → Update visible on transparency/works/[incidentCode]
```

---

## 22. Issue Deduplication System

### 22.1 Problem

Same issue (e.g., a pothole) reported by 50 different citizens = 50 duplicate entries cluttering the system.

### 22.2 Solution (`dedupe.ts`)

**Three-Step Deduplication:**

1. **Geo-Cell Bucketing** (`geoCell()`)
   ```typescript
   // Round lat/lng to 3 decimal places (~111m cells)
   geoCell(12.9716, 77.5946, 3) → "12.972|77.595"
   ```
   Groups reports within ~111m radius.

2. **Text Normalization** (`normalizeIssueText()`)
   ```typescript
   normalizeIssueText("Big POTHOLE on M.G. Road!")
   → "big pothole on mg road"
   ```

3. **Jaccard Similarity** (`jaccardSimilarity()`)
   ```typescript
   // Token-level Jaccard index
   jaccardSimilarity("pothole on mg road", "pothole near mg road")
   → 0.80 (4 shared tokens / 5 total)
   ```

4. **SHA-1 Hash** (`sha1Hex()`)
   Deterministic hash of normalized text for fast lookup.

### 22.3 Deduplication Flow

```
Citizen submits report
    │
    ├── Has geolocation? → Build dedupeKey
    │   ├── geoCell(lat, lng) → "12.972|77.595"
    │   ├── normalizeIssueText(title + description) → normalized
    │   ├── sha1Hex(geoCell + normalized) → dedupeKey
    │   └── Find candidates: same geoCell, non-resolved, last 7 days
    │       ├── For each candidate: jaccardSimilarity(new, candidate)
    │       ├── Best match ≥ 0.85 → DUPLICATE FOUND
    │       │   └── Increment reportCount, add reporter to list
    │       └── No match ≥ 0.85 → CREATE NEW ISSUE
    │
    └── No geolocation → CREATE NEW ISSUE (can't deduplicate)
```

---

## 23. SLA Monitoring

### 23.1 Severity-Based SLA Hours

| Severity | Deadline | Rationale |
|----------|----------|-----------|
| Critical | 24 hours | Power outages, major water mains |
| High | 48 hours | Large potholes, sewage overflow |
| Medium | 72 hours | Broken streetlights, minor leaks |
| Low | 120 hours | Cosmetic issues, graffiti |

### 23.2 SLA Computation (`/api/head/sla`)

For each non-resolved incident:
```
deadline      = incident.createdAt + slaHours
isBreached    = (Date.now() > deadline)
timeRemaining = max(0, deadline - Date.now())
urgencyScore  = 1 - (timeRemaining / (slaHours * 3600000))
progressPct   = min(urgencyScore * 100, 100)
```

### 23.3 SLA in Worker Views

Worker's `dept-tasks` and `my-tasks` routes also compute and return `slaBreached` flag for each incident, allowing workers to prioritize urgent items.

---

## 24. Audit & Compliance

### 24.1 Two Audit Systems

| System | Model | Purpose |
|--------|-------|---------|
| **Audit Events** | `AuditEvent` | High-level actions: moderation decisions, config changes, abuse actions |
| **Audit Logs** | `AuditLog` | CRUD-level changes: old/new values, IP address, user agent |

### 24.2 Audit Events

Captured for:
- `MODERATION_APPROVED` — Admin approves an incident
- `MODERATION_REJECTED` — Admin rejects an incident
- `CITIZEN_FLAGGED` — Admin flags a citizen
- `USER_UPDATED` — Role/status change
- `ABUSE_ACTION` — Warn/Block action taken
- `CONFIG_UPDATED` — System config changed

### 24.3 CRUD Audit Logs

Captured for:
- `USER_CREATED/UPDATED/DELETED`
- `INCIDENT_CREATED/UPDATED/STATUS_CHANGED`
- `IMAGE_UPLOADED`
- `DEPARTMENT_CREATED/UPDATED`
- `ROLE_CHANGED`
- `USER_ACTIVATED/DEACTIVATED`

Each log stores: userId, action, tableName, recordId, oldValue, newValue, ipAddress, userAgent.

### 24.4 Append-Only Enforcement (PostgreSQL)

The following tables have triggers that prevent UPDATE/DELETE operations:
- `incident_status_history`
- `incident_images`
- `worker_updates`
- `audit_logs`
- `audit_events`

This ensures complete, immutable audit trail for compliance.

---

## 25. Infrastructure & Deployment

### 25.1 PostgreSQL (Docker)

```yaml
services:
  postgres:
    image: postgis/postgis:14-3.4
    container_name: citypulse-postgres
    environment:
      POSTGRES_DB: citypulse
      POSTGRES_USER: citypulse
      POSTGRES_PASSWORD: citypulse
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./initdb:/docker-entrypoint-initdb.d:ro
```

**Initialization:** On first container start, PostgreSQL automatically runs:
1. `00_extensions.sql` — Enables uuid-ossp, pgcrypto, postgis
2. `10_schema.sql` — Creates core tables with constraints and triggers
3. `11_schema_from_ts_models.sql` — Extends schema to match Mongoose models

### 25.2 PostgreSQL Connection

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX ?? "5"),
  ssl: { rejectUnauthorized: false },
});
```

Singleton pool stored on `globalThis` to survive Next.js hot-reload.

### 25.3 MongoDB Connection

```typescript
mongoose.connect(MONGODB_URL, {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

Cached connection stored on `globalThis.mongoose` for hot-reload persistence.

### 25.4 Ports

| Service | Port |
|---------|------|
| Authority App | 5100 |
| Citizens App | 5101 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| CityPulse AI Backend | 8000 |

---

## 26. Environment Variables

### Authority App (`.env.local`)

```
# Database
MONGODB_URL=mongodb+srv://...
DATABASE_URL=postgresql://citypulse:citypulse@localhost:5432/citypulse

# Feature Flags
DUAL_WRITE_POSTGRES=true
MONGO_READ_ONLY=false
READ_FROM_POSTGRES=true

# Auth
JWT_SECRET=your-super-secret-key

# Kafka
KAFKA_ENABLED=true
UPSTASH_KAFKA_REST_URL=https://...
UPSTASH_KAFKA_REST_USERNAME=...
UPSTASH_KAFKA_REST_PASSWORD=...

# Redis
REDIS_URL=redis://127.0.0.1:6379
REDIS_DISABLED=false

# Cross-app
NEXT_PUBLIC_CITIZENS_URL=http://localhost:5101
```

### Citizens App (`.env.local`)

```
# Database
MONGODB_URL=mongodb+srv://...
DATABASE_URL=postgresql://citypulse:citypulse@localhost:5432/citypulse

# Feature Flags
DUAL_WRITE_POSTGRES=true
MONGO_READ_ONLY=false
READ_FROM_POSTGRES=true

# Auth
JWT_SECRET=your-super-secret-key

# Kafka
KAFKA_ENABLED=true
UPSTASH_KAFKA_REST_URL=https://...
UPSTASH_KAFKA_REST_USERNAME=...
UPSTASH_KAFKA_REST_PASSWORD=...

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# AI Backend
NEXT_PUBLIC_CITYPULSE_API=http://localhost:8000

# Cross-app
NEXT_PUBLIC_AUTHORITY_URL=http://localhost:5100
```

---

## 27. Use Cases

### 27.1 Citizen Use Cases

| # | Use Case | Actor | Flow |
|---|---------|----|------|
| UC-1 | Register Account | Citizen | Sign up → auto-username → JWT cookie → access granted |
| UC-2 | Report Issue with AI | Citizen | Upload photo → AI classifies → AI generates report → submit with location → deduplicated |
| UC-3 | Track My Reports | Citizen | View all submitted reports → status updates |
| UC-4 | View Transparency Dashboard | Public | See all incidents, department performance, resolution rates |
| UC-5 | Use AI Chatbot | Citizen | Ask questions about city incidents → AI answers with context |

### 27.2 Authority Head Use Cases

| # | Use Case | Actor | Flow |
|---|---------|----|------|
| UC-6 | View Dashboard | Head | Login → KPIs, trends, distributions |
| UC-7 | Triage Incidents | Head | Filter incidents → review details → assign workers |
| UC-8 | Assign Workers (AI) | Head | Select incident → AI ranks workers → assign |
| UC-9 | Monitor SLA | Head | View SLA tracker → identify breaches → prioritize |
| UC-10 | Verify Reports | Head | Review moderation queue → approve/reject |
| UC-11 | Review EOD Updates | Head | View pending EODs → approve/reject with remarks → publish to transparency |
| UC-12 | View Analytics | Head | Zone performance, category distribution, worker ranking |
| UC-13 | View Audit Log | Head | Timeline of all system actions |

### 27.3 Worker Use Cases

| # | Use Case | Actor | Flow |
|---|---------|----|------|
| UC-14 | View Assigned Tasks | Worker | My Tasks tab → see assigned incidents + EOD status |
| UC-15 | View Department Tasks | Worker | Dept Tasks tab → all department incidents |
| UC-16 | Submit EOD Update | Worker | EOD tab → select task → describe work → upload photos → submit |
| UC-17 | View Work History | Worker | History tab → past updates grouped by incident |

### 27.4 Admin Use Cases

| # | Use Case | Actor | Flow |
|---|---------|----|------|
| UC-18 | Manage Users | Admin | List users → activate/deactivate → change roles |
| UC-19 | Manage Departments | Admin | View departments → assign heads → manage workers |
| UC-20 | Moderate Incidents | Admin | Flagged queue → approve/reject/flag citizen |
| UC-21 | Handle Abuse | Admin | Abuse cases → warn/block citizens |
| UC-22 | Configure System | Admin | System config → update settings |
| UC-23 | View Audit Trail | Admin | Audit events + CRUD logs |
| UC-24 | View System Analytics | Admin | Zone heatmaps, incident trends, worker stats |

---

## 28. Data Flow Diagrams

### 28.1 Incident Reporting Flow

```
Citizen                     Citizens App                  CityPulse AI         Backend
  │                            │                            │                   │
  ├── Upload Photo ──────────► POST /api/uploads           │                   │
  │                            ├── Cloudinary upload ──────►│                   │
  │                            │◄── secure_url ────────────┤                   │
  │                            │                            │                   │
  ├── [Auto] Classify ────────► POST /classify ────────────►│                   │
  │                            │◄── category, severity ────┤                   │
  │                            │                            │                   │
  ├── Generate Report ────────► POST /generate-report ─────►│                   │
  │                            │◄── structured report ─────┤                   │
  │                            │                            │                   │
  ├── Submit Issue ───────────► POST /api/issues           │                   │
  │                            │                            │    ┌──────────┐   │
  │                            ├── Dedupe check ────────────┼───►│ MongoDB  │   │
  │                            │                            │    └──────────┘   │
  │                            ├── Dual-write ──────────────┼───►│ PostgreSQL│  │
  │                            │                            │    └──────────┘   │
  │                            ├── Publish event ───────────┼───►│  Kafka   │   │
  │                            │                            │    └──────────┘   │
  │◄── Success response ──────┤                            │                   │
```

### 28.2 EOD Review Flow

```
Worker                    Authority App              Head                 Database
  │                          │                        │                     │
  ├── Submit EOD ───────────► POST /api/worker/eod    │                     │
  │                          ├── Validate ────────────┼─────────────────────┤
  │                          ├── Create WorkerUpdate ─┼─────────────────────►
  │◄── Success ──────────────┤                        │                     │
  │                          │                        │                     │
  │                          │  GET /api/head/worker-updates?status=pending │
  │                          │◄───────────────────────┤                     │
  │                          ├── Query WorkerUpdate ──┼─────────────────────►
  │                          │◄───────────────────────┼─────────────────────┤
  │                          ├── Return updates ──────►                     │
  │                          │                        │                     │
  │                          │  PATCH /api/head/worker-updates              │
  │                          │◄── Approve with remarks┤                     │
  │                          ├── Update status ───────┼─────────────────────►
  │                          ├── Return success ──────►                     │
```

### 28.3 Admin Data Flow

```
Admin Request → Rate Limiter → JWT Auth → Cache Check
                                            │
                                   ┌────────┴────────┐
                                   │  Cache Hit?      │
                                   │                  │
                                  Yes                No
                                   │                  │
                              Return cached       Fetch from DB
                                               ┌────┴────┐
                                              PG        Mongo
                                           (primary)  (fallback)
                                               │         │
                                               └────┬────┘
                                                    │
                                              Store in Cache
                                                    │
                                              Return Response
```

---

## 29. Security Measures

| Layer | Measure | Implementation |
|-------|---------|---------------|
| **Transport** | HTTPS (production) | Next.js config + reverse proxy |
| **Authentication** | JWT with HS256 | jose library, 7-day expiry |
| **Cookie Security** | httpOnly, secure, sameSite | Prevents XSS cookie theft |
| **Password Storage** | bcrypt (12 rounds) | One-way hash, salt per password |
| **Rate Limiting** | Per-IP sliding window | Prevents brute force and DDoS |
| **Role Authorization** | API-level role checks | `getCurrentUser() → role` validation |
| **Cross-App Isolation** | Separate cookies + redirect guards | CITIZEN can't access authority, vice versa |
| **SQL Injection** | Parameterized queries | All PG queries use `$1, $2, ...` placeholders |
| **NoSQL Injection** | Mongoose schema validation | Schema-enforced types and enums |
| **Audit Trail** | Append-only tables | PG triggers prevent DELETE/UPDATE on audit tables |
| **Input Validation** | Server-side validation | Required fields, min/max lengths, enum checks |
| **Error Handling** | Sanitized error responses | No stack traces or internal details exposed |
| **CORS** | Same-origin (ports 5100/5101) | Cross-app via explicit NEXT_PUBLIC_*_URL |

---

## 30. Future Scope

1. **Push Notifications** — Real-time alerts for status changes (WebSocket / SSE)
2. **Mobile App** — React Native citizen app with camera integration
3. **Geofencing** — Auto-assign nearest workers using PostGIS proximity queries
4. **ML Model Fine-tuning** — Train CLIP on local municipal data for higher accuracy
5. **PDF Report Export** — Generate downloadable reports for council meetings
6. **Multi-Language Support** — i18n for Hindi, Kannada, Marathi
7. **Citizen Satisfaction Surveys** — Post-resolution feedback
8. **Automated Escalation** — Auto-escalate SLA-breached incidents to higher authority
9. **Dashboard Widgets** — Customizable admin dashboard with drag-and-drop widgets
10. **Predictive Analytics** — ML-based prediction of future incident hotspots

---

## Appendix A: Running the Project

### Prerequisites
- Node.js 18+ and npm
- Docker Desktop (for PostgreSQL)
- MongoDB Atlas or local MongoDB
- Redis (optional, for caching)
- CityPulse AI backend (optional, for AI features)

### Setup Steps

```bash
# 1. Start PostgreSQL
cd infra/postgres
docker-compose up -d

# 2. Start Authority App
cd authority
npm install
cp .env.example .env.local  # Configure env vars
npm run dev                  # Port 5100

# 3. Start Citizens App
cd citizens
npm install
cp .env.example .env.local  # Configure env vars
npm run dev                  # Port 5101

# 4. (Optional) Start Kafka Consumer
node infra/kafka/kafka-consumer.mjs

# 5. (Optional) Apply PostgreSQL schema
cd authority
npm run db:schema:apply

# 6. (Optional) Backfill MongoDB → PostgreSQL
npm run db:backfill
```

---

## Appendix B: API Summary

| App | Section | Routes | Methods |
|-----|---------|--------|---------|
| Authority | Auth | 4 | GET, POST |
| Authority | Admin | 13 | GET, POST, PATCH, PUT |
| Authority | Head | 10 | GET, POST, PATCH |
| Authority | Worker | 4 | GET, POST |
| Citizens | Auth | 5 | GET, POST |
| Citizens | Issues | 1 | GET, POST |
| Citizens | Reports | 3 | GET, POST |
| Citizens | Transparency | 3 | GET |
| Citizens | Uploads | 1 | POST |
| Citizens | Health | 1 | GET |
| **Total** | | **45** | |

---

## Appendix C: Mongoose Models Summary

| Model | App | Collection | Fields | Indexes |
|-------|-----|-----------|--------|---------|
| User | Authority | users | 12 | 3 |
| Incident | Authority | incidents | 16 + embedded moderation | 7 |
| Department | Authority | departments | 5 | 2 |
| WorkerUpdate | Authority | workerupdates | 12 | 3 |
| AbuseCase | Authority | abusecases | 9 | 5 |
| AdminUser | Authority | adminusers | 7 | 2 |
| AuditLog | Authority | auditlogs | 9 | 3 |
| AuditEvent | Authority | auditevents | 7 | 3 |
| IncidentImage | Authority | incidentimages | 5 | 2 |
| IncidentStatusHistory | Authority | incidentstatushistories | 5 | 3 |
| SystemConfig | Authority | systemconfigs | 3 | 1 |
| Issue | Citizens | issues | 22 | 3 |

---

*End of Report*

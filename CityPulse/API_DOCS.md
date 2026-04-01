# CityPulse — Frontend API Connection Guide

> **Base URL:** `http://localhost:8000`
> **Protocol:** REST over HTTP
> **Format:** All responses are JSON
> **CORS:** Fully open (`*`) — any frontend origin can connect

---

## Quick Start

```javascript
// Base URL constant
const API = 'http://localhost:8000';

// Check if backend is online before making calls
const health = await fetch(`${API}/health`).then(r => r.json());
console.log(health.status); // "ready" | "degraded"
```

---

## Endpoints Overview

| # | Method | Endpoint | Purpose | Input |
|---|--------|----------|---------|-------|
| 1 | POST | `/classify` | Classify image (type + severity) | `multipart/form-data` |
| 2 | POST | `/generate-report` | Generate incident report from data | `application/json` |
| 3 | POST | `/classify-and-report` | Full pipeline: image → classify → report | `multipart/form-data` |
| 4 | POST | `/chat` | CityPulse AI chatbot | `application/json` |
| 5 | POST | `/speech-to-text` | Mock speech transcription | `multipart/form-data` |
| 6 | POST | `/summarize-incidents` | Executive summary of incidents | `application/json` |
| 7 | POST | `/zone-analysis` | Hotspot zone analysis | `application/json` |
| 8 | POST | `/assign-team` | ML-scored team assignment | `application/json` |
| 9 | GET  | `/health` | System health check | — |

---

## 1. POST `/classify`

Upload an infrastructure image. Returns issue type, severity, confidence, and routing decision.

### Request
```
Content-Type: multipart/form-data
```
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File (image) | Yes | JPG, PNG, etc. |

### Frontend Example
```javascript
async function classifyImage(imageFile) {
  const fd = new FormData();
  fd.append('file', imageFile);

  const res = await fetch(`${API}/classify`, { method: 'POST', body: fd });
  return res.json();
}
```

### Response
```json
{
  "top_prediction": {
    "category": "Pothole / Road Damage",
    "confidence": 99.72,
    "department": "Roads & Transport",
    "priority": "Medium",
    "effective_priority": "High"
  },
  "severity": {
    "level": "High",
    "scores": { "Low": 6.65, "Medium": 9.52, "High": 74.89, "Critical": 8.94 }
  },
  "confidence_routing": {
    "action": "auto_forward_to_authority",
    "reason": "High confidence (99.72%) — auto-forwarded to department"
  },
  "all_predictions": [ ... ],
  "timestamp": "2026-02-07T15:50:03.748255",
  "filename": "pothole.jpg",
  "inference_time_ms": 256.9,
  "device": "cuda"
}
```

### Key Fields for UI
- `top_prediction.category` — display as issue type badge
- `top_prediction.confidence` — show as percentage bar
- `severity.level` — color code: Low=green, Medium=yellow, High=orange, Critical=red
- `confidence_routing.action` — `"auto_forward_to_authority"` (≥60%), `"forward_to_authority"` (30-60%), or `"send_to_admin_review"` (<30%)
- `top_prediction.department` — auto-assigned department

---

## 2. POST `/generate-report`

Send classification data to generate a formal incident report.

### Request
```
Content-Type: application/json
```
```json
{
  "category": "Pothole / Road Damage",
  "confidence": 99.72,
  "department": "Roads & Transport",
  "priority": "High",
  "severity": "High",
  "location": "Sector 12, Main Road",
  "description": "Large pothole near school entrance"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | Yes | Issue type from classification |
| `confidence` | float | Yes | Confidence percentage |
| `department` | string | Yes | Department name |
| `priority` | string | Yes | Priority level |
| `severity` | string | No | "low", "medium", "high", "critical" (default: "Medium") |
| `location` | string | No | Location description |
| `description` | string | No | Citizen's description |

### Response
```json
{
  "report": "INCIDENT SUMMARY\n...\nRECOMMENDED ACTIONS\n1. ...",
  "metadata": {
    "category": "Pothole / Road Damage",
    "department": "Roads & Transport",
    "priority": "High",
    "severity": "High",
    "location": "Sector 12, Main Road",
    "generated_at": "2026-02-07T15:50:14.000000",
    "model": "llama3"
  }
}
```

---

## 3. POST `/classify-and-report`

**Main endpoint for citizen reporting flow.** Combines image classification and report generation in one call.

### Request
```
Content-Type: multipart/form-data
```
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File (image) | Yes | Infrastructure photo |
| `location` | string | No | Location description |
| `description` | string | No | Citizen notes about the issue |

### Frontend Example
```javascript
async function fullPipeline(imageFile, location, description) {
  const fd = new FormData();
  fd.append('file', imageFile);
  if (location) fd.append('location', location);
  if (description) fd.append('description', description);

  const res = await fetch(`${API}/classify-and-report`, {
    method: 'POST',
    body: fd
  });
  return res.json();
}
```

### Response
```json
{
  "classification": {
    "top_prediction": { "category": "Pothole / Road Damage", "confidence": 99.72, "department": "Roads & Transport", "priority": "Medium", "effective_priority": "High" },
    "severity": { "level": "High", "scores": { "Low": 6.65, "Medium": 9.52, "High": 74.89, "Critical": 8.94 } },
    "confidence_routing": { "action": "auto_forward_to_authority", "reason": "High confidence (99.72%) — auto-forwarded to department" },
    "all_predictions": [ ... ]
  },
  "report": "INCIDENT REPORT #2026-02-07-001\n...",
  "confidence_scores": {
    "image_confidence": 99.72,
    "text_relevance": 0,
    "combined_confidence": 99.72
  },
  "metadata": {
    "location": "Sector 12",
    "citizen_description": "Big hole in road",
    "generated_at": "2026-02-07T15:51:18.749480",
    "filename": "photo.jpg",
    "device": "cuda"
  }
}
```

### Recommended UI Flow
1. User uploads photo + fills location/description
2. Call `/classify-and-report`
3. Display `classification.top_prediction` as a summary card
4. Show `report` text in a formatted panel
5. Use `confidence_scores.combined_confidence` for confidence indicator

---

## 4. POST `/chat`

AI chatbot that knows about CityPulse, infrastructure categories, and system processes.

### Request
```json
{
  "message": "How do I report a pothole?",
  "context": ""
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's question |
| `context` | string | No | Extra context (e.g. current incident details) |

### Frontend Example
```javascript
async function sendChat(message, context = '') {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context })
  });
  const data = await res.json();
  return data.reply;
}
```

### Response
```json
{
  "reply": "To report a pothole, simply open the CityPulse app...",
  "timestamp": "2025-01-20T14:40:00.000000"
}
```

### Tips
- Pass `context` when the user is viewing a specific incident — the bot will give contextual answers
- Manage chat history on the frontend side; the backend is stateless per request
- The bot refuses off-topic questions politely

---

## 5. POST `/speech-to-text`

Simulates speech-to-text transcription using Ollama. Upload an audio file to get a mock transcription.

### Request
```
Content-Type: multipart/form-data
```
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File (audio) | Yes | Any audio file (wav, mp3, etc.) |

### Response
```json
{
  "transcription": "Yes, I'd like to report a large pothole on Main Street near the school. It's been there for about two weeks now and it's getting worse.",
  "filename": "recording.wav",
  "file_size_kb": 245.3,
  "method": "ollama_mock",
  "note": "For production, integrate OpenAI Whisper for real STT",
  "timestamp": "2025-01-20T14:42:00.000000"
}
```

> **Note:** This is a mock endpoint. The transcription is AI-generated, not actual speech recognition. For production, integrate OpenAI Whisper.

---

## 6. POST `/summarize-incidents`

Takes a list of incidents and generates an executive summary with trends and action recommendations.

### Request
```json
{
  "incidents": [
    { "category": "pothole", "location": "Main St", "severity": "High", "count": 5 },
    { "category": "water_leak", "location": "Park Ave", "severity": "Critical", "count": 2 },
    { "category": "streetlight", "location": "Elm St", "severity": "Medium", "count": 3 }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `incidents` | array of objects | Yes | Each object should have `category`, `location`, `severity`, `count` |

### Response
```json
{
  "summary": "EXECUTIVE SUMMARY\n...\nCRITICAL ISSUES\n...",
  "incident_count": 3,
  "generated_at": "2025-01-20T14:45:00.000000"
}
```

---

## 7. POST `/zone-analysis`

Analyzes geographic distribution of incidents to find hotspot zones.

### Request
```json
{
  "incidents": [
    { "category": "pothole", "severity": "High", "lat": 28.6139, "lng": 77.2090, "zone": "Zone A" },
    { "category": "water_leak", "severity": "Critical", "lat": 28.6145, "lng": 77.2095, "zone": "Zone A" },
    { "category": "crack", "severity": "Low", "lat": 28.7041, "lng": 77.1025, "zone": "Zone B" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `incidents` | array | Yes | Each incident needs `category`, `severity`, `lat`, `lng` |
| `incidents[].zone` | string | No | Zone name (auto-generated from coords if empty) |

### Response
```json
{
  "hotspots": [
    {
      "zone": "Zone A",
      "incident_count": 2,
      "severity_score": 8,
      "density_rating": "Moderate",
      "top_issue_type": "pothole",
      "center": { "lat": 28.6142, "lng": 77.2093 }
    }
  ],
  "total_incidents": 3,
  "total_zones": 2,
  "ai_insight": "KEY FINDINGS: Zone A shows...",
  "generated_at": "2025-01-20T14:48:00.000000"
}
```

### Density Rating Scale
| Count | Rating |
|-------|--------|
| 1 | Low |
| 2 | Moderate |
| 3-4 | High |
| 5+ | Critical |

---

## 8. POST `/assign-team`

ML-scored team recommendation. Returns ranked teams with AI justification.

### Request
```json
{
  "department": "Roads & Transport",
  "severity": "High",
  "category": "Pothole / Road Damage",
  "location": "Sector 12"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `department` | string | Yes | Must match a known department (see list below) |
| `severity` | string | No | "Low", "Medium", "High", "Critical" (default: "Medium") |
| `category` | string | No | Issue type for context |
| `location` | string | No | Location for context |

### Available Departments
`Roads & Transport`, `Water Supply Department`, `Electrical Department`, `Parks & Environment`, `Drainage & Sewage`, `Traffic Management`, `Municipal Enforcement`, `Sanitation Department`, `Urban Maintenance`

### Response
```json
{
  "recommended_team": {
    "id": "W101",
    "name": "Team Alpha",
    "avg_resolution_hrs": 4.2,
    "rating": 4.8,
    "current_load": 2,
    "assignment_score": -1.3
  },
  "all_teams_ranked": [ ... ],
  "justification": "Team Alpha is recommended because...",
  "department": "Roads & Transport",
  "incident_severity": "high",
  "generated_at": "2026-02-07T16:01:39.804492"
}
```

### Score Formula
```
speed_weight = 3.0 if severity in (Critical, High) else 1.5
rating_weight = 2.0
load_penalty  = 1.0

score = (avg_resolution_hrs × speed_weight) - (rating × rating_weight) + (current_load × load_penalty)
```
Lower score = better match. The best team is ranked first.

---

## 9. GET `/health`

Check system readiness before making other calls.

### Request
```
GET /health
```

### Response
```json
{
  "status": "ready",
  "clip": {
    "loaded": true,
    "device": "cuda",
    "model": "openai/clip-vit-base-patch32"
  },
  "ollama": {
    "reachable": true,
    "target_model": "llama3",
    "models_available": ["llama3:latest"]
  },
  "timestamp": "2025-01-20T14:55:00.000000"
}
```

### Status Values
| Status | Meaning |
|--------|---------|
| `ready` | Both CLIP and Ollama are operational |
| `degraded` | One or both components have issues |

**Recommended:** Call `/health` on app startup and show a status indicator.

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "detail": "Upload an image file (jpg, png, etc.)"
}
```

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad request (wrong file type, missing fields) |
| 404 | Department not found (for `/assign-team`) |
| 500 | Server error (model timeout, Ollama down) |

### Frontend Error Handling Example
```javascript
try {
  const res = await fetch(`${API}/classify`, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json();
    showError(err.detail || 'Something went wrong');
    return;
  }
  const data = await res.json();
  // handle success
} catch (e) {
  showError('Cannot reach backend. Is the server running?');
}
```

---

## CORS Configuration

The backend allows all origins:
```python
allow_origins=["*"]
allow_methods=["*"]
allow_headers=["*"]
```

No special headers or credentials needed from the frontend. Standard `fetch()` calls work directly.

---

## Department-to-Issue Mapping

When displaying issues, use these department assignments:

| Issue Type | Department | Default Priority |
|-----------|------------|-----------------|
| Pothole / Road Damage | Roads & Transport | Medium |
| Water Leak / Pipe Burst | Water Supply Department | High |
| Broken Streetlight | Electrical Department | Medium |
| Power Outage / Downed Line | Electrical Department | Critical |
| Fallen Tree / Debris | Parks & Environment | Medium |
| Damaged Sidewalk | Roads & Transport | Low |
| Drain / Sewer Issue | Drainage & Sewage | High |
| Traffic Signal Damage | Traffic Management | High |
| Graffiti / Vandalism | Municipal Enforcement | Low |
| Garbage / Illegal Dumping | Sanitation Department | Medium |
| Damaged Public Furniture | Urban Maintenance | Low |
| Flooded Road / Waterlogging | Drainage & Sewage | High |

---

## Timing Notes

| Endpoint | Typical Response Time |
|----------|----------------------|
| `/classify` | 0.5 – 2 seconds (CLIP on GPU) |
| `/generate-report` | 5 – 15 seconds (Ollama generation) |
| `/classify-and-report` | 6 – 18 seconds (classify + generate) |
| `/chat` | 3 – 10 seconds |
| `/speech-to-text` | 3 – 8 seconds |
| `/summarize-incidents` | 5 – 12 seconds |
| `/zone-analysis` | 5 – 15 seconds |
| `/assign-team` | 5 – 12 seconds |
| `/health` | < 1 second |

Show loading spinners for all POST endpoints. The Ollama-dependent endpoints take longer because the language model generates text token by token.

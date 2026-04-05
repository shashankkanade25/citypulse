"""
CityPulse AI/ML Backend — CLIP + Ollama
========================================
All ML endpoints for the CityPulse urban infrastructure platform.

Endpoints:
  POST /classify              → Image → issue type + severity + confidence + routing
  POST /generate-report       → Classification data → Ollama incident report
  POST /classify-and-report   → Image → full pipeline (classify + report) in one call
  POST /chat                  → CityPulse-aware chatbot (Ollama)
  POST /speech-to-text        → Audio → transcribed text (for voice reporting)
  POST /summarize-incidents   → Grouped incidents → executive summary
  POST /zone-analysis         → Incident list → hotspot heatmap data
  POST /assign-team           → Incident + worker history → best team recommendation
  GET  /health                → CLIP loaded? Ollama reachable?
  GET  /                      → Test UI

Run:  python app.py
Then: http://localhost:8000       (Test UI)
      http://localhost:8000/docs  (Swagger)
"""

import io
import json
import math
import random
import time
import traceback
import base64
import os
from urllib.parse import urlparse
from datetime import datetime
from pathlib import Path
from typing import Optional

import json
import requests
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from PIL import Image
from pydantic import BaseModel

try:
    import torch
    from transformers import CLIPProcessor, CLIPModel
    ML_AVAILABLE = True
except ImportError:
    torch = None
    CLIPProcessor = None
    CLIPModel = None
    ML_AVAILABLE = False

# Load local env vars (optional). This lets CityPulse read CITYPULSE_MONGODB_URL
# and CITYPULSE_MONGODB_DB from CityPulse/.env when running locally.
# For convenience in this monorepo, if neither CITYPULSE_MONGODB_URL nor MONGODB_URL
# is set, we also try to load the portal env files to reuse the same MONGODB_URL.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"), override=False)

    if not (os.getenv("CITYPULSE_MONGODB_URL") or os.getenv("MONGODB_URL")):
        repo_root = Path(__file__).resolve().parents[1]
        candidate_envs = [
            repo_root / "Puranpoli_Protocol" / "authority" / ".env",
            repo_root / "Puranpoli_Protocol" / "authority" / ".env.local",
            repo_root / "Puranpoli_Protocol" / "citizens" / ".env",
            repo_root / "Puranpoli_Protocol" / "citizens" / ".env.local",
        ]
        for env_path in candidate_envs:
            if env_path.exists():
                load_dotenv(env_path, override=False)
except Exception:
    pass

try:
    from pymongo import MongoClient
except Exception:
    MongoClient = None

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3"  # switched from mistral → llama3 for better quality

CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

# Confidence routing thresholds
CONFIDENCE_HIGH = 60.0   # >= this: auto-forward to authority
CONFIDENCE_LOW = 30.0    # <  this: send to admin for review

# ── Issue Categories for CLIP ──
ISSUE_CATEGORIES = [
    "pothole on the road",
    "water leak or pipe burst",
    "broken streetlight",
    "power outage or downed power line",
    "fallen tree or debris on road",
    "damaged sidewalk or pavement",
    "overflowing drain or sewer blockage",
    "damaged or malfunctioning traffic signal",
    "graffiti or vandalism on public property",
    "garbage dump or illegal waste dumping",
    "broken bench or damaged public furniture",
    "flooded road or waterlogging",
]

# ── Severity prompts for CLIP (second-pass classification) ──
SEVERITY_PROMPTS = [
    "a minor infrastructure issue that is not urgent",
    "a moderate infrastructure issue that needs attention soon",
    "a severe infrastructure issue that is dangerous and urgent",
    "a critical infrastructure emergency requiring immediate action",
]
SEVERITY_LABELS = ["Low", "Medium", "High", "Critical"]

# ── Label / Department / Priority Maps ──
CATEGORY_LABELS = {
    "pothole on the road": "Pothole / Road Damage",
    "water leak or pipe burst": "Water Leak / Pipe Burst",
    "broken streetlight": "Broken Streetlight",
    "power outage or downed power line": "Power Outage / Downed Line",
    "fallen tree or debris on road": "Fallen Tree / Debris",
    "damaged sidewalk or pavement": "Damaged Sidewalk",
    "overflowing drain or sewer blockage": "Drain / Sewer Issue",
    "damaged or malfunctioning traffic signal": "Traffic Signal Damage",
    "graffiti or vandalism on public property": "Graffiti / Vandalism",
    "garbage dump or illegal waste dumping": "Garbage / Illegal Dumping",
    "broken bench or damaged public furniture": "Damaged Public Furniture",
    "flooded road or waterlogging": "Flooded Road / Waterlogging",
}

CATEGORY_DEPARTMENT = {
    "Pothole / Road Damage": "Roads & Transport",
    "Water Leak / Pipe Burst": "Water Supply Department",
    "Broken Streetlight": "Electrical Department",
    "Power Outage / Downed Line": "Electrical Department",
    "Fallen Tree / Debris": "Parks & Environment",
    "Damaged Sidewalk": "Roads & Transport",
    "Drain / Sewer Issue": "Drainage & Sewage",
    "Traffic Signal Damage": "Traffic Management",
    "Graffiti / Vandalism": "Municipal Enforcement",
    "Garbage / Illegal Dumping": "Sanitation Department",
    "Damaged Public Furniture": "Urban Maintenance",
    "Flooded Road / Waterlogging": "Drainage & Sewage",
}

PRIORITY_MAP = {
    "Power Outage / Downed Line": "Critical",
    "Water Leak / Pipe Burst": "High",
    "Flooded Road / Waterlogging": "High",
    "Drain / Sewer Issue": "High",
    "Traffic Signal Damage": "High",
    "Pothole / Road Damage": "Medium",
    "Fallen Tree / Debris": "Medium",
    "Broken Streetlight": "Medium",
    "Damaged Sidewalk": "Low",
    "Graffiti / Vandalism": "Low",
    "Garbage / Illegal Dumping": "Medium",
    "Damaged Public Furniture": "Low",
}

# ── Mock Worker Data (for best-team assignment demo) ──
# ─────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────
app = FastAPI(
    title="CityPulse AI/ML API",
    description="CLIP image classification + severity detection + Ollama report generation, chatbot, speech-to-text, zone analysis & team assignment",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# CLIP MODEL (lazy-loaded)
# ─────────────────────────────────────────────
if ML_AVAILABLE and torch and torch.cuda.is_available():
    device = "cuda"
else:
    device = "cpu"
clip_model = None
clip_processor = None
_clip_load_error = ""


def _ensure_clip_loaded() -> None:
    """Load CLIP on first use.

    This keeps `/chat` fast and avoids startup failures when CLIP weights
    are not downloaded yet.
    """
    global clip_model, clip_processor, _clip_load_error
    if not ML_AVAILABLE:
        raise HTTPException(503, "ML modules (torch, transformers) are not installed.")

    if clip_model is not None and clip_processor is not None:
        return

    if os.getenv("CITYPULSE_DISABLE_CLIP") in ("1", "true", "TRUE", "yes", "YES"):
        raise HTTPException(503, "CLIP is disabled (CITYPULSE_DISABLE_CLIP=1)")

    try:
        if device == "cuda":
            gpu_name = torch.cuda.get_device_name(0)
            print(f"[GPU] GPU detected: {gpu_name}")
        else:
            print("[WARN] No GPU found - running on CPU (slower inference)")

        print("[LOAD] Loading CLIP model... (first time downloads ~600MB)")
        clip_model = CLIPModel.from_pretrained(CLIP_MODEL_NAME)
        clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
        clip_model.eval()
        clip_model = clip_model.to(device)

        # Warm up GPU with a dummy forward pass for faster first inference
        if device == "cuda":
            with torch.no_grad():
                dummy_img = Image.new("RGB", (224, 224), color=(128, 128, 128))
                dummy_inputs = clip_processor(text=["test"], images=dummy_img, return_tensors="pt", padding=True).to(device)
                _ = clip_model(**dummy_inputs)
            torch.cuda.empty_cache()
            print(f"[OK] CLIP loaded on GPU ({gpu_name}) - warm-up complete")
        else:
            print(f"[OK] CLIP loaded on {device}")

        _clip_load_error = ""
    except Exception as e:
        _clip_load_error = f"{type(e).__name__}: {str(e)}"
        clip_model = None
        clip_processor = None
        raise


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def call_ollama(prompt: str, system: str = "", temperature: float = 0.7, max_tokens: int = 1024) -> str:
    """Call local Ollama API with configurable params. Returns generated text."""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "top_p": 0.9,
            },
        }
        if system:
            payload["system"] = system
        print(f"  [LLM] Calling Ollama ({OLLAMA_MODEL})...")
        resp = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=180)
        resp.raise_for_status()
        data = resp.json()
        response_text = data.get("response", "")
        # Log timing for performance tracking
        eval_duration = data.get("eval_duration", 0)
        if eval_duration:
            print(f"  [TIME] Ollama ({OLLAMA_MODEL}): {eval_duration / 1e9:.1f}s generation time")
        return response_text
    except requests.ConnectionError as e:
        print(f"  [ERROR] Ollama connection error: {e}")
        raise HTTPException(503, f"Ollama not reachable at {OLLAMA_BASE_URL}. Run `ollama serve`.")
    except requests.Timeout as e:
        print(f"  [ERROR] Ollama timeout: {e}")
        raise HTTPException(504, "Ollama request timed out. The model may be overloaded.")
    except Exception as e:
        print(f"  [ERROR] Ollama error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Ollama error: {str(e)}")


def call_ollama_stream(prompt: str, system: str = "", temperature: float = 0.7, max_tokens: int = 1024):
    """Stream Ollama API response. Yields chunks of text as they arrive."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
            "top_p": 0.9,
        },
    }
    if system:
        payload["system"] = system
    
    resp = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, stream=True, timeout=180)
    resp.raise_for_status()
    
    for line in resp.iter_lines():
        if line:
            try:
                data = json.loads(line)
                chunk = data.get("response", "")
                if chunk:
                    yield chunk
                if data.get("done", False):
                    break
            except json.JSONDecodeError:
                continue


# ─────────────────────────────────────────────
# REALTIME DB CONTEXT (MongoDB)
# ─────────────────────────────────────────────
_mongo_client = None
_mongo_last_error = ""


def _get_mongo_client():
    global _mongo_client
    global _mongo_last_error
    if _mongo_client is not None:
        return _mongo_client

    mongo_url = os.getenv("CITYPULSE_MONGODB_URL") or os.getenv("MONGODB_URL")
    if not mongo_url:
        return None
    if MongoClient is None:
        return None

    try:
        # Do NOT log the URL (contains secrets)
        _mongo_client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        _mongo_last_error = ""
        return _mongo_client
    except Exception as e:
        _mongo_last_error = f"{type(e).__name__}: {str(e)}"
        _mongo_client = None
        return None


def _safe_str(v) -> str:
    try:
        return str(v)
    except Exception:
        return ""


def _build_realtime_context_from_mongo(user_question: str, max_items: int = 25) -> str:
    """Fetch relevant incidents from MongoDB and format as prompt context.

    Minimal heuristic retrieval (NOT embeddings):
    - If question mentions a known category keyword, filter by that
    - If question includes a likely incident code/id, filter by that
    - Otherwise: most recent incidents
    """
    client = _get_mongo_client()
    if client is None:
        return ""

    try:
        # Force a quick ping so failures are fast
        client.admin.command("ping")
    except Exception:
        global _mongo_last_error
        _mongo_last_error = "Mongo ping failed"
        return ""

    # DB name: prefer explicit env, otherwise try URI default DB.
    # If neither works, try parsing the DB name from the URI path as a last resort.
    db_name = (os.getenv("CITYPULSE_MONGODB_DB") or os.getenv("MONGODB_DB") or "").strip()
    db = None
    if db_name:
        try:
            db = client.get_database(db_name)
        except Exception:
            db = None
    if db is None:
        try:
            db = client.get_default_database()
        except Exception:
            db = None
    if db is None:
        mongo_url = os.getenv("CITYPULSE_MONGODB_URL") or os.getenv("MONGODB_URL") or ""
        try:
            parsed = urlparse(mongo_url)
            uri_db = (parsed.path or "").lstrip("/")
            if uri_db:
                db = client.get_database(uri_db)
        except Exception:
            db = None
    if db is None:
        return ""

    q = (user_question or "").strip().lower()

    # Very small keyword → category mapping (extend as needed)
    category_keywords = {
        "pothole": ["Pothole", "Road"],
        "road": ["Road"],
        "water": ["Water"],
        "leak": ["Leak"],
        "streetlight": ["Streetlight"],
        "light": ["Streetlight"],
        "power": ["Power"],
        "electric": ["Power", "Electrical"],
        "drain": ["Drain", "Sewer"],
        "sewer": ["Sewer", "Drain"],
        "garbage": ["Garbage"],
        "flood": ["Flood"],
        "traffic": ["Traffic"],
    }

    matched_terms = []
    for kw, terms in category_keywords.items():
        if kw in q:
            matched_terms.extend(terms)
    matched_terms = list(dict.fromkeys(matched_terms))

    # Try to extract a likely incident code/id token (simple heuristic)
    tokens = [t.strip().strip("#,.():;") for t in q.split()]
    possible_code = None
    for t in tokens:
        if len(t) >= 6 and any(c.isdigit() for c in t) and any(c.isalpha() for c in t):
            possible_code = t
            break

    # We support both collections that exist in this workspace:
    # - citizens "Issue" model → likely collection "issues" with fields: incidentCode, title, description, category, status, severityLevel, department, priority, location, createdAt
    # - authority "Incident" model → likely collection "incidents" with fields: incidentId, title, description, zone, department, severity, status, confidence, reasons, images, assignedTo, createdAt
    collections = []
    for name in ["issues", "incidents"]:
        try:
            collections.append(db.get_collection(name))
        except Exception:
            pass

    items = []
    for col in collections:
        query = {}
        if possible_code:
            query = {
                "$or": [
                    {"incidentCode": {"$regex": possible_code, "$options": "i"}},
                    {"incidentId": {"$regex": possible_code, "$options": "i"}},
                ]
            }
        elif matched_terms:
            # Match on title/category/description
            ors = []
            for term in matched_terms[:3]:
                ors.extend([
                    {"title": {"$regex": term, "$options": "i"}},
                    {"category": {"$regex": term, "$options": "i"}},
                    {"description": {"$regex": term, "$options": "i"}},
                ])
            query = {"$or": ors} if ors else {}

        try:
            cursor = (
                col.find(query)
                .sort("createdAt", -1)
                .limit(max_items)
            )
            for d in cursor:
                items.append(d)
        except Exception:
            continue

    # Sort merged results by createdAt desc when present
    def _created_at(doc):
        v = doc.get("createdAt")
        try:
            return v or datetime.min
        except Exception:
            return datetime.min

    items.sort(key=_created_at, reverse=True)
    items = items[:max_items]

    if not items:
        return ""

    lines = []
    for i, d in enumerate(items, start=1):
        code = _safe_str(d.get("incidentCode") or d.get("incidentId") or "").strip()
        title = _safe_str(d.get("title") or d.get("category") or "Untitled").strip()
        status = _safe_str(d.get("status") or "").strip()
        severity = _safe_str(d.get("severityLevel") or d.get("severity") or "").strip()
        dept = _safe_str(d.get("department") or "").strip()
        priority = _safe_str(d.get("priority") or "").strip()
        zone = _safe_str(d.get("zone") or "").strip()
        loc = d.get("location")
        if isinstance(loc, dict):
            loc_str = _safe_str(loc.get("address") or "")
        else:
            loc_str = _safe_str(loc or "")

        created = d.get("createdAt")
        created_str = ""
        try:
            created_str = created.isoformat() if hasattr(created, "isoformat") else _safe_str(created)
        except Exception:
            created_str = ""

        desc = _safe_str(d.get("description") or "").strip()
        if len(desc) > 180:
            desc = desc[:180] + "…"

        header = f"{i}) {title}{(' (Code: ' + code + ')') if code else ''}"
        block_lines = [
            header,
            f"- Status: {status or 'Unknown'}",
            f"- Severity: {severity or 'Unknown'}",
            f"- Priority: {priority or 'N/A'}",
            f"- Department: {dept or 'N/A'}",
            zone and f"- Zone: {zone}" or None,
            loc_str and f"- Location: {loc_str}" or None,
            created_str and f"- CreatedAt: {created_str}" or None,
            desc and f"- Description: {desc}" or None,
        ]
        lines.append("\n".join([ln for ln in block_lines if isinstance(ln, str) and ln]))

    formatted = []
    for block in lines:
        formatted.append("\n".join([ln for ln in block.split("\n") if ln and ln != "None"]))

    return "\n".join([
        f"REALTIME INCIDENT DATA ({len(items)} record(s)):",
        "Rules: Use ONLY this data for incident-specific facts. If a detail is missing, say so. When referencing an incident, cite its item number and/or Code.",
        "",
        "\n\n".join(formatted),
    ])


@app.get("/debug/mongo-status", tags=["System"])
async def debug_mongo_status():
    """Dev-only: verify Mongo connectivity and whether incidents exist.

    Enable by setting CITYPULSE_ENABLE_DEBUG=1.
    """
    if os.getenv("CITYPULSE_ENABLE_DEBUG") not in ("1", "true", "TRUE", "yes", "YES"):
        raise HTTPException(404, "Not Found")

    mongo_url_present = bool(os.getenv("CITYPULSE_MONGODB_URL") or os.getenv("MONGODB_URL"))
    pymongo_available = MongoClient is not None
    if not mongo_url_present or not pymongo_available:
        return {
            "mongo_url_present": mongo_url_present,
            "pymongo_available": pymongo_available,
            "connected": False,
            "db": None,
            "collections": [],
            "counts": {},
            "last_error": _mongo_last_error,
        }

    client = _get_mongo_client()
    if client is None:
        return {
            "mongo_url_present": mongo_url_present,
            "pymongo_available": pymongo_available,
            "connected": False,
            "db": None,
            "collections": [],
            "counts": {},
            "last_error": _mongo_last_error,
        }

    connected = False
    try:
        client.admin.command("ping")
        connected = True
    except Exception:
        connected = False

    # Resolve DB the same way as realtime context
    db_name = (os.getenv("CITYPULSE_MONGODB_DB") or os.getenv("MONGODB_DB") or "").strip()
    db = None
    if db_name:
        try:
            db = client.get_database(db_name)
        except Exception:
            db = None
    if db is None:
        try:
            db = client.get_default_database()
        except Exception:
            db = None
    if db is None:
        mongo_url = os.getenv("CITYPULSE_MONGODB_URL") or os.getenv("MONGODB_URL") or ""
        try:
            parsed = urlparse(mongo_url)
            uri_db = (parsed.path or "").lstrip("/")
            if uri_db:
                db = client.get_database(uri_db)
        except Exception:
            db = None

    if db is None:
        return {
            "mongo_url_present": mongo_url_present,
            "pymongo_available": pymongo_available,
            "connected": connected,
            "db": None,
            "collections": [],
            "counts": {},
            "last_error": _mongo_last_error,
        }

    collections = []
    try:
        collections = sorted(db.list_collection_names())
    except Exception:
        collections = []

    counts = {}
    for name in ("issues", "incidents"):
        try:
            counts[name] = db.get_collection(name).estimated_document_count()
        except Exception:
            pass

    return {
        "mongo_url_present": mongo_url_present,
        "pymongo_available": pymongo_available,
        "connected": connected,
        "db": db.name,
        "collections": collections,
        "counts": counts,
        "last_error": _mongo_last_error,
    }


def clip_zero_shot(image: Image.Image, text_prompts: list[str]) -> list[float]:
    """Run CLIP zero-shot on GPU/CPU and return probability for each text prompt."""
    if not ML_AVAILABLE:
        # Fallback dummy probabilities if ML is missing (e.g. Vercel deployment)
        prob = 100.0 / len(text_prompts)
        return [round(prob, 2)] * len(text_prompts)

    _ensure_clip_loaded()
    inputs = clip_processor(text=text_prompts, images=image, return_tensors="pt", padding=True).to(device)
    with torch.no_grad(), torch.amp.autocast(device_type=device, enabled=(device == "cuda")):
        outputs = clip_model(**inputs)
    logits = outputs.logits_per_image[0].float()  # ensure float32 for softmax
    probs = logits.softmax(dim=0)
    return [round(p.item() * 100, 2) for p in probs]


def compute_text_confidence(description: str) -> float:
    """Score how relevant a citizen's text description is to infrastructure issues.
    Uses CLIP text embeddings similarity against issue categories.
    Returns 0-100 score."""
    if not description or not description.strip():
        return 0.0
    # Truncate to ~60 words to stay within CLIP's 77 token limit
    words = description.strip().split()
    if len(words) > 60:
        description = " ".join(words[:60])
    # If CLIP isn't loaded yet, skip this (keeps non-ML endpoints usable).
    try:
        _ensure_clip_loaded()
    except Exception:
        return 50.0

    # Get text embeddings for description and all categories
    all_texts = [description] + ISSUE_CATEGORIES
    try:
        inputs = clip_processor(text=all_texts, return_tensors="pt", padding=True, truncation=True, max_length=77).to(device)
        with torch.no_grad():
            text_features = clip_model.get_text_features(**inputs)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        # Cosine similarity between description and each category
        desc_feat = text_features[0:1]
        cat_feats = text_features[1:]
        similarities = (desc_feat @ cat_feats.T).squeeze(0)
        max_sim = similarities.max().item()
        # Scale to 0-100 (CLIP text sims are typically 0.15-0.35 range)
        score = min(100.0, max(0.0, (max_sim - 0.15) / 0.20 * 100))
        return round(score, 2)
    except Exception:
        # Fallback if text processing fails
        return 50.0


def classify_image(image: Image.Image) -> dict:
    """CLIP classification: issue category + severity + confidence routing."""
    # ── Pass 1: Issue type classification ──
    cat_probs = clip_zero_shot(image, ISSUE_CATEGORIES)
    results = []
    for i, cat in enumerate(ISSUE_CATEGORIES):
        label = CATEGORY_LABELS[cat]
        results.append({
            "category": label,
            "confidence": cat_probs[i],
            "department": CATEGORY_DEPARTMENT.get(label, "General"),
            "priority": PRIORITY_MAP.get(label, "Medium"),
        })
    results.sort(key=lambda x: x["confidence"], reverse=True)

    # ── Pass 2: Severity detection ──
    sev_probs = clip_zero_shot(image, SEVERITY_PROMPTS)
    sev_idx = sev_probs.index(max(sev_probs))
    severity = {
        "level": SEVERITY_LABELS[sev_idx],
        "scores": {SEVERITY_LABELS[i]: sev_probs[i] for i in range(len(SEVERITY_LABELS))},
    }

    # ── Confidence-based routing ──
    top_conf = results[0]["confidence"]
    if top_conf >= CONFIDENCE_HIGH:
        routing = "auto_forward_to_authority"
        routing_reason = f"High confidence ({top_conf}%) — auto-forwarded to department"
    elif top_conf >= CONFIDENCE_LOW:
        routing = "forward_to_authority"
        routing_reason = f"Moderate confidence ({top_conf}%) — forwarded for review"
    else:
        routing = "send_to_admin_review"
        routing_reason = f"Low confidence ({top_conf}%) — flagged for admin verification"

    # ── Boost priority if severity is high/critical ──
    effective_priority = results[0]["priority"]
    if severity["level"] in ("High", "Critical") and effective_priority in ("Low", "Medium"):
        effective_priority = "High" if severity["level"] == "High" else "Critical"

    return {
        "top_prediction": {**results[0], "effective_priority": effective_priority},
        "severity": severity,
        "confidence_routing": {"action": routing, "reason": routing_reason},
        "all_predictions": results[:5],
    }


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

# ──── 1. Image Classification + Severity + Routing ────
@app.post("/classify", tags=["Core ML"])
async def classify_issue(file: UploadFile = File(...)):
    """
    Upload image → returns issue type, severity level, confidence score,
    auto-routing decision, department & priority.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload an image file (jpg, png, etc.)")
    _ensure_clip_loaded()
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Could not read image")

    start_time = time.time()
    result = classify_image(image)
    result["timestamp"] = datetime.now().isoformat()
    result["filename"] = file.filename
    result["inference_time_ms"] = round((time.time() - start_time) * 1000, 1)
    result["device"] = device
    return result


# ──── 2. Report Generation ────
class ReportRequest(BaseModel):
    category: str
    confidence: float
    department: str
    priority: str
    severity: Optional[str] = "Medium"
    location: Optional[str] = "Not specified"
    description: Optional[str] = ""


@app.post("/generate-report", tags=["Core ML"])
async def generate_report(req: ReportRequest):
    """Takes classification data → Ollama generates a formal incident report."""
    prompt = f"""Create a municipal infrastructure incident report from this detection.

INPUT (do not repeat verbatim):
- Detected issue: {req.category}
- AI confidence: {req.confidence}%
- Severity: {req.severity}
- Department: {req.department}
- Priority: {req.priority}
- Location: {req.location}
- Citizen description: {req.description or "No additional description"}
- Timestamp: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

OUTPUT FORMAT (plain text only, no markdown):
INCIDENT SUMMARY:
<2-3 sentences>

ISSUE DETAILS:
<2-4 sentences. Mention uncertainty if location is not provided.>

RECOMMENDED ACTIONS:
- <action 1>
- <action 2>
- <action 3>
- <action 4 (optional)>
- <action 5 (optional)>

ESTIMATED URGENCY & REASONING:
Urgency: <Low|Medium|High|Critical>
Reasoning: <1-2 sentences>

Rules:
- Keep it concise and operational.
- If location is missing/"Not specified", explicitly say it is not provided.
- Do not invent addresses, incident IDs, or numeric statistics."""

    system = """You are a municipal infrastructure AI assistant.
Your job is to produce consistent, structured, actionable incident reports.
Follow the exact section headings and bullet style requested. Output plain text only."""

    report_text = call_ollama(prompt, system, temperature=0.3, max_tokens=700)

    return {
        "report": report_text,
        "metadata": {
            "category": req.category, "department": req.department,
            "priority": req.priority, "severity": req.severity,
            "location": req.location,
            "generated_at": datetime.now().isoformat(), "model": OLLAMA_MODEL,
        },
    }


# ──── 2b. Streaming Report Generation (SSE) ────
@app.post("/generate-report-stream", tags=["Core ML"])
async def generate_report_stream(req: ReportRequest):
    """Stream the report generation via Server-Sent Events for real-time display."""
    prompt = f"""Create a municipal infrastructure incident report from this detection.

INPUT (do not repeat verbatim):
- Detected issue: {req.category}
- AI confidence: {req.confidence}%
- Severity: {req.severity}
- Department: {req.department}
- Priority: {req.priority}
- Location: {req.location}
- Citizen description: {req.description or "No additional description"}
- Timestamp: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

OUTPUT FORMAT (plain text only, no markdown):
INCIDENT SUMMARY:
<2-3 sentences>

ISSUE DETAILS:
<2-4 sentences>

RECOMMENDED ACTIONS:
- <action 1>
- <action 2>
- <action 3>

ESTIMATED URGENCY & REASONING:
Urgency: <Low|Medium|High|Critical>
Reasoning: <1-2 sentences>

Rules:
- Keep it concise and operational.
- Do not invent addresses, incident IDs, or numeric statistics."""

    system = """You are a municipal infrastructure AI assistant.
Your job is to produce consistent, structured, actionable incident reports.
Follow the exact section headings and bullet style requested. Output plain text only."""

    def event_stream():
        full_text = ""
        for chunk in call_ollama_stream(prompt, system, temperature=0.3, max_tokens=700):
            full_text += chunk
            # Send as SSE format
            yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\n\n"
        # Send completion event
        yield f"data: {json.dumps({'chunk': '', 'done': True, 'full_text': full_text})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ──── 3. Full Pipeline: Image → Classify → Report ────
@app.post("/classify-and-report", tags=["Core ML"])
async def classify_and_report(
    file: UploadFile = File(...),
    location: str = Form("Not specified"),
    description: str = Form(""),
):
    """
    Main endpoint: upload image → CLIP classifies (type + severity) → Ollama generates report.
    Returns classification, severity, confidence routing, and full report.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload an image file")

    _ensure_clip_loaded()

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    classification = classify_image(image)
    top = classification["top_prediction"]

    prompt = f"""Create a municipal infrastructure incident report from this detection.

INPUT (do not repeat verbatim):
- Detected issue: {top['category']}
- AI confidence: {top['confidence']}%
- Severity: {classification['severity']['level']}
- Department: {top['department']}
- Priority: {top.get('effective_priority', top['priority'])}
- Location: {location}
- Citizen notes: {description or "None"}
- Routing note: {classification['confidence_routing']['reason']}
- Timestamp: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

OUTPUT FORMAT (plain text only, no markdown):
INCIDENT SUMMARY:
<2-3 sentences>

ISSUE DETAILS:
<2-4 sentences>

RECOMMENDED ACTIONS:
- <action 1>
- <action 2>
- <action 3>

ESTIMATED URGENCY & REASONING:
Urgency: <Low|Medium|High|Critical>
Reasoning: <1-2 sentences>

Rules:
- Keep it concise and operational.
- Do not invent addresses, incident IDs, or numeric statistics."""

    system = """You are a municipal infrastructure AI assistant.
Your job is to produce consistent, structured, actionable incident reports.
Follow the exact section headings and bullet style requested. Output plain text only."""

    report_text = call_ollama(prompt, system, temperature=0.3, max_tokens=700)

    # Compute combined confidence score (image + text)
    text_conf = compute_text_confidence(description) if description else 0.0
    image_conf = top["confidence"]
    combined_confidence = round((image_conf * 0.7 + text_conf * 0.3) if text_conf > 0 else image_conf, 2)

    return {
        "classification": classification,
        "report": report_text,
        "confidence_scores": {
            "image_confidence": image_conf,
            "text_relevance": text_conf,
            "combined_confidence": combined_confidence,
        },
        "metadata": {
            "location": location, "citizen_description": description,
            "generated_at": datetime.now().isoformat(), "filename": file.filename,
            "device": device,
        },
    }


# ──── 4. Chatbot (CityPulse-aware) ────
class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = ""


@app.post("/chat", tags=["Chatbot"])
async def chat(req: ChatRequest):
    """CityPulse AI chatbot — helps citizens, officers, and admin with system queries."""
    system = """You are CityPulse AI Assistant for a municipal infrastructure management platform called CityPulse.

IMPORTANT RULES:
- You do NOT have direct/live database access. You may be provided REALTIME INCIDENT DATA in the prompt context (fetched by the backend). If it is not present, you must assume you do not have incident data.
- If the user asks for specifics (IDs, exact counts, locations, status) and REALTIME INCIDENT DATA is missing/empty, say you could not fetch incident data right now (DB unavailable or no records) and suggest checking the backend DB configuration.
- Never invent incident records, addresses, timelines, or statistics.
- If incident context is provided, treat it as the single source of truth for incident-specific facts.
- When you mention a specific incident from context, reference it by its item number and/or code if present.
- Prefer short, structured answers. Use bullet points for steps.
- Output plain text (no markdown).

ABOUT CITYPULSE:
- Citizens report infrastructure issues (potholes, water leaks, power outages, etc.) by uploading photos
- AI (CLIP model) automatically detects the issue type and severity from the photo
- The system auto-assigns the issue to the correct municipal department
- Issues follow a strict lifecycle: Open → In-Progress → On-Hold → Resolved
- Authority heads assign field teams, field workers update progress with geotagged proof
- A public transparency dashboard shows all incidents (anonymized) for accountability
- Every action is logged in an immutable audit trail — no silent deletions

ISSUE CATEGORIES: Pothole/Road Damage, Water Leak, Broken Streetlight, Power Outage, Fallen Tree, Damaged Sidewalk, Drain/Sewer Issue, Traffic Signal Damage, Graffiti, Garbage Dumping, Damaged Public Furniture, Flooded Road

STAKEHOLDER ROLES:
- Citizen: Reports issues, tracks status (read-only after submission)
- Authority Head: Categorizes, prioritizes, assigns to field teams, monitors SLA
- Field Worker: Updates progress, uploads proof-of-work (cannot change priority/assignment)
- Admin: Reviews low-confidence reports, flags misuse, system analytics

You help with: how to report, status explanations, department info, system guidance.
Keep responses helpful, concise, citizen-friendly. Redirect unrelated questions politely."""

    # Prefer realtime DB context (Mongo) over client-provided snapshots.
    realtime_context = _build_realtime_context_from_mongo(req.message)
    context = realtime_context.strip() if realtime_context else (req.context or "").strip()
    context_status = "REALTIME_CONTEXT_PRESENT" if realtime_context.strip() else "REALTIME_CONTEXT_EMPTY"
    prompt = f"""INCIDENT CONTEXT (may be empty):
{context if context else "(none)"}

CONTEXT STATUS:
{context_status}

USER QUESTION:
{req.message}

Answer the user.

If CONTEXT STATUS is REALTIME_CONTEXT_EMPTY and the question needs incident data (recent incidents, counts, specific IDs/codes, statuses), respond:
- Say you couldn't fetch realtime incident data right now (DB unavailable or no records).
- Ask 1 short follow-up question (optional).
- Suggest checking CityPulse Mongo configuration."""

    response = call_ollama(prompt, system, temperature=0.2, max_tokens=500)
    return {"reply": response, "timestamp": datetime.now().isoformat()}


@app.post("/chat-stream", tags=["Chatbot"])
async def chat_stream(req: ChatRequest):
    """Stream chat responses via SSE so the UI can render incremental text."""
    system = """You are CityPulse AI Assistant for a municipal infrastructure management platform called CityPulse.

IMPORTANT RULES:
- You do NOT have direct/live database access. You may be provided REALTIME INCIDENT DATA in the prompt context (fetched by the backend). If it is not present, you must assume you do not have incident data.
- If the user asks for specifics (IDs, exact counts, locations, status) and REALTIME INCIDENT DATA is missing/empty, say you could not fetch incident data right now (DB unavailable or no records) and suggest checking the backend DB configuration.
- Never invent incident records, addresses, timelines, or statistics.
- If incident context is provided, treat it as the single source of truth for incident-specific facts.
- When you mention a specific incident from context, reference it by its item number and/or code if present.
- Prefer short, structured answers. Use bullet points for steps.
- Output plain text (no markdown).

ABOUT CITYPULSE:
- Citizens report infrastructure issues (potholes, water leaks, power outages, etc.) by uploading photos
- AI (CLIP model) automatically detects the issue type and severity from the photo
- The system auto-assigns the issue to the correct municipal department
- Issues follow a strict lifecycle: Open → In-Progress → On-Hold → Resolved
- Authority heads assign field teams, field workers update progress with geotagged proof
- A public transparency dashboard shows all incidents (anonymized) for accountability
- Every action is logged in an immutable audit trail — no silent deletions

ISSUE CATEGORIES: Pothole/Road Damage, Water Leak, Broken Streetlight, Power Outage, Fallen Tree, Damaged Sidewalk, Drain/Sewer Issue, Traffic Signal Damage, Graffiti, Garbage Dumping, Damaged Public Furniture, Flooded Road

STAKEHOLDER ROLES:
- Citizen: Reports issues, tracks status (read-only after submission)
- Authority Head: Categorizes, prioritizes, assigns to field teams, monitors SLA
- Field Worker: Updates progress, uploads proof-of-work (cannot change priority/assignment)
- Admin: Reviews low-confidence reports, flags misuse, system analytics

You help with: how to report, status explanations, department info, system guidance.
Keep responses helpful, concise, citizen-friendly. Redirect unrelated questions politely."""

    realtime_context = _build_realtime_context_from_mongo(req.message)
    context = realtime_context.strip() if realtime_context else (req.context or "").strip()
    context_status = "REALTIME_CONTEXT_PRESENT" if realtime_context.strip() else "REALTIME_CONTEXT_EMPTY"
    prompt = f"""INCIDENT CONTEXT (may be empty):
{context if context else "(none)"}

CONTEXT STATUS:
{context_status}

USER QUESTION:
{req.message}

Answer the user.

If CONTEXT STATUS is REALTIME_CONTEXT_EMPTY and the question needs incident data (recent incidents, counts, specific IDs/codes, statuses), respond:
- Say you couldn't fetch realtime incident data right now (DB unavailable or no records).
- Ask 1 short follow-up question (optional).
- Suggest checking CityPulse Mongo configuration."""

    def event_stream():
        full_text = ""
        for chunk in call_ollama_stream(prompt, system, temperature=0.2, max_tokens=500):
            full_text += chunk
            yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\n\n"
        yield f"data: {json.dumps({'chunk': '', 'done': True, 'full_text': full_text})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ──── 5. Speech-to-Text (via Ollama transcription prompt) ────
@app.post("/speech-to-text", tags=["Accessibility"])
async def speech_to_text(file: UploadFile = File(...)):
    """
    Accepts audio file → uses Ollama to simulate speech-to-text transcription.
    NOTE: For production, integrate Whisper. This uses Ollama as a placeholder
    that generates a realistic mock transcription for demo purposes.
    In a real setup, swap this with OpenAI Whisper (local) for actual STT.
    """
    if not file.filename:
        raise HTTPException(400, "Upload an audio file")

    audio_bytes = await file.read()
    file_size_kb = len(audio_bytes) / 1024

    # For demo: Ollama generates a realistic citizen complaint transcription
    prompt = f"""A citizen has recorded a voice message to report an infrastructure issue in their neighborhood.
The audio file is {file_size_kb:.0f}KB, named '{file.filename}'.

Generate a realistic transcription of what the citizen likely said. It should be a natural spoken complaint about
a city infrastructure problem (like a pothole, water leak, broken streetlight, etc.).
Include details like location description, how long the problem has existed, and urgency.
Output ONLY the transcription text, nothing else. Keep it 2-4 sentences, natural spoken language."""

    system = "Generate realistic speech transcriptions for citizen infrastructure complaints. Output only the transcription text."
    transcription = call_ollama(prompt, system)

    return {
        "transcription": transcription.strip(),
        "filename": file.filename,
        "file_size_kb": round(file_size_kb, 1),
        "method": "ollama_mock",
        "note": "For production, integrate OpenAI Whisper for real STT",
        "timestamp": datetime.now().isoformat(),
    }


# ──── 6. Summarize Grouped Incidents ────
class SummarizeRequest(BaseModel):
    incidents: list[dict]


@app.post("/summarize-incidents", tags=["Authority Tools"])
async def summarize_incidents(req: SummarizeRequest):
    """Takes grouped/duplicate incidents → Ollama generates executive summary for authority dashboard."""
    incidents_text = "\n".join(
        [f"- {inc.get('category', 'Unknown')} at {inc.get('location', 'Unknown')} "
         f"(Severity: {inc.get('severity', 'Unknown')}, Reports: {inc.get('count', 1)})"
         for inc in req.incidents]
    )

    prompt = f"""Summarize these grouped infrastructure incidents for a municipal authority dashboard:

GROUPED INCIDENTS:
{incidents_text}

Write:
1. EXECUTIVE SUMMARY (2-3 sentences, data-driven)
2. CRITICAL ISSUES (issues needing immediate attention)
3. HOTSPOT ZONES (areas with multiple incidents)
4. PRIORITIZED ACTION ORDER (numbered list)
5. RESOURCE ALLOCATION RECOMMENDATION"""

    system = "You are a municipal operations AI creating executive summaries. Be data-driven, concise, actionable."
    summary = call_ollama(prompt, system)

    return {
        "summary": summary,
        "incident_count": len(req.incidents),
        "generated_at": datetime.now().isoformat(),
    }


# ──── 7. Zone-wise Hotspot Analysis ────
class ZoneIncident(BaseModel):
    category: str
    severity: str = "Medium"
    lat: float
    lng: float
    zone: str = ""


class ZoneAnalysisRequest(BaseModel):
    incidents: list[ZoneIncident]


@app.post("/zone-analysis", tags=["Authority Tools"])
async def zone_analysis(req: ZoneAnalysisRequest):
    """
    Analyzes incident distribution across zones/areas.
    Returns hotspot clusters, density scores, and AI-generated insights.
    """
    if not req.incidents:
        raise HTTPException(400, "Provide at least one incident")

    # ── Group by zone ──
    zone_data: dict = {}
    severity_weights = {"Low": 1, "Medium": 2, "High": 3, "Critical": 5}

    for inc in req.incidents:
        zone = inc.zone or f"Zone_{round(inc.lat, 2)}_{round(inc.lng, 2)}"
        if zone not in zone_data:
            zone_data[zone] = {"count": 0, "severity_score": 0, "categories": {}, "coords": []}
        zone_data[zone]["count"] += 1
        zone_data[zone]["severity_score"] += severity_weights.get(inc.severity, 2)
        cat = inc.category
        zone_data[zone]["categories"][cat] = zone_data[zone]["categories"].get(cat, 0) + 1
        zone_data[zone]["coords"].append({"lat": inc.lat, "lng": inc.lng})

    # ── Rank zones by issue density ──
    hotspots = []
    for zone, data in zone_data.items():
        avg_lat = sum(c["lat"] for c in data["coords"]) / len(data["coords"])
        avg_lng = sum(c["lng"] for c in data["coords"]) / len(data["coords"])
        top_issue = max(data["categories"], key=data["categories"].get)
        hotspots.append({
            "zone": zone,
            "incident_count": data["count"],
            "severity_score": data["severity_score"],
            "density_rating": "Critical" if data["count"] >= 5 else "High" if data["count"] >= 3 else "Moderate" if data["count"] >= 2 else "Low",
            "top_issue_type": top_issue,
            "center": {"lat": round(avg_lat, 4), "lng": round(avg_lng, 4)},
        })
    hotspots.sort(key=lambda x: x["severity_score"], reverse=True)

    # ── Ollama insight ──
    hotspot_text = "\n".join([f"- {h['zone']}: {h['incident_count']} incidents, severity score {h['severity_score']}, top issue: {h['top_issue_type']}" for h in hotspots[:10]])
    prompt = f"""Analyze these urban hotspot zones and provide actionable insights:

ZONE DATA:
{hotspot_text}

Write: KEY FINDINGS (2-3 sentences), HIGH-RISK ZONES, RECOMMENDED PROACTIVE ACTIONS.
Be concise and data-driven."""

    system = "You are a municipal analytics AI. Provide data-driven zone analysis for proactive urban maintenance."
    insight = call_ollama(prompt, system)

    return {
        "hotspots": hotspots,
        "total_incidents": len(req.incidents),
        "total_zones": len(zone_data),
        "ai_insight": insight,
        "generated_at": datetime.now().isoformat(),
    }


# ──── 8. Best-Worker Assignment (ML-Assisted) ────
class WorkerInfo(BaseModel):
    name: str
    zone: str = ""
    workload: int = 0
    email: str = ""


class AssignWorkerRequest(BaseModel):
    department: str
    severity: str = "Medium"
    category: str = ""
    location: str = ""
    workers: list[WorkerInfo] = []  # Real workers from DB


def compute_worker_score(worker: dict, severity: str, incident_zone: str) -> float:
    """Score a real worker: lower is better. Considers workload, zone match, and severity."""
    workload = worker.get("workload", 0)
    worker_zone = worker.get("zone", "")

    # Base score from workload (fewer tasks = better)
    load_weight = 3.0 if severity in ("Critical", "High") else 1.5
    score = workload * load_weight

    # Zone match bonus (same zone = much better)
    if incident_zone and worker_zone:
        if worker_zone.lower() == incident_zone.lower():
            score -= 5.0  # strong bonus for same zone
        elif any(part in worker_zone.lower() for part in incident_zone.lower().split()):
            score -= 2.0  # partial zone match

    # For critical severity, heavily penalize high-workload workers
    if severity == "Critical" and workload > 3:
        score += 4.0
    elif severity == "High" and workload > 5:
        score += 2.0

    return round(score, 2)


@app.post("/assign-team", tags=["Authority Tools"])
async def assign_worker(req: AssignWorkerRequest):
    """
    ML-assisted worker assignment: recommends the best individual worker
    based on zone match, current workload, and incident severity.
    Accepts real workers from the database.
    """
    if not req.workers or len(req.workers) == 0:
        raise HTTPException(400, "No workers provided. Send a list of available workers.")

    # ── Score each worker ──
    scored = []
    for w in req.workers:
        wd = w.model_dump()
        score = compute_worker_score(wd, req.severity, req.location)
        scored.append({
            "name": wd["name"],
            "zone": wd["zone"],
            "workload": wd["workload"],
            "email": wd["email"],
            "assignment_score": score,
        })
    scored.sort(key=lambda x: x["assignment_score"])

    recommended = scored[0]

    # ── Ollama justification ──
    others_text = chr(10).join([
        f"  - {w['name']} (Zone: {w['zone']}, Workload: {w['workload']} tasks, Score: {w['assignment_score']})"
        for w in scored[1:5]  # top 4 alternatives
    ]) or "  (no other workers available)"

    prompt = f"""Briefly justify (2-3 sentences) why this worker is the best assignment:

INCIDENT: {req.category} at {req.location} (Severity: {req.severity})
DEPARTMENT: {req.department}
RECOMMENDED WORKER: {recommended['name']}
  - Zone: {recommended['zone']}
  - Current workload: {recommended['workload']} active tasks
  - Assignment score: {recommended['assignment_score']} (lower = better)

OTHER AVAILABLE WORKERS:
{others_text}

Explain the recommendation based on zone proximity, workload balance, and urgency."""

    system = "You are a workforce optimization AI. Justify individual worker assignments concisely based on zone match, workload, and incident severity."
    justification = call_ollama(prompt, system)

    return {
        "recommended_worker": recommended,
        "all_workers_ranked": scored,
        "justification": justification,
        "department": req.department,
        "incident_severity": req.severity,
        "generated_at": datetime.now().isoformat(),
    }


# ──── 9. Health Check ────
@app.get("/health", tags=["System"])
async def health():
    """Quick health check — confirms CLIP is loaded. Does NOT block on Ollama."""
    clip_ok = clip_model is not None and clip_processor is not None
    return {
        "clip": {"loaded": clip_ok, "model": CLIP_MODEL_NAME, "device": device},
        "status": "ready" if clip_ok else "partial",
    }


@app.get("/health/full", tags=["System"])
async def health_full():
    """Full health check — also pings Ollama (may take a few seconds)."""
    clip_ok = clip_model is not None and clip_processor is not None
    ollama_ok = False
    ollama_models = []
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            ollama_ok = True
            ollama_models = [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        pass

    return {
        "clip": {"loaded": clip_ok, "model": CLIP_MODEL_NAME, "device": device},
        "ollama": {"reachable": ollama_ok, "url": OLLAMA_BASE_URL, "target_model": OLLAMA_MODEL, "available_models": ollama_models},
        "features": ["classify", "severity_detection", "confidence_routing", "report_generation", "chatbot", "speech_to_text", "zone_analysis", "team_assignment"],
        "status": "ready" if (clip_ok and ollama_ok) else "partial",
    }


# ──── 10. Test UI ────
@app.get("/", response_class=HTMLResponse, tags=["UI"])
async def test_ui():
    """Serves a simple test UI for all ML endpoints."""
    html_path = Path(__file__).parent / "test_ui.html"
    if html_path.exists():
        return HTMLResponse(html_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>CityPulse API Running</h1><p>Visit <a href='/docs'>/docs</a> for Swagger UI</p>")


# ─────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("\n[START] Starting CityPulse AI/ML API v2.1...")
    print(f"[DEVICE] {device.upper()}" + (f" ({torch.cuda.get_device_name(0)})" if device == 'cuda' else ""))
    print(f"[LLM] Ollama ({OLLAMA_MODEL})")
    print("[URL] Test UI:     http://localhost:8000")
    print("[URL] Swagger docs: http://localhost:8000/docs")
    print("[TIP] Make sure Ollama is running: ollama serve\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)

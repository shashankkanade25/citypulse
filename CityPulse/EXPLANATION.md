# CityPulse — AI/ML Backend Explanation

## What Is CityPulse?

CityPulse is a **Real-Time Urban Infrastructure Incident & Maintenance Platform**. Citizens and inspectors upload photos of infrastructure problems (potholes, broken streetlights, water leaks, etc.), and the system automatically:

1. **Classifies** the image to detect the issue type and severity
2. **Generates** a structured incident maintenance report
3. **Assigns** the best-fit repair team
4. Provides a **chatbot** for infrastructure questions
5. Offers **zone analysis** and **incident summaries** for city planners

---

## Architecture Overview

```
┌──────────────┐    HTTP/REST     ┌──────────────────────┐
│   Frontend   │ ──────────────►  │   FastAPI Backend     │
│   (React /   │  ◄──────────────  │   (app.py)            │
│    any UI)   │    JSON responses │                      │
└──────────────┘                  │  ┌────────────────┐   │
                                  │  │  CLIP Model     │   │
                                  │  │  (Image AI)     │   │
                                  │  └────────────────┘   │
                                  │  ┌────────────────┐   │
                                  │  │  Ollama/llama3  │   │
                                  │  │  (Text AI)      │   │
                                  │  └────────────────┘   │
                                  └──────────────────────┘
```

**Two AI models work together:**

| Component | Model | Purpose |
|-----------|-------|---------|
| **CLIP** | `openai/clip-vit-base-patch32` | Image understanding — classifies photos into issue types and severity levels |
| **Ollama** | `llama3` (8B) | Text generation — writes reports, powers chatbot, analyzes data |

---

## How CLIP Works (Image Classification)

CLIP (Contrastive Language-Image Pre-training) by OpenAI is a vision-language model. Unlike traditional classifiers that output fixed labels, CLIP compares an image against a set of **text descriptions** and scores how well each description matches.

### Our Two-Pass Classification

**Pass 1 — Issue Type Detection:**
The image is compared against 12 text prompts like:
- *"a photo of a pothole on a road"*
- *"a photo of a water leak or pipe burst"*
- *"a photo of a broken or damaged streetlight"*
- ... (12 categories total)

CLIP returns a probability distribution. The highest-scoring label becomes the **issue_type**.

**Pass 2 — Severity Detection:**
The same image is compared against severity-specific prompts:
- *"a photo showing minor damage, small issue, low severity"*
- *"a photo showing moderate damage, noticeable issue"*
- *"a photo showing severe damage, major issue, dangerous condition"*
- *"a photo showing critical damage, emergency situation, extreme hazard"*

### Confidence Scoring (Combined)

We use a **blended confidence score**:

```
final_confidence = (0.70 × image_confidence) + (0.30 × text_confidence)
```

- **Image confidence (70%)**: Direct CLIP softmax probability for the top label
- **Text confidence (30%)**: CLIP compares the chosen label text against all other label texts using text embeddings — measures how distinct the classification is

### Confidence Routing

| Confidence Range | Action |
|-----------------|--------|
| ≥ 60% (HIGH) | Classification accepted as-is |
| 30–60% (MEDIUM) | Ollama reviews and may adjust the classification |
| < 30% (LOW) | Ollama performs full re-evaluation |

This ensures low-confidence CLIP predictions get a second opinion from the language model.

---

## How Ollama/llama3 Works (Text Generation)

Ollama runs the **llama3 8B** model locally. We use it for five distinct tasks:

### 1. Report Generation (`/generate-report`)
Given classification data (issue type, severity, confidence), llama3 generates a structured incident report containing:
- Incident description and impact assessment
- Recommended repair actions
- Estimated timeline and resource needs
- Safety considerations

### 2. Confidence Review (automatic)
When CLIP confidence is below 60%, the classification JSON is sent to llama3 with the prompt *"Review this infrastructure classification..."*. llama3 can confirm or correct the issue type and severity.

### 3. Chatbot (`/chat`)
A system prompt gives llama3 the persona of a **CityPulse infrastructure expert**. It knows about:
- All 12 issue categories the platform handles
- How the classification pipeline works
- Standard maintenance procedures
- Typical repair timelines

### 4. Speech-to-Text Simulation (`/speech-to-text`)
Since we don't have a real STT model, llama3 generates realistic transcription text from an audio context description. This lets the frontend team build and test their voice-reporting UI.

### 5. Zone Analysis & Summaries
llama3 analyzes incident clusters to identify hotspot patterns and generates executive summaries with trends and recommendations.

---

## GPU Acceleration

The backend automatically detects CUDA-capable GPUs:

- **CLIP** runs on GPU with `torch.amp.autocast` (mixed precision) for faster inference
- A **warm-up inference** runs at startup to pre-load CUDA kernels
- **Ollama** manages its own GPU memory separately
- Falls back to CPU gracefully if no GPU is available

Current setup: **NVIDIA RTX 3050 Laptop GPU** (4GB VRAM)

---

## Key Design Decisions

1. **Single-file backend** (`app.py`) — keeps deployment simple; no complex project structure needed
2. **CORS fully open** (`allow_origins=["*"]`) — so any frontend (React, Vue, etc.) can connect during development
3. **All endpoints return JSON** — no server-side rendering, pure API
4. **Mock STT** — real speech models (Whisper) need extra setup; the mock lets frontend work proceed in parallel
5. **Weighted team scoring** — combines department match, workload, rating, and experience into a single score rather than simple rule-based assignment

---

## File Structure

```
CityPulse/
├── app.py              # All backend logic (FastAPI + CLIP + Ollama)
├── requirements.txt    # Python dependencies
├── test_ui.html        # Test dashboard (served at localhost:8000)
├── EXPLANATION.md       # This file
└── API_DOCS.md         # Frontend integration guide
```

---

## Running the Backend

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Make sure Ollama is running with llama3
ollama serve          # (if not already running)
ollama pull llama3    # (if not already pulled)

# 3. Start the server
python app.py
# → Server starts at http://localhost:8000
# → Test dashboard at http://localhost:8000/
```

The CLIP model (~600MB) downloads automatically on first run and is cached for subsequent starts.

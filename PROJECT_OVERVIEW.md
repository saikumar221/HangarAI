# HangarAI — Comprehensive Project Overview

## The Problem

**42% of startups fail due to lack of market need.** With 430,000+ new startups launching annually in the US and 75% of VC capital concentrated in just 3 states, most founders lack access to the informal coaching networks that Silicon Valley takes for granted. Existing tools — pitch deck builders (Pitch.com), speech coaches (Yoodli, Poised), transcription services (Otter.ai) — all operate in **silos**. None connect idea clarity to pitch delivery to investor-persona context.

---

## The Solution

**HangarAI** is an end-to-end founder intelligence platform that takes startups from raw idea to investor-ready pitch through three integrated modules:

| Module | What It Does | How It Works |
|--------|-------------|--------------|
| **Idea Finalization** | AI-guided brainstorm that stress-tests your thesis | LangGraph state machine with phase-based prompting (explore → challenge → finalize) |
| **Pitch Dojo** | Live pitch simulation with real-time multimodal capture | WebSocket audio streaming + browser-side MediaPipe computer vision |
| **Post-Pitch Analysis** | Multi-agent analysis report with Kalman-filtered confidence timeline | 3 parallel Gemini agents (audio, video, transcript) + synthesis engine |

The key differentiator: **manifest-grounded, investor-persona-specific feedback**. The analysis agents know what you *should* be saying (from your Startup Manifest) before judging *how* you said it — and they write feedback in the voice of a specific investor archetype (Pragmatist, Visionary, Operator, Skeptic, etc.).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 19 + TypeScript + Vite)    │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Landing  │  │ Brainstorm   │  │  Pitch   │  │  Analysis      │  │
│  │ Auth     │  │ ChatArea     │  │  Dojo    │  │  Report        │  │
│  │ Pages    │  │ + Sessions   │  │  + Video │  │  + Confidence  │  │
│  └──────────┘  └──────┬───────┘  └────┬─────┘  │    Graph       │  │
│                       │               │         └───────┬────────┘  │
│                  REST API        WebSocket +             │           │
│                       │          MediaPipe          REST API        │
│                       │          (browser)              │           │
└───────────────────────┼───────────────┼─────────────────┼───────────┘
                        │               │                 │
┌───────────────────────┼───────────────┼─────────────────┼───────────┐
│                    BACKEND (FastAPI + LangGraph + async)             │
│                       │               │                 │           │
│  ┌────────────────────▼──┐   ┌───────▼────────┐  ┌─────▼────────┐  │
│  │  Brainstorm Agent     │   │  Audio WebSocket│  │  Pitch       │  │
│  │  (LangGraph)          │   │  ├─ Hume AI     │  │  Orchestrator│  │
│  │  explore→challenge    │   │  │  (prosody)   │  │  (LangGraph) │  │
│  │  →finalize            │   │  └─ Deepgram    │  │              │  │
│  │  → Manifest Extract   │   │     (STT)       │  │  ┌────────┐ │  │
│  └───────────┬───────────┘   └───────┬─────────┘  │  │Audio   │ │  │
│              │                       │             │  │Agent   │ │  │
│              │                       │             │  ├────────┤ │  │
│              │                       │             │  │Video   │ │  │
│              │                       │             │  │Agent   │ │  │
│              │                       │             │  ├────────┤ │  │
│              │                       │             │  │Transcr.│ │  │
│              ▼                       ▼             │  │Agent   │ │  │
│  ┌──────────────────────────────────────────────┐ │  └───┬────┘ │  │
│  │        PostgreSQL (async via asyncpg)        │ │      │      │  │
│  │  Users │ Sessions │ Messages │ Manifests     │ │  Synthesis   │  │
│  │  PitchSessions │ AudioSegments │ VideoSnaps  │ │  + Kalman    │  │
│  │  Transcripts                                 │ │  Filter      │  │
│  └──────────────────────────────────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 19, TypeScript 5.9, Vite 8 | Modern SPA with type safety and fast HMR |
| **Computer Vision** | MediaPipe (FaceLandmarker + PoseLandmarker) | Runs entirely in-browser via WASM/GPU — zero backend video traffic |
| **Backend** | FastAPI 0.135, async Python | Native WebSocket + async/await throughout |
| **Agent Orchestration** | LangGraph 1.1.3 + LangChain-core 1.2 | Stateful multi-agent graphs with fan-out/fan-in topology |
| **LLM** | Google Gemini 2.5 Flash | Fast inference for real-time analysis across 5 agent nodes |
| **Speech-to-Text** | Deepgram Nova-2 (live streaming) | Sub-second latency, opus encoding, VAD events |
| **Vocal Emotion** | Hume AI Prosody Model | 18-emotion classification on 1.5s audio windows |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 (async) | JSONB for emotion arrays, indexed time-series queries |
| **Auth** | JWT (HS256) + bcrypt | OAuth2 bearer token flow, 24-hour expiry |
| **Infra** | Docker Compose (PostgreSQL) | Single-command database setup |

---

## Engineering Deep-Dives

### 1. LangGraph Brainstorm Agent — Phase-Based State Machine

The brainstorm agent uses a **single-node LangGraph** with implicit phase transitions based on conversation depth:

- **Turns 1–3 (Exploring):** Open-ended questions to understand the idea — *"Ask one focused, open-ended question per turn"*
- **Turns 4–6 (Challenging):** Stress-tests assumptions — *"Ask one hard question per turn"*
- **Turn 7+ (Finalizing):** Synthesizes everything into a structured **Startup Manifest**

The manifest extraction uses a dedicated JSON prompt with `parse_json_response()` — a custom utility that strips markdown fences and escapes control characters to handle Gemini's occasionally malformed JSON output. State is held in-memory (`_session_states` dict) keyed by session ID.

### 2. Multi-Agent Pitch Orchestrator — Fan-Out/Fan-In Topology

```
START → run_parallel_agents → synthesize → END
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  Audio     Video    Transcript
  Agent     Agent      Agent
    │         │         │
    └─────────┼─────────┘
              ▼
         Synthesis Node
   (roadmap + verdict + confidence graph)
```

Three specialized Gemini agents run in parallel via `asyncio.gather`, each producing structured JSON:
- **Audio Agent:** Analyzes Hume prosody emotions → vocal confidence, pacing, trend
- **Video Agent:** Analyzes MediaPipe scores → visual presence, eye contact, expression, posture
- **Transcript Agent:** Analyzes Deepgram text → content quality, clarity, structure, talking points, filler words

The **Synthesis Node** fuses all three outputs into an improvement roadmap (prioritized by Critical/High/Medium/Low), investor verdict, and the confidence graph.

### 3. Confidence Graph — Signal Fusion + Kalman Filtering

This is the most technically interesting piece. The confidence timeline is built in two passes:

**Pass 1 — Raw Composite Scores:**

For each video snapshot (~5s intervals):
1. Match to nearest audio segment (within time window, ±3s fallback)
2. Extract dominant emotion from Hume prosody
3. Compute visual composite:
   ```
   visual = 0.35×eye_contact + 0.25×expression + 0.25×posture + 0.15×head_stability
   ```
4. Apply **emotion valence modulation**:
   - Positive emotions (Determination, Pride, Enthusiasm...): `visual × (1 + emotion_score × 0.15)`
   - Negative emotions (Anxiety, Doubt, Fear...): `visual × (1 − emotion_score × 0.15)`
5. Clamp to [0, 1]

**Pass 2 — 1-D Kalman Filter:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Process noise (Q) | 0.005 | True confidence changes slowly between 5s snapshots |
| Measurement noise (R) | 0.04 | MediaPipe jitter from lighting, head turns, emotion classifier variance |

Output per point: **filtered score** (smoothed), **velocity** (d/dt in score/sec), **Kalman gain** (0–1 adaptiveness).

This produces a clean, jitter-free confidence timeline that preserves real trends while suppressing MediaPipe noise — rendered as an SVG line chart with area fill on the frontend.

### 4. Real-Time Audio Pipeline — Dual-API WebSocket

The `pitch.py` WebSocket handler simultaneously streams audio to **two** external services:

```
Browser MediaRecorder (WebM/opus, 2s chunks)
        │
        ▼
   FastAPI WebSocket
        │
   ┌────┴────┐
   ▼         ▼
 Hume AI   Deepgram
 (prosody)  (STT)
   │         │
   ▼         ▼
 Emotions   Transcripts
 (JSONB)    (text + timestamps)
```

- Each Hume chunk gets the **WebM container header prepended** to form a standalone audio segment
- Deepgram runs in live streaming mode (Nova-2, opus, 48kHz, mono) with VAD events
- Only **18 curated emotions** are tracked (prevents noise from obscure Hume categories)
- Top 3 emotions per 1.5s chunk are persisted as JSONB
- Hard cap: **50 MB** maximum audio per session
- On pitch end: Deepgram `Finalize` message flushes the buffer, 1.5s grace period for final callbacks, then batch-persist to PostgreSQL

### 5. Browser-Side Computer Vision — MediaPipe

The `PitchDojoPage.tsx` (597 lines — the largest frontend file) runs **two MediaPipe models in the browser** via WASM + GPU delegate:

- **FaceLandmarker**: 468 facial landmarks + blendshapes → eye contact (gaze direction analysis), expression (brow/cheek/jaw/mouth movements)
- **PoseLandmarker**: 33 body landmarks → posture (shoulder Y-axis symmetry), head stability (nose-tip variance over time)

Metrics are computed every 2 seconds in a `requestAnimationFrame` loop, averaged into `InsightSnapshot` objects, and POSTed to the backend after the pitch ends. This keeps **zero video data on the wire** — only lightweight JSON (~2KB per 2s window).

### 6. Database Design — Time-Series Optimized

9 tables with **strategic indexing** for time-series queries:

- `ix_messages_session_created` — efficient per-session message ordering
- `ix_audio_seg_session_start` — fast audio emotion lookups by time window
- `ix_video_snap_session_ts` — fast video metric lookups by timestamp
- `ix_transcript_session_start` — ordered transcript retrieval

JSONB columns for flexible data: `emotions` (array of {name, score}), `competitors`, `differentiators`, `key_assumptions`. One-to-one constraint on `StartupManifest.user_id` ensures a single active manifest per user.

---

## User Journey

```
1. Sign Up / Log In
        │
        ▼
2. Idea Finalization (Brainstorm Chat)
   AI explores → challenges → finalizes your idea
        │
        ▼
3. Startup Manifest Generated
   one-liner, problem, solution, market, competitors, differentiators
        │
        ▼
4. Pitch Dojo (Live Simulation)
   Select investor persona (6 built-in or custom)
   Deliver pitch with camera + mic
   Real-time: MediaPipe (vision) + Deepgram (transcript) + Hume (prosody)
        │
        ▼
5. Multi-Agent Analysis Report
   ├── Verdict: Pre-Seed Readiness Score (0-100) + Go/No-Go
   ├── Confidence Timeline (Kalman-filtered SVG graph)
   ├── Improvement Roadmap (prioritized cards)
   ├── Vocal Analysis (confidence, pacing, emotion highlights)
   ├── Visual Analysis (eye contact, expression, posture %)
   └── Transcript Analysis (content, clarity, structure, filler words)
```

---

## Impact

| Before HangarAI | After HangarAI |
|-----------------|----------------|
| 2–4 weeks iterating a pitch deck | Stress-tested thesis in one brainstorm session |
| 2–3 practice runs with friends (vague feedback) | 3–5 Pitch Dojo sessions against specific investor personas |
| Walk into investor meeting with one shot | Timestamped, multimodal feedback on every delivery dimension |
| Vague rejection, no actionable insights | Prioritized improvement roadmap + confidence timeline |

Research basis: structured deliberate practice reduces filler words **30–50%** and improves narrative retention **20–40%**.

---

## Structural Moat

| Competitor | What They Do | What They Miss |
|-----------|-------------|----------------|
| Pitch.com, Beautiful.ai | Optimize slides | No delivery concept at all |
| Yoodli, Poised, Orai | Speech coaching | Domain-blind — no startup context |
| Speeko | Communication confidence | Not investor-specific |
| Otter.ai, Fireflies.ai | Transcription + sentiment | Recorders, not evaluators |
| Human coaches | Real signal | $200+/hr, unschedulable |

**Why incumbents can't replicate this:** Yoodli/Poised could add investor personas in a sprint, but they cannot replicate Manifest-grounded question generation without building the entire idea validation layer — a fundamentally different product.

---

## Codebase Stats

| Metric | Value |
|--------|-------|
| Backend Python LOC | ~1,900 |
| Frontend TS/TSX LOC | ~2,665 |
| Custom CSS LOC | ~2,180 |
| Database tables | 9 |
| API endpoints | 17 |
| Frontend routes | 10 |
| LangGraph agents | 5 (1 brainstorm + 3 analysis + 1 synthesis) |
| External AI APIs | 3 (Gemini, Hume, Deepgram) |
| VC personas | 6 built-in + custom |
| Total commits | 20 |
| Documentation | ~25KB (README + MasterPlan) |

---

## Scalability Design

| Scale | Strategy |
|-------|----------|
| **Current** | MediaPipe in browser (no backend video), backend receives ~2KB JSON per 2s, session-isolated state |
| **10x (50–100 concurrent)** | Sticky routing (`nginx ip_hash`) keeps sessions on same worker |
| **100x (500–1,000 concurrent)** | Redis-backed WebSocket state (streams) + LangGraph `RedisSaver` checkpointer |
| **Hard ceiling** | Hume/Gemini API rate limits → mitigations: request-level retry, self-hosted Whisper, alternative vision models |

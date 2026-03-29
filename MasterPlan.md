# Hangar — where ideas get built before they fly

## Problem
Every founder knows the drill. You spend weeks obsessing over your deck, you practice in the mirror, you do a couple of mock runs with friends who mostly nod along — and then you walk into a partner meeting at a16z or YC and Paul Graham asks you one question you weren't ready for, and the whole thing unravels. The feedback loop for pitch prep is completely broken. The only people who can give you real signal are the investors themselves, and by the time you're in front of them it's already the real thing.
The structural moat against incumbents adding persona simulation: Yoodli or Poised could add an investor persona chatbot in a sprint. They cannot replicate the Manifest-grounded question generation without also building the idea validation layer — which is a fundamentally different product surface and would cannibalize their existing enterprise meeting coaching positioning.

The deeper problem is that most founders don't even have a crisp idea before they start pitching. Early-stage founders operate in a 'Realism Gap.' 42% of startups fail due to a lack of market need. They know what they're building, but they can't articulate the problem clearly, they haven't mapped the competitive landscape honestly, and they haven't stress-tested the core assumption. They're pitching a half-formed thesis and hoping the investor fills in the gaps. 430,000+ new employer startups launch in the US every year (Census Bureau), but 75% of venture capital concentrates in just three states, leaving most founders without access to investor networks or advisors.

## Solution
Hangar is a modular 'AI Factory' that industrializes the transition from raw idea to battletested pitch. It starts where the real work starts — the idea itself — and doesn't let you move forward until it's airtight. Then it puts you in a live simulation with the investor persona of your choice, analyzing not just what you say but how you say it and how you show up. The feedback you get after is the kind of feedback you'd normally only get after you've already blown the pitch.
It uses a Stateful Multi-Agent Orchestrator to:
Solidify messy brainstorms into structured 'Startup Manifests' via an Interactive Chain-of-Thought (iCoT) consultant.
Provide a live multimodal pitch simulation where three specialized agents (Transcript/Persona, Vocal Health, and Visual Presence) analyze performance in parallel to generate an industrial-grade feedback report.

## User Impact

- Who: Pre-seed founders — solo or 2-person teams, pre-institutional pitch, typically outside SF/NYC with no warm investor intros and no one credible to practice with.

- Scale: 430,000+ new employer startups launch in the US annually (Census Bureau), but 75% of venture capital concentrates in just three states (PitchBook-NVCA). Most founders have no access to the informal coaching networks that well-connected 
founders take for granted.

- Before: 2–4 weeks iterating a deck alone, 2–3 practice runs with friends who can't give real signal, one shot in the room with an investor, vague rejection, no diagnosis.

- After: Thesis stress-tested before the deck exists. 3–5 Pitch Dojo sessions against the specific investor persona. Timestamped feedback on content, delivery, and presence. Walk in having already answered the hardest questions they ask.

- Improvement basis: Structured deliberate practice with specific feedback reduces filler word frequency by 30–50% and improves narrative retention by 20–40% over unguided practice (public speaking research). Hangar applies this to the highest-stakes presentation most founders ever give.

## Architecture
- Orchestration: LangGraph StateMachine on the backend to coordinate parallel agent execution and signal fusion.
- Persistence: PostgreSQL for Startup Manifests (Problem/Solution/Market/Competitors), session logs, and per-timestamp signal data.
- AV Capture: Native `getUserMedia()` + `MediaRecorder` + dual WebSocket connections (audio @ 3s chunks, video @ 1fps JPEG).
- Speech-to-Text: Deepgram for real-time timestamped transcript output.
- Vocal Analysis: Hume AI (prosody batch analysis) for timestamped prosody, tone, and emotional valence mapped to transcript segments. Audio chunks are collected during the session and analyzed in batch after the pitch ends.
- Vision Analysis: Gemini 2.5 Flash on the backend processes incoming 1fps JPEG frames and returns timestamped facial expression and eye contact scores. This deliberately replaces client-side MediaPipe to eliminate WASM overhead and keep all heavy compute server-side.
- Signal Fusion: Custom engine merges transcript, audio, and vision signals by timestamp into a unified performance dataset fed to the scoring engine.
- Extensibility: The Startup Manifest is a portable JSON artifact with a defined schema — exportable to deck tools, CRM platforms, or third-party investor databases. The LangGraph node structure supports new agent types without modifying the core pipeline.

## Features
- Feature 1: Idea Finalization: A React chat interface where a Consultant Agent uses iCoT to challenge the founder, surface competitors, and extract a finalized manifest into the DB.
- Feature 2: The Pitch Dojo: A live pitch simulation. Users enter an investor's details, deliver their pitch on camera, and get a full post-pitch report — improvement roadmap, confidence graph, and a verdict written in the investor's voice. (Live persona interjections during the pitch are on the roadmap, not yet implemented.)


## Differentiation Strategy

| Competitor | What they do | What they miss |
|------------|-------------|----------------|
| Pitch.com, Beautiful.ai, Gamma | Optimize the deck artifact | No concept of delivery — a great deck with a nervous founder still loses the meeting |
| Slidebean | AI feedback on pitch narrative/structure | Text-only, deck-only, no live simulation, no audio/video |
| Yoodli, Poised, Orai | Speech coaching — filler words, pacing, eye contact | Domain-blind: identical feedback for a wedding toast and a Series A pitch; no startup context |
| Speeko | General communication confidence coaching | Not investor-specific; no manifest, no persona, no multimodal signal |
| Otter.ai, Fireflies.ai, SpeakAI | Transcription + basic sentiment | Recorders, not evaluators — answer "what did you say?" not "were you convincing?" |
| Human coaches / accelerator advisors | Real signal, but expensive and unschedulable | Inconsistent, not repeatable, no structured timestamped output |

### The fundamental gap none of them close

Every existing tool analyzes one layer — content *or* delivery *or* presence — in isolation. None of them connect the content layer to the delivery layer.

That connection is the only thing that matters. A tool that doesn't know your startup's thesis cannot tell you that your vocal confidence collapsed at the exact moment you made a claim your business model can't support. It cannot tell you that your posture shifted when you named your competitor.

Hangar's Startup Manifest threads through the entire pipeline. The analysis agents know what you *should* be saying before they judge how you said it. When confidence drops at second 47, the system knows whether that was your hardest claim to defend — because it helped you build that claim in the first place. No existing tool can do this. They have no memory of your startup.

The structural moat: Yoodli or Poised could add an investor persona chatbot in a sprint. They cannot replicate Manifest-grounded question generation without also building the idea validation layer — a fundamentally different product surface that would cannibalize their enterprise meeting coaching positioning.

**One-liner:** The only tool that takes a founder from raw messy idea → structured manifest → live multimodal pitch simulation in a single stateful flow — where context from step one informs the verdict in step three.


## Scalability Design

### Current architecture properties
- **Client-side vision:** MediaPipe runs entirely in the browser — zero per-user backend WASM overhead. The backend only receives lightweight JSON snapshots (~2KB per 2s window), keeping the hot path thin regardless of session count.
- **Session-isolated state machines:** Each Pitch Dojo session runs in its own LangGraph invocation. Concurrent users don't share graph state and cannot interfere with each other.
- **Decoupled agents:** Audio Agent (Hume) and Video Agent (Gemini) are independently invoked within the orchestrator. Either can be scaled, swapped, or stubbed without modifying the orchestration layer.

### At 10x load (~50–100 concurrent sessions)
The bottleneck shifts from compute to WebSocket session affinity. Each active Dojo session holds an open WebSocket connection for live audio streaming. Behind a standard round-robin load balancer, a reconnect or failover would land on a different worker with no knowledge of the in-flight session. The fix is **sticky routing** (e.g., nginx `ip_hash` or a cookie-pinned upstream) so each session stays on the same worker for its lifetime. This works cleanly at 10x since session lifetimes are short (5–15 min) and churn is manageable. The LangGraph orchestrator fires only at session end, so it doesn't hold long-lived state during the live pitch — just at analysis time.

### At 100x load (~500–1,000 concurrent sessions)
Sticky routing becomes a liability — a worker crash takes down all sessions pinned to it. The solution is to externalize WebSocket session state into **Redis**. Each audio chunk received is written to a Redis stream keyed by `session_id`. Any worker can pick up the stream, so the load balancer no longer needs affinity. Workers become fully stateless and horizontally scalable. LangGraph's in-memory graph state (brainstorm conversation history, agent scratchpads) would similarly need to move to a Redis-backed checkpointer — LangGraph supports this natively via `RedisSaver` — so an orchestrator invocation can resume on any worker without re-running prior nodes.

At this tier the hard ceiling becomes **Hume AI and Gemini API rate limits**, not infrastructure. Hume's prosody batch endpoint has per-account concurrency caps; Gemini 2.5 Flash has per-minute token quotas. Mitigation paths: (1) request-level retry with exponential backoff already isolates failures per session; (2) a self-hosted Whisper + open-source emotion model can replace Hume for the vocal analysis path without touching the orchestration layer; (3) Gemini can be replaced with a self-hosted vision model or load-balanced across multiple API keys.

### Manifest portability (roadmap)
A `GET /manifests/{id}` public endpoint could expose the manifest JSON for third-party deck tools or CRMs — not yet implemented.

## Startup Manifest Schema

The Startup Manifest is the core portable artifact extracted by the Consultant Agent at the end of a brainstorm session. It is persisted to PostgreSQL and exposed via REST.

```json
{
 "id": "uuid",
 "brainstorm_session_id": "uuid",
 "one_liner": "string",
 "problem": "string",
 "solution": "string",
 "target_customer": "string",
 "market_size": "string",
 "competitors": ["string"],
 "differentiators": ["string"],
 "key_assumptions": ["string"],
 "created_at": "ISO 8601 timestamp"
}
```

All fields except `id`, `brainstorm_session_id`, and `created_at` are nullable — the agent populates what it can extract from the conversation; unresolved fields are left null rather than hallucinated.

### API Endpoints

All endpoints require `Authorization: Bearer <jwt>` except where noted.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/signup` | Create a user account |
| `POST` | `/auth/login` | Authenticate and receive a JWT |
| `GET` | `/auth/me` | Get the authenticated user's profile |
| `POST` | `/brainstorm/session` | Start a new brainstorm session |
| `GET` | `/brainstorm/sessions` | List all sessions for the user |
| `POST` | `/brainstorm/session/{id}/chat` | Send a message; returns the agent's reply |
| `GET` | `/brainstorm/session/{id}/messages` | Fetch full conversation history |
| `POST` | `/brainstorm/session/{id}/finalize` | Extract and persist the Startup Manifest |
| `GET` | `/brainstorm/manifest` | Get the user's current Startup Manifest |
| `GET` | `/brainstorm/session/{id}/manifest` | Get the manifest from a specific session |
| `DELETE` | `/brainstorm/session/{id}` | Delete a session and its messages + manifest |
| `DELETE` | `/brainstorm/manifest` | Delete the user's manifest |
| `POST` | `/pitch/sessions` | Create a new pitch session |
| `WS` | `/pitch/ws/{id}/audio` | Stream audio chunks (2 s) for Hume prosody analysis |
| `POST` | `/pitch/sessions/{id}/video-analysis` | Submit MediaPipe presence snapshots after pitch ends |
| `POST` | `/analysis/pitch/{session_id}` | Run multi-agent analysis; returns full report |


### Extending the Agent Pipeline

New analysis agents can be added to the LangGraph orchestrator without touching existing nodes. Each agent node receives the shared pitch state (audio segments, video snapshots, manifest) and writes its output back to the state under its own key. The synthesis node reads all agent outputs — adding a new agent means adding one key to the synthesis prompt, not rewiring the graph.


## Risks & Contingencies

| Risk | Descope Trigger | Fallback |
|------|----------------|----------|
| Deepgram latency or instability | Not stable in first test | Switch to Whisper via OpenAI API; timestamps slightly less precise but pipeline holds |
| Hume AI rate limits or high latency | Confirmed > 500ms in testing | Claude-based sentiment scoring on raw transcript |
| Gemini vision too slow | > 2s per frame in testing | Reduce to 0.5fps or stub with mock confidence scores; audio + transcript remain live |
| Signal fusion engine incomplete | Not running by Hour 11 | Display three agent outputs as separate panels; skip merged scoring |
| LangGraph orchestrator blocking | Slipping past Hour 10 | Sequential agent calls; remove parallelism; narrative still holds |
| Scoring engine incomplete | Not done by Hour 13 | Show raw agent outputs only; qualitative feedback without numeric scores |

## Team Plan

#### Phase 1 — Infrastructure ✅ Complete
- [x] Setup React frontend - Sai & Sahana (Hour 0–1)
- [x] Setup FastAPI backend - Sai & Sahana (Hour 0–1)
- [x] Design and initialize PostgreSQL schema - Sai (Hour 1–2)
- [x] Initialize LangGraph state machine skeleton - Sahana (Hour 1–2)
- [x] Setup authentication - Sahana (Hour 2–3)
- [x] Build Landing page, Login page, Signup page, Home dashboard - Sahana (Hour 2–4)

#### Phase 2 — Feature 1: Idea Finalization ✅ Complete
- [x] Build chat UI - Sai (Hour 2–4)
- [x] Build Consultant Agent - Sahana (Hour 4–6)
- [x] Build entity extraction logic - Sahana (Hour 6–7)
- [x] Persist finalized Startup Manifest to PostgreSQL - Sahana (Hour 7–8)

#### Phase 3 — Feature 2: Pitch Dojo
- [x] Setup API - Sai  (Hour 4–5)
- [x] Build Pitch Dojo UI - Sai  (Hour 5–8)
- [x] Fetch the Finalized Startup Manifest from PostgreSQL - Sai  (Hour 7–8)
- [x] Connect frontend audio/video to backend via two separate WebSocket connections (audio @ 3s chunks, video @ 1fps JPEG) - Sai (Hour 8-9)
- [x] Build Agent 1: Investor Persona LLM- Sai (Hour 13–16)
- [x] Integrate Hume AI (prosody batch analysis) - Sahana (Hour 9-11)
- [x] Integrate Gemini 2.5 Flash on backend for video/facial expression analysis (Video Agent in pitch_orchestrator.py analyzes MediaPipe scores via Gemini) - Sai (Hour 9–13)
- [x] Build LangGraph orchestrator - Sahana  (Hour 15–19)
- [x] Build signal fusion engine - Sahana  (Hour 19–21)

#### Phase 4 — Scoring & Dashboard
- [x] Build scoring engine — compute section-level and overall confidence/performance scores from fused signal - Sai (Hour 19-21)
- [x] Build post-pitch dashboard — strengths, weaknesses, per-section improvement suggestions - Sahana (Hour 21-22)
- [x] Build confidence score graph — time-series chart with timestamp markers from the session - Sai (Hour 21-22)
- [x] Build persona verdict output — final verdict generated in the selected investor's voice/style - Sai & Sahana (Hour 22-23)
- [x] Update README with final tech stack and setup instructions - Sai & Sahana (Hour 23-24)

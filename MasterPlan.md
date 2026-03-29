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
| Competitor | What they do | Why Hangar wins |
|------------|-------------|-----------------|
| Yoodli | Speech coaching, tracks filler words and pacing | No idea validation layer, no investor personas, no manifest |
| PitchBob | AI feedback on your pitch deck | Deck-only, no live simulation, no real-time audio/video |
| Poised | Real-time coaching during meetings | Generic meeting context, not built for founder/investor dynamics |

Incumbents are optimized for recurring enterprise meeting coaching — not the single high-stakes pitch. Each Pitch Dojo session feeds back into the Startup Manifest, making persona questions sharper over time. That compounding feedback loop is what generic speech tools cannot replicate.

The structural difference is that Hangar's feedback loop is grounded in a validated idea layer — the Startup Manifest — meaning persona questions aren't generic pitch coaching prompts but targeted challenges derived from the specific weaknesses identified in the founder's own thesis. No competitor can replicate this without also building the idea validation layer.

Hangar's one-liner: The only tool that takes a founder from raw messy idea → structured manifest → live multimodal pitch simulation in a single stateful flow.

## Scalability Design
- Client-side vision: MediaPipe runs entirely in the browser — zero per-user backend WASM overhead. The backend only receives lightweight JSON snapshots.
- Session-isolated state machines: Each Pitch Dojo session runs in its own LangGraph invocation. Concurrent users don't interfere with each other.
- Decoupled agents: Audio Agent (Hume) and Video Agent (Gemini/MediaPipe) are independently deployable. Either can be scaled, swapped, or stubbed without affecting the orchestration layer.
- At 10x load (concurrent Dojo sessions): each session's LangGraph instance is stateless and independently deployable — horizontal scaling requires adding FastAPI workers behind a load balancer with sticky WebSocket routing. At 100x: the primary bottleneck is Hume AI and Gemini API rate limits, not infrastructure. The decoupled agent design means either can be swapped for self-hosted alternatives without touching the orchestration layer.

**Manifest portability (roadmap):** A `GET /manifests/{id}` public endpoint could expose the manifest JSON for third-party deck tools or CRMs — not yet implemented.

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

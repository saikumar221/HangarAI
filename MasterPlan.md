# Hangar — where ideas get built before they fly

## Problem
Every founder knows the drill. You spend weeks obsessing over your deck, you practice in the mirror, you do a couple of mock runs with friends who mostly nod along — and then you walk into a partner meeting at a16z or YC and Paul Graham asks you one question you weren't ready for, and the whole thing unravels. The feedback loop for pitch prep is completely broken. The only people who can give you real signal are the investors themselves, and by the time you're in front of them it's already the real thing.
The deeper problem is that most founders don't even have a crisp idea before they start pitching. Early-stage founders operate in a 'Realism Gap.' 42% of startups fail due to a lack of market need. They know what they're building, but they can't articulate the problem clearly, they haven't mapped the competitive landscape honestly, and they haven't stress-tested the core assumption. They're pitching a half-formed thesis and hoping the investor fills in the gaps.

## Solution
Hangar is a modular 'AI Factory' that industrializes the transition from raw idea to battletested pitch. It starts where the real work starts — the idea itself — and doesn't let you move forward until it's airtight. Then it puts you in a live simulation with the investor persona of your choice, analyzing not just what you say but how you say it and how you show up. The feedback you get after is the kind of feedback you'd normally only get after you've already blown the pitch.
It uses a Stateful Multi-Agent Orchestrator to:
Solidify messy brainstorms into structured 'Startup Manifests' via an Interactive Chain-of-Thought (iCoT) consultant.
Provide a live multimodal pitch simulation where three specialized agents (Transcript/Persona, Vocal Health, and Visual Presence) analyze performance in parallel to generate an industrial-grade feedback report.
## Architecture
- Orchestration: LangGraph StateMachine on the backend to coordinate parallel agent execution and signal fusion.
- Persistence: PostgreSQL for structured entity storage (Problem/Solution/Market Gaps) and session logs.
- Real-Time Stream: LiveKit + Deepgram (STT) for low-latency (<200ms) multimodal communication.
- Analysis Layer: Hume AI (EVI) for timestamped vocal prosody and MediaPipe (client-side) for facial mesh/posture tracking.
## Features
- Feature 1: Idea Finalization: A React chat interface where a Consultant Agent uses iCoT to challenge the founder, surface competitors, and extract a finalized manifest into the DB.
- Feature 2: The Pitch Dojo: A live-streaming simulation. Users select an investor persona (e.g., Paul Graham) that interjects follow-up questions during natural pauses. Results are merged into a unified performance dashboard.
## Team Plan (15-Hour Sprint)
- Sai & Sahana: Scaffold React/FastAPI
- Sai: Set up PostgreSQL schema
- Sahana: Initialize LangGraph state.
- Sai & Sahana: Implement Feature 1 and entity extraction logic.
- Sai: Integrate LiveKit
- Sahana: Integrate  Deepgram
- Sahana: Integrate Hume
- Sai: Integrate MediaPipe
- Sai & Sahana: Build the fusion engine to sync signals.
- Sai & Sahana: Build the final reporting dashboard (Confidence Graph + Persona Verdict)

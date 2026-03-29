# Hangar — where ideas get built before they fly
Hangar is a founder prep platform that takes a startup from raw idea to investor-ready pitch.

## Overview
Hangar gives founders a structured path from messy brainstorm to polished, battle-tested pitch.

## Features
### Feature 1: Idea Finalization
A chat-based interface where founders brainstorm with an AI consultant agent. The agent doesn't just listen — it challenges gaps, surfaces competitors, and pushes founders to clearly articulate their problem, solution, and target audience.
Once the idea is finalized, it's saved in the database.

### Feature 2: The Pitch Dojo
A real-time pitch simulation where founders select an investor persona — think Paul Graham, Marc Andreessen, or Garry Tan — and deliver their pitch live via audio and video.
Three specialized agents run in parallel, coordinated by an orchestrator:
**Agent 1 — Transcript + Investor Persona**
Converts audio to text and generates a timestamped transcript. The transcript is fed into an LLM that assumes the selected investor persona and interjects with live follow-up questions at natural pauses.
**Agent 2 — Audio Emotion Analysis**
Analyzes tone, nervousness, vocal confidence, speech pace, filler words, and energy levels — all mapped to timestamps.
**Agent 3 — Video + Facial Expression Analysis**
Analyzes facial expressions, eye contact, micro-expressions (especially during tough questions), and posture frame by frame — also mapped to timestamps.
The orchestrator merges outputs from all three agents at each timestamp and feeds a unified signal into the scoring and summary engine.

## Post-Pitch Summary
After each session, founders receive:
- Strengths across content, delivery, and presence
- Weaknesses across all three dimensions
- Specific improvement suggestions for each section of the pitch
- A confidence score graph over time with timestamp markers
- An overall verdict delivered in the selected investor persona's voice

## Tech Stack

**Backend**
- Python, FastAPI, LangGraph, Gemini API
- PostgreSQL (SQLAlchemy async)
- Deepgram (STT), Hume AI (prosody batch analysis), Gemini 2.5 Flash (vision analysis)

**Frontend**
- React + TypeScript, Vite
- Native `getUserMedia()` + `MediaRecorder` + dual WebSocket connections (audio @ 3s chunks, video @ 1fps JPEG)

## Project Structure

```
HangarAI/
├── backend/
│   ├── main.py          # FastAPI entry point
│   ├── routes/          # API route handlers
│   ├── agents/          # LangGraph agents
│   ├── db/              # Database models & session
│   ├── schemas/         # Pydantic schemas
│   ├── core/            # Config, dependencies, shared utilities
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/
        ├── pages/
        ├── hooks/
        ├── lib/
        └── types/
```

## Setup

### Backend

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Set up environment
cp .env.example .env

# 3. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 4. Install dependencies
cd backend
pip install -r requirements.txt

# 5. Start the server (tables are auto-created on first run)
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```


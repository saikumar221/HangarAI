# Hangar — where ideas get built before they fly

Hangar is a founder prep platform that takes a startup from raw idea to investor-ready pitch.

## The Problem

Most founders walk into investor meetings underprepared — not because they lack drive, but because the tools available to them are either too generic or too shallow:

- **Pitch deck builders** (Pitch, Beautiful.ai) help with slides but give zero feedback on how you *deliver* the pitch
- **Public speaking apps** (Yoodli, Speeko) analyze audio but ignore visual presence and have no concept of an investor context
- **Transcription tools** (Otter, SpeakAI) record what you said but can't tell you if you were convincing
- **Human mock interviews** are expensive, hard to schedule, and produce inconsistent feedback

None of these tools connect idea clarity to pitch delivery, and none simulate the specific investor you're about to face.

## Why Hangar is Different

Hangar is not a slide tool, a transcription service, or a generic speaking coach. It is a **full-stack founder preparation system** with three properties no existing tool has together:

1. **End-to-end pipeline** — the same platform takes you from a raw idea through structured ideation to a live pitch simulation and a scored debrief. The context from your brainstorm (your market, competitors, differentiators) feeds directly into your pitch analysis — Gemini knows what you *should* be saying before it judges how you said it.

2. **Multimodal signal fusion** — most tools analyze one signal in isolation. Hangar captures vocal emotion (Hume AI prosody, every 1.5 s) and visual presence (MediaPipe face + pose landmarks, every 5 s) and fuses them into a single timestamped confidence score. A dip in confidence at second 47 means something specific — the audio and video data at that moment tell you *why*.

3. **Investor-persona verdict** — feedback isn't generic. The final verdict is written in the voice of the specific investor you selected, based on their company, background, and any notes you provided. A YC partner reads your pitch differently than a deep-tech Series A fund. Hangar reflects that.

## Features

### Idea Finalization
A chat-based interface where founders brainstorm with an AI consultant. The agent progresses through three phases — **exploring**, **challenging**, and **finalizing** — pushing founders to clearly articulate their problem, solution, target customer, and market. The result is a structured **Startup Manifest** saved to the database and used as context for every subsequent step.

### Pitch Dojo
A real-time pitch simulation where founders enter the target investor's details and deliver their pitch live. Audio is streamed via WebSocket to **Hume AI** for prosody/emotion analysis every 1.5 seconds. Video is analyzed frame-by-frame by **MediaPipe** for eye contact, facial expression, posture, and head stability — all timestamped and persisted to PostgreSQL.

### Post-Pitch Analysis (Multi-Agent Orchestrator)
After a session, a **LangGraph** orchestrator fires two Gemini-powered agents in parallel:

- **Audio Agent** — receives the full Hume emotion timeline and the startup manifest, returns vocal confidence score, pacing assessment, emotion highlights, and key patterns
- **Video Agent** — receives the full MediaPipe visual presence timeline, returns presence scores and behavioral patterns

A **Synthesis Engine** fuses both outputs into a full report:
- **Improvement Roadmap** — prioritized (Critical / High / Medium / Low) suggestions per pitch section
- **Confidence Graph** — per-timestamp composite score merging vocal emotion valence + visual presence metrics, visualized as an interactive SVG timeline
- **The Verdict** — Pre-Seed Readiness Score (0–100), go/no-go decision, and a detailed assessment written in the target investor's voice

## Implementation Status

| Component | Status |
|-----------|--------|
| Auth (JWT, signup, login) | ✅ Complete |
| Brainstorm Consultant Agent (LangGraph) | ✅ Complete |
| Startup Manifest extraction + persistence | ✅ Complete |
| Pitch session creation + WebSocket audio | ✅ Complete |
| Hume AI prosody integration | ✅ Complete |
| MediaPipe video analysis (client-side) | ✅ Complete |
| LangGraph multi-agent orchestrator | ✅ Complete |
| Audio Agent (Gemini) | ✅ Complete |
| Video Agent (Gemini) | ✅ Complete |
| Signal fusion + Confidence Graph | ✅ Complete |
| Pre-Seed Readiness Score + Verdict | ✅ Complete |
| Post-pitch analysis dashboard | ✅ Complete |

## Tech Stack

**Backend**
- Python, FastAPI, LangGraph, Gemini 2.5 Flash
- PostgreSQL (SQLAlchemy async + asyncpg)
- Hume AI (prosody emotion analysis)

**Frontend**
- React + TypeScript, Vite
- MediaPipe (`@mediapipe/tasks-vision`) — face & pose landmark detection
- Native `getUserMedia()` + `MediaRecorder` + WebSocket for live audio streaming

## Project Structure

```
HangarAI/
├── backend/
│   ├── main.py               # FastAPI entry point
│   ├── agents/
│   │   ├── brainstorm_agent.py   # LangGraph consultant (idea finalization)
│   │   └── pitch_orchestrator.py # LangGraph multi-agent pitch analysis
│   ├── routes/
│   │   ├── auth.py           # Signup, login, /me
│   │   ├── brainstorm.py     # Session, chat, manifest endpoints
│   │   ├── pitch.py          # Pitch session, video analysis, audio WebSocket
│   │   └── analysis.py       # Post-pitch analysis orchestration
│   ├── db/
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   └── database.py       # Async engine + session factory
│   ├── schemas/              # Pydantic schemas
│   ├── core/                 # JWT auth, UUID utilities, password hashing
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/            # LoginPage, BrainstormPage, PitchDojoPage, GenerateAnalysisPage, ...
        ├── components/       # AppNav, shared UI
        ├── api/              # Fetch wrappers (auth, brainstorm, pitch)
        └── types/
```

## Setup

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- Python 3.12+
- Node.js 18+

### Environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/hangar
GEMINI_API_KEY=...
HUME_API_KEY=...
SECRET_KEY=change-me-in-production
```

### Backend

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
cd backend
pip install -r requirements.txt

# 4. Start the server (DB tables are auto-created on first run)
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` (or `5174` if that port is taken). The backend API runs at `http://localhost:8000`.

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register |
| POST | `/auth/login` | Login (returns JWT) |
| GET | `/auth/me` | Current user |
| POST | `/brainstorm/session` | Start brainstorm session |
| POST | `/brainstorm/session/{id}/chat` | Chat turn |
| POST | `/brainstorm/session/{id}/finalize` | Extract & save manifest |
| GET | `/brainstorm/manifest` | Get user's manifest |
| POST | `/pitch/sessions` | Create pitch session |
| POST | `/pitch/sessions/{id}/video-analysis` | Save video snapshots |
| WS | `/pitch/ws/{id}/audio` | Stream audio for Hume analysis |
| POST | `/analysis/pitch/{id}` | Run multi-agent analysis |

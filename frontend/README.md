# HangarAI — Frontend

React + TypeScript + Vite frontend for the HangarAI founder prep platform.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | LandingPage | Marketing landing |
| `/signup` | SignupPage | Account creation |
| `/login` | LoginPage | JWT login |
| `/home` | HomePage | Dashboard |
| `/chat` | BrainstormPage | AI consultant chat (idea finalization) |
| `/manifest` | ManifestPage | View startup manifest |
| `/pitch-dojo` | PitchDojoPage | Live pitch simulation (AV capture) |
| `/generate-analysis/:sessionId` | GenerateAnalysisPage | Post-pitch analysis report |

## Key Dependencies

- **React 19 + React Router 7** — routing and UI
- **`@mediapipe/tasks-vision`** — client-side face & pose landmark detection for eye contact, expression, posture, and head stability scores
- **Native `getUserMedia()` + `MediaRecorder`** — AV capture; audio chunks sent via WebSocket, video snapshots POSTed on pitch end

## Dev

```bash
npm install
npm run dev     # http://localhost:5173 (or 5174)
npm run build
npm run lint
```

Requires the backend running at `http://localhost:8000`.

import { authHeaders } from './auth'

const BASE = '/pitch'

// Creates the session row in the DB before the audio WebSocket opens.
// Maps camelCase InvestorForm fields to the snake_case API schema.
// Empty strings are coerced to null so the backend treats them as absent.
export async function createPitchSession(
  sessionId: string,
  investor: {
    firstName: string
    lastName: string
    company: string
    linkedin: string
    notes: string
  },
): Promise<void> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      session_id: sessionId,
      investor_first_name: investor.firstName,
      investor_last_name: investor.lastName,
      investor_company: investor.company,
      investor_linkedin: investor.linkedin || null,
      investor_notes: investor.notes || null,
    }),
  })
  if (!res.ok) throw new Error('Failed to create pitch session')
}

export interface AnalysisReport {
  session_id: string
  investor_name: string
  investor_company: string
  audio_insights: {
    vocal_confidence_score: number
    confidence_trend: string
    pacing_score: number
    emotion_highlights: { timestamp: number; emotion: string; score: number; interpretation: string }[]
    key_vocal_patterns: string[]
    vocal_summary: string
  }
  video_insights: {
    visual_presence_score: number
    avg_eye_contact: number
    avg_expression: number
    avg_posture: number
    visual_patterns: string[]
    visual_summary: string
  }
  transcript_insights: {
    content_score: number
    clarity_score: number
    structure_score: number
    word_count: number
    duration_quality: string
    key_talking_points: string[]
    missing_elements: string[]
    filler_word_count: number
    standout_phrases: string[]
    content_patterns: string[]
    transcript_summary: string
  } | null
  improvement_roadmap: {
    section: string
    priority: 'Critical' | 'High' | 'Medium' | 'Low'
    issue: string
    suggestion: string
  }[]
  confidence_graph: {
    timestamp: number
    confidence_score: number
    raw_confidence_score: number
    confidence_velocity: number
    kalman_gain: number
    dominant_emotion: string | null
    eye_contact: number
    expression: number
    posture: number
  }[]
  verdict: {
    pre_seed_readiness_score: number
    investor_persona_summary: string
    strengths: string[]
    critical_weaknesses: string[]
    go_decision: string
  }
}

export async function generateAnalysis(sessionId: string): Promise<AnalysisReport> {
  const res = await fetch(`/analysis/pitch/${sessionId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to generate analysis')
  return res.json()
}

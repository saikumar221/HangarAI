const BASE = '/brainstorm'

export interface ApiSession {
  id: string
  status: string
  created_at: string
  completed_at: string | null
}

export interface ApiMessage {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
}

export interface ApiManifest {
  id: string
  brainstorm_session_id: string
  one_liner: string | null
  problem: string | null
  solution: string | null
  target_customer: string | null
  market_size: string | null
  competitors: string[] | null
  differentiators: string[] | null
  key_assumptions: string[] | null
  created_at: string
}

export async function createSession(): Promise<ApiSession> {
  const res = await fetch(`${BASE}/session`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json()
}

export async function sendMessage(
  sessionId: string,
  message: string,
): Promise<{ reply: string; phase: string }> {
  const res = await fetch(`${BASE}/session/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}

export async function getMessages(sessionId: string): Promise<ApiMessage[]> {
  const res = await fetch(`${BASE}/session/${sessionId}/messages`)
  if (!res.ok) throw new Error('Failed to get messages')
  return res.json()
}

export async function finalizeSession(sessionId: string): Promise<ApiManifest> {
  const res = await fetch(`${BASE}/session/${sessionId}/finalize`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to finalize session')
  return res.json()
}

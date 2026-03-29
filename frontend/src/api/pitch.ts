import { getAuthToken } from './auth'

const BASE = 'http://localhost:8000/pitch'

function authHeaders(): HeadersInit {
  const token = getAuthToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

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
    headers: authHeaders(),
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

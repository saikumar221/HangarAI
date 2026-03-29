export interface StoredUser {
  id: string
  email: string
  first_name: string
  last_name: string
}

export async function signup(email: string, password: string, first_name: string, last_name: string): Promise<StoredUser> {
  const res = await fetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, first_name, last_name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Signup failed')
  }
  const user: StoredUser = await res.json()
  localStorage.setItem('user', JSON.stringify(user))
  return user
}

export async function login(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: email, password })
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Login failed')
  }
  const { access_token } = await res.json()
  localStorage.setItem('token', access_token)

  // Fetch and store user info
  const meRes = await fetch('/auth/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (meRes.ok) {
    const user: StoredUser = await meRes.json()
    localStorage.setItem('user', JSON.stringify(user))
  }
}

export function getStoredUser(): StoredUser | null {
  try {
    return JSON.parse(localStorage.getItem('user') ?? 'null')
  } catch {
    return null
  }
}

export function logout(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

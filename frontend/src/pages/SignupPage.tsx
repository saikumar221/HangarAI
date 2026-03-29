import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signup } from '../api/auth'

export default function SignupPage() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await signup(email, password, firstName, lastName)
      // Store user info from signup response; token not needed until routes are protected
      localStorage.setItem('user', JSON.stringify(user))
      navigate('/home')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Hangar<span>AI</span></Link>
        <div className="auth-heading">Create your account</div>
        <div className="auth-sub">Start building your investor-ready pitch.</div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-row">
            <div className="auth-field">
              <label className="auth-label">First name</label>
              <input
                className="auth-input"
                type="text"
                placeholder="Jamie"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Last name</label>
              <input
                className="auth-input"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <div className="auth-footer-link">
          Already have an account? <Link to="/login" className="auth-link">Log in</Link>
        </div>
      </div>
    </div>
  )
}

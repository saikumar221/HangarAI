import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { getUserManifest } from '../api/brainstorm'
import AppNav from '../components/AppNav'

export default function HomePage() {
  const navigate = useNavigate()
  const user = useUser()
  const [hasManifest, setHasManifest] = useState(false)

  useEffect(() => {
    getUserManifest()
      .then(() => setHasManifest(true))
      .catch(() => setHasManifest(false))
  }, [])

  const displayName = user ? user.first_name : 'there'

  return (
    <div className="home">

      {/* Top nav */}
      <nav className="home-nav">
        <Link to="/home" className="home-logo">Hangar<span>AI</span></Link>
        <div className="home-nav-right">
          <AppNav />
        </div>
      </nav>

      {/* Header */}
      <header className="home-header">
        <div className="home-greeting">Hello, {displayName}!</div>
        <h1 className="home-title">Your idea, built right.</h1>
      </header>

      {/* Feature cards */}
      <section className="home-cards">
        {[
          {
            tag: 'Feature 01',
            title: 'Idea Finalization',
            description: 'Work with an AI consultant to pressure-test your startup idea. Surface gaps, identify competitors, and lock in your problem, solution, and target customer.',
            cta: 'Start brainstorming',
            status: 'available' as const,
            route: '/chat',
          },
          {
            tag: 'Feature 02',
            title: 'The Pitch Dojo',
            description: 'Deliver your pitch live to an AI investor persona. Three parallel agents analyze your transcript, vocal confidence, and visual presence simultaneously.',
            cta: hasManifest ? 'Start pitching' : 'Complete your manifest first',
            status: hasManifest ? 'available' as const : 'soon' as const,
            route: '/pitch-dojo',
          },
        ].map(f => (
          <div key={f.tag} className={`home-card${f.status === 'soon' ? ' home-card-dim' : ''}`}>
            <div className="home-card-top">
              {f.status === 'soon' && <div className="home-card-badge">{f.tag === 'Feature 02' ? 'Finish your manifest' : 'Coming soon'}</div>}
            </div>
            <div className="home-card-title">{f.title}</div>
            <div className="home-card-desc">{f.description}</div>
            <button
              className={`home-card-btn${f.status === 'soon' ? ' home-card-btn-dim' : ''}`}
              onClick={f.status === 'available' ? () => navigate(f.route) : undefined}
              disabled={f.status === 'soon'}
            >
              {f.cta}
              {f.status === 'available' && <span className="home-card-arrow">→</span>}
            </button>
          </div>
        ))}
      </section>

    </div>
  )
}

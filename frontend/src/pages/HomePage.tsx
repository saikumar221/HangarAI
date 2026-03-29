import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { logout } from '../api/auth'
import { getUserManifest } from '../api/brainstorm'
import AppNav from '../components/AppNav'

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export default function HomePage() {
  const navigate = useNavigate()
  const user = useUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hasManifest, setHasManifest] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getUserManifest()
      .then(() => setHasManifest(true))
      .catch(() => setHasManifest(false))
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = user ? getInitials(user.first_name, user.last_name) : '?'
  const displayName = user ? user.first_name : 'there'
  const fullName = user ? `${user.first_name} ${user.last_name}` : ''

  return (
    <div className="home">

      {/* Top nav */}
      <nav className="home-nav">
        <Link to="/home" className="home-logo">Hangar<span>AI</span></Link>
        <div className="home-nav-right">
          <AppNav />
          <div className="avatar-wrap" ref={menuRef}>
            <div
              className="home-avatar"
              onClick={() => setMenuOpen(prev => !prev)}
              title={fullName}
            >
              {initials}
            </div>
            {menuOpen && (
              <div className="avatar-menu">
                <div className="avatar-menu-user">
                  <div className="avatar-menu-name">{fullName}</div>
                  <div className="avatar-menu-email">{user?.email}</div>
                </div>
                <div className="avatar-menu-divider" />
                <button className="avatar-menu-logout" onClick={handleLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
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

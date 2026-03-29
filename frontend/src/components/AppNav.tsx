import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getUserManifest } from '../api/brainstorm'
import { useUser } from '../hooks/useUser'
import { logout } from '../api/auth'

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export default function AppNav() {
  const loc = useLocation()
  const navigate = useNavigate()
  const user = useUser()
  const [hasManifest, setHasManifest] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getUserManifest()
      .then(() => setHasManifest(true))
      .catch(() => setHasManifest(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const initials = user ? getInitials(user.first_name, user.last_name) : '?'
  const fullName = user ? `${user.first_name} ${user.last_name}` : ''

  const NAV_ITEMS = [
    { label: 'Pitch', path: '/pitch-dojo', disabled: !hasManifest },
    { label: 'Chat', path: '/chat', disabled: false },
    { label: 'Manifest', path: '/manifest', disabled: false },
  ]

  return (
    <>
      <nav className="app-nav">
        {NAV_ITEMS.map(item =>
          item.disabled ? (
            <span key={item.path} className="app-nav-item app-nav-item-disabled">
              {item.label}
            </span>
          ) : (
            <Link
              key={item.path}
              to={item.path}
              className={`app-nav-item${loc.pathname === item.path ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          )
        )}
      </nav>

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
    </>
  )
}

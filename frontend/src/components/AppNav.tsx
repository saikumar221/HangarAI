import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getUserManifest } from '../api/brainstorm'

export default function AppNav() {
  const loc = useLocation()
  const [hasManifest, setHasManifest] = useState(false)

  useEffect(() => {
    getUserManifest()
      .then(() => setHasManifest(true))
      .catch(() => setHasManifest(false))
  }, [])

  const NAV_ITEMS = [
    { label: 'Pitch', path: '/pitch-dojo', disabled: !hasManifest },
    { label: 'Chat', path: '/chat', disabled: false },
    { label: 'Manifest', path: '/manifest', disabled: false },
  ]

  return (
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
  )
}

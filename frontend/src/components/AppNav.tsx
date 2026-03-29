import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Chat', path: '/chat', disabled: false },
  { label: 'Pitch', path: '/pitch-dojo', disabled: true },
]

export default function AppNav() {
  const loc = useLocation()

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

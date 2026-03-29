import { Link, useLocation } from 'react-router-dom'
import type { SessionRecord } from '../types/brainstorm'

interface Props {
  sessions: SessionRecord[]
  activeSessionId: string | null
  onNewSession: () => void
  onSelectSession: (id: string) => void
}

export default function Sidebar({ sessions, activeSessionId, onNewSession, onSelectSession }: Props) {
  const loc = useLocation()

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="logo">Hangar<span>AI</span></div>
        <button className="new-btn" onClick={onNewSession}>
          <span className="plus">+</span> New session
        </button>
      </div>

      <div className="sidebar-nav">
        <Link to="/" className={`snav-item${loc.pathname === '/' ? ' active' : ''}`}>
          <div className="snav-dot" />
          Brainstorm
        </Link>
        <Link to="/pitch-dojo" className={`snav-item${loc.pathname === '/pitch-dojo' ? ' active' : ''}`}>
          <div className="snav-dot" />
          Pitch Dojo
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sec-label">Sessions</div>
        {sessions.length === 0 ? (
          <div className="sitem-empty">No sessions yet</div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              className={`sitem${s.id === activeSessionId ? ' active' : ''}`}
              onClick={() => onSelectSession(s.id)}
            >
              <div className="sitem-dot" />
              <div className="sitem-text">{s.title}</div>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="user-row">
          <div className="uavatar">JD</div>
          <div className="uname">Jamie D.</div>
        </div>
      </div>
    </aside>
  )
}

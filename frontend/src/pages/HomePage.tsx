import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    tag: 'Feature 01',
    title: 'Idea Finalization',
    description:
      'Work with an AI consultant to pressure-test your startup idea. Surface gaps, identify competitors, and lock in your problem, solution, and target customer.',
    cta: 'Start brainstorming',
    status: 'available' as const,
  },
  {
    tag: 'Feature 02',
    title: 'The Pitch Dojo',
    description:
      'Deliver your pitch live to an AI investor persona. Three parallel agents analyze your transcript, vocal confidence, and visual presence simultaneously.',
    cta: 'Coming soon',
    status: 'soon' as const,
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home">

      {/* Top nav */}
      <nav className="home-nav">
        <div className="home-logo">Hangar<span>AI</span></div>
        <div className="home-nav-right">
          <div className="home-nav-link">Sessions</div>
          <div className="home-avatar">JD</div>
        </div>
      </nav>

      {/* Header */}
      <header className="home-header">
        <div className="home-greeting">Good morning, Jamie.</div>
        <h1 className="home-title">What are we building today?</h1>
      </header>

      {/* Feature cards */}
      <section className="home-cards">
        {FEATURES.map(f => (
          <div key={f.tag} className={`home-card${f.status === 'soon' ? ' home-card-dim' : ''}`}>
            <div className="home-card-top">
              <div className="home-card-tag">{f.tag}</div>
              {f.status === 'soon' && <div className="home-card-badge">Coming soon</div>}
            </div>
            <div className="home-card-title">{f.title}</div>
            <div className="home-card-desc">{f.description}</div>
            <button
              className={`home-card-btn${f.status === 'soon' ? ' home-card-btn-dim' : ''}`}
              onClick={f.status === 'available' ? () => navigate('/chat') : undefined}
              disabled={f.status === 'soon'}
            >
              {f.cta}
              {f.status === 'available' && <span className="home-card-arrow">→</span>}
            </button>
          </div>
        ))}
      </section>

      {/* Divider */}
      <div className="home-rule" />

      {/* Recent activity placeholder */}
      <section className="home-activity">
        <div className="home-section-label">Recent sessions</div>
        <div className="home-activity-empty">
          No sessions yet. Start your first brainstorm above.
        </div>
      </section>

    </div>
  )
}

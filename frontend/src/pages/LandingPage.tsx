import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    number: '01',
    title: 'Idea Finalization',
    body: 'A consultant agent challenges your assumptions, surfaces competitors, and pushes you to articulate the real problem — until your idea is airtight.',
  },
  {
    number: '02',
    title: 'The Pitch Dojo',
    body: 'Deliver your pitch live to an AI investor persona. Three parallel agents analyze your transcript, vocal confidence, and visual presence in real time.',
  },
  {
    number: '03',
    title: 'Post-Pitch Report',
    body: "Receive a timestamped breakdown of strengths, weaknesses, and a Pre-Seed Readiness Score — delivered in your chosen investor's voice.",
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing">

      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-logo">Hangar<span>AI</span></div>
        <div className="landing-nav-right">
          <button className="nav-link" onClick={() => navigate('/home')}>Log in</button>
          <button className="nav-cta" onClick={() => navigate('/home')}>Sign up</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-eyebrow">Founder Intelligence Platform</div>
        <h1 className="landing-headline">
          Where ideas get built<br />before they fly.
        </h1>
        <p className="landing-sub">
          From raw brainstorm to investor-ready pitch — HangarAI is the structured path
          that turns founder intuition into something fundable.
        </p>
        <div className="landing-hero-actions">
          <button className="hero-btn-primary" onClick={() => navigate('/home')}>Start for free</button>
          <button className="hero-btn-ghost">See how it works</button>
        </div>
      </section>

      {/* Divider */}
      <div className="landing-rule" />

      {/* Features */}
      <section className="landing-features">
        <div className="features-label">The process</div>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div key={f.number} className="feature-card">
              <div className="feature-num">{f.number}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-body">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="landing-rule" />

      {/* CTA strip */}
      <section className="landing-cta-strip">
        <div className="cta-strip-left">
          <div className="cta-strip-headline">Ready to stress-test your idea?</div>
          <div className="cta-strip-sub">No pitch deck needed. Just start talking.</div>
        </div>
        <button className="hero-btn-primary" onClick={() => navigate('/home')}>Get started</button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-logo">Hangar<span>AI</span></div>
        <div className="footer-copy">© 2026 HangarAI. All rights reserved.</div>
      </footer>

    </div>
  )
}

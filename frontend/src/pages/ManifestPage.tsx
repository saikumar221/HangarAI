import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getManifest, getUserManifest } from '../api/brainstorm'
import type { ApiManifest } from '../api/brainstorm'
import AppNav from '../components/AppNav'

export default function ManifestPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [manifest, setManifest] = useState<ApiManifest | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = sessionId ? getManifest(sessionId) : getUserManifest()
    fetch
      .then(setManifest)
      .catch((err: Error) => {
        if (err.message === '404') setNotFound(true)
        else setError('Could not load manifest.')
      })
  }, [sessionId])

  return (
    <div className="manifest-page">
      <nav className="home-nav">
        <Link to="/home" className="home-logo">Hangar<span>AI</span></Link>
        <div className="home-nav-right">
          <AppNav />
        </div>
      </nav>

      <main className="manifest-main">
        {error && (
          <div className="manifest-error">{error}</div>
        )}

        {notFound && (
          <div className="manifest-empty">
            <div className="manifest-eyebrow">Startup Manifest</div>
            <p className="manifest-empty-text">No manifest yet. Finish a brainstorm session to generate one.</p>
            <button className="manifest-back-btn" onClick={() => navigate('/chat')}>
              Start brainstorming →
            </button>
          </div>
        )}

        {!manifest && !error && !notFound && (
          <div className="manifest-loading">Loading manifest…</div>
        )}

        {manifest && (
          <>
            <div className="manifest-header">
              <div className="manifest-eyebrow">Startup Manifest</div>
              <h1 className="manifest-headline">{manifest.one_liner ?? 'Your Startup Idea'}</h1>
              <button className="manifest-back-btn" onClick={() => navigate('/chat')}>
                ← Back to chat
              </button>
            </div>

            <div className="manifest-grid">
              {manifest.problem && (
                <ManifestSection label="Problem" body={manifest.problem} />
              )}
              {manifest.solution && (
                <ManifestSection label="Solution" body={manifest.solution} />
              )}
              {manifest.market_size && (
                <ManifestSection label="Market Size" body={manifest.market_size} />
              )}
            </div>

            {((manifest.competitors?.length ?? 0) > 0 ||
              (manifest.differentiators?.length ?? 0) > 0 ||
              (manifest.key_assumptions?.length ?? 0) > 0) && (
              <div className="manifest-lists">
                {manifest.competitors && manifest.competitors.length > 0 && (
                  <ManifestList label="Competitors" items={manifest.competitors} />
                )}
                {manifest.differentiators && manifest.differentiators.length > 0 && (
                  <ManifestList label="Differentiators" items={manifest.differentiators} />
                )}
                {manifest.key_assumptions && manifest.key_assumptions.length > 0 && (
                  <ManifestList label="Key Assumptions" items={manifest.key_assumptions} flag />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function ManifestSection({ label, body }: { label: string; body: string }) {
  return (
    <div className="manifest-section">
      <div className="manifest-section-label">{label}</div>
      <div className="manifest-section-body">{body}</div>
    </div>
  )
}

function ManifestList({ label, items, flag }: { label: string; items: string[]; flag?: boolean }) {
  return (
    <div className="manifest-list-block">
      <div className="manifest-section-label">{label}</div>
      <ul className="manifest-list">
        {items.map((item, i) => (
          <li key={i} className={`manifest-list-item${flag ? ' manifest-list-item-flag' : ''}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

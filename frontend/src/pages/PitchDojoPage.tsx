import { useState } from 'react'
import { Link } from 'react-router-dom'

const MANIFEST = {
  one_liner: 'Hangar turns raw startup ideas into investor-ready pitches using AI',
  problem: 'Founders walk into investor meetings underprepared — the pitch feedback loop is broken',
  solution: 'A modular AI factory that stress-tests your idea, then simulates a live pitch with an investor persona',
  target_customer: 'Early-stage founders (pre-seed to Series A)',
  market_size: '$4.5B founder prep market',
}

interface InvestorForm {
  firstName: string
  lastName: string
  company: string
  linkedin: string
  notes: string
}

export default function PitchDojoPage() {
  const [form, setForm] = useState<InvestorForm>({
    firstName: '',
    lastName: '',
    company: '',
    linkedin: '',
    notes: '',
  })
  const [pitchActive, setPitchActive] = useState(false)

  const canStart =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.company.trim().length > 0

  function update(field: keyof InvestorForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (pitchActive) {
    return (
      <div className="call-root">
        <div className="call-header">
          <div className="call-header-left">
            <button className="call-back-btn" onClick={() => setPitchActive(false)}>←</button>
            <div className="call-manifest-title">{MANIFEST.one_liner}</div>
          </div>
          <div className="call-timer">0:00</div>
        </div>

        <div className="call-body">
          <div className="call-video-area">
            <div className="call-video-placeholder">
              <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="22" height="18" rx="3" stroke="#2A2820" strokeWidth="1.5"/>
                <path d="M23 8l10-6v18l-10-6V8z" stroke="#2A2820" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <div className="call-video-label">Camera connecting...</div>
            </div>
          </div>

          <div className="call-investor-card">
            <div className="call-investor-avatar">
              {form.firstName.charAt(0).toUpperCase()}{form.lastName.charAt(0).toUpperCase()}
            </div>
            <div className="call-investor-name">{form.firstName} {form.lastName}</div>
            <div className="call-investor-company">{form.company}</div>
          </div>
        </div>

        <div className="call-transcript">
          <div className="call-transcript-label">Transcript</div>
          <div className="call-transcript-text">Waiting for you to begin your pitch...</div>
        </div>

        <div className="call-controls">
          <button className="ctrl-btn">Mute</button>
          <button className="ctrl-btn">Camera</button>
          <button className="ctrl-btn ctrl-end" onClick={() => setPitchActive(false)}>End Pitch</button>
        </div>
      </div>
    )
  }

  return (
    <div className="hangar-root">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo">Hangar<span>AI</span></div>
        </div>

        <div className="sidebar-nav">
          <Link to="/" className="snav-item">
            <div className="snav-dot" />
            Brainstorm
          </Link>
          <Link to="/pitch-dojo" className="snav-item active">
            <div className="snav-dot" />
            Pitch Dojo
          </Link>
        </div>

        <div className="sidebar-section">
          <div className="sec-label">Pitch Sessions</div>
          <div className="sitem-empty">No sessions yet</div>
        </div>

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="uavatar">JD</div>
            <div className="uname">Jamie D.</div>
          </div>
        </div>
      </aside>

      <div className="pitch-main">
        <div className="chat-header">
          <div className="chat-title">Pitch Dojo</div>
          <div className="header-right">
            <span className="hlink">Idea ready</span>
          </div>
        </div>

        <div className="pitch-content">
          <div className="pitch-manifest-card">
            <div className="pmc-label">Your Startup</div>
            <div className="pmc-oneliner">{MANIFEST.one_liner}</div>
            <div className="pmc-row">
              <div className="pmc-col">
                <div className="pmc-field-label">Problem</div>
                <div className="pmc-field-text">{MANIFEST.problem}</div>
              </div>
              <div className="pmc-col">
                <div className="pmc-field-label">Solution</div>
                <div className="pmc-field-text">{MANIFEST.solution}</div>
              </div>
            </div>
            <div className="pmc-chips">
              <div className="cc-chip flag">{MANIFEST.target_customer}</div>
              <div className="cc-chip">{MANIFEST.market_size}</div>
            </div>
          </div>

          <div className="pitch-form-section">
            <div className="pfs-label">Who are you pitching to?</div>
            <div className="pitch-form">
              <div className="pf-row">
                <div className="pf-field">
                  <label className="pf-label">First name <span className="pf-req">*</span></label>
                  <input
                    className="pf-input"
                    type="text"
                    placeholder="Paul"
                    value={form.firstName}
                    onChange={e => update('firstName', e.target.value)}
                  />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Last name <span className="pf-req">*</span></label>
                  <input
                    className="pf-input"
                    type="text"
                    placeholder="Graham"
                    value={form.lastName}
                    onChange={e => update('lastName', e.target.value)}
                  />
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label">Company <span className="pf-req">*</span></label>
                <input
                  className="pf-input"
                  type="text"
                  placeholder="Y Combinator"
                  value={form.company}
                  onChange={e => update('company', e.target.value)}
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">LinkedIn</label>
                <input
                  className="pf-input"
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                  value={form.linkedin}
                  onChange={e => update('linkedin', e.target.value)}
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">Additional notes</label>
                <textarea
                  className="pf-input pf-textarea"
                  placeholder="e.g. Focus on market size, skeptical of B2C..."
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="pf-footer">
                <span className="pf-hint">* required</span>
                <button
                  className="start-btn"
                  disabled={!canStart}
                  onClick={() => setPitchActive(true)}
                >
                  Start Pitch →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

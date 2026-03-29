import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

const MANIFEST = {
  one_liner: 'Hangar turns raw startup ideas into investor-ready pitches using AI',
  problem: 'Founders walk into investor meetings underprepared — the pitch feedback loop is broken',
  solution: 'A modular AI factory that stress-tests your idea, then simulates a live pitch with an investor persona',
  target_customer: 'Early-stage founders (pre-seed to Series A)',
  market_size: '$4.5B founder prep market',
}

const WS_BASE = 'ws://localhost:8000/pitch/ws'

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
  const [mediaError, setMediaError] = useState<string | null>(null)

  // Stable session ID for the duration of this page visit
  const sessionId = useRef<string>(crypto.randomUUID())
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioWsRef = useRef<WebSocket | null>(null)
  const videoWsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const frameIntervalRef = useRef<number | null>(null)

  // Start / stop media + WebSockets when pitch state toggles
  useEffect(() => {
    if (!pitchActive) return

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // — Audio WebSocket —
        const audioWs = new WebSocket(`${WS_BASE}/${sessionId.current}/audio`)
        audioWsRef.current = audioWs

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'

        const audioStream = new MediaStream(stream.getAudioTracks())
        const recorder = new MediaRecorder(audioStream, { mimeType })
        recorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && audioWs.readyState === WebSocket.OPEN) {
            audioWs.send(e.data)
          }
        }
        recorder.start(3000) // 3-second chunks

        // — Video WebSocket —
        const videoWs = new WebSocket(`${WS_BASE}/${sessionId.current}/video`)
        videoWsRef.current = videoWs

        // Capture 1 JPEG frame per second from the video element
        const videoEl = videoRef.current!
        frameIntervalRef.current = window.setInterval(() => {
          if (!videoEl || videoEl.videoWidth === 0) return
          if (videoWs.readyState !== WebSocket.OPEN) return

          const canvas = document.createElement('canvas')
          canvas.width = videoEl.videoWidth
          canvas.height = videoEl.videoHeight
          canvas.getContext('2d')?.drawImage(videoEl, 0, 0)
          canvas.toBlob(
            (blob) => { if (blob) blob.arrayBuffer().then(buf => videoWs.send(buf)) },
            'image/jpeg',
            0.7
          )
        }, 1000)

      } catch (err) {
        console.error('Failed to start pitch:', err)
        setMediaError('Could not access camera or microphone. Check browser permissions.')
        setPitchActive(false)
      }
    }

    start()

    return () => {
      recorderRef.current?.stop()
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)
      audioWsRef.current?.close()
      videoWsRef.current?.close()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [pitchActive])

  const canStart =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.company.trim().length > 0

  function update(field: keyof InvestorForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ── Active pitch: video call layout ──────────────────────────────────────
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
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="call-video-feed"
            />
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

  // ── Pre-pitch: manifest + investor form ───────────────────────────────────
  return (
    <div className="hangar-root">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo">Hangar<span>AI</span></div>
        </div>

        <div className="sidebar-nav">
          <Link to="/chat" className="snav-item">
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
          {mediaError && (
            <div className="pitch-error">{mediaError}</div>
          )}

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

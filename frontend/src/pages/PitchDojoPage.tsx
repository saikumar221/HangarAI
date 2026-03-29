import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { FaceLandmarkerResult, PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import AppNav from '../components/AppNav'
import { getUserManifest } from '../api/brainstorm'
import type { ApiManifest } from '../api/brainstorm'

const WS_BASE = 'ws://localhost:8000/pitch/ws'

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

interface InvestorForm {
  firstName: string
  lastName: string
  company: string
  linkedin: string
  notes: string
}

export interface InsightSnapshot {
  timestamp: number           // seconds from pitch start
  eye_contact_score: number   // 0-1, gaze direction toward camera
  expression_score: number    // 0-1, facial landmark activity
  posture_score: number       // 0-1, shoulder alignment and symmetry
  head_movement_score: number // 0-1, head pose stability
}

interface FrameMetrics {
  eyeContact: number
  expression: number
  posture: number
  headPos: { x: number; y: number }
}

// ── Pure metric helpers ───────────────────────────────────────────────────────

const EYE_GAZE_NAMES = [
  'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
]

const EXPRESSION_NAMES = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'jawOpen', 'mouthSmileLeft', 'mouthSmileRight',
  'mouthFrownLeft', 'mouthFrownRight', 'mouthPucker', 'mouthFunnel',
]

function computeEyeContact(result: FaceLandmarkerResult): number {
  const cats = result.faceBlendshapes?.[0]?.categories
  if (!cats) return 0.5
  const deflection =
    EYE_GAZE_NAMES.reduce((sum, name) => {
      return sum + (cats.find(c => c.categoryName === name)?.score ?? 0)
    }, 0) / EYE_GAZE_NAMES.length
  return Math.max(0, Math.min(1, 1 - deflection * 4))
}

function computeExpression(result: FaceLandmarkerResult): number {
  const cats = result.faceBlendshapes?.[0]?.categories
  if (!cats) return 0
  const activity =
    EXPRESSION_NAMES.reduce((sum, name) => {
      return sum + (cats.find(c => c.categoryName === name)?.score ?? 0)
    }, 0) / EXPRESSION_NAMES.length
  return Math.min(1, activity * 6)
}

function computePosture(result: PoseLandmarkerResult): number {
  const lm = result.landmarks?.[0]
  if (!lm) return 0.5
  const ls = lm[11] // left shoulder
  const rs = lm[12] // right shoulder
  if (!ls || !rs) return 0.5
  const symmetry = Math.max(0, 1 - Math.abs(ls.y - rs.y) * 8)
  const vis = ((ls.visibility ?? 0) + (rs.visibility ?? 0)) / 2
  return Math.min(1, symmetry * 0.6 + Math.min(1, vis) * 0.4)
}

function getNoseTip(result: FaceLandmarkerResult): { x: number; y: number } | null {
  const lm = result.faceLandmarks?.[0]
  if (!lm || lm.length < 2) return null
  return { x: lm[1].x, y: lm[1].y }
}

function computeHeadStability(positions: { x: number; y: number }[]): number {
  if (positions.length < 2) return 1
  const mx = positions.reduce((s, p) => s + p.x, 0) / positions.length
  const my = positions.reduce((s, p) => s + p.y, 0) / positions.length
  const variance =
    positions.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0) / positions.length
  return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 15))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PitchDojoPage() {
  const navigate = useNavigate()
  const [manifest, setManifest] = useState<ApiManifest | null>(null)
  const [form, setForm] = useState<InvestorForm>({
    firstName: '',
    lastName: '',
    company: '',
    linkedin: '',
    notes: '',
  })
  const [pitchActive, setPitchActive] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [, setSnapshots] = useState<InsightSnapshot[]>([])

  useEffect(() => {
    getUserManifest()
      .then(setManifest)
      .catch(() => navigate('/manifest'))
  }, [])

  // Stable session ID for the duration of this page visit
  const sessionId = useRef<string>(crypto.randomUUID())
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioWsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)

  // MediaPipe refs
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef<number | null>(null)
  const pitchStartRef = useRef<number>(0)
  const lastSnapshotRef = useRef<number>(0)
  const frameBuffer = useRef<FrameMetrics[]>([])
  const snapshotsRef = useRef<InsightSnapshot[]>([])

  // Close landmarkers when the component unmounts
  useEffect(() => {
    return () => {
      faceLandmarkerRef.current?.close()
      poseLandmarkerRef.current?.close()
    }
  }, [])

  async function initMediaPipe() {
    // Reuse across pitch sessions — only load once
    if (faceLandmarkerRef.current && poseLandmarkerRef.current) return
    const vision = await FilesetResolver.forVisionTasks(VISION_WASM)
    const [face, pose] = await Promise.all([
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      }),
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      }),
    ])
    faceLandmarkerRef.current = face
    poseLandmarkerRef.current = pose
  }

  // RAF loop — runs silently alongside the live video feed
  function runDetection() {
    const videoEl = videoRef.current
    if (!videoEl || videoEl.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetection)
      return
    }

    const now = performance.now()
    const faceResult = faceLandmarkerRef.current?.detectForVideo(videoEl, now)
    const poseResult = poseLandmarkerRef.current?.detectForVideo(videoEl, now)

    const hasFace = !!faceResult && faceResult.faceLandmarks.length > 0
    const hasPose = !!poseResult && poseResult.landmarks.length > 0

    if (hasFace || hasPose) {
      const noseTip = hasFace ? getNoseTip(faceResult!) : null
      frameBuffer.current.push({
        eyeContact: hasFace ? computeEyeContact(faceResult!) : 0.5,
        expression: hasFace ? computeExpression(faceResult!) : 0,
        posture: hasPose ? computePosture(poseResult!) : 0.5,
        headPos: noseTip ?? { x: 0.5, y: 0.5 },
      })
    }

    // Every 2 seconds flush the buffer into a snapshot
    const elapsedSec = (now - pitchStartRef.current) / 1000
    if (elapsedSec - lastSnapshotRef.current >= 2 && frameBuffer.current.length > 0) {
      const frames = frameBuffer.current
      const avg = (key: keyof Omit<FrameMetrics, 'headPos'>) =>
        frames.reduce((s, f) => s + f[key], 0) / frames.length

      const snapshot: InsightSnapshot = {
        timestamp: Math.round(elapsedSec),
        eye_contact_score: +avg('eyeContact').toFixed(3),
        expression_score: +avg('expression').toFixed(3),
        posture_score: +avg('posture').toFixed(3),
        head_movement_score: +computeHeadStability(frames.map(f => f.headPos)).toFixed(3),
      }

      snapshotsRef.current = [...snapshotsRef.current, snapshot]
      setSnapshots(snapshotsRef.current)
      console.log(`[MediaPipe] snapshot #${snapshotsRef.current.length} at ${snapshot.timestamp}s`, snapshot)
      frameBuffer.current = []
      lastSnapshotRef.current = elapsedSec
    }

    rafRef.current = requestAnimationFrame(runDetection)
  }

  function getMediaPipeResults(): InsightSnapshot[] {
    return snapshotsRef.current
  }

  // Start / stop media + WebSockets when pitch state toggles
  useEffect(() => {
    if (!pitchActive) return

    async function start() {
      try {
        // Load models and camera in parallel
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ audio: true, video: true }),
          initMediaPipe(),
        ])
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
        recorder.start(2000) // 2 s chunks — header (2s) + chunk (2s) = 4s, under Hume's 5s limit

        // — MediaPipe RAF loop —
        pitchStartRef.current = performance.now()
        lastSnapshotRef.current = 0
        frameBuffer.current = []
        snapshotsRef.current = []
        setSnapshots([])
        rafRef.current = requestAnimationFrame(runDetection)

      } catch (err) {
        console.error('Failed to start pitch:', err)
        setMediaError('Could not access camera or microphone. Check browser permissions.')
        setPitchActive(false)
      }
    }

    start()

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())

      // Close the WebSocket only after the recorder flushes its final chunk.
      // onstop fires after ondataavailable, so the last audio chunk reaches
      // the backend before the connection closes.
      const ws = audioWsRef.current
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => ws?.close()
        recorder.stop()
      } else {
        ws?.close()
      }
    }
  }, [pitchActive])

  async function endPitch() {
    const results = getMediaPipeResults()
    console.log(`[endPitch] snapshots collected: ${results.length}`, results)
    console.log(`[endPitch] faceLandmarker ready: ${!!faceLandmarkerRef.current}, poseLandmarker ready: ${!!poseLandmarkerRef.current}`)
    console.log(`[endPitch] frameBuffer size at end: ${frameBuffer.current.length}`)

    if (results.length === 0) {
      console.warn('[endPitch] No snapshots — pitch may have been under 5 s or no face/pose was detected. Skipping API call.')
    } else {
      try {
        console.log(`[endPitch] POST /pitch/sessions/${sessionId.current}/video-analysis`)
        const res = await fetch(`http://localhost:8000/pitch/sessions/${sessionId.current}/video-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(results),
        })
        console.log(`[endPitch] response status: ${res.status}`, await res.json())
      } catch (err) {
        console.error('[endPitch] fetch failed:', err)
      }
    }
    setPitchActive(false)
  }

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
            <button className="call-back-btn" onClick={endPitch}>←</button>
            <div className="call-manifest-title">{manifest?.one_liner}</div>
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
          <button className="ctrl-btn ctrl-end" onClick={endPitch}>End Pitch</button>
        </div>
      </div>
    )
  }

  // ── Pre-pitch: manifest + investor form ───────────────────────────────────
  return (
    <div className="pitch-page">
      <nav className="home-nav">
        <Link to="/home" className="home-logo">Hangar<span>AI</span></Link>
        <div className="home-nav-right">
          <AppNav />
        </div>
      </nav>

      <div className="pitch-body">
        <aside className="pitch-sidebar">
          <div className="sec-label">Pitch Sessions</div>
          <div className="sitem-empty">No sessions yet</div>
        </aside>

        <div className="pitch-content">
          {mediaError && (
            <div className="pitch-error">{mediaError}</div>
          )}

          <div className="pitch-manifest-card">
            <div className="pmc-label">Your Startup</div>
            <div className="pmc-oneliner">{manifest?.one_liner}</div>
            <div className="pmc-row">
              <div className="pmc-col">
                <div className="pmc-field-label">Problem</div>
                <div className="pmc-field-text">{manifest?.problem}</div>
              </div>
              <div className="pmc-col">
                <div className="pmc-field-label">Solution</div>
                <div className="pmc-field-text">{manifest?.solution}</div>
              </div>
            </div>
            <div className="pmc-chips">
              <div className="cc-chip">{manifest?.market_size}</div>
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

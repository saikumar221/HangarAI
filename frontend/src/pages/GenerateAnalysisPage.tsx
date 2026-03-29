import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppNav from '../components/AppNav'
import { generateAnalysis, type AnalysisReport } from '../api/pitch'

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#fbf7f0',
  surface: '#F3F2EF',
  border: '#E2E1DE',
  borderS: '#D0CFCC',
  text1: '#0A0908',
  text2: '#3A3938',
  text3: '#6A6968',
  text4: '#9A9998',
  blue: '#0b1370',
  green: '#14532d',
  greenBg: '#f0fdf4',
  red: '#7f1d1d',
  redBg: '#fef2f2',
  amber: '#78350f',
  amberBg: '#fffbeb',
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Critical: { bg: '#fef2f2', text: '#7f1d1d', dot: '#dc2626' },
  High:     { bg: '#fff7ed', text: '#7c2d12', dot: '#ea580c' },
  Medium:   { bg: '#fffbeb', text: '#78350f', dot: '#d97706' },
  Low:      { bg: '#f0fdf4', text: '#14532d', dot: '#16a34a' },
}

const GO_COLORS: Record<string, { bg: string; text: string }> = {
  'Strong Pass':    { bg: '#fef2f2', text: '#dc2626' },
  'Pass':           { bg: '#fff7ed', text: '#ea580c' },
  'Considering':    { bg: '#fffbeb', text: '#d97706' },
  'Interested':     { bg: '#f0fdf4', text: '#16a34a' },
  'Strong Interest':{ bg: '#eff6ff', text: '#1d4ed8' },
}

// ── Confidence Graph (SVG) ───────────────────────────────────────────────────

type GraphPoint = AnalysisReport['confidence_graph'][number]

function ConfidenceGraph({ data }: { data: GraphPoint[] }) {
  const W = 720
  const H = 180
  const PAD = { top: 16, right: 24, bottom: 32, left: 40 }
  const [hovered, setHovered] = useState<GraphPoint | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (data.length === 0) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text4, fontSize: 13 }}>
        No video data captured.
      </div>
    )
  }

  const maxTs = Math.max(...data.map(d => d.timestamp))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xOf = (ts: number) => PAD.left + (ts / (maxTs || 1)) * innerW
  const yOf = (v: number)  => PAD.top + (1 - v) * innerH

  // Build SVG path
  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(d.timestamp).toFixed(1)},${yOf(d.confidence_score).toFixed(1)}`)
    .join(' ')

  // Area fill path
  const areaD =
    pathD +
    ` L${xOf(maxTs).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`

  const EMOTION_COLORS: Record<string, string> = {
    Enthusiasm: '#f97316', Excitement: '#ec4899', Determination: '#0b1370',
    Pride: '#7c3aed', Triumph: '#059669', Interest: '#0891b2',
    Anxiety: '#dc2626', Fear: '#dc2626', Distress: '#dc2626',
    Doubt: '#d97706', Calmness: '#16a34a', Concentration: '#2563eb',
  }
  const emotionColor = (e: string | null) => e ? (EMOTION_COLORS[e] ?? C.text3) : C.text4

  // Y-axis grid lines at 0.25, 0.5, 0.75, 1.0
  const gridLines = [0, 0.25, 0.5, 0.75, 1.0]

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', maxWidth: W, display: 'block' }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid lines */}
        {gridLines.map(v => (
          <g key={v}>
            <line
              x1={PAD.left} y1={yOf(v)}
              x2={PAD.left + innerW} y2={yOf(v)}
              stroke={C.border} strokeWidth={0.5}
            />
            <text x={PAD.left - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill={C.text4}>
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X-axis time labels */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0).map(d => (
          <text key={d.timestamp} x={xOf(d.timestamp)} y={H - 6} textAnchor="middle" fontSize={10} fill={C.text4}>
            {d.timestamp.toFixed(0)}s
          </text>
        ))}

        {/* Area fill */}
        <path d={areaD} fill={C.blue} fillOpacity={0.06} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={C.blue} strokeWidth={1.5} strokeLinejoin="round" />

        {/* Data points */}
        {data.map(d => (
          <circle
            key={d.timestamp}
            cx={xOf(d.timestamp)}
            cy={yOf(d.confidence_score)}
            r={4}
            fill={emotionColor(d.dominant_emotion)}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(d)}
          />
        ))}
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          top: yOf(hovered.confidence_score) - 72,
          left: `calc(${((xOf(hovered.timestamp) - PAD.left) / (W - PAD.left - PAD.right)) * 100}% + ${PAD.left}px)`,
          transform: 'translateX(-50%)',
          background: C.text1,
          color: 'white',
          padding: '6px 10px',
          borderRadius: 4,
          fontSize: 11,
          lineHeight: 1.5,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 500 }}>{hovered.timestamp.toFixed(1)}s — {(hovered.confidence_score * 100).toFixed(0)}%</div>
          {hovered.dominant_emotion && (
            <div style={{ color: '#cbd5e1' }}>{hovered.dominant_emotion}</div>
          )}
        </div>
      )}

      {/* Emotion legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 12 }}>
        {Array.from(new Set(data.map(d => d.dominant_emotion).filter(Boolean))).map(e => (
          <span key={e} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.text3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: emotionColor(e!), display: 'inline-block' }} />
            {e}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const R = 48
  const circ = 2 * Math.PI * R
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#16a34a' : score >= 45 ? '#d97706' : '#dc2626'

  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      <circle cx={60} cy={60} r={R} fill="none" stroke={C.border} strokeWidth={8} />
      <circle
        cx={60} cy={60} r={R} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={60} y={56} textAnchor="middle" fontSize={26} fontWeight={300} fill={C.text1} fontFamily="Inter, sans-serif">
        {score}
      </text>
      <text x={60} y={72} textAnchor="middle" fontSize={10} fill={C.text4} fontFamily="Inter, sans-serif">
        / 100
      </text>
    </svg>
  )
}

// ── Loading State ────────────────────────────────────────────────────────────

function LoadingView() {
  const [phase, setPhase] = useState(0)
  const phases = [
    { label: 'Audio Agent', sub: 'Analyzing vocal emotion timeline with Gemini' },
    { label: 'Video Agent', sub: 'Analyzing visual presence metrics with Gemini' },
    { label: 'Synthesis Engine', sub: 'Fusing signals into comprehensive report' },
  ]

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 4000)
    const t2 = setTimeout(() => setPhase(2), 9000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 40, padding: 40 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.text4, marginBottom: 12 }}>
          Multi-Agent Analysis
        </div>
        <div style={{ fontSize: 28, fontWeight: 300, color: C.text1, letterSpacing: '-0.02em' }}>
          Processing your pitch
        </div>
        <div style={{ fontSize: 14, color: C.text3, marginTop: 8 }}>
          Agents are running in parallel — this takes 20–40 seconds
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {phases.map((p, i) => {
          const state = i < phase ? 'done' : i === phase ? 'running' : 'waiting'
          return (
            <div key={p.label} style={{
              width: 196,
              padding: '18px 20px',
              background: state === 'done' ? C.greenBg : state === 'running' ? '#eff6ff' : C.surface,
              border: `0.5px solid ${state === 'done' ? '#bbf7d0' : state === 'running' ? '#bfdbfe' : C.border}`,
              borderRadius: 8,
              transition: 'all 0.4s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {state === 'done' ? (
                  <span style={{ color: '#16a34a', fontSize: 14 }}>✓</span>
                ) : state === 'running' ? (
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: C.blue, animation: 'pulse 1.2s ease-in-out infinite' }} />
                ) : (
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: C.border }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 400, color: state === 'waiting' ? C.text4 : C.text1 }}>
                  {p.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.4 }}>{p.sub}</div>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function GenerateAnalysisPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'roadmap' | 'audio' | 'video'>('roadmap')
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!sessionId || hasFetched.current) return
    hasFetched.current = true
    generateAnalysis(sessionId)
      .then(data => { setReport(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [sessionId])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 56,
        borderBottom: `0.5px solid ${C.border}`, flexShrink: 0,
      }}>
        <Link to="/home" style={{ fontSize: 16, fontWeight: 400, color: C.text1, textDecoration: 'none', letterSpacing: '0.02em' }}>
          Hangar<span style={{ color: C.blue, fontWeight: 300 }}>AI</span>
        </Link>
        <AppNav />
      </nav>

      {/* Content */}
      {loading ? (
        <LoadingView />
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
          <div style={{ fontSize: 14, color: '#dc2626' }}>Analysis failed: {error}</div>
          <Link to="/pitch-dojo" style={{ fontSize: 13, color: C.blue, textDecoration: 'none' }}>← Try again</Link>
        </div>
      ) : report ? (
        <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', padding: '40px 24px 80px' }}>

          {/* ── Header ────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.text4, marginBottom: 10 }}>
              Pitch Analysis Report
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 300, color: C.text1, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {report.investor_name}
            </h1>
            <div style={{ fontSize: 14, color: C.text3 }}>{report.investor_company}</div>
          </div>

          {/* ── Verdict ───────────────────────────────────────────────── */}
          <section style={{
            background: C.surface, border: `0.5px solid ${C.border}`,
            borderRadius: 10, padding: '32px 36px', marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
              {/* Score ring */}
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <ScoreRing score={report.verdict.pre_seed_readiness_score} />
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text4, marginTop: 6 }}>
                  Pre-Seed Readiness
                </div>
              </div>

              {/* Right side */}
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 400, color: C.text1 }}>The Verdict</div>
                  {report.verdict.go_decision && (() => {
                    const gc = GO_COLORS[report.verdict.go_decision] ?? { bg: C.surface, text: C.text2 }
                    return (
                      <span style={{
                        fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
                        background: gc.bg, color: gc.text,
                        padding: '3px 10px', borderRadius: 100,
                        border: `0.5px solid ${gc.text}30`,
                      }}>
                        {report.verdict.go_decision.toUpperCase()}
                      </span>
                    )
                  })()}
                </div>

                {/* Investor persona summary */}
                <div style={{
                  fontSize: 13, color: C.text2, lineHeight: 1.7,
                  borderLeft: `2px solid ${C.blue}`, paddingLeft: 16,
                  marginBottom: 20, fontStyle: 'italic',
                }}>
                  {report.verdict.investor_persona_summary}
                </div>

                {/* Strengths + Weaknesses */}
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.green, marginBottom: 8 }}>
                      Strengths
                    </div>
                    {report.verdict.strengths.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, color: C.text2 }}>
                        <span style={{ color: '#16a34a', flexShrink: 0 }}>✓</span>
                        {s}
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 8 }}>
                      Critical Weaknesses
                    </div>
                    {report.verdict.critical_weaknesses.map((w, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, color: C.text2 }}>
                        <span style={{ color: '#dc2626', flexShrink: 0 }}>✗</span>
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Confidence Graph ──────────────────────────────────────── */}
          <section style={{
            background: C.surface, border: `0.5px solid ${C.border}`,
            borderRadius: 10, padding: '28px 32px', marginBottom: 28,
          }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 400, color: C.text1, marginBottom: 4 }}>
                Confidence Timeline
              </div>
              <div style={{ fontSize: 12, color: C.text4 }}>
                Composite score fused from visual presence + vocal emotion signals. Hover a point to inspect.
              </div>
            </div>
            <ConfidenceGraph data={report.confidence_graph} />
          </section>

          {/* ── Tabs: Roadmap / Audio / Video ─────────────────────────── */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: `0.5px solid ${C.border}` }}>
            {(['roadmap', 'audio', 'video'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: 'transparent', border: 'none',
                borderBottom: activeTab === tab ? `1.5px solid ${C.blue}` : '1.5px solid transparent',
                padding: '10px 20px',
                fontSize: 13, fontWeight: activeTab === tab ? 400 : 300,
                color: activeTab === tab ? C.blue : C.text3,
                cursor: 'pointer', letterSpacing: '0.01em',
                fontFamily: 'Inter, sans-serif',
                transition: 'color 0.15s ease',
                marginBottom: -0.5,
              }}>
                {tab === 'roadmap' ? 'Improvement Roadmap' : tab === 'audio' ? 'Vocal Analysis' : 'Visual Analysis'}
              </button>
            ))}
          </div>

          {/* ── Roadmap Tab ───────────────────────────────────────────── */}
          {activeTab === 'roadmap' && (
            <div style={{ paddingTop: 24 }}>
              {(['Critical', 'High', 'Medium', 'Low'] as const).map(priority => {
                const items = report.improvement_roadmap.filter(r => r.priority === priority)
                if (items.length === 0) return null
                const pc = PRIORITY_COLORS[priority]
                return (
                  <div key={priority} style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: pc.dot, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: pc.text, fontWeight: 500 }}>
                        {priority}
                      </span>
                      <span style={{ fontSize: 11, color: C.text4 }}>({items.length})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{
                          background: pc.bg, border: `0.5px solid ${pc.dot}30`,
                          borderRadius: 8, padding: '16px 18px',
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: pc.text, letterSpacing: '0.04em', marginBottom: 8 }}>
                            {item.section}
                          </div>
                          <div style={{ fontSize: 12, color: C.text2, marginBottom: 10, lineHeight: 1.5 }}>
                            {item.issue}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 12, color: pc.dot, flexShrink: 0, marginTop: 1 }}>→</span>
                            <span style={{ fontSize: 12, color: C.text1, lineHeight: 1.5 }}>{item.suggestion}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Audio Tab ─────────────────────────────────────────────── */}
          {activeTab === 'audio' && (
            <div style={{ paddingTop: 24 }}>
              {/* Score row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                {[
                  { label: 'Vocal Confidence', value: report.audio_insights.vocal_confidence_score },
                  { label: 'Pacing', value: report.audio_insights.pacing_score },
                  { label: 'Trend', value: report.audio_insights.confidence_trend, isText: true },
                ].map(m => (
                  <div key={m.label} style={{
                    flex: '1 1 160px', background: C.surface,
                    border: `0.5px solid ${C.border}`, borderRadius: 8, padding: '16px 20px',
                  }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text4, marginBottom: 6 }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 300, color: C.text1 }}>
                      {m.isText ? m.value : `${m.value}`}
                    </div>
                    {!m.isText && <div style={{ fontSize: 11, color: C.text4 }}>/ 100</div>}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div style={{
                background: C.surface, border: `0.5px solid ${C.border}`,
                borderRadius: 8, padding: '18px 22px', marginBottom: 24, fontSize: 13, color: C.text2, lineHeight: 1.7,
              }}>
                {report.audio_insights.vocal_summary}
              </div>

              {/* Patterns */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.text4, marginBottom: 10 }}>
                  Key Vocal Patterns
                </div>
                {report.audio_insights.key_vocal_patterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13, color: C.text2 }}>
                    <span style={{ color: C.blue, flexShrink: 0 }}>·</span>
                    {p}
                  </div>
                ))}
              </div>

              {/* Emotion highlights */}
              {report.audio_insights.emotion_highlights.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.text4, marginBottom: 10 }}>
                    Emotion Highlights
                  </div>
                  {report.audio_insights.emotion_highlights.map((h, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 14, alignItems: 'flex-start',
                      padding: '10px 0', borderBottom: `0.5px solid ${C.border}`,
                    }}>
                      <span style={{ fontSize: 11, color: C.text4, flexShrink: 0, minWidth: 42 }}>
                        {h.timestamp.toFixed(1)}s
                      </span>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 100,
                        background: C.surface, border: `0.5px solid ${C.border}`,
                        color: C.text2, flexShrink: 0,
                      }}>
                        {h.emotion}
                      </span>
                      <span style={{ fontSize: 12, color: C.text3, lineHeight: 1.5 }}>{h.interpretation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Video Tab ─────────────────────────────────────────────── */}
          {activeTab === 'video' && (
            <div style={{ paddingTop: 24 }}>
              {/* Score row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                {[
                  { label: 'Visual Presence', value: report.video_insights.visual_presence_score, isScore: true },
                  { label: 'Avg Eye Contact', value: Math.round(report.video_insights.avg_eye_contact * 100), isScore: true },
                  { label: 'Avg Expression', value: Math.round(report.video_insights.avg_expression * 100), isScore: true },
                  { label: 'Avg Posture', value: Math.round(report.video_insights.avg_posture * 100), isScore: true },
                ].map(m => (
                  <div key={m.label} style={{
                    flex: '1 1 140px', background: C.surface,
                    border: `0.5px solid ${C.border}`, borderRadius: 8, padding: '16px 20px',
                  }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text4, marginBottom: 6 }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 300, color: C.text1 }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: C.text4 }}>/ 100</div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div style={{
                background: C.surface, border: `0.5px solid ${C.border}`,
                borderRadius: 8, padding: '18px 22px', marginBottom: 24, fontSize: 13, color: C.text2, lineHeight: 1.7,
              }}>
                {report.video_insights.visual_summary}
              </div>

              {/* Patterns */}
              <div>
                <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.text4, marginBottom: 10 }}>
                  Key Visual Patterns
                </div>
                {report.video_insights.visual_patterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13, color: C.text2 }}>
                    <span style={{ color: C.blue, flexShrink: 0 }}>·</span>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

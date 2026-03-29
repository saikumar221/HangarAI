import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppNav from '../components/AppNav'

export default function GenerateAnalysisPage() {
  const [result, setResult] = useState<string | null>(null)

  return (
    <div className="pitch-page">
      <nav className="home-nav">
        <Link to="/home" className="home-logo">Hangar<span>AI</span></Link>
        <div className="home-nav-right">
          <AppNav />
        </div>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '24px' }}>
        <button className="start-btn" onClick={() => setResult('{TBD}')}>
          Generate Analysis
        </button>
        {result && <div>{result}</div>}
      </div>
    </div>
  )
}

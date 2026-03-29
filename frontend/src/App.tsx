import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import BrainstormPage from './pages/BrainstormPage'
import PitchDojoPage from './pages/PitchDojoPage'
import ManifestPage from './pages/ManifestPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/chat" element={<BrainstormPage />} />
        <Route path="/pitch-dojo" element={<PitchDojoPage />} />
        <Route path="/manifest" element={<ManifestPage />} />
        <Route path="/manifest/:sessionId" element={<ManifestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

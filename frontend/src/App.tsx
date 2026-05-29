import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ReportPage from './pages/ReportPage'
import RecommendPage from './pages/RecommendPage'
import TrackingPage from './pages/TrackingPage'
import PosterPage from './pages/PosterPage'
import AnalysisPage from './pages/AnalysisPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen" style={{ background: 'var(--bg-page)', position: 'relative', overflow: 'hidden' }}>
            <div className="glow-spot glow-spot-tr" />
            <div className="glow-spot glow-spot-bl" />
            <Navbar />
            <main style={{ position: 'relative', zIndex: 1 }}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/" element={<HomePage />} />
                <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
                <Route path="/recommend" element={<ProtectedRoute><RecommendPage /></ProtectedRoute>} />
                <Route path="/tracking" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
                <Route path="/poster" element={<ProtectedRoute><PosterPage /></ProtectedRoute>} />
                <Route path="/analysis" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <footer style={{
              borderTop: '1px solid var(--border-default)', padding: '16px 0', marginTop: 40,
              background: 'var(--bg-card)', textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                QuantForge · 量化锻造 · AI 驱动的 A 股分析平台 · 数据仅供参考，不构成投资建议
              </div>
            </footer>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

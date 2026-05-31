import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Sidebar from './components/Sidebar'
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
import StockDailyPage from './pages/StockDailyPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
            <div className="ambient-glow-top" />
            <div className="ambient-glow-bottom" />
            <Sidebar />
            <main style={{ marginLeft: 220, position: 'relative', zIndex: 1 }}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/" element={<HomePage />} />
                <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
                <Route path="/recommend" element={<ProtectedRoute><RecommendPage /></ProtectedRoute>} />
                <Route path="/tracking" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
                <Route path="/poster" element={<ProtectedRoute><PosterPage /></ProtectedRoute>} />
                <Route path="/analysis" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
                <Route path="/stock-daily" element={<ProtectedRoute><StockDailyPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

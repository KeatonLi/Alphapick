import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
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
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-bg-primary bg-grid relative">
          <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <Navbar />
          <main className="relative z-10">
            <Routes>
              {/* 公开路由 */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<HomePage />} />

              {/* 需登录路由 */}
              <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
              <Route path="/recommend" element={<ProtectedRoute><RecommendPage /></ProtectedRoute>} />
              <Route path="/tracking" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
              <Route path="/poster" element={<ProtectedRoute><PosterPage /></ProtectedRoute>} />
              <Route path="/analysis" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />

              {/* 需管理员路由 */}
              <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="relative z-10 border-t border-border-default py-5 mt-10 bg-white/50">
            <div className="max-w-6xl mx-auto px-6 text-center text-xs text-text-muted">
              QuantForge · 量化锻造 · AI 驱动的 A 股分析平台 · 数据仅供参考，不构成投资建议
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

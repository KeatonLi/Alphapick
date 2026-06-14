import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PicksPage from './pages/PicksPage'
import ReviewPage from './pages/ReviewPage'
import AnalyticsPage from './pages/AnalyticsPage'
import OpsConsolePage from './pages/OpsConsolePage'
import DataCenterPage from './pages/DataCenterPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="qf-app-shell">
            <div className="ambient-glow-top" />
            <div className="ambient-glow-bottom" />
            <Sidebar />
            <main className="qf-main">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/" element={<Navigate to="/picks" replace />} />
                <Route path="/picks" element={<ProtectedRoute><PicksPage /></ProtectedRoute>} />
                <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/data" element={<ProtectedRoute requiredRole="admin"><DataCenterPage /></ProtectedRoute>} />
                <Route path="/ops" element={<ProtectedRoute requiredRole="admin"><OpsConsolePage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/picks" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

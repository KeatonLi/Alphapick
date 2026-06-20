import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RecommendLoopPage from './pages/RecommendLoopPage'
import LimitUpPage from './pages/LimitUpPage'
import OpsConsolePage from './pages/OpsConsolePage'

function ShellRoute({ children, requiredRole }: { children: ReactNode; requiredRole?: 'admin' | 'user' }) {
  return (
    <ProtectedRoute requiredRole={requiredRole}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Navigate to="/recommend" replace />} />
            <Route path="/recommend" element={<ShellRoute><RecommendLoopPage /></ShellRoute>} />
            <Route path="/limit-up" element={<ShellRoute><LimitUpPage /></ShellRoute>} />
            <Route path="/console" element={<ShellRoute requiredRole="admin"><OpsConsolePage /></ShellRoute>} />
            <Route path="/dashboard" element={<Navigate to="/recommend" replace />} />
            <Route path="/picks" element={<Navigate to="/recommend" replace />} />
            <Route path="/tracking" element={<Navigate to="/recommend" replace />} />
            <Route path="/review" element={<Navigate to="/recommend" replace />} />
            <Route path="/analytics" element={<Navigate to="/recommend" replace />} />
            <Route path="/data" element={<Navigate to="/console" replace />} />
            <Route path="/ops" element={<Navigate to="/console" replace />} />
            <Route path="*" element={<Navigate to="/recommend" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

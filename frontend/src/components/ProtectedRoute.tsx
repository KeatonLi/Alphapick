import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  children: ReactNode
  requiredRole?: 'admin' | 'user'
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="qv4-loading">
        <div />
        <span>正在验证身份...</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/recommend" replace />
  }

  return <>{children}</>
}

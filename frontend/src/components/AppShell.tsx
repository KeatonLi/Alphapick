import { NavLink, Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/recommend', label: '推荐收益闭环', meta: 'Recommend' },
  { to: '/limit-up', label: '涨停板分析', meta: 'Limit-up' },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="qv4-shell">
      <header className="qv4-topbar">
        <Link className="qv4-brand" to="/recommend" aria-label="QuantForge">
          <img src="/assets/quantforge-icon.png" alt="" />
          <div>
            <strong>QuantForge</strong>
            <span>AI stock decision loop</span>
          </div>
        </Link>

        <nav className="qv4-tabs" aria-label="主导航">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''}>
              <span>{item.label}</span>
              <small>{item.meta}</small>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/console" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>管理后台</span>
              <small>Admin</small>
            </NavLink>
          )}
        </nav>

        <div className="qv4-account">
          {user ? (
            <>
              <div className="qv4-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
              <div className="qv4-user">
                <strong>{user.username}</strong>
                <span>{user.role === 'admin' ? '管理员' : user.role === 'guest' ? '游客' : '用户'}</span>
              </div>
              <button type="button" onClick={handleLogout}>退出</button>
            </>
          ) : (
            <>
              <Link to="/login">登录</Link>
              <Link to="/register" className="primary">注册</Link>
            </>
          )}
        </div>
      </header>
      <main className="qv4-main">{children}</main>
    </div>
  )
}

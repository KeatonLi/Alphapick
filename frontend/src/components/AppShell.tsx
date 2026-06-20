import { NavLink, Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/recommend', label: '推荐工作台', meta: '推荐 / 跟踪 / 复盘' },
  { to: '/limit-up', label: '涨停分析', meta: '涨停池 / 连板 / 行业' },
  { to: '/account', label: '用户中心', meta: '会员 / 账号 / 权限' },
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
            <span>量化推荐工作台</span>
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
              <span>管理控制台</span>
              <small>任务 / 数据 / 调度</small>
            </NavLink>
          )}
        </nav>

        <div className="qv4-account">
          {user ? (
            <>
              <Link className="qv4-account-link" to="/account" aria-label="进入用户中心">
                <div className="qv4-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
                <div className="qv4-user">
                  <strong>{user.username}</strong>
                  <span>{user.role === 'admin' ? '管理员会员' : '普通用户'}</span>
                </div>
              </Link>
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

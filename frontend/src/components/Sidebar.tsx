import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type IconName = 'home' | 'target' | 'console' | 'trend' | 'analysis'

const NAV_ITEMS: Array<{ path: string; icon: IconName; label: string; kicker: string; adminOnly?: boolean }> = [
  { path: '/dashboard', icon: 'home', label: '工作台', kicker: 'Dashboard' },
  { path: '/picks', icon: 'target', label: '今日推荐', kicker: 'Top Picks' },
  { path: '/tracking', icon: 'trend', label: '收益跟踪', kicker: 'Tracking' },
  { path: '/review', icon: 'analysis', label: '策略复盘', kicker: 'Review' },
  { path: '/console', icon: 'console', label: '控制台', kicker: 'Admin Console', adminOnly: true },
]

function Icon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'home') return <svg {...common}><path d="M4 11.5 12 4l8 7.5" /><path d="M6.5 10.5V20h11v-9.5" /><path d="M10 20v-5h4v5" /></svg>
  if (name === 'target') return <svg {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 7v5l3.5-2" /></svg>
  if (name === 'console') return <svg {...common}><path d="M5 7h14" /><path d="M5 12h7" /><path d="M5 17h10" /><path d="m17 13 2 2-2 2" /></svg>
  if (name === 'trend') return <svg {...common}><path d="M4 18h16" /><path d="m5 15 4-4 3 3 6-7" /><path d="M15 7h3v3" /></svg>
  return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><rect x="7" y="11" width="2.8" height="5" rx="1" /><rect x="12" y="7" width="2.8" height="9" rx="1" /><rect x="17" y="9" width="2.8" height="7" rx="1" /></svg>
}

export default function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname.startsWith('/dashboard')
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="qf-sidebar">
      <Link to="/" className="qf-brand" aria-label="QuantForge home">
        <img src="/assets/quantforge-icon.png" alt="" className="qf-brand-icon" />
        <div>
          <div className="qf-brand-name">QuantForge</div>
          <div className="qf-brand-sub">AI Quant Lab</div>
        </div>
      </Link>

      <nav className="qf-nav">
        {NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'admin').map(item => {
          const active = isActive(item.path)
          return (
            <Link key={item.path} to={item.path} className={`qf-nav-item${active ? ' active' : ''}`}>
              <span className="qf-nav-icon"><Icon name={item.icon} /></span>
              <span className="qf-nav-copy">
                <span className="qf-nav-label">{item.label}</span>
                <span className="qf-nav-kicker">{item.kicker}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="qf-sidebar-footer">
        {user ? (
          <>
            <div className="qf-user-card">
              <div className="qf-user-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <div>
                <div className="qf-user-name">{user.username}</div>
                <div className="qf-user-role">{user.role === 'admin' ? '管理员权限' : '普通用户'}</div>
              </div>
            </div>
            <button onClick={logout} className="qf-ghost-button">退出登录</button>
          </>
        ) : (
          <div className="qf-auth-actions">
            <Link to="/login" className="qf-ghost-button">登录</Link>
            <Link to="/register" className="qf-primary-mini">注册</Link>
          </div>
        )}
      </div>
    </aside>
  )
}

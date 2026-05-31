import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { path: '/',            icon: '📊', label: '首页' },
  { path: '/report',      icon: '📰', label: '市场报告' },
  { path: '/recommend',   icon: '🎯', label: '量化推荐' },
  { path: '/tracking',    icon: '📈', label: '收益跟踪' },
  { path: '/analysis',    icon: '🔍', label: '数据分析' },
  { path: '/poster',      icon: '🖼️', label: '市场海报' },
  { path: '/settings',    icon: '⚙️', label: '设置' },
]

export default function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    background: active ? 'var(--accent-bg)' : 'transparent',
    textDecoration: 'none',
    borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
    transition: 'all 0.2s',
  })

  const logoutBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    color: 'var(--text-muted)', background: 'transparent',
    border: 'none', cursor: 'pointer', width: '100%',
    fontFamily: 'inherit',
  }

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: 220,
      background: 'var(--bg-sidebar)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '20px 16px', height: 64,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 16, color: '#fff',
        }}>Q</div>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          QuantForge
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => (
          <Link key={item.path} to={item.path} style={linkStyle(isActive(item.path))}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-default)' }}>
        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-bg)', color: 'var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{user.username}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user.role === 'admin' ? '管理员' : '用户'}</div>
              </div>
            </div>
            <button onClick={logout} style={logoutBtnStyle}>
              <span>🚪</span> <span>退出登录</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/login" style={{
              flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border-default)', color: 'var(--text-secondary)', textDecoration: 'none',
              background: 'var(--bg-card)',
            }}>
              登录
            </Link>
            <Link to="/register" style={{
              flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--accent)', color: '#fff', textDecoration: 'none',
            }}>
              注册
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}

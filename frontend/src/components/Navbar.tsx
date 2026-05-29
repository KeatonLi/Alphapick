import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const protectedNavItems = [
  { path: '/report', label: '市场报告' },
  { path: '/recommend', label: '智能推荐' },
  { path: '/tracking', label: '收益跟踪' },
  { path: '/poster', label: '海报' },
  { path: '/analysis', label: '数据分析' },
]

const adminNavItems = [
  { path: '/settings', label: '设置' },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const isLoggedIn = !!user
  const isAdmin = user?.role === 'admin'

  const linkBase: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    textDecoration: 'none', transition: 'all .2s',
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--bg-nav)',
      backdropFilter: 'var(--nav-blur)',
      WebkitBackdropFilter: 'var(--nav-blur)',
      borderBottom: '1px solid var(--nav-border)'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff'
          }}>QF</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-.01em' }}>QuantForge</span>
        </NavLink>

        {isLoggedIn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'auto' }}>
            <NavLink to="/" end style={({ isActive }) => ({ ...linkBase, color: isActive ? '#fff' : 'var(--text-muted)', background: isActive ? 'var(--accent)' : 'transparent' })}>首页</NavLink>
            {protectedNavItems.map(item => (
              <NavLink key={item.path} to={item.path} style={({ isActive }) => ({ ...linkBase, color: isActive ? '#fff' : 'var(--text-muted)', background: isActive ? 'var(--accent)' : 'transparent' })}>{item.label}</NavLink>
            ))}
            {isAdmin && adminNavItems.map(item => (
              <NavLink key={item.path} to={item.path} style={({ isActive }) => ({ ...linkBase, color: isActive ? '#fff' : 'var(--text-muted)', background: isActive ? 'var(--accent)' : 'transparent' })}>{item.label}</NavLink>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={toggle} title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'} style={{
            width: 36, height: 36, borderRadius: 10,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-card)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, transition: 'all .2s'
          }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {isLoggedIn ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'var(--accent-bg)', border: '1px solid var(--border-accent)' }}>
                <span style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 500, maxWidth: 80 }} className="truncate">{user.username}</span>
                {isAdmin && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>Admin</span>}
              </div>
              <button onClick={logout} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                color: 'var(--text-muted)', border: 'none', background: 'transparent',
                cursor: 'pointer', transition: 'all .2s'
              }}>退出</button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ ...linkBase, color: 'var(--text-muted)' }}>登录</Link>
              <Link to="/register" style={{ ...linkBase, background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px var(--accent-glow)' }}>注册</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

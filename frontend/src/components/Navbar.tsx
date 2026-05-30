import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const protectedNavItems = [
  { path: '/report', label: '市场报告' },
  { path: '/recommend', label: '智能推荐' },
  { path: '/tracking', label: '收益跟踪' },
  { path: '/stock-daily', label: '个股日线' },
  { path: '/analysis', label: '数据分析' },
  { path: '/poster', label: '海报' },
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
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="44" height="44" rx="14" fill="var(--bg-page)" stroke="var(--border-default)" strokeWidth="1.5" />
            <line x1="12" y1="12" x2="12" y2="34" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
            <rect x="8" y="24" width="8" height="8" rx="2" fill="var(--accent)" opacity="0.6" />
            <line x1="22" y1="16" x2="22" y2="32" stroke="var(--accent-light)" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
            <rect x="18" y="23" width="8" height="7" rx="2" fill="var(--down)" opacity="0.55" />
            <line x1="33" y1="6" x2="33" y2="34" stroke="var(--up)" strokeWidth="2" strokeLinecap="round" />
            <rect x="28" y="12" width="10" height="20" rx="2.5" fill="var(--up)" />
            <rect x="29" y="13" width="3" height="18" rx="1.5" fill="rgba(255,255,255,0.18)" />
          </svg>
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

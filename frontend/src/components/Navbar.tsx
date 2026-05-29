import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const protectedNavItems = [
  { path: '/report', label: '市场报告', icon: '📊' },
  { path: '/recommend', label: '智能推荐', icon: '🎯' },
  { path: '/tracking', label: '收益跟踪', icon: '📈' },
  { path: '/poster', label: '海报', icon: '🖼️' },
  { path: '/analysis', label: '数据分析', icon: '🔬' },
]

const adminNavItems = [
  { path: '/settings', label: '设置', icon: '⚙️' },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const isLoggedIn = !!user
  const isAdmin = user?.role === 'admin'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
        : 'text-text-secondary hover:text-blue-600 hover:bg-blue-50'
    }`

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border-default shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-200">
            QF
          </div>
          <span className="text-lg font-bold text-blue-700 tracking-tight hidden sm:inline">QuantForge</span>
        </NavLink>

        {/* 导航项：登录后显示 */}
        {isLoggedIn && (
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            <NavLink to="/" end className={linkClass}>
              <span className="text-sm">🏠</span>
              <span>首页</span>
            </NavLink>
            {protectedNavItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={linkClass}>
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            {isAdmin && adminNavItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={linkClass}>
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* 右侧：未登录 → 登录/注册按钮；已登录 → 用户信息 + 退出 */}
        <div className="flex items-center gap-2 shrink-0">
          {isLoggedIn ? (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100">
                <span className="text-xs leading-none">👤</span>
                <span className="text-xs text-blue-700 font-medium max-w-[80px] truncate">{user.username}</span>
                {isAdmin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-medium leading-none">Admin</span>
                )}
              </div>
              <button
                onClick={logout}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-blue-600 hover:bg-blue-50 transition-all duration-300"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-all duration-300"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/report', label: '市场报告', icon: '📊' },
  { path: '/recommend', label: '智能推荐', icon: '🎯' },
  { path: '/tracking', label: '收益跟踪', icon: '📋' },
]

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
        : 'text-text-secondary hover:text-blue-600 hover:bg-blue-50'
    }`

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border-default shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <NavLink to="/report" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-200">
            QF
          </div>
          <span className="text-lg font-bold text-blue-700 tracking-tight hidden sm:inline">QuantForge</span>
        </NavLink>

        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>
              <span className="text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-green-600 font-medium hidden sm:inline">已连接</span>
          </div>
        </div>
      </div>
    </nav>
  )
}

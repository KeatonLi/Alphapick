import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/market', label: '市场数据', icon: '📊' },
  { path: '/analysis', label: '行情分析', icon: '📈' },
  { path: '/stock', label: '个股分析', icon: '📈' },
  { path: '/recommend', label: '每日量化报告', icon: '⭐' },
]

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
        : 'text-text-secondary hover:text-blue-600 hover:bg-blue-50'
    }`

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border-default shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-200">
            QF
          </div>
          <div>
            <span className="text-xl font-bold text-blue-700 tracking-tight">QuantForge</span>
            <span className="hidden sm:inline text-xs text-text-muted ml-2 font-medium tracking-wide">量化锻造</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">实时行情</span>
          </div>
        </div>
      </div>
    </nav>
  )
}

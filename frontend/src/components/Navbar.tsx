import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/stock', label: '个股分析', icon: '◆' },
  { path: '/recommend', label: '每日推荐', icon: '★' },
  { path: '/report', label: '市场报告', icon: '◎' },
]

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_16px_rgba(59,130,246,0.15)]'
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
    }`

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80 border-b border-border-default">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-blue-500/25">
            QF
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">QuantForge</span>
            <span className="hidden sm:inline text-xs text-slate-500 ml-2 font-medium tracking-wide">量化锻造</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">实时</span>
          </div>
        </div>
      </div>
    </nav>
  )
}

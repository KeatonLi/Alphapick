import { NavLink } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

const navItems = [
  { path: '/stock', label: '个股分析', icon: '◆' },
  { path: '/recommend', label: '每日推荐', icon: '★' },
  { path: '/report', label: '市场报告', icon: '◎' },
]

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_16px_rgba(59,130,246,0.15)]'
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
    }`

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80 border-b border-border-default">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-blue-500/25">
            QF
          </div>
          <div>
            <span className="text-lg font-bold text-text-primary tracking-tight">QuantForge</span>
            <span className="hidden sm:inline text-xs text-text-muted ml-2 font-medium tracking-wide">量化锻造</span>
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
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card border border-border-default hover:border-border-accent transition-all duration-300"
            title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
            <span className="text-xs text-slate-400 font-medium">{theme === 'dark' ? '亮色' : '暗色'}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

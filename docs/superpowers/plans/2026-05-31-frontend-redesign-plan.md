# 前端重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 QuantForge 前端：统一交易日选择器、侧边栏导航、暗色主题唯一化

**Architecture:** 新建 TradeDatePicker 组件 + Sidebar 组件 + useTradeDates hook，修改 App.tsx 布局壳，全局 CSS 重校准，逐页替换旧日期选择

**Tech Stack:** React 18 + TypeScript + Vite, no new dependencies

---

## 文件清单

### 新建
| 文件 | 职责 |
|------|------|
| `src/hooks/useTradeDates.ts` | 全局交易日列表 hook，缓存 API 结果 |
| `src/components/Sidebar.tsx` | 固定左侧竖排导航 |
| `src/components/TradeDatePicker.tsx` | 统一交易日选择器 |

### 修改
| 文件 | 改动摘要 |
|------|----------|
| `src/index.css` | 删除亮色主题，重校准暗色变量，调整排版 |
| `src/App.tsx` | Sidebar 布局 + 删除 Navbar/footer |
| `src/contexts/ThemeContext.tsx` | 移除亮色切换 |
| `src/pages/ReportPage.tsx` | 替换日期选择 |
| `src/pages/RecommendPage.tsx` | 替换日期选择 |
| `src/pages/PosterPage.tsx` | 替换日期选择 |
| `src/pages/SettingsPage.tsx` | 替换日期选择 + 添加 tradeDates 请求 |
| `src/pages/AnalysisPage.tsx` | 替换日期选择 |
| `src/pages/HomePage.tsx` | 适配侧边栏布局 |
| `src/pages/TrackingPage.tsx` | 适配侧边栏布局 |
| `src/pages/LoginPage.tsx` | 适配侧边栏布局 |
| `src/pages/RegisterPage.tsx` | 适配侧边栏布局 |
| `src/pages/StockDailyPage.tsx` | 适配侧边栏布局 |

### 删除
| 文件 | 原因 |
|------|------|
| `src/components/Navbar.tsx` | 被 Sidebar 替代 |

---

### Task 1: 创建 useTradeDates hook

**Files:**
- Create: `src/hooks/useTradeDates.ts`

- [ ] **Step 1: 创建 hook 文件**

`src/hooks/useTradeDates.ts`:
```typescript
import { useState, useEffect } from 'react'
import { apiGet } from '../services/api'

// 模块级缓存，跨组件共享
let cached: string[] | null = null
let pending: Promise<string[]> | null = null

export function useTradeDates(): string[] {
  const [dates, setDates] = useState<string[]>(cached || [])

  useEffect(() => {
    if (cached) {
      setDates(cached)
      return
    }
    if (pending) {
      pending.then(d => setDates(d))
      return
    }
    pending = apiGet<any>('/report/trade-dates?days=365')
      .then(d => {
        const result: string[] = d.success ? (d.data || []) : []
        cached = result
        pending = null
        return result
      })
      .catch(() => {
        pending = null
        return []
      })
    pending.then(d => setDates(d))
  }, [])

  return dates
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useTradeDates.ts
git commit -m "feat: add useTradeDates hook with module-level cache"
```

---

### Task 2: 创建 TradeDatePicker 组件

**Files:**
- Create: `src/components/TradeDatePicker.tsx`

- [ ] **Step 1: 创建组件文件**

`src/components/TradeDatePicker.tsx`:
```tsx
import { useMemo } from 'react'

interface Props {
  value: string
  onChange: (date: string) => void
  tradeDates: string[]
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function getWeekday(dateStr: string): string {
  const d = new Date(dateStr)
  return WEEKDAY_NAMES[d.getDay()]
}

export default function TradeDatePicker({ value, onChange, tradeDates }: Props) {
  const idx = tradeDates.indexOf(value)
  const canPrev = idx >= 0 && idx < tradeDates.length - 1
  const canNext = idx > 0

  const displayDate = useMemo(() => {
    if (!value) return ''
    return `${value} (${getWeekday(value)})`
  }, [value])

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 8,
    border: '1px solid var(--border-default)',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--text-secondary)' : 'var(--text-dim)',
    cursor: active ? 'pointer' : 'default',
    opacity: active ? 1 : 0.35,
    transition: 'all 0.2s',
  })

  const todayBtnStyle: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: '1px solid var(--border-default)', background: 'var(--bg-card)',
    color: 'var(--text-secondary)', cursor: 'pointer',
    transition: 'all 0.2s',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => onChange(tradeDates[idx + 1])} disabled={!canPrev} style={btnStyle(canPrev)}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)', minWidth: 160, textAlign: 'center',
        padding: '6px 12px', borderRadius: 8,
        background: 'var(--bg-input)', border: '1px solid var(--border-default)',
      }}>
        {displayDate || '加载中...'}
      </span>

      <button onClick={() => onChange(tradeDates[idx - 1])} disabled={!canNext} style={btnStyle(canNext)}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      {tradeDates.length > 0 && tradeDates[0] !== value && (
        <button onClick={() => onChange(tradeDates[0])} style={todayBtnStyle}>
          返回今日
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TradeDatePicker.tsx
git commit -m "feat: add TradeDatePicker component"
```

---

### Task 3: 创建 Sidebar 组件

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: 创建组件文件**

`src/components/Sidebar.tsx`:
```tsx
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
```

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: add Sidebar navigation component"
```

---

### Task 4: 重写 index.css（暗色主题唯一化）

**Files:**
- Modify: `src/index.css` (complete rewrite)

- [ ] **Step 1: 完整替换 index.css**

`src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
@import "tailwindcss";

/* ═══════════════════════════════════════════
   QuantForge · 暗色主题唯一
   ═══════════════════════════════════════════ */

:root {
  /* 背景 */
  --bg-page: #0f0f14;
  --bg-sidebar: rgba(15, 15, 20, 0.92);
  --bg-card: rgba(255,255,255,0.06);
  --bg-card-hover: rgba(255,255,255,0.10);
  --bg-elevated: rgba(255,255,255,0.08);
  --bg-input: rgba(255,255,255,0.08);
  --bg-tag: rgba(255,255,255,0.06);
  --bg-badge: rgba(255,255,255,0.10);

  /* 文字 */
  --text-primary: #f5f5f7;
  --text-secondary: rgba(255,255,255,0.60);
  --text-muted: rgba(255,255,255,0.36);
  --text-dim: rgba(255,255,255,0.18);

  /* 边框 */
  --border-default: rgba(255,255,255,0.08);
  --border-hover: rgba(255,255,255,0.14);
  --border-accent: rgba(99,102,241,0.28);

  /* 强调色 — indigo-500 */
  --accent: #6366f1;
  --accent-light: #818cf8;
  --accent-bg: rgba(99,102,241,0.12);
  --accent-glow: rgba(99,102,241,0.06);
  --blue: #60a5fa;
  --blue-bg: rgba(96,165,250,0.10);

  /* A股涨跌：红涨绿跌 */
  --up: #ef4444;
  --up-bg: rgba(239,68,68,0.10);
  --down: #10b981;
  --down-bg: rgba(16,185,129,0.10);

  /* 卡片 */
  --card-radius: 12px;
  --card-shadow: 0 0 80px rgba(99,102,241,0.04);

  /* 滚动条 */
  --scrollbar-track: transparent;
  --scrollbar-thumb: rgba(255,255,255,0.10);
}

/* ═══ 全局 ═══ */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  background: var(--bg-page);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ═══ 滚动条 ═══ */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--scrollbar-track); }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent); }

/* ═══ 毛玻璃卡片 ═══ */
.card {
  background: var(--bg-card);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid var(--border-default);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  transition: all 0.2s ease;
}
.card:hover {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
  transform: translateY(-1px);
  box-shadow: 0 0 100px var(--accent-glow);
}

/* ═══ 装饰光晕 ═══ */
.ambient-glow-top {
  position: fixed; pointer-events: none; z-index: 0;
  top: -300px; right: -200px;
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%);
  border-radius: 50%;
}
.ambient-glow-bottom {
  position: fixed; pointer-events: none; z-index: 0;
  bottom: -400px; left: -250px;
  width: 800px; height: 800px;
  background: radial-gradient(circle, rgba(96,165,250,0.03) 0%, transparent 70%);
  border-radius: 50%;
}

/* ═══ 动画 ═══ */
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateX(40px) translateY(8px); }
  to   { opacity: 1; transform: translateX(0) translateY(0); }
}
.animate-reveal { opacity: 0; transform: translateX(40px) translateY(8px); }
.animate-reveal.visible { animation: fadeSlideIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { opacity: 0; }
.animate-fade-up.visible { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

@keyframes countUp {
  from { opacity: 0; transform: translateY(8px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.count-up { animation: countUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

@keyframes particleFloat {
  0%, 100% { opacity: 0; transform: translate(0, 0); }
  20%  { opacity: 0.7; }
  50%  { opacity: 0.3; transform: translate(var(--drift, 20px), -20px); }
  80%  { opacity: 0; transform: translate(var(--drift, -10px), -40px); }
}

/* ═══ Hero 标题渐变 ═══ */
.hero-gradient {
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-light) 45%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ═══ 骨架屏 ═══ */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-elevated) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--card-radius);
}

/* ═══ 工具类 ═══ */
.up { color: var(--up); }
.down { color: var(--down); }
.up-bg { background: var(--up-bg); }
.down-bg { background: var(--down-bg); }
.mono { font-family: 'JetBrains Mono', 'SF Mono', monospace; }
.text-muted { color: var(--text-muted); }

/* ═══ Nav pills ═══ */
.nav-pills {
  display: flex; gap: 2px;
  background: var(--bg-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
}
.nav-pills a {
  padding: 6px 14px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  transition: all 0.2s ease;
}
.nav-pills a:hover { color: var(--text-primary); background: var(--bg-elevated); }
.nav-pills a.active {
  background: var(--accent);
  color: #fff;
}

/* ═══ Badge ═══ */
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-tag);
  color: var(--text-muted);
}
.badge-accent { background: var(--accent-bg); color: var(--accent-light); }
.badge-up { background: var(--up-bg); color: var(--up); }
.badge-down { background: var(--down-bg); color: var(--down); }

/* ═══ Section header ═══ */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.section-header h3 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0;
}

/* ═══ Row item ═══ */
.row-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-default);
}
.row-item:last-child { border-bottom: none; }
.row-item .rn { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.row-item .rv { font-size: 14px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
.row-item .rsub { font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; margin-top: 1px; }

/* ═══ 旧版兼容 ═══ */
.fade-in { animation: fadeInUp 0.5s ease forwards; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "refactor: dark theme only, recalibrated colors and typography"
```

---

### Task 5: 简化 ThemeContext

**Files:**
- Modify: `src/contexts/ThemeContext.tsx` (rewrite)

- [ ] **Step 1: 替换为简单存根**

`src/contexts/ThemeContext.tsx`:
```tsx
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

interface ThemeContextType {
  theme: 'dark'
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/contexts/ThemeContext.tsx
git commit -m "refactor: simplify ThemeContext to dark-only stub"
```

---

### Task 6: 重写 App.tsx 布局壳

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/Navbar.tsx`

- [ ] **Step 1: 替换 App.tsx**

`src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ReportPage from './pages/ReportPage'
import RecommendPage from './pages/RecommendPage'
import TrackingPage from './pages/TrackingPage'
import PosterPage from './pages/PosterPage'
import AnalysisPage from './pages/AnalysisPage'
import SettingsPage from './pages/SettingsPage'
import StockDailyPage from './pages/StockDailyPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
            <div className="ambient-glow-top" />
            <div className="ambient-glow-bottom" />
            <Sidebar />
            <main style={{ marginLeft: 220, position: 'relative', zIndex: 1 }}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/" element={<HomePage />} />
                <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
                <Route path="/recommend" element={<ProtectedRoute><RecommendPage /></ProtectedRoute>} />
                <Route path="/tracking" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
                <Route path="/poster" element={<ProtectedRoute><PosterPage /></ProtectedRoute>} />
                <Route path="/analysis" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
                <Route path="/stock-daily" element={<ProtectedRoute><StockDailyPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 2: 删除 Navbar.tsx**

```bash
rm frontend/src/components/Navbar.tsx
```

- [ ] **Step 3: 验证类型检查 + 构建**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Navbar.tsx
git commit -m "refactor: replace Navbar with Sidebar layout shell"
```

---

### Task 7: 替换 ReportPage 日期选择

**Files:**
- Modify: `src/pages/ReportPage.tsx`

改动重点：
- 引入 `useTradeDates` 和 `TradeDatePicker`
- 删除旧的 pills + date input + 箭头按钮 (lines 66-82)
- 替换为 `<TradeDatePicker>` 组件
- 初始值改为 `tradeDates[0]` 或空字符串
- 移除不再使用的 `btnStyle` 函数和 `canPrev/canNext`

- [ ] **Step 1: 修改 ReportPage.tsx**

顶部 import 替换 + 组件内替换 date picker section：

Lines 1-2:
```tsx
import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'
```

替换 lines 23-54 (从 `export default` 到 `btnStyle` 之前):
```tsx
export default function ReportPage() {
  const tradeDates = useTradeDates()
  const [date, setDate] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tradeDates.length > 0 && !date) setDate(tradeDates[0])
  }, [tradeDates])

  const load = async (d: string) => {
    if (!d) return
    setLoading(true)
    try { const r = await apiGet<any>(`/report/daily?date=${d}`); setReport(r.success ? r.data : null) }
    catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (date) load(date) }, [date])
```

替换 date picker section (原 lines 66-82)：
```tsx
      {/* Date Picker */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
        <TradeDatePicker value={date} onChange={setDate} tradeDates={tradeDates} />
      </div>
```

删除不再使用的变量和函数：删除 `today`, `dateIdx`, `canPrev`, `canNext`, `btnStyle` 的声明。

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReportPage.tsx
git commit -m "refactor: replace date picker in ReportPage with TradeDatePicker"
```

---

### Task 8: 替换 RecommendPage 日期选择

**Files:**
- Modify: `src/pages/RecommendPage.tsx`

- [ ] **Step 1: 修改 RecommendPage.tsx**

Top imports 添加：
```tsx
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'
```

替换 lines 10-17 (state declarations):
```tsx
export default function RecommendPage() {
  const tradeDates = useTradeDates()
  const [date, setDate] = useState('')
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tradeDates.length > 0 && !date) setDate(tradeDates[0])
  }, [tradeDates])
```

替换 date picker section (原 lines 57-67):
```tsx
      {/* Date Picker */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
        <TradeDatePicker value={date} onChange={setDate} tradeDates={tradeDates} />
      </div>
```

删除：`today`, `dateIdx`, `canPrev`, `canNext`, `btn` 的声明。移除 `apiGet<any>('/report/trade-dates?days=365')` 的 useEffect（已被 useTradeDates 替代）。

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RecommendPage.tsx
git commit -m "refactor: replace date picker in RecommendPage with TradeDatePicker"
```

---

### Task 9: 替换 PosterPage 日期选择

**Files:**
- Modify: `src/pages/PosterPage.tsx`

- [ ] **Step 1: 修改 PosterPage.tsx**

Top imports 添加：
```tsx
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'
```

修改 lines 24-36 (state + useEffect):
```tsx
export default function PosterPage() {
  const tradeDates = useTradeDates()
  const [selectedDate, setSelectedDate] = useState('')
  const [posterUrl, setPosterUrl] = useState<string>('')
  const [state, setState] = useState<PosterState>({ loading: false, error: '', hasReport: false })
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (tradeDates.length > 0 && !selectedDate) setSelectedDate(tradeDates[0])
  }, [tradeDates])
```

替换 date picker section (原 lines 102-119):
```tsx
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <TradeDatePicker value={selectedDate} onChange={setSelectedDate} tradeDates={tradeDates} />
      </div>
```

用 TradeDatePicker 替换整个 `<div className="flex items-center gap-2">` 内的 date input + 箭头按钮。

删除：`today`, `dateIdx`, `canPrev`, `canNext`, `dateBtnStyle` 声明。移除 `apiGet<any>('/report/trade-dates?days=365')` 的 useEffect。

将下载/复制按钮从日期选择器行移到下方独立行：
```tsx
      {state.hasReport && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          <button onClick={handleDownload} ...>下载海报</button>
          <button onClick={handleCopyLink} ...>复制链接</button>
        </div>
      )}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PosterPage.tsx
git commit -m "refactor: replace date picker in PosterPage with TradeDatePicker"
```

---

### Task 10: 替换 SettingsPage 日期选择

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

SettingsPage 较大（~750 行），只做最小改动：
- 顶部引入 `useTradeDates` 和 `TradeDatePicker`
- `targetDate` 初始值改为 `''`，useEffect 等待 tradeDates
- 替换 `<input type="date" ...>` (line 708) 为 `<TradeDatePicker>`
- 删除 `today()` helper（不再需要）

- [ ] **Step 1: 修改 SettingsPage.tsx**

在文件顶部 imports 添加：
```tsx
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'
```

找到 `today()` 函数声明 (约 line 21)，删除整个函数。

找到 `targetDate` 的 useState (约 line 667):
```tsx
const [targetDate, setTargetDate] = useState('')
```

在组件顶部添加 tradeDates hook（在组件函数体开头）：
```tsx
const tradeDates = useTradeDates()
useEffect(() => {
  if (tradeDates.length > 0 && !targetDate) setTargetDate(tradeDates[0])
}, [tradeDates])
```

替换 `<input type="date"...>` 行（原 line 708-713）:
```tsx
<TradeDatePicker value={targetDate} onChange={setTargetDate} tradeDates={tradeDates} />
```

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "refactor: replace date picker in SettingsPage with TradeDatePicker"
```

---

### Task 11: 替换 AnalysisPage 日期选择

**Files:**
- Modify: `src/pages/AnalysisPage.tsx`

AnalysisPage 有两个 `type="date"` 输入（start/end 范围）。
改用两个 TradeDatePicker：startDate 和 endDate。

- [ ] **Step 1: 修改 AnalysisPage.tsx**

Top imports 添加：
```tsx
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'
```

在组件顶部添加：
```tsx
const tradeDates = useTradeDates()
```

设置初始值：
```tsx
useEffect(() => {
  if (tradeDates.length > 0) {
    if (!startDate) setStartDate(tradeDates[tradeDates.length - 1]) // 最早交易日
    if (!endDate) setEndDate(tradeDates[0])                           // 最新交易日
  }
}, [tradeDates])
```

替换日期输入组 (原 lines 73-77):
```tsx
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>起始</span>
          <TradeDatePicker value={startDate} onChange={setStartDate} tradeDates={tradeDates} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>结束</span>
          <TradeDatePicker value={endDate} onChange={setEndDate} tradeDates={tradeDates} />
        </div>
```

删除 `inputStyle` 常量（不再需要）。

- [ ] **Step 2: 验证类型检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AnalysisPage.tsx
git commit -m "refactor: replace date pickers in AnalysisPage with TradeDatePicker"
```

---

### Task 12: 适配剩余页面到侧边栏布局

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/TrackingPage.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/StockDailyPage.tsx`

这些页面没有日期选择器，只需要确保容器在侧边栏布局下正常显示。主要检查：
- padding/margin 是否合理（侧边栏 220px 左边距已在 App.tsx 设置）
- 是否有 `min-h-screen` 之类导致溢出的样式
- Login/Register 页面不受侧边栏影响（它们不是布局型页面）

- [ ] **Step 1: 检查并微调 HomePage.tsx**

HomePage 的容器已有 `maxWidth` + `margin: '0 auto'`，确认无冲突。去掉任何 min-h-screen 样式（如果有）。

阅读 HomePage.tsx，检查去除全屏/固定高度的样式。如 `<div style={{ position: 'relative', zIndex: 1 }}>` 改为：
```tsx
<div style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 24px' }}>
```
（侧边栏的 `marginLeft: 220` 已由 App.tsx 的 `<main>` 处理，页面不需要再设）

- [ ] **Step 2: 检查 TrackingPage**

确认容器使用 `maxWidth 1024` + `margin: '0 auto'`，无固定全屏高度。

- [ ] **Step 3: 检查 LoginPage 和 RegisterPage**

确认登录/注册页容器居中，无侧边栏相关冲突。LoginPage 和 RegisterPage 通常独立于主布局。

- [ ] **Step 4: 检查 StockDailyPage**

确认容器在侧边栏下正常。

- [ ] **Step 5: 验证构建**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/pages/TrackingPage.tsx frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/StockDailyPage.tsx
git commit -m "refactor: adapt remaining pages to sidebar layout"
```

---

### Task 13: 最终验证 + 部署

- [ ] **Step 1: 完整类型检查 + 构建**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 2: 启动开发服务器验证**

```bash
cd frontend && npm run dev
```
打开 http://localhost:5173 检查各页面视觉效果。

- [ ] **Step 3: Commit + Push + Deploy**

```bash
git push
bash deploy.sh
```

---

## 验证清单

- [ ] 所有页面日期选择器只能选交易日（指向 tradeDates 列表值）
- [ ] 侧边栏固定左侧 220px，内容区在右侧
- [ ] 导航项高亮当前页面
- [ ] 无亮色主题残留（CSS、context、切换按钮）
- [ ] 暗色主题颜色正确（#0f0f14 背景、卡片半透明、accent #6366f1）
- [ ] `npm run build` 无错误
- [ ] 部署后服务器正常运行

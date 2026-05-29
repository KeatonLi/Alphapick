import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api'
import { useTheme } from '../contexts/ThemeContext'

const features = [
  { path: '/report', icon: '📊', title: '市场报告', desc: '三大指数行情、热门板块分析、AI 撰写的市场日报' },
  { path: '/recommend', icon: '🎯', title: '智能推荐', desc: 'THS 选股 × 热度排名 × 消息面 → AI 精选最多 5 只' },
  { path: '/tracking', icon: '📈', title: '收益跟踪', desc: '3 个交易日持仓跟踪，自动更新现价和收益率' },
  { path: '/settings', icon: '⚙️', title: '数据生成 & 调度', desc: '手动触发生成，配置定时任务，支持一键全部' },
]

const steps = [
  { icon: '⚙️', title: '1. 生成数据', detail: '打开「设置」→ 选择日期 → 点击"生成推荐"，约 7 秒完成', link: '/settings' },
  { icon: '🎯', title: '2. 查看推荐', detail: '打开「智能推荐」→ 查看 AI 精选的 5 只股票及推荐理由', link: '/recommend' },
  { icon: '📈', title: '3. 跟踪收益', detail: '每天去「设置」点"更新现价"，连续 3 天，查看收益跟踪', link: '/settings' },
  { icon: '📊', title: '4. 参考报告', detail: '打开「市场报告」→ 查看每日指数行情和 AI 市场分析', link: '/report' },
]

const tips = [
  { icon: '⏰', title: '定时任务', detail: '在「设置」中开启定时任务，配置 16:00 收盘后自动生成报告和推荐' },
  { icon: '🔄', title: '全部生成', detail: '一键全部 = 市场报告 + 量化推荐 + 更新现价，一步到位' },
  { icon: '💡', title: '手动更新', detail: '生成推荐后，每天去「设置」点一次"更新现价"，连续 3 天完成跟踪' },
  { icon: '📋', title: '历史查看', detail: '「智能推荐」和「收益跟踪」页面支持按日期查看历史数据' },
]

export default function HomePage() {
  const { theme } = useTheme()
  const [stats, setStats] = useState<{ reportDays: number; recCount: number; winRate: number } | null>(null)

  useEffect(() => {
    Promise.all([
      apiGet<any>('/report/dates?days=90'),
      apiGet<any>('/recommend/stats'),
    ])
      .then(([rep, rec]) => {
        if (rep.success || rec.success) {
          setStats({
            reportDays: rep.success ? (rep.data?.length || 0) : 0,
            recCount: rec.success ? (rec.data?.total || 0) : 0,
            winRate: rec.success ? (rec.data?.win_rate || 0) : 0,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 fade-in">
      <div className="text-center mb-10 sm:mb-14">
        <div
          className="inline-flex items-center gap-3 px-4 py-2 rounded-full text-xs font-medium mb-5"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--border-accent)', color: 'var(--accent-light)' }}
        >
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--up)' }} />
          系统运行中
        </div>
        <h1
          className="text-3xl sm:text-5xl font-extrabold mb-4 tracking-tight leading-tight"
          style={
            theme === 'dark'
              ? { background: 'linear-gradient(135deg, #fff 0%, var(--accent-light) 50%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
              : { color: 'var(--text-primary)' }
          }
        >
          Quant<span style={theme === 'light' ? { color: 'var(--accent)' } : {}}>Forge</span>
        </h1>
        <p className="text-sm sm:text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          AI 驱动的 A 股量化分析平台 —— 每日市场报告、智能选股推荐、收益跟踪，一站式量化决策辅助
        </p>

        {stats && (
          <div className="mt-6 flex items-center justify-center gap-6 sm:gap-10 text-center">
            <div>
              <div className="text-xl sm:text-2xl font-extrabold mono" style={{ color: 'var(--accent)' }}>{stats.reportDays}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>近 90 天报告</div>
            </div>
            <div className="w-px h-8" style={{ background: 'var(--border-default)' }} />
            <div>
              <div className="text-xl sm:text-2xl font-extrabold mono" style={{ color: 'var(--accent)' }}>{stats.recCount}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>累计推荐</div>
            </div>
            <div className="w-px h-8" style={{ background: 'var(--border-default)' }} />
            <div>
              <div className="text-xl sm:text-2xl font-extrabold mono" style={{ color: 'var(--up)' }}>{stats.winRate}%</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>胜率</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {features.map((f) => (
          <Link key={f.path} to={f.path} className="card p-5 group">
            <div className="flex items-start gap-4">
              <div className="text-2xl sm:text-3xl shrink-0 mt-0.5">{f.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-bg)', color: 'var(--accent-light)' }}>核心</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
              <div className="text-lg shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--text-muted)' }}>→</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card p-5 mb-5">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span>🚀</span> 快速上手
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((s) => (
            <Link
              key={s.title}
              to={s.link}
              className="flex items-start gap-3 p-3 rounded-xl transition-all group"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
            >
              <div className="text-lg shrink-0 mt-0.5">{s.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</div>
                <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.detail}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card p-5 mb-5">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span>💡</span> 使用技巧
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tips.map((t) => (
            <div
              key={t.title}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
            >
              <div className="text-lg shrink-0 mt-0.5">{t.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.title}</div>
                <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>推荐生成流程</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          {['THS 选股池 500+', '热度排名前 50', '取交集+主板过滤', '消息面分析', 'AI 精选 5 只'].map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              {i > 0 && <span className="hidden sm:inline mx-1" style={{ color: 'var(--text-dim)' }}>→</span>}
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                {step}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-3 pt-3 text-[11px] flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-default)' }}>
          <span>⚡ 全流程 ~7 秒</span>
          <span>📡 同花顺 + 东方财富 + 腾讯财经</span>
          <span>🤖 MiniMax M2.7</span>
        </div>
      </div>
    </div>
  )
}

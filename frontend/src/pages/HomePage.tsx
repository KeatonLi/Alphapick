import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api'

const features = [
  {
    path: '/report',
    icon: '📊',
    title: '市场报告',
    desc: '三大指数行情、热门板块分析、AI 撰写的市场日报',
    color: 'from-blue-50 to-blue-100/50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    path: '/recommend',
    icon: '🎯',
    title: '智能推荐',
    desc: 'THS 选股 × 热度排名 × 消息面 → AI 精选最多 5 只',
    color: 'from-amber-50 to-amber-100/50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    path: '/tracking',
    icon: '📈',
    title: '收益跟踪',
    desc: '3 个交易日持仓跟踪，自动更新现价和收益率',
    color: 'from-green-50 to-green-100/50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
  {
    path: '/settings',
    icon: '⚙️',
    title: '数据生成 & 调度',
    desc: '手动触发生成，配置定时任务，支持一键全部',
    color: 'from-purple-50 to-purple-100/50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
]

const steps = [
  {
    icon: '⚙️',
    title: '1. 生成数据',
    detail: '打开「设置」→ 选择日期 → 点击"生成推荐"，约 7 秒完成',
    link: '/settings',
  },
  {
    icon: '🎯',
    title: '2. 查看推荐',
    detail: '打开「智能推荐」→ 查看 AI 精选的 5 只股票及推荐理由',
    link: '/recommend',
  },
  {
    icon: '📈',
    title: '3. 跟踪收益',
    detail: '每天去「设置」点"更新现价"，连续 3 天，查看收益跟踪',
    link: '/settings',
  },
  {
    icon: '📊',
    title: '4. 参考报告',
    detail: '打开「市场报告」→ 查看每日指数行情和 AI 市场分析',
    link: '/report',
  },
]

const tips = [
  {
    icon: '⏰',
    title: '定时任务',
    detail: '在「设置」中开启定时任务，配置 16:00 收盘后自动生成报告和推荐',
  },
  {
    icon: '🔄',
    title: '全部生成',
    detail: '一键全部 = 市场报告 + 量化推荐 + 更新现价，一步到位',
  },
  {
    icon: '💡',
    title: '手动更新',
    detail: '生成推荐后，每天去「设置」点一次"更新现价"，连续 3 天完成跟踪',
  },
  {
    icon: '📋',
    title: '历史查看',
    detail: '「智能推荐」和「收益跟踪」页面支持按日期查看历史数据',
  },
]

export default function HomePage() {
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 fade-in-up">
      {/* ── Hero ── */}
      <div className="text-center mb-10 sm:mb-14">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium mb-5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          系统运行中
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-blue-700 mb-4 tracking-tight leading-tight">
          Quant<span className="text-amber-500">Forge</span>
        </h1>
        <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
          AI 驱动的 A 股量化分析平台 —— 每日市场报告、智能选股推荐、收益跟踪，一站式量化决策辅助
        </p>

        {stats && (
          <div className="mt-6 flex items-center justify-center gap-6 sm:gap-10 text-center">
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-blue-600">{stats.reportDays}</div>
              <div className="text-[11px] text-text-muted mt-0.5">近 90 天报告</div>
            </div>
            <div className="w-px h-8 bg-border-default" />
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-amber-500">{stats.recCount}</div>
              <div className="text-[11px] text-text-muted mt-0.5">累计推荐</div>
            </div>
            <div className="w-px h-8 bg-border-default" />
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-green-600">{stats.winRate}%</div>
              <div className="text-[11px] text-text-muted mt-0.5">胜率</div>
            </div>
          </div>
        )}
      </div>

      {/* ── 模块入口 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {features.map((f) => (
          <Link
            key={f.path}
            to={f.path}
            className={`stock-card p-5 bg-gradient-to-br ${f.color} border ${f.border} hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 group`}
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl sm:text-3xl shrink-0 mt-0.5">{f.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{f.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${f.badge}`}>核心</span>
                </div>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
              <div className="text-text-muted text-lg shrink-0 group-hover:translate-x-0.5 transition-transform">→</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── 快速上手 ── */}
      <div className="stock-card p-5 mb-5 border-l-4 border-l-blue-400">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>🚀</span> 快速上手
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((s) => (
            <Link
              key={s.title}
              to={s.link}
              className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group"
            >
              <div className="text-lg shrink-0 mt-0.5">{s.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{s.title}</div>
                <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{s.detail}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 小贴士 ── */}
      <div className="stock-card p-5 mb-5 border-l-4 border-l-amber-400">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>💡</span> 使用技巧
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tips.map((t) => (
            <div key={t.title} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100">
              <div className="text-lg shrink-0 mt-0.5">{t.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700">{t.title}</div>
                <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{t.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 数据流说明 ── */}
      <div className="stock-card p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-3">推荐生成流程</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 text-xs text-text-muted">
          {['THS 选股池 500+', '热度排名前 50', '取交集+主板过滤', '消息面分析', 'AI 精选 5 只'].map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              {i > 0 && <span className="hidden sm:inline text-slate-300 mx-1">→</span>}
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                {step}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-text-muted flex flex-wrap gap-x-4 gap-y-1">
          <span>⚡ 全流程 ~7 秒</span>
          <span>📡 同花顺 + 东方财富 + 腾讯财经</span>
          <span>🤖 MiniMax M2.7</span>
        </div>
      </div>
    </div>
  )
}

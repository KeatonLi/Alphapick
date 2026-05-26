import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api'

const features = [
  {
    path: '/report',
    icon: '📊',
    title: '市场报告',
    desc: '三大指数行情、热门板块分析、AI 撰写的市场日报，每日收盘后自动生成',
    color: 'from-blue-50 to-blue-100/50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    path: '/recommend',
    icon: '🎯',
    title: '智能推荐',
    desc: '同花顺选股池 × 东方财富热度排名 × 消息面分析，AI 精选最多 5 只主板标的',
    color: 'from-amber-50 to-amber-100/50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    path: '/tracking',
    icon: '📈',
    title: '收益跟踪',
    desc: '3 个交易日的持仓跟踪，自动更新现价和收益率，量化验证推荐质量',
    color: 'from-green-50 to-green-100/50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
  {
    path: '/settings',
    icon: '⚙️',
    title: '数据生成 & 调度',
    desc: '手动触发报告和推荐生成，配置定时任务，支持一键全部生成',
    color: 'from-purple-50 to-purple-100/50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
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

        {/* Stats */}
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

      {/* ── 数据流说明 ── */}
      <div className="stock-card p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200">
        <h3 className="text-sm font-bold text-slate-700 mb-3">工作流程</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 text-xs text-text-muted">
          {[
            'THS 选股池 500+',
            '热度排名前 50',
            '取交集 → 主板过滤',
            '消息面分析',
            'AI 精选 5 只',
          ].map((step, i) => (
            <>
              {i > 0 && <div className="hidden sm:block text-slate-300 mx-1">→</div>}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span>{step}</span>
              </div>
            </>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-text-muted">
          ⚡ 全流程 ~7 秒完成 · 数据来源：同花顺 + 东方财富 + 腾讯财经 · AI 模型：MiniMax M2.7
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface StockRec {
  stock_code: string
  stock_name: string
  recommend_price: number
  reason: string
}

interface Stats {
  total: number
  win_count: number
  win_rate: number
  avg_return: number
}

const rankBadges = [
  'bg-gradient-to-br from-yellow-500 to-amber-600 text-yellow-100 shadow-lg shadow-yellow-500/20',
  'bg-gradient-to-br from-slate-400 to-slate-500 text-slate-100 shadow-lg shadow-slate-400/20',
  'bg-gradient-to-br from-orange-600 to-orange-700 text-orange-100 shadow-lg shadow-orange-600/20',
  'bg-gradient-to-br from-blue-500 to-blue-600 text-blue-100 shadow-lg shadow-blue-500/20',
  'bg-gradient-to-br from-purple-500 to-purple-600 text-purple-100 shadow-lg shadow-purple-500/20',
]

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function DailyRecommend() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [availableDates, setAvailableDates] = useState<string[]>([])

  const fetchDates = async () => {
    try {
      const result = await apiGet<any>('/recommend/dates')
      setAvailableDates(result.data || [])
    } catch { /* ignore */ }
  }

  const fetchData = async (d: string) => {
    setLoading(true)
    setError('')
    try {
      const [recData, statsData] = await Promise.all([
        apiGet<any>(`/recommend/daily?date=${d}`),
        apiGet<any>('/recommend/stats'),
      ])
      setRecs(recData.data || [])
      setFromCache(recData.from_cache || false)
      setStats(statsData.data)
    } catch (e: any) {
      setError(e.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDates()
  }, [])

  useEffect(() => {
    fetchData(selectedDate)
  }, [selectedDate])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
          每日<span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">量化推荐</span>
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
          AI 基于动量因子、量价配合、趋势健康度等多维度筛选，每日精选潜力标的
        </p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
        <button
          onClick={() => {
            const idx = availableDates.indexOf(selectedDate)
            if (idx < availableDates.length - 1) setSelectedDate(availableDates[idx + 1])
          }}
          disabled={availableDates.indexOf(selectedDate) >= availableDates.length - 1}
          className="p-2 rounded-xl bg-bg-card border border-border-default text-text-secondary hover:text-text-primary hover:border-border-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={today}
            className="appearance-none bg-bg-card border border-border-default text-text-primary text-center px-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-amber-500/50 focus:shadow-[0_0_16px_rgba(245,158,11,0.15)] transition-all cursor-pointer [color-scheme:dark]"
          />
        </div>

        <button
          onClick={() => {
            const idx = availableDates.indexOf(selectedDate)
            if (idx > 0) setSelectedDate(availableDates[idx - 1])
          }}
          disabled={availableDates.indexOf(selectedDate) <= 0}
          className="p-2 rounded-xl bg-bg-card border border-border-default text-text-secondary hover:text-text-primary hover:border-border-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {availableDates.length > 0 && (
          <span className="text-xs text-text-muted">
            {availableDates.indexOf(selectedDate) + 1} / {availableDates.length} 天
          </span>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 fade-in-up">
          {[
            { label: '累计推荐', value: stats.total, icon: '📊', color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400' },
            { label: '盈利次数', value: stats.win_count, icon: '🎯', color: 'from-green-500/20 to-green-600/10', border: 'border-green-500/30', text: 'text-green-400' },
            { label: '胜率', value: `${stats.win_rate}%`, icon: '📈', color: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/30', text: 'text-orange-400' },
            { label: '平均收益率', value: `${stats.avg_return}%`, icon: '💎', color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', text: 'text-purple-400' },
          ].map((s, i) => (
            <div key={i} className={`glass-card p-5 text-center bg-gradient-to-br ${s.color} border ${s.border}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-2xl md:text-3xl font-extrabold ${s.text} count-in`}>{s.value}</div>
              <div className="text-xs text-text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      {/* Cache indicator */}
      {fromCache && (
        <div className="text-center mb-6">
          <span className="text-xs text-text-muted bg-bg-secondary px-3 py-1 rounded-full border border-border-default">
            {selectedDate === today ? '今日已生成推荐' : `${selectedDate} 的推荐数据`}
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Recommendation Cards */}
      <div className="space-y-4">
        {recs.map((rec, idx) => (
          <div key={idx} className="glass-card p-5 md:p-6 hover:translate-x-1 transition-all duration-300 fade-in-up group" style={{ animationDelay: `${idx * 80}ms` }}>
            <div className="flex items-start gap-4">
              {/* Rank Badge */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0 ${rankBadges[idx] || 'bg-gray-700 text-gray-300'}`}>
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{rec.stock_name}</span>
                  <span className="text-xs text-text-muted font-mono">{rec.stock_code}</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">{rec.reason || '量化模型筛选结果'}</p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold text-amber-400 font-mono tracking-tight">
                  {rec.recommend_price.toFixed(2)}
                </div>
                <div className="text-xs text-text-muted mt-1">推荐价格</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && recs.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📭</div>
          <div className="text-text-muted text-lg">暂无推荐数据</div>
          <div className="text-text-muted text-sm mt-1">该日期暂无推荐记录</div>
        </div>
      )}
    </div>
  )
}

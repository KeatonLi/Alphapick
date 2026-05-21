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
  'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-200',
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-lg shadow-slate-200',
  'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-200',
  'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-200',
  'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg shadow-purple-200',
]

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function DailyRecommend() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState('')
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [availableDates, setAvailableDates] = useState<string[]>([])

  const fetchDates = async () => {
    try {
      const result = await apiGet<any>('/recommend/dates')
      const dates = result.data || []
      setAvailableDates(dates)
      // 自动选择最近有数据的日期（列表已按最新日期排序，取第一个）
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0])
      }
    } catch { /* ignore */ }
  }

  const fetchData = async (d: string) => {
    if (!d) return
    setLoading(true)
    setError('')
    try {
      const recData = await apiGet<any>(`/recommend/daily?date=${d}`)
      setRecs(recData.data || [])
      setFromCache(recData.from_cache || false)
      // 只在查看今日推荐时加载统计（历史推荐数据不跟踪统计）
      if (d === today) {
        const statsData = await apiGet<any>('/recommend/stats')
        setStats(statsData.data)
      } else {
        setStats(null)
      }
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
    if (selectedDate) {
      fetchData(selectedDate)
    }
  }, [selectedDate])

  // availableDates 按最新日期排序 [today, yesterday, ...]
  const currentIdx = availableDates.indexOf(selectedDate)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-3 tracking-tight">
          每日<span className="text-amber-500">量化推荐</span>
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto text-sm leading-relaxed">
          AI 基于动量因子、量价配合、趋势健康度等多维度筛选，每日精选潜力标的
        </p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
        {/* Left arrow: go to older dates (higher index), disabled at oldest */}
        <button
          onClick={() => {
            const idx = currentIdx
            if (idx < availableDates.length - 1) setSelectedDate(availableDates[idx + 1])
          }}
          disabled={currentIdx >= availableDates.length - 1 || availableDates.length === 0}
          className="p-2 rounded-xl bg-white border border-border-default text-text-secondary hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const val = e.target.value
              if (val) setSelectedDate(val)
            }}
            max={today}
            className="appearance-none bg-white border border-border-default text-text-primary text-center px-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"
          />
        </div>

        {/* Right arrow: go to newer dates (lower index), disabled at newest */}
        <button
          onClick={() => {
            const idx = currentIdx
            if (idx > 0) setSelectedDate(availableDates[idx - 1])
          }}
          disabled={currentIdx <= 0 || availableDates.length === 0}
          className="p-2 rounded-xl bg-white border border-border-default text-text-secondary hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {availableDates.length > 0 && currentIdx >= 0 && (
          <span className="text-sm text-text-muted bg-blue-50 px-3 py-1 rounded-full">
            {currentIdx + 1} / {availableDates.length} 天
          </span>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 fade-in-up">
          {[
            { label: '累计推荐', value: stats.total, icon: '📊', color: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-600' },
            { label: '盈利次数', value: stats.win_count, icon: '🎯', color: 'from-green-50 to-green-100', border: 'border-green-200', text: 'text-green-600' },
            { label: '胜率', value: `${stats.win_rate}%`, icon: '📈', color: 'from-amber-50 to-amber-100', border: 'border-amber-200', text: 'text-amber-600' },
            { label: '平均收益率', value: `${stats.avg_return}%`, icon: '💎', color: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-600' },
          ].map((s, i) => (
            <div key={i} className={`stock-card p-5 text-center bg-gradient-to-br ${s.color} border ${s.border}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-2xl md:text-3xl font-extrabold ${s.text} count-in`}>{s.value}</div>
              <div className="text-xs text-text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      {/* Cache indicator */}
      {fromCache && (
        <div className="text-center mb-6">
          <span className="text-sm text-text-muted bg-blue-50 px-4 py-1.5 rounded-full border border-blue-200">
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
          <div key={idx} className="stock-card p-5 md:p-6 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300 fade-in-up group" style={{ animationDelay: `${idx * 80}ms` }}>
            <div className="flex items-start gap-4">
              {/* Rank Badge */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${rankBadges[idx] || 'bg-gray-400 text-white'}`}>
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-lg font-bold text-blue-800 group-hover:text-blue-600 transition-colors">{rec.stock_name}</span>
                  <span className="text-xs text-text-muted font-mono bg-blue-50 px-2 py-0.5 rounded">{rec.stock_code}</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">{rec.reason || '量化模型筛选结果'}</p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-amber-500 font-mono tracking-tight">
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
          {selectedDate === today ? (
            <div className="text-text-muted text-sm mt-1">今日推荐数据正在生成中，请稍后刷新重试</div>
          ) : (
            <div className="text-text-muted text-sm mt-1">该日期暂无推荐记录</div>
          )}
        </div>
      )}

      {/* Refresh Button (floating) */}
      <div className="fixed bottom-6 right-6">
        <button onClick={() => fetchData(selectedDate)} disabled={loading}
          className="w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 disabled:opacity-50 transition-all duration-300 flex items-center justify-center active:scale-90">
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  )
}

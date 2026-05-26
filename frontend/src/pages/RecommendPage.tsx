import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface StockRec { stock_code: string; stock_name: string; recommend_price: number; reason: string }
interface Stats { total: number; win_count: number; win_rate: number; avg_return: number }

function fmt(n: number, d = 2) { return n.toFixed(d) }

const rankBadges = [
  'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-200',
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
  'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
  'bg-gradient-to-br from-blue-400 to-blue-600 text-white',
  'bg-gradient-to-br from-purple-400 to-purple-600 text-white',
]

export default function RecommendPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [tradeDates, setTradeDates] = useState<string[]>([])
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<any>('/report/trade-dates?days=365')
      .then(d => { if (d.success) setTradeDates(d.data || []) })
      .catch(() => {})
  }, [])

  const loadData = async () => {
    if (!selectedDate) return
    setLoading(true); setError('')
    try {
      const [recRes, statsRes] = await Promise.all([
        apiGet<any>(`/recommend/daily?date=${selectedDate}`),
        apiGet<any>('/recommend/stats'),
      ])
      if (recRes.success) setRecs(recRes.data || [])
      else setError(recRes.error || '暂无推荐数据')
      if (statsRes.success) setStats(statsRes.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [selectedDate])

  const dateIdx = tradeDates.indexOf(selectedDate)
  const canPrev = dateIdx > 0
  const canNext = dateIdx >= 0 && dateIdx < tradeDates.length - 1

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero */}
      <div className="text-center mb-6 fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">
          量化<span className="text-amber-500">推荐</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary">热点筛选 × 消息面分析 → AI 精选</p>
      </div>

      {/* Date selector */}
      <div className="flex items-center justify-center gap-2 mb-5">
        <button onClick={() => setSelectedDate(tradeDates[dateIdx + 1])} disabled={!canNext}
          className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 disabled:opacity-25 transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          max={today} min={tradeDates.length ? tradeDates[tradeDates.length - 1] : ''}
          className="appearance-none bg-white border border-border-default text-text-primary text-center px-3 py-1.5 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm w-36"/>
        <button onClick={() => setSelectedDate(tradeDates[dateIdx - 1])} disabled={!canPrev}
          className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 disabled:opacity-25 transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
        <span className="text-xs text-text-muted bg-green-50 px-2.5 py-1 rounded-full border border-green-200 font-mono">{selectedDate}</span>
        <button onClick={loadData}
          className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      {/* Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          {[
            { label: '累计推荐', value: stats.total, color: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-600' },
            { label: '盈利次数', value: stats.win_count, color: 'from-green-50 to-green-100', border: 'border-green-200', text: 'text-green-600' },
            { label: '胜率', value: `${stats.win_rate}%`, color: 'from-amber-50 to-amber-100', border: 'border-amber-200', text: 'text-amber-600' },
            { label: '平均收益', value: `${stats.avg_return}%`, color: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-600' },
          ].map((s, i) => (
            <div key={i} className={`stock-card p-3 text-center bg-gradient-to-br ${s.color} border ${s.border}`}>
              <div className={`text-lg sm:text-xl font-extrabold ${s.text} mb-0.5`}>{s.value}</div>
              <div className="text-[11px] text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">{[0,1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-2xl"/>)}</div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {/* Empty */}
      {!loading && recs.length === 0 && !error && (
        <div className="text-center py-14 fade-in-up">
          <div className="text-5xl mb-3 opacity-60">📋</div>
          <div className="text-sm text-text-muted">该日期暂无量化推荐</div>
          <div className="text-xs text-text-muted mt-1">请先前往「<a href="/settings" className="text-blue-500 hover:underline">设置</a>」页面生成推荐</div>
        </div>
      )}

      {/* Recommendations */}
      {!loading && recs.length > 0 && (
        <div className="space-y-3">
          {recs.map((rec, idx) => (
            <div key={idx} className="stock-card p-4 sm:p-5 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 fade-in-up group"
              style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${rankBadges[idx] || 'bg-gray-400 text-white'}`}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-base sm:text-lg font-bold text-blue-800 group-hover:text-blue-600 transition-colors">{rec.stock_name}</span>
                    <span className="text-[11px] text-text-muted font-mono bg-blue-50 px-2 py-0.5 rounded">{rec.stock_code}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed line-clamp-2">{rec.reason || '量化模型筛选结果'}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl sm:text-2xl font-bold text-amber-500 font-mono tracking-tight">{fmt(rec.recommend_price)}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">推荐价格</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

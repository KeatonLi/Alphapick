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
  const [selectedDate, setSelectedDate] = useState(today)
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [availableDates, setAvailableDates] = useState<string[]>([])

  // 获取有报告的日期列表
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const result = await apiGet<any>('/recommend/dates')
        setAvailableDates(result.data || [])
      } catch {
        // ignore
      }
    }
    fetchDates()
  }, [])

  const generateReport = async () => {
    if (!selectedDate) return
    setLoading(true)
    setError('')
    setFromCache(false)
    try {
      const [recData, statsData] = await Promise.all([
        apiGet<any>(`/recommend/daily?date=${selectedDate}`),
        apiGet<any>('/recommend/stats'),
      ])
      setRecs(recData.data || [])
      setFromCache(recData.from_cache || false)
      setStats(statsData.data)
      setHasGenerated(true)
      // 如果是新生成的日期，加入列表
      if (!availableDates.includes(selectedDate)) {
        setAvailableDates(prev => [selectedDate, ...prev].sort().reverse())
      }
    } catch (e: any) {
      setError(e.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

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

      {/* Date Selector - 只显示有报告的日期 */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="text-sm text-text-muted">
          已生成报告的日期（绿色）
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {availableDates.length === 0 && (
            <span className="text-sm text-text-muted">暂无报告，请点击下方按钮生成</span>
          )}
          {availableDates.map(date => {
            const hasReport = true
            const isSelected = date === selectedDate
            const isToday = date === today
            return (
              <button
                key={date}
                onClick={() => {
                  setSelectedDate(date)
                  // 切换日期时直接获取该日期的报告
                  setLoading(true)
                  setError('')
                  setFromCache(false)
                  apiGet<any>(`/recommend/daily?date=${date}`)
                    .then(recData => {
                      setRecs(recData.data || [])
                      setFromCache(recData.from_cache || false)
                      setHasGenerated(true)
                      apiGet<any>('/recommend/stats').then(statsData => {
                        setStats(statsData.data)
                      }).catch(() => {})
                    })
                    .catch(() => {
                      setRecs([])
                      setHasGenerated(false)
                    })
                    .finally(() => setLoading(false))
                }}
                className={`
                  px-4 py-2 rounded-xl text-sm font-mono transition-all
                  ${isSelected
                    ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                    : hasReport
                    ? 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-400 border border-gray-200'
                  }
                  ${isToday && !isSelected ? 'ring-2 ring-amber-400 ring-offset-2' : ''}
                `}
              >
                {date.slice(5)}
                {isToday && <span className="ml-1 text-xs">今</span>}
              </button>
            )
          })}
        </div>

        {/* Generate Button */}
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={generateReport}
            disabled={loading || !selectedDate}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold text-sm hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-200 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                生成中...
              </>
            ) : availableDates.includes(selectedDate) ? '重新生成' : '生成报告'}
          </button>

          {fromCache && hasGenerated && (
            <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
              ✓ 来自缓存
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Recommendation Cards */}
      {!loading && recs.length > 0 && (
        <>
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

          {/* Date Badge */}
          <div className="text-center mb-6">
            <span className="text-sm font-mono font-semibold text-amber-600 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200">
              📅 {selectedDate} 推荐报告
            </span>
          </div>

          {/* Stock Cards */}
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
        </>
      )}

      {/* Empty State */}
      {!loading && recs.length === 0 && !error && !hasGenerated && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📋</div>
          <div className="text-text-muted text-lg">点击上方按钮生成今日推荐报告</div>
          <div className="text-text-muted text-sm mt-1">每日 15:30 后可生成当日报告</div>
        </div>
      )}
    </div>
  )
}

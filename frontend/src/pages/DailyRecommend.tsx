import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface IndexData {
  name: string
  code: string
  close: number
  change_pct: number
}

interface SectorData {
  name: string
  change_pct: number
  leading_stock: string
  driver?: string
}

interface MarketReportData {
  date: string
  market_summary: string
  index_data: IndexData[]
  hot_sectors: SectorData[]
  ai_report: string
}

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
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [report, setReport] = useState<MarketReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

  // 获取交易日列表（所有有报告的日期）
  useEffect(() => {
    const fetchDates = async () => {
      try {
        // 优先用交易日历，支持选择任意日期
        const tradeResult = await apiGet<any>('/report/trade-dates')
        if (tradeResult.data?.length > 0) {
          setAvailableDates(tradeResult.data)
          if (!availableDates.includes(selectedDate)) {
            setSelectedDate(tradeResult.data[0])
          }
          return
        }
        // fallback: 用有报告的日期
        const recResult = await apiGet<any>('/recommend/dates')
        setAvailableDates(recResult.data || [])
      } catch {
        // ignore
      }
    }
    fetchDates()
  }, [])

  // 获取指定日期的市场报告
  const fetchMarketReport = async (d: string) => {
    setReportLoading(true)
    try {
      const result = await apiGet<any>(`/report/daily?date=${d}`)
      if (result.success && result.data) {
        setReport(result.data)
      } else {
        setReport(null)
      }
    } catch {
      setReport(null)
    } finally {
      setReportLoading(false)
    }
  }

  // 获取指定日期的推荐股票
  const fetchRecs = async (d: string) => {
    setLoading(true)
    setError('')
    setFromCache(false)
    try {
      const [recData, statsData] = await Promise.all([
        apiGet<any>(`/recommend/daily?date=${d}`),
        apiGet<any>('/recommend/stats'),
      ])
      setRecs(recData.data || [])
      setFromCache(recData.from_cache || false)
      setStats(statsData.data)
      setHasGenerated(true)
    } catch (e: any) {
      setRecs([])
      setHasGenerated(false)
      if (e.message && !e.message.includes('404') && !e.message.includes('不存在')) {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // 切换日期时同时加载报告和推荐
  const handleDateChange = (d: string) => {
    setSelectedDate(d)
    fetchMarketReport(d)
    fetchRecs(d)
  }

  // 初始化时加载今天的数据
  useEffect(() => {
    if (availableDates.length > 0) {
      fetchMarketReport(selectedDate)
      fetchRecs(selectedDate)
    }
  }, [availableDates])

  const generateReport = async () => {
    if (!selectedDate) return
    handleDateChange(selectedDate)
  }

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

      {/* Date Selector - 完整交易日历 */}
      <div className="flex flex-col items-center gap-4 mb-8">
        {/* 日期按钮行 */}
        <div className="flex flex-wrap justify-center gap-2">
          {availableDates.slice(0, 20).map(date => {
            const isSelected = date === selectedDate
            const isToday = date === today
            return (
              <button
                key={date}
                onClick={() => handleDateChange(date)}
                className={`
                  px-3 py-1.5 rounded-xl text-sm font-mono transition-all
                  ${isSelected
                    ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                    : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
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

        {/* 日期切换器 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (currentIdx < availableDates.length - 1) {
                handleDateChange(availableDates[currentIdx + 1])
              }
            }}
            disabled={currentIdx >= availableDates.length - 1}
            className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            max={today}
            min={availableDates.length > 0 ? availableDates[availableDates.length - 1] : ''}
            className="appearance-none bg-white border border-border-default text-text-primary text-center px-3 py-1.5 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"
          />

          <button
            onClick={() => {
              if (currentIdx > 0) {
                handleDateChange(availableDates[currentIdx - 1])
              }
            }}
            disabled={currentIdx <= 0}
            className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold text-sm hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>

        {fromCache && hasGenerated && (
          <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            来自缓存
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {reportLoading && (
        <div className="space-y-4 max-w-2xl mx-auto mb-8">
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      )}

      {/* Market Report Section */}
      {!reportLoading && report && (
        <div className="mb-10 fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-cyan-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-blue-800">市场审计报告</h2>
            </div>
            <span className="text-xs text-text-muted bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 font-mono">
              {report.date}
            </span>
          </div>

          {/* Index summary */}
          {report.index_data?.length > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap justify-center">
              {report.index_data.map(idx => {
                const isUp = idx.change_pct >= 0
                return (
                  <div key={idx.code} className="flex items-center gap-2 bg-white border border-border-default rounded-xl px-4 py-2 shadow-sm">
                    <span className="text-xs text-text-muted">{idx.name}</span>
                    <span className="font-mono font-bold text-sm text-blue-800">{typeof idx.close === 'number' ? idx.close.toFixed(0) : idx.close}</span>
                    <span className={`text-xs font-bold ${isUp ? 'stock-up' : 'stock-down'}`}>
                      {isUp ? '+' : ''}{idx.change_pct}%
                    </span>
                  </div>
                )
              })}
              {report.market_summary && (
                <span className="flex items-center text-xs text-text-secondary bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  {report.market_summary}
                </span>
              )}
            </div>
          )}

          {/* Hot sectors */}
          {report.hot_sectors?.length > 0 && (
            <div className="bg-white border border-border-default rounded-2xl p-4 shadow-sm mb-4">
              <div className="text-xs font-semibold text-text-muted mb-2">热门板块</div>
              <div className="flex flex-wrap gap-2">
                {report.hot_sectors.slice(0, 6).map((s, i) => {
                  const isUp = s.change_pct >= 0
                  return (
                    <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1">
                      <span className="text-xs text-text-secondary">{s.name}</span>
                      <span className={`text-xs font-mono font-bold ${isUp ? 'stock-up' : 'stock-down'}`}>
                        {isUp ? '+' : ''}{s.change_pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI Report preview */}
          {report.ai_report && (
            <details className="bg-white border border-border-default rounded-2xl p-4 shadow-sm">
              <summary className="text-xs font-semibold text-text-muted cursor-pointer select-none hover:text-blue-600">
                AI 分析报告（点击展开）
              </summary>
              <div className="mt-3 text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                {report.ai_report.slice(0, 600)}{report.ai_report.length > 600 ? '...' : ''}
              </div>
            </details>
          )}
        </div>
      )}

      {/* No report state */}
      {!reportLoading && !report && hasGenerated && (
        <div className="text-center py-8 mb-6 text-sm text-text-muted">
          该日期暂无市场报告
        </div>
      )}

      {/* Stats Cards */}
      {!loading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 fade-in-up">
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

      {/* Stock Cards */}
      {!loading && recs.length > 0 && (
        <>
          <div className="text-center mb-6">
            <span className="text-sm font-mono font-semibold text-amber-600 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200">
              📅 {selectedDate} 量化推荐
            </span>
          </div>
          <div className="space-y-4">
            {recs.map((rec, idx) => (
              <div key={idx} className="stock-card p-5 md:p-6 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300 fade-in-up group" style={{ animationDelay: `${idx * 80}ms` }}>
                <div className="flex items-start gap-4">
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

      {/* No recs but has report */}
      {!loading && recs.length === 0 && hasGenerated && !error && report && (
        <div className="text-center py-12 text-text-muted">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm">该日期暂无量化推荐</div>
          <div className="text-xs mt-1">可查看上方市场报告</div>
        </div>
      )}
    </div>
  )
}

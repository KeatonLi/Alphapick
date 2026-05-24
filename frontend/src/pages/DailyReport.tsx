import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../services/api'

interface IndexData {
  name: string
  code: string
  close: number
  change_pct: number
  volume: number
}

interface SectorData {
  name: string
  change_pct: number
  leading_stock: string
  driver?: string
}

interface ReportData {
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

type GenerateStage = 'idle' | 'generating_report' | 'fetching_recs' | 'done' | 'error'

export default function DailyReport() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [availableDates, setAvailableDates] = useState<string[]>([])

  // Report state
  const [report, setReport] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  // Recommendations state
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsError, setRecsError] = useState('')
  const [fromCache, setFromCache] = useState(false)

  // Generate button state
  const [stage, setStage] = useState<GenerateStage>('idle')
  const [hasGenerated, setHasGenerated] = useState(false)

  // Load available dates
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const result = await apiGet<any>('/report/trade-dates')
        if (result.data?.length > 0) {
          setAvailableDates(result.data)
          return
        }
      } catch { /* ignore */ }
    }
    fetchDates()
  }, [])

  const currentIdx = availableDates.indexOf(selectedDate)

  const loadReport = async (d: string) => {
    setReportLoading(true)
    setReportError('')
    setReport(null)
    try {
      const result = await apiGet<any>(`/report/daily?date=${d}`)
      if (result.success && result.data) {
        setReport(result.data)
      } else {
        setReport(null)
      }
    } catch (e: any) {
      setReport(null)
    } finally {
      setReportLoading(false)
    }
  }

  const loadRecs = async (d: string) => {
    setRecsLoading(true)
    setRecsError('')
    setRecs([])
    try {
      const [recData, statsData] = await Promise.all([
        apiGet<any>(`/recommend/daily?date=${d}`),
        apiGet<any>('/recommend/stats'),
      ])
      if (recData.success) {
        setRecs(recData.data || [])
        setFromCache(recData.from_cache || false)
      } else {
        setRecs([])
        setRecsError(recData.error || '')
      }
      if (statsData.success) {
        setStats(statsData.data)
      }
    } catch (e: any) {
      setRecsError(e.message || '获取推荐失败')
    } finally {
      setRecsLoading(false)
    }
  }

  // Switch date: only load, don't generate
  const handleDateChange = (d: string) => {
    setSelectedDate(d)
    setStage('idle')
    setHasGenerated(false)
    loadReport(d)
    loadRecs(d)
  }

  // Init: load today's data
  useEffect(() => {
    if (availableDates.length > 0) {
      loadReport(selectedDate)
      loadRecs(selectedDate)
      setHasGenerated(true)
      setStage('done')
    }
  }, [availableDates])

  // Main generate button
  const handleGenerate = async () => {
    if (!selectedDate) return
    setHasGenerated(true)

    // Step 1: generate market report
    setStage('generating_report')
    setReportError('')
    try {
      await apiPost<any>(`/report/generate?date=${selectedDate}`)
    } catch (e: any) {
      // Report generation may fail if already exists — that's ok
    }
    await loadReport(selectedDate)

    // Step 2: fetch recommendations (may generate on-demand)
    setStage('fetching_recs')
    await loadRecs(selectedDate)

    setStage('done')
  }

  const generateBtnLabel = () => {
    if (stage === 'generating_report') return '生成市场报告中...'
    if (stage === 'fetching_recs') return '加载推荐数据...'
    if (stage === 'done' && fromCache) return '查看报告'
    if (stage === 'done') return '生成报告'
    return '生成报告'
  }

  const isGenerating = stage === 'generating_report' || stage === 'fetching_recs'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-3 tracking-tight">
          每日<span className="text-amber-500">量化报告</span>
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto text-sm leading-relaxed">
          选择日期，一键生成当日市场审计报告与量化推荐
        </p>
      </div>

      {/* Date Selector */}
      <div className="flex flex-col items-center gap-4 mb-8">
        {/* Quick date buttons */}
        <div className="flex flex-wrap justify-center gap-2">
          {availableDates.slice(0, 15).map(date => {
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
                {isToday && !isSelected && <span className="ml-1 text-xs">今</span>}
              </button>
            )
          })}
        </div>

        {/* Date picker row */}
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

          {/* Primary generate button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-6 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200 flex items-center gap-2"
          >
            {isGenerating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {generateBtnLabel()}
          </button>
        </div>

        {/* Cached indicator */}
        {stage === 'done' && fromCache && hasGenerated && (
          <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            来自缓存
          </span>
        )}
      </div>

      {/* Report Error */}
      {reportError && (
        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {reportError}
        </div>
      )}

      {/* ========== SECTION 1: Market Report ========== */}
      <div className="mb-10 fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-blue-800">市场审计报告</h2>
          {report?.date && (
            <span className="text-xs text-text-muted bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 font-mono ml-1">
              {report.date}
            </span>
          )}
        </div>

        {reportLoading ? (
          <div className="space-y-4">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
          </div>
        ) : report ? (
          <div className="space-y-5">
            {/* Index summary */}
            {report.index_data?.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.index_data.map((idx) => {
                    const isUp = idx.change_pct >= 0
                    return (
                      <div key={idx.code} className="stock-card p-5 text-center hover:shadow-lg hover:shadow-blue-100 transition-all">
                        <div className="text-sm text-text-muted mb-2">{idx.name}</div>
                        <div className="text-2xl font-extrabold text-blue-800 font-mono tracking-tight mb-2">
                          {typeof idx.close === 'number' ? idx.close.toFixed(2) : idx.close}
                        </div>
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${isUp ? 'stock-up-bg stock-up' : 'stock-down-bg stock-down'}`}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d={isUp ? 'M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z' : 'M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z'} clipRule="evenodd" />
                          </svg>
                          {isUp ? '+' : ''}{idx.change_pct}%
                        </div>
                      </div>
                    )
                  })}
                </div>
                {report.market_summary && (
                  <div className="text-center">
                    <span className="text-sm text-text-secondary bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                      {report.market_summary}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Hot sectors */}
            {report.hot_sectors?.length > 0 && (
              <div className="stock-card p-5">
                <div className="text-xs font-semibold text-text-muted mb-3">热门板块</div>
                <div className="divide-y divide-border-default">
                  {report.hot_sectors.map((s, i) => {
                    const isUp = s.change_pct >= 0
                    return (
                      <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 group hover:bg-blue-50 -mx-2 px-2 rounded-lg transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-text-muted font-mono w-5">{i + 1}</span>
                          <div>
                            <span className="font-medium text-blue-800 group-hover:text-blue-600 transition-colors">{s.name}</span>
                            {s.leading_stock && (
                              <span className="text-xs text-text-muted ml-2">领涨: {s.leading_stock}</span>
                            )}
                          </div>
                        </div>
                        <span className={`font-mono font-bold text-sm ${isUp ? 'stock-up' : 'stock-down'} shrink-0`}>
                          {isUp ? '+' : ''}{s.change_pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* AI analysis */}
            {report.ai_report && (
              <div className="stock-card p-5 md:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm shadow-cyan-200">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-text-muted">AI 市场分析</span>
                </div>
                <div className="text-text-secondary leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                  {report.ai_report}
                </div>
              </div>
            )}
          </div>
        ) : hasGenerated ? (
          <div className="text-center py-10 text-sm text-text-muted">
            该日期暂无市场报告
          </div>
        ) : null}
      </div>

      {/* ========== SECTION 2: Recommendations ========== */}
      <div className="fade-in-up">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-blue-800">今日量化推荐</h2>
          {recs.length > 0 && (
            <span className="text-xs text-text-muted bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              {selectedDate}
            </span>
          )}
        </div>

        {/* Stats */}
        {!recsLoading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: '累计推荐', value: stats.total, color: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-600' },
              { label: '盈利次数', value: stats.win_count, color: 'from-green-50 to-green-100', border: 'border-green-200', text: 'text-green-600' },
              { label: '胜率', value: `${stats.win_rate}%`, color: 'from-amber-50 to-amber-100', border: 'border-amber-200', text: 'text-amber-600' },
              { label: '平均收益', value: `${stats.avg_return}%`, color: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-600' },
            ].map((s, i) => (
              <div key={i} className={`stock-card p-4 text-center bg-gradient-to-br ${s.color} border ${s.border}`}>
                <div className={`text-xl md:text-2xl font-extrabold ${s.text} mb-0.5`}>{s.value}</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations loading */}
        {recsLoading && (
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Recommendations error */}
        {recsError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {recsError}
          </div>
        )}

        {/* Stock cards */}
        {!recsLoading && recs.length > 0 && (
          <div className="space-y-4">
            {recs.map((rec, idx) => (
              <div
                key={idx}
                className="stock-card p-5 md:p-6 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300 fade-in-up group"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${rankBadges[idx] || 'bg-gray-400 text-white'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-lg font-bold text-blue-800 group-hover:text-blue-600 transition-colors">{rec.stock_name}</span>
                      <span className="text-xs text-text-muted font-mono bg-blue-50 px-2 py-0.5 rounded">{rec.stock_code}</span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{rec.reason || '量化模型筛选结果'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-amber-500 font-mono tracking-tight">
                      {rec.recommend_price.toFixed(2)}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">推荐价格</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty: generated but no data */}
        {!recsLoading && recs.length === 0 && hasGenerated && !recsError && report && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-sm text-text-muted">该日期暂无量化推荐</div>
            <div className="text-xs text-text-muted mt-1">可查看上方市场报告</div>
          </div>
        )}

        {/* Initial empty state */}
        {!recsLoading && recs.length === 0 && !hasGenerated && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <div className="text-text-muted text-lg">点击上方「生成报告」按钮</div>
            <div className="text-text-muted text-sm mt-1">一次生成市场报告与量化推荐</div>
          </div>
        )}
      </div>
    </div>
  )
}

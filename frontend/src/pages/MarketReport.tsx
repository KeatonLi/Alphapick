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
  leading_stock?: string
  driver?: string
}

interface Charts {
  kline: string
  macd: string
  kdj: string
  sectors: string
  market_breadth: string
}

interface MarketBreadth {
  up: number
  down: number
  flat: number
  limit_up: number
  limit_down: number
}

interface ReportDetail {
  date: string
  indices: IndexData[]
  sectors: SectorData[]
  breadth: MarketBreadth
  charts: Charts
  ai_report: string
  market_summary: string
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function MarketReport() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState('')
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDates = async () => {
    try {
      const result = await apiGet<any>('/report/dates')
      const dates = result.data || []
      setAvailableDates(dates)
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0])
      }
    } catch { /* ignore */ }
  }

  const fetchReport = async (d: string) => {
    if (!d) return
    setLoading(true)
    setError('')
    try {
      const result = await apiGet<any>(`/report/detail?date=${d}`)
      if (result.success && result.data) {
        setReport(result.data)
      } else {
        setError(result.detail || '获取报告失败')
        setReport(null)
      }
    } catch (e: any) {
      setError(e.message || '请求失败')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDates()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      fetchReport(selectedDate)
    }
  }, [selectedDate])

  const currentIdx = availableDates.indexOf(selectedDate)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-3 tracking-tight">
          每日市场<span className="text-cyan-500">审计报告</span>
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto text-sm leading-relaxed">
          每日收盘后自动生成，AI 综合分析三大指数、热门板块、资金流向
        </p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
        {/* Left: older dates */}
        <button
          onClick={() => {
            if (currentIdx < availableDates.length - 1) setSelectedDate(availableDates[currentIdx + 1])
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
            min={availableDates.length > 0 ? availableDates[availableDates.length - 1] : ''}
            className="appearance-none bg-white border border-border-default text-text-primary text-center px-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"
          />
        </div>

        {/* Right: newer dates */}
        <button
          onClick={() => {
            if (currentIdx > 0) setSelectedDate(availableDates[currentIdx - 1])
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
            {currentIdx + 1} / {availableDates.length} 篇报告
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-36 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      )}

      {report && !loading && (
        <div className="space-y-6 fade-in-up">
          {/* Date Badge */}
          <div className="text-center">
            <span className="text-sm font-mono font-semibold text-blue-700 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-200">
              {report.date}
            </span>
          </div>

          {/* Index Cards + Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Index Cards */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="text-lg font-bold text-blue-800">主要指数</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {report.indices.map((idx) => {
                  const isUp = idx.change_pct >= 0
                  return (
                    <div key={idx.code} className="stock-card p-4 text-center hover:shadow-lg hover:shadow-blue-100 transition-all">
                      <div className="text-sm text-text-muted mb-1">{idx.name}</div>
                      <div className="text-xl font-extrabold text-blue-800 font-mono tracking-tight mb-1">
                        {idx.close.toFixed(2)}
                      </div>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${isUp ? 'stock-up' : 'stock-down'}`}>
                        {isUp ? '+' : ''}{idx.change_pct.toFixed(2)}%
                      </div>
                    </div>
                  )
                })}
              </div>
              {report.market_summary && (
                <div className="mt-3 text-center">
                  <span className="text-sm text-text-secondary bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                    {report.market_summary}
                  </span>
                </div>
              )}
            </div>

            {/* Market Breadth */}
            <div className="stock-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>
                </div>
                <h2 className="text-lg font-bold text-blue-800">市场广度</h2>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: '涨停', value: report.breadth?.limit_up || 0, color: 'text-amber-500' },
                  { label: '上涨', value: report.breadth?.up || 0, color: 'text-red-500' },
                  { label: '平盘', value: report.breadth?.flat || 0, color: 'text-text-muted' },
                  { label: '下跌', value: report.breadth?.down || 0, color: 'text-green-600' },
                  { label: '跌停', value: report.breadth?.limit_down || 0, color: 'text-blue-500' },
                ].map(s => (
                  <div key={s.label} className="p-2 bg-blue-50 rounded-lg">
                    <div className={`text-lg font-extrabold ${s.color}`}>{s.value.toLocaleString()}</div>
                    <div className="text-xs text-text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts */}
          {report.charts && (report.charts.kline || report.charts.macd || report.charts.kdj) && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-blue-800">技术图表</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {report.charts.kline && (
                  <div className="stock-card p-4">
                    <div className="text-sm font-semibold text-blue-700 mb-3">上证指数 K 线 + MA</div>
                    <img src={`data:image/png;base64,${report.charts.kline}`} alt="K线图" className="w-full rounded-lg" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.charts.macd && (
                    <div className="stock-card p-4">
                      <div className="text-sm font-semibold text-blue-700 mb-3">MACD 指标</div>
                      <img src={`data:image/png;base64,${report.charts.macd}`} alt="MACD" className="w-full rounded-lg" />
                    </div>
                  )}
                  {report.charts.kdj && (
                    <div className="stock-card p-4">
                      <div className="text-sm font-semibold text-blue-700 mb-3">KDJ 指标</div>
                      <img src={`data:image/png;base64,${report.charts.kdj}`} alt="KDJ" className="w-full rounded-lg" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sector Charts + Breadth */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sector Ranking */}
            {report.sectors.length > 0 && (
              <div className="stock-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" /></svg>
                  </div>
                  <h2 className="text-lg font-bold text-blue-800">热门板块</h2>
                </div>
                {report.charts.sectors ? (
                  <img src={`data:image/png;base64,${report.charts.sectors}`} alt="板块排行" className="w-full rounded-lg" />
                ) : (
                  <div className="divide-y divide-border-default">
                    {report.sectors.slice(0, 8).map((s, i) => {
                      const isUp = s.change_pct >= 0
                      return (
                        <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 group hover:bg-blue-50 -mx-2 px-2 rounded-lg transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-text-muted font-mono w-5">{i + 1}</span>
                            <div>
                              <span className="font-medium text-blue-800 group-hover:text-blue-600 transition-colors text-sm">{s.name}</span>
                              {s.leading_stock && (
                                <span className="text-xs text-text-muted ml-2">领涨: {s.leading_stock}</span>
                              )}
                            </div>
                          </div>
                          <span className={`font-mono font-bold text-sm ${isUp ? 'stock-up' : 'stock-down'} shrink-0`}>
                            {isUp ? '+' : ''}{s.change_pct.toFixed(2)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Market Breadth Chart */}
            {report.charts.market_breadth ? (
              <div className="stock-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-blue-800">涨跌家数统计</h2>
                </div>
                <img src={`data:image/png;base64,${report.charts.market_breadth}`} alt="涨跌家数" className="w-full rounded-lg" />
              </div>
            ) : null}
          </div>

          {/* AI Report */}
          {report.ai_report && (
            <div className="stock-card p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border-default">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-200">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-blue-800">AI 市场分析</h3>
              </div>
              <div className="text-text-secondary leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                {report.ai_report}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !report && availableDates.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📭</div>
          <div className="text-text-muted text-lg">暂无市场报告</div>
          <div className="text-text-muted text-sm mt-1">报告在每个交易日收盘后自动生成</div>
        </div>
      )}
    </div>
  )
}

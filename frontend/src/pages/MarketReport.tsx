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

interface ReportData {
  date: string
  market_summary: string
  index_data: IndexData[]
  hot_sectors: SectorData[]
  ai_report: string
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function MarketReport() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [report, setReport] = useState<ReportData | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDates = async () => {
    try {
      const result = await apiGet<any>('/report/dates')
      setAvailableDates(result.data || [])
    } catch { /* ignore */ }
  }

  const fetchReport = async (d: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await apiGet<any>(`/report/daily?date=${d}`)
      setReport(result.data)
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
    fetchReport(selectedDate)
  }, [selectedDate])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
          每日市场<span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">审计报告</span>
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
          每日收盘后自动生成，AI 综合分析三大指数、热门板块、资金流向
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
          className="p-2 rounded-xl bg-bg-card border border-border-default text-slate-400 hover:text-white hover:border-border-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
            className="appearance-none bg-bg-card border border-border-default text-white text-center px-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_16px_rgba(6,182,212,0.15)] transition-all cursor-pointer [color-scheme:dark]"
          />
        </div>

        <button
          onClick={() => {
            const idx = availableDates.indexOf(selectedDate)
            if (idx > 0) setSelectedDate(availableDates[idx - 1])
          }}
          disabled={availableDates.indexOf(selectedDate) <= 0}
          className="p-2 rounded-xl bg-bg-card border border-border-default text-slate-400 hover:text-white hover:border-border-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {availableDates.length > 0 && (
          <span className="text-xs text-slate-600">
            {availableDates.indexOf(selectedDate) + 1} / {availableDates.length} 篇报告
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
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
            <span className="text-sm font-mono font-semibold text-white bg-bg-secondary px-4 py-1.5 rounded-full border border-border-default">
              {report.date}
            </span>
          </div>

          {/* Index Cards */}
          {report.index_data.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="text-lg font-bold text-white">主要指数</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {report.index_data.map((idx) => {
                  const isUp = idx.change_pct >= 0
                  return (
                    <div key={idx.code} className="glass-card p-5 text-center hover:scale-[1.02] transition-transform">
                      <div className="text-sm text-slate-400 mb-2">{idx.name}</div>
                      <div className="text-2xl font-extrabold text-white font-mono tracking-tight mb-2">
                        {idx.close.toFixed(2)}
                      </div>
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${
                        isUp ? 'bg-stock-up-bg text-stock-up' : 'bg-stock-down-bg text-stock-down'
                      }`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d={isUp
                            ? 'M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z'
                            : 'M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z'}
                          clipRule="evenodd" />
                        </svg>
                        {isUp ? '+' : ''}{idx.change_pct}%
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 text-center">
                <span className="text-sm text-slate-500 bg-bg-secondary px-4 py-1.5 rounded-full border border-border-default">
                  {report.market_summary}
                </span>
              </div>
            </div>
          )}

          {/* Hot Sectors */}
          {report.hot_sectors.length > 0 && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-md bg-orange-500/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20"><path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="text-lg font-bold text-white">热门板块</h2>
              </div>
              <div className="divide-y divide-border-default">
                {report.hot_sectors.map((s, i) => {
                  const isUp = s.change_pct >= 0
                  return (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 group hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-slate-600 font-mono w-5">{i + 1}</span>
                        <div>
                          <span className="font-medium text-slate-200 group-hover:text-white transition-colors">{s.name}</span>
                          {s.leading_stock && (
                            <span className="text-xs text-slate-600 ml-2">领涨: {s.leading_stock}</span>
                          )}
                          {s.driver && (
                            <div className="text-xs text-slate-600 mt-0.5 truncate max-w-xs">{s.driver}</div>
                          )}
                        </div>
                      </div>
                      <span className={`font-mono font-bold text-sm ${isUp ? 'text-stock-up' : 'text-stock-down'} shrink-0`}>
                        {isUp ? '+' : ''}{s.change_pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI Report */}
          <div className="glass-card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border-default">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">AI 市场分析</h3>
            </div>
            <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
              {report.ai_report}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

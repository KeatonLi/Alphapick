import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface IndexData { name: string; code: string; close: number; change_pct: number }
interface SectorData { name: string; change_pct: number; leading_stock: string; driver?: string }
interface ReportData {
  date: string; market_summary: string; index_data: IndexData[]; hot_sectors: SectorData[]; ai_report: string
}

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className || 'h-36'}`} />
}

function EmptyState({ icon, text, action }: { icon: string; text: string; action?: string }) {
  return (
    <div className="text-center py-16 fade-in-up">
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <div className="text-sm text-text-muted">{text}</div>
      {action && <div className="text-xs text-text-muted mt-1.5">{action}</div>}
    </div>
  )
}

export default function ReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [tradeDates, setTradeDates] = useState<string[]>([])
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiGet<any>('/report/trade-dates?days=365')
      .then(d => { if (d.success) setTradeDates(d.data || []) })
      .catch(() => {})
  }, [])

  const loadReport = async (d: string) => {
    setLoading(true)
    try {
      const r = await apiGet<any>(`/report/daily?date=${d}`)
      setReport(r.success ? r.data : null)
    } catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (selectedDate) loadReport(selectedDate) }, [selectedDate])

  const dateIdx = tradeDates.indexOf(selectedDate)
  const canPrev = dateIdx > 0
  const canNext = dateIdx >= 0 && dateIdx < tradeDates.length - 1

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero */}
      <div className="text-center mb-6 fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">
          每日<span className="text-amber-500">市场报告</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary">三大指数 · 热门板块 · AI 市场分析</p>
      </div>

      {/* Date selector */}
      <div className="flex items-center justify-center gap-2 mb-6">
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
        <button onClick={() => loadReport(selectedDate)}
          className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0,1,2].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-48" />
        </div>
      )}

      {/* Empty */}
      {!loading && !report && (
        <EmptyState icon="📋" text="暂无市场报告" action="请前往「一键生成」页面生成报告" />
      )}

      {/* Content */}
      {!loading && report && (
        <div className="space-y-4 fade-in-up">
          {/* Index cards */}
          {report.index_data?.length > 0 && (
            <div className="stock-card p-4 sm:p-5">
              <div className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                主要指数
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {report.index_data.map(idx => {
                  const up = idx.change_pct >= 0
                  return (
                    <div key={idx.code} className="text-center p-4 bg-blue-50/50 rounded-xl hover:shadow-md transition-all">
                      <div className="text-xs text-text-muted mb-1.5">{idx.name}</div>
                      <div className="text-xl sm:text-2xl font-extrabold text-blue-800 font-mono mb-1.5">
                        {typeof idx.close === 'number' ? fmt(idx.close) : idx.close}
                      </div>
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${up ? 'stock-up-bg stock-up' : 'stock-down-bg stock-down'}`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d={up ? 'M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z' : 'M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z'} clipRule="evenodd" />
                        </svg>
                        {fmtRate(idx.change_pct)}
                      </div>
                    </div>
                  )
                })}
              </div>
              {report.market_summary && (
                <div className="text-center mt-3">
                  <span className="text-xs text-text-secondary bg-blue-50/80 px-3 py-1.5 rounded-full border border-blue-100">{report.market_summary}</span>
                </div>
              )}
            </div>
          )}

          {/* Hot sectors */}
          {report.hot_sectors?.length > 0 && (
            <div className="stock-card p-4 sm:p-5">
              <div className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                热门板块
              </div>
              <div className="divide-y divide-border-default/60">
                {report.hot_sectors.map((s, i) => {
                  const up = s.change_pct >= 0
                  return (
                    <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 group hover:bg-blue-50/50 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs text-text-muted font-mono w-4 shrink-0">{i + 1}</span>
                        <span className="font-medium text-blue-800 group-hover:text-blue-600 transition-colors text-sm truncate">{s.name}</span>
                        {s.leading_stock && <span className="text-[11px] text-text-muted hidden sm:inline truncate">领涨 {s.leading_stock}</span>}
                      </div>
                      <span className={`font-mono font-bold text-sm shrink-0 ${up ? 'stock-up' : 'stock-down'}`}>{fmtRate(s.change_pct)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI analysis */}
          {report.ai_report && (
            <div className="stock-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm shadow-cyan-200">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-text-muted">AI 市场分析</span>
              </div>
              <div className="text-text-secondary leading-relaxed whitespace-pre-wrap text-sm">{report.ai_report}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../services/api'

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
  html_report_path?: string | null
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function MarketReport() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'react' | 'html'>('react')
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [htmlAvailable, setHtmlAvailable] = useState(false)

  const fetchDates = async () => {
    try {
      let result = await apiGet<any>('/report/trade-dates')
      if (result.data && result.data.length > 0) {
        setAvailableDates(result.data)
        if (!selectedDate) {
          setSelectedDate(result.data[0])
        }
      } else {
        result = await apiGet<any>('/report/dates')
        const dates = result.data || []
        setAvailableDates(dates)
        if (dates.length > 0 && !selectedDate) {
          setSelectedDate(dates[0])
        }
      }
    } catch { /* ignore */ }
  }

  const fetchReport = async (d: string) => {
    if (!d) return
    setLoading(true)
    setError('')
    try {
      const result = await apiGet<any>(`/report/daily?date=${d}`)
      if (result.data?.date) {
        setReport(result.data)
        setHtmlAvailable(!!result.data.html_report_path)
      } else if (result.detail) {
        setError(result.detail)
        setReport(null)
        setHtmlAvailable(false)
      } else {
        setError('获取报告失败')
        setReport(null)
        setHtmlAvailable(false)
      }
    } catch (e: any) {
      setError(e.message || '请求失败')
      setReport(null)
      setHtmlAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  const generateHtmlReport = async () => {
    if (!selectedDate) return
    setHtmlLoading(true)
    try {
      const result = await apiPost<any>(`/report/generate?date=${selectedDate}`)
      if (result.success || (result.data && result.data.html_path)) {
        setHtmlAvailable(true)
        setViewMode('html')
      }
    } catch (e: any) {
      setError('生成HTML报告失败: ' + (e.message || ''))
    } finally {
      setHtmlLoading(false)
    }
  }

  useEffect(() => {
    fetchDates()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      fetchReport(selectedDate)
      setViewMode('react')
    }
  }, [selectedDate])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-3 tracking-tight">
          每日市场<span className="text-cyan-500">审计报告</span>
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto text-sm leading-relaxed">
          每日收盘后自动生成，AI 综合分析三大指数、热门板块，资金流向
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
            onChange={(e) => setSelectedDate(e.target.value)}
            max={today}
            min={availableDates.length > 0 ? availableDates[availableDates.length - 1] : ''}
            className="appearance-none bg-white border border-border-default text-text-primary text-center px-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"
          />
        </div>

        <button
          onClick={() => {
            const idx = availableDates.indexOf(selectedDate)
            if (idx > 0) setSelectedDate(availableDates[idx - 1])
          }}
          disabled={availableDates.indexOf(selectedDate) <= 0}
          className="p-2 rounded-xl bg-white border border-border-default text-text-secondary hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {availableDates.length > 0 && (
          <span className="text-sm text-text-muted bg-blue-50 px-3 py-1 rounded-full">
            {availableDates.indexOf(selectedDate) + 1} / {availableDates.length} 篇报告
          </span>
        )}
      </div>

      {/* View Mode Toggle + HTML Actions */}
      {report && !loading && (
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="inline-flex rounded-xl border border-border-default overflow-hidden shadow-sm">
            <button
              onClick={() => setViewMode('react')}
              className={`px-4 py-2 text-sm font-medium transition-all ${viewMode === 'react' ? 'bg-blue-600 text-white' : 'bg-white text-text-secondary hover:bg-blue-50'}`}
            >
              React 视图
            </button>
            <button
              onClick={() => setViewMode('html')}
              disabled={!htmlAvailable}
              className={`px-4 py-2 text-sm font-medium transition-all border-l border-border-default ${viewMode === 'html' ? 'bg-blue-600 text-white' : 'bg-white text-text-secondary hover:bg-blue-50'} ${!htmlAvailable ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              HTML 报告
            </button>
          </div>

          {!htmlAvailable && report.date && (
            <button
              onClick={generateHtmlReport}
              disabled={htmlLoading}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
            >
              {htmlLoading ? '生成中...' : '生成 HTML 报告'}
            </button>
          )}

          {htmlAvailable && (
            <a
              href={`/api/report/html?date=${selectedDate}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-sm inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              新窗口打开
            </a>
          )}
        </div>
      )}

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

      {/* HTML iframe view */}
      {viewMode === 'html' && htmlAvailable && !loading && (
        <div className="fade-in-up">
          <iframe
            src={`/api/report/html?date=${selectedDate}`}
            title="市场报告 HTML"
            className="w-full border-0 rounded-2xl shadow-lg"
            style={{ height: '85vh', minHeight: '600px' }}
          />
        </div>
      )}

      {/* React view */}
      {report && !loading && viewMode === 'react' && (
        <div className="space-y-6 fade-in-up">
          {/* Date Badge */}
          <div className="text-center">
            <span className="text-sm font-mono font-semibold text-blue-700 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-200">
              {report.date}
            </span>
          </div>

          {/* Index Cards */}
          {report.index_data.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="text-lg font-bold text-blue-800">主要指数</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {report.index_data.map((idx) => {
                  const isUp = idx.change_pct >= 0
                  return (
                    <div key={idx.code} className="stock-card p-5 text-center hover:shadow-lg hover:shadow-blue-100 transition-all">
                      <div className="text-sm text-text-muted mb-2">{idx.name}</div>
                      <div className="text-2xl font-extrabold text-blue-800 font-mono tracking-tight mb-2">
                        {idx.close.toFixed(2)}
                      </div>
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${
                        isUp ? 'stock-up-bg stock-up' : 'stock-down-bg stock-down'
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
              <div className="mt-4 text-center">
                <span className="text-sm text-text-secondary bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                  {report.market_summary}
                </span>
              </div>
            </div>
          )}

          {/* Hot Sectors */}
          {report.hot_sectors.length > 0 && (
            <div className="stock-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="text-lg font-bold text-blue-800">热门板块</h2>
              </div>
              <div className="divide-y divide-border-default">
                {report.hot_sectors.map((s, i) => {
                  const isUp = s.change_pct >= 0
                  return (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 group hover:bg-blue-50 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-text-muted font-mono w-6">{i + 1}</span>
                        <div>
                          <span className="font-medium text-blue-800 group-hover:text-blue-600 transition-colors">{s.name}</span>
                          {s.leading_stock && (
                            <span className="text-xs text-text-muted ml-2">领涨: {s.leading_stock}</span>
                          )}
                          {s.driver && (
                            <div className="text-xs text-text-muted mt-0.5 truncate max-w-xs">{s.driver}</div>
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

          {/* AI Report */}
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
        </div>
      )}
    </div>
  )
}

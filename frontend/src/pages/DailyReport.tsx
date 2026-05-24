import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface IndexData {
  name: string; code: string; close: number; change_pct: number
}
interface SectorData {
  name: string; change_pct: number; leading_stock: string; driver?: string
}
interface ReportData {
  date: string; market_summary: string; index_data: IndexData[]; hot_sectors: SectorData[]; ai_report: string
}
interface StockRec {
  stock_code: string; stock_name: string; recommend_price: number; reason: string
}
interface HistoryRec extends StockRec {
  id: number; recommend_date: string; current_price: number; return_rate: number
}
interface Stats { total: number; win_count: number; win_rate: number; avg_return: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) { return n.toFixed(decimals) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }

// ─── Tab 1: 市场审计报告 ─────────────────────────────────────────────────

function MarketReportTab({ report, loading }: { report: ReportData | null; loading: boolean }) {
  if (loading) return <div className="space-y-4"><div className="skeleton h-48 rounded-2xl"/><div className="skeleton h-36 rounded-2xl"/></div>
  if (!report) return <div className="text-center py-16 text-text-muted">暂无市场报告</div>

  return (
    <div className="space-y-5 fade-in-up">
      {/* Index cards */}
      {report.index_data?.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {report.index_data.map(idx => {
              const up = idx.change_pct >= 0
              return (
                <div key={idx.code} className="stock-card p-5 text-center hover:shadow-lg transition-all">
                  <div className="text-sm text-text-muted mb-2">{idx.name}</div>
                  <div className="text-2xl font-extrabold text-blue-800 font-mono mb-2">{typeof idx.close === 'number' ? fmt(idx.close) : idx.close}</div>
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${up ? 'stock-up-bg stock-up' : 'stock-down-bg stock-down'}`}>
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
              <span className="text-sm text-text-secondary bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">{report.market_summary}</span>
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
              const up = s.change_pct >= 0
              return (
                <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 group hover:bg-blue-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted font-mono w-5">{i + 1}</span>
                    <span className="font-medium text-blue-800 group-hover:text-blue-600 transition-colors">{s.name}</span>
                    {s.leading_stock && <span className="text-xs text-text-muted">领涨: {s.leading_stock}</span>}
                  </div>
                  <span className={`font-mono font-bold text-sm ${up ? 'stock-up' : 'stock-down'}`}>{fmtRate(s.change_pct)}</span>
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
          <div className="text-text-secondary leading-relaxed whitespace-pre-wrap text-sm md:text-base">{report.ai_report}</div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: 量化推荐 ───────────────────────────────────────────────────────

const rankBadges = [
  'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-200',
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
  'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
  'bg-gradient-to-br from-blue-400 to-blue-600 text-white',
  'bg-gradient-to-br from-purple-400 to-purple-600 text-white',
]

function RecommendationsTab({ date }: { date: string }) {
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [recRes, statsRes] = await Promise.all([
        apiGet<any>(`/recommend/daily?date=${date}`),
        apiGet<any>('/recommend/stats'),
      ])
      if (recRes.success) setRecs(recRes.data || [])
      else setError(recRes.error || '暂无推荐数据')
      if (statsRes.success) setStats(statsRes.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  return (
    <div className="space-y-5 fade-in-up">
      {/* Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {loading && <div className="space-y-4">{[0,1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-2xl"/>)}</div>}

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      {!loading && recs.length > 0 && (
        <div className="space-y-4">
          {recs.map((rec, idx) => (
            <div key={idx} className="stock-card p-5 md:p-6 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300 fade-in-up group"
              style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${rankBadges[idx] || 'bg-gray-400 text-white'}`}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-lg font-bold text-blue-800 group-hover:text-blue-600 transition-colors">{rec.stock_name}</span>
                    <span className="text-xs text-text-muted font-mono bg-blue-50 px-2 py-0.5 rounded">{rec.stock_code}</span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{rec.reason || '量化模型筛选结果'}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-amber-500 font-mono tracking-tight">{fmt(rec.recommend_price)}</div>
                  <div className="text-xs text-text-muted mt-0.5">推荐价格</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && recs.length === 0 && !error && (
        <div className="text-center py-16 text-text-muted">
          <div className="text-5xl mb-4">📋</div>
          <div className="text-sm">该日期暂无量化推荐</div>
          <div className="text-xs mt-1">推荐数据由每日 16:00 自动生成</div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: 收益跟踪 ───────────────────────────────────────────────────────

function TrackingTab() {
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    apiGet<any>('/recommend/history')
      .then(d => { if (d.success) setRecs(d.data || []); else setError(d.error || '') })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Group by date
  const grouped = recs.reduce<Record<string, HistoryRec[]>>((acc, r) => {
    (acc[r.recommend_date] ||= []).push(r)
    return acc
  }, {})
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6 fade-in-up">
      {loading && <div className="space-y-4">{[0,1,2].map(i => <div key={i} className="skeleton h-32 rounded-2xl"/>)}</div>}
      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      {!loading && dates.length === 0 && !error && (
        <div className="text-center py-16 text-text-muted">
          <div className="text-5xl mb-4">📈</div>
          <div className="text-sm">暂无历史推荐数据</div>
        </div>
      )}

      {!loading && dates.map(date => (
        <div key={date} className="stock-card overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-border-default flex items-center justify-between">
            <span className="text-sm font-bold text-blue-700 font-mono">{date}</span>
            <span className="text-xs text-text-muted">{grouped[date].length} 只</span>
          </div>
          <div className="divide-y divide-border-default">
            {grouped[date].map((rec) => {
              const rate = rec.return_rate || 0
              const up = rate >= 0
              return (
                <div key={rec.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 transition-colors">
                  <div className="w-20 shrink-0">
                    <div className="font-bold text-blue-800 text-sm">{rec.stock_name}</div>
                    <div className="text-xs text-text-muted font-mono">{rec.stock_code}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-secondary line-clamp-1">{rec.reason || '—'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-text-muted">推荐价</div>
                    <div className="font-mono font-bold text-sm">{fmt(rec.recommend_price)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-text-muted">现价</div>
                    <div className="font-mono font-bold text-sm">
                      {rec.current_price > 0 ? fmt(rec.current_price) : <span className="text-text-muted">—</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <div className="text-xs text-text-muted">累计收益</div>
                    <div className={`font-mono font-bold text-sm ${rec.current_price > 0 ? (up ? 'text-green-600' : 'text-red-500') : 'text-text-muted'}`}>
                      {rec.current_price > 0 ? fmtRate(rate) : '—'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

type Tab = 'report' | 'recommend' | 'track'

export default function DailyReport() {
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab] = useState<Tab>('report')
  const [selectedDate, setSelectedDate] = useState(today)
  const [tradeDates, setTradeDates] = useState<string[]>([])
  const [report, setReport] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    apiGet<any>('/report/trade-dates?days=365')
      .then(d => { if (d.success) setTradeDates(d.data || []) })
      .catch(() => {})
  }, [])

  const loadReport = async (d: string) => {
    setReportLoading(true)
    try {
      const r = await apiGet<any>(`/report/daily?date=${d}`)
      setReport(r.success ? r.data : null)
    } catch { setReport(null) }
    finally { setReportLoading(false) }
  }

  useEffect(() => { if (tradeDates.length) loadReport(selectedDate) }, [tradeDates, selectedDate, refreshKey])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'report', label: '市场审计报告' },
    { key: 'recommend', label: '量化推荐' },
    { key: 'track', label: '收益跟踪' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Hero */}
      <div className="text-center mb-8 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-2 tracking-tight">
          每日<span className="text-amber-500">量化报告</span>
        </h1>
        <p className="text-text-secondary text-sm">每日 16:00 自动生成，数据仅供参考</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border-default mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-text-muted hover:text-blue-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date selector — only on report + recommend tabs */}
      {(tab === 'report' || tab === 'recommend') && (
        <div className="flex items-center justify-center gap-3 mb-6">
          <button onClick={() => {
            const idx = tradeDates.indexOf(selectedDate)
            if (idx < tradeDates.length - 1) setSelectedDate(tradeDates[idx + 1])
          }} disabled={tradeDates.indexOf(selectedDate) >= tradeDates.length - 1}
            className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>

          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            max={today} min={tradeDates.length ? tradeDates[tradeDates.length - 1] : ''}
            className="appearance-none bg-white border border-border-default text-text-primary text-center px-4 py-2 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"/>

          <button onClick={() => {
            const idx = tradeDates.indexOf(selectedDate)
            if (idx > 0) setSelectedDate(tradeDates[idx - 1])
          }} disabled={tradeDates.indexOf(selectedDate) <= 0}
            className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>

          <button onClick={() => setRefreshKey(k => k + 1)}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            刷新
          </button>

          <span className="text-xs text-text-muted bg-green-50 px-2.5 py-1 rounded-full border border-green-200 font-mono">{selectedDate}</span>
        </div>
      )}

      {/* Tab content */}
      {tab === 'report' && <MarketReportTab report={report} loading={reportLoading}/>}
      {tab === 'recommend' && <RecommendationsTab date={selectedDate}/>}
      {tab === 'track' && <TrackingTab/>}

    </div>
  )
}

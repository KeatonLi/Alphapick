import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface HistoryRec {
  id: number; recommend_date: string; stock_code: string; stock_name: string
  recommend_price: number; current_price: number; return_rate: number; reason: string
}

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }

export default function TrackingPage() {
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

  const grouped = recs.reduce<Record<string, HistoryRec[]>>((acc, r) => {
    (acc[r.recommend_date] ||= []).push(r)
    return acc
  }, {})
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const allRates = recs.filter(r => r.current_price > 0).map(r => r.return_rate || 0)
  const avgReturn = allRates.length ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0
  const winCount = allRates.filter(r => r > 0).length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero */}
      <div className="text-center mb-6 fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">
          收益<span className="text-amber-500">跟踪</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary">历史推荐股票收益率追踪</p>
      </div>

      {/* Summary bar */}
      {!loading && recs.length > 0 && (
        <div className="stock-card p-4 mb-5 flex items-center justify-around text-center">
          <div>
            <div className="text-lg sm:text-xl font-extrabold text-blue-700">{recs.length}</div>
            <div className="text-[11px] text-text-muted">总推荐</div>
          </div>
          <div className="w-px h-8 bg-border-default" />
          <div>
            <div className="text-lg sm:text-xl font-extrabold text-green-600">{winCount}</div>
            <div className="text-[11px] text-text-muted">盈利</div>
          </div>
          <div className="w-px h-8 bg-border-default" />
          <div>
            <div className={`text-lg sm:text-xl font-extrabold ${avgReturn >= 0 ? 'text-red-500' : 'text-green-600'}`}>
              {avgReturn >= 0 ? '+' : ''}{fmt(avgReturn)}%
            </div>
            <div className="text-[11px] text-text-muted">平均收益</div>
          </div>
          <div className="w-px h-8 bg-border-default" />
          <div>
            <div className="text-lg sm:text-xl font-extrabold text-amber-500">
              {allRates.length ? fmt(winCount / allRates.length * 100) : '0'}%
            </div>
            <div className="text-[11px] text-text-muted">胜率</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl"/>)}</div>}

      {/* Error */}
      {error && !loading && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {/* Empty */}
      {!loading && dates.length === 0 && !error && (
        <div className="text-center py-14 fade-in-up">
          <div className="text-5xl mb-3 opacity-60">📈</div>
          <div className="text-sm text-text-muted">暂无历史推荐数据</div>
          <div className="text-xs text-text-muted mt-1">生成推荐后自动显示</div>
        </div>
      )}

      {/* Content */}
      {!loading && dates.length > 0 && (
        <div className="space-y-4">
          {dates.map(date => (
            <div key={date} className="stock-card overflow-hidden">
              <div className="px-4 py-2.5 bg-blue-50/80 border-b border-border-default flex items-center justify-between">
                <span className="text-sm font-bold text-blue-700 font-mono">{date}</span>
                <div className="flex items-center gap-3">
                  {(() => {
                    const dayRecs = grouped[date]
                    const dayRates = dayRecs.filter(r => r.current_price > 0).map(r => r.return_rate || 0)
                    const dayAvg = dayRates.length ? dayRates.reduce((a, b) => a + b, 0) / dayRates.length : 0
                    return (
                      <>
                        <span className="text-xs text-text-muted">{dayRecs.length} 只</span>
                        {dayRates.length > 0 && (
                          <span className={`text-xs font-bold font-mono ${dayAvg >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {dayAvg >= 0 ? '+' : ''}{fmt(dayAvg)}%
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
              <div className="divide-y divide-border-default/60">
                {grouped[date].map((rec) => {
                  const rate = rec.return_rate || 0
                  const up = rate >= 0
                  return (
                    <div key={rec.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/40 transition-colors">
                      <div className="w-16 shrink-0">
                        <div className="font-bold text-blue-800 text-sm truncate">{rec.stock_name}</div>
                        <div className="text-[11px] text-text-muted font-mono">{rec.stock_code}</div>
                      </div>
                      <div className="flex-1 min-w-0 hidden sm:block">
                        <div className="text-xs text-text-secondary line-clamp-1">{rec.reason || '—'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-text-muted">推荐</div>
                        <div className="font-mono font-semibold text-xs">{fmt(rec.recommend_price)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-text-muted">现价</div>
                        <div className="font-mono font-semibold text-xs">
                          {rec.current_price > 0 ? fmt(rec.current_price) : <span className="text-text-muted">—</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 w-16">
                        <div className="text-[11px] text-text-muted">收益</div>
                        <div className={`font-mono font-bold text-xs ${rec.current_price > 0 ? (up ? 'text-green-600' : 'text-red-500') : 'text-text-muted'}`}>
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
      )}
    </div>
  )
}

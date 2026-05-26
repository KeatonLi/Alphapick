import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface HistoryRec {
  id: number; recommend_date: string; stock_code: string; stock_name: string
  recommend_price: number; current_price: number; return_rate: number; reason: string
  tracking_days: number; price_day1: number; price_day2: number; price_day3: number
}

function fmt(n: number, d = 2) { return n.toFixed(d) }

const DAY_LABELS = ['', '持股第一天', '持股第二天', '持股第三天']

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
        <p className="text-xs sm:text-sm text-text-secondary">历史推荐股票 · 三交易日持收益</p>
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
                  const td = rec.tracking_days || 0
                  const completed = td >= 3
                  const prices = [0, rec.price_day1, rec.price_day2, rec.price_day3]
                  return (
                    <div key={rec.id} className={`px-4 py-3 transition-colors ${completed ? 'bg-green-50/30' : 'hover:bg-blue-50/40'}`}>
                      {/* Header row */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-16 shrink-0">
                          <div className="font-bold text-blue-800 text-sm truncate">{rec.stock_name}</div>
                          <div className="text-[11px] text-text-muted font-mono">{rec.stock_code}</div>
                        </div>
                        <div className="flex-1 min-w-0 hidden sm:block">
                          <div className="text-xs text-text-secondary line-clamp-1">{rec.reason || '—'}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-text-muted">推荐价</div>
                          <div className="font-mono font-semibold text-sm">{fmt(rec.recommend_price)}</div>
                        </div>
                        {completed && (
                          <div className="shrink-0 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                            已完结
                          </div>
                        )}
                        {!completed && td > 0 && (
                          <div className="shrink-0 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
                            跟踪中
                          </div>
                        )}
                      </div>
                      {/* Tracking days */}
                      <div className="flex gap-2">
                        {[1, 2, 3].map(day => {
                          const hasPrice = prices[day] > 0
                          const dayRate = hasPrice && rec.recommend_price > 0
                            ? (prices[day] - rec.recommend_price) / rec.recommend_price * 100
                            : 0
                          const isCurrent = day === td
                          return (
                            <div
                              key={day}
                              className={`flex-1 rounded-xl px-3 py-2 text-center border transition-all ${
                                isCurrent && !completed ? 'border-blue-300 bg-blue-50 shadow-sm' : hasPrice ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-gray-50/50'
                              }`}
                            >
                              <div className="text-[10px] text-text-muted mb-1">{DAY_LABELS[day]}</div>
                              <div className="font-mono font-bold text-sm">
                                {hasPrice ? fmt(prices[day]) : '—'}
                              </div>
                              {hasPrice && (
                                <div className={`font-mono text-[11px] font-semibold ${dayRate >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                  {dayRate >= 0 ? '+' : ''}{fmt(dayRate)}%
                                </div>
                              )}
                              {!hasPrice && <div className="text-[10px] text-text-muted mt-1">待更新</div>}
                            </div>
                          )
                        })}
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

import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'
import type { HistoryRec } from '../services/api'

function fmt(n: number, d = 2) { return n.toFixed(d) }

const DAY_LABELS = ['', '持股第一天', '持股第二天', '持股第三天']

function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }

function RateBadge({ rate }: { rate: number }) {
  if (rate === 0) return null
  return (
    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: rate >= 0 ? 'var(--up)' : 'var(--down)' }}>
      {fmtRate(rate)}
    </span>
  )
}

export default function TrackingPage() {
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    try {
      const d = await apiGet<any>('/recommend/history')
      if (d.success) setRecs(d.data || [])
      else setError(d.error || '')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const grouped = recs.reduce<Record<string, HistoryRec[]>>((acc, r) => {
    (acc[r.recommend_date] ||= []).push(r)
    return acc
  }, {})
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const completedRecs = recs.filter(r => r.status === 'completed')
  const completedRates = completedRecs.map(r => r.final_return_rate)
  const avgFinalReturn = completedRates.length ? completedRates.reduce((a, b) => a + b, 0) / completedRates.length : 0
  const winCount = completedRates.filter(r => r > 0).length

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', margin: 0, color: 'var(--text-primary)' }}>
          收益<span style={{ color: 'var(--accent)' }}>跟踪</span>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>历史推荐股票 · 三个交易日持仓收益</p>
      </div>

      {!loading && completedRates.length > 0 && (
        <div className="card" style={{ padding: '20px 12px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{completedRates.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>已完结</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border-default)' }} />
          <div style={{ textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--up)' }}>{winCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>盈利</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border-default)' }} />
          <div style={{ textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: avgFinalReturn >= 0 ? 'var(--up)' : 'var(--down)' }}>
              {avgFinalReturn >= 0 ? '+' : ''}{fmt(avgFinalReturn)}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>平均最终收益</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border-default)' }} />
          <div style={{ textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
              {completedRates.length ? fmt(winCount / completedRates.length * 100) : '0'}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>胜率</div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: '10px 14px', background: 'var(--up-bg)', borderColor: 'var(--up)', color: 'var(--up)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && dates.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 40, opacity: 0.4, marginBottom: 8 }}>📈</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>暂无历史推荐数据</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>生成推荐后自动显示</div>
        </div>
      )}

      {!loading && dates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dates.map(date => (
            <div key={date} className="card" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '10px 16px',
                background: 'var(--accent-bg)',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{date}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {(() => {
                    const dayRecs = grouped[date]
                    const dayRates = dayRecs.filter(r => r.status === 'completed').map(r => r.final_return_rate)
                    const dayAvg = dayRates.length ? dayRates.reduce((a, b) => a + b, 0) / dayRates.length : 0
                    return (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dayRecs.length} 只</span>
                        {dayRates.length > 0 && (
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: dayAvg >= 0 ? 'var(--up)' : 'var(--down)' }}>
                            {dayAvg >= 0 ? '+' : ''}{fmt(dayAvg)}%
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
              {grouped[date].map((rec) => {
                const td = rec.tracking_days || 0
                const completed = rec.status === 'completed'
                const rates = [0, rec.return_rate_day1, rec.return_rate_day2, rec.return_rate_day3]
                const finalRate = rec.final_return_rate
                return (
                  <div key={rec.id} style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-default)',
                    background: completed ? 'var(--down-bg)' : 'transparent',
                    transition: 'background .2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ width: 80, flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{rec.stock_name}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rec.stock_code}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'none' }} className="sm:block">
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.reason || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>推荐价</div>
                        <div className="mono" style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{fmt(rec.recommend_price)}</div>
                      </div>
                      {completed && (
                        <span className="badge badge-down">已完结</span>
                      )}
                      {!completed && td > 0 && (
                        <span className="badge badge-accent">跟踪中</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[1, 2, 3].map(day => {
                        const hasPrice = (rec as any)[`price_day${day}`] > 0
                        const dayRate = rates[day]
                        const isCurrent = day === td
                        let extraStyle: Record<string, string> = {}
                        if (isCurrent && !completed) {
                          extraStyle = { borderColor: 'var(--border-accent)', background: 'var(--accent-bg)' }
                        } else if (hasPrice) {
                          extraStyle = { borderColor: 'var(--down)', background: 'var(--down-bg)' }
                        }
                        return (
                          <div key={day} style={{
                            flex: 1,
                            padding: '8px 12px',
                            textAlign: 'center',
                            borderRadius: 'var(--card-radius)',
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-card)',
                            ...extraStyle
                          }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{DAY_LABELS[day]}</div>
                            <div className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                              {hasPrice ? fmt((rec as any)[`price_day${day}`]) : '—'}
                            </div>
                            {hasPrice && <RateBadge rate={dayRate} />}
                            {!hasPrice && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>待更新</div>}
                          </div>
                        )
                      })}
                    </div>
                    {completed && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {rec.max_gain > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              最高 <span className="mono" style={{ fontWeight: 600, color: 'var(--up)' }}>+{fmt(rec.max_gain)}%</span>
                            </span>
                          )}
                          {rec.max_drawdown < 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              最低 <span className="mono" style={{ fontWeight: 600, color: 'var(--down)' }}>{fmt(rec.max_drawdown)}%</span>
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>最终收益</span>
                          <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: finalRate >= 0 ? 'var(--up)' : 'var(--down)' }}>
                            {finalRate >= 0 ? '+' : ''}{fmt(finalRate)}%
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {fmt(rec.recommend_price)} → {fmt(rec.price_day3)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

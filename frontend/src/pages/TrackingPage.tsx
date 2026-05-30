import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'
import type { HistoryRec } from '../services/api'

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }

export default function TrackingPage() {
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<any>('/recommend/history')
      .then(d => { if (d.success) setRecs(d.data || []); else setError(d.error || '') })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = recs.reduce<Record<string, HistoryRec[]>>((acc, r) => { (acc[r.recommend_date] ||= []).push(r); return acc }, {})
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const completed = recs.filter(r => r.status === 'completed')
  const rates = completed.map(r => r.final_return_rate)
  const avgReturn = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  const wins = rates.filter(r => r > 0).length

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 60px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text-primary)', margin: '0 0 6px' }}>
          收益<span style={{ color: 'var(--accent)' }}>跟踪</span>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>历史推荐 · 三个交易日持仓收益追踪</p>
      </div>

      {/* Stats Bar */}
      {!loading && completed.length > 0 && (
        <div className="card" style={{ padding: '24px 32px', marginBottom: 32, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 }}>
          {[
            { v: recs.length, l: '总计', c: 'var(--text-primary)' },
            { v: recs.filter(r => r.status === 'tracking').length, l: '跟踪中', c: 'var(--accent-light)' },
            { v: wins, l: '盈利', c: 'var(--up)' },
            { v: `${avgReturn >= 0 ? '+' : ''}${fmt(avgReturn)}%`, l: '平均收益', c: avgReturn >= 0 ? 'var(--up)' : 'var(--down)' },
            { v: `${completed.length ? fmt(wins / completed.length * 100) : '0'}%`, l: '胜率', c: 'var(--accent)' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: m.c, lineHeight: 1.1 }}>{m.v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 20 }} />)}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="card" style={{ padding: 16, borderColor: 'var(--up)', background: 'var(--up-bg)', color: 'var(--up)', fontSize: 13 }}>{error}</div>
      )}

      {/* Empty */}
      {!loading && dates.length === 0 && !error && (
        <div className="card" style={{ padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 16, opacity: .5 }}>📈</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>暂无跟踪数据</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>生成推荐后，系统将自动跟踪 3 个交易日收益</div>
        </div>
      )}

      {/* Data */}
      {!loading && dates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {dates.map(date => {
            const dayRecs = grouped[date]
            const dayCompleted = dayRecs.filter(r => r.status === 'completed')
            const dayAvg = dayCompleted.length ? dayCompleted.reduce((s, r) => s + r.final_return_rate, 0) / dayCompleted.length : 0

            return (
              <div key={date} className="card" style={{ overflow: 'hidden' }}>
                {/* Date Header */}
                <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{date}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dayRecs.length} 只推荐</span>
                  </div>
                  {dayCompleted.length > 0 && (
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: dayAvg >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      平均 {dayAvg >= 0 ? '+' : ''}{fmt(dayAvg)}%
                    </span>
                  )}
                </div>

                {/* Stock Rows */}
                {dayRecs.map(rec => {
                  const td = rec.tracking_days || 0
                  const done = rec.status === 'completed'

                  return (
                    <div key={rec.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)' }}>
                      {/* Top Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{rec.stock_name}</span>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rec.stock_code}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>推荐价</div>
                          <div className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{fmt(rec.recommend_price)}</div>
                        </div>
                        {done ? (
                          <span className="badge badge-down">已完结</span>
                        ) : td > 0 ? (
                          <span className="badge badge-accent">{td}/3 天</span>
                        ) : (
                          <span className="badge">待更新</span>
                        )}
                      </div>

                      {/* Day Progress */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {[1, 2, 3].map(day => {
                          const price = (rec as any)[`price_day${day}`] as number || 0
                          const rate = (rec as any)[`return_rate_day${day}`] as number || 0
                          const has = price > 0
                          const active = day === td && !done
                          return (
                            <div key={day} style={{
                              padding: '10px 12px', borderRadius: 12, textAlign: 'center',
                              border: `1px solid ${active ? 'var(--border-accent)' : has ? 'var(--down)' : 'var(--border-default)'}`,
                              background: active ? 'var(--accent-bg)' : has ? 'var(--down-bg)' : 'var(--bg-elevated)',
                              transition: 'all .2s',
                            }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Day {day}</div>
                              <div className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                                {has ? fmt(price) : '—'}
                              </div>
                              <div className="mono" style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: has ? (rate >= 0 ? 'var(--up)' : 'var(--down)') : 'var(--text-dim)' }}>
                                {has ? fmtRate(rate) : '待更新'}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Final Result */}
                      {done && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              最高 <span className="mono" style={{ fontWeight: 600, color: 'var(--up)' }}>+{fmt(rec.max_gain)}%</span>
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              最大回撤 <span className="mono" style={{ fontWeight: 600, color: 'var(--down)' }}>{fmt(rec.max_drawdown)}%</span>
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>最终收益</span>
                            <span className="mono" style={{ fontWeight: 800, fontSize: 16, color: rec.final_return_rate >= 0 ? 'var(--up)' : 'var(--down)' }}>
                              {fmtRate(rec.final_return_rate)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

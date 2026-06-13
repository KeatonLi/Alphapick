import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../services/api'
import type { HistoryRec } from '../services/api'

type HistoryResponse = { success: boolean; data?: HistoryRec[]; error?: string }
type ReturnField = 'return_rate_day3' | 'return_rate_day5' | 'return_rate_day7'
type PriceField = 'price_day3' | 'price_day5' | 'price_day7'

function fmt(n?: number, d = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '--'
}

function fmtRate(n?: number) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function ReturnCell({ day, rec }: { day: 3 | 5 | 7; rec: HistoryRec }) {
  const priceField = `price_day${day}` as PriceField
  const rateField = `return_rate_day${day}` as ReturnField
  const price = rec[priceField] || 0
  const rate = rec[rateField] || 0
  const has = price > 0
  const active = day === rec.tracking_days && rec.status !== 'completed'

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 14,
      background: active ? 'var(--accent-bg)' : has ? (rate >= 0 ? 'var(--up-bg)' : 'var(--down-bg)') : 'rgba(255,255,255,0.045)',
      border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border-default)'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 10 }}>
        <span>{day}日</span>
        <span>{has ? fmt(price) : '待更新'}</span>
      </div>
      <div className="mono" style={{ marginTop: 5, fontSize: 15, fontWeight: 900, color: has ? (rate >= 0 ? 'var(--up)' : 'var(--down)') : 'var(--text-dim)' }}>
        {has ? fmtRate(rate) : '--'}
      </div>
    </div>
  )
}

export default function TrackingPage() {
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<HistoryResponse>('/recommend/history')
      .then(d => { if (d.success) setRecs(d.data || []); else setError(d.error || '') })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => recs.reduce<Record<string, HistoryRec[]>>((acc, r) => {
    (acc[r.recommend_date] ||= []).push(r)
    return acc
  }, {}), [recs])

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const completed = recs.filter(r => r.status === 'completed')
  const tracking = recs.filter(r => r.status === 'tracking')
  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const avgByDay = (day: 3 | 5 | 7) => avg(recs.map(r => r[`return_rate_day${day}` as ReturnField]).filter(v => typeof v === 'number' && v !== 0))
  const finalAvg = avg(completed.map(r => r.final_return_rate))
  const winRate = completed.length ? completed.filter(r => r.final_return_rate > 0).length / completed.length * 100 : 0

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Return Review</div>
          <h1 className="qf-title">收益复盘</h1>
          <p className="qf-subtitle">按推荐日期回看 3、5、7 个交易日表现。这里用来判断策略到底有没有持续赚钱，而不是只看单日好坏。</p>
        </div>
      </div>

      {!loading && (
        <section className="card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="qf-stat-grid">
            <div className="qf-stat"><div className="qf-stat-label">总推荐</div><div className="qf-stat-value">{recs.length}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">跟踪中</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{tracking.length}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">3日均收</div><div className="qf-stat-value" style={{ color: avgByDay(3) >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(avgByDay(3))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">5日均收</div><div className="qf-stat-value" style={{ color: avgByDay(5) >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(avgByDay(5))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">最终均收</div><div className="qf-stat-value" style={{ color: finalAvg >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(finalAvg)}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">最终胜率</div><div className="qf-stat-value" style={{ color: 'var(--gold)' }}>{fmt(winRate, 1)}%</div></div>
          </div>
        </section>
      )}

      {loading && (
        <div style={{ display: 'grid', gap: 16 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 190, borderRadius: 22 }} />)}
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: 18, borderColor: 'rgba(255,90,107,.36)', color: 'var(--up)' }}>{error}</div>
      )}

      {!loading && dates.length === 0 && !error && (
        <section className="card" style={{ padding: '72px 34px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, color: 'var(--accent-light)', marginBottom: 12 }}>⌁</div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>暂无跟踪数据</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>生成推荐后，系统会自动跟踪 3/5/7 个交易日收益。</p>
        </section>
      )}

      {!loading && dates.length > 0 && (
        <div style={{ display: 'grid', gap: 18 }}>
          {dates.map(date => {
            const dayRecs = grouped[date].sort((a, b) => (a.rank || 99) - (b.rank || 99))
            const done = dayRecs.filter(r => r.status === 'completed')
            const dayAvg = avg(done.map(r => r.final_return_rate))

            return (
              <section key={date} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 18, color: 'var(--accent-light)', fontWeight: 900 }}>{date}</div>
                    <div style={{ marginTop: 3, color: 'var(--text-muted)', fontSize: 12 }}>{dayRecs.length} 只推荐 · {done.length} 只完结</div>
                  </div>
                  {done.length > 0 && <div className="mono" style={{ color: dayAvg >= 0 ? 'var(--up)' : 'var(--down)', fontSize: 18, fontWeight: 900 }}>均值 {fmtRate(dayAvg)}</div>}
                </div>

                <div style={{ display: 'grid' }}>
                  {dayRecs.map(rec => (
                    <div key={rec.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 290px 150px', gap: 14, padding: '15px 20px', borderBottom: '1px solid var(--border-default)', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span className="mono" style={{ color: 'var(--accent-light)', fontWeight: 900 }}>#{rec.rank || '-'}</span>
                          <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>{rec.stock_name}</strong>
                          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{rec.stock_code}</span>
                          <span className={`badge ${rec.status === 'completed' ? 'badge-down' : rec.status === 'tracking' ? 'badge-accent' : ''}`}>{rec.status === 'completed' ? '已完结' : rec.status === 'tracking' ? `${rec.tracking_days}/7天` : '待更新'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                          <span>推荐价 <strong className="mono" style={{ color: 'var(--text-primary)' }}>{fmt(rec.recommend_price)}</strong></span>
                          <span>综合分 <strong className="mono" style={{ color: 'var(--gold)' }}>{fmt(rec.score, 1)}</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        <ReturnCell day={3} rec={rec} />
                        <ReturnCell day={5} rec={rec} />
                        <ReturnCell day={7} rec={rec} />
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>最终收益</div>
                        <div className="mono" style={{ marginTop: 5, color: rec.final_return_rate >= 0 ? 'var(--up)' : 'var(--down)', fontSize: 23, fontWeight: 900 }}>{fmtRate(rec.final_return_rate)}</div>
                        <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: 11 }}>高点 +{fmt(rec.max_gain)}% / 回撤 {fmt(rec.max_drawdown)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

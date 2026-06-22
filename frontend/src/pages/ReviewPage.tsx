import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HistoryRec } from '../services/api'
import { reviewApi } from '../services/reviewApi'

type TrackedDay = 1 | 2 | 3 | 4 | 5 | 6 | 7

function fmt(n?: number | null, d = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '--'
}

function fmtRate(n?: number | null) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function rateColor(n?: number | null) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'var(--text-muted)'
  return n >= 0 ? 'var(--up)' : 'var(--down)'
}

function getDayData(rec: HistoryRec, day: TrackedDay) {
  const price = (rec as any)[`price_day${day}`] as number | undefined
  const rr = (rec as any)[`return_rate_day${day}`] as number | undefined
  return {
    price,
    rate: rr,
    has: typeof price === 'number' && price > 0,
    supported: [1, 2, 3, 5, 7].includes(day),
  }
}

function ReturnRail({ rec }: { rec: HistoryRec }) {
  return (
    <div className="qf-return-rail">
      {([1, 2, 3, 4, 5, 6, 7] as TrackedDay[]).map(day => {
        const data = getDayData(rec, day)
        const active = day === rec.tracking_days && rec.status !== 'completed'
        return (
          <div key={day} className={`qf-return-day ${data.has ? 'filled' : ''} ${active ? 'active' : ''} ${!data.supported ? 'unsupported' : ''}`}>
            <span>D{day}</span>
            <strong style={{ color: data.has ? rateColor(data.rate) : undefined }}>{data.has ? fmtRate(data.rate) : '--'}</strong>
            <small>{data.has ? fmt(data.price) : data.supported ? '待更新' : '未采集'}</small>
          </div>
        )
      })}
    </div>
  )
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
}

export default function ReviewPage() {
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(() => {
    setLoading(true)
    reviewApi.history()
      .then(d => {
        if (d.success) setRecs(d.data || [])
        else setError(d.error || '收益跟踪数据加载失败')
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const updateReturns = async () => {
    setUpdating(true)
    setError('')
    try {
      await reviewApi.updatePrices()
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUpdating(false)
    }
  }

  const grouped = useMemo(() => recs.reduce<Record<string, HistoryRec[]>>((acc, r) => {
    (acc[r.recommend_date] ||= []).push(r)
    return acc
  }, {}), [recs])

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const completed = recs.filter(r => r.status === 'completed')
  const tracking = recs.filter(r => r.status === 'tracking')
  const avgByDay = (day: 1 | 2 | 3 | 5 | 7) => average(recs.map(r => (r as any)[`return_rate_day${day}`]).filter(v => typeof v === 'number' && v !== 0))
  const finalAvg = average(completed.map(r => r.final_return_rate).filter(v => typeof v === 'number'))
  const winRate = completed.length ? completed.filter(r => r.final_return_rate > 0).length / completed.length * 100 : 0

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Return Tracking</div>
          <h1 className="qf-title">收益跟踪</h1>
          <p className="qf-subtitle">按推荐日期追踪每只股票的 D1-D7 表现。这里回答的是：之前推荐出去的股票，后来到底赚没赚。</p>
        </div>
        <button onClick={updateReturns} disabled={updating} className="qf-action-button" style={{ width: 'auto' }}>
          {updating ? '更新中...' : '更新收益'}
        </button>
      </div>

      {!loading && (
        <section className="card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="qf-stat-grid">
            <div className="qf-stat"><div className="qf-stat-label">总推荐</div><div className="qf-stat-value">{recs.length}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">跟踪中</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{tracking.length}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">1日均收</div><div className="qf-stat-value" style={{ color: rateColor(avgByDay(1)) }}>{fmtRate(avgByDay(1))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">3日均收</div><div className="qf-stat-value" style={{ color: rateColor(avgByDay(3)) }}>{fmtRate(avgByDay(3))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">5日均收</div><div className="qf-stat-value" style={{ color: rateColor(avgByDay(5)) }}>{fmtRate(avgByDay(5))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">最终均收</div><div className="qf-stat-value" style={{ color: rateColor(finalAvg) }}>{fmtRate(finalAvg)}</div></div>
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
        <section className="card qf-empty-state spacious">
          <strong>暂无收益跟踪数据</strong>
          <span>生成每日推荐后，系统会自动进入收益跟踪。</span>
        </section>
      )}

      {!loading && dates.length > 0 && (
        <div style={{ display: 'grid', gap: 18 }}>
          {dates.map(date => {
            const dayRecs = grouped[date].sort((a, b) => (a.rank || 99) - (b.rank || 99))
            const done = dayRecs.filter(r => r.status === 'completed')
            const dayAvg = average(done.map(r => r.final_return_rate).filter(v => typeof v === 'number'))

            return (
              <section key={date} className="card qf-tracking-batch">
                <header>
                  <div>
                    <strong className="mono">{date}</strong>
                    <span>{dayRecs.length} 只推荐 · {done.length} 只完成</span>
                  </div>
                  {done.length > 0 && <b style={{ color: rateColor(dayAvg) }}>批次均收 {fmtRate(dayAvg)}</b>}
                </header>

                <div className="qf-tracking-list">
                  {dayRecs.map(rec => (
                    <article key={rec.id} className="qf-tracking-row">
                      <div className="qf-tracking-stock">
                        <div>
                          <span className="mono">#{rec.rank || '-'}</span>
                          <strong>{rec.stock_name}</strong>
                          <small className="mono">{rec.stock_code}</small>
                        </div>
                        <div>
                          <span>推荐价 <b className="mono">{fmt(rec.recommend_price)}</b></span>
                          <span>评分 <b className="mono">{fmt(rec.score, 1)}</b></span>
                          <span className="badge badge-accent">{rec.status === 'completed' ? '已完成' : `${rec.tracking_days}/7日`}</span>
                        </div>
                      </div>

                      <ReturnRail rec={rec} />

                      <div className="qf-final-return">
                        <span>最终收益</span>
                        <strong className="mono" style={{ color: rateColor(rec.final_return_rate) }}>{fmtRate(rec.final_return_rate)}</strong>
                        <small>高点 {fmt(rec.max_gain)}% / 回撤 {fmt(rec.max_drawdown)}%</small>
                      </div>
                    </article>
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

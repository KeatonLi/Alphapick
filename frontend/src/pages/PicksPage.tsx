import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { picksApi, type PickStats, type StockRec } from '../services/picksApi'
import { reviewApi } from '../services/reviewApi'
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'

function fmt(n?: number | null, d = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '--'
}

function signed(n?: number | null) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function FactorPill({ name, value }: { name: string; value: number }) {
  return (
    <span className="qf-factor-pill">
      <span>{name}</span>
      <strong className="mono">{fmt(value, 1)}</strong>
    </span>
  )
}

export default function PicksPage() {
  const tradeDates = useTradeDates()
  const [date, setDate] = useState('')
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<PickStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tradeDates.length > 0 && !date) setDate(tradeDates[0])
  }, [tradeDates, date])

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setError('')
    Promise.all([picksApi.daily(date), reviewApi.summary()])
      .then(([recRes, statsRes]) => {
        if (recRes.success) setRecs(recRes.data || [])
        else setError(recRes.error || '暂无推荐数据')
        if (statsRes.success) setStats(statsRes.data || null)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [date])

  const bestScore = useMemo(() => recs.reduce((m, r) => Math.max(m, r.score || 0), 0), [recs])

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Top Picks</div>
          <h1 className="qf-title">今日推荐</h1>
          <p className="qf-subtitle">每天定时任务生成股票推荐。这里不做复杂解释，先把“今天买什么、为什么入选、分数和推荐价是多少”讲清楚。</p>
        </div>
        <TradeDatePicker value={date} onChange={setDate} tradeDates={tradeDates} />
      </div>

      <section className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="qf-stat-grid">
          <div className="qf-stat"><div className="qf-stat-label">当日推荐</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{recs.length}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">累计推荐</div><div className="qf-stat-value">{stats?.total ?? '--'}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">3日胜率</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{fmt(stats?.win_rate_day3 ?? stats?.win_rate, 1)}%</div></div>
          <div className="qf-stat"><div className="qf-stat-label">3日均收</div><div className="qf-stat-value" style={{ color: (stats?.avg_return_day3 ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>{signed(stats?.avg_return_day3)}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">7日均收</div><div className="qf-stat-value" style={{ color: (stats?.avg_return_day7 ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>{signed(stats?.avg_return_day7)}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">最高分</div><div className="qf-stat-value" style={{ color: 'var(--gold)' }}>{bestScore ? fmt(bestScore, 1) : '--'}</div></div>
        </div>
      </section>

      {loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 118, borderRadius: 20 }} />)}
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: 20, marginBottom: 18, borderColor: 'rgba(255,90,107,.36)', color: 'var(--up)' }}>{error}</div>
      )}

      {!loading && recs.length === 0 && !error && (
        <section className="card qf-empty-state spacious">
          <strong>该日暂无推荐</strong>
          <span>管理员可以在控制台运行单日闭环，生成推荐后会自动进入收益跟踪。</span>
          <Link to="/console" className="qf-action-button" style={{ textDecoration: 'none', display: 'inline-flex', width: 'auto', marginTop: 10 }}>去控制台</Link>
        </section>
      )}

      {!loading && recs.length > 0 && (
        <div style={{ display: 'grid', gap: 18 }}>
          {recs.map((rec, idx) => {
            const factors = Object.entries(rec.factor_snapshot || {}).slice(0, 5)
            return (
              <article key={`${rec.stock_code}-${idx}`} className="card qf-recommend-card">
                <div className="qf-recommend-rank">#{rec.rank || idx + 1}</div>
                <div className="qf-recommend-body">
                  <div className="qf-recommend-title">
                    <strong>{rec.stock_name}</strong>
                    <span className="mono">{rec.stock_code}</span>
                    {rec.strategy_version && <span className="badge badge-accent">{rec.strategy_version}</span>}
                  </div>
                  <p>{rec.reason || '量化模型筛选结果。'}</p>
                  <div className="qf-factor-row">
                    {factors.length > 0 ? factors.map(([k, v]) => <FactorPill key={k} name={k} value={Number(v)} />) : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>暂无因子快照</span>}
                  </div>
                </div>
                <div className="qf-recommend-metric">
                  <span>综合分</span>
                  <strong className="mono">{fmt(rec.score, 1)}</strong>
                </div>
                <div className="qf-recommend-metric">
                  <span>推荐价</span>
                  <strong className="mono">{fmt(rec.recommend_price)}</strong>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

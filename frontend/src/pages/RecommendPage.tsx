import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api'
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'

interface StockRec {
  stock_code: string
  stock_name: string
  recommend_price: number
  reason: string
  rank: number
  score: number
  strategy_version: string
  factor_snapshot: Record<string, number>
}

interface Stats {
  total: number
  completed: number
  win_count: number
  win_rate: number
  avg_return: number
  avg_max_gain: number
  avg_max_drawdown: number
  avg_return_day3: number
  avg_return_day5: number
  avg_return_day7: number
  win_rate_day3: number
  win_rate_day5: number
  win_rate_day7: number
}

type RecommendResponse = { success: boolean; data?: StockRec[]; error?: string }
type StatsResponse = { success: boolean; data?: Stats; error?: string }

function fmt(n?: number, d = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '--'
}

function signed(n?: number) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function FactorPill({ name, value }: { name: string; value: number }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 8px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: 'var(--text-secondary)',
      fontSize: 11,
      whiteSpace: 'nowrap',
    }}>
      <span>{name}</span>
      <strong className="mono" style={{ color: value >= 0 ? 'var(--down)' : 'var(--up)' }}>{fmt(value, 1)}</strong>
    </span>
  )
}

export default function RecommendPage() {
  const tradeDates = useTradeDates()
  const [date, setDate] = useState('')
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tradeDates.length > 0 && !date) setDate(tradeDates[0])
  }, [tradeDates, date])

  const loadData = async () => {
    if (!date) return
    setLoading(true)
    setError('')
    try {
      const [recRes, statsRes] = await Promise.all([
        apiGet<RecommendResponse>(`/recommend/daily?date=${date}`),
        apiGet<StatsResponse>('/recommend/stats'),
      ])
      if (recRes.success) setRecs(recRes.data || [])
      else setError(recRes.error || '暂无推荐数据')
      if (statsRes.success) setStats(statsRes.data || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [date])

  const bestScore = useMemo(() => recs.reduce((m, r) => Math.max(m, r.score || 0), 0), [recs])

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Quant Selection</div>
          <h1 className="qf-title">量化选股</h1>
          <p className="qf-subtitle">候选池过滤、因子打分、Top 5 输出。这里应该像交易员早会屏幕：重点数字一眼看见，入选逻辑不用翻来翻去。</p>
        </div>
        <TradeDatePicker value={date} onChange={setDate} tradeDates={tradeDates} />
      </div>

      <section className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="qf-stat-grid">
          <div className="qf-stat"><div className="qf-stat-label">累计推荐</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{stats?.total ?? '--'}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">3日胜率</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{fmt(stats?.win_rate_day3 ?? stats?.win_rate, 1)}%</div></div>
          <div className="qf-stat"><div className="qf-stat-label">3日均收</div><div className="qf-stat-value" style={{ color: (stats?.avg_return_day3 ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>{signed(stats?.avg_return_day3)}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">5日均收</div><div className="qf-stat-value" style={{ color: (stats?.avg_return_day5 ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>{signed(stats?.avg_return_day5)}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">7日均收</div><div className="qf-stat-value" style={{ color: (stats?.avg_return_day7 ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>{signed(stats?.avg_return_day7)}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">今日最高分</div><div className="qf-stat-value" style={{ color: 'var(--gold)' }}>{bestScore ? fmt(bestScore, 1) : '--'}</div></div>
        </div>
      </section>

      {loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 106, borderRadius: 20 }} />)}
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: 18, marginBottom: 18, borderColor: 'rgba(255,90,107,.36)', color: 'var(--up)' }}>{error}</div>
      )}

      {!loading && recs.length === 0 && !error && (
        <section className="card" style={{ padding: '72px 34px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, margin: '0 auto 18px', display: 'grid', placeItems: 'center', background: 'var(--accent-bg)', color: 'var(--accent-light)' }}>
            <span style={{ fontSize: 30 }}>◎</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>该日暂无推荐</h2>
          <p style={{ margin: '8px auto 20px', maxWidth: 440, color: 'var(--text-muted)', fontSize: 13 }}>先在策略控制台生成这一天的 Top 5，系统会自动写入评分、排名和后续收益追踪。</p>
          <Link to="/console" className="qf-action-button" style={{ textDecoration: 'none', display: 'inline-flex' }}>去策略控制台</Link>
        </section>
      )}

      {!loading && recs.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {recs.map((rec, idx) => {
            const factors = Object.entries(rec.factor_snapshot || {}).slice(0, 5)
            return (
              <article key={`${rec.stock_code}-${idx}`} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr 118px 118px', gap: 0, alignItems: 'stretch' }}>
                  <div style={{ padding: 18, borderRight: '1px solid var(--border-default)', display: 'grid', placeItems: 'center' }}>
                    <div className="mono" style={{ fontSize: 30, fontWeight: 900, color: idx === 0 ? 'var(--gold)' : 'var(--accent-light)', letterSpacing: '-.08em' }}>#{rec.rank || idx + 1}</div>
                  </div>
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <strong style={{ fontSize: 18, color: 'var(--text-primary)' }}>{rec.stock_name}</strong>
                      <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{rec.stock_code}</span>
                      {rec.strategy_version && <span className="badge badge-accent">{rec.strategy_version}</span>}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55, marginBottom: 12 }}>{rec.reason || '量化模型筛选结果'}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {factors.length > 0 ? factors.map(([k, v]) => <FactorPill key={k} name={k} value={Number(v)} />) : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>暂无因子快照</span>}
                    </div>
                  </div>
                  <div style={{ padding: 18, borderLeft: '1px solid var(--border-default)', textAlign: 'right' }}>
                    <div className="qf-stat-label">综合分</div>
                    <div className="mono" style={{ marginTop: 8, fontSize: 30, fontWeight: 900, color: 'var(--accent-light)' }}>{fmt(rec.score, 1)}</div>
                  </div>
                  <div style={{ padding: 18, borderLeft: '1px solid var(--border-default)', textAlign: 'right' }}>
                    <div className="qf-stat-label">推荐价</div>
                    <div className="mono" style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: 'var(--text-primary)' }}>{fmt(rec.recommend_price)}</div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

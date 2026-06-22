import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, type DashboardData, type TrackingBatch } from '../services/dashboardApi'
import type { HistoryRec } from '../services/api'

function num(n?: number | null, d = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '--'
}

function rate(n?: number | null) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function toneColor(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'var(--text-muted)'
  return value >= 0 ? 'var(--up)' : 'var(--down)'
}

function statusText(status?: string | null) {
  if (!status) return '未知'
  if (status === 'success') return '已完成'
  if (status === 'missing') return '缺失'
  if (status === 'partial') return '部分完成'
  if (status.includes('skipped')) return '已跳过'
  return status
}

function StepPill({ label, value, state }: { label: string; value: string; state: 'ok' | 'warn' | 'idle' }) {
  return (
    <div className={`qf-flow-step ${state}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PickCard({ pick }: { pick: DashboardData['today_picks'][number] }) {
  const factors = Object.entries(pick.factor_snapshot || {}).filter(([k]) => k !== 'total').slice(0, 4)
  return (
    <article className="qf-pick-card">
      <div className="qf-pick-rank">#{pick.rank || '-'}</div>
      <div className="qf-pick-main">
        <div className="qf-pick-title">
          <strong>{pick.stock_name}</strong>
          <span className="mono">{pick.stock_code}</span>
        </div>
        <p>{pick.reason || '量化模型入选，等待策略解释补充。'}</p>
        <div className="qf-factor-row">
          {factors.map(([name, value]) => (
            <span key={name}>{name} <b>{num(Number(value), 0)}</b></span>
          ))}
        </div>
      </div>
      <div className="qf-pick-score">
        <span>评分</span>
        <strong className="mono">{num(pick.score, 1)}</strong>
      </div>
      <div className="qf-pick-price">
        <span>推荐价</span>
        <strong className="mono">{num(pick.recommend_price)}</strong>
      </div>
    </article>
  )
}

function BatchStrip({ batch }: { batch: TrackingBatch }) {
  const stage = batch.max_tracking_days >= 7 ? '7日完成' : batch.max_tracking_days >= 5 ? '5日跟踪' : batch.max_tracking_days >= 3 ? '3日跟踪' : batch.max_tracking_days > 0 ? `${batch.max_tracking_days}日跟踪` : '待更新'
  return (
    <Link to="/tracking" className="qf-batch-strip">
      <div>
        <strong className="mono">{batch.date}</strong>
        <span>{batch.count} 只推荐 · {stage}</span>
      </div>
      <div className="qf-batch-rates">
        <span style={{ color: toneColor(batch.avg_day3) }}>3日 {rate(batch.avg_day3)}</span>
        <span style={{ color: toneColor(batch.avg_day5) }}>5日 {rate(batch.avg_day5)}</span>
        <span style={{ color: toneColor(batch.avg_day7) }}>7日 {rate(batch.avg_day7)}</span>
      </div>
    </Link>
  )
}

function MiniReturnGrid({ rec }: { rec: HistoryRec }) {
  return (
    <div className="qf-mini-return-grid">
      {[1, 2, 3, 4, 5, 6, 7].map(day => {
        const price = (rec as any)[`price_day${day}`] as number | undefined
        const rr = (rec as any)[`return_rate_day${day}`] as number | undefined
        const has = typeof price === 'number' && price > 0
        return (
          <div key={day} className={has ? 'filled' : ''}>
            <span>D{day}</span>
            <strong style={{ color: has ? toneColor(rr) : undefined }}>{has ? rate(rr) : '--'}</strong>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    dashboardApi.overview()
      .then(res => {
        if (res.success) setData(res.data)
        else setError(res.error || '工作台数据加载失败')
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const latestTracked = useMemo(() => {
    if (!data) return []
    return data.tracking_batches.flatMap(batch => batch.items).filter(item => item.tracking_days > 0).slice(0, 5)
  }, [data])

  if (loading) {
    return (
      <div className="qf-page qf-page-wide">
        <div className="skeleton" style={{ height: 190, borderRadius: 24, marginBottom: 18 }} />
        <div className="qf-dashboard-grid">
          <div className="skeleton" style={{ height: 430, borderRadius: 24 }} />
          <div className="skeleton" style={{ height: 430, borderRadius: 24 }} />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <div className="qf-page"><section className="card" style={{ padding: 24, color: 'var(--up)' }}>{error || '暂无工作台数据'}</section></div>
  }

  const stats = data.strategy_summary || {}
  const pipeline = data.pipeline
  const hasPicks = data.today_picks.length > 0

  return (
    <div className="qf-page qf-page-wide">
      <section className="qf-command-hero">
        <div>
          <div className="qf-eyebrow">Decision Desk</div>
          <h1>今天推荐什么，之前赚没赚。</h1>
          <p>QuantForge 的主线很简单：每天给出可执行推荐，随后持续跟踪 1 到 7 日收益，最后用真实收益反推这套策略靠不靠谱。</p>
        </div>
        <div className="qf-hero-date">
          <span>{data.is_trade_day ? '交易日' : '非交易日'}</span>
          <strong className="mono">{data.trade_date}</strong>
          <small>系统日期 {data.today}</small>
        </div>
      </section>

      <section className="qf-flow-card card">
        <StepPill label="数据" value={`${statusText(pipeline.data_status)} · ${pipeline.snapshot_count || 0}`} state={pipeline.data_status === 'success' ? 'ok' : 'warn'} />
        <StepPill label="推荐" value={hasPicks ? `${data.today_picks.length} 只` : statusText(pipeline.recommend_status)} state={hasPicks ? 'ok' : 'warn'} />
        <StepPill label="收益" value={statusText(pipeline.returns_status)} state="ok" />
        <StepPill label="调度" value={pipeline.last_run_result || '等待运行'} state={pipeline.last_run_result?.includes('skipped') ? 'idle' : 'ok'} />
      </section>

      <div className="qf-dashboard-grid">
        <section className="card qf-panel">
          <div className="qf-panel-head">
            <div>
              <span className="qf-eyebrow">Today Picks</span>
              <h2>今日推荐</h2>
            </div>
            <Link to="/picks" className="qf-link-button">查看全部</Link>
          </div>
          <div className="qf-pick-list">
            {hasPicks ? data.today_picks.slice(0, 5).map(pick => <PickCard key={pick.stock_code} pick={pick} />) : (
              <div className="qf-empty-state">
                <strong>今天还没有推荐</strong>
                <span>{data.is_trade_day ? '需要检查数据采集和推荐任务。' : '非交易日通常不生成新推荐。'}</span>
              </div>
            )}
          </div>
        </section>

        <section className="card qf-panel">
          <div className="qf-panel-head">
            <div>
              <span className="qf-eyebrow">Return Tracking</span>
              <h2>之前赚没赚</h2>
            </div>
            <Link to="/tracking" className="qf-link-button">收益跟踪</Link>
          </div>
          <div className="qf-batch-list">
            {data.tracking_batches.length ? data.tracking_batches.slice(0, 7).map(batch => <BatchStrip key={batch.date} batch={batch} />) : (
              <div className="qf-empty-state">
                <strong>暂无历史推荐批次</strong>
                <span>生成推荐后会自动进入收益跟踪。</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="qf-dashboard-grid lower">
        <section className="card qf-panel">
          <div className="qf-panel-head">
            <div>
              <span className="qf-eyebrow">Strategy Review</span>
              <h2>这套推荐靠不靠谱</h2>
            </div>
            <Link to="/review" className="qf-link-button">策略复盘</Link>
          </div>
          <div className={`qf-verdict ${data.strategy_review.tone}`}>
            <strong>{data.strategy_review.verdict}</strong>
            <p>{data.strategy_review.summary}</p>
          </div>
          <div className="qf-stat-grid compact">
            <div className="qf-stat"><div className="qf-stat-label">3日胜率</div><div className="qf-stat-value">{num(stats.win_rate_day3, 1)}%</div></div>
            <div className="qf-stat"><div className="qf-stat-label">3日均收</div><div className="qf-stat-value" style={{ color: toneColor(stats.avg_return_day3) }}>{rate(stats.avg_return_day3)}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">5日均收</div><div className="qf-stat-value" style={{ color: toneColor(stats.avg_return_day5) }}>{rate(stats.avg_return_day5)}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">7日均收</div><div className="qf-stat-value" style={{ color: toneColor(stats.avg_return_day7) }}>{rate(stats.avg_return_day7)}</div></div>
          </div>
        </section>

        <section className="card qf-panel">
          <div className="qf-panel-head">
            <div>
              <span className="qf-eyebrow">Live Positions</span>
              <h2>跟踪中的股票</h2>
            </div>
          </div>
          <div className="qf-live-list">
            {latestTracked.length ? latestTracked.map(rec => (
              <div key={rec.id} className="qf-live-row">
                <div>
                  <strong>{rec.stock_name}</strong>
                  <span className="mono">{rec.stock_code} · {rec.tracking_days}/7日</span>
                </div>
                <MiniReturnGrid rec={rec} />
              </div>
            )) : <div className="qf-empty-state"><strong>暂无进行中的跟踪</strong><span>推荐生成后会自动进入收益跟踪。</span></div>}
          </div>
        </section>
      </div>
    </div>
  )
}

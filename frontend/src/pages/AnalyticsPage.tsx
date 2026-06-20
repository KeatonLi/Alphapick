import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, type DashboardData } from '../services/dashboardApi'

function fmt(n?: number | null, d = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '--'
}

function rate(n?: number | null) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function tone(n?: number | null) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'var(--text-muted)'
  return n >= 0 ? 'var(--up)' : 'var(--down)'
}

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    dashboardApi.overview()
      .then(res => {
        if (res.success) setData(res.data)
        else setError(res.error || '策略复盘数据加载失败')
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const completedItems = useMemo(() => {
    if (!data) return []
    return data.tracking_batches.flatMap(batch => batch.items).filter(item => item.status === 'completed')
  }, [data])

  const weakItems = useMemo(() => {
    return [...completedItems].sort((a, b) => a.final_return_rate - b.final_return_rate).slice(0, 5)
  }, [completedItems])

  const strongItems = useMemo(() => {
    return [...completedItems].sort((a, b) => b.final_return_rate - a.final_return_rate).slice(0, 5)
  }, [completedItems])

  if (loading) {
    return <div className="qf-page qf-page-wide"><div className="skeleton" style={{ height: 460, borderRadius: 24 }} /></div>
  }

  if (error || !data) {
    return <div className="qf-page"><section className="card" style={{ padding: 24, color: 'var(--up)' }}>{error || '暂无策略复盘数据'}</section></div>
  }

  const stats = data.strategy_summary || {}

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Strategy Review</div>
          <h1 className="qf-title">策略复盘</h1>
          <p className="qf-subtitle">每天基于最新收益跟踪重新生成判断，不保留“旧结论”。这里回答的是：这套推荐系统现在还靠不靠谱。</p>
        </div>
        <Link to="/tracking" className="qf-link-button">查看收益明细</Link>
      </div>

      <section className="card qf-panel" style={{ marginBottom: 18 }}>
        <div className={`qf-verdict ${data.strategy_review.tone}`}>
          <strong>{data.strategy_review.verdict}</strong>
          <p>{data.strategy_review.summary}</p>
        </div>
        <div className="qf-stat-grid">
          <div className="qf-stat"><div className="qf-stat-label">样本数</div><div className="qf-stat-value">{stats.total ?? completedItems.length}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">3日胜率</div><div className="qf-stat-value">{fmt(stats.win_rate_day3, 1)}%</div></div>
          <div className="qf-stat"><div className="qf-stat-label">3日均收</div><div className="qf-stat-value" style={{ color: tone(stats.avg_return_day3) }}>{rate(stats.avg_return_day3)}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">5日均收</div><div className="qf-stat-value" style={{ color: tone(stats.avg_return_day5) }}>{rate(stats.avg_return_day5)}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">7日均收</div><div className="qf-stat-value" style={{ color: tone(stats.avg_return_day7) }}>{rate(stats.avg_return_day7)}</div></div>
        </div>
      </section>

      <div className="qf-dashboard-grid">
        <section className="card qf-panel">
          <div className="qf-panel-head">
            <div>
              <span className="qf-eyebrow">Strong Cases</span>
              <h2>表现最好的推荐</h2>
            </div>
          </div>
          <div className="qf-live-list">
            {strongItems.length ? strongItems.map(item => (
              <div key={`strong-${item.id}`} className="qf-batch-strip">
                <div><strong>{item.stock_name}</strong><span className="mono">{item.stock_code} · {item.recommend_date}</span></div>
                <div className="qf-batch-rates"><span style={{ color: tone(item.final_return_rate) }}>{rate(item.final_return_rate)}</span></div>
              </div>
            )) : <div className="qf-empty-state"><strong>暂无完成样本</strong><span>等收益跟踪完成后再复盘。</span></div>}
          </div>
        </section>

        <section className="card qf-panel">
          <div className="qf-panel-head">
            <div>
              <span className="qf-eyebrow">Weak Cases</span>
              <h2>需要复盘的推荐</h2>
            </div>
          </div>
          <div className="qf-live-list">
            {weakItems.length ? weakItems.map(item => (
              <div key={`weak-${item.id}`} className="qf-batch-strip">
                <div><strong>{item.stock_name}</strong><span className="mono">{item.stock_code} · {item.recommend_date}</span></div>
                <div className="qf-batch-rates"><span style={{ color: tone(item.final_return_rate) }}>{rate(item.final_return_rate)}</span></div>
              </div>
            )) : <div className="qf-empty-state"><strong>暂无失败样本</strong><span>目前没有可复盘的完成记录。</span></div>}
          </div>
        </section>
      </div>
    </div>
  )
}

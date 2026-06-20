import { useEffect, useMemo, useState } from 'react'
import { limitUpApi, type LimitUpOverview } from '../services/limitUpApi'

function moneyYi(value?: number | null) {
  if (!value) return '--'
  return `${(value / 100000000).toFixed(2)}亿`
}

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return `${value.toFixed(2)}%`
}

function buildReview(data: LimitUpOverview | null) {
  if (!data || !data.summary.total) return '暂无涨停池数据。请先在管理后台采集 limit_up_pool，页面会自动展示真实涨停股票、连板高度和题材热度。'
  const top = data.industries[0]
  const highBoards = data.items.filter(item => item.board_count >= 2).length
  return `今日涨停池共 ${data.summary.total} 只，最高 ${data.summary.max_board_count} 连板，连板股 ${highBoards} 只。主线集中在 ${top?.industry || data.summary.top_industry || '未分类'}，龙头为 ${top?.leader_name || '--'}。炸板率 ${pct(data.summary.break_rate)}，平均封板强度 ${pct(data.summary.avg_seal_strength)}，短线情绪以真实采集数据为准。`
}

export default function LimitUpPage() {
  const [overview, setOverview] = useState<LimitUpOverview | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      limitUpApi.overview(),
      limitUpApi.dates().catch(() => ({ success: false, data: [] })),
    ])
      .then(([overviewRes, datesRes]) => {
        if (!alive) return
        setOverview(overviewRes.data)
        setSelectedDate(overviewRes.data.date)
        if (datesRes.success) setDates(datesRes.data)
      })
      .catch(err => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let alive = true
    setLoading(true)
    limitUpApi.overview(selectedDate)
      .then(res => alive && setOverview(res.data))
      .catch(err => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [selectedDate])

  const summary = overview?.summary
  const items = overview?.items || []
  const industries = overview?.industries || []
  const reviewText = useMemo(() => buildReview(overview), [overview])

  return (
    <div className="qv4-page">
      <section className="qv4-hero compact">
        <div className="qv4-hero-main">
          <div className="qv4-kicker">Limit-up Analysis</div>
          <h1>涨停板股票分析</h1>
          <p>围绕每日真实涨停池，观察连板高度、题材扩散、封单强度和炸板风险。数据来自后端 `limit_up_pool` 采集结果。</p>
        </div>
        <div className="qv4-date-card">
          <span>涨停池日期</span>
          <strong>{overview?.date || '--'}</strong>
          <small>{overview?.source ? `来源 ${overview.source}` : '等待数据源'}</small>
        </div>
      </section>

      {error && <div className="qv4-inline-note">{error}</div>}

      <section className="qv4-status-grid">
        <div className="qv4-status-card good"><span>涨停数量</span><strong>{summary?.total ?? 0}</strong><small>真实涨停池</small></div>
        <div className="qv4-status-card"><span>最高连板</span><strong>{summary?.max_board_count ?? 0}板</strong><small>{summary?.top_industry || '--'}</small></div>
        <div className="qv4-status-card"><span>炸板率</span><strong>{pct(summary?.break_rate)}</strong><small>炸板次数大于 0</small></div>
        <div className="qv4-status-card"><span>封板资金</span><strong>{moneyYi(summary?.total_seal_amount)}</strong><small>全池合计</small></div>
      </section>

      <div className="qv4-workspace">
        <section className="qv4-panel qv4-panel-large">
          <header className="qv4-panel-head">
            <div>
              <span>Limit-up Pool</span>
              <h2>涨停股票池</h2>
            </div>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="qv4-select">
              {[selectedDate, ...dates].filter(Boolean).filter((date, index, arr) => arr.indexOf(date) === index).map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </header>
          {loading ? (
            <div className="qv4-empty">正在读取真实涨停池...</div>
          ) : items.length ? (
            <div className="qv4-limit-table">
              <div className="qv4-limit-head">
                <span>股票</span><span>连板</span><span>行业</span><span>封板强度</span><span>封板时间</span><span>成交额</span>
              </div>
              {items.map(row => (
                <article key={`${row.stock_code}-${row.rank}`} className="qv4-limit-row">
                  <div><strong>{row.stock_name}</strong><small>{row.stock_code}</small></div>
                  <b>{row.board_count}板</b>
                  <span>{row.industry}</span>
                  <div className="qv4-seal"><i style={{ width: `${Math.min(row.seal_strength, 100)}%` }} /><em>{pct(row.seal_strength)}</em></div>
                  <span className="mono">{row.first_limit_time || '--'}</span>
                  <span>{moneyYi(row.amount)}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="qv4-empty">这一天没有涨停池数据。请在管理后台采集 `limit_up_pool`。</div>
          )}
        </section>

        <aside className="qv4-panel">
          <header className="qv4-panel-head">
            <div>
              <span>Theme Heat</span>
              <h2>行业热度</h2>
            </div>
          </header>
          {industries.length ? (
            <div className="qv4-theme-list">
              {industries.slice(0, 8).map(theme => (
                <div key={theme.industry} className="qv4-theme-card">
                  <div>
                    <strong>{theme.industry}</strong>
                    <span>{theme.count} 只涨停，龙头 {theme.leader_name}</span>
                  </div>
                  <b>{theme.max_board_count}板</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="qv4-empty">暂无行业热度数据。</div>
          )}
        </aside>
      </div>

      <section className="qv4-panel">
        <header className="qv4-panel-head">
          <div>
            <span>AI Review</span>
            <h2>涨停复盘摘要</h2>
          </div>
        </header>
        <div className="qv4-review-text">{reviewText}</div>
      </section>
    </div>
  )
}

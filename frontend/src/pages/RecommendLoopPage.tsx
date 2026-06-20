import { useEffect, useMemo, useState } from 'react'
import { dashboardApi, type DashboardData } from '../services/dashboardApi'
import { picksApi, type StockRec } from '../services/picksApi'
import { reviewApi } from '../services/reviewApi'
import type { HistoryRec } from '../services/api'

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function money(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return value.toFixed(2)
}

function toneBy(value?: number | null) {
  if (value === null || value === undefined) return ''
  return value >= 0 ? 'rise' : 'fall'
}

function factorEntries(snapshot?: Record<string, number>) {
  return Object.entries(snapshot || {}).slice(0, 3)
}

export default function RecommendLoopPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [picks, setPicks] = useState<StockRec[]>([])
  const [history, setHistory] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      dashboardApi.overview(),
      picksApi.tradeDates(45).catch(() => ({ success: false, data: [] })),
      reviewApi.history().catch(() => ({ success: false, data: [] })),
    ])
      .then(([overview, tradeDates, review]) => {
        if (!alive) return
        const data = overview.data
        setDashboard(data)
        const nextDates = tradeDates.success ? tradeDates.data : []
        setDates(nextDates)
        setSelectedDate(data.trade_date || nextDates[0] || data.today)
        setHistory(review.success && review.data ? review.data : [])
        setPicks(data.today_picks || [])
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let alive = true
    picksApi.daily(selectedDate)
      .then(res => {
        if (!alive) return
        if (res.success && res.data) setPicks(res.data)
        else setPicks([])
      })
      .catch(() => alive && setPicks([]))
    return () => { alive = false }
  }, [selectedDate])

  const selectedHistory = useMemo(
    () => history.filter(item => item.recommend_date === selectedDate),
    [history, selectedDate],
  )

  const latestBatches = useMemo(() => {
    const grouped = new Map<string, HistoryRec[]>()
    history.forEach(item => {
      if (!grouped.has(item.recommend_date)) grouped.set(item.recommend_date, [])
      grouped.get(item.recommend_date)!.push(item)
    })
    return [...grouped.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([date, items]) => ({
        date,
        count: items.length,
        avg3: items.reduce((sum, item) => sum + (item.return_rate_day3 || 0), 0) / Math.max(items.length, 1),
        avg5: items.reduce((sum, item) => sum + (item.return_rate_day5 || 0), 0) / Math.max(items.length, 1),
        avg7: items.reduce((sum, item) => sum + (item.return_rate_day7 || 0), 0) / Math.max(items.length, 1),
      }))
  }, [history])

  const summary = dashboard?.strategy_summary
  const review = dashboard?.strategy_review

  const runReturnUpdate = async () => {
    setUpdating(true)
    setMessage('')
    try {
      await reviewApi.updatePrices()
      const refreshed = await reviewApi.history()
      if (refreshed.success && refreshed.data) setHistory(refreshed.data)
      setMessage('收益跟踪已更新')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="qv4-page">
      <section className="qv4-hero">
        <div className="qv4-hero-main">
          <div className="qv4-kicker">Recommendation Loop</div>
          <h1>每日推荐工作台</h1>
          <p>把推荐、持仓收益跟踪、策略可信度复盘合成一个闭环：先看今天推什么，再看之前赚没赚，最后判断策略是否值得继续相信。</p>
        </div>
        <div className="qv4-date-card">
          <span>当前交易日</span>
          <strong>{selectedDate || '--'}</strong>
          <small>{dashboard?.is_trade_day ? '交易日，推荐任务应正常产出' : '非交易日，调度会跳过推荐'}</small>
        </div>
      </section>

      <section className="qv4-status-grid">
        <div className="qv4-status-card good"><span>行情数据</span><strong>{dashboard?.pipeline.snapshot_count ?? 0}</strong><small>{dashboard?.pipeline.data_status || '等待检查'}</small></div>
        <div className="qv4-status-card good"><span>今日推荐</span><strong>{picks.length}</strong><small>{dashboard?.pipeline.recommend_status || '等待生成'}</small></div>
        <div className="qv4-status-card"><span>跟踪样本</span><strong>{summary?.total ?? history.length}</strong><small>3 / 5 / 7 日收益</small></div>
        <div className="qv4-status-card"><span>策略胜率</span><strong>{pct(summary?.win_rate)}</strong><small>历史完成样本</small></div>
      </section>

      {message && <div className="qv4-inline-note">{message}</div>}

      <div className="qv4-workspace">
        <section className="qv4-panel qv4-panel-large">
          <header className="qv4-panel-head">
            <div>
              <span>Daily Picks</span>
              <h2>今天推荐了什么</h2>
            </div>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="qv4-select">
              {[selectedDate, ...dates].filter(Boolean).filter((date, index, arr) => arr.indexOf(date) === index).map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </header>

          {loading ? (
            <div className="qv4-empty">正在读取推荐闭环数据...</div>
          ) : picks.length ? (
            <div className="qv4-pick-table">
              {picks.map((item, index) => (
                <article key={`${item.stock_code}-${index}`} className="qv4-pick-row">
                  <div className="qv4-rank">#{item.rank || index + 1}</div>
                  <div className="qv4-stock-main">
                    <div className="qv4-stock-title">
                      <strong>{item.stock_name}</strong>
                      <span>{item.stock_code}</span>
                    </div>
                    <p>{item.reason || '暂无推荐理由'}</p>
                    <div className="qv4-chip-row">
                      {factorEntries(item.factor_snapshot).map(([key, value]) => (
                        <span key={key}>{key}: {Number(value).toFixed(2)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="qv4-metric"><span>推荐价</span><strong>{money(item.recommend_price)}</strong></div>
                  <div className="qv4-metric"><span>评分</span><strong>{money(item.score)}</strong></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="qv4-empty">这一天还没有推荐股票。若是交易日，需要检查推荐任务是否执行。</div>
          )}
        </section>

        <aside className="qv4-panel">
          <header className="qv4-panel-head">
            <div>
              <span>Strategy Review</span>
              <h2>策略可信度复盘</h2>
            </div>
          </header>
          <div className={`qv4-verdict ${review?.tone || ''}`}>
            <strong>{review?.verdict || '等待更多样本'}</strong>
            <p>{review?.summary || '系统会基于所有收益跟踪样本，重新生成对当前策略的复盘判断。'}</p>
          </div>
          <div className="qv4-mini-stats">
            <div><span>3日均收益</span><strong className={toneBy(summary?.avg_return_day3)}>{pct(summary?.avg_return_day3)}</strong></div>
            <div><span>5日均收益</span><strong className={toneBy(summary?.avg_return_day5)}>{pct(summary?.avg_return_day5)}</strong></div>
            <div><span>7日均收益</span><strong className={toneBy(summary?.avg_return_day7)}>{pct(summary?.avg_return_day7)}</strong></div>
            <div><span>最大回撤</span><strong className={toneBy(summary?.avg_max_drawdown)}>{pct(summary?.avg_max_drawdown)}</strong></div>
          </div>
          <button className="qv4-primary" onClick={runReturnUpdate} disabled={updating}>
            {updating ? '更新中...' : '立即更新收益跟踪'}
          </button>
        </aside>
      </div>

      <section className="qv4-panel">
        <header className="qv4-panel-head">
          <div>
            <span>Return Tracking</span>
            <h2>之前推荐的股票赚没赚</h2>
          </div>
          <small>{selectedDate} 推荐批次</small>
        </header>
        {selectedHistory.length ? (
          <div className="qv4-tracking-list">
            {selectedHistory.map(item => (
              <article className="qv4-tracking-row" key={item.id}>
                <div className="qv4-stock-main">
                  <div className="qv4-stock-title">
                    <strong>{item.stock_name}</strong>
                    <span>{item.stock_code}</span>
                    <em>{item.status}</em>
                  </div>
                  <p>推荐价 {money(item.recommend_price)}，当前价 {money(item.current_price)}，已跟踪 {item.tracking_days || 0} 天</p>
                </div>
                <div className="qv4-return-strip">
                  {[1, 2, 3, 4, 5, 6, 7].map(day => {
                    const rate = day === 1 ? item.return_rate_day1
                      : day === 2 ? item.return_rate_day2
                        : day === 3 ? item.return_rate_day3
                          : day === 5 ? item.return_rate_day5
                            : day === 7 ? item.return_rate_day7
                              : null
                    return (
                      <div key={day} className={rate === null || rate === undefined ? 'missing' : toneBy(rate)}>
                        <span>D{day}</span>
                        <strong>{pct(rate)}</strong>
                      </div>
                    )
                  })}
                </div>
                <div className="qv4-final">
                  <span>最终收益</span>
                  <strong className={toneBy(item.final_return_rate || item.return_rate)}>{pct(item.final_return_rate || item.return_rate)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="qv4-empty">这一天的推荐还没有收益跟踪记录。等 T+1/T+3/T+5/T+7 更新后会出现在这里。</div>
        )}
      </section>

      <section className="qv4-panel">
        <header className="qv4-panel-head">
          <div>
            <span>History Batches</span>
            <h2>最近批次表现</h2>
          </div>
        </header>
        <div className="qv4-batch-grid">
          {latestBatches.map(batch => (
            <button key={batch.date} type="button" onClick={() => setSelectedDate(batch.date)} className="qv4-batch-card">
              <strong>{batch.date}</strong>
              <span>{batch.count} 只推荐</span>
              <div>
                <b className={toneBy(batch.avg3)}>D3 {pct(batch.avg3)}</b>
                <b className={toneBy(batch.avg5)}>D5 {pct(batch.avg5)}</b>
                <b className={toneBy(batch.avg7)}>D7 {pct(batch.avg7)}</b>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

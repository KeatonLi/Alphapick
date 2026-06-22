import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { dashboardApi, type DashboardData } from '../services/dashboardApi'
import { picksApi, type StockRec } from '../services/picksApi'
import { reviewApi } from '../services/reviewApi'
import type { HistoryRec } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import TradeDatePicker from '../components/TradeDatePicker'
import { useTradeDates } from '../hooks/useTradeDates'

const FACTOR_LABELS: Record<string, string> = {
  momentum: '动量',
  trend: '趋势',
  liquidity: '流动性',
  source_quality: '数据质量',
  risk_penalty: '风险扣分',
  total: '综合',
  quality: '质量',
  volume: '成交量',
  value: '估值',
  theme: '题材',
  inflow: '资金流入',
  risk: '风险',
}

const picksCache = new Map<string, StockRec[]>()
let dashboardCache: DashboardData | null = null
let historyCache: HistoryRec[] | null = null

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

function statusLabel(status?: string) {
  if (status === 'completed') return '已完成'
  if (status === 'tracking') return '跟踪中'
  return status || '跟踪中'
}

function factorEntries(snapshot?: Record<string, number>) {
  return Object.entries(snapshot || {}).slice(0, 4)
}

function factorLabel(key: string) {
  return FACTOR_LABELS[key] || key
}

function formatReason(reason?: string) {
  if (!reason) return '暂无推荐理由'
  const match = reason.match(/Momentum\s+([\d.%-]+),\s*trend\s+([\d.]+)\s*day\(s\),\s*turnover\s+([\d.%-]+),\s*sector\s+(.+?)\.\s*Score\s+([\d.]+)/i)
  if (match) {
    const sector = match[4] === 'Unclassified' ? '' : `，行业 ${match[4]}`
    return `动量 ${match[1]}，趋势延续 ${match[2]} 天，换手率 ${match[3]}${sector}，综合评分 ${match[5]}。`
  }
  return reason
    .replaceAll('Momentum', '动量')
    .replaceAll('trend', '趋势')
    .replaceAll('turnover', '换手率')
    .replaceAll(/,\s*sector\s+Unclassified/gi, '')
    .replaceAll('sector', '行业')
    .replaceAll('Score', '评分')
    .replaceAll('Unclassified', '')
}

function dateOptions(selectedDate: string, dates: string[]) {
  return [selectedDate, ...dates].filter(Boolean).filter((date, index, arr) => arr.indexOf(date) === index)
}

function returnRateByDay(item: HistoryRec, day: number) {
  if (day === 1) return item.price_day1 > 0 ? item.return_rate_day1 : null
  if (day === 2) return item.price_day2 > 0 ? item.return_rate_day2 : null
  if (day === 3) return item.price_day3 > 0 ? item.return_rate_day3 : null
  if (day === 5) return item.price_day5 > 0 ? item.return_rate_day5 : null
  if (day === 7) return item.price_day7 > 0 ? item.return_rate_day7 : null
  return null
}

function currentPriceLabel(item: HistoryRec) {
  return item.current_price > 0 ? money(item.current_price) : '待更新'
}

function trackingLabel(item: HistoryRec) {
  return item.tracking_days > 0 ? `已跟踪 ${item.tracking_days} 天` : '等待首个交易日收盘'
}

function finalReturnValue(item: HistoryRec) {
  if (item.final_return_rate) return item.final_return_rate
  if (item.return_rate && item.current_price > 0) return item.return_rate
  return null
}

export default function RecommendLoopPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const tradeDates = useTradeDates(90)
  const [dashboard, setDashboard] = useState<DashboardData | null>(dashboardCache)
  const [selectedDate, setSelectedDate] = useState(dashboardCache?.trade_date || tradeDates[0] || '')
  const [picks, setPicks] = useState<StockRec[]>(dashboardCache?.today_picks || [])
  const [history, setHistory] = useState<HistoryRec[]>(historyCache || [])
  const [initialLoading, setInitialLoading] = useState(!dashboardCache)
  const [picksLoading, setPicksLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      dashboardCache ? Promise.resolve({ success: true, data: dashboardCache }) : dashboardApi.overview(),
      historyCache ? Promise.resolve({ success: true, data: historyCache }) : reviewApi.history().catch(() => ({ success: false, data: [] })),
    ])
      .then(([overview, review]) => {
        if (!alive) return
        const data = overview.data
        dashboardCache = data
        setDashboard(data)
        setSelectedDate(current => current || data.trade_date || tradeDates[0] || data.today)
        if (review.success && review.data) {
          historyCache = review.data
          setHistory(review.data)
        }
        if (data.trade_date && data.today_picks?.length) {
          picksCache.set(data.trade_date, data.today_picks)
          setPicks(current => current.length ? current : data.today_picks)
        }
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setInitialLoading(false))
    return () => { alive = false }
  }, [tradeDates])

  useEffect(() => {
    if (!selectedDate) return
    let alive = true
    const cached = picksCache.get(selectedDate)
    if (cached) {
      Promise.resolve(cached).then(next => {
        if (alive) setPicks(next)
      })
      return () => { alive = false }
    }
    Promise.resolve().then(() => {
      if (alive) setPicksLoading(true)
    })
    picksApi.daily(selectedDate)
      .then(res => {
        if (!alive) return
        const next = res.success && res.data ? res.data : []
        picksCache.set(selectedDate, next)
        setPicks(next)
      })
      .catch(() => alive && setPicks([]))
      .finally(() => alive && setPicksLoading(false))
    return () => { alive = false }
  }, [selectedDate])

  const availableDates = useMemo(() => dateOptions(selectedDate, tradeDates), [selectedDate, tradeDates])
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
      .slice(0, 8)
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
  const selectedDateIsCurrent = selectedDate === dashboard?.trade_date

  const runReturnUpdate = async () => {
    if (!isAdmin) return
    setUpdating(true)
    setMessage('')
    try {
      await reviewApi.updatePrices()
      const refreshed = await reviewApi.history()
      if (refreshed.success && refreshed.data) {
        historyCache = refreshed.data
        setHistory(refreshed.data)
      }
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
        <div className="qv4-hero-main qv4-reveal">
          <div className="qv4-kicker">推荐闭环</div>
          <h1>推荐工作台</h1>
          <p>每天先看推荐股票，再看历史推荐有没有兑现收益，最后用复盘结论判断这套策略是否值得继续信任。</p>
        </div>
        <div className="qv4-date-card qv4-reveal">
          <span>推荐交易日</span>
          <TradeDatePicker value={selectedDate} onChange={setSelectedDate} tradeDates={availableDates} label="交易日" size="compact" />
          <small>
            {selectedDateIsCurrent
              ? (dashboard?.is_trade_day ? '当前交易日，推荐任务应正常产出' : '当前自然日非交易日，展示最近交易日')
              : '正在查看历史交易日推荐'}
          </small>
        </div>
      </section>

      <section className="qv4-status-grid">
        {initialLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="qv4-status-card loading" key={index}>
              <span className="qv4-status-skeleton label" />
              <strong className="qv4-status-skeleton value" />
              <small className="qv4-status-skeleton note" />
            </div>
          ))
        ) : (
          <>
            <div className="qv4-status-card good"><span>行情样本</span><strong>{dashboard?.pipeline.snapshot_count ?? 0}</strong><small>{dashboard?.pipeline.data_status || '等待检查'}</small></div>
            <div className="qv4-status-card good"><span>当日推荐</span><strong>{picks.length}</strong><small>{selectedDate || '--'}</small></div>
            <div className="qv4-status-card"><span>跟踪样本</span><strong>{summary?.total ?? history.length}</strong><small>统计 3 / 5 / 7 日收益</small></div>
            <div className="qv4-status-card"><span>策略胜率</span><strong>{pct(summary?.win_rate)}</strong><small>历史完成样本</small></div>
          </>
        )}
      </section>

      {message && <div className="qv4-inline-note">{message}</div>}

      <div className="qv4-workspace">
        <section className="qv4-panel qv4-panel-large qv4-reveal">
          <header className="qv4-panel-head">
            <div>
              <span>每日推荐</span>
              <h2>{selectedDate} 推荐股票</h2>
            </div>
            <TradeDatePicker value={selectedDate} onChange={setSelectedDate} tradeDates={availableDates} size="compact" />
          </header>

          {initialLoading || picksLoading ? (
            <div className="qv4-loading-block">
              <i />
              <span>{initialLoading ? '正在加载推荐闭环数据...' : '正在切换交易日...'}</span>
              <div className="qv4-skeleton-list" aria-hidden="true">
                <b />
                <b />
                <b />
              </div>
            </div>
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
                    <p>{formatReason(item.reason)}</p>
                    <div className="qv4-chip-row">
                      {factorEntries(item.factor_snapshot).map(([key, value]) => (
                        <span key={key}>{factorLabel(key)}：{Number(value).toFixed(2)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="qv4-metric"><span>推荐价</span><strong>{money(item.recommend_price)}</strong></div>
                  <div className="qv4-metric"><span>评分</span><strong>{money(item.score)}</strong></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="qv4-empty">这一天还没有推荐股票。若是交易日，请在管理控制台检查推荐任务。</div>
          )}
        </section>

        <aside className="qv4-panel qv4-reveal">
          <header className="qv4-panel-head">
            <div>
              <span>策略复盘</span>
              <h2>策略可信度</h2>
            </div>
          </header>
          <div className={`qv4-verdict ${review?.tone || ''}`}>
            <strong>{review?.verdict || '等待更多样本'}</strong>
            <p>{review?.summary || '系统会基于所有收益跟踪样本，重新生成对当前策略的复盘判断。'}</p>
          </div>
          <div className="qv4-action-advice">
            <strong>{review?.tone === 'caution' ? '建议观望 3 日' : '下一步建议'}</strong>
            <span>{review?.tone === 'caution' ? '先降低新仓试错，优先查看失败样本和 3 日收益分布。' : '继续跟踪最近批次，重点观察 3 / 5 / 7 日收益是否同步改善。'}</span>
            <button type="button" onClick={() => document.getElementById('tracking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看收益样本</button>
          </div>
          <div className="qv4-mini-stats">
            <div><span>3日均收益</span><strong className={toneBy(summary?.avg_return_day3)}>{pct(summary?.avg_return_day3)}</strong></div>
            <div><span>5日均收益</span><strong className={toneBy(summary?.avg_return_day5)}>{pct(summary?.avg_return_day5)}</strong></div>
            <div><span>7日均收益</span><strong className={toneBy(summary?.avg_return_day7)}>{pct(summary?.avg_return_day7)}</strong></div>
            <div><span>最大回撤</span><strong className={toneBy(summary?.avg_max_drawdown)}>{pct(summary?.avg_max_drawdown)}</strong></div>
          </div>
          {isAdmin ? (
            <button className="qv4-primary" onClick={runReturnUpdate} disabled={updating}>
              {updating ? '更新中...' : '管理员更新收益跟踪'}
            </button>
          ) : (
            <div className="qv4-admin-note">收益跟踪由管理控制台定时更新，普通用户只查看结果。</div>
          )}
        </aside>
      </div>

      <section className="qv4-panel qv4-reveal" id="tracking-section">
        <header className="qv4-panel-head">
          <div>
            <span>收益跟踪</span>
            <h2>历史推荐赚没赚</h2>
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
                    <em>{statusLabel(item.status)}</em>
                  </div>
                  <p>推荐价 {money(item.recommend_price)}，当前价{currentPriceLabel(item)}，{trackingLabel(item)}</p>
                </div>
                <div className="qv4-return-strip">
                  {[1, 2, 3, 4, 5, 6, 7].map(day => {
                    const rate = returnRateByDay(item, day)
                    return (
                      <div key={day} className={rate === null || rate === undefined ? 'missing' : toneBy(rate)}>
                        <span>第{day}天</span>
                        <strong>{pct(rate)}</strong>
                      </div>
                    )
                  })}
                </div>
                <div className="qv4-final">
                  <span>最终收益</span>
                  <strong className={toneBy(finalReturnValue(item))}>{pct(finalReturnValue(item))}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="qv4-empty">这一天的推荐还没有收益跟踪记录。等第 1 / 3 / 5 / 7 个交易日更新后会出现在这里。</div>
        )}
      </section>

      <section className="qv4-panel qv4-reveal">
        <header className="qv4-panel-head">
          <div>
            <span>批次表现</span>
            <h2>最近推荐批次</h2>
          </div>
          {isAdmin && <Link to="/console" className="qv4-secondary">去管理控制台</Link>}
        </header>
        <div className="qv4-batch-grid">
          {latestBatches.map(batch => (
            <button key={batch.date} type="button" onClick={() => setSelectedDate(batch.date)} className="qv4-batch-card">
              <strong>{batch.date}</strong>
              <span>{batch.count} 只推荐</span>
              <div>
                <b className={toneBy(batch.avg3)}>第3天 {pct(batch.avg3)}</b>
                <b className={toneBy(batch.avg5)}>第5天 {pct(batch.avg5)}</b>
                <b className={toneBy(batch.avg7)}>第7天 {pct(batch.avg7)}</b>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

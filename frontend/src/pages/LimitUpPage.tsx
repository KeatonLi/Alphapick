import { useEffect, useMemo, useState } from 'react'
import { limitUpApi, type LimitUpItem, type LimitUpOverview } from '../services/limitUpApi'
import TradeDatePicker from '../components/TradeDatePicker'

type BoardGroup = {
  key: string
  title: string
  hint: string
  items: LimitUpItem[]
}

function moneyYi(value?: number | null) {
  if (!value) return '--'
  return `${(value / 100000000).toFixed(2)}亿`
}

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return `${value.toFixed(2)}%`
}

function uniqueDates(selectedDate: string, dates: string[]) {
  return [selectedDate, ...dates].filter(Boolean).filter((date, index, arr) => arr.indexOf(date) === index)
}

function buildReview(data: LimitUpOverview | null) {
  if (!data || !data.summary.total) {
    return '暂无涨停池数据。请先在管理控制台采集涨停池，页面会自动展示真实涨停股票、连板高度和行业热度。'
  }
  const top = data.industries[0]
  const highBoards = data.items.filter(item => item.board_count >= 2).length
  return `涨停池共 ${data.summary.total} 只，最高 ${data.summary.max_board_count} 连板，连板股 ${highBoards} 只。主线集中在 ${top?.industry || data.summary.top_industry || '未分类'}，龙头为 ${top?.leader_name || '--'}。炸板率 ${pct(data.summary.break_rate)}，平均封板强度 ${pct(data.summary.avg_seal_strength)}，短线情绪以真实采集数据为准。`
}

function buildBoardGroups(items: LimitUpItem[]): BoardGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (b.board_count !== a.board_count) return b.board_count - a.board_count
    if (b.seal_strength !== a.seal_strength) return b.seal_strength - a.seal_strength
    return a.rank - b.rank
  })

  return [
    {
      key: 'board-4',
      title: '4板',
      hint: '高位核心',
      items: sorted.filter(item => item.board_count >= 4),
    },
    {
      key: 'board-3',
      title: '3板',
      hint: '晋级观察',
      items: sorted.filter(item => item.board_count === 3),
    },
    {
      key: 'board-2',
      title: '2板',
      hint: '连板梯队',
      items: sorted.filter(item => item.board_count === 2),
    },
    {
      key: 'board-1',
      title: '首板',
      hint: '新启动',
      items: sorted.filter(item => item.board_count <= 1),
    },
  ]
}

export default function LimitUpPage() {
  const [overview, setOverview] = useState<LimitUpOverview | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handleDateChange = (date: string) => {
    setLoading(true)
    setSelectedDate(date)
  }

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
  const boardGroups = useMemo(() => buildBoardGroups(items), [items])
  const availableDates = useMemo(() => uniqueDates(selectedDate, dates), [selectedDate, dates])

  return (
    <div className="qv4-page">
      <section className="qv4-hero compact">
        <div className="qv4-hero-main qv4-reveal">
          <div className="qv4-kicker">涨停复盘</div>
          <h1>涨停板分析</h1>
          <p>围绕每日真实涨停池，观察连板高度、行业扩散、封板强度和炸板风险。这里不展示模拟股票，只读取后端真实采集结果。</p>
        </div>
        <div className="qv4-date-card qv4-reveal">
          <span>涨停池日期</span>
          <TradeDatePicker value={selectedDate} onChange={handleDateChange} tradeDates={availableDates} label="交易日" size="compact" />
          <small>{overview?.source ? `数据来源：${overview.source}` : '等待数据源'}</small>
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
        <section className="qv4-panel qv4-panel-large qv4-reveal">
          <header className="qv4-panel-head">
            <div>
              <span>连板梯队</span>
              <h2>{selectedDate || '--'} 涨停股票分组表</h2>
            </div>
            <TradeDatePicker value={selectedDate} onChange={handleDateChange} tradeDates={availableDates} size="compact" />
          </header>
          {loading ? (
            <div className="qv4-loading-block">
              <i />
              <span>正在读取真实涨停池...</span>
            </div>
          ) : items.length ? (
            <div className="qv4-board-grid">
              {boardGroups.map(group => (
                <section className="qv4-board-section" key={group.key}>
                  <header>
                    <div>
                      <h3>{group.title}</h3>
                      <span>{group.hint}</span>
                    </div>
                    <b>{group.items.length}只</b>
                  </header>
                  {group.items.length ? (
                    <div className="qv4-board-table">
                      <div className="qv4-board-table-head">
                        <span>股票</span>
                        <span>行业</span>
                        <span>封板强度</span>
                        <span>首次封板</span>
                        <span>成交额</span>
                      </div>
                      {group.items.map(row => (
                        <article key={`${row.stock_code}-${row.rank}`} className="qv4-board-table-row">
                          <div><strong>{row.stock_name}</strong><small>{row.stock_code}</small></div>
                          <span>{row.industry || '未分类'}</span>
                          <span className="rise">{pct(row.seal_strength)}</span>
                          <span className="mono">{row.first_limit_time || '--'}</span>
                          <span>{moneyYi(row.amount)}</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="qv4-board-empty">暂无{group.title}股票</div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="qv4-empty">这一天没有涨停池数据。请在管理控制台采集涨停池。</div>
          )}
        </section>

        <aside className="qv4-panel qv4-reveal">
          <header className="qv4-panel-head">
            <div>
              <span>行业热度</span>
              <h2>涨停行业分布</h2>
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

      <section className="qv4-panel qv4-reveal">
        <header className="qv4-panel-head">
          <div>
            <span>涨停摘要</span>
            <h2>短线情绪复盘</h2>
          </div>
        </header>
        <div className="qv4-review-text">{reviewText}</div>
      </section>
    </div>
  )
}

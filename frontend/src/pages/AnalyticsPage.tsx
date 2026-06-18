import { useState, useEffect } from 'react'
import { analyticsApi } from '../services/analyticsApi'
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'
import type {
  WeekdayStatsResponse, HoldingPeriodStatsResponse, ReturnDistributionResponse,
  InsightsResponse, PriceRangeStatsResponse, StockTypeStatsResponse,
  VolatilityStatsResponse, SuccessTrendResponse,
} from '../services/api'
import InsightCard from '../components/analysis/InsightCard'
import WeekdayChart from '../components/analysis/WeekdayChart'
import HoldingPeriodChart from '../components/analysis/HoldingPeriodChart'
import ReturnDistribution from '../components/analysis/ReturnDistribution'
import PriceRangeChart from '../components/analysis/PriceRangeChart'
import StockTypeChart from '../components/analysis/StockTypeChart'
import VolatilityChart from '../components/analysis/VolatilityChart'
import SuccessTrendChart from '../components/analysis/SuccessTrendChart'

type TabKey = 'basic' | 'extended'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<TabKey>('basic')
  const [weekday, setWeekday] = useState<WeekdayStatsResponse | null>(null)
  const [holding, setHolding] = useState<HoldingPeriodStatsResponse | null>(null)
  const [dist, setDist] = useState<ReturnDistributionResponse | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [priceRange, setPriceRange] = useState<PriceRangeStatsResponse | null>(null)
  const [stockType, setStockType] = useState<StockTypeStatsResponse | null>(null)
  const [volatility, setVolatility] = useState<VolatilityStatsResponse | null>(null)
  const [trend, setTrend] = useState<SuccessTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const tradeDates = useTradeDates()

  useEffect(() => {
    if (tradeDates.length > 0) {
      if (!startDate) setStartDate(tradeDates[tradeDates.length - 1])
      if (!endDate) setEndDate(tradeDates[0])
    }
  }, [tradeDates])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const sd = startDate || undefined; const ed = endDate || undefined
      if (tab === 'basic') {
        const [w, h, d, i] = await Promise.all([
          analyticsApi.getWeekdayStats(sd, ed), analyticsApi.getHoldingPeriodStats(sd, ed),
          analyticsApi.getReturnDistribution(3, sd, ed), analyticsApi.getInsights(sd, ed),
        ])
        setWeekday(w); setHolding(h); setDist(d); setInsights(i)
      } else {
        const [p, s, v, t] = await Promise.all([
          analyticsApi.getPriceRangeStats(sd, ed), analyticsApi.getStockTypeStats(sd, ed),
          analyticsApi.getVolatilityStats(sd, ed), analyticsApi.getSuccessTrend(sd, ed),
        ])
        setPriceRange(p); setStockType(s); setVolatility(v); setTrend(t)
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab, startDate, endDate])

  return (
    <div className="qf-page qf-page-wide">
      {/* Header */}
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Strategy Analytics</div>
          <h1 className="qf-title">策略分析</h1>
          <p className="qf-subtitle">量化推荐多维统计 · 历史表现洞察。分析策略在不同市场环境下的表现特征。</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TradeDatePicker value={startDate} onChange={setStartDate} tradeDates={tradeDates} />
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>—</span>
          <TradeDatePicker value={endDate} onChange={setEndDate} tradeDates={tradeDates} />
        </div>
      </div>

      {/* Tabs */}
      <nav className="nav-pills" style={{ marginBottom: 24 }}>
        {(['basic', 'extended'] as TabKey[]).map(k => (
          <a key={k} href="#" onClick={e => { e.preventDefault(); setTab(k) }} className={tab === k ? 'active' : ''}>
            {k === 'basic' ? '基础分析' : '扩展分析'}
          </a>
        ))}
      </nav>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 120, borderRadius: 20 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
            <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 16, borderColor: 'var(--up)', background: 'var(--up-bg)', color: 'var(--up)', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {tab === 'basic' && (
            <>
              {/* Insights */}
              {insights && insights.insights.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div className="section-header" style={{ marginBottom: 14 }}>
                    <h3>关键洞察</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {insights.insights.map((item, i) => <InsightCard key={i} {...item} />)}
                  </div>
                </div>
              )}

              {/* Charts Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, marginBottom: 18 }}>
                <section className="card" style={{ padding: 20 }}>
                  {weekday && <WeekdayChart data={weekday.data} />}
                </section>
                <section className="card" style={{ padding: 20 }}>
                  {holding && <HoldingPeriodChart data={holding.data} optimalDays={holding.optimal_period.days} />}
                </section>
              </div>

              {/* Distribution */}
              {dist && (
                <section className="card" style={{ padding: 20, marginBottom: 18 }}>
                  <ReturnDistribution data={dist} />
                </section>
              )}

              {/* Summary */}
              {weekday && (
                <div className="card" style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  共分析 <strong style={{ color: 'var(--text-primary)' }}>{weekday.summary.total_recommendations}</strong> 条历史推荐 ·
                  最佳日 <strong style={{ color: 'var(--up)' }}>{weekday.summary.best_weekday}</strong> ·
                  最差日 <strong style={{ color: 'var(--down)' }}>{weekday.summary.worst_weekday}</strong>
                </div>
              )}
            </>
          )}

          {tab === 'extended' && (
            <>
              {/* Volatility Insights */}
              {volatility && volatility.summary && (
                <div style={{ marginBottom: 24 }}>
                  <div className="section-header" style={{ marginBottom: 14 }}>
                    <h3>波动性洞察</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    <InsightCard icon="📊" title="风险等级" content={volatility.summary.volatility_assessment as string} />
                    <InsightCard icon="📈" title="平均最大收益" content={`${(volatility.data.avg_max_gain * 100).toFixed(1)}%`} />
                    <InsightCard icon="📉" title="平均最大回撤" content={`${(volatility.data.avg_max_drawdown * 100).toFixed(1)}%`} />
                  </div>
                </div>
              )}

              {/* Trend Insights */}
              {trend && (
                <div style={{ marginBottom: 24 }}>
                  <div className="section-header" style={{ marginBottom: 14 }}>
                    <h3>趋势洞察</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    <InsightCard icon="📈" title="整体趋势" content={trend.summary.trend_direction as string} />
                    <InsightCard icon="📅" title="月度表现" content={`最佳 ${trend.summary.best_month} · 最差 ${trend.summary.worst_month}`} />
                  </div>
                </div>
              )}

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, marginBottom: 18 }}>
                <section className="card" style={{ padding: 20 }}>{priceRange && <PriceRangeChart data={priceRange.data} />}</section>
                <section className="card" style={{ padding: 20 }}>{stockType && <StockTypeChart data={stockType.data} />}</section>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
                <section className="card" style={{ padding: 20 }}>{volatility && <VolatilityChart data={volatility.data} />}</section>
                <section className="card" style={{ padding: 20 }}>{trend && <SuccessTrendChart data={trend.data} trend={trend.summary.trend_direction as string} />}</section>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

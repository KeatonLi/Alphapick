import { useState, useEffect } from 'react'
import { analysisApi, extendedAnalysisApi } from '../services/api'
import type {
  WeekdayStatsResponse,
  HoldingPeriodStatsResponse,
  ReturnDistributionResponse,
  InsightsResponse,
  PriceRangeStatsResponse,
  StockTypeStatsResponse,
  VolatilityStatsResponse,
  SuccessTrendResponse,
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

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [weekdayStats, setWeekdayStats] = useState<WeekdayStatsResponse | null>(null)
  const [holdingStats, setHoldingStats] = useState<HoldingPeriodStatsResponse | null>(null)
  const [distribution, setDistribution] = useState<ReturnDistributionResponse | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [priceRangeStats, setPriceRangeStats] = useState<PriceRangeStatsResponse | null>(null)
  const [stockTypeStats, setStockTypeStats] = useState<StockTypeStatsResponse | null>(null)
  const [volatilityStats, setVolatilityStats] = useState<VolatilityStatsResponse | null>(null)
  const [successTrend, setSuccessTrend] = useState<SuccessTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const sd = startDate || undefined
      const ed = endDate || undefined

      if (activeTab === 'basic') {
        const [weekday, holding, dist, ins] = await Promise.all([
          analysisApi.getWeekdayStats(sd, ed),
          analysisApi.getHoldingPeriodStats(sd, ed),
          analysisApi.getReturnDistribution(3, sd, ed),
          analysisApi.getInsights(sd, ed),
        ])
        setWeekdayStats(weekday)
        setHoldingStats(holding)
        setDistribution(dist)
        setInsights(ins)
      } else {
        const [price, stock, vol, trend] = await Promise.all([
          extendedAnalysisApi.getPriceRangeStats(sd, ed),
          extendedAnalysisApi.getStockTypeStats(sd, ed),
          extendedAnalysisApi.getVolatilityStats(sd, ed),
          extendedAnalysisApi.getSuccessTrend(sd, ed),
        ])
        setPriceRangeStats(price)
        setStockTypeStats(stock)
        setVolatilityStats(vol)
        setSuccessTrend(trend)
      }
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab, startDate, endDate])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'basic', label: '基础分析' },
    { key: 'extended', label: '扩展分析' },
  ]

  if (loading) {
    return (
      <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', color: 'var(--up)', fontSize: 14 }}>{error}</div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', margin: 0, color: 'var(--text-primary)' }}>
          数据<span style={{ color: 'var(--accent)' }}>分析</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
        </div>
      </div>

      <div className="nav-pills" style={{ marginBottom: 24 }}>
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab(tab.key) }}
            className={activeTab === tab.key ? 'active' : ''}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {activeTab === 'basic' && (
        <>
          {insights && insights.insights.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-header">
                <h3>关键洞察</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {insights.insights.map((insight, i) => (
                  <InsightCard key={i} {...insight} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div className="card" style={{ padding: 20 }}>
              {weekdayStats && <WeekdayChart data={weekdayStats.data} />}
            </div>
            <div className="card" style={{ padding: 20 }}>
              {holdingStats && (
                <HoldingPeriodChart
                  data={holdingStats.data}
                  optimalDays={holdingStats.optimal_period.days}
                />
              )}
            </div>
          </div>

          {distribution && (
            <div className="card" style={{ padding: 20, marginBottom: 28 }}>
              <ReturnDistribution data={distribution} />
            </div>
          )}

          {weekdayStats && (
            <div className="card" style={{ padding: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0 }}>共分析 <strong style={{ color: 'var(--text-primary)' }}>{weekdayStats.summary.total_recommendations}</strong> 条历史推荐数据</p>
              <p style={{ margin: '4px 0 0' }}>
                最佳推荐日：<strong style={{ color: 'var(--up)' }}>{weekdayStats.summary.best_weekday}</strong>
                <span style={{ margin: '0 8px', color: 'var(--text-dim)' }}>|</span>
                最差推荐日：<strong style={{ color: 'var(--down)' }}>{weekdayStats.summary.worst_weekday}</strong>
              </p>
            </div>
          )}
        </>
      )}

      {activeTab === 'extended' && (
        <>
          {volatilityStats && volatilityStats.summary && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-header">
                <h3>波动性洞察</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                <InsightCard
                  icon="📊"
                  title="风险等级"
                  content={`风险等级：${volatilityStats.summary.volatility_assessment}`}
                />
                <InsightCard
                  icon="📈"
                  title="平均最大收益"
                  content={`${(volatilityStats.data.avg_max_gain * 100).toFixed(1)}%`}
                />
                <InsightCard
                  icon="📉"
                  title="平均最大回撤"
                  content={`${(volatilityStats.data.avg_max_drawdown * 100).toFixed(1)}%`}
                />
              </div>
            </div>
          )}

          {successTrend && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-header">
                <h3>成功率趋势</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
                <InsightCard
                  icon="📈"
                  title="整体趋势"
                  content={successTrend.summary.trend_direction}
                />
                <InsightCard
                  icon="📅"
                  title="最佳月份"
                  content={`${successTrend.summary.best_month} | 最差月份：${successTrend.summary.worst_month}`}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div className="card" style={{ padding: 20 }}>
              {priceRangeStats && <PriceRangeChart data={priceRangeStats.data} />}
            </div>
            <div className="card" style={{ padding: 20 }}>
              {stockTypeStats && <StockTypeChart data={stockTypeStats.data} />}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <div className="card" style={{ padding: 20 }}>
              {volatilityStats && <VolatilityChart data={volatilityStats.data} />}
            </div>
            <div className="card" style={{ padding: 20 }}>
              {successTrend && (
                <SuccessTrendChart data={successTrend.data} trend={successTrend.summary.trend_direction} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

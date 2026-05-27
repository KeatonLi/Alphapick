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
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">数据分析</h1>
        <div className="flex gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          />
          <span className="text-gray-400 self-center">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 基础分析 Tab */}
      {activeTab === 'basic' && (
        <>
          {/* 关键洞察 */}
          {insights && insights.insights.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">关键洞察</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.insights.map((insight, i) => (
                  <InsightCard key={i} {...insight} />
                ))}
              </div>
            </div>
          )}

          {/* 图表区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {weekdayStats && <WeekdayChart data={weekdayStats.data} />}
            {holdingStats && (
              <HoldingPeriodChart
                data={holdingStats.data}
                optimalDays={holdingStats.optimal_period.days}
              />
            )}
          </div>

          {/* 收益分布 */}
          {distribution && (
            <div className="mb-8">
              <ReturnDistribution data={distribution} />
            </div>
          )}

          {/* 统计摘要 */}
          {weekdayStats && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p>共分析 <strong>{weekdayStats.summary.total_recommendations}</strong> 条历史推荐数据</p>
              <p>最佳推荐日：<strong>{weekdayStats.summary.best_weekday}</strong> | 最差推荐日：<strong>{weekdayStats.summary.worst_weekday}</strong></p>
            </div>
          )}
        </>
      )}

      {/* 扩展分析 Tab */}
      {activeTab === 'extended' && (
        <>
          {/* 波动性洞察 */}
          {volatilityStats && volatilityStats.summary && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">波动性洞察</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* 成功率趋势 */}
          {successTrend && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">成功率趋势</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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

          {/* 图表区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {priceRangeStats && <PriceRangeChart data={priceRangeStats.data} />}
            {stockTypeStats && <StockTypeChart data={stockTypeStats.data} />}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {volatilityStats && <VolatilityChart data={volatilityStats.data} />}
            {successTrend && (
              <SuccessTrendChart data={successTrend.data} trend={successTrend.summary.trend_direction} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

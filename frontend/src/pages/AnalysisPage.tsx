import { useState, useEffect } from 'react'
import { analysisApi } from '../services/api'
import type {
  WeekdayStatsResponse,
  HoldingPeriodStatsResponse,
  ReturnDistributionResponse,
  InsightsResponse,
} from '../services/api'
import InsightCard from '../components/analysis/InsightCard'
import WeekdayChart from '../components/analysis/WeekdayChart'
import HoldingPeriodChart from '../components/analysis/HoldingPeriodChart'
import ReturnDistribution from '../components/analysis/ReturnDistribution'

export default function AnalysisPage() {
  const [weekdayStats, setWeekdayStats] = useState<WeekdayStatsResponse | null>(null)
  const [holdingStats, setHoldingStats] = useState<HoldingPeriodStatsResponse | null>(null)
  const [distribution, setDistribution] = useState<ReturnDistributionResponse | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [weekday, holding, dist, ins] = await Promise.all([
        analysisApi.getWeekdayStats(startDate || undefined, endDate || undefined),
        analysisApi.getHoldingPeriodStats(startDate || undefined, endDate || undefined),
        analysisApi.getReturnDistribution(3, startDate || undefined, endDate || undefined),
        analysisApi.getInsights(startDate || undefined, endDate || undefined),
      ])
      setWeekdayStats(weekday)
      setHoldingStats(holding)
      setDistribution(dist)
      setInsights(ins)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

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
    </div>
  )
}

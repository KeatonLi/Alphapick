import {
  apiGet,
  type HoldingPeriodStatsResponse,
  type InsightsResponse,
  type PriceRangeStatsResponse,
  type ReturnDistributionResponse,
  type StockTypeStatsResponse,
  type SuccessTrendResponse,
  type VolatilityStatsResponse,
  type WeekdayStatsResponse,
} from './api'

function params(startDate?: string, endDate?: string) {
  const p = new URLSearchParams()
  if (startDate) p.append('start_date', startDate)
  if (endDate) p.append('end_date', endDate)
  return p
}

export const analyticsApi = {
  getWeekdayStats: (startDate?: string, endDate?: string) =>
    apiGet<WeekdayStatsResponse>(`/analytics/weekday-stats?${params(startDate, endDate)}`),
  getHoldingPeriodStats: (startDate?: string, endDate?: string) =>
    apiGet<HoldingPeriodStatsResponse>(`/analytics/holding-period-stats?${params(startDate, endDate)}`),
  getReturnDistribution: (holdingDays = 3, startDate?: string, endDate?: string) => {
    const p = params(startDate, endDate)
    p.append('holding_days', String(holdingDays))
    return apiGet<ReturnDistributionResponse>(`/analytics/return-distribution?${p}`)
  },
  getInsights: (startDate?: string, endDate?: string) =>
    apiGet<InsightsResponse>(`/analytics/insights?${params(startDate, endDate)}`),
  getPriceRangeStats: (startDate?: string, endDate?: string) =>
    apiGet<PriceRangeStatsResponse>(`/analytics/price-range-stats?${params(startDate, endDate)}`),
  getStockTypeStats: (startDate?: string, endDate?: string) =>
    apiGet<StockTypeStatsResponse>(`/analytics/stock-type-stats?${params(startDate, endDate)}`),
  getVolatilityStats: (startDate?: string, endDate?: string) =>
    apiGet<VolatilityStatsResponse>(`/analytics/volatility-stats?${params(startDate, endDate)}`),
  getSuccessTrend: (startDate?: string, endDate?: string) =>
    apiGet<SuccessTrendResponse>(`/analytics/success-trend?${params(startDate, endDate)}`),
}

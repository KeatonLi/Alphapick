import { apiGet } from './api'

export interface StockRec {
  stock_code: string
  stock_name: string
  recommend_price: number
  reason: string
  rank: number
  score: number
  strategy_version: string
  factor_snapshot: Record<string, number>
}

export interface PickStats {
  total: number
  completed: number
  win_count: number
  win_rate: number
  avg_return: number
  avg_max_gain: number
  avg_max_drawdown: number
  avg_return_day3: number
  avg_return_day5: number
  avg_return_day7: number
  win_rate_day3: number
  win_rate_day5: number
  win_rate_day7: number
}

export const picksApi = {
  daily: (date: string) => apiGet<{ success: boolean; data?: StockRec[]; error?: string }>(`/picks/daily?date=${date}`),
  latest: () => apiGet<{ success: boolean; data?: StockRec[]; meta?: Record<string, unknown> }>('/picks/latest'),
  dates: () => apiGet<{ success: boolean; data: string[] }>('/picks/dates'),
  tradeDates: (days = 365) => apiGet<{ success: boolean; data: string[] }>(`/picks/trade-dates?days=${days}`),
}

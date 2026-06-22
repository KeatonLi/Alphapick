import { apiGet } from './api'

export interface LimitUpItem {
  rank: number
  stock_code: string
  stock_name: string
  change_pct: number
  latest_price: number
  amount: number
  float_market_value: number
  market_value: number
  turnover_rate: number
  seal_amount: number
  first_limit_time: string
  last_limit_time: string
  break_count: number
  limit_stat: string
  limit_total: number
  limit_success: number
  board_count: number
  industry: string
  seal_strength: number
}

export interface LimitUpIndustry {
  industry: string
  count: number
  leader_code: string
  leader_name: string
  max_board_count: number
  avg_seal_strength: number
}

export interface LimitUpSummary {
  total: number
  max_board_count: number
  first_board_count: number
  break_rate: number
  avg_seal_strength: number
  total_seal_amount: number
  top_industry: string
}

export interface LimitUpOverview {
  date: string
  source: string
  items: LimitUpItem[]
  industries: LimitUpIndustry[]
  summary: LimitUpSummary
}

export const limitUpApi = {
  overview: (date?: string) => apiGet<{ success: boolean; data: LimitUpOverview }>(date ? `/limit-up?date=${date}` : '/limit-up'),
  dates: (days = 60) => apiGet<{ success: boolean; data: string[] }>(`/limit-up/dates?days=${days}`),
}

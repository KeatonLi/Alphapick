import { apiGet, type HistoryRec } from './api'
import type { PickStats, StockRec } from './picksApi'

export interface PipelineStatus {
  data_status: string
  snapshot_count: number
  recommend_status: string
  returns_status: string
  last_fetch_status: string | null
  last_run_at: string | null
  last_run_result: string | null
}

export interface TrackingBatch {
  date: string
  count: number
  completed_count: number
  tracking_count: number
  max_tracking_days: number
  avg_day3: number | null
  avg_day5: number | null
  avg_day7: number | null
  items: HistoryRec[]
}

export interface StrategyReview {
  verdict: string
  tone: 'positive' | 'neutral' | 'caution' | string
  summary: string
  tracking_count: number
}

export interface DashboardData {
  today: string
  trade_date: string
  is_trade_day: boolean
  pipeline: PipelineStatus
  today_picks: StockRec[]
  tracking_batches: TrackingBatch[]
  strategy_summary: PickStats
  strategy_review: StrategyReview
}

export const dashboardApi = {
  overview: () => apiGet<{ success: boolean; data: DashboardData; error?: string }>('/dashboard'),
}

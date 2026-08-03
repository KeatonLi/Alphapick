import { apiGet, apiPost } from './api'

export interface AnalysisListItem {
  id: number
  stock_code: string
  stock_name: string
  decision: string
  confidence: number | null
  summary: string
  data_asof: string | null
  created_at: string | null
}

export interface AnalysisFactors {
  momentum: number | null
  trend: number | null
  liquidity: number | null
  source_quality: number | null
  risk_penalty: number | null
  total: number | null
}

export interface AnalysisTechnicals {
  ma: {
    ma5?: number | null
    ma20?: number | null
    ma60?: number | null
    trend?: string | null
  }
  macd: Record<string, number | null>
  kdj: Record<string, number | null>
  range_change: number | null
  volatility: number | null
  latest_close?: number | null
}

export interface AnalysisValuation {
  pe: number | null
  pb: number | null
  pe_percentile: number | null
  pb_percentile: number | null
}

export interface AnalysisDetail {
  id: number
  stock_code: string
  stock_name: string
  decision: string
  confidence: number | null
  summary: string
  reasons: string[]
  technicals: AnalysisTechnicals
  factors: AnalysisFactors
  valuation: AnalysisValuation
  data_asof: string | null
  created_at: string | null
}

export const analyzeApi = {
  create: (query: string) =>
    apiPost<{ success: boolean; data: AnalysisDetail }>('/analyze', { query }),
  list: (limit = 20) =>
    apiGet<{ success: boolean; data: AnalysisListItem[] }>(`/analyze?limit=${limit}`),
  detail: (id: number) =>
    apiGet<{ success: boolean; data: AnalysisDetail }>(`/analyze/${id}`),
}

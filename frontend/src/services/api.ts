const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function apiGet<T = any>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { method: 'GET', ...options })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}

// ─── 数据分析 API ────────────────────────────────────────────────────────

export interface WeekdayStat {
  count: number
  win_count: number
  win_rate: number
  avg_return: number
  max_return: number
  min_return: number
}

export interface WeekdayStatsResponse {
  data: Record<string, WeekdayStat>
  summary: {
    total_recommendations: number
    best_weekday: string
    worst_weekday: string
  }
}

export interface HoldingPeriodStat {
  count: number
  avg_return: number
  win_rate: number
  median_return: number
}

export interface HoldingPeriodStatsResponse {
  data: Record<string, HoldingPeriodStat>
  optimal_period: {
    days: number
    reason: string
  }
}

export interface ReturnDistributionResponse {
  bins: string[]
  counts: number[]
  percentiles: {
    p25: number
    p50: number
    p75: number
  }
}

export interface Insight {
  type: string
  icon: string
  title: string
  content: string
}

export interface InsightsResponse {
  insights: Insight[]
  generated_at: string
}

export const analysisApi = {
  getWeekdayStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<WeekdayStatsResponse>(`/analysis/weekday-stats?${params}`)
  },

  getHoldingPeriodStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<HoldingPeriodStatsResponse>(`/analysis/holding-period-stats?${params}`)
  },

  getReturnDistribution: (holdingDays: number = 3, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    params.append('holding_days', String(holdingDays))
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<ReturnDistributionResponse>(`/analysis/return-distribution?${params}`)
  },

  getInsights: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<InsightsResponse>(`/analysis/insights?${params}`)
  },
}

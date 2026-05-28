const API_BASE = import.meta.env.VITE_API_URL || '/api'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    // 不自动跳转，让 ProtectedRoute 或调用方处理
    throw new Error('请先登录')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}

export async function apiGet<T = any>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders(), ...(options?.headers as Record<string, string> | undefined) },
    ...options,
  })
  return handleResponse<T>(res)
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers: Record<string, string> = { ...authHeaders() }
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() })
  return handleResponse<T>(res)
}

// ─── 收益跟踪数据类型 ───────────────────────────────────────────

export interface HistoryRec {
  id: number; recommend_date: string; stock_code: string; stock_name: string
  recommend_price: number; current_price: number; return_rate: number; reason: string
  tracking_days: number; status: string
  price_day1: number; price_day2: number; price_day3: number
  return_rate_day1: number; return_rate_day2: number; return_rate_day3: number
  final_return_rate: number; max_gain: number; max_drawdown: number
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

// ─── 扩展分析 API ──────────────────────────────────────────────────────

export interface PriceRangeStat {
  count: number
  win_count: number
  win_rate: number
  avg_return: number
  avg_price?: number
  max_return?: number
  min_return?: number
}

export interface PriceRangeStatsResponse {
  data: Record<string, PriceRangeStat>
  summary: Record<string, unknown>
}

export interface StockTypeStat {
  count: number
  win_count: number
  win_rate: number
  avg_return: number
  max_return?: number
  min_return?: number
}

export interface StockTypeStatsResponse {
  data: Record<string, StockTypeStat>
  summary: Record<string, unknown>
}

export interface VolatilityStat {
  avg_max_gain: number
  max_gain_std: number
  median_max_gain: number
  gain_positive_rate: number
  avg_max_drawdown: number
  max_drawdown_std: number
  median_max_drawdown: number
  final_return_std: number
}

export interface VolatilityStatsResponse {
  data: VolatilityStat
  summary: {
    total_recommendations: number
    volatility_assessment: string
  }
}

export interface TrendDataPoint {
  month: string
  count: number
  win_rate: number
  avg_return: number
}

export interface SuccessTrendResponse {
  data: TrendDataPoint[]
  summary: {
    total_months: number
    trend_direction: string
    best_month: string
    worst_month: string
  }
}

export const extendedAnalysisApi = {
  getPriceRangeStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<PriceRangeStatsResponse>(`/analysis/price-range-stats?${params}`)
  },

  getStockTypeStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<StockTypeStatsResponse>(`/analysis/stock-type-stats?${params}`)
  },

  getVolatilityStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<VolatilityStatsResponse>(`/analysis/volatility-stats?${params}`)
  },

  getSuccessTrend: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<SuccessTrendResponse>(`/analysis/success-trend?${params}`)
  },
}

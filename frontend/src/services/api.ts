const API_BASE = import.meta.env.VITE_API_URL || '/api'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    throw new Error('请先登录')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}

async function handleLoginResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '登录失败')
  }
  return res.json()
}

export async function apiGet<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders(), ...(options?.headers as Record<string, string> | undefined) },
    ...options,
  })
  return handleResponse<T>(res)
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers: Record<string, string> = { ...authHeaders() }
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return path === '/auth/login' ? handleLoginResponse<T>(res) : handleResponse<T>(res)
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() })
  return handleResponse<T>(res)
}

// 收益跟踪数据类型
export interface HistoryRec {
  id: number
  recommend_date: string
  stock_code: string
  stock_name: string
  recommend_price: number
  current_price: number
  return_rate: number
  reason: string
  rank: number
  score: number
  strategy_version: string
  factor_snapshot: Record<string, number>
  tracking_days: number
  status: string
  price_day1: number
  price_day2: number
  price_day3: number
  price_day5: number
  price_day7: number
  return_rate_day1: number
  return_rate_day2: number
  return_rate_day3: number
  return_rate_day5: number
  return_rate_day7: number
  final_return_rate: number
  max_gain: number
  max_drawdown: number
}

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

export interface DatasourceStatusItem {
  data_type: string
  label: string
  status: string
  duration_ms: number | null
  response_size: number | null
  error_message: string | null
  retry_count: number | null
  has_data: boolean
  fetched_at: string | null
  quality_status?: string | null
  quality_count?: number | null
  quality_message?: string | null
}

export interface FetchLogEntry {
  id: number
  source_name: string
  data_type: string
  label: string
  target_date: string
  status: string
  error_message: string | null
  retry_count: number
  duration_ms: number
  response_size: number | null
  created_at: string
}

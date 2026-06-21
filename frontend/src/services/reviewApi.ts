import { apiDelete, apiGet, apiPost, type HistoryRec } from './api'

export interface ReviewSummary {
  total_recommendations: number
  completed_count: number
  tracking_count: number
  win_rate: number
  avg_return: number
  max_gain: number
  max_drawdown: number
  avg_return_day1: number
  avg_return_day3: number
  avg_return_day5: number
  avg_return_day7: number
  win_rate_day1: number
  win_rate_day3: number
  win_rate_day5: number
  win_rate_day7: number
}

export const reviewApi = {
  history: (limit = 300) => apiGet<{ success: boolean; data?: HistoryRec[]; summary?: ReviewSummary; error?: string }>(`/review/history?limit=${limit}`),
  summary: () => apiGet<{ success: boolean; data?: any; error?: string }>('/review/summary'),
  updatePrices: () => apiPost('/review/update-prices'),
  batchUpdate: (ids: number[]) => apiPost('/review/batch/update', ids),
  batchReset: (ids: number[]) => apiPost('/review/batch/reset', ids),
  batchDelete: (ids: number[]) => apiPost('/review/batch/delete', ids),
  resetItem: (id: number) => apiPost(`/review/item/${id}/reset`),
  deleteItem: (id: number) => apiDelete(`/review/item/${id}`),
}

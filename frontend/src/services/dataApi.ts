import { apiDelete, apiGet, apiPost, type DatasourceStatusItem, type FetchLogEntry } from './api'

export const dataApi = {
  status: (date?: string) =>
    apiGet<{ success: boolean; data: DatasourceStatusItem[] }>(`/data/status${date ? `?date=${date}` : ''}`),
  fetch: (dataType: string, date?: string) =>
    apiPost<{ success: boolean; data: any }>(`/data/fetch/${dataType}${date ? `?date=${date}` : ''}`),
  fetchAll: (date?: string) =>
    apiPost<{ success: boolean; data: any }>(`/data/fetch-all${date ? `?date=${date}` : ''}`),
  deleteRecord: (dataType: string, date?: string) =>
    apiDelete<{ success: boolean; data: any }>(`/data/records/${dataType}${date ? `?date=${date}` : ''}`),
  deleteAllRecords: (date?: string) =>
    apiDelete<{ success: boolean; data: any }>(`/data/records${date ? `?date=${date}` : ''}`),
  dates: () =>
    apiGet<{ success: boolean; data: Record<string, { label: string; dates: string[] }> }>('/data/dates'),
  logs: (page = 1, dataType?: string, status?: string) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    if (dataType) params.append('data_type', dataType)
    if (status) params.append('status', status)
    return apiGet<{ success: boolean; data: { total: number; logs: FetchLogEntry[] } }>(`/data/logs?${params}`)
  },
}

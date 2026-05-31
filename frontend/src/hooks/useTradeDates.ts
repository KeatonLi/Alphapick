import { useState, useEffect } from 'react'
import { apiGet } from '../services/api'

// 模块级缓存，跨组件共享
let cached: string[] | null = null
let pending: Promise<string[]> | null = null

export function useTradeDates(): string[] {
  const [dates, setDates] = useState<string[]>(cached || [])

  useEffect(() => {
    if (cached) {
      setDates(cached)
      return
    }
    if (pending) {
      pending.then(d => setDates(d))
      return
    }
    pending = apiGet<any>('/report/trade-dates?days=365')
      .then(d => {
        const result: string[] = d.success ? (d.data || []) : []
        cached = result
        pending = null
        return result
      })
      .catch(() => {
        pending = null
        return []
      })
    pending.then(d => setDates(d))
  }, [])

  return dates
}

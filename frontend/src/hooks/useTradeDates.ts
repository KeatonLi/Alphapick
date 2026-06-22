import { useEffect, useState } from 'react'
import { picksApi } from '../services/picksApi'

const cachedByDays = new Map<number, string[]>()
const pendingByDays = new Map<number, Promise<string[]>>()

export function useTradeDates(days = 365): string[] {
  const [dates, setDates] = useState<string[]>(cachedByDays.get(days) || [])

  useEffect(() => {
    const cached = cachedByDays.get(days)
    if (cached) {
      Promise.resolve(cached).then(setDates)
      return
    }

    const existing = pendingByDays.get(days)
    if (existing) {
      existing.then(setDates)
      return
    }

    const pending = picksApi.tradeDates(days)
      .then(res => {
        const result: string[] = res.success ? (res.data || []) : []
        cachedByDays.set(days, result)
        pendingByDays.delete(days)
        return result
      })
      .catch(() => {
        pendingByDays.delete(days)
        return []
      })

    pendingByDays.set(days, pending)
    pending.then(setDates)
  }, [days])

  return dates
}

import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (date: string) => void
  tradeDates: string[]
  label?: string
  tone?: 'light' | 'solid'
  size?: 'normal' | 'compact'
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function getWeekday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : WEEKDAY_NAMES[d.getDay()]
}

function uniqueDates(value: string, tradeDates: string[]) {
  return [value, ...tradeDates].filter(Boolean).filter((date, index, arr) => arr.indexOf(date) === index)
}

export default function TradeDatePicker({ value, onChange, tradeDates, label = '选择交易日', tone = 'light', size = 'normal' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dates = useMemo(() => uniqueDates(value, tradeDates), [value, tradeDates])
  const idx = dates.indexOf(value)
  const canGoOlder = idx >= 0 && idx < dates.length - 1
  const canGoNewer = idx > 0
  const weekday = value ? getWeekday(value) : ''

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const choose = (date: string) => {
    onChange(date)
    setOpen(false)
  }

  return (
    <div className={`qv4-trade-picker ${tone} ${size}`} ref={rootRef}>
      <button
        type="button"
        className="qv4-date-step"
        onClick={() => canGoOlder && choose(dates[idx + 1])}
        disabled={!canGoOlder}
        aria-label="上一个交易日"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        className="qv4-date-trigger"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}，当前 ${value || '未选择'}`}
      >
        <span>{label}</span>
        <strong>{value || '加载中'}</strong>
        <em>{weekday || '交易日'}</em>
      </button>
      <button
        type="button"
        className="qv4-date-step"
        onClick={() => canGoNewer && choose(dates[idx - 1])}
        disabled={!canGoNewer}
        aria-label="下一个交易日"
      >
        <span aria-hidden="true">›</span>
      </button>
      {open && (
        <div className="qv4-date-menu" role="listbox" aria-label="交易日列表">
          {dates.map(date => (
            <button
              type="button"
              role="option"
              aria-selected={date === value}
              key={date}
              onClick={() => choose(date)}
            >
              <strong>{date}</strong>
              <span>{getWeekday(date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

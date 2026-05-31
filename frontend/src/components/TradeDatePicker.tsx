import { useMemo } from 'react'

interface Props {
  value: string
  onChange: (date: string) => void
  tradeDates: string[]
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function getWeekday(dateStr: string): string {
  const d = new Date(dateStr)
  return WEEKDAY_NAMES[d.getDay()]
}

export default function TradeDatePicker({ value, onChange, tradeDates }: Props) {
  const idx = tradeDates.indexOf(value)
  const canPrev = idx >= 0 && idx < tradeDates.length - 1
  const canNext = idx > 0

  const displayDate = useMemo(() => {
    if (!value) return ''
    return `${value} (${getWeekday(value)})`
  }, [value])

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 8,
    border: '1px solid var(--border-default)',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--text-secondary)' : 'var(--text-dim)',
    cursor: active ? 'pointer' : 'default',
    opacity: active ? 1 : 0.35,
    transition: 'all 0.2s',
  })

  const todayBtnStyle: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: '1px solid var(--border-default)', background: 'var(--bg-card)',
    color: 'var(--text-secondary)', cursor: 'pointer',
    transition: 'all 0.2s',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => onChange(tradeDates[idx + 1])} disabled={!canPrev} style={btnStyle(canPrev)}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)', minWidth: 160, textAlign: 'center',
        padding: '6px 12px', borderRadius: 8,
        background: 'var(--bg-input)', border: '1px solid var(--border-default)',
      }}>
        {displayDate || '加载中...'}
      </span>

      <button onClick={() => onChange(tradeDates[idx - 1])} disabled={!canNext} style={btnStyle(canNext)}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      {tradeDates.length > 0 && tradeDates[0] !== value && (
        <button onClick={() => onChange(tradeDates[0])} style={todayBtnStyle}>
          返回今日
        </button>
      )}
    </div>
  )
}

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
  const canGoOlder = idx >= 0 && idx < tradeDates.length - 1
  const canGoNewer = idx > 0
  const displayDate = value ? `${value} (${getWeekday(value)})` : ''

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'grid',
    placeItems: 'center',
    width: 38,
    height: 38,
    borderRadius: 14,
    border: '1px solid var(--border-default)',
    background: active ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.025)',
    color: active ? 'var(--text-secondary)' : 'var(--text-dim)',
    cursor: active ? 'pointer' : 'default',
    opacity: active ? 1 : 0.35,
    transition: 'all .2s',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(tradeDates[idx + 1])} disabled={!canGoOlder} style={btnStyle(canGoOlder)} aria-label="上一个交易日">
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        fontWeight: 800,
        color: 'var(--text-primary)',
        minWidth: 176,
        textAlign: 'center',
        padding: '9px 14px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.075)',
        border: '1px solid var(--border-default)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }}>
        {displayDate || '加载中...'}
      </span>

      <button onClick={() => onChange(tradeDates[idx - 1])} disabled={!canGoNewer} style={btnStyle(canGoNewer)} aria-label="下一个交易日">
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      {tradeDates.length > 0 && tradeDates[0] !== value && (
        <button onClick={() => onChange(tradeDates[0])} style={{
          height: 38,
          padding: '0 14px',
          borderRadius: 14,
          border: '1px solid var(--border-default)',
          background: 'rgba(255,255,255,0.07)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 12,
        }}>
          返回最新
        </button>
      )}
    </div>
  )
}

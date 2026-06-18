import { useState } from 'react'
import type { HistoryRec } from '../../services/api'

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number, showSign = true) {
  if (n === 0) return '0%'
  return (showSign && n > 0 ? '+' : '') + fmt(n) + '%'
}

interface DetailedTableProps {
  recs: HistoryRec[]
  selectedIds: Set<number>
  onSelect: (id: number, checked: boolean) => void
  onSelectAll: () => void
  onUpdate: (id: number) => void
  onReset: (rec: HistoryRec) => void
  onDelete: (rec: HistoryRec) => void
  busyIds: Set<number>
  sortBy: string
  onSortByChange: (v: string) => void
}

const SORTABLE_COLS: { key: string; label: string }[] = [
  { key: 'date-desc', label: '日期' },
  { key: 'name', label: '名称' },
  { key: 'return', label: '收益' },
]

export default function DetailedTable({
  recs, selectedIds, onSelect, onSelectAll,
  onUpdate, onReset, onDelete, busyIds,
  sortBy, onSortByChange,
}: DetailedTableProps) {
  const allSelected = recs.length > 0 && selectedIds.size === recs.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < recs.length

  const rateColor = (v: number) => v > 0 ? 'var(--up)' : v < 0 ? 'var(--down)' : ''

  return (
    <div className="stock-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          {/* ─── THEAD ─── */}
          <thead>
            <tr className="border-b border-border-default" style={{ backgroundColor: 'var(--accent-bg)' }}>
              <th className="w-8 px-2 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={onSelectAll}
                  className="w-3.5 h-3.5 rounded border-border-default focus:ring-blue-300"
                  style={{ color: 'var(--accent)' }}
                />
              </th>
              {SORTABLE_COLS.map(col => {
                const active = sortBy.startsWith(col.key.replace('-desc', '').replace('-asc', ''))
                return (
                  <SortHeader
                    key={col.key}
                    col={col}
                    sortBy={sortBy}
                    onSortByChange={onSortByChange}
                    active={active}
                  />
                )
              })}
              <th className="px-2 py-2 text-right font-semibold text-text-muted whitespace-nowrap">推荐价</th>
              <th className="px-2 py-2 text-right font-semibold text-text-muted whitespace-nowrap">Day1 价/率</th>
              <th className="px-2 py-2 text-right font-semibold text-text-muted whitespace-nowrap">Day2 价/率</th>
              <th className="px-2 py-2 text-right font-semibold text-text-muted whitespace-nowrap">Day3 价/率</th>
              <th className="px-2 py-2 text-right font-semibold text-text-muted whitespace-nowrap">最终收益</th>
              <th className="px-2 py-2 text-right font-semibold text-text-muted whitespace-nowrap">最高/最低</th>
              <th className="px-2 py-2 text-center font-semibold text-text-muted whitespace-nowrap">状态</th>
              <th className="px-2 py-2 text-center font-semibold text-text-muted whitespace-nowrap">操作</th>
            </tr>
          </thead>
          {/* ─── TBODY ─── */}
          <tbody className="divide-y divide-border-default/50">
            {recs.map(rec => {
              const selected = selectedIds.has(rec.id)
              const busy = busyIds.has(rec.id)
              const completed = rec.status === 'completed'
              const td = rec.tracking_days || 0

              // Day helpers
              const dayPrice = (day: number) => (rec as any)[`price_day${day}`] as number || 0
              const dayRate = (day: number) => (rec as any)[`return_rate_day${day}`] as number || 0
              const hasDay = (day: number) => dayPrice(day) > 0

              const cellClass = 'px-2 py-2.5 whitespace-nowrap'

              const rowBg = selected
                ? 'var(--accent-bg)'
                : completed
                  ? 'var(--down-bg)'
                  : undefined

              return (
                <tr
                  key={rec.id}
                  className="transition-colors"
                  style={rowBg ? { backgroundColor: rowBg } : undefined}
                  onMouseEnter={e => {
                    if (!selected && !completed) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card-hover)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!selected && !completed) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = ''
                    }
                  }}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={selected}
                      onChange={e => onSelect(rec.id, e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border-default focus:ring-blue-300"
                      style={{ color: 'var(--accent)' }}
                    />
                  </td>

                  {/* 日期 */}
                  <td className={`${cellClass} font-mono text-text-muted`}>{rec.recommend_date.slice(5)}</td>

                  {/* 代码 */}
                  <td className={`${cellClass} font-mono text-text-muted`}>{rec.stock_code}</td>

                  {/* 名称 */}
                  <td className={`${cellClass} font-semibold`} style={{ color: 'var(--text-primary)' }}>{rec.stock_name}</td>

                  {/* 推荐价 */}
                  <td className={`${cellClass} font-mono text-right`}>{fmt(rec.recommend_price)}</td>

                  {/* Day1 */}
                  <td className={`${cellClass} text-right`}>
                    {hasDay(1) ? (
                      <><span className="font-mono">{fmt(dayPrice(1))}</span> <span className="font-mono text-[10px]" style={{ color: rateColor(dayRate(1)) }}>{fmtRate(dayRate(1), false)}</span></>
                    ) : <span className="text-text-muted">—</span>}
                  </td>

                  {/* Day2 */}
                  <td className={`${cellClass} text-right`}>
                    {hasDay(2) ? (
                      <><span className="font-mono">{fmt(dayPrice(2))}</span> <span className="font-mono text-[10px]" style={{ color: rateColor(dayRate(2)) }}>{fmtRate(dayRate(2), false)}</span></>
                    ) : <span className="text-text-muted">—</span>}
                  </td>

                  {/* Day3 */}
                  <td className={`${cellClass} text-right`}>
                    {hasDay(3) ? (
                      <><span className="font-mono">{fmt(dayPrice(3))}</span> <span className="font-mono text-[10px]" style={{ color: rateColor(dayRate(3)) }}>{fmtRate(dayRate(3), false)}</span></>
                    ) : <span className="text-text-muted">—</span>}
                  </td>

                  {/* 最终收益 */}
                  <td className={`${cellClass} font-mono font-bold text-right`} style={{ color: rateColor(rec.final_return_rate) }}>
                    {completed ? fmtRate(rec.final_return_rate) : '—'}
                  </td>

                  {/* 最高/最低 */}
                  <td className={`${cellClass} text-[10px] text-right`}>
                    {completed ? (
                      <span className="text-text-muted">
                        <span style={{ color: 'var(--up)' }}>+{fmt(rec.max_gain)}</span>
                        /<span style={{ color: 'var(--down)' }}>{fmt(rec.max_drawdown)}</span>
                      </span>
                    ) : '—'}
                  </td>

                  {/* 状态 */}
                  <td className={`${cellClass} text-center`}>
                    {completed ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={rec.final_return_rate >= 0
                          ? { backgroundColor: 'var(--up-bg)', color: 'var(--up)' }
                          : { backgroundColor: 'var(--down-bg)', color: 'var(--down)' }
                        }
                      >
                        {fmtRate(rec.final_return_rate)}
                      </span>
                    ) : td > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}
                      >
                        {td}/3
                      </span>
                    ) : (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ backgroundColor: 'var(--bg-tag)', color: 'var(--text-muted)' }}
                      >
                        待更新
                      </span>
                    )}
                  </td>

                  {/* 操作 */}
                  <td className={`${cellClass} text-center`}>
                    <div className="flex items-center justify-center gap-1">
                      {!completed && (
                        <ActionButton label={busy ? '…' : '更新'} onClick={() => onUpdate(rec.id)} disabled={busy} variant="primary" />
                      )}
                      <ActionButton label={busy ? '…' : '重置'} onClick={() => onReset(rec)} disabled={busy} variant="warning" />
                      <ActionButton label={busy ? '…' : '删除'} onClick={() => onDelete(rec)} disabled={busy} variant="danger" />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 空状态（筛选无结果） */}
      {recs.length === 0 && (
        <div className="py-8 text-center text-sm text-text-muted">无匹配数据</div>
      )}
    </div>
  )
}

function SortHeader({
  col,
  sortBy,
  onSortByChange,
  active,
}: {
  col: { key: string; label: string }
  sortBy: string
  onSortByChange: (v: string) => void
  active: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <th
      onClick={() => {
        if (sortBy === col.key) {
          onSortByChange(col.key.replace('-desc', '-asc'))
        } else if (sortBy === col.key.replace('-desc', '-asc')) {
          onSortByChange(col.key)
        } else {
          onSortByChange(col.key)
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-2 py-2 text-left font-semibold text-text-muted cursor-pointer select-none whitespace-nowrap"
      style={{ color: active || hover ? 'var(--accent)' : undefined }}
    >
      {col.label}
      {active && (
        <span className="ml-1">{sortBy.includes('asc') ? '↑' : '↓'}</span>
      )}
    </th>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  variant: 'primary' | 'warning' | 'danger'
}) {
  const [hover, setHover] = useState(false)
  const colors = {
    primary: { fg: 'var(--accent)', bg: 'var(--accent-bg)', bgHover: 'rgba(99,102,241,.22)' },
    warning: { fg: 'var(--blue)', bg: 'var(--blue-bg)', bgHover: 'rgba(59,130,246,.18)' },
    danger:  { fg: 'var(--up)',   bg: 'var(--up-bg)',   bgHover: 'rgba(248,113,113,.18)' },
  }
  const c = colors[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-1.5 py-0.5 rounded text-[10px] font-semibold disabled:opacity-40 transition-all"
      style={{ backgroundColor: hover ? c.bgHover : c.bg, color: c.fg }}
    >
      {label}
    </button>
  )
}

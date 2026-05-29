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

  return (
    <div className="stock-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          {/* ─── THEAD ─── */}
          <thead>
            <tr className="bg-blue-50/80 border-b border-border-default">
              <th className="w-8 px-2 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={onSelectAll}
                  className="w-3.5 h-3.5 rounded border-border-default text-blue-600 focus:ring-blue-300"
                />
              </th>
              {SORTABLE_COLS.map(col => {
                const active = sortBy.startsWith(col.key.replace('-desc', '').replace('-asc', ''))
                return (
                  <th
                    key={col.key}
                    onClick={() => {
                      if (sortBy === col.key) {
                        onSortByChange(col.key.replace('-desc', '-asc'))
                      } else if (sortBy === col.key.replace('-desc', '-asc')) {
                        onSortByChange(col.key)
                      } else {
                        onSortByChange(col.key)
                      }
                    }}
                    className={`px-2 py-2 text-left font-semibold text-text-muted cursor-pointer hover:text-blue-600 select-none whitespace-nowrap ${
                      active ? 'text-blue-600' : ''
                    }`}
                  >
                    {col.label}
                    {active && (
                      <span className="ml-1">{sortBy.includes('asc') ? '↑' : '↓'}</span>
                    )}
                  </th>
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
              const rateColor = (v: number) => v > 0 ? 'text-red-500' : v < 0 ? 'text-green-600' : ''

              return (
                <tr key={rec.id} className={`transition-colors ${
                  selected ? 'bg-blue-50/70' : completed ? 'bg-green-50/20' : 'hover:bg-blue-50/40'
                }`}>
                  {/* Checkbox */}
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={selected}
                      onChange={e => onSelect(rec.id, e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border-default text-blue-600 focus:ring-blue-300"
                    />
                  </td>

                  {/* 日期 */}
                  <td className={`${cellClass} font-mono text-text-muted`}>{rec.recommend_date.slice(5)}</td>

                  {/* 代码 */}
                  <td className={`${cellClass} font-mono text-text-muted`}>{rec.stock_code}</td>

                  {/* 名称 */}
                  <td className={`${cellClass} font-semibold text-blue-800`}>{rec.stock_name}</td>

                  {/* 推荐价 */}
                  <td className={`${cellClass} font-mono text-right`}>{fmt(rec.recommend_price)}</td>

                  {/* Day1 */}
                  <td className={`${cellClass} text-right`}>
                    {hasDay(1) ? (
                      <><span className="font-mono">{fmt(dayPrice(1))}</span> <span className={`font-mono text-[10px] ${rateColor(dayRate(1))}`}>{fmtRate(dayRate(1), false)}</span></>
                    ) : <span className="text-text-muted">—</span>}
                  </td>

                  {/* Day2 */}
                  <td className={`${cellClass} text-right`}>
                    {hasDay(2) ? (
                      <><span className="font-mono">{fmt(dayPrice(2))}</span> <span className={`font-mono text-[10px] ${rateColor(dayRate(2))}`}>{fmtRate(dayRate(2), false)}</span></>
                    ) : <span className="text-text-muted">—</span>}
                  </td>

                  {/* Day3 */}
                  <td className={`${cellClass} text-right`}>
                    {hasDay(3) ? (
                      <><span className="font-mono">{fmt(dayPrice(3))}</span> <span className={`font-mono text-[10px] ${rateColor(dayRate(3))}`}>{fmtRate(dayRate(3), false)}</span></>
                    ) : <span className="text-text-muted">—</span>}
                  </td>

                  {/* 最终收益 */}
                  <td className={`${cellClass} font-mono font-bold text-right ${rateColor(rec.final_return_rate)}`}>
                    {completed ? fmtRate(rec.final_return_rate) : '—'}
                  </td>

                  {/* 最高/最低 */}
                  <td className={`${cellClass} text-[10px] text-right`}>
                    {completed ? (
                      <span className="text-text-muted">
                        <span className="text-red-500">+{fmt(rec.max_gain)}</span>
                        /<span className="text-green-600">{fmt(rec.max_drawdown)}</span>
                      </span>
                    ) : '—'}
                  </td>

                  {/* 状态 */}
                  <td className={`${cellClass} text-center`}>
                    {completed ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        rec.final_return_rate >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {fmtRate(rec.final_return_rate)}
                      </span>
                    ) : td > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold">
                        {td}/3
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold">
                        待更新
                      </span>
                    )}
                  </td>

                  {/* 操作 */}
                  <td className={`${cellClass} text-center`}>
                    <div className="flex items-center justify-center gap-1">
                      {!completed && (
                        <button onClick={() => onUpdate(rec.id)} disabled={busy}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40 transition-all">
                          {busy ? '…' : '更新'}
                        </button>
                      )}
                      <button onClick={() => onReset(rec)} disabled={busy}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-40 transition-all">
                        {busy ? '…' : '重置'}
                      </button>
                      <button onClick={() => onDelete(rec)} disabled={busy}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 transition-all">
                        {busy ? '…' : '删除'}
                      </button>
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

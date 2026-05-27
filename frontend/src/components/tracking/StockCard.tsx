import type { HistoryRec } from '../../services/api'

const DAY_LABELS = ['', '持股第一天', '持股第二天', '持股第三天']

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }

interface StockCardProps {
  rec: HistoryRec
  selected: boolean
  onSelect: (id: number, checked: boolean) => void
  onUpdate: (id: number) => void
  onReset: (rec: HistoryRec) => void
  onDelete: (rec: HistoryRec) => void
  busy: boolean
}

export default function StockCard({ rec, selected, onSelect, onUpdate, onReset, onDelete, busy }: StockCardProps) {
  const td = rec.tracking_days || 0
  const completed = rec.status === 'completed'
  const rates = [0, rec.return_rate_day1, rec.return_rate_day2, rec.return_rate_day3]

  return (
    <div className={`px-4 py-3 transition-colors ${completed ? 'bg-green-50/30' : 'hover:bg-blue-50/40'} ${selected ? 'ring-2 ring-blue-300 bg-blue-50/70' : ''}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Checkbox */}
        <label className="flex items-center cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={e => onSelect(rec.id, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border-default text-blue-600 focus:ring-blue-300"
          />
        </label>

        {/* Stock info */}
        <div className="w-20 shrink-0">
          <div className="font-bold text-blue-800 text-sm truncate">{rec.stock_name}</div>
          <div className="text-[10px] text-text-muted font-mono">{rec.stock_code}</div>
        </div>

        {/* Reason */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <div className="text-[11px] text-text-secondary truncate">{rec.reason || '—'}</div>
        </div>

        {/* Recommend price */}
        <div className="text-right shrink-0">
          <div className="text-[10px] text-text-muted">推荐价</div>
          <div className="font-mono font-semibold text-xs">{fmt(rec.recommend_price)}</div>
        </div>

        {/* Status badge + progress */}
        {completed ? (
          <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap
            ${rec.final_return_rate >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {rec.final_return_rate >= 0 ? '+' : ''}{fmt(rec.final_return_rate)}%
          </div>
        ) : (
          td > 0 ? (
            <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold whitespace-nowrap">
              <span>跟踪中</span>
              {/* Progress dots */}
              <span className="flex gap-0.5">
                {[1, 2, 3].map(d => (
                  <span key={d} className={`w-1.5 h-1.5 rounded-full ${d <= td ? 'bg-blue-500' : 'bg-blue-200'}`} />
                ))}
              </span>
            </div>
          ) : (
            <div className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold whitespace-nowrap">
              待更新
            </div>
          )
        )}
      </div>

      {/* Tracking days row */}
      <div className="flex gap-1.5 mb-1.5">
        {[1, 2, 3].map(day => {
          const hasPrice = (rec as any)[`price_day${day}`] > 0
          const dayRate = rates[day]
          const isCurrent = day === td
          return (
            <div
              key={day}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-center border transition-all ${
                isCurrent && !completed
                  ? 'border-blue-300 bg-blue-50 shadow-sm'
                  : hasPrice
                    ? dayRate >= 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'
                    : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="text-[9px] text-text-muted mb-0.5">{DAY_LABELS[day]}</div>
              <div className="font-mono font-bold text-xs">
                {hasPrice ? fmt((rec as any)[`price_day${day}`]) : '—'}
              </div>
              {hasPrice && (
                <div className={`font-mono text-[10px] font-semibold ${dayRate >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {fmtRate(dayRate)}
                </div>
              )}
              {!hasPrice && <div className="text-[9px] text-text-muted mt-0.5">待更新</div>}
            </div>
          )
        })}
      </div>

      {/* Completed footer */}
      {completed && (
        <div className="flex items-center justify-between pt-1.5 border-t border-border-default/60 mt-1">
          <div className="flex items-center gap-3">
            {rec.max_gain > 0 && (
              <span className="text-[10px] text-text-muted">
                最高 <span className="font-mono font-semibold text-red-500">+{fmt(rec.max_gain)}%</span>
              </span>
            )}
            {rec.max_drawdown < 0 && (
              <span className="text-[10px] text-text-muted">
                最低 <span className="font-mono font-semibold text-green-600">{fmt(rec.max_drawdown)}%</span>
              </span>
            )}
          </div>
          <div className="text-[10px] text-text-muted">
            {fmt(rec.recommend_price)} → {fmt(rec.price_day3)}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 mt-1.5">
        {!completed && (
          <button onClick={() => onUpdate(rec.id)} disabled={busy}
            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40 transition-all">
            {busy ? '...' : '更新'}
          </button>
        )}
        <button onClick={() => onReset(rec)} disabled={busy}
          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-40 transition-all">
          {busy ? '...' : '重置'}
        </button>
        <button onClick={() => onDelete(rec)} disabled={busy}
          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 transition-all">
          {busy ? '...' : '删除'}
        </button>
      </div>
    </div>
  )
}

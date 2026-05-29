import { useRef, useState, useEffect } from 'react'

interface ConsoleToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: string
  onStatusFilterChange: (v: 'all' | 'tracking' | 'completed') => void
  sortBy: string
  onSortByChange: (v: string) => void
  totalCount: number
  filteredCount: number
  selectedCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onBatchUpdate: () => void
  onBatchReset: () => void
  onBatchDelete: () => void
  batchBusy: boolean
  hasTrackingSelected: boolean
}

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'tracking', label: '跟踪中' },
  { value: 'completed', label: '已完结' },
]

const SORT_OPTIONS = [
  { value: 'date-desc', label: '日期 ↓' },
  { value: 'date-asc', label: '日期 ↑' },
  { value: 'name', label: '名称' },
  { value: 'return', label: '收益率' },
]

export default function ConsoleToolbar({
  search, onSearchChange, statusFilter, onStatusFilterChange,
  sortBy, onSortByChange,
  totalCount, filteredCount, selectedCount,
  onSelectAll, onClearSelection,
  onBatchUpdate, onBatchReset, onBatchDelete,
  batchBusy, hasTrackingSelected,
}: ConsoleToolbarProps) {
  const [inputVal, setInputVal] = useState(search)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setInputVal(search)
  }, [search])

  const handleInput = (v: string) => {
    setInputVal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearchChange(v), 300)
  }

  const showBatch = selectedCount > 0

  return (
    <div className="stock-card overflow-hidden mb-5">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        {/* 搜索 */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <input
            type="text"
            value={inputVal}
            onChange={e => handleInput(e.target.value)}
            placeholder="搜索名称/代码..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border border-border-default bg-white text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* 状态筛选 */}
        <select
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg text-xs border border-border-default bg-white text-text-primary focus:outline-none focus:border-blue-400 transition-all"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* 排序 */}
        <select
          value={sortBy}
          onChange={e => onSortByChange(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs border border-border-default bg-white text-text-primary focus:outline-none focus:border-blue-400 transition-all"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* 统计 */}
        <div className="text-[11px] text-text-muted ml-auto hidden sm:block">
          {filteredCount === totalCount
            ? `共 ${totalCount} 条`
            : `${filteredCount} / ${totalCount} 条`
          }
        </div>
      </div>

      {/* 批量操作栏 */}
      <div className={`transition-all duration-200 overflow-hidden ${showBatch ? 'max-h-16 border-t border-border-default' : 'max-h-0'}`}>
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50/60">
          <button onClick={onSelectAll} className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
            全选
          </button>
          <span className="text-xs text-text-muted font-mono font-semibold">{selectedCount} 条</span>
          <button onClick={onClearSelection} className="text-xs text-text-muted hover:text-red-500 transition-colors">
            清除选择
          </button>
          <div className="flex-1" />
          <button
            onClick={onBatchUpdate}
            disabled={batchBusy || !hasTrackingSelected}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-all"
          >
            批量更新
          </button>
          <button
            onClick={onBatchReset}
            disabled={batchBusy}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-all"
          >
            批量重置
          </button>
          <button
            onClick={onBatchDelete}
            disabled={batchBusy}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-all"
          >
            批量删除
          </button>
        </div>
      </div>
    </div>
  )
}

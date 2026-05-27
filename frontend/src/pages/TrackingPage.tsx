import { useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { apiGet, apiPost, apiDelete, type HistoryRec } from '../services/api'
import ConfirmModal from '../components/ConfirmModal'
import ConsoleToolbar from '../components/tracking/ConsoleToolbar'
import StockCard from '../components/tracking/StockCard'
import DetailedTable from '../components/tracking/DetailedTable'

function fmt(n: number, d = 2) { return n.toFixed(d) }

export default function TrackingPage() {
  // ── Data ──
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── Filter & Sort ──
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'tracking' | 'completed'>('all')
  const [sortBy, setSortBy] = useState('date-desc')
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple')

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Busy ──
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())
  const [batchBusy, setBatchBusy] = useState(false)

  // ── Toast ──
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const showToast = useCallback((msg: string, err?: boolean) => {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Confirm Modal ──
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; message: string | ReactNode; variant: 'danger' | 'warning'
    onConfirm: () => void
  }>({ open: false, title: '', message: '', variant: 'warning', onConfirm: () => {} })

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    try {
      const d = await apiGet<any>('/recommend/history')
      if (d.success) {
        setRecs(d.data || [])
        // 清除已被删除的选中项
        const validIds = new Set(d.data.map((r: HistoryRec) => r.id))
        setSelectedIds(prev => new Set([...prev].filter(id => validIds.has(id))))
      } else {
        setError(d.error || '')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived ──
  const filteredRecs = useMemo(() => {
    let list = [...recs]

    // status filter
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter)
    }

    // search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r => r.stock_name.includes(q) || r.stock_code.includes(q))
    }

    // sort
    switch (sortBy) {
      case 'date-asc':
        list.sort((a, b) => a.recommend_date.localeCompare(b.recommend_date) || a.id - b.id)
        break
      case 'name':
        list.sort((a, b) => a.stock_name.localeCompare(b.stock_name))
        break
      case 'return':
        list.sort((a, b) => Math.abs(b.final_return_rate) - Math.abs(a.final_return_rate))
        break
      default: // date-desc
        list.sort((a, b) => b.recommend_date.localeCompare(a.recommend_date) || a.id - b.id)
    }

    return list
  }, [recs, search, statusFilter, sortBy])

  const grouped = useMemo(() => {
    const map: Record<string, HistoryRec[]> = {}
    for (const r of filteredRecs) {
      (map[r.recommend_date] ||= []).push(r)
    }
    return map
  }, [filteredRecs])

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const stats = useMemo(() => {
    const completedRecs = recs.filter(r => r.status === 'completed')
    const rates = completedRecs.map(r => r.final_return_rate)
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
    const wins = rates.filter(r => r > 0).length
    return { total: recs.length, tracking: recs.filter(r => r.status === 'tracking').length, completed: completedRecs.length, wins, avgReturn: avg, winRate: completedRecs.length ? wins / completedRecs.length * 100 : 0 }
  }, [recs])

  const hasTrackingSelected = useMemo(
    () => [...selectedIds].some(id => recs.find(r => r.id === id)?.status === 'tracking'),
    [selectedIds, recs]
  )

  // ── Actions ──
  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filteredRecs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredRecs.map(r => r.id)))
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  const doSingleUpdate = async (id: number) => {
    setBusyIds(p => new Set(p).add(id))
    try {
      const res = await apiPost<any>(`/recommend/item/${id}/update`)
      showToast(res.success ? `更新成功: ${res.data?.filled || 0} 天` : res.error || '更新失败', !res.success)
      fetchData()
    } catch (e: any) {
      showToast(e.message, true)
    } finally {
      setBusyIds(p => { const n = new Set(p); n.delete(id); return n })
    }
  }

  const doSingleReset = (rec: HistoryRec) => {
    setConfirm({
      open: true, title: '重置收益跟踪',
      message: <>确认重置 <strong>{rec.stock_name}</strong> 的跟踪数据？已填的 day1-3 将被清空。</>,
      variant: 'warning',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, open: false }))
        setBusyIds(p => new Set(p).add(rec.id))
        try {
          await apiPost<any>(`/recommend/item/${rec.id}/reset`)
          showToast(`${rec.stock_name} 已重置`)
          fetchData()
        } catch (e: any) {
          showToast(e.message, true)
        } finally {
          setBusyIds(p => { const n = new Set(p); n.delete(rec.id); return n })
        }
      },
    })
  }

  const doSingleDelete = (rec: HistoryRec) => {
    setConfirm({
      open: true, title: '删除记录',
      message: <>确认删除 <strong>{rec.stock_name}</strong>（{rec.stock_code}）？此操作不可撤销。</>,
      variant: 'danger',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, open: false }))
        setBusyIds(p => new Set(p).add(rec.id))
        try {
          await apiDelete<any>(`/recommend/item/${rec.id}`)
          showToast(`${rec.stock_name} 已删除`)
          fetchData()
        } catch (e: any) {
          showToast(e.message, true)
        } finally {
          setBusyIds(p => { const n = new Set(p); n.delete(rec.id); return n })
        }
      },
    })
  }

  const doBatchUpdate = async () => {
    if (!hasTrackingSelected) return showToast('没有可更新的记录（仅 tracking 状态可更新）', true)
    setBatchBusy(true)
    const ids = [...selectedIds].filter(id => recs.find(r => r.id === id)?.status === 'tracking')
    let success = 0
    for (const id of ids) {
      try {
        const res = await apiPost<any>(`/recommend/item/${id}/update`)
        if (res.success) success++
      } catch { /* skip */ }
    }
    setBatchBusy(false)
    showToast(`更新完成: ${success}/${ids.length} 条`)
    fetchData()
    clearSelection()
  }

  const doBatchReset = () => {
    const names = [...selectedIds].map(id => recs.find(r => r.id === id)?.stock_name).filter(Boolean).join('、')
    setConfirm({
      open: true, title: '批量重置',
      message: <>确认重置 {selectedIds.size} 条记录的收益跟踪数据（{names}）？</>,
      variant: 'warning',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, open: false }))
        setBatchBusy(true)
        let success = 0
        for (const id of selectedIds) {
          try {
            await apiPost<any>(`/recommend/item/${id}/reset`)
            success++
          } catch { /* skip */ }
        }
        setBatchBusy(false)
        showToast(`重置完成: ${success}/${selectedIds.size} 条`)
        fetchData()
        clearSelection()
      },
    })
  }

  const doBatchDelete = () => {
    setConfirm({
      open: true, title: '批量删除',
      message: <>确认删除 {selectedIds.size} 条记录？此操作不可撤销。</>,
      variant: 'danger',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, open: false }))
        setBatchBusy(true)
        let success = 0
        for (const id of selectedIds) {
          try {
            await apiDelete<any>(`/recommend/item/${id}`)
            success++
          } catch { /* skip */ }
        }
        setBatchBusy(false)
        showToast(`删除完成: ${success}/${selectedIds.size} 条`)
        fetchData()
        clearSelection()
      },
    })
  }

  // ── Render ──

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${
          toast.err ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        variant={confirm.variant}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(prev => ({ ...prev, open: false }))}
      />

      {/* Hero */}
      <div className="text-center mb-6 fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">
          收益跟踪<span className="text-amber-500"> 控制台</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary">管理推荐股票的持仓跟踪数据</p>
      </div>

      {/* Stats row */}
      <div className="stock-card p-3 mb-5">
        <div className="flex items-center justify-around text-center">
          <StatBox label="总计" value={stats.total} color="text-blue-700" />
          <Divider />
          <StatBox label="跟踪中" value={stats.tracking} color="text-blue-600" />
          <Divider />
          <StatBox label="已完结" value={stats.completed} color="text-green-600" />
          <Divider />
          <StatBox label="盈利" value={stats.wins} color="text-red-500" />
          <Divider />
          <StatBox
            label="平均收益"
            value={`${stats.avgReturn >= 0 ? '+' : ''}${fmt(stats.avgReturn)}%`}
            color={stats.avgReturn >= 0 ? 'text-red-500' : 'text-green-600'}
          />
          <Divider />
          <StatBox label="胜率" value={`${fmt(stats.winRate)}%`} color="text-amber-500" />
        </div>
      </div>

      {/* Toolbar */}
      <ConsoleToolbar
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        sortBy={sortBy} onSortByChange={setSortBy}
        totalCount={recs.length} filteredCount={filteredRecs.length}
        selectedCount={selectedIds.size}
        onSelectAll={selectAll} onClearSelection={clearSelection}
        onBatchUpdate={doBatchUpdate} onBatchReset={doBatchReset} onBatchDelete={doBatchDelete}
        batchBusy={batchBusy} hasTrackingSelected={hasTrackingSelected}
      />

      {/* Mode toggle */}
      <div className="flex items-center justify-end gap-1 mb-3">
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('simple')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'simple' ? 'bg-white text-blue-700 shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            卡片模式
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'detailed' ? 'bg-white text-blue-700 shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            表格模式
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl"/>)}</div>}

      {/* Error */}
      {error && !loading && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {/* Filtered empty */}
      {!loading && !error && filteredRecs.length === 0 && recs.length > 0 && (
        <div className="stock-card py-10 text-center">
          <div className="text-4xl mb-2 opacity-60">🔍</div>
          <div className="text-sm text-text-muted">没有匹配的记录</div>
          <button onClick={() => { setSearch(''); setStatusFilter('all') }}
            className="mt-2 text-xs text-blue-600 hover:underline">
            清除筛选
          </button>
        </div>
      )}

      {/* Global empty */}
      {!loading && recs.length === 0 && !error && (
        <div className="text-center py-14 fade-in-up">
          <div className="text-5xl mb-3 opacity-60">📈</div>
          <div className="text-sm text-text-muted">暂无历史推荐数据</div>
          <div className="text-xs text-text-muted mt-1">生成推荐后自动显示</div>
        </div>
      )}

      {/* Content: Card Mode */}
      {!loading && filteredRecs.length > 0 && viewMode === 'simple' && (
        <div className="space-y-4">
          {dates.map(date => (
            <div key={date} className="stock-card overflow-hidden">
              {/* Date header */}
              <div className="px-4 py-2 bg-blue-50/80 border-b border-border-default flex items-center justify-between">
                <span className="text-sm font-bold text-blue-700 font-mono">{date}</span>
                <div className="flex items-center gap-3">
                  {(() => {
                    const dayRecs = grouped[date]
                    const dayRates = dayRecs.filter(r => r.status === 'completed').map(r => r.final_return_rate)
                    const dayAvg = dayRates.length ? dayRates.reduce((a, b) => a + b, 0) / dayRates.length : 0
                    return (
                      <>
                        <span className="text-xs text-text-muted">{dayRecs.length} 只</span>
                        {dayRates.length > 0 && (
                          <span className={`text-xs font-bold font-mono ${dayAvg >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {dayAvg >= 0 ? '+' : ''}{fmt(dayAvg)}%
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
              {/* Cards */}
              <div className="divide-y divide-border-default/60">
                {grouped[date].map(rec => (
                  <StockCard
                    key={rec.id}
                    rec={rec}
                    selected={selectedIds.has(rec.id)}
                    onSelect={toggleSelect}
                    onUpdate={doSingleUpdate}
                    onReset={doSingleReset}
                    onDelete={doSingleDelete}
                    busy={busyIds.has(rec.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content: Table Mode */}
      {!loading && filteredRecs.length > 0 && viewMode === 'detailed' && (
        <DetailedTable
          recs={filteredRecs}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          onSelectAll={selectAll}
          onUpdate={doSingleUpdate}
          onReset={doSingleReset}
          onDelete={doSingleDelete}
          busyIds={busyIds}
          sortBy={sortBy}
          onSortByChange={setSortBy}
        />
      )}
    </div>
  )
}

// ── Stat Box helper ──

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg sm:text-xl font-extrabold ${color}`}>{value}</div>
      <div className="text-[10px] text-text-muted">{label}</div>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-8 bg-border-default" />
}

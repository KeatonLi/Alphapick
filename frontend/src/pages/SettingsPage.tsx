import { useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { apiGet, apiPost, apiDelete, type HistoryRec } from '../services/api'
import ConsoleToolbar from '../components/tracking/ConsoleToolbar'
import DetailedTable from '../components/tracking/DetailedTable'
import ConfirmModal from '../components/ConfirmModal'

type StatusT = 'idle' | 'pending' | 'running' | 'completed' | 'failed'
type MsgT = { type: 'success' | 'error' | 'warn'; text: string }

function fmt(n: number, d = 2) { return n.toFixed(d) }

// ──────────────── Tabs ────────────────

const TABS = [
  { key: 'settings', label: '设置', icon: '⚙️' },
  { key: 'console', label: '控制台', icon: '⚡' },
] as const

// ──────────────── 设置 Tab ────────────────

function SettingsTab() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  const [r, setR] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, msg: null as MsgT | null })
  const [c, setC] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, candidates: [] as any[], msg: null as MsgT | null })
  const [a, setA] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, msg: null as MsgT | null })
  const [posterLoading, setPosterLoading] = useState(false)
  const [posterMsg, setPosterMsg] = useState<MsgT | null>(null)

  const [sched, setSched] = useState<any>(null)
  const [sEn, setSEn] = useState(false)
  const [sTime, setSTime] = useState('16:00')
  const [sRpt, setSRpt] = useState(true)
  const [sRec, setSRec] = useState(true)
  const [sSaving, setSSaving] = useState(false)
  const [sMsg, setSMsg] = useState('')

  useEffect(() => {
    apiGet<any>('/schedule/config').then(d => {
      if (d.success) { setSched(d.data); setSEn(d.data.enabled); setSTime(d.data.run_time || '16:00'); setSRpt(d.data.run_report); setSRec(d.data.run_recommend) }
    }).catch(() => {})
  }, [])

  const busy = (s: StatusT) => s === 'pending' || s === 'running'

  const poll = (taskId: number, t: 'r' | 'c' | 'a') => {
    const iv = setInterval(async () => {
      try {
        const res = await apiGet<any>(`/generate/task/${taskId}`)
        if (!res.success) { clearInterval(iv); return }
        const d = res.data
        if (t === 'r') {
          setR(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status }))
          if (d.status === 'completed') { clearInterval(iv); setR(p => ({ ...p, msg: { type: 'success' as const, text: `✅ 报告完成（${d.target_date}）` } })) }
          else if (d.status === 'failed') { clearInterval(iv); setR(p => ({ ...p, msg: { type: 'error' as const, text: d.error_message || '失败' } })) }
        }
        if (t === 'c') {
          setC(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status, candidates: d.candidate_stocks?.length > 0 ? d.candidate_stocks : p.candidates }))
          if (d.status === 'completed') {
            clearInterval(iv)
            const cnt = d.result?.count
            if (cnt === 0 || cnt === undefined) setC(p => ({ ...p, msg: { type: 'warn' as const, text: `⚠️ ${d.target_date} 无候选主板股票` } }))
            else setC(p => ({ ...p, msg: { type: 'success' as const, text: `✅ ${d.target_date} 推荐完成，共 ${cnt} 只` } }))
          } else if (d.status === 'failed') { clearInterval(iv); setC(p => ({ ...p, msg: { type: 'error' as const, text: d.error_message || '失败' } })) }
        }
        if (t === 'a') {
          setA(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status }))
          if (d.candidate_stocks?.length > 0) setC(p => ({ ...p, candidates: d.candidate_stocks }) as any)
          if (d.status === 'completed') { clearInterval(iv); setA(p => ({ ...p, msg: { type: 'success' as const, text: '✅ 全部完成' } })) }
          else if (d.status === 'failed') { clearInterval(iv); setA(p => ({ ...p, msg: { type: 'error' as const, text: d.error_message || '失败' } })) }
        }
      } catch { /* */ }
    }, 1000)
  }

  const start = async (ep: string, t: 'r' | 'c' | 'a') => {
    const set = t === 'r' ? setR : t === 'c' ? setC : setA
    ;(set as any)((p: any) => ({ ...p, status: 'pending', msg: null }))
    try {
      const res = await apiPost(`${ep}?date=${date}`)
      if (res.success && res.data?.task_id) {
        ;(set as any)((p: any) => ({ ...p, status: 'running' }))
        poll(res.data.task_id, t)
      } else if (res.data?.message) {
        ;(set as any)((p: any) => ({ ...p, status: 'completed', msg: { type: 'success', text: res.data.message } }))
      }
    } catch (e: any) {
      ;(set as any)((p: any) => ({ ...p, status: 'failed', msg: { type: 'error', text: `启动失败: ${e.message}` } }))
    }
  }

  const API_BASE = import.meta.env.VITE_API_URL || '/api'
  const genPoster = async () => {
    setPosterLoading(true); setPosterMsg(null)
    try {
      const resp = await fetch(`${API_BASE}/report/poster?date=${date}`)
      if (!resp.ok) { const err = await resp.json().catch(() => ({ detail: '海报生成失败' })); setPosterMsg({ type: 'error', text: err.detail || '海报生成失败' }); return }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `QuantForge_市场日报_${date}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      setPosterMsg({ type: 'success', text: `✅ 海报已生成并下载（${date}）` })
    } catch (e: any) { setPosterMsg({ type: 'error', text: `生成失败: ${e.message}` }) }
    finally { setPosterLoading(false) }
  }

  const saveSched = async () => {
    setSSaving(true); setSMsg('')
    try { const r = await apiPost(`/schedule/config?enabled=${sEn}&run_time=${sTime}&run_report=${sRpt}&run_recommend=${sRec}`); setSMsg(r.success ? '✅ 已保存' : '❌ 失败') }
    catch { setSMsg('❌ 失败') }
    finally { setSSaving(false); setTimeout(() => setSMsg(''), 3000) }
  }

  const btnDisabled = busy(r.status) || busy(c.status) || busy(a.status)

  return (
    <div className="space-y-5">
      {/* 目标日期 */}
      <Section icon="📅" title="目标日期">
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} disabled={btnDisabled}
          className="w-full bg-white border border-border-default text-text-primary text-center px-3 py-2 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50" />
      </Section>

      {/* 数据生成 */}
      <Section icon="⚡" title="数据生成">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="stock-card p-4 space-y-3 sm:col-span-2 border-l-4 border-l-indigo-400">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-indigo-700">一键生成全部</div>
                <div className="text-[11px] text-text-muted">市场报告 → 量化推荐 → 更新现价</div>
              </div>
              <StatusBadge s={a.status} />
            </div>
            {busy(a.status) && <PBar pct={a.pct} label={a.label} cur={a.step} tot={a.total} />}
            <button onClick={() => start('/generate/all', 'a')} disabled={busy(a.status)}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200 disabled:cursor-not-allowed">
              {busy(a.status) ? (a.label || '执行中...') : '🚀 一键全部'}
            </button>
            {a.msg && <Msg msg={a.msg} />}
          </div>

          <div className="stock-card p-4 space-y-3 border-l-4 border-l-blue-400">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-blue-700">市场报告</div>
                <div className="text-[11px] text-text-muted">指数行情 + 板块热点 + AI 分析</div>
              </div>
              <StatusBadge s={r.status} />
            </div>
            {busy(r.status) && <PBar pct={r.pct} label={r.label} cur={r.step} tot={r.total} />}
            <button onClick={() => start('/generate/report', 'r')} disabled={busy(r.status)}
              className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-md shadow-blue-200 disabled:cursor-not-allowed">
              {busy(r.status) ? (r.label || '生成中...') : '📊 生成报告'}
            </button>
            {r.msg && <Msg msg={r.msg} />}
          </div>

          <div className="stock-card p-4 space-y-3 border-l-4 border-l-amber-400">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-amber-600">量化推荐</div>
                <div className="text-[11px] text-text-muted">THS 热股 × 热度排名 × 消息面 → AI 精选</div>
              </div>
              <StatusBadge s={c.status} />
            </div>
            {busy(c.status) && <PBar pct={c.pct} label={c.label} cur={c.step} tot={c.total} />}
            <button onClick={() => start('/generate/recommend', 'c')} disabled={busy(c.status)}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-md shadow-amber-200 disabled:cursor-not-allowed">
              {busy(c.status) ? (c.label || '生成中...') : '🎯 生成推荐'}
            </button>
            {c.msg && <Msg msg={c.msg} />}
          </div>
        </div>

        {/* 生成海报 */}
        <div className="stock-card p-4 space-y-3 mt-3 border-l-4 border-l-purple-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-purple-600">生成海报</div>
              <div className="text-[11px] text-text-muted">基于当日报告生成公众号推文海报，自动下载 PNG</div>
            </div>
          </div>
          <button onClick={genPoster} disabled={posterLoading}
            className="w-full py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 transition-all shadow-md shadow-purple-200 disabled:cursor-not-allowed">
            {posterLoading ? '生成中...' : '🖼️ 生成海报'}
          </button>
          {posterMsg && <Msg msg={posterMsg} />}
        </div>
      </Section>

      {/* 定时任务 */}
      <Section icon="⏰" title="定时任务">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-text-secondary font-medium">每日自动生成</div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={sEn} onChange={e => setSEn(e.target.checked)} className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-text-muted block mb-1.5 font-medium">执行时间</label>
            <input type="time" value={sTime} onChange={e => setSTime(e.target.value)}
              className="w-full bg-white border border-border-default text-text-primary text-center px-2 py-1.5 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div className="flex items-end gap-4">
            <div>
              <label className="text-xs text-text-muted block mb-1.5 font-medium">自动报告</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={sRpt} onChange={e => setSRpt(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1.5 font-medium">自动推荐</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={sRec} onChange={e => setSRec(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>
          </div>
          <div className="flex items-end justify-end">
            <button onClick={saveSched} disabled={sSaving}
              className="py-2 px-5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all">
              {sSaving ? '保存中...' : '保存配置'}
            </button>
            {sMsg && <span className="text-xs ml-2 font-medium text-green-600">{sMsg}</span>}
          </div>
        </div>

        {sched && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
            <div>
              <div className="text-text-muted mb-0.5 font-medium">上次执行</div>
              <div className="font-medium text-text-primary">{sched.last_run_at ? `${sched.last_run_at}（${sched.last_run_info || '未知'}）` : '从未执行'}</div>
              {sched.last_run_result && <div className="text-text-muted mt-0.5 text-[11px]">{sched.last_run_result}</div>}
            </div>
            <div>
              <div className="text-text-muted mb-0.5 font-medium">下次执行</div>
              <div className="font-medium text-text-primary">{sEn ? `每天 ${sTime}` : '已禁用'}</div>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

// ──────────────── 控制台 Tab ────────────────

function ConsoleTab() {
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'tracking' | 'completed'>('all')
  const [sortBy, setSortBy] = useState('date-desc')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; message: string | ReactNode; variant: 'danger' | 'warning'; onConfirm: () => void
  }>({ open: false, title: '', message: '', variant: 'warning', onConfirm: () => {} })

  const showToast = useCallback((msg: string, err?: boolean) => {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const d = await apiGet<any>('/recommend/history')
      if (d.success) { setRecs(d.data || []); setSelectedIds(prev => new Set([...prev].filter(id => new Set(d.data.map((r: HistoryRec) => r.id)).has(id)))) }
      else setError(d.error || '')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredRecs = useMemo(() => {
    let list = [...recs]
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (search) { const q = search.toLowerCase(); list = list.filter(r => r.stock_name.includes(q) || r.stock_code.includes(q)) }
    switch (sortBy) {
      case 'date-asc': list.sort((a, b) => a.recommend_date.localeCompare(b.recommend_date) || a.id - b.id); break
      case 'name': list.sort((a, b) => a.stock_name.localeCompare(b.stock_name)); break
      case 'return': list.sort((a, b) => Math.abs(b.final_return_rate) - Math.abs(a.final_return_rate)); break
      default: list.sort((a, b) => b.recommend_date.localeCompare(a.recommend_date) || a.id - b.id)
    }
    return list
  }, [recs, search, statusFilter, sortBy])

  const stats = useMemo(() => {
    const cr = recs.filter(r => r.status === 'completed')
    const rates = cr.map(r => r.final_return_rate)
    return { total: recs.length, tracking: recs.filter(r => r.status === 'tracking').length, completed: cr.length, wins: rates.filter(r => r > 0).length, avgReturn: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0, winRate: cr.length ? rates.filter(r => r > 0).length / cr.length * 100 : 0 }
  }, [recs])

  const hasTrackingSelected = useMemo(() => [...selectedIds].some(id => recs.find(r => r.id === id)?.status === 'tracking'), [selectedIds, recs])

  const toggleSelect = (id: number, checked: boolean) => setSelectedIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  const selectAll = () => { if (selectedIds.size === filteredRecs.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredRecs.map(r => r.id))) }
  const clearSelection = () => setSelectedIds(new Set())

  const batchOp = async (action: string, ids: number[], successMsg: string) => {
    setBatchBusy(true)
    let s = 0
    for (const id of ids) {
      try {
        const r = action === 'delete' ? await apiDelete<any>(`/recommend/item/${id}`) : await apiPost<any>(`/recommend/item/${id}/${action}`)
        if (r.success) s++
      } catch { /* skip */ }
    }
    setBatchBusy(false)
    showToast(`${successMsg}: ${s}/${ids.length} 条`)
    fetchData()
    clearSelection()
  }

  const doBatchUpdate = async () => {
    if (!hasTrackingSelected) return showToast('没有可更新的记录', true)
    const ids = [...selectedIds].filter(id => recs.find(r => r.id === id)?.status === 'tracking')
    setBatchBusy(true); let s = 0
    for (const id of ids) { try { const r = await apiPost<any>(`/recommend/item/${id}/update`); if (r.success) s++ } catch { /* */ } }
    setBatchBusy(false); showToast(`更新完成: ${s}/${ids.length} 条`); fetchData(); clearSelection()
  }

  const doSingleUpdate = async (id: number) => {
    setBusyIds(p => new Set(p).add(id))
    try { const r = await apiPost<any>(`/recommend/item/${id}/update`); showToast(r.success ? `更新成功: ${r.data?.filled || 0} 天` : r.error || '更新失败', !r.success); fetchData() }
    catch (e: any) { showToast(e.message, true) }
    finally { setBusyIds(p => { const n = new Set(p); n.delete(id); return n }) }
  }

  const confirmThen = (title: string, message: string | ReactNode, variant: 'danger' | 'warning', fn: () => Promise<void>) => {
    setConfirm({ open: true, title, message, variant, onConfirm: async () => { setConfirm(prev => ({ ...prev, open: false })); await fn() } })
  }

  return (
    <div>
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg ${toast.err ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`}>{toast.msg}</div>}
      <ConfirmModal open={confirm.open} title={confirm.title} message={confirm.message} variant={confirm.variant} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(prev => ({ ...prev, open: false }))} />

      {/* 更新现价 */}
      <Section icon="💰" title="价格更新">
        <div className="flex items-center gap-4">
          <div className="text-xs text-text-secondary flex-1">批量回溯所有 tracking 状态的推荐股票 T+1/2/3 交易日收盘价</div>
          <button onClick={async () => {
            const res = await apiPost<any>('/recommend/update-prices')
            showToast(`更新完成: ${res.data?.updated || 0} 条`)
            fetchData()
          }} className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-md shadow-green-200 shrink-0">
            💰 更新现价
          </button>
        </div>
      </Section>

      {/* 统计 */}
      {!loading && (
        <div className="stock-card p-3 mb-5">
          <div className="flex items-center justify-around text-center">
            <StatBox label="总计" value={stats.total} color="text-blue-700" />
            <SDivider />
            <StatBox label="跟踪中" value={stats.tracking} color="text-blue-600" />
            <SDivider />
            <StatBox label="已完结" value={stats.completed} color="text-green-600" />
            <SDivider />
            <StatBox label="盈利" value={stats.wins} color="text-red-500" />
            <SDivider />
            <StatBox label="平均收益" value={`${stats.avgReturn >= 0 ? '+' : ''}${fmt(stats.avgReturn)}%`} color={stats.avgReturn >= 0 ? 'text-red-500' : 'text-green-600'} />
            <SDivider />
            <StatBox label="胜率" value={`${fmt(stats.winRate)}%`} color="text-amber-500" />
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <ConsoleToolbar
        search={search} onSearchChange={setSearch}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        sortBy={sortBy} onSortByChange={setSortBy}
        totalCount={recs.length} filteredCount={filteredRecs.length}
        selectedCount={selectedIds.size}
        onSelectAll={selectAll} onClearSelection={clearSelection}
        onBatchUpdate={doBatchUpdate}
        onBatchReset={() => confirmThen('批量重置', `确认重置 ${selectedIds.size} 条记录？`, 'warning', async () => { await batchOp('reset', [...selectedIds], '重置完成') })}
        onBatchDelete={() => confirmThen('批量删除', `确认删除 ${selectedIds.size} 条记录？`, 'danger', async () => { await batchOp('delete', [...selectedIds], '删除完成') })}
        batchBusy={batchBusy} hasTrackingSelected={hasTrackingSelected}
      />

      {/* 表格 */}
      {loading && <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl"/>)}</div>}
      {error && !loading && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      {!loading && filteredRecs.length > 0 && (
        <DetailedTable
          recs={filteredRecs}
          selectedIds={selectedIds}
          onSelect={toggleSelect} onSelectAll={selectAll}
          onUpdate={doSingleUpdate}
          onReset={(rec) => confirmThen('重置收益跟踪', <>确认重置 <strong>{rec.stock_name}</strong> 的跟踪数据？</>, 'warning', async () => { setBusyIds(p => new Set(p).add(rec.id)); await apiPost<any>(`/recommend/item/${rec.id}/reset`); showToast(`${rec.stock_name} 已重置`); fetchData(); setBusyIds(p => { const n = new Set(p); n.delete(rec.id); return n }) })}
          onDelete={(rec) => confirmThen('删除记录', <>确认删除 <strong>{rec.stock_name}</strong>（{rec.stock_code}）？</>, 'danger', async () => { setBusyIds(p => new Set(p).add(rec.id)); await apiDelete<any>(`/recommend/item/${rec.id}`); showToast(`${rec.stock_name} 已删除`); fetchData(); setBusyIds(p => { const n = new Set(p); n.delete(rec.id); return n }) })}
          busyIds={busyIds}
          sortBy={sortBy}
          onSortByChange={setSortBy}
        />
      )}

      {!loading && filteredRecs.length === 0 && (
        <div className="stock-card py-10 text-center">
          <div className="text-4xl mb-2 opacity-60">{recs.length === 0 ? '📈' : '🔍'}</div>
          <div className="text-sm text-text-muted">{recs.length === 0 ? '暂无历史推荐数据' : '没有匹配的记录'}</div>
          {recs.length > 0 && <button onClick={() => { setSearch(''); setStatusFilter('all') }} className="mt-2 text-xs text-blue-600 hover:underline">清除筛选</button>}
        </div>
      )}
    </div>
  )
}

// ──────────────── 页面主体 ────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<'settings' | 'console'>('settings')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in-up">
      {/* Hero */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">
          {tab === 'settings' ? '设置' : '控制台'}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary">
          {tab === 'settings' ? '数据生成 · 定时任务 · 系统配置' : '收益跟踪数据管理 · 增删改查'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === 'settings' ? <SettingsTab /> : <ConsoleTab />}
    </div>
  )
}

// ──────────────── 子组件 ────────────────

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="stock-card p-4 sm:p-5 mb-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border-default">
        <span className="text-base">{icon}</span>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Msg({ msg }: { msg: MsgT }) {
  const map = { success: 'bg-green-50 border border-green-200 text-green-700', error: 'bg-red-50 border border-red-200 text-red-600', warn: 'bg-amber-50 border border-amber-200 text-amber-700' }
  return <div className={`rounded-xl px-3 py-2 text-xs font-medium ${map[msg.type]}`}>{msg.text}</div>
}

function StatusBadge({ s }: { s: StatusT }) {
  const map: Record<StatusT, { cls: string; label: string }> = {
    idle: { cls: 'bg-gray-100 text-gray-500', label: '就绪' },
    pending: { cls: 'bg-blue-100 text-blue-700 animate-pulse', label: '启动中' },
    running: { cls: 'bg-blue-100 text-blue-700 animate-pulse', label: '执行中' },
    completed: { cls: 'bg-green-100 text-green-700', label: '已完成' },
    failed: { cls: 'bg-red-100 text-red-600', label: '失败' },
  }
  const { cls, label } = map[s]
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>
}

function PBar({ pct, label, cur, tot }: { pct: number; label: string; cur: number; tot: number }) {
  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-blue-600 truncate font-medium">{label}</div>}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      {tot > 0 && <div className="flex justify-between text-[11px] text-text-muted"><span>步骤 {cur}/{tot}</span><span>{pct}%</span></div>}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return <div className="text-center"><div className={`text-lg sm:text-xl font-extrabold ${color}`}>{value}</div><div className="text-[10px] text-text-muted">{label}</div></div>
}

function SDivider() { return <div className="w-px h-8 bg-border-default" /> }

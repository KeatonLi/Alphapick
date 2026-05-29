import { useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { apiGet, apiPost, apiDelete, type HistoryRec } from '../services/api'
import ConsoleToolbar from '../components/tracking/ConsoleToolbar'
import DetailedTable from '../components/tracking/DetailedTable'
import ConfirmModal from '../components/ConfirmModal'

type StatusT = 'idle' | 'pending' | 'running' | 'completed' | 'failed'
type MsgT = { type: 'success' | 'error' | 'warn'; text: string }

function fmt(n: number, d = 2) { return n.toFixed(d) }

const TABS = [
  { key: 'settings', label: '设置', icon: '⚙️' },
  { key: 'console', label: '控制台', icon: '⚡' },
] as const

const btnBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
  padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600,
  border: '1px solid var(--border-default)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', cursor: 'pointer', transition: 'all .2s',
}

function primaryBtn(disabled = false): React.CSSProperties {
  return {
    ...btnBase,
    borderColor: 'var(--border-accent)',
    background: 'var(--accent-bg)',
    color: 'var(--accent-light)',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? 'var(--accent)' : 'var(--bg-badge)',
        position: 'relative', cursor: 'pointer', transition: 'background .2s',
      }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        transition: 'left .2s',
      }} />
    </div>
  )
}

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

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', textAlign: 'center', padding: '8px 12px', borderRadius: 12,
    fontFamily: "'JetBrains Mono', monospace", fontSize: 14, outline: 'none',
  }

  return (
    <div className="space-y-5">
      <Section icon="📅" title="目标日期">
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} disabled={btnDisabled}
          style={{ ...inputStyle, opacity: btnDisabled ? 0.5 : 1 }} />
      </Section>

      <Section icon="⚡" title="数据生成">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card p-4 space-y-3 sm:col-span-2" style={{ borderLeft: '4px solid var(--accent)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--accent-light)' }}>一键生成全部</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>市场报告 → 量化推荐 → 更新现价</div>
              </div>
              <StatusBadge s={a.status} />
            </div>
            {busy(a.status) && <PBar pct={a.pct} label={a.label} cur={a.step} tot={a.total} />}
            <button onClick={() => start('/generate/all', 'a')} disabled={busy(a.status)} style={primaryBtn(busy(a.status))}>
              {busy(a.status) ? (a.label || '执行中...') : '🚀 一键全部'}
            </button>
            {a.msg && <Msg msg={a.msg} />}
          </div>

          <div className="card p-4 space-y-3" style={{ borderLeft: '4px solid var(--blue)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--blue)' }}>市场报告</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>指数行情 + 板块热点 + AI 分析</div>
              </div>
              <StatusBadge s={r.status} />
            </div>
            {busy(r.status) && <PBar pct={r.pct} label={r.label} cur={r.step} tot={r.total} />}
            <button onClick={() => start('/generate/report', 'r')} disabled={busy(r.status)} style={primaryBtn(busy(r.status))}>
              {busy(r.status) ? (r.label || '生成中...') : '📊 生成报告'}
            </button>
            {r.msg && <Msg msg={r.msg} />}
          </div>

          <div className="card p-4 space-y-3" style={{ borderLeft: '4px solid var(--up)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--up)' }}>量化推荐</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>THS 热股 × 热度排名 × 消息面 → AI 精选</div>
              </div>
              <StatusBadge s={c.status} />
            </div>
            {busy(c.status) && <PBar pct={c.pct} label={c.label} cur={c.step} tot={c.total} />}
            <button onClick={() => start('/generate/recommend', 'c')} disabled={busy(c.status)} style={primaryBtn(busy(c.status))}>
              {busy(c.status) ? (c.label || '生成中...') : '🎯 生成推荐'}
            </button>
            {c.msg && <Msg msg={c.msg} />}
          </div>
        </div>

        <div className="card p-4 space-y-3 mt-3" style={{ borderLeft: '4px solid var(--accent-light)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--accent-light)' }}>生成海报</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>基于当日报告生成公众号推文海报，自动下载 PNG</div>
            </div>
          </div>
          <button onClick={genPoster} disabled={posterLoading} style={primaryBtn(posterLoading)}>
            {posterLoading ? '生成中...' : '🖼️ 生成海报'}
          </button>
          {posterMsg && <Msg msg={posterMsg} />}
        </div>
      </Section>

      <Section icon="⏰" title="定时任务">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>每日自动生成</div>
          <Toggle checked={sEn} onChange={setSEn} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>执行时间</div>
            <input type="time" value={sTime} onChange={e => setSTime(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', textAlign: 'center', padding: '6px 8px', borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 14, outline: 'none',
              }} />
          </div>
          <div className="flex items-end gap-4">
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>自动报告</div>
              <Toggle checked={sRpt} onChange={setSRpt} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>自动推荐</div>
              <Toggle checked={sRec} onChange={setSRec} />
            </div>
          </div>
          <div className="flex items-end justify-end">
            <button onClick={saveSched} disabled={sSaving}
              style={{
                padding: '8px 20px', background: 'var(--accent)', color: '#fff',
                borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
                cursor: sSaving ? 'not-allowed' : 'pointer', opacity: sSaving ? 0.5 : 1,
                transition: 'all .2s',
              }}>
              {sSaving ? '保存中...' : '保存配置'}
            </button>
            {sMsg && <span style={{ fontSize: 12, marginLeft: 8, fontWeight: 500, color: 'var(--down)' }}>{sMsg}</span>}
          </div>
        </div>

        {sched && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-tag)', fontSize: 12 }}>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>上次执行</div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{sched.last_run_at ? `${sched.last_run_at}（${sched.last_run_info || '未知'}）` : '从未执行'}</div>
              {sched.last_run_result && <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 11 }}>{sched.last_run_result}</div>}
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>下次执行</div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{sEn ? `每天 ${sTime}` : '已禁用'}</div>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

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
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: toast.err ? 'var(--up)' : 'var(--bg-card)',
            color: toast.err ? '#fff' : 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--card-shadow)',
          }}>
          {toast.msg}
        </div>
      )}
      <ConfirmModal open={confirm.open} title={confirm.title} message={confirm.message} variant={confirm.variant} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(prev => ({ ...prev, open: false }))} />

      <Section icon="💰" title="价格更新">
        <div className="flex items-center gap-4">
          <div className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>批量回溯所有 tracking 状态的推荐股票 T+1/2/3 交易日收盘价</div>
          <button onClick={async () => {
            const res = await apiPost<any>('/recommend/update-prices')
            showToast(`更新完成: ${res.data?.updated || 0} 条`)
            fetchData()
          }} style={{
            padding: '8px 20px', background: 'var(--down)', color: '#fff',
            borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none',
            cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap',
          }}>
            💰 更新现价
          </button>
        </div>
      </Section>

      {!loading && (
        <div className="card p-3 mb-5">
          <div className="flex items-center justify-around text-center">
            <StatBox label="总计" value={stats.total} color="var(--text-primary)" />
            <SDivider />
            <StatBox label="跟踪中" value={stats.tracking} color="var(--accent-light)" />
            <SDivider />
            <StatBox label="已完结" value={stats.completed} color="var(--down)" />
            <SDivider />
            <StatBox label="盈利" value={stats.wins} color="var(--up)" />
            <SDivider />
            <StatBox label="平均收益" value={`${stats.avgReturn >= 0 ? '+' : ''}${fmt(stats.avgReturn)}%`} color={stats.avgReturn >= 0 ? 'var(--up)' : 'var(--down)'} />
            <SDivider />
            <StatBox label="胜率" value={`${fmt(stats.winRate)}%`} color="var(--text-muted)" />
          </div>
        </div>
      )}

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

      {loading && <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl"/>)}</div>}
      {error && !loading && (
        <div className="mb-4 p-3 rounded-xl text-sm"
          style={{ background: 'var(--up-bg)', border: '1px solid var(--up)', color: 'var(--up)' }}>{error}</div>
      )}

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
        <div className="card py-10 text-center">
          <div className="text-4xl mb-2" style={{ opacity: 0.6 }}>{recs.length === 0 ? '📈' : '🔍'}</div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{recs.length === 0 ? '暂无历史推荐数据' : '没有匹配的记录'}</div>
          {recs.length > 0 && <button onClick={() => { setSearch(''); setStatusFilter('all') }} style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>清除筛选</button>}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'settings' | 'console'>('settings')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1 tracking-tight" style={{ color: 'var(--accent)' }}>
          {tab === 'settings' ? '设置' : '控制台'}
        </h1>
        <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
          {tab === 'settings' ? '数据生成 · 定时任务 · 系统配置' : '收益跟踪数据管理 · 增删改查'}
        </p>
      </div>

      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex p-1 gap-1" style={{ background: 'var(--bg-tag)', borderRadius: 12 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
                borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
                background: tab === t.key ? 'var(--bg-card)' : 'transparent',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all .2s',
              }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'settings' ? <SettingsTab /> : <ConsoleTab />}
    </div>
  )
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5 mb-5 space-y-4">
      <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <span className="text-base">{icon}</span>
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Msg({ msg }: { msg: MsgT }) {
  const styles: Record<string, React.CSSProperties> = {
    success: { background: 'var(--down-bg)', border: '1px solid var(--down)', color: 'var(--down)' },
    error: { background: 'var(--up-bg)', border: '1px solid var(--up)', color: 'var(--up)' },
    warn: { background: 'var(--accent-bg)', border: '1px solid var(--border-accent)', color: 'var(--accent-light)' },
  }
  return <div style={{ borderRadius: 12, padding: '8px 12px', fontSize: 12, fontWeight: 500, ...styles[msg.type] }}>{msg.text}</div>
}

function StatusBadge({ s }: { s: StatusT }) {
  const map: Record<StatusT, { style: React.CSSProperties; label: string }> = {
    idle: { style: { background: 'var(--bg-tag)', color: 'var(--text-muted)' }, label: '就绪' },
    pending: { style: { background: 'var(--accent-bg)', color: 'var(--accent-light)' }, label: '启动中' },
    running: { style: { background: 'var(--accent-bg)', color: 'var(--accent-light)' }, label: '执行中' },
    completed: { style: { background: 'var(--down-bg)', color: 'var(--down)' }, label: '已完成' },
    failed: { style: { background: 'var(--up-bg)', color: 'var(--up)' }, label: '失败' },
  }
  const { style, label } = map[s]
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, ...style }}>{label}</span>
}

function PBar({ pct, label, cur, tot }: { pct: number; label: string; cur: number; tot: number }) {
  return (
    <div className="space-y-1">
      {label && <div style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 500 }} className="truncate">{label}</div>}
      <div style={{ width: '100%', background: 'var(--bg-tag)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: 'var(--accent)', width: `${Math.max(pct, 2)}%`, transition: 'all .5s ease-out' }} />
      </div>
      {tot > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}><span>步骤 {cur}/{tot}</span><span>{pct}%</span></div>}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-lg sm:text-xl font-extrabold" style={{ color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function SDivider() { return <div className="w-px h-8" style={{ background: 'var(--border-default)' }} /> }

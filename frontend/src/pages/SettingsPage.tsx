import { useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { apiGet, apiPost, apiDelete, type HistoryRec, datasourceApi, generateApi, type DatasourceStatusItem, type FetchLogEntry } from '../services/api'
import ConsoleToolbar from '../components/tracking/ConsoleToolbar'
import DetailedTable from '../components/tracking/DetailedTable'
import ConfirmModal from '../components/ConfirmModal'

type StatusT = 'idle' | 'pending' | 'running' | 'completed' | 'failed'
type MsgT = { type: 'success' | 'error' | 'warn'; text: string }

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtSize(b: number | null) { if (!b) return '-'; return b >= 1e6 ? `${(b/1e6).toFixed(2)}MB` : b >= 1e3 ? `${(b/1e3).toFixed(0)}KB` : `${b}B` }
function fmtMs(ms: number | null) { if (!ms) return '-'; return ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms` }

const NAV_ITEMS = [
  { key: 'collect', label: '数据采集', icon: '📡' },
  { key: 'summary', label: '数据汇总', icon: '📊' },
  { key: 'tracking', label: '收益跟踪', icon: '💰' },
  { key: 'schedule', label: '定时配置', icon: '⏰' },
] as const
type NavKey = typeof NAV_ITEMS[number]['key']

const today = () => new Date().toISOString().split('T')[0]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, cursor: 'pointer', transition: 'background .2s',
        background: checked ? 'var(--accent)' : 'var(--bg-badge)', position: 'relative',
      }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: checked ? 18 : 2, transition: 'left .2s',
      }} />
    </div>
  )
}

function Msg({ msg }: { msg: MsgT }) {
  const colors: Record<string, React.CSSProperties> = {
    success: { background: 'rgba(52,211,153,0.1)', border: '1px solid var(--down)', color: 'var(--down)' },
    error: { background: 'rgba(248,113,113,0.1)', border: '1px solid var(--up)', color: 'var(--up)' },
    warn: { background: 'rgba(129,140,248,0.1)', border: '1px solid var(--accent)', color: 'var(--accent-light)' },
  }
  return <div style={{ borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500, ...colors[msg.type] }}>{msg.text}</div>
}

// ====== 数据采集面板 ======

function CollectPanel({ date }: { date: string }) {
  const [status, setStatus] = useState<DatasourceStatusItem[]>([])
  const [logs, setLogs] = useState<FetchLogEntry[]>([])
  const [triggering, setTriggering] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<MsgT[]>([])

  const addFb = (fb: MsgT) => setFeedback(prev => [fb, ...prev].slice(0, 20))

  const load = useCallback(async () => {
    const [sr, lr] = await Promise.all([
      datasourceApi.getStatus(date).catch(() => null),
      datasourceApi.getLogs(1).catch(() => null),
    ])
    if (sr?.success) setStatus(sr.data)
    if (lr?.success) setLogs(lr.data.logs)
  }, [date])

  useEffect(() => { load() }, [load])

  const trigger = async (dataType: string) => {
    setTriggering(dataType)
    try {
      const r = await datasourceApi.triggerFetch(dataType, date)
      addFb(r.success ? { type: 'success', text: `✅ ${dataType} 采集${r.data.status === 'skipped' ? '跳过（已存在）' : '成功'} (${fmtMs(r.data.duration_ms)})` } : { type: 'error', text: `❌ ${dataType} 失败: ${r.data.error || ''}` })
      setTimeout(() => load(), 600)
    } catch (e: any) {
      addFb({ type: 'error', text: `❌ ${dataType} 异常: ${e.message}` })
    } finally { setTriggering(null) }
  }

  const triggerAll = async () => {
    setTriggering('__all__')
    try {
      const r = await datasourceApi.triggerAll(date)
      addFb({ type: 'success', text: `✅ 全部采集完成: ${r.data.success}/${r.data.total} 成功` })
      setTimeout(() => load(), 1000)
    } catch (e: any) {
      addFb({ type: 'error', text: `❌ 全部采集异常: ${e.message}` })
    } finally { setTriggering(null) }
  }

  const deleteOne = async (dataType: string) => {
    try {
      await datasourceApi.deleteRecord(dataType, date)
      addFb({ type: 'warn', text: `🗑️ ${dataType} 已删除，可重新采集` })
      load()
    } catch (e: any) { addFb({ type: 'error', text: `❌ 删除失败: ${e.message}` }) }
  }

  const deleteAll = async () => {
    try {
      await datasourceApi.deleteAllRecords(date)
      addFb({ type: 'warn', text: '🗑️ 今日全部数据已清空' })
      load()
    } catch (e: any) { addFb({ type: 'error', text: `❌ 清空失败: ${e.message}` }) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>共 {status.length} 类数据源</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={triggerAll} disabled={triggering === '__all__'}
            style={accentBtn(triggering === '__all__')}>
            {triggering === '__all__' ? '采集中...' : '🔄 全部采集'}
          </button>
          <button onClick={deleteAll} style={dangerBtn()}>
            🗑️ 清空今日
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
        {status.map(item => {
          const busy = triggering === item.data_type
          const sColor = item.status === 'success' ? 'var(--down)' : item.status === 'failed' ? 'var(--up)' : 'var(--text-muted)'
          const sText = item.status === 'success' ? '已采集' : item.status === 'failed' ? '失败' : item.status === 'skipped' ? '已跳过' : '未采集'
          return (
            <div key={item.data_type} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                  background: item.status === 'success' ? 'rgba(52,211,153,0.12)' : item.status === 'failed' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)',
                  color: sColor }}>{sText}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                {fmtSize(item.response_size)} · {fmtMs(item.duration_ms)}
                {item.error_message && <span style={{ color: 'var(--up)', marginLeft: 8 }}>{item.error_message.slice(0, 40)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {item.status === 'success' ? (
                  <>
                    <button onClick={() => deleteOne(item.data_type)} style={miniDangerBtn()}>删除</button>
                    <button onClick={() => trigger(item.data_type)} disabled={busy} style={miniBtn(busy)}>
                      {busy ? '...' : '重采'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => trigger(item.data_type)} disabled={busy} style={miniAccentBtn(busy)}>
                    {busy ? '采集中...' : '采集'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {feedback.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>操作反馈</div>
          <div style={{ maxHeight: 160, overflow: 'auto' }}>
            {feedback.map((fb, i) => <Msg key={i} msg={fb} />)}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          采集日志
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0 }}>
                <th style={thStyle}>时间</th><th style={thStyle}>类型</th><th style={thStyle}>状态</th><th style={thStyle}>耗时</th><th style={thStyle}>大小</th><th style={thStyle}>重试</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 30).map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={tdStyle}>{l.created_at?.slice(11, 19) || '-'}</td>
                  <td style={tdStyle}>{l.label}</td>
                  <td style={{ ...tdStyle, color: l.status === 'success' ? 'var(--down)' : l.status === 'failed' ? 'var(--up)' : 'var(--text-muted)' }}>
                    {l.status === 'success' ? '✓' : l.status === 'failed' ? '✗' : l.status}
                  </td>
                  <td style={tdStyle}>{fmtMs(l.duration_ms)}</td>
                  <td style={tdStyle}>{fmtSize(l.response_size)}</td>
                  <td style={tdStyle}>{l.retry_count > 0 ? `${l.retry_count}次` : '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>暂无日志</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ====== 数据汇总面板 ======

function SummaryPanel({ date }: { date: string }) {
  const [rptExists, setRptExists] = useState(false)
  const [recExists, setRecExists] = useState(false)
  const [rptLoading, setRptLoading] = useState(false)
  const [recLoading, setRecLoading] = useState(false)
  const [allLoading, setAllLoading] = useState(false)
  const [posterLoading, setPosterLoading] = useState(false)
  const [feedback, setFeedback] = useState<MsgT[]>([])

  const addFb = (fb: MsgT) => setFeedback(prev => [fb, ...prev].slice(0, 30))

  const checkStatus = useCallback(async () => {
    try {
      const [rpt, rec] = await Promise.all([
        apiGet<any>(`/report/daily?date=${date}`).catch(() => null),
        apiGet<any>(`/recommend/daily?date=${date}`).catch(() => null),
      ])
      setRptExists(rpt?.success && rpt?.data?.ai_report)
      setRecExists(rec?.success && rec?.data?.length > 0)
    } catch { /* */ }
  }, [date])

  useEffect(() => { checkStatus() }, [checkStatus])

  const startTask = async (ep: string) => {
    try {
      const res = await apiPost<any>(`${ep}?date=${date}`)
      if (res.success) {
        const taskId = res.data?.task_id
        if (taskId) {
          // poll
          const iv = setInterval(async () => {
            try {
              const t = await apiGet<any>(`/generate/task/${taskId}`)
              if (!t.success) { clearInterval(iv); return }
              if (t.data.status === 'completed') {
                clearInterval(iv)
                addFb({ type: 'success', text: `✅ ${ep} 完成 (${t.data.target_date})` })
                checkStatus()
              } else if (t.data.status === 'failed') {
                clearInterval(iv)
                addFb({ type: 'error', text: `❌ ${ep} 失败: ${t.data.error_message || ''}` })
              } else {
                addFb({ type: 'warn', text: `⏳ ${t.data.step_label || '执行中...'} (${t.data.progress_pct}%)` })
              }
            } catch { /* */ }
          }, 1000)
        } else {
          addFb({ type: 'success', text: `✅ ${res.data.message || '已完成（已存在）'}` })
          checkStatus()
        }
      }
    } catch (e: any) {
      addFb({ type: 'error', text: `❌ 启动失败: ${e.message}` })
    }
  }

  const delAndRedo = async (ep: string, delEp: string, setLoading: (v: boolean) => void, label: string) => {
    setLoading(true)
    try {
      await apiDelete<any>(`${delEp}?date=${date}`)
      addFb({ type: 'warn', text: `🗑️ ${label} 已删除，正在重新生成...` })
      await startTask(ep)
    } catch (e: any) {
      addFb({ type: 'error', text: `❌ ${e.message}` })
    } finally {
      setLoading(false)
      checkStatus()
    }
  }

  const genPoster = async () => {
    setPosterLoading(true)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api'
      const resp = await fetch(`${API_BASE}/report/poster?date=${date}`)
      if (!resp.ok) throw new Error('海报生成失败')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `QuantForge_${date}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      addFb({ type: 'success', text: `✅ 海报已下载 (${date})` })
    } catch (e: any) {
      addFb({ type: 'error', text: `❌ ${e.message}` })
    } finally { setPosterLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginRight: 8 }}>目标日期</span>
        <input type="date" value={date} max={today()} readOnly
          style={{
            background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
            padding: '6px 12px', borderRadius: 8, fontSize: 14, outline: 'none',
            fontFamily: "'JetBrains Mono', monospace",
          }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
        {/* 市场报告 */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>📊 市场报告</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
              background: rptExists ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
              color: rptExists ? 'var(--down)' : 'var(--text-muted)' }}>
              {rptExists ? '已生成' : '未生成'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {rptExists ? '含 AI 分析 + 北向资金 + 板块' : '指数行情 + 板块热点 + AI 分析'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {rptExists && (
              <button onClick={() => delAndRedo('/generate/report', '/generate/report', setRptLoading, '市场报告')}
                disabled={rptLoading} style={miniDangerBtn()}>删除并重新生成</button>
            )}
            {!rptExists && (
              <button onClick={async () => { setRptLoading(true); await startTask('/generate/report'); setRptLoading(false) }}
                disabled={rptLoading} style={miniAccentBtn(rptLoading)}>
                {rptLoading ? '...' : '生成报告'}
              </button>
            )}
          </div>
        </div>

        {/* 量化推荐 */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>🎯 量化推荐</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
              background: recExists ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
              color: recExists ? 'var(--down)' : 'var(--text-muted)' }}>
              {recExists ? '已生成' : '未生成'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {recExists ? 'THS 候选池 → AI 精选 5 只' : 'THS 热股 × 热度排名 → AI 精选'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {recExists && (
              <button onClick={() => delAndRedo('/generate/recommend', '/generate/recommend', setRecLoading, '量化推荐')}
                disabled={recLoading} style={miniDangerBtn()}>删除并重新生成</button>
            )}
            {!recExists && (
              <button onClick={async () => { setRecLoading(true); await startTask('/generate/recommend'); setRecLoading(false) }}
                disabled={recLoading} style={miniAccentBtn(recLoading)}>
                {recLoading ? '...' : '生成推荐'}
              </button>
            )}
          </div>
        </div>

        {/* 海报 */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🖼️ 生成海报</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>基于当日报告生成 PNG 海报</div>
          <button onClick={genPoster} disabled={posterLoading} style={miniAccentBtn(posterLoading)}>
            {posterLoading ? '生成中...' : '生成并下载'}
          </button>
        </div>
      </div>

      <button onClick={async () => { setAllLoading(true); await startTask('/generate/all'); setAllLoading(false) }}
        disabled={allLoading} style={bigAccentBtn(allLoading)}>
        {allLoading ? '执行中...' : '🚀 一键全部生成（报告 + 推荐）'}
      </button>

      {feedback.length > 0 && (
        <div className="card" style={{ padding: 12, marginTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>操作反馈</div>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {feedback.map((fb, i) => <Msg key={i} msg={fb} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ====== 收益跟踪面板 ======

function TrackingPanel() {
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
    setLoading(true)
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
    setBatchBusy(true); let s = 0
    for (const id of ids) { try { const r = action === 'delete' ? await apiDelete<any>(`/recommend/item/${id}`) : await apiPost<any>(`/recommend/item/${id}/${action}`); if (r.success) s++ } catch { /* */ } }
    setBatchBusy(false); showToast(`${successMsg}: ${s}/${ids.length} 条`); fetchData(); clearSelection()
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
    try { const r = await apiPost<any>(`/recommend/item/${id}/update`); showToast(r.success ? `✅ 更新 ${r.data?.filled || 0} 天` : r.error || '失败', !r.success); fetchData() }
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
          style={{ background: toast.err ? 'var(--up)' : 'var(--bg-card)', color: toast.err ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}>
          {toast.msg}
        </div>
      )}
      <ConfirmModal open={confirm.open} title={confirm.title} message={confirm.message} variant={confirm.variant} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(prev => ({ ...prev, open: false }))} />

      <div className="card p-3 mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>💰 价格更新</span>
          <button onClick={async () => { const r = await apiPost<any>('/recommend/update-prices'); showToast(`✅ 更新 ${r.data?.updated || 0} 条`); fetchData() }}
            style={miniAccentBtn(false)}>💰 批量更新现价</button>
        </div>
        <div className="flex items-center justify-around text-center" style={{ fontSize: 12 }}>
          <StatBox label="总计" value={stats.total} color="var(--text-primary)" />
          <StatBox label="跟踪中" value={stats.tracking} color="var(--accent-light)" />
          <StatBox label="已完结" value={stats.completed} color="var(--down)" />
          <StatBox label="盈利" value={stats.wins} color="var(--up)" />
          <StatBox label="平均收益" value={`${stats.avgReturn >= 0 ? '+' : ''}${fmt(stats.avgReturn)}%`} color={stats.avgReturn >= 0 ? 'var(--up)' : 'var(--down)'} />
          <StatBox label="胜率" value={`${fmt(stats.winRate)}%`} color="var(--text-muted)" />
        </div>
      </div>

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
      {error && !loading && <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'var(--up-bg)', border: '1px solid var(--up)', color: 'var(--up)' }}>{error}</div>}

      {!loading && filteredRecs.length > 0 && (
        <DetailedTable
          recs={filteredRecs} selectedIds={selectedIds}
          onSelect={toggleSelect} onSelectAll={selectAll}
          onUpdate={doSingleUpdate}
          onReset={(rec) => confirmThen('重置', <>确认重置 <strong>{rec.stock_name}</strong> 跟踪？</>, 'warning', async () => {
            setBusyIds(p => new Set(p).add(rec.id))
            await apiPost<any>(`/recommend/item/${rec.id}/reset`)
            showToast(`${rec.stock_name} 已重置`); fetchData()
            setBusyIds(p => { const n = new Set(p); n.delete(rec.id); return n })
          })}
          onDelete={(rec) => confirmThen('删除', <>确认删除 <strong>{rec.stock_name}</strong>（{rec.stock_code}）？</>, 'danger', async () => {
            setBusyIds(p => new Set(p).add(rec.id))
            await apiDelete<any>(`/recommend/item/${rec.id}`)
            showToast(`${rec.stock_name} 已删除`); fetchData()
            setBusyIds(p => { const n = new Set(p); n.delete(rec.id); return n })
          })}
          busyIds={busyIds} sortBy={sortBy} onSortByChange={setSortBy}
        />
      )}

      {!loading && filteredRecs.length === 0 && (
        <div className="card py-10 text-center">
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.6 }}>{recs.length === 0 ? '📈' : '🔍'}</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{recs.length === 0 ? '暂无历史推荐数据' : '没有匹配的记录'}</div>
        </div>
      )}
    </div>
  )
}

// ====== 定时配置面板 ======

function SchedulePanel() {
  const [sEn, setSEn] = useState(false)
  const [sTime, setSTime] = useState('16:00')
  const [sRpt, setSRpt] = useState(true)
  const [sRec, setSRec] = useState(true)
  const [sMsg, setSMsg] = useState('')
  const [sSaving, setSSaving] = useState(false)
  const [lastRun, setLastRun] = useState<any>(null)

  useEffect(() => {
    apiGet<any>('/schedule/config').then(d => {
      if (d.success) { setSEn(d.data.enabled); setSTime(d.data.run_time || '16:00'); setSRpt(d.data.run_report); setSRec(d.data.run_recommend); setLastRun(d.data) }
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSSaving(true); setSMsg('')
    try {
      await apiPost(`/schedule/config?enabled=${sEn}&run_time=${sTime}&run_report=${sRpt}&run_recommend=${sRec}`)
      setSMsg('✅ 已保存')
    } catch { setSMsg('❌ 保存失败') }
    finally { setSSaving(false); setTimeout(() => setSMsg(''), 3000) }
  }

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>定时数据采集</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>每天自动采集外部数据源到 raw_data_records</div>
          </div>
          <Toggle checked={sEn} onChange={setSEn} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>执行时间</div>
            <input type="time" value={sTime} onChange={e => setSTime(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', textAlign: 'center', padding: '8px 12px', borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 14, outline: 'none',
              }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>自动任务</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Toggle checked={sRpt} onChange={setSRpt} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>生成报告</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Toggle checked={sRec} onChange={setSRec} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>生成推荐</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 12, alignItems: 'center' }}>
          {sMsg && <span style={{ fontSize: 12, fontWeight: 500, color: sMsg.includes('✅') ? 'var(--down)' : 'var(--up)' }}>{sMsg}</span>}
          <button onClick={save} disabled={sSaving}
            style={{
              padding: '8px 24px', background: 'var(--accent)', color: '#fff',
              borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none',
              cursor: sSaving ? 'not-allowed' : 'pointer', opacity: sSaving ? 0.5 : 1,
            }}>
            {sSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {lastRun && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>上次执行</div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{lastRun.last_run_at ? `${lastRun.last_run_at}（${lastRun.last_run_info || '未知'}）` : '从未执行'}</div>
              {lastRun.last_run_result && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{lastRun.last_run_result}</div>}
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }}>下次执行</div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{sEn ? `每天 ${sTime}` : '已禁用'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ====== 主页面 ======

export default function SettingsPage() {
  const [nav, setNav] = useState<NavKey>('collect')

  const panels: Record<NavKey, () => JSX.Element> = {
    collect: () => <CollectPanel date={today()} />,
    summary: () => <SummaryPanel date={today()} />,
    tracking: () => <TrackingPanel />,
    schedule: () => <SchedulePanel />,
  }

  const Panel = panels[nav]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 0, minHeight: 'calc(100vh - 80px)' }}>
      {/* Left Nav */}
      <div style={{
        width: 140, flexShrink: 0, borderRight: '1px solid var(--border-default)',
        padding: '20px 0', position: 'sticky', top: 60, alignSelf: 'flex-start',
      }}>
        {NAV_ITEMS.map(item => (
          <div key={item.key} onClick={() => setNav(item.key)}
            style={{
              padding: '10px 14px', margin: '2px 8px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: nav === item.key ? 600 : 400, transition: 'all .15s',
              background: nav === item.key ? 'var(--accent)' : 'transparent',
              color: nav === item.key ? '#fff' : 'var(--text-secondary)',
            }}>
            <span style={{ marginRight: 6 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>

      {/* Right Content */}
      <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {NAV_ITEMS.find(i => i.key === nav)?.label}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          {nav === 'collect' && '管理外部数据源采集，查看采集状态和日志'}
          {nav === 'summary' && '基于已采集数据生成市场报告、量化推荐和海报'}
          {nav === 'tracking' && '管理量化推荐记录，更新和跟踪收益数据'}
          {nav === 'schedule' && '配置每日定时数据采集和自动生成任务'}
        </p>
        <Panel />
      </div>
    </div>
  )
}

// ====== 按钮样式 ======

function accentBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  }
}
function dangerBtn(): React.CSSProperties {
  return {
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: '1px solid var(--up)', background: 'transparent', color: 'var(--up)',
    cursor: 'pointer',
  }
}
function bigAccentBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 700,
    border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  }
}
function miniBtn(disabled: boolean): React.CSSProperties {
  return { padding: '4px 12px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }
}
function miniAccentBtn(disabled: boolean): React.CSSProperties {
  return { padding: '4px 12px', borderRadius: 6, fontSize: 12, border: 'none', background: 'var(--accent)', color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontWeight: 500 }
}
function miniDangerBtn(): React.CSSProperties {
  return { padding: '4px 12px', borderRadius: 6, fontSize: 12, border: '1px solid var(--up)', background: 'transparent', color: 'var(--up)', cursor: 'pointer' }
}

// ====== 通用样式 ======

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '7px 12px', fontSize: 12, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-lg sm:text-xl font-extrabold" style={{ color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

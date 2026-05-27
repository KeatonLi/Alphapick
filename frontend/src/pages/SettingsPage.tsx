import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api'

type StatusT = 'idle' | 'pending' | 'running' | 'completed' | 'failed'
type MsgT = { type: 'success' | 'error' | 'warn'; text: string }
type Tab = 'recommend' | 'report' | 'tracking' | 'poster' | 'settings'

// ── Helper components ──

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="stock-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border-default">
        <span className="text-base">{icon}</span>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Msg({ msg }: { msg: MsgT }) {
  const map = {
    success: 'bg-green-50 border border-green-200 text-green-700',
    error: 'bg-red-50 border border-red-200 text-red-600',
    warn: 'bg-amber-50 border border-amber-200 text-amber-700',
  }
  return <div className={`rounded-xl px-3 py-2 text-xs font-medium ${map[msg.type]}`}>{msg.text}</div>
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

// ── Tab components ──

function RecommendTab({ date }: { date: string }) {
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [c, setC] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, candidates: [] as any[], msg: null as MsgT | null })
  const [editModal, setEditModal] = useState(false)
  const [editItems, setEditItems] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)
  const [showCands, setShowCands] = useState(false)

  const loadRecs = async () => {
    setLoading(true)
    try {
      const res = await apiGet<any>(`/recommend/daily?date=${date}`)
      setRecs(res.data || [])
    } catch { setRecs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadRecs() }, [date])

  const busy = (s: StatusT) => s === 'pending' || s === 'running'

  const poll = (taskId: number) => {
    const iv = setInterval(async () => {
      try {
        const res = await apiGet<any>(`/generate/task/${taskId}`)
        if (!res.success) { clearInterval(iv); return }
        const d = res.data
        setC(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status, candidates: d.candidate_stocks?.length > 0 ? d.candidate_stocks : p.candidates }))
        if (d.status === 'completed') {
          clearInterval(iv)
          const cnt = d.result?.count
          if (cnt === 0 || cnt === undefined) setC(p => ({ ...p, msg: { type: 'warn' as const, text: `⚠️ ${d.target_date} 无候选主板股票` } }))
          else setC(p => ({ ...p, msg: { type: 'success' as const, text: `✅ ${d.target_date} 推荐完成，共 ${cnt} 只` } }))
          loadRecs()
        } else if (d.status === 'failed') { clearInterval(iv); setC(p => ({ ...p, msg: { type: 'error' as const, text: d.error_message || '失败' } })) }
      } catch {}
    }, 1000)
  }

  const startGen = async () => {
    setC(p => ({ ...p, status: 'pending', msg: null }))
    try {
      const res = await apiPost<any>(`/generate/recommend?date=${date}`)
      if (res.success && res.data?.task_id) {
        setC(p => ({ ...p, status: 'running' }))
        poll(res.data.task_id)
      } else if (res.data?.message) {
        setC(p => ({ ...p, status: 'completed', msg: { type: 'success', text: res.data.message } }))
        loadRecs()
      }
    } catch (e: any) {
      setC(p => ({ ...p, status: 'failed', msg: { type: 'error', text: `启动失败: ${e.message}` } }))
    }
  }

  const openEdit = () => {
    setEditItems(recs.map((r, i) => ({ id: i, ...r, delete: false })))
    setEditModal(true)
  }

  const saveEdit = async () => {
    try {
      await apiPut(`/recommend/day/${date}`, editItems)
      setEditModal(false)
      loadRecs()
      setMsg({ type: 'success', text: '✅ 已保存' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const deleteDay = async () => {
    try {
      await apiDelete(`/recommend/day/${date}`)
      setDeleteConfirm(false)
      setRecs([])
      setMsg({ type: 'success', text: '✅ 已删除' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  return (
    <Section icon="🎯" title="智能推荐管理">
      <div className="flex gap-2 flex-wrap">
        <button onClick={startGen} disabled={busy(c.status)}
          className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-md shadow-amber-200 disabled:cursor-not-allowed">
          {busy(c.status) ? (c.label || '生成中...') : '🤖 AI 一键生成'}
        </button>
        <button onClick={openEdit} disabled={recs.length === 0}
          className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
          ✏️ 编辑整组
        </button>
        <button onClick={() => setDeleteConfirm(true)} disabled={recs.length === 0}
          className="py-2 px-4 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-all">
          🗑️ 删除
        </button>
      </div>
      {busy(c.status) && <PBar pct={c.pct} label={c.label} cur={c.step} tot={c.total} />}
      {c.msg && <Msg msg={c.msg} />}
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : recs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-text-muted text-left">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">代码</th>
                <th className="py-2 px-2">名称</th>
                <th className="py-2 px-2 text-right">推荐价</th>
                <th className="py-2 px-2">理由</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r: any, i: number) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-2 text-text-muted">{i + 1}</td>
                  <td className="py-2 px-2 font-mono">{r.stock_code}</td>
                  <td className="py-2 px-2 font-medium">{r.stock_name}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.recommend_price}</td>
                  <td className="py-2 px-2 text-text-muted text-xs max-w-[200px] truncate">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无推荐数据</div>
      )}

      {c.candidates.length > 0 && (
        <div className="border-t border-border-default pt-2 mt-1">
          <button onClick={() => setShowCands(!showCands)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
            {showCands ? '▼' : '▶'} 候选池（{c.candidates.length} 只）
          </button>
          {showCands && (
            <div className="max-h-48 overflow-y-auto space-y-1 mt-2 pr-1">
              {c.candidates.map((s: any, i: number) => (
                <div key={s.code} className="flex items-center gap-2 px-2 py-1.5 rounded bg-blue-50/50 text-[11px] border border-blue-100/50">
                  <span className="text-text-muted font-mono w-4 text-right">{i + 1}</span>
                  <span className="font-semibold text-blue-800 w-14 truncate">{s.name}</span>
                  <span className="text-text-muted font-mono w-12">{s.code}</span>
                  <span className="text-text-muted font-mono w-10 text-right">{s.price}</span>
                  <span className={`font-mono w-10 text-right ${s.change_pct >= 0 ? 'text-red-500' : 'text-green-600'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">编辑 {date} 推荐</h3>
            {editItems.map((item, idx) => (
              <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border ${item.delete ? 'bg-red-50 border-red-200 opacity-50' : 'bg-gray-50 border-border-default'}`}>
                <span className="text-xs font-mono w-12">{item.stock_code}</span>
                <span className="text-xs font-medium w-16">{item.stock_name}</span>
                <input type="number" step="0.01" value={item.recommend_price}
                  onChange={e => { const next = [...editItems]; next[idx].recommend_price = parseFloat(e.target.value) || 0; setEditItems(next) }}
                  className="w-20 text-xs border rounded px-1 py-0.5 font-mono" />
                <input type="text" value={item.reason || ''} placeholder="理由"
                  onChange={e => { const next = [...editItems]; next[idx].reason = e.target.value; setEditItems(next) }}
                  className="flex-1 text-xs border rounded px-2 py-0.5" />
                <button onClick={() => { const next = [...editItems]; next[idx].delete = !next[idx].delete; setEditItems(next) }}
                  className={`text-xs px-2 py-0.5 rounded ${item.delete ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>
                  {item.delete ? '恢复' : '删除'}
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">保存</button>
              <button onClick={() => setEditModal(false)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">确认删除</h3>
            <p className="text-sm text-text-secondary">确定要删除 {date} 的全部推荐记录（共 {recs.length} 条）？此操作不可撤销。</p>
            <div className="flex gap-2">
              <button onClick={deleteDay} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600">确认删除</button>
              <button onClick={() => setDeleteConfirm(false)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

function ReportTab({ date }: { date: string }) {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editField, setEditField] = useState<'market_summary' | 'ai_report' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)
  const [genStatus, setGenStatus] = useState<StatusT>('idle')
  const [genLabel, setGenLabel] = useState('')
  const [genPct, setGenPct] = useState(0)

  const loadReport = async () => {
    setLoading(true)
    try {
      const res = await apiGet<any>(`/report/daily?date=${date}`)
      setReport(res.data)
    } catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [date])

  const busy = (s: StatusT) => s === 'pending' || s === 'running'

  const openEdit = (field: 'market_summary' | 'ai_report') => {
    setEditField(field)
    setEditValue(report?.[field] || '')
  }

  const saveEdit = async () => {
    if (!editField) return
    try {
      await apiPut(`/report/day/${date}`, { [editField]: editValue })
      setEditField(null)
      loadReport()
      setMsg({ type: 'success', text: '✅ 已保存' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const deleteDay = async () => {
    try {
      await apiDelete(`/report/day/${date}`)
      setDeleteConfirm(false)
      setReport(null)
      setMsg({ type: 'success', text: '✅ 已删除' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const genReport = async () => {
    setGenStatus('pending')
    try {
      const res = await apiPost<any>(`/generate/report?date=${date}`)
      if (res.success && res.data?.task_id) {
        setGenStatus('running')
        const iv = setInterval(async () => {
          try {
            const r = await apiGet<any>(`/generate/task/${res.data.task_id}`)
            if (r.success) {
              setGenLabel(r.data.step_label || '')
              setGenPct(r.data.progress_pct || 0)
              setGenStatus(r.data.status)
              if (r.data.status === 'completed' || r.data.status === 'failed') {
                clearInterval(iv)
                if (r.data.status === 'completed') { setMsg({ type: 'success', text: '✅ 报告生成完成' }); loadReport() }
              }
            }
          } catch {}
        }, 1000)
      } else if (res.data?.message) {
        setGenStatus('completed')
        setMsg({ type: 'success', text: res.data.message })
        loadReport()
      }
    } catch (e: any) {
      setGenStatus('failed')
      setMsg({ type: 'error', text: e.message })
    }
  }

  return (
    <Section icon="📊" title="市场报告管理">
      <div className="flex gap-2">
        <button onClick={genReport} disabled={busy(genStatus)}
          className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-md shadow-blue-200 disabled:cursor-not-allowed">
          {busy(genStatus) ? (genLabel || '生成中...') : '🤖 AI 一键生成'}
        </button>
        <button onClick={() => setDeleteConfirm(true)} disabled={!report}
          className="py-2 px-4 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-all">
          🗑️ 删除
        </button>
      </div>
      {busy(genStatus) && <PBar pct={genPct} label={genLabel} cur={0} tot={0} />}
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : report ? (
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-secondary">市场概况</span>
              <button onClick={() => openEdit('market_summary')} className="text-xs text-blue-600 hover:text-blue-800">✏️ 编辑</button>
            </div>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{report.market_summary || '暂无'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-secondary">AI 分析</span>
              <button onClick={() => openEdit('ai_report')} className="text-xs text-blue-600 hover:text-blue-800">✏️ 编辑</button>
            </div>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{report.ai_report || '暂无'}</p>
          </div>
          {report.index_data?.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-bold text-text-secondary block mb-2">指数数据</span>
              <div className="flex flex-wrap gap-2">
                {report.index_data.map((idx: any, i: number) => (
                  <span key={i} className="text-xs bg-white px-2 py-1 rounded-lg border border-border-default">
                    {idx.name} <span className={idx.change_pct >= 0 ? 'text-red-500' : 'text-green-600'}>{idx.change_pct >= 0 ? '+' : ''}{idx.change_pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.hot_sectors?.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-bold text-text-secondary block mb-2">热门板块</span>
              <div className="flex flex-wrap gap-2">
                {report.hot_sectors.slice(0, 8).map((s: any, i: number) => (
                  <span key={i} className="text-xs bg-white px-2 py-1 rounded-lg border border-border-default">
                    {s.name} <span className={s.change_pct >= 0 ? 'text-red-500' : 'text-green-600'}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无报告数据</div>
      )}

      {editField && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditField(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">编辑{editField === 'market_summary' ? '市场概况' : 'AI 分析'}</h3>
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={10}
              className="w-full border border-border-default rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400 resize-y" />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">保存</button>
              <button onClick={() => setEditField(null)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">确认删除</h3>
            <p className="text-sm text-text-secondary">确定要删除 {date} 的市场报告？此操作不可撤销。</p>
            <div className="flex gap-2">
              <button onClick={deleteDay} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600">确认删除</button>
              <button onClick={() => setDeleteConfirm(false)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

function TrackingTab({ date }: { date: string }) {
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)

  const loadRecs = async () => {
    setLoading(true)
    try {
      const res = await apiGet<any>('/recommend/history')
      const all = res.data || []
      setRecs(all.filter((r: any) => r.recommend_date === date))
    } catch { setRecs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadRecs() }, [date])

  const triggerUpdate = async () => {
    setUpdating(true); setMsg(null)
    try {
      const r = await apiPost('/recommend/update-prices')
      setMsg({ type: 'success', text: `✅ 更新完成，共 ${r.data?.data?.updated || 0} 只` })
      loadRecs()
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
    finally { setUpdating(false) }
  }

  return (
    <Section icon="📈" title="收益跟踪">
      <div className="flex gap-2">
        <button onClick={triggerUpdate} disabled={updating}
          className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-green-200 disabled:cursor-not-allowed">
          {updating ? '更新中...' : '💰 触发更新'}
        </button>
      </div>
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : recs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-text-muted text-left">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">代码</th>
                <th className="py-2 px-2">名称</th>
                <th className="py-2 px-2 text-right">跟踪天</th>
                <th className="py-2 px-2 text-right">当前价</th>
                <th className="py-2 px-2 text-right">收益率</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r: any, i: number) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-2 text-text-muted">{i + 1}</td>
                  <td className="py-2 px-2 font-mono">{r.stock_code}</td>
                  <td className="py-2 px-2 font-medium">{r.stock_name}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.tracking_days}/3</td>
                  <td className="py-2 px-2 text-right font-mono">{r.current_price || '-'}</td>
                  <td className={`py-2 px-2 text-right font-mono ${(r.return_rate || 0) >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {r.return_rate ? `${r.return_rate >= 0 ? '+' : ''}${r.return_rate.toFixed(2)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无跟踪数据</div>
      )}
    </Section>
  )
}

function PosterTab({ date }: { date: string }) {
  const [posterUrl, setPosterUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)

  const API_BASE = import.meta.env.VITE_API_URL || '/api'

  const loadPoster = async () => {
    setLoading(true); setPosterUrl('')
    try {
      const res = await apiGet<any>(`/report/poster/base64?date=${date}`)
      if (res.success && res.data?.base64) setPosterUrl(`data:image/png;base64,${res.data.base64}`)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadPoster() }, [date])

  const downloadPoster = async () => {
    try {
      const resp = await fetch(`${API_BASE}/report/poster?date=${date}`)
      if (!resp.ok) throw new Error('下载失败')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `QuantForge_市场日报_${date}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const genPoster = async () => {
    setGenLoading(true); setMsg(null)
    try {
      const resp = await fetch(`${API_BASE}/report/poster?date=${date}`)
      if (!resp.ok) { const err = await resp.json().catch(() => ({ detail: '生成失败' })); setMsg({ type: 'error', text: err.detail }); return }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `QuantForge_市场日报_${date}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: `✅ 海报已生成并下载（${date}）` })
      loadPoster()
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
    finally { setGenLoading(false) }
  }

  const deletePoster = async () => {
    try {
      await apiDelete(`/report/poster/${date}`)
      setPosterUrl('')
      setMsg({ type: 'success', text: '✅ 海报已删除' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  return (
    <Section icon="🖼️" title="海报管理">
      <div className="flex gap-2">
        <button onClick={genPoster} disabled={genLoading}
          className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 transition-all shadow-md shadow-purple-200 disabled:cursor-not-allowed">
          {genLoading ? '生成中...' : '🖼️ 生成海报'}
        </button>
        <button onClick={downloadPoster} disabled={!posterUrl}
          className="py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
          ⬇️ 下载
        </button>
        <button onClick={deletePoster} disabled={!posterUrl}
          className="py-2 px-4 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-all">
          🗑️ 删除
        </button>
      </div>
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : posterUrl ? (
        <div className="flex justify-center">
          <img src={posterUrl} alt={`海报 ${date}`} className="max-w-full max-h-[600px] rounded-xl shadow-lg border border-border-default" />
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无海报</div>
      )}
    </Section>
  )
}

function SettingsTab() {
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

  const saveSched = async () => {
    setSSaving(true); setSMsg('')
    try { const r = await apiPost(`/schedule/config?enabled=${sEn}&run_time=${sTime}&run_report=${sRpt}&run_recommend=${sRec}`); setSMsg(r.success ? '✅ 已保存' : '❌ 失败') }
    catch { setSMsg('❌ 失败') }
    finally { setSSaving(false); setTimeout(() => setSMsg(''), 3000) }
  }

  return (
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
  )
}

// ── Main page ──

export default function SettingsPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [activeTab, setActiveTab] = useState<Tab>('recommend')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in-up">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">控制台</h1>
        <p className="text-xs sm:text-sm text-text-secondary">数据管理 · 生成 · 系统配置</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-xl overflow-x-auto scrollbar-none">
        {([
          { key: 'recommend' as Tab, label: '智能推荐', icon: '🎯' },
          { key: 'report' as Tab, label: '市场报告', icon: '📊' },
          { key: 'tracking' as Tab, label: '收益跟踪', icon: '📈' },
          { key: 'poster' as Tab, label: '海报管理', icon: '🖼️' },
          { key: 'settings' as Tab, label: '系统设置', icon: '⚙️' },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === t.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}>
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* Shared date picker */}
        <Section icon="📅" title="目标日期">
          <input type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-white border border-border-default text-text-primary text-center px-3 py-2 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
        </Section>

        {activeTab === 'recommend' && <RecommendTab date={date} />}
        {activeTab === 'report' && <ReportTab date={date} />}
        {activeTab === 'tracking' && <TrackingTab date={date} />}
        {activeTab === 'poster' && <PosterTab date={date} />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}

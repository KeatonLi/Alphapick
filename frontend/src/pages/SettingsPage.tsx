import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../services/api'

type StatusT = 'idle' | 'pending' | 'running' | 'completed' | 'failed'
type MsgT = { type: 'success' | 'error' | 'warn'; text: string }

export default function SettingsPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  // ── 报告 ──
  const [r, setR] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, msg: null as MsgT | null })

  // ── 推荐 ──
  const [c, setC] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, candidates: [] as any[], msg: null as MsgT | null })

  // ── 全部 ──
  const [a, setA] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, msg: null as MsgT | null })

  // ── 现价 ──
  const [pLoading, setPLoading] = useState(false)
  const [pMsg, setPMsg] = useState<MsgT | null>(null)

  // ── 候选池 ──
  const [showCands, setShowCands] = useState(false)

  // ── 定时任务 ──
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
  const idle = (s: StatusT) => s === 'idle' || s === 'completed' || s === 'failed'

  // ── 轮询 ──
  const poll = (taskId: number, t: 'r' | 'c' | 'a') => {
    const iv = setInterval(async () => {
      try {
        const res = await apiGet<any>(`/generate/task/${taskId}`)
        if (!res.success) { clearInterval(iv); return }
        const d = res.data

        if (t === 'r') {
          setR(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status }))
          if (d.status === 'completed') { clearInterval(iv); setR(p => ({ ...p, msg: { type: 'success', text: `✅ 报告完成（${d.target_date}）` } })) }
          else if (d.status === 'failed') { clearInterval(iv); setR(p => ({ ...p, msg: { type: 'error', text: d.error_message || '失败' } })) }
        }

        if (t === 'c') {
          setC(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status, candidates: d.candidate_stocks?.length > 0 ? d.candidate_stocks : p.candidates }))
          if (d.status === 'completed') {
            clearInterval(iv)
            const cnt = d.result?.count
            if (cnt === 0 || cnt === undefined) setC(p => ({ ...p, msg: { type: 'warn', text: `⚠️ ${d.target_date} 无候选主板股票` } }))
            else setC(p => ({ ...p, msg: { type: 'success', text: `✅ ${d.target_date} 推荐完成，共 ${cnt} 只` } }))
          } else if (d.status === 'failed') { clearInterval(iv); setC(p => ({ ...p, msg: { type: 'error', text: d.error_message || '失败' } })) }
        }

        if (t === 'a') {
          setA(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status }))
          if (d.candidate_stocks?.length > 0) setC(p => ({ ...p, candidates: d.candidate_stocks }))
          if (d.status === 'completed') { clearInterval(iv); setA(p => ({ ...p, msg: { type: 'success', text: '✅ 全部完成' } })) }
          else if (d.status === 'failed') { clearInterval(iv); setA(p => ({ ...p, msg: { type: 'error', text: d.error_message || '失败' } })) }
        }
      } catch { /* */ }
    }, 1000)
  }

  // ── 启动 ──
  const start = async (ep: string, t: 'r' | 'c' | 'a') => {
    const set = t === 'r' ? setR : t === 'c' ? setC : setA
    set(p => ({ ...p, status: 'pending', msg: null }))
    try {
      const res = await apiPost(`${ep}?date=${date}`)
      if (res.success && res.data?.task_id) {
        set(p => ({ ...p, status: 'running' }))
        poll(res.data.task_id, t)
      } else if (res.data?.message) {
        set(p => ({ ...p, status: 'completed', msg: { type: 'success', text: res.data.message } }))
      }
    } catch (e: any) {
      set(p => ({ ...p, status: 'failed', msg: { type: 'error', text: `启动失败: ${e.message}` } }))
    }
  }

  // ── 现价 ──
  const updPrice = async () => {
    setPLoading(true); setPMsg(null)
    try { const r = await apiPost('/recommend/update-prices'); setPMsg({ type: 'success', text: `✅ 现价更新完成，共 ${r.data?.data?.updated || 0} 只` }) }
    catch (e: any) { setPMsg({ type: 'error', text: `更新失败: ${e.message}` }) }
    finally { setPLoading(false) }
  }

  // ── 定时任务 ──
  const saveSched = async () => {
    setSSaving(true); setSMsg('')
    try { const r = await apiPost(`/schedule/config?enabled=${sEn}&run_time=${sTime}&run_report=${sRpt}&run_recommend=${sRec}`); setSMsg(r.success ? '✅ 已保存' : '❌ 失败') }
    catch { setSMsg('❌ 失败') }
    finally { setSSaving(false); setTimeout(() => setSMsg(''), 3000) }
  }

  // ── 子组件 ──
  const PBar = ({ pct, label, cur, tot }: { pct: number; label: string; cur: number; tot: number }) => (
    <div className="space-y-1">
      {label && <div className="text-xs text-blue-600 truncate font-medium">{label}</div>}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      {tot > 0 && <div className="flex justify-between text-[11px] text-text-muted"><span>步骤 {cur}/{tot}</span><span>{pct}%</span></div>}
    </div>
  )

  const StatusBadge = ({ s }: { s: StatusT }) => {
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

  const btnDisabled = busy(r.status) || busy(c.status) || busy(a.status)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in-up">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">设置</h1>
        <p className="text-xs sm:text-sm text-text-secondary">数据生成 · 定时任务 · 系统配置</p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* ═══════════ 目标日期 ═══════════ */}
        <Section icon="📅" title="目标日期">
          <input type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)}
            disabled={btnDisabled}
            className="w-full bg-white border border-border-default text-text-primary text-center px-3 py-2 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50" />
        </Section>

        {/* ═══════════ 数据生成 ═══════════ */}
        <Section icon="⚡" title="数据生成">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* ── 一键全部 ── */}
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

            {/* ── 市场报告 ── */}
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

            {/* ── 量化推荐 ── */}
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

              {/* 候选池 */}
              {c.candidates.length > 0 && (
                <div className="border-t border-border-default pt-2 mt-1">
                  <button onClick={() => setShowCands(!showCands)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                    {showCands ? '▼' : '▶'} 候选池（{c.candidates.length} 只）THS ∩ 热度排名 → 消息面
                  </button>
                  {showCands && (
                    <div className="max-h-48 overflow-y-auto space-y-1 mt-2 pr-1">
                      {c.candidates.map((s: any, i: number) => (
                        <div key={s.code} className="flex flex-col gap-0.5 px-2 py-1.5 rounded bg-blue-50/50 text-[11px] border border-blue-100/50">
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted font-mono w-4 text-right">{i + 1}</span>
                            <span className="font-semibold text-blue-800 w-14 truncate">{s.name}</span>
                            <span className="text-text-muted font-mono w-12">{s.code}</span>
                            <span className="text-text-muted font-mono w-10 text-right">{s.price}</span>
                            <span className={`font-mono w-10 text-right ${s.change_pct >= 0 ? 'text-red-500' : 'text-green-600'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct?.toFixed(1)}%</span>
                            <span className="text-text-muted">换手{s.turnover?.toFixed(1) || '?'}%</span>
                            <span className="text-orange-500 font-medium">#{s.hot_rank}</span>
                          </div>
                          {s.news?.length > 0 && (
                            <div className="text-text-muted text-[10px] pl-6 truncate" title={s.news.join(' | ')}>
                              📰 {s.news[0]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── 更新现价 ── */}
          <div className="stock-card p-4 space-y-3 mt-3 border-l-4 border-l-green-400">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-green-600">更新现价</div>
                <div className="text-[11px] text-text-muted">批量更新历史推荐的当前价格和收益率</div>
              </div>
            </div>
            <button onClick={updPrice} disabled={pLoading}
              className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-green-200 disabled:cursor-not-allowed">
              {pLoading ? '更新中...' : '💰 更新现价'}
            </button>
            {pMsg && <Msg msg={pMsg} />}
          </div>
        </Section>

        {/* ═══════════ 定时任务 ═══════════ */}
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
    </div>
  )
}

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

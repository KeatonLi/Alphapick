import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../services/api'

export default function SettingsPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  // 报告状态
  const [rStatus, setRStatus] = useState('idle')
  const [rStep, setRStep] = useState(0)
  const [rTotal, setRTotal] = useState(0)
  const [rLabel, setRLabel] = useState('')
  const [rPct, setRPct] = useState(0)
  const [rMsg, setRMsg] = useState<{type: 'success'|'error'; text: string} | null>(null)

  // 推荐状态
  const [cStatus, setCStatus] = useState('idle')
  const [cStep, setCStep] = useState(0)
  const [cTotal, setCTotal] = useState(0)
  const [cLabel, setCLabel] = useState('')
  const [cPct, setCPct] = useState(0)
  const [cCandidates, setCCandidates] = useState<any[]>([])
  const [cMsg, setCMsg] = useState<{type: 'success'|'error'; text: string} | null>(null)

  // 全部状态
  const [aStatus, setAStatus] = useState('idle')
  const [aLabel, setALabel] = useState('')
  const [aPct, setAPct] = useState(0)

  // 现价状态
  const [pLoading, setPLoading] = useState(false)
  const [pMsg, setPMsg] = useState<{type: 'success'|'error'; text: string} | null>(null)

  // 候选池展开
  const [showCandidates, setShowCandidates] = useState(false)

  // 定时任务
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

  const isBusy = (s: string) => s === 'pending' || s === 'running'

  const poll = (taskId: number, t: string) => {
    const iv = setInterval(async () => {
      try {
        const r = await apiGet<any>(`/generate/task/${taskId}`)
        if (!r.success) { clearInterval(iv); return }
        const d = r.data
        if (t === 'r') { setRStep(d.current_step); setRTotal(d.total_steps); setRLabel(d.step_label||''); setRPct(d.progress_pct); setRStatus(d.status); if (d.status==='completed'){clearInterval(iv);setRMsg({type:'success',text:`✅ 报告完成（${d.target_date}）`})} else if (d.status==='failed'){clearInterval(iv);setRMsg({type:'error',text:d.error_message||'失败'})} }
        if (t === 'c') { setCStep(d.current_step); setCTotal(d.total_steps); setCLabel(d.step_label||''); setCPct(d.progress_pct); setCStatus(d.status); if (d.candidate_stocks?.length>0) setCCandidates(d.candidate_stocks); if (d.status==='completed'){clearInterval(iv);setCMsg({type:'success',text:`✅ 推荐完成（${d.target_date}）`})} else if (d.status==='failed'){clearInterval(iv);setCMsg({type:'error',text:d.error_message||'失败'})} }
        if (t === 'a') { setALabel(d.step_label||''); setAPct(d.progress_pct); setAStatus(d.status); if (d.candidate_stocks?.length>0) setCCandidates(d.candidate_stocks); if (d.status==='completed'||d.status==='failed') clearInterval(iv) }
      } catch { /* ignore */ }
    }, 1500)
  }

  const start = async (ep: string, t: string) => {
    const st = t==='r'?setRStatus:t==='c'?setCStatus:setAStatus; const sm = t==='r'?setRMsg:t==='c'?setCMsg:null
    st('pending'); if(sm) sm(null)
    try { const r = await apiPost(`${ep}?date=${date}`); if (r.success&&r.data?.task_id) { st('running'); poll(r.data.task_id, t) } else if (r.data?.message) { st('completed'); if(sm) sm({type:'success',text:r.data.message}) } }
    catch(e:any) { st('failed'); if(sm) sm({type:'error',text:`启动失败: ${e.message}`}) }
  }

  const updPrice = async () => {
    setPLoading(true); setPMsg(null)
    try { const r = await apiPost('/recommend/update-prices'); setPMsg({type:'success',text:`✅ 现价更新完成，共 ${r.data?.data?.updated||0} 只`}) }
    catch(e:any) { setPMsg({type:'error',text:`更新失败: ${e.message}`}) }
    finally { setPLoading(false) }
  }

  const saveSched = async () => {
    setSSaving(true); setSMsg('')
    try { const r = await apiPost(`/schedule/config?enabled=${sEn}&run_time=${sTime}&run_report=${sRpt}&run_recommend=${sRec}`); setSMsg(r.success?'✅ 已保存':'❌ 失败') }
    catch { setSMsg('❌ 失败') }
    finally { setSSaving(false); setTimeout(()=>setSMsg(''),3000) }
  }

  const PBar = ({ pct, label, cur, tot }: { pct: number; label: string; cur: number; tot: number }) => (
    <div className="space-y-1">
      {label && <div className="text-xs text-blue-600 truncate">{label}</div>}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      {tot > 0 && <div className="flex justify-between text-[11px] text-text-muted"><span>{cur}/{tot}</span><span>{pct}%</span></div>}
    </div>
  )

  const Status = (s: string) =>
    s==='completed'?'bg-green-100 text-green-700':isBusy(s)?'bg-blue-100 text-blue-700 animate-pulse':'bg-gray-100 text-gray-500'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in-up">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">设置</h1>
        <p className="text-xs sm:text-sm text-text-secondary">数据生成 · 定时任务 · 系统配置</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* ═══════════ 日期 ═══════════ */}
        <Section icon="📅" title="目标日期">
          <input type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)}
            disabled={isBusy(rStatus)||isBusy(cStatus)||isBusy(aStatus)}
            className="w-full bg-white border border-border-default text-text-primary text-center px-3 py-2 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"/>
        </Section>

        {/* ═══════════ 数据生成 ═══════════ */}
        <Section icon="⚡" title="数据生成">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 全部 */}
            <div className="stock-card p-4 space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-bold text-indigo-700">一键生成全部</div><div className="text-[11px] text-text-muted">市场报告 → 量化推荐 → 更新现价</div></div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${Status(aStatus)}`}>{aStatus==='completed'?'已完成':isBusy(aStatus)?'执行中':'就绪'}</span>
              </div>
              {isBusy(aStatus) && <PBar pct={aPct} label={aLabel} cur={0} tot={0} />}
              <button onClick={()=>start('/generate/all','a')} disabled={isBusy(aStatus)}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200 disabled:cursor-not-allowed">
                {isBusy(aStatus) ? (aLabel||'执行中...') : '🚀 一键全部'}
              </button>
            </div>

            {/* 报告 */}
            <div className="stock-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-bold text-blue-700">市场报告</div><div className="text-[11px] text-text-muted">指数 + 板块 + AI 分析</div></div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${Status(rStatus)}`}>{rStatus==='completed'?'已完成':isBusy(rStatus)?'执行中':'就绪'}</span>
              </div>
              {isBusy(rStatus) && <PBar pct={rPct} label={rLabel} cur={rStep} tot={rTotal} />}
              <button onClick={()=>start('/generate/report','r')} disabled={isBusy(rStatus)}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-md shadow-blue-200 disabled:cursor-not-allowed">
                {isBusy(rStatus) ? (rLabel||'生成中...') : '📊 生成报告'}
              </button>
              {rMsg && <Msg msg={rMsg}/>}
            </div>

            {/* 推荐 */}
            <div className="stock-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-bold text-amber-600">量化推荐</div><div className="text-[11px] text-text-muted">均线多头 + AI 精选 5 只</div></div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${Status(cStatus)}`}>{cStatus==='completed'?'已完成':isBusy(cStatus)?'执行中':'就绪'}</span>
              </div>
              {isBusy(cStatus) && <PBar pct={cPct} label={cLabel} cur={cStep} tot={cTotal} />}
              <button onClick={()=>start('/generate/recommend','c')} disabled={isBusy(cStatus)}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-md shadow-amber-200 disabled:cursor-not-allowed">
                {isBusy(cStatus) ? (cLabel||'生成中...') : '🎯 生成推荐'}
              </button>
              {cMsg && <Msg msg={cMsg}/>}

              {/* 候选池 */}
              {cCandidates.length > 0 && (
                <div className="border-t border-border-default pt-2 mt-1">
                  <button onClick={()=>setShowCandidates(!showCandidates)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    {showCandidates ? '▼' : '▶'} 均线多头候选池（{cCandidates.length} 只）
                  </button>
                  {showCandidates && <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                    {cCandidates.map((s:any,i:number)=>(
                      <div key={s.code} className="flex items-center gap-2 px-2 py-1 rounded bg-blue-50/50 text-[11px]">
                        <span className="text-text-muted font-mono w-4 text-right">{i+1}</span>
                        <span className="font-medium text-blue-800 w-14 truncate">{s.name}</span>
                        <span className="text-text-muted font-mono w-12">{s.code}</span>
                        <span className="text-text-muted font-mono w-10 text-right">{s.price}</span>
                        <span className={`font-mono w-10 text-right ${s.change_pct>=0?'text-red-500':'text-green-600'}`}>{s.change_pct>=0?'+':''}{s.change_pct?.toFixed(1)}%</span>
                        <span className="text-text-muted font-mono w-8 text-right">{s.volume_ratio?.toFixed(1)}x</span>
                      </div>
                    ))}
                  </div>}
                </div>
              )}
            </div>
          </div>

          {/* 更新现价 */}
          <div className="stock-card p-4 space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-bold text-green-600">更新现价</div><div className="text-[11px] text-text-muted">批量更新历史推荐的当前价格和收益率</div></div>
            </div>
            <button onClick={updPrice} disabled={pLoading}
              className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-green-200 disabled:cursor-not-allowed">
              {pLoading ? '更新中...' : '💰 更新现价'}
            </button>
            {pMsg && <Msg msg={pMsg}/>}
          </div>
        </Section>

        {/* ═══════════ 定时任务 ═══════════ */}
        <Section icon="⏰" title="定时任务">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-text-secondary">每日自动生成</div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={sEn} onChange={e=>setSEn(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-text-muted block mb-1.5">执行时间</label>
              <input type="time" value={sTime} onChange={e=>setSTime(e.target.value)}
                className="w-full bg-white border border-border-default text-text-primary text-center px-2 py-1.5 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-400"/>
            </div>
            <div className="flex items-center gap-3">
              <div><label className="text-xs text-text-muted block mb-1.5">自动报告</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={sRpt} onChange={e=>setSRpt(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
              <div><label className="text-xs text-text-muted block mb-1.5">自动推荐</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={sRec} onChange={e=>setSRec(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
            </div>
            <div className="flex items-end">
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
                <div className="text-text-muted mb-0.5">上次执行</div>
                <div className="font-medium">{sched.last_run_at ? `${sched.last_run_at}（${sched.last_run_info||'未知'}）` : '从未执行'}</div>
                {sched.last_run_result && <div className="text-text-muted mt-0.5 text-[11px]">{sched.last_run_result}</div>}
              </div>
              <div>
                <div className="text-text-muted mb-0.5">下次执行</div>
                <div className="font-medium">{sEn ? `每天 ${sTime}` : '已禁用'}</div>
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

function Msg({ msg }: { msg: {type:'success'|'error'; text: string} }) {
  return <div className={`rounded-xl px-3 py-2 text-xs font-medium ${msg.type==='success'?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-600'}`}>{msg.text}</div>
}

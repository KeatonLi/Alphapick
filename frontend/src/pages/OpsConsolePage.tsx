import { useEffect, useMemo, useState } from 'react'
import { opsApi } from '../services/opsApi'

type RunLog = {
  id: string
  time: string
  level: 'ok' | 'info' | 'warn' | 'error'
  message: string
}

const DEFAULT_START = '2026-05-01'
const DEFAULT_END = '2026-05-31'

function isWeekday(date: Date) {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

function formatDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function listDates(start: string, end: string) {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${end}T00:00:00`)
  const dates: string[] = []
  for (const cur = new Date(from); cur <= to; cur.setDate(cur.getDate() + 1)) {
    if (isWeekday(cur)) dates.push(formatDate(cur))
  }
  return dates
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  borderRadius: 16,
  padding: '12px 13px',
  fontFamily: 'JetBrains Mono, monospace',
  outline: 'none',
}

function TaskButton({ children, disabled, onClick, tone = 'primary' }: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  tone?: 'primary' | 'blue' | 'green'
}) {
  const bg = tone === 'green'
    ? 'linear-gradient(135deg, #16c78f, #20d6b0)'
    : tone === 'blue'
      ? 'linear-gradient(135deg, #4aa8ff, #6d74ff)'
      : 'linear-gradient(135deg, var(--accent), var(--blue))'
  return (
    <button disabled={disabled} onClick={onClick} className="qf-action-button" style={{ background: bg, width: '100%' }}>
      {children}
    </button>
  )
}

export default function OpsConsolePage() {
  const [startDate, setStartDate] = useState(DEFAULT_START)
  const [endDate, setEndDate] = useState(DEFAULT_END)
  const [singleDate, setSingleDate] = useState(DEFAULT_START)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<RunLog[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('16:00')
  const [scheduleReport, setScheduleReport] = useState(true)
  const [scheduleRecommend, setScheduleRecommend] = useState(true)
  const [scheduleUpdateReturns, setScheduleUpdateReturns] = useState(true)

  const plannedDates = useMemo(() => listDates(startDate, endDate), [startDate, endDate])

  const pushLog = (level: RunLog['level'], message: string) => {
    const now = new Date()
    setLogs(prev => [{
      id: `${now.getTime()}-${Math.random()}`,
      time: now.toLocaleTimeString(),
      level,
      message,
    }, ...prev].slice(0, 100))
  }

  const runStep = async (label: string, fn: () => Promise<unknown>) => {
    pushLog('info', `开始：${label}`)
    try {
      await fn()
      pushLog('ok', `完成：${label}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      pushLog('error', `失败：${label} / ${message}`)
      throw e
    }
  }

  const fetchDatasource = (date: string) =>
    runStep(`${date} 采集全量数据源`, () => opsApi.fetch(date))

  const generateRecommend = (date: string) =>
    runStep(`${date} 生成量化 Top 5`, () => opsApi.generatePicks(date))

  const updateReturns = () =>
    runStep('更新 1/2/3/5/7 日收益追踪', () => opsApi.updateReturns())

  useEffect(() => {
    opsApi.schedule()
      .then((res: any) => {
        if (!res.success) return
        setScheduleEnabled(Boolean(res.data?.enabled))
        setScheduleTime(res.data?.run_time || '16:00')
        setScheduleReport(Boolean(res.data?.run_report))
        setScheduleRecommend(Boolean(res.data?.run_recommend))
        setScheduleUpdateReturns(Boolean(res.data?.run_update_returns))
      })
      .catch(() => {})
  }, [])

  const runSingle = async (mode: 'fetch' | 'recommend' | 'returns') => {
    setRunning(true)
    try {
      if (mode === 'fetch') await fetchDatasource(singleDate)
      if (mode === 'recommend') await generateRecommend(singleDate)
      if (mode === 'returns') await updateReturns()
    } finally {
      setRunning(false)
    }
  }

  const runFullDaily = async () => {
    setRunning(true)
    try {
      await runStep(`${singleDate} 完整单日闭环`, () => opsApi.runDaily(singleDate))
    } finally {
      setRunning(false)
    }
  }

  const runRange = async () => {
    setRunning(true)
    try {
      await runStep(`${startDate} 至 ${endDate} 区间回测`, () => opsApi.backtest(startDate, endDate))
    } finally {
      setRunning(false)
    }
  }

  const saveSchedule = async () => {
    setRunning(true)
    try {
      await runStep('保存定时任务配置', () => opsApi.saveSchedule(scheduleEnabled, scheduleTime, scheduleReport, scheduleRecommend, scheduleUpdateReturns))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Mission Control</div>
          <h1 className="qf-title">策略数据控制台</h1>
          <p className="qf-subtitle">把数据采集、Top 5 生成、收益追踪放在同一块操作板里。先单日验证，再跑五月区间，日志会实时记录每一步。</p>
        </div>
        <div className="card" style={{ padding: '12px 16px', minWidth: 190 }}>
          <div className="qf-stat-label">当前任务状态</div>
          <div className="mono" style={{ marginTop: 6, color: running ? 'var(--gold)' : 'var(--down)', fontWeight: 900 }}>{running ? 'RUNNING' : 'READY'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 18, alignItems: 'start' }}>
        <section className="card" style={{ padding: 20 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div className="qf-eyebrow">Single Day</div>
              <h2 style={{ margin: '8px 0 4px', fontSize: 20, color: 'var(--text-primary)' }}>单日试跑</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>适合先验证某一天数据是否完整、策略是否能出结果。</p>
            </div>

            <label style={{ display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
              目标日期
              <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} style={inputStyle} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TaskButton disabled={running} onClick={() => runSingle('fetch')}>采集数据</TaskButton>
              <TaskButton disabled={running} onClick={() => runSingle('recommend')} tone="blue">生成推荐</TaskButton>
            </div>
            <TaskButton disabled={running} onClick={() => runSingle('returns')} tone="green">更新收益追踪</TaskButton>
            <TaskButton disabled={running} onClick={runFullDaily} tone="green">运行完整单日闭环</TaskButton>
          </div>

          <div style={{ height: 1, background: 'var(--border-default)', margin: '24px 0' }} />

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div className="qf-eyebrow">Backtest Batch</div>
              <h2 style={{ margin: '8px 0 4px', fontSize: 20, color: 'var(--text-primary)' }}>五月区间回放</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>默认 2026 年 5 月工作日，适合快速验证策略历史表现。</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
                开始
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
                结束
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
              </label>
            </div>

            <div className="qf-stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="qf-stat"><div className="qf-stat-label">计划交易日</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{plannedDates.length}</div></div>
              <div className="qf-stat"><div className="qf-stat-label">预计输出</div><div className="qf-stat-value" style={{ color: 'var(--gold)' }}>{plannedDates.length * 5}</div></div>
            </div>

            <TaskButton disabled={running || plannedDates.length === 0} onClick={runRange}>
              {running ? '任务运行中...' : '后端区间回测'}
            </TaskButton>
          </div>

          <div style={{ height: 1, background: 'var(--border-default)', margin: '24px 0' }} />

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div className="qf-eyebrow">Scheduler</div>
              <h2 style={{ margin: '8px 0 4px', fontSize: 20, color: 'var(--text-primary)' }}>定时任务</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>控制每日自动采集、自动生成报告和自动生成推荐。</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
              <input type="checkbox" checked={scheduleEnabled} onChange={e => setScheduleEnabled(e.target.checked)} />
              启用定时任务
            </label>

            <label style={{ display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
              每日运行时间
              <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={inputStyle} />
            </label>

            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
                <input type="checkbox" checked={scheduleReport} onChange={e => setScheduleReport(e.target.checked)} />
                自动生成市场报告
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
                <input type="checkbox" checked={scheduleRecommend} onChange={e => setScheduleRecommend(e.target.checked)} />
                自动生成量化推荐
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
                <input type="checkbox" checked={scheduleUpdateReturns} onChange={e => setScheduleUpdateReturns(e.target.checked)} />
                自动更新收益跟踪
              </label>
            </div>

            <TaskButton disabled={running} onClick={saveSchedule}>保存定时配置</TaskButton>
          </div>
        </section>

        <section className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="qf-eyebrow">Execution Log</div>
              <h2 style={{ margin: '7px 0 0', fontSize: 20, color: 'var(--text-primary)' }}>运行日志</h2>
            </div>
            <button onClick={() => setLogs([])} className="qf-ghost-button" style={{ width: 'auto', marginTop: 0 }}>清空</button>
          </div>

          <div style={{ minHeight: 530, maxHeight: 660, overflow: 'auto', padding: 18, background: 'rgba(0,0,0,.20)' }}>
            {logs.length === 0 ? (
              <div style={{ height: 490, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div>
                  <div style={{ fontSize: 40, color: 'var(--accent-light)', marginBottom: 12 }}>⌁</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>等待任务</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>点击左侧按钮后，接口执行顺序和错误会出现在这里。</div>
                </div>
              </div>
            ) : logs.map(log => {
              const color = log.level === 'ok' ? 'var(--down)' : log.level === 'error' ? 'var(--up)' : log.level === 'warn' ? 'var(--gold)' : 'var(--accent-light)'
              return (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '86px 72px 1fr', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border-default)' }}>
                  <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 12 }}>{log.time}</span>
                  <span className="mono" style={{ color, fontSize: 12, textTransform: 'uppercase', fontWeight: 900 }}>{log.level}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{log.message}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

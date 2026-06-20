import { useEffect, useMemo, useState } from 'react'
import { opsApi } from '../services/opsApi'

type LogLevel = 'ok' | 'info' | 'error'
type RunLog = { id: string; time: string; level: LogLevel; message: string }

function todayInput() {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function weekdays(start: string, end: string) {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${end}T00:00:00`)
  let count = 0
  for (const cur = new Date(from); cur <= to; cur.setDate(cur.getDate() + 1)) {
    const day = cur.getDay()
    if (day >= 1 && day <= 5) count += 1
  }
  return count
}

export default function OpsConsolePage() {
  const [singleDate, setSingleDate] = useState(todayInput())
  const [startDate, setStartDate] = useState('2026-05-01')
  const [endDate, setEndDate] = useState('2026-05-31')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('16:00')
  const [scheduleRecommend, setScheduleRecommend] = useState(true)
  const [scheduleUpdateReturns, setScheduleUpdateReturns] = useState(true)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<RunLog[]>([])

  const weekdayCount = useMemo(() => weekdays(startDate, endDate), [startDate, endDate])

  useEffect(() => {
    opsApi.schedule()
      .then((res: any) => {
        if (!res.success) return
        setScheduleEnabled(Boolean(res.data?.enabled))
        setScheduleTime(res.data?.run_time || '16:00')
        setScheduleRecommend(Boolean(res.data?.run_recommend))
        setScheduleUpdateReturns(Boolean(res.data?.run_update_returns))
      })
      .catch(() => {})
  }, [])

  const pushLog = (level: LogLevel, message: string) => {
    const now = new Date()
    setLogs(prev => [{
      id: `${now.getTime()}-${Math.random()}`,
      time: now.toLocaleTimeString(),
      level,
      message,
    }, ...prev].slice(0, 80))
  }

  const runTask = async (label: string, fn: () => Promise<unknown>) => {
    setRunning(true)
    pushLog('info', `开始：${label}`)
    try {
      await fn()
      pushLog('ok', `完成：${label}`)
    } catch (err) {
      pushLog('error', `失败：${label} / ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="qv4-page">
      <section className="qv4-hero compact">
        <div className="qv4-hero-main">
          <div className="qv4-kicker">Admin Console</div>
          <h1>管理后台</h1>
          <p>管理员在这里控制三条主线：每日推荐任务、收益跟踪更新、定时任务配置。普通用户不会看到这个入口。</p>
        </div>
        <div className="qv4-date-card">
          <span>运行状态</span>
          <strong>{running ? 'Running' : 'Ready'}</strong>
          <small>{scheduleEnabled ? `调度已启用 ${scheduleTime}` : '调度未启用'}</small>
        </div>
      </section>

      <div className="qv4-console-grid">
        <section className="qv4-panel">
          <header className="qv4-panel-head">
            <div><span>Daily Loop</span><h2>单日闭环</h2></div>
          </header>
          <div className="qv4-form">
            <label>目标日期<input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} /></label>
            <div className="qv4-form-grid">
              <button disabled={running} onClick={() => runTask(`${singleDate} 采集数据`, () => opsApi.fetch(singleDate))}>采集数据</button>
              <button disabled={running} onClick={() => runTask(`${singleDate} 生成推荐`, () => opsApi.generatePicks(singleDate))}>生成推荐</button>
            </div>
            <button disabled={running} onClick={() => runTask('更新收益跟踪', () => opsApi.updateReturns())}>更新收益跟踪</button>
            <button className="primary" disabled={running} onClick={() => runTask(`${singleDate} 完整闭环`, () => opsApi.runDaily(singleDate))}>运行完整闭环</button>
          </div>
        </section>

        <section className="qv4-panel">
          <header className="qv4-panel-head">
            <div><span>Backtest</span><h2>区间回放</h2></div>
          </header>
          <div className="qv4-form">
            <div className="qv4-form-grid">
              <label>开始日期<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
              <label>结束日期<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
            </div>
            <div className="qv4-mini-stats">
              <div><span>交易日</span><strong>{weekdayCount}</strong></div>
              <div><span>预计推荐</span><strong>{weekdayCount * 5}</strong></div>
            </div>
            <button className="primary" disabled={running || weekdayCount === 0} onClick={() => runTask(`${startDate} 至 ${endDate} 区间回放`, () => opsApi.backtest(startDate, endDate))}>运行区间回放</button>
          </div>
        </section>

        <section className="qv4-panel">
          <header className="qv4-panel-head">
            <div><span>Scheduler</span><h2>定时任务</h2></div>
          </header>
          <div className="qv4-form">
            <label className="qv4-check"><input type="checkbox" checked={scheduleEnabled} onChange={e => setScheduleEnabled(e.target.checked)} />启用定时任务</label>
            <label>运行时间<input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} /></label>
            <label className="qv4-check"><input type="checkbox" checked={scheduleRecommend} onChange={e => setScheduleRecommend(e.target.checked)} />自动生成每日推荐</label>
            <label className="qv4-check"><input type="checkbox" checked={scheduleUpdateReturns} onChange={e => setScheduleUpdateReturns(e.target.checked)} />自动更新收益跟踪</label>
            <button className="primary" disabled={running} onClick={() => runTask('保存定时任务配置', () => opsApi.saveSchedule(scheduleEnabled, scheduleTime, false, scheduleRecommend, scheduleUpdateReturns))}>保存配置</button>
          </div>
        </section>

        <section className="qv4-panel qv4-log-panel">
          <header className="qv4-panel-head">
            <div><span>Execution Log</span><h2>运行日志</h2></div>
            <button className="qv4-secondary" onClick={() => setLogs([])}>清空</button>
          </header>
          <div className="qv4-log-list">
            {logs.length ? logs.map(log => (
              <div className="qv4-log-row" key={log.id}>
                <span>{log.time}</span>
                <b className={log.level}>{log.level}</b>
                <p>{log.message}</p>
              </div>
            )) : <div className="qv4-empty">还没有任务日志。点击左侧操作后，执行结果会显示在这里。</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

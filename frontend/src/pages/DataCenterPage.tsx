import { useEffect, useMemo, useState } from 'react'
import type { DatasourceStatusItem, FetchLogEntry } from '../services/api'
import { dataApi } from '../services/dataApi'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fmtMs(ms?: number | null) {
  if (!ms) return '--'
  return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function statusColor(status?: string | null) {
  if (status === 'success' || status === 'skipped') return 'var(--down)'
  if (status === 'failed') return 'var(--up)'
  if (status === 'running') return 'var(--gold)'
  return 'var(--text-muted)'
}

export default function DataCenterPage() {
  const [date, setDate] = useState(today())
  const [status, setStatus] = useState<DatasourceStatusItem[]>([])
  const [logs, setLogs] = useState<FetchLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        dataApi.status(date),
        dataApi.logs(1),
      ])
      if (s.success) setStatus(s.data || [])
      if (l.success) setLogs(l.data?.logs || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [date])

  const health = useMemo(() => {
    if (!status.length) return { ready: 0, total: 0, score: 0 }
    const ready = status.filter(item => item.has_data && item.status !== 'failed').length
    return { ready, total: status.length, score: Math.round(ready / status.length * 100) }
  }, [status])

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    setMessage('')
    try {
      await fn()
      setMessage(`${label}完成`)
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Data Center</div>
          <h1 className="qf-title">数据中台</h1>
          <p className="qf-subtitle">这里专门回答一个问题：策略今天能不能放心读库生成。外部行情只在采集任务里使用，选股和复盘都只读数据库。</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 14, padding: '11px 12px' }} />
          <button onClick={load} disabled={loading} className="qf-ghost-button" style={{ width: 'auto', marginTop: 0 }}>刷新</button>
        </div>
      </div>

      <section className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="qf-stat-grid">
          <div className="qf-stat"><div className="qf-stat-label">数据健康分</div><div className="qf-stat-value" style={{ color: health.score >= 80 ? 'var(--down)' : 'var(--gold)' }}>{health.score}%</div></div>
          <div className="qf-stat"><div className="qf-stat-label">已就绪数据源</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{health.ready}/{health.total}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">目标日期</div><div className="qf-stat-value mono" style={{ fontSize: 22 }}>{date}</div></div>
          <div className="qf-stat"><div className="qf-stat-label">最近日志</div><div className="qf-stat-value" style={{ color: 'var(--text-primary)' }}>{logs.length}</div></div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 18, alignItems: 'start' }}>
        <section className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="qf-eyebrow">Datasource Readiness</div>
              <h2 style={{ margin: '6px 0 0', color: 'var(--text-primary)', fontSize: 20 }}>落库状态</h2>
            </div>
            <button disabled={!!busy} onClick={() => run('全部补拉', () => dataApi.fetchAll(date))}
              className="qf-action-button" style={{ width: 'auto' }}>{busy === '全部补拉' ? '执行中...' : '全部补拉'}</button>
          </div>

          <div style={{ display: 'grid' }}>
            {status.map(item => (
              <div key={item.data_type} style={{ display: 'grid', gridTemplateColumns: '1.2fr .7fr .7fr .8fr .7fr .7fr auto', gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{item.label}</div>
                  <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{item.data_type}</div>
                  {item.quality_message && <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>{item.quality_message}</div>}
                </div>
                <div style={{ color: statusColor(item.status), fontWeight: 800 }}>{item.status || 'never'}</div>
                <div style={{ color: item.has_data ? 'var(--down)' : 'var(--text-muted)' }}>{item.has_data ? '已落库' : '缺失'}</div>
                <div style={{ color: statusColor(item.quality_status), fontWeight: 800 }}>{item.quality_status || '未检查'}</div>
                <div className="mono" style={{ color: 'var(--text-muted)' }}>{item.quality_count ?? '--'}</div>
                <div className="mono" style={{ color: 'var(--text-muted)' }}>{fmtMs(item.duration_ms)}</div>
                <button disabled={!!busy} onClick={() => run(`补拉 ${item.data_type}`, () => dataApi.fetch(item.data_type, date))}
                  className="qf-ghost-button" style={{ width: 'auto', marginTop: 0 }}>补拉</button>
              </div>
            ))}
          </div>
        </section>

        <aside style={{ display: 'grid', gap: 18 }}>
          <section className="card" style={{ padding: 20 }}>
            <div className="qf-eyebrow">Operations</div>
            <h2 style={{ margin: '8px 0 14px', color: 'var(--text-primary)', fontSize: 20 }}>数据操作</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <button disabled={!!busy} onClick={() => run('清空当日数据', () => dataApi.deleteAllRecords(date))}
                className="qf-ghost-button" style={{ borderColor: 'rgba(255,90,107,.45)', color: 'var(--up)' }}>清空当日数据</button>
              {message && <div style={{ color: message.includes('完成') ? 'var(--down)' : 'var(--up)', fontSize: 12 }}>{message}</div>}
            </div>
          </section>

          <section className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
              <div className="qf-eyebrow">Fetch Logs</div>
              <h2 style={{ margin: '6px 0 0', color: 'var(--text-primary)', fontSize: 18 }}>最近采集日志</h2>
            </div>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              {logs.map(log => (
                <div key={log.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-default)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{log.label}</strong>
                    <span style={{ color: statusColor(log.status), fontSize: 12 }}>{log.status}</span>
                  </div>
                  <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 5 }}>{log.target_date} · {fmtMs(log.duration_ms)}</div>
                  {log.error_message && <div style={{ color: 'var(--up)', fontSize: 12, marginTop: 6 }}>{log.error_message}</div>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

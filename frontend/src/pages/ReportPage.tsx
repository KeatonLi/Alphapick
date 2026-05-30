import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface IndexData { name: string; code: string; close: number; change_pct: number }
interface SectorData { name: string; change_pct: number; leading_stock: string; driver?: string }
interface HsgtFlow {
  date: string; sh_net_buy: number; sh_total_inflow: number; sh_cumulative: number
  sz_net_buy: number; sz_total_inflow: number; sz_cumulative: number; total_net_buy: number
}
interface SectorFull extends SectorData {
  total_volume?: number; total_amount?: number; net_inflow?: number
  up_count?: number; down_count?: number
}
interface ReportData {
  date: string; market_summary: string; index_data: IndexData[]
  hot_sectors: SectorData[]; sectors_full: SectorFull[]; hsgt_flow: HsgtFlow | null; ai_report: string
}

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }
function fmtNum(n: number) { return n >= 1e8 ? `${(n/1e8).toFixed(1)}亿` : n >= 1e4 ? `${(n/1e4).toFixed(0)}万` : `${n}` }

export default function ReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [tradeDates, setTradeDates] = useState<string[]>([])
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiGet<any>('/report/trade-dates?days=365')
      .then(d => { if (d.success) setTradeDates(d.data || []) }).catch(() => {})
  }, [])

  const load = async (d: string) => {
    setLoading(true)
    try { const r = await apiGet<any>(`/report/daily?date=${d}`); setReport(r.success ? r.data : null) }
    catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (date) load(date) }, [date])

  const dateIdx = tradeDates.indexOf(date)
  const canPrev = dateIdx > 0; const canNext = dateIdx >= 0 && dateIdx < tradeDates.length - 1

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 10,
    border: '1px solid var(--border-default)', background: 'var(--bg-card)',
    color: active ? 'var(--text-secondary)' : 'var(--text-dim)',
    cursor: active ? 'pointer' : 'default', opacity: active ? 1 : 0.4,
    transition: 'all .2s',
  })

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 20px 60px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text-primary)', margin: '0 0 6px' }}>
          每日<span style={{ color: 'var(--accent)' }}>市场报告</span>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>三大指数 · 热门板块 · AI 市场分析</p>
      </div>

      {/* Date Picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
        <button onClick={() => setDate(tradeDates[dateIdx + 1])} disabled={!canNext} style={btnStyle(canNext)}>
          <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="nav-pills">
          {tradeDates.slice(0, 7).map(d => (
            <a key={d} href="#" onClick={e => { e.preventDefault(); setDate(d) }}
              className={d === date ? 'active' : ''}>{d.slice(5)}</a>
          ))}
        </div>
        <button onClick={() => setDate(tradeDates[dateIdx - 1])} disabled={!canPrev} style={btnStyle(canPrev)}>
          <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 10, padding: '8px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, outline: 'none', width: 136 }} />
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>{[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 140 }} />)}</div>
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      )}

      {/* Empty */}
      {!loading && !report && (
        <div className="card" style={{ padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 16, opacity: .5 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>暂无市场报告</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>请前往「设置」页面生成报告</div>
        </div>
      )}

      {/* Report Content */}
      {!loading && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 指数卡片 */}
          {report.index_data?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {report.index_data.map(idx => {
                const up = idx.change_pct >= 0
                return (
                  <div key={idx.code} className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12 }}>{idx.name}</div>
                    <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.1 }}>
                      {typeof idx.close === 'number' ? fmt(idx.close) : idx.close}
                    </div>
                    <span className={`badge ${up ? 'badge-up' : 'badge-down'}`} style={{ fontSize: 13, padding: '4px 12px' }}>
                      {fmtRate(idx.change_pct)}
                    </span>
                    <div style={{ width: '100%', height: 4, background: 'var(--bg-tag)', borderRadius: 2, overflow: 'hidden', marginTop: 12 }}>
                      <div style={{ width: `${Math.min(Math.abs(idx.change_pct) * 3, 100)}%`, height: '100%', borderRadius: 2, background: up ? 'var(--up)' : 'var(--down)', marginLeft: up ? 0 : 'auto', transition: 'width .6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 市场概述 */}
          {report.market_summary && (
            <div style={{ textAlign: 'center' }}>
              <span className="badge" style={{ background: 'var(--accent-bg)', color: 'var(--accent-light)', fontSize: 13, padding: '6px 16px' }}>{report.market_summary}</span>
            </div>
          )}

          {/* 北向资金 */}
          {report.hsgt_flow && (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 20 }}>北向资金 · 沪深港通</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: report.hsgt_flow.total_net_buy >= 0 ? 'var(--up)' : 'var(--down)', marginBottom: 4 }}>
                    {(report.hsgt_flow?.total_net_buy ?? 0) > 0 ? '+' : ''}{(report.hsgt_flow?.total_net_buy ?? 0).toFixed(1)}亿
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>今日净买入</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {(((report.hsgt_flow?.sh_cumulative ?? 0) + (report.hsgt_flow?.sz_cumulative ?? 0)) / 1e4).toFixed(1)}万亿
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>累计净买入</div>
                </div>
              </div>
              {(['sh', 'sz'] as const).map(k => {
                const label = k === 'sh' ? '沪股通' : '深股通'
                const net = (report.hsgt_flow as any)?.[`${k}_net_buy`] ?? 0
                const total = (report.hsgt_flow as any)?.[`${k}_total_inflow`] ?? 0
                return (
                  <div key={k} style={{ marginBottom: k === 'sh' ? 16 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: net >= 0 ? 'var(--up)' : 'var(--down)' }}>
                        {net > 0 ? '+' : ''}{net.toFixed(1)}亿 / {fmtNum(total)}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-tag)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(Math.abs(net) / Math.max(total, 1) * 100, 100)}%`, height: '100%', borderRadius: 3, background: net >= 0 ? 'var(--up)' : 'var(--down)', transition: 'width .6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 热门板块 */}
          {report.hot_sectors?.length > 0 && (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>热门板块</div>
              {report.hot_sectors.map((s, i) => (
                <div key={i} className="row-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', width: 24, flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span>
                    {s.leading_stock && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>领涨 {s.leading_stock}</span>}
                  </div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: s.change_pct >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(s.change_pct)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 行业全景 */}
          {report.sectors_full?.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px 16px' }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>行业全景 · {report.sectors_full.length} 个板块</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                      {['#', '板块', '涨跌幅', '净流入', '涨/跌', '领涨股'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 11, textAlign: h === '板块' || h === '领涨股' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.sectors_full.map((s, i) => {
                      const up = s.change_pct >= 0
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</td>
                          <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: up ? 'var(--up)' : 'var(--down)' }}>{fmtRate(s.change_pct)}</td>
                          <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>{s.net_inflow != null ? s.net_inflow.toFixed(1) : '—'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>{s.up_count != null ? `${s.up_count}/${s.down_count}` : '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.leading_stock || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI 分析 */}
          {report.ai_report && (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>AI 市场分析</div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14, whiteSpace: 'pre-wrap' }}>{report.ai_report}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

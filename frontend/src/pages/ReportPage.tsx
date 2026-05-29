import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface IndexData { name: string; code: string; close: number; change_pct: number }
interface SectorData { name: string; change_pct: number; leading_stock: string; driver?: string }

interface HsgtFlow {
  date: string
  sh_net_buy: number
  sh_total_inflow: number
  sh_cumulative: number
  sz_net_buy: number
  sz_total_inflow: number
  sz_cumulative: number
  total_net_buy: number
}

interface SectorFull extends SectorData {
  total_volume?: number
  total_amount?: number
  net_inflow?: number
  up_count?: number
  down_count?: number
}

interface ReportData {
  date: string
  market_summary: string
  index_data: IndexData[]
  hot_sectors: SectorData[]
  sectors_full: SectorFull[]
  hsgt_flow: HsgtFlow | null
  ai_report: string
}

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }

function SparkBar({ value }: { value: number }) {
  const w = Math.min(Math.abs(value) * 3, 100)
  const up = value >= 0
  return (
    <div style={{ width: '100%', height: 4, background: 'var(--bg-tag)', borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
      <div style={{ width: `${w}%`, height: '100%', borderRadius: 2, background: up ? 'var(--up)' : 'var(--down)', marginLeft: up ? 0 : `${100 - w}%` }} />
    </div>
  )
}

export default function ReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [tradeDates, setTradeDates] = useState<string[]>([])
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiGet<any>('/report/trade-dates?days=365')
      .then(d => { if (d.success) setTradeDates(d.data || []) })
      .catch(() => {})
  }, [])

  const loadReport = async (d: string) => {
    setLoading(true)
    try {
      const r = await apiGet<any>(`/report/daily?date=${d}`)
      setReport(r.success ? r.data : null)
    } catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (selectedDate) loadReport(selectedDate) }, [selectedDate])

  const dateIdx = tradeDates.indexOf(selectedDate)
  const canPrev = dateIdx > 0
  const canNext = dateIdx >= 0 && dateIdx < tradeDates.length - 1
  const pillDates = tradeDates.slice(0, 5)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
      <div className="text-center mb-6">
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, letterSpacing: '-.03em', color: 'var(--text-primary)' }}>
          每日市场报告
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>三大指数 · 热门板块 · AI 市场分析</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedDate(tradeDates[dateIdx + 1])} disabled={!canNext}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: canNext ? 'var(--text-secondary)' : 'var(--text-dim)', cursor: canNext ? 'pointer' : 'default', display: 'flex', alignItems: 'center', transition: 'all .2s' }}>
          <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="nav-pills">
          {pillDates.map(d => (
            <a key={d} href="#" onClick={e => { e.preventDefault(); setSelectedDate(d) }}
              className={d === selectedDate ? 'active' : ''}>{d.slice(5)}</a>
          ))}
        </div>
        <button onClick={() => setSelectedDate(tradeDates[dateIdx - 1])} disabled={!canPrev}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: canPrev ? 'var(--text-secondary)' : 'var(--text-dim)', cursor: canPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', transition: 'all .2s' }}>
          <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            max={today}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 8, padding: '5px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, outline: 'none', width: 130 }} />
          <button onClick={() => loadReport(selectedDate)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}>
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 130 }} />)}
          </div>
          <div className="skeleton" style={{ height: 200 }} />
          <div className="skeleton" style={{ height: 180 }} />
        </div>
      )}

      {!loading && !report && (
        <div style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 80 }}>
          <div style={{ fontSize: 48, opacity: 0.6, marginBottom: 16, lineHeight: 1 }}>📋</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>暂无市场报告</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>请前往「一键生成」页面生成报告</div>
        </div>
      )}

      {!loading && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {report.index_data?.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>主要指数</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {report.index_data.map(idx => {
                  const up = idx.change_pct >= 0
                  return (
                    <div key={idx.code} className="card" style={{ padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>{idx.name}</div>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                        {typeof idx.close === 'number' ? fmt(idx.close) : idx.close}
                      </div>
                      <span className={`badge ${up ? 'badge-up' : 'badge-down'}`} style={{ fontSize: 12 }}>
                        {fmtRate(idx.change_pct)}
                      </span>
                      <SparkBar value={idx.change_pct} />
                    </div>
                  )
                })}
              </div>
              {report.market_summary && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <span className="badge" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{report.market_summary}</span>
                </div>
              )}
            </div>
          )}

          {report.hsgt_flow && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>北向资金（沪深港通）</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>今日净买入</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: report.hsgt_flow.total_net_buy >= 0 ? 'var(--up)' : 'var(--down)' }}>
                    {report.hsgt_flow.total_net_buy > 0 ? '+' : ''}{report.hsgt_flow.total_net_buy.toFixed(1)}亿
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>累计净买入</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {(report.hsgt_flow.sh_cumulative + report.hsgt_flow.sz_cumulative).toFixed(0)}亿
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>沪股通</span>
                    <span className="mono" style={{ fontSize: 11, color: report.hsgt_flow.sh_net_buy >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 600 }}>
                      {report.hsgt_flow.sh_net_buy > 0 ? '+' : ''}{report.hsgt_flow.sh_net_buy.toFixed(1)}亿
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-tag)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(Math.abs(report.hsgt_flow.sh_net_buy) / Math.max(report.hsgt_flow.sh_total_inflow, 1) * 100, 100)}%`, height: '100%', borderRadius: 3, background: report.hsgt_flow.sh_net_buy >= 0 ? 'var(--up)' : 'var(--down)' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>总流入 {report.hsgt_flow.sh_total_inflow.toFixed(0)}亿</div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>深股通</span>
                    <span className="mono" style={{ fontSize: 11, color: report.hsgt_flow.sz_net_buy >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 600 }}>
                      {report.hsgt_flow.sz_net_buy > 0 ? '+' : ''}{report.hsgt_flow.sz_net_buy.toFixed(1)}亿
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-tag)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(Math.abs(report.hsgt_flow.sz_net_buy) / Math.max(report.hsgt_flow.sz_total_inflow, 1) * 100, 100)}%`, height: '100%', borderRadius: 3, background: report.hsgt_flow.sz_net_buy >= 0 ? 'var(--up)' : 'var(--down)' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>总流入 {report.hsgt_flow.sz_total_inflow.toFixed(0)}亿</div>
                </div>
              </div>
            </div>
          )}

          {report.hot_sectors?.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>热门板块</span>
              </div>
              {report.hot_sectors.map((s, i) => {
                const up = s.change_pct >= 0
                return (
                  <div key={i} className="row-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', width: 20, flexShrink: 0 }}>{i + 1}</span>
                      <span className="rn" style={{ fontSize: 13 }}>{s.name}</span>
                      {s.leading_stock && <span className="hidden sm:inline truncate" style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 120 }}>领涨 {s.leading_stock}</span>}
                    </div>
                    <span className="mono rv" style={{ color: up ? 'var(--up)' : 'var(--down)' }}>{fmtRate(s.change_pct)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {report.sectors_full?.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>行业全景（{report.sectors_full.length} 个行业板块）</span>
              </div>
              <div style={{ overflowX: 'auto', marginLeft: -8, marginRight: -8 }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>排名</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>板块</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>涨跌幅</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }} className="hidden sm:table-cell">净流入(亿)</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }} className="hidden sm:table-cell">上涨/下跌</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }} className="hidden md:table-cell">领涨股</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sectors_full.map((s, i) => {
                      const up = s.change_pct >= 0
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <td className="mono" style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</td>
                          <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: up ? 'var(--up)' : 'var(--down)' }}>
                            {fmtRate(s.change_pct)}
                          </td>
                          <td className="mono hidden sm:table-cell" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {s.net_inflow != null ? s.net_inflow.toFixed(1) : '-'}
                          </td>
                          <td className="hidden sm:table-cell" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {s.up_count != null ? `${s.up_count}/${s.down_count}` : '-'}
                          </td>
                          <td className="hidden md:table-cell" style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 112, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.leading_stock || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.ai_report && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>AI 市场分析</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: 13 }}>{report.ai_report}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

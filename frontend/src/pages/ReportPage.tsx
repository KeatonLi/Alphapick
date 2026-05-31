import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'

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
interface LimitUpStock {
  code: string; name: string; price: number; change_pct: number
  turnover_rate: number; sealed_amount: number; first_seal_time: string
  last_seal_time: string; open_count: number; board_type: string
  consecutive_days: number; industry: string; market_type: string
}
interface ReportData {
  date: string; market_summary: string; index_data: IndexData[]
  hot_sectors: SectorData[]; sectors_full: SectorFull[]; hsgt_flow: HsgtFlow | null; ai_report: string
  today_limit_up: LimitUpStock[]; yesterday_limit_ups: string[]
  yesterday_limit_ups_performance: number | null
}

function fmt(n: number, d = 2) { return n.toFixed(d) }
function fmtRate(n: number) { return (n >= 0 ? '+' : '') + fmt(n) + '%' }
function fmtNum(n: number) { return n >= 1e8 ? `${(n/1e8).toFixed(1)}亿` : n >= 1e4 ? `${(n/1e4).toFixed(0)}万` : `${n}` }

export default function ReportPage() {
  const tradeDates = useTradeDates()
  const [date, setDate] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tradeDates.length > 0 && !date) setDate(tradeDates[0])
  }, [tradeDates])

  const load = async (d: string) => {
    setLoading(true)
    try { const r = await apiGet<any>(`/report/daily?date=${d}`); setReport(r.success ? r.data : null) }
    catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (date) load(date) }, [date])

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
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
        <TradeDatePicker value={date} onChange={setDate} tradeDates={tradeDates} />
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

          {/* 涨停板分析 */}
          {report.today_limit_up?.length > 0 && (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 20 }}>
                涨停板分析 · {report.today_limit_up.length} 只主板涨停
              </div>

              {/* 关键指标 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: '一字板', value: report.today_limit_up.filter(s => s.board_type === '一字板').length, color: 'var(--accent)' },
                  { label: '换手板', value: report.today_limit_up.filter(s => s.board_type === '换手板').length, color: 'var(--up)' },
                  { label: '连板≥2', value: report.today_limit_up.filter(s => s.consecutive_days >= 2).length, color: 'var(--accent-light)' },
                  { label: '昨日涨停今表现', value: report.yesterday_limit_ups_performance != null ? `${report.yesterday_limit_ups_performance > 0 ? '+' : ''}${report.yesterday_limit_ups_performance}%` : '—', color: (report.yesterday_limit_ups_performance ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' },
                ].map(k => (
                  <div key={k.label} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border-default)' }}>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: k.color, marginBottom: 4 }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* 连板龙头 */}
              {report.today_limit_up.filter(s => s.consecutive_days >= 2).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>连板龙头</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {report.today_limit_up
                      .filter(s => s.consecutive_days >= 2)
                      .sort((a, b) => b.consecutive_days - a.consecutive_days)
                      .map(s => (
                        <div key={s.code} style={{
                          padding: '8px 14px', borderRadius: 10,
                          background: s.consecutive_days >= 3 ? 'rgba(251,191,36,0.12)' : 'var(--bg-elevated)',
                          border: `1px solid ${s.consecutive_days >= 3 ? 'rgba(251,191,36,0.35)' : 'var(--border-default)'}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                            {s.consecutive_days}连板 {s.board_type}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 涨停股列表 */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                      {['代码', '名称', '连板', '类型', '封单(万)', '换手', '首封', '开板', '行业'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text-muted)', fontSize: 10, textAlign: h === '名称' || h === '行业' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.today_limit_up.map(s => (
                      <tr key={s.code} style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>{s.code}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{s.name}</td>
                        <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: s.consecutive_days >= 2 ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 12 }}>
                          {s.consecutive_days >= 2 ? `${s.consecutive_days}板` : '首板'}
                        </td>
                        <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: s.board_type === '一字板' ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 11 }}>
                          {s.board_type}
                        </td>
                        <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--text-primary)', fontSize: 12 }}>
                          {s.sealed_amount > 0 ? (s.sealed_amount >= 10000 ? `${(s.sealed_amount/10000).toFixed(1)}亿` : `${s.sealed_amount.toFixed(0)}`) : '—'}
                        </td>
                        <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: 11 }}>
                          {s.turnover_rate > 0 ? `${s.turnover_rate.toFixed(1)}%` : '—'}
                        </td>
                        <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: 11 }}>
                          {s.first_seal_time || '—'}
                        </td>
                        <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: s.open_count > 0 ? 'var(--down)' : 'var(--text-muted)', fontSize: 11 }}>
                          {s.open_count > 0 ? s.open_count : '0'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.industry || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

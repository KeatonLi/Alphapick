import { useState, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { stockDailyApi } from '../services/api'
import type { StockDailyRow } from '../services/api'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
)

const DAY_PRESETS = [30, 60, 90, 180]

export default function StockDailyPage() {
  const [code, setCode] = useState('')
  const [days, setDays] = useState(60)
  const [data, setData] = useState<StockDailyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stockName, setStockName] = useState('')

  const loadData = useCallback(async () => {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await stockDailyApi.getDaily(code.trim(), days)
      if (res.success) {
        setData(res.data)
        setStockName(code.trim())
      } else {
        setError(res.error || '获取数据失败')
        setData([])
      }
    } catch (e: any) {
      setError(e.message || '请求失败')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [code, days])

  useEffect(() => {
    if (code.trim()) loadData()
  }, [days])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') loadData()
  }

  // 计算指标
  const latest = data.length > 0 ? data[data.length - 1] : null
  const prev = data.length > 1 ? data[data.length - 2] : null
  const periodHigh = data.length > 0 ? Math.max(...data.map(d => d.high)) : 0
  const periodLow = data.length > 0 ? Math.min(...data.map(d => d.low)) : 0
  const avgVol = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.volume, 0) / data.length) : 0
  const upDays = data.filter(d => d.change_pct > 0).length
  const downDays = data.filter(d => d.change_pct < 0).length

  // 价格折线图
  const priceChartData = {
    labels: data.map(d => d.date.slice(5)),
    datasets: [
      {
        label: '收盘价',
        data: data.map(d => d.close),
        borderColor: 'var(--accent)',
        backgroundColor: 'rgba(129, 140, 248, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  }

  // 成交量柱状图
  const volumeChartData = {
    labels: data.map(d => d.date.slice(5)),
    datasets: [
      {
        label: '成交量',
        data: data.map(d => d.volume),
        backgroundColor: data.map(d =>
          d.change_pct >= 0 ? 'rgba(248, 113, 113, 0.5)' : 'rgba(52, 211, 153, 0.5)'
        ),
        borderRadius: 2,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30,30,40,0.95)',
        titleColor: '#f5f5f7',
        bodyColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        display: true,
        ticks: { color: 'var(--text-muted)', font: { size: 10 }, maxTicksLimit: 10 },
        grid: { display: false },
      },
      y: {
        display: true,
        ticks: { color: 'var(--text-muted)', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
    },
  }

  const fmtVol = (v: number) => {
    if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
    if (v >= 1e4) return `${(v / 1e4).toFixed(0)}万`
    return `${v}`
  }

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* 页面标题 + 搜索 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          个股<span style={{ color: 'var(--accent)' }}>日线</span>
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入股票代码 如 600519"
            style={{
              width: 200, padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-input, rgba(255,255,255,0.06))',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none',
            }}
          />
          <button onClick={loadData} disabled={loading}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '加载中...' : '查询'}
          </button>
        </div>
        {/* 日期预设 */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {DAY_PRESETS.map(n => (
            <button key={n} onClick={() => setDays(n)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)',
                background: days === n ? 'var(--accent)' : 'transparent',
                color: days === n ? '#fff' : 'var(--text-secondary)',
                fontSize: 13, cursor: 'pointer', fontWeight: days === n ? 600 : 400,
              }}
            >
              {n}天
            </button>
          ))}
        </div>
      </div>

      {/* 状态 */}
      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 20, color: '#f87171', fontSize: 14 }}>
          {error}
        </div>
      )}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>加载中...</div>
      )}

      {/* 数据内容 */}
      {!loading && data.length > 0 && (
        <>
          {/* 指标卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <MetricCard label="最新价" value={latest ? latest.close.toFixed(2) : '-'}
              sub={latest && prev ? `${(latest.change_pct >= 0 ? '+' : '')}${latest.change_pct.toFixed(2)}%` : ''}
              color={latest && latest.change_pct >= 0 ? 'var(--up)' : 'var(--down)'} />
            <MetricCard label="最高" value={periodHigh.toFixed(2)} />
            <MetricCard label="最低" value={periodLow.toFixed(2)} />
            <MetricCard label="成交量" value={fmtVol(latest?.volume || 0)}
              sub={`均 ${fmtVol(avgVol)}`} />
            <MetricCard label="区间涨幅" value={`${(prev ? ((latest!.close - prev.close) / prev.close * 100).toFixed(2) : '-')}%`}
              color={latest && prev && latest.close >= prev.close ? 'var(--up)' : 'var(--down)'} />
            <MetricCard label="涨跌比" value={`${upDays}/${downDays}`}
              sub={`${(upDays / data.length * 100).toFixed(0)}%`} />
          </div>

          {/* 图表区 */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              {stockName} · 价格走势
            </div>
            <div style={{ height: 300 }}>
              <Line data={priceChartData} options={priceOpts(latest)} />
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              成交量
            </div>
            <div style={{ height: 160 }}>
              <Bar data={volumeChartData} options={chartOptions} />
            </div>
          </div>

          {/* OHLCV 表格 */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>OHLCV 数据</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>共 {data.length} 条</span>
            </div>
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 }}>
                    <Th>日期</Th><Th>开盘</Th><Th>收盘</Th><Th>最高</Th><Th>最低</Th><Th>涨跌幅</Th><Th>成交量</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <Td>{row.date}</Td>
                      <Td mono>{row.open.toFixed(2)}</Td>
                      <Td mono style={{ color: row.change_pct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                        {row.close.toFixed(2)}
                      </Td>
                      <Td mono>{row.high.toFixed(2)}</Td>
                      <Td mono>{row.low.toFixed(2)}</Td>
                      <Td mono style={{ color: row.change_pct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                        {row.change_pct >= 0 ? '+' : ''}{row.change_pct.toFixed(2)}%
                      </Td>
                      <Td mono>{fmtVol(row.volume)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 空状态 */}
      {!loading && !error && data.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          输入股票代码查看日线数据
        </div>
      )}
    </div>
  )
}

// ─── 子组件 ──────────────────────────────────────────────

function MetricCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: color || 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: '10px 14px', textAlign: 'right', fontWeight: 500,
      color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

function Td({ children, mono, style }: {
  children: React.ReactNode; mono?: boolean; style?: React.CSSProperties
}) {
  return (
    <td style={{
      padding: '9px 14px', textAlign: 'right',
      fontFamily: mono ? "'JetBrains Mono', 'SF Mono', monospace" : undefined,
      fontSize: mono ? 12 : 13,
      color: 'var(--text-primary)',
      ...style,
    }}>
      {children}
    </td>
  )
}

function priceOpts(latest: StockDailyRow | null) {
  const refPrice = latest?.close || 0
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30,30,40,0.95)',
        titleColor: '#f5f5f7',
        bodyColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed.y
            const diff = refPrice ? ((v - refPrice) / refPrice * 100).toFixed(2) : ''
            return `${v.toFixed(2)}  ${diff ? `(${diff >= '0' ? '+' : ''}${diff}%)` : ''}`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'var(--text-muted)', font: { size: 10 }, maxTicksLimit: 10 },
        grid: { display: false },
      },
      y: {
        ticks: { color: 'var(--text-muted)', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
    },
  }
}

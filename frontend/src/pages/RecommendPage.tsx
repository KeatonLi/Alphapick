import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../services/api'
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'

interface StockRec { stock_code: string; stock_name: string; recommend_price: number; reason: string }
interface Stats { total: number; completed: number; win_count: number; win_rate: number; avg_return: number; avg_max_gain: number; avg_max_drawdown: number }

function fmt(n: number, d = 2) { return n.toFixed(d) }

export default function RecommendPage() {
  const tradeDates = useTradeDates()
  const [date, setDate] = useState('')
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tradeDates.length > 0 && !date) setDate(tradeDates[0])
  }, [tradeDates])

  const loadData = async () => {
    if (!date) return
    setLoading(true); setError('')
    try {
      const [recRes, statsRes] = await Promise.all([apiGet<any>(`/recommend/daily?date=${date}`), apiGet<any>('/recommend/stats')])
      if (recRes.success) setRecs(recRes.data || [])
      else setError(recRes.error || '暂无推荐数据')
      if (statsRes.success) setStats(statsRes.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [date])

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 20px 60px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text-primary)', margin: '0 0 6px' }}>
          智能<span style={{ color: 'var(--accent)' }}>推荐</span>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>THS 选股 · 热度排名 · 消息面分析 → AI 精选</p>
      </div>

      {/* Date Picker */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
        <TradeDatePicker value={date} onChange={setDate} tradeDates={tradeDates} />
      </div>

      {/* Stats Bar */}
      {!loading && stats && (
        <div className="card" style={{ padding: '24px 32px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 }}>
          {[
            { v: stats.total, l: '累计推荐', c: 'var(--accent)' },
            { v: `${stats.win_rate}%`, l: '胜率', c: 'var(--accent-light)' },
            { v: `${stats.avg_return >= 0 ? '+' : ''}${stats.avg_return}%`, l: '平均收益', c: stats.avg_return >= 0 ? 'var(--up)' : 'var(--down)' },
            { v: `+${stats.avg_max_gain}%`, l: '平均最高收益', c: 'var(--up)' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: m.c, lineHeight: 1.1 }}>{m.v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m.l}</div>
            </div>
          ))}
          <div className="w-px h-10 hidden sm:block" style={{ background: 'var(--border-default)' }} />
          <div style={{ textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{stats.completed}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>已完结</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16 }} />)}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="card" style={{ padding: 16, marginBottom: 24, borderColor: 'var(--up)', background: 'var(--up-bg)', color: 'var(--up)', fontSize: 13 }}>{error}</div>
      )}

      {/* Empty */}
      {!loading && recs.length === 0 && !error && (
        <div className="card" style={{ padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 16, opacity: .5 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>该日期暂无推荐</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            请前往 <Link to="/settings" style={{ color: 'var(--accent)', fontWeight: 600 }}>设置</Link> 页面生成推荐
          </div>
        </div>
      )}

      {/* Recommendation Cards */}
      {!loading && recs.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            今日推荐 · {recs.length} 只
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {recs.map((rec, idx) => (
              <div key={idx} className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: 'var(--accent-bg)', color: 'var(--accent-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono', monospace",
                  }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{rec.stock_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{rec.stock_code}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {rec.reason || '量化模型筛选结果'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(rec.recommend_price)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>推荐价</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 20 }}>筛选流程</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { step: 'STEP 1', title: '热点筛选', desc: '全市场 ~5000 只\n→ 热点板块 500 只' },
                { step: 'STEP 2', title: '技术筛选', desc: '多头排列过滤\n→ ~50 只候选' },
                { step: 'STEP 3', title: 'AI 精选', desc: 'LLM 综合评估\n→ 最终 5 只推荐' },
              ].map(s => (
                <div key={s.step} style={{ padding: 16, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>{s.step}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

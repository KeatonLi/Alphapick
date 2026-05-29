import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface StockRec { stock_code: string; stock_name: string; recommend_price: number; reason: string }
interface Stats { total: number; completed: number; win_count: number; win_rate: number; avg_return: number; avg_max_gain: number; avg_max_drawdown: number }

function fmt(n: number, d = 2) { return n.toFixed(d) }

export default function RecommendPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [tradeDates, setTradeDates] = useState<string[]>([])
  const [recs, setRecs] = useState<StockRec[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<any>('/report/trade-dates?days=365')
      .then(d => { if (d.success) setTradeDates(d.data || []) })
      .catch(() => {})
  }, [])

  const loadData = async () => {
    if (!selectedDate) return
    setLoading(true); setError('')
    try {
      const [recRes, statsRes] = await Promise.all([
        apiGet<any>(`/recommend/daily?date=${selectedDate}`),
        apiGet<any>('/recommend/stats'),
      ])
      if (recRes.success) setRecs(recRes.data || [])
      else setError(recRes.error || '暂无推荐数据')
      if (statsRes.success) setStats(statsRes.data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [selectedDate])

  const dateIdx = tradeDates.indexOf(selectedDate)
  const canPrev = dateIdx > 0
  const canNext = dateIdx >= 0 && dateIdx < tradeDates.length - 1

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>量化推荐</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>热点筛选 × 消息面分析 → AI 精选</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setSelectedDate(tradeDates[dateIdx + 1])} disabled={!canNext}
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: canNext ? 'pointer' : 'not-allowed', opacity: canNext ? 1 : 0.3, display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            max={today} min={tradeDates.length ? tradeDates[tradeDates.length - 1] : ''}
            style={{ appearance: 'none', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '6px 12px', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, textAlign: 'center', outline: 'none', width: 140 }}/>
          <button onClick={() => setSelectedDate(tradeDates[dateIdx - 1])} disabled={!canPrev}
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: canPrev ? 'pointer' : 'not-allowed', opacity: canPrev ? 1 : 0.3, display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
          <button onClick={loadData}
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--accent-bg)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      </div>

      {!loading && stats && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <h3>收益统计</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{stats.total}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>累计推荐</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.completed}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>已完结</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{stats.win_rate}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>胜率</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: stats.avg_return >= 0 ? 'var(--up)' : 'var(--down)' }}>{stats.avg_return >= 0 ? '+' : ''}{stats.avg_return}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>平均收益</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--up)' }}>+{stats.avg_max_gain}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>平均最高收益</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--down)' }}>{stats.avg_max_drawdown}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>平均最大回撤</div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div className="section-header"><h3>今日推荐</h3></div>
          {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72 }}/>)}
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, borderColor: 'var(--up-bg)' }}>
          <div style={{ color: 'var(--up)', fontSize: 13 }}>{error}</div>
        </div>
      )}

      {!loading && recs.length === 0 && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>该日期暂无量化推荐</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            请先前往 <a href="/settings" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>设置</a> 页面生成推荐
          </div>
        </div>
      )}

      {!loading && recs.length > 0 && (
        <>
          <div className="section-header">
            <h3>今日推荐</h3>
            <span className="badge badge-accent">共 {recs.length} 只</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {recs.map((rec, idx) => (
              <div key={idx} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0
                  }}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{rec.stock_name}</span>
                      <span className="badge" style={{ fontSize: 10 }}>{rec.stock_code}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {rec.reason || '量化模型筛选结果'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(rec.recommend_price)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>推荐价格</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="section-header"><h3>筛选流程</h3></div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140, padding: 12, borderRadius: 12, background: 'var(--accent-bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>STEP 1</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>热点筛选</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>全市场 ~5000 只 → 热点板块 500 只</div>
              </div>
              <div style={{ flex: 1, minWidth: 140, padding: 12, borderRadius: 12, background: 'var(--accent-bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>STEP 2</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>技术筛选</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MA5 &gt; MA10 &gt; MA20 多头排列 → ~50 只</div>
              </div>
              <div style={{ flex: 1, minWidth: 140, padding: 12, borderRadius: 12, background: 'var(--accent-bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>STEP 3</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>AI 精选</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>LLM 综合评估 → 最终 5 只推荐</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

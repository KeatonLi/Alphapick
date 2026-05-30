import { useState, useEffect } from 'react'
import { analysisApi, extendedAnalysisApi } from '../services/api'
import type {
  WeekdayStatsResponse, HoldingPeriodStatsResponse, ReturnDistributionResponse,
  InsightsResponse, PriceRangeStatsResponse, StockTypeStatsResponse,
  VolatilityStatsResponse, SuccessTrendResponse,
} from '../services/api'
import InsightCard from '../components/analysis/InsightCard'
import WeekdayChart from '../components/analysis/WeekdayChart'
import HoldingPeriodChart from '../components/analysis/HoldingPeriodChart'
import ReturnDistribution from '../components/analysis/ReturnDistribution'
import PriceRangeChart from '../components/analysis/PriceRangeChart'
import StockTypeChart from '../components/analysis/StockTypeChart'
import VolatilityChart from '../components/analysis/VolatilityChart'
import SuccessTrendChart from '../components/analysis/SuccessTrendChart'

type TabKey = 'basic' | 'extended'

export default function AnalysisPage() {
  const [tab, setTab] = useState<TabKey>('basic')
  const [weekday, setWeekday] = useState<WeekdayStatsResponse | null>(null)
  const [holding, setHolding] = useState<HoldingPeriodStatsResponse | null>(null)
  const [dist, setDist] = useState<ReturnDistributionResponse | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [priceRange, setPriceRange] = useState<PriceRangeStatsResponse | null>(null)
  const [stockType, setStockType] = useState<StockTypeStatsResponse | null>(null)
  const [volatility, setVolatility] = useState<VolatilityStatsResponse | null>(null)
  const [trend, setTrend] = useState<SuccessTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const sd = startDate || undefined; const ed = endDate || undefined
      if (tab === 'basic') {
        const [w, h, d, i] = await Promise.all([
          analysisApi.getWeekdayStats(sd, ed), analysisApi.getHoldingPeriodStats(sd, ed),
          analysisApi.getReturnDistribution(3, sd, ed), analysisApi.getInsights(sd, ed),
        ])
        setWeekday(w); setHolding(h); setDist(d); setInsights(i)
      } else {
        const [p, s, v, t] = await Promise.all([
          extendedAnalysisApi.getPriceRangeStats(sd, ed), extendedAnalysisApi.getStockTypeStats(sd, ed),
          extendedAnalysisApi.getVolatilityStats(sd, ed), extendedAnalysisApi.getSuccessTrend(sd, ed),
        ])
        setPriceRange(p); setStockType(s); setVolatility(v); setTrend(t)
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab, startDate, endDate])

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    borderRadius: 10, padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text-primary)', margin: '0 0 4px' }}>
            数据<span style={{ color: 'var(--accent)' }}>分析</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>量化推荐多维统计 · 历史表现洞察</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 32 }}>
        <div className="nav-pills" style={{ display: 'inline-flex' }}>
          {(['basic', 'extended'] as TabKey[]).map(k => (
            <a key={k} href="#" onClick={e => { e.preventDefault(); setTab(k) }} className={tab === k ? 'active' : ''}>
              {k === 'basic' ? '基础分析' : '扩展分析'}
            </a>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 120, borderRadius: 20 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
            <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 16, borderColor: 'var(--up)', background: 'var(--up-bg)', color: 'var(--up)', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {tab === 'basic' && (
            <>
              {/* Insights */}
              {insights && insights.insights.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
                    关键洞察
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {insights.insights.map((item, i) => <InsightCard key={i} {...item} />)}
                  </div>
                </div>
              )}

              {/* Charts Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
                <div className="card" style={{ padding: 24 }}>{weekday && <WeekdayChart data={weekday.data} />}</div>
                <div className="card" style={{ padding: 24 }}>{holding && <HoldingPeriodChart data={holding.data} optimalDays={holding.optimal_period.days} />}</div>
              </div>

              {/* Distribution */}
              {dist && (
                <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                  <ReturnDistribution data={dist} />
                </div>
              )}

              {/* Summary */}
              {weekday && (
                <div className="card" style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  共分析 <strong style={{ color: 'var(--text-primary)' }}>{weekday.summary.total_recommendations}</strong> 条历史推荐 ·
                  最佳日 <strong style={{ color: 'var(--up)' }}>{weekday.summary.best_weekday}</strong> ·
                  最差日 <strong style={{ color: 'var(--down)' }}>{weekday.summary.worst_weekday}</strong>
                </div>
              )}
            </>
          )}

          {tab === 'extended' && (
            <>
              {/* Volatility Insights */}
              {volatility && volatility.summary && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
                    波动性洞察
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    <InsightCard icon="📊" title="风险等级" content={volatility.summary.volatility_assessment as string} />
                    <InsightCard icon="📈" title="平均最大收益" content={`${(volatility.data.avg_max_gain * 100).toFixed(1)}%`} />
                    <InsightCard icon="📉" title="平均最大回撤" content={`${(volatility.data.avg_max_drawdown * 100).toFixed(1)}%`} />
                  </div>
                </div>
              )}

              {/* Trend Insights */}
              {trend && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <InsightCard icon="📈" title="整体趋势" content={trend.summary.trend_direction as string} />
                    <InsightCard icon="📅" title="月度表现" content={`最佳 ${trend.summary.best_month} · 最差 ${trend.summary.worst_month}`} />
                  </div>
                </div>
              )}

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
                <div className="card" style={{ padding: 24 }}>{priceRange && <PriceRangeChart data={priceRange.data} />}</div>
                <div className="card" style={{ padding: 24 }}>{stockType && <StockTypeChart data={stockType.data} />}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                <div className="card" style={{ padding: 24 }}>{volatility && <VolatilityChart data={volatility.data} />}</div>
                <div className="card" style={{ padding: 24 }}>{trend && <SuccessTrendChart data={trend.data} trend={trend.summary.trend_direction as string} />}</div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { analyzeApi, type AnalysisDetail, type AnalysisListItem } from '../services/analyzeApi'

const FACTOR_LABELS: Record<string, string> = {
  momentum: '动量',
  trend: '趋势',
  liquidity: '流动性',
  source_quality: '数据质量',
  risk_penalty: '风险扣分',
  total: '综合',
}

function num(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return value.toFixed(2)
}

function decisionTone(decision?: string) {
  return decision === 'buy' ? 'buy' : 'hold'
}

function decisionLabel(decision?: string) {
  if (decision === 'buy') return 'BUY · 建议买入'
  return 'HOLD · 建议持有'
}

function maTrendLabel(trend?: string | number | null) {
  if (trend === '多头排列') return '多头排列'
  if (trend === '空头排列') return '空头排列'
  if (trend === '震荡') return '均线纠缠'
  return '数据不足'
}

export default function AnalyzePage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<AnalysisDetail | null>(null)
  const [history, setHistory] = useState<AnalysisListItem[]>([])
  const [selected, setSelected] = useState<AnalysisDetail | null>(null)

  useEffect(() => {
    let alive = true
    analyzeApi.list(20)
      .then(res => alive && setHistory(res.data))
      .catch(() => alive && setHistory([]))
    return () => { alive = false }
  }, [])

  const loadDetail = (id: number) => {
    setError('')
    setSelected(null)
    analyzeApi.detail(id)
      .then(res => setSelected(res.data))
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
  }

  const runAnalyze = async (e: FormEvent) => {
    e.preventDefault()
    const value = query.trim()
    if (!value || loading) return
    setLoading(true)
    setError('')
    setReport(null)
    setSelected(null)
    try {
      const res = await analyzeApi.create(value)
      setReport(res.data)
      const list = await analyzeApi.list(20)
      setHistory(list.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const view = report || selected

  return (
    <div className="qv4-page">
      <section className="qv4-hero compact">
        <div className="qv4-hero-main qv4-reveal">
          <div className="qv4-kicker">智能分析</div>
          <h1>个股智能分析</h1>
          <p>输入股票代码或名称，智能体自动聚合库内技术面、量化因子与估值数据，给出中期（1-3 个月）buy / hold 判断。</p>
        </div>
      </section>

      <section className="qv4-analyze-search qv4-reveal">
        <form onSubmit={runAnalyze} className="qv4-analyze-form">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="输入代码或名称，如 600519 / 贵州茅台"
            aria-label="股票代码或名称"
          />
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? '智能体分析中…' : '开始分析'}
          </button>
        </form>
        {error && <p className="qv4-analyze-error">{error}</p>}
      </section>

      {loading && <section className="qv4-analyze-loading qv4-reveal">正在构建事实包并调用智能体分析，请稍候…</section>}

      {view && (
        <section className="qv4-analyze-report qv4-reveal">
          <div className={`qv4-decision-banner ${decisionTone(view.decision)}`}>
            <div className="qv4-decision-main">
              <strong>{decisionLabel(view.decision)}</strong>
              <span>{view.stock_name}（{view.stock_code}）</span>
            </div>
            <div className="qv4-confidence">
              <span>置信度 {view.confidence ?? '--'}%</span>
              <div className="qv4-confidence-bar">
                <i style={{ width: `${view.confidence ?? 0}%` }} />
              </div>
              <small>数据截至 {view.data_asof ?? '--'}</small>
            </div>
          </div>
          {view.summary && <p className="qv4-analyze-summary">{view.summary}</p>}

          <div className="qv4-analyze-grid">
            <div className="qv4-panel">
              <h3>量化因子</h3>
              <ul className="qv4-factor-list">
                {Object.entries(view.factors || {}).map(([key, value]) => (
                  <li key={key}>
                    <span>{FACTOR_LABELS[key] || key}</span>
                    <i><b style={{ width: `${Math.max(0, Math.min(Number(value) || 0, 100))}%` }} /></i>
                    <strong>{num(value)}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="qv4-panel">
              <h3>技术面</h3>
              <dl className="qv4-kv-list">
                <div><dt>均线形态</dt><dd>{maTrendLabel(view.technicals?.ma?.trend)}</dd></div>
                <div><dt>MA5 / MA20 / MA60</dt><dd>{num(view.technicals?.ma?.ma5)} / {num(view.technicals?.ma?.ma20)} / {num(view.technicals?.ma?.ma60)}</dd></div>
                <div><dt>MACD DIF / DEA</dt><dd>{num(view.technicals?.macd?.dif)} / {num(view.technicals?.macd?.dea)}</dd></div>
                <div><dt>KDJ K / D</dt><dd>{num(view.technicals?.kdj?.k)} / {num(view.technicals?.kdj?.d)}</dd></div>
                <div><dt>60 日区间涨跌</dt><dd>{num(view.technicals?.range_change)}%</dd></div>
                <div><dt>波动率</dt><dd>{num(view.technicals?.volatility)}%</dd></div>
              </dl>
            </div>

            <div className="qv4-panel">
              <h3>估值</h3>
              <dl className="qv4-kv-list">
                <div><dt>PE</dt><dd>{num(view.valuation?.pe)}</dd></div>
                <div><dt>PB</dt><dd>{num(view.valuation?.pb)}</dd></div>
                <div><dt>PE 市场百分位</dt><dd>{view.valuation?.pe_percentile === null || view.valuation?.pe_percentile === undefined ? '--' : `${view.valuation.pe_percentile}%`}</dd></div>
                <div><dt>PB 市场百分位</dt><dd>{view.valuation?.pb_percentile === null || view.valuation?.pb_percentile === undefined ? '--' : `${view.valuation.pb_percentile}%`}</dd></div>
              </dl>
            </div>

            {view.reasons && view.reasons.length > 0 && (
              <div className="qv4-panel qv4-panel-wide">
                <h3>判断理由</h3>
                <ul className="qv4-reason-list">
                  {view.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="qv4-analyze-history qv4-reveal">
        <h2>历史分析</h2>
        {history.length === 0 ? (
          <p className="qv4-empty">暂无分析记录，输入代码或名称开始第一次分析。</p>
        ) : (
          <table className="qv4-analyze-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>结论</th>
                <th>置信度</th>
                <th>一句话摘要</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id} onClick={() => loadDetail(item.id)} className="qv4-clickable">
                  <td>{item.stock_code}</td>
                  <td>{item.stock_name}</td>
                  <td><span className={`qv4-decision-tag ${decisionTone(item.decision)}`}>{item.decision === 'buy' ? '买入' : '持有'}</span></td>
                  <td>{item.confidence ?? '--'}</td>
                  <td>{item.summary || '--'}</td>
                  <td>{item.created_at || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

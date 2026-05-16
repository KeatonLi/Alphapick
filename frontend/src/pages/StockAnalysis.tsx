import { useState } from 'react'
import { apiGet } from '../services/api'

interface AnalysisData {
  code: string
  analysis: string
  stock_info: Record<string, string>
  recent_daily: Array<Record<string, string>>
}

export default function StockAnalysis() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<AnalysisData | null>(null)

  const handleAnalyze = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setData(null)
    try {
      const result = await apiGet<any>(`/stock/analyze?code=${encodeURIComponent(code)}`)
      setData(result.data)
    } catch (e: any) {
      setError(e.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }

  const changePct = data?.stock_info?.['涨跌幅']?.toString().replace('%', '') || '0'
  const isUp = !changePct.startsWith('-')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero Section */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
          AI 智能<span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">个股分析</span>
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
          输入 A 股代码，AI 从基本面、技术面、消息面多维度深度剖析，助你决策
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="flex gap-3 p-1.5 rounded-2xl bg-bg-secondary border border-border-default focus-within:border-blue-500/50 focus-within:shadow-[0_0_24px_rgba(59,130,246,0.15)] transition-all duration-300">
          <div className="flex items-center pl-4 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            placeholder="输入股票代码，如 000001、600519"
            className="flex-1 bg-transparent text-white text-lg px-3 py-3 outline-none placeholder:text-slate-600 font-mono tracking-wider"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold text-sm hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 active:scale-95"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                分析中
              </span>
            ) : '开始分析'}
          </button>
        </div>

        {/* Quick Codes */}
        <div className="flex gap-2 mt-3 justify-center flex-wrap">
          {['000001', '600519', '300750', '000858'].map(c => (
            <button key={c} onClick={() => { setCode(c); handleAnalyze() }}
              className="px-3 py-1 text-xs rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all font-mono">
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      {loading && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      )}

      {data && (
        <div className="space-y-6 fade-in-up">
          {/* Stock Header Card */}
          {data.stock_info && Object.keys(data.stock_info).length > 0 && (
            <div className="glass-card p-6 md:p-8">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-white">{data.stock_info['股票简称'] || data.code}</h2>
                    <span className="text-sm text-slate-500 font-mono">{data.code}</span>
                    {data.stock_info['公司名称'] && (
                      <span className="text-xs text-slate-600 truncate max-w-[200px] hidden sm:inline">
                        {data.stock_info['公司名称']}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-white count-in">
                      {data.stock_info['最新价'] || '--'}
                    </span>
                    <span className={`text-lg font-semibold ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
                      {data.stock_info['涨跌幅'] || '--'}
                    </span>
                    <span className={`text-sm ${isUp ? 'text-stock-up/70' : 'text-stock-down/70'}`}>
                      {data.stock_info['涨跌额'] || ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-border-default">
                {[
                  ['昨收', data.stock_info['昨收']],
                  ['今开', data.stock_info['今开']],
                  ['最高', data.stock_info['最高']],
                  ['最低', data.stock_info['最低']],
                  ['成交量', (() => { const v = data.stock_info['成交量']; return v ? (parseInt(v)/10000).toFixed(0)+'万手' : '--' })()],
                ].map(([label, value]) => (
                  <div key={label} className="text-center">
                    <div className="text-xs text-slate-500 mb-1">{label}</div>
                    <div className="text-sm font-semibold text-slate-200 font-mono">{value || '--'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div className="glass-card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border-default">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">AI 分析报告</h3>
            </div>
            <div className="prose prose-invert max-w-none">
              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                {data.analysis}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { apiGet } from '../services/api'

interface MarketIndex {
  name: string
  code: string
  price: string
  change: string
  changePct: string
}

interface MarketData {
  indices: MarketIndex[]
  updateTime: string
}

export default function Market() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MarketData | null>(null)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiGet<any>('/market/indices')
      setData(result.data)
    } catch (e: any) {
      setError(e.message || '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const mockIndices: MarketIndex[] = [
    { name: '上证指数', code: '000001', price: '3285.67', change: '+23.45', changePct: '+0.72%' },
    { name: '深证成指', code: '399001', price: '10521.34', change: '+89.23', changePct: '+0.86%' },
    { name: '创业板指', code: '399006', price: '2103.45', change: '-15.67', changePct: '-0.74%' },
    { name: '沪深300', code: '000300', price: '3892.12', change: '+34.56', changePct: '+0.90%' },
    { name: '科创50', code: '000688', price: '1023.45', change: '-8.90', changePct: '-0.86%' },
  ]

  const displayData = data?.indices || mockIndices

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero Section */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-3 tracking-tight">
          <span className="text-blue-500">市场数据</span>实时行情
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto text-sm leading-relaxed">
          涵盖 A 股主要指数，实时追踪市场走势，把握整体行情脉搏
        </p>
      </div>

      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {displayData.map((index, i) => {
          const isUp = !index.change.startsWith('-')
          return (
            <div
              key={index.code}
              className="stock-card p-5 hover:border-blue-400 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-blue-100"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-blue-800">{index.name}</span>
                  <span className="text-xs text-text-muted font-mono bg-blue-50 px-2 py-0.5 rounded">{index.code}</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${isUp ? 'bg-stock-up' : 'bg-stock-down'}`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-900 font-mono">{index.price}</span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-sm font-semibold ${isUp ? 'stock-up' : 'stock-down'}`}>
                  {index.change}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${isUp ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                  {index.changePct}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Stats */}
      <div className="stock-card p-6">
        <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          市场情绪
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '上涨', value: '2,847', color: 'text-red-500' },
            { label: '下跌', value: '1,523', color: 'text-green-600' },
            { label: '平盘', value: '342', color: 'text-text-muted' },
            { label: '涨停', value: '89', color: 'text-amber-500' },
          ].map(stat => (
            <div key={stat.label} className="text-center p-3 bg-blue-50 rounded-xl">
              <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-text-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'

interface MarketIndex {
  name: string
  code: string
  close: number
  change_pct: number
}

interface HotSector {
  name: string
  change_pct: number
  leading_stock: string
}

interface MarketBreadth {
  up: number
  down: number
  flat: number
  limit_up: number
  limit_down: number
}

export default function Market() {
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [sectors, setSectors] = useState<HotSector[]>([])
  const [breadth, setBreadth] = useState<MarketBreadth>({ up: 0, down: 0, flat: 0, limit_up: 0, limit_down: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [marketRes, sectorsRes] = await Promise.all([
          apiGet<any>('/stock/market'),
          apiGet<any>('/stock/hot-sectors?top_n=8'),
        ])
        if (marketRes.success && marketRes.data) {
          setIndices(marketRes.data.indices || [])
          setBreadth(marketRes.data.breadth || { up: 0, down: 0, flat: 0, limit_up: 0, limit_down: 0 })
        }
        if (sectorsRes.success && sectorsRes.data) {
          setSectors(sectorsRes.data || [])
        }
      } catch (e: any) {
        setError(e.message || '获取市场数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

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

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Market Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {indices.map((index) => {
              const isUp = index.change_pct >= 0
              return (
                <div
                  key={index.code}
                  className="stock-card p-5 hover:border-blue-400 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-blue-100"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-800">{index.name}</span>
                      <span className="text-xs text-text-muted font-mono bg-blue-50 px-2 py-0.5 rounded">{index.code}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${isUp ? 'bg-stock-up' : 'bg-stock-down'}`} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-blue-900 font-mono">{index.close.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-sm font-semibold ${isUp ? 'stock-up' : 'stock-down'}`}>
                      {isUp ? '+' : ''}{index.change_pct.toFixed(2)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${isUp ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                      {isUp ? '↑ 上涨' : '↓ 下跌'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Hot Sectors */}
          {sectors.length > 0 && (
            <div className="stock-card p-6 mb-6">
              <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                热门板块
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sectors.slice(0, 8).map((sector) => {
                  const isUp = sector.change_pct >= 0
                  return (
                    <div key={sector.name} className="p-3 bg-blue-50 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-blue-800 truncate">{sector.name}</span>
                        <span className={`text-xs font-medium ${isUp ? 'text-red-500' : 'text-green-600'}`}>
                          {isUp ? '+' : ''}{sector.change_pct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-xs text-text-muted truncate" title={sector.leading_stock}>
                        龙头: {sector.leading_stock}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Market Sentiment Stats */}
          <div className="stock-card p-6">
            <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              市场情绪
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: '上涨', value: breadth.up.toLocaleString(), color: 'text-red-500' },
                { label: '下跌', value: breadth.down.toLocaleString(), color: 'text-green-600' },
                { label: '平盘', value: breadth.flat.toLocaleString(), color: 'text-text-muted' },
                { label: '涨停', value: breadth.limit_up.toLocaleString(), color: 'text-amber-500' },
                { label: '跌停', value: breadth.limit_down.toLocaleString(), color: 'text-blue-500' },
              ].map(stat => (
                <div key={stat.label} className="text-center p-3 bg-blue-50 rounded-xl">
                  <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-text-muted mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

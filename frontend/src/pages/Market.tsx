import { useEffect, useState } from 'react'
import { mockMarketIndex, mockHotSectors } from '../services/mockData'

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

export default function Market() {
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [sectors, setSectors] = useState<HotSector[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 直接使用 mock 数据，暂不调用真实 API
    setIndices(mockMarketIndex)
    setSectors(mockHotSectors)
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary">加载市场数据...</p>
        </div>
      </div>
    )
  }

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
                  {isUp ? '+' : ''}{index.change_pct.toFixed(2)}%
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

      {/* Quick Stats */}
      <div className="stock-card p-6">
        <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          市场情绪
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '上涨', value: indices.filter(i => i.change_pct > 0).length.toString(), color: 'text-red-500' },
            { label: '下跌', value: indices.filter(i => i.change_pct < 0).length.toString(), color: 'text-green-600' },
            { label: '平盘', value: indices.filter(i => i.change_pct === 0).length.toString(), color: 'text-text-muted' },
            { label: '板块涨多跌少', value: sectors.filter(s => s.change_pct > 0).length > sectors.filter(s => s.change_pct < 0).length ? '偏多' : '偏空', color: 'text-amber-500' },
          ].map(stat => (
            <div key={stat.label} className="text-center p-3 bg-blue-50 rounded-xl">
              <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-text-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

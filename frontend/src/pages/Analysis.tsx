import { useEffect, useState } from 'react'
import { mockKLineData } from '../services/mockData'

interface DailyData {
  日期: string
  开盘: number
  收盘: number
  最高: number
  最低: number
  成交量: number
  涨跌幅: number
}

const periods = ['1W', '1M', '3M', '6M', '1Y']

const indices = [
  { code: '000001', name: '上证指数' },
  { code: '399001', name: '深证成指' },
  { code: '399006', name: '创业板指' },
]

export default function Analysis() {
  const [selectedPeriod, setSelectedPeriod] = useState('1M')
  const [selectedIndex, setSelectedIndex] = useState('000001')
  const [chartData, setChartData] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 直接使用 mock 数据，暂不调用真实 API
    setChartData(mockKLineData)
    setLoading(false)
  }, [selectedIndex, selectedPeriod])

  const minVal = chartData.length > 0 ? Math.min(...chartData.map(d => d.最低)) : 0
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.最高)) : 0
  const range = maxVal - minVal

  const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const firstData = chartData.length > 0 ? chartData[0] : null
  const priceChange = latestData && firstData ? latestData.收盘 - firstData.收盘 : 0
  const priceChangePct = latestData && firstData && firstData.收盘 !== 0
    ? (priceChange / firstData.收盘) * 100
    : 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero Section */}
      <div className="text-center mb-10 fade-in-up">
        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-3 tracking-tight">
          <span className="text-blue-500">行情分析</span>技术图表
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto text-sm leading-relaxed">
          多周期技术分析，K 线走势、均线系统、量价配合，助你把握买卖点
        </p>
      </div>

      {/* Index Selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {indices.map(idx => (
          <button
            key={idx.code}
            onClick={() => setSelectedIndex(idx.code)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedIndex === idx.code
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-text-secondary hover:text-blue-600 hover:bg-blue-50 border border-transparent'
            }`}
          >
            {idx.name}
          </button>
        ))}
      </div>

      {/* Chart Card */}
      <div className="stock-card p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-blue-800">
              {indices.find(i => i.code === selectedIndex)?.name}
            </h3>
            <span className="text-sm text-text-muted font-mono">{selectedIndex}</span>
          </div>
          <div className="flex gap-1">
            {periods.map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPeriod === p
                    ? 'bg-blue-600 text-white'
                    : 'text-text-secondary hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-text-secondary">加载K线数据...</p>
            </div>
          </div>
        ) : (
          <>
            {/* K-line Chart */}
            <div className="h-64 relative">
              <div className="absolute inset-0 flex items-end">
                {chartData.map((d, _i) => {
                  const height = range > 0 ? ((d.收盘 - minVal) / range) * 100 : 50
                  const isUp = d.涨跌幅 >= 0
                  return (
                    <div
                      key={d.日期}
                      className="flex-1 mx-0.5 group relative"
                      style={{ height: `${height}%` }}
                    >
                      <div
                        className={`absolute bottom-0 w-full rounded-t transition-all hover:opacity-100 ${
                          isUp ? 'bg-red-400/60 hover:bg-red-500' : 'bg-green-400/60 hover:bg-green-500'
                        }`}
                        style={{ height: '100%' }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white rounded text-xs text-blue-900 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-md">
                        <div className="font-mono font-bold">收盘: {d.收盘.toFixed(2)}</div>
                        <div className="text-text-muted text-[10px]">{d.日期}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Price Info */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-default">
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-text-muted">最新价</div>
                  <div className="text-lg font-bold text-blue-900 font-mono">
                    {latestData ? latestData.收盘.toFixed(2) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">涨跌额</div>
                  <div className={`text-lg font-bold font-mono ${priceChange >= 0 ? 'stock-up' : 'stock-down'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-muted">涨跌幅</div>
                <div className={`text-lg font-bold ${priceChangePct >= 0 ? 'stock-up' : 'stock-down'}`}>
                  {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Technical Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { name: '开盘', value: latestData?.开盘.toFixed(2) || '-', signal: '', color: 'text-blue-800' },
          { name: '最高', value: latestData?.最高.toFixed(2) || '-', signal: '', color: 'text-red-500' },
          { name: '最低', value: latestData?.最低.toFixed(2) || '-', signal: '', color: 'text-green-600' },
          { name: '成交量', value: latestData ? (latestData.成交量 / 10000).toFixed(0) + '万' : '-', signal: '', color: 'text-text-muted' },
          { name: '区间涨跌幅', value: priceChangePct >= 0 ? '+' + priceChangePct.toFixed(2) + '%' : priceChangePct.toFixed(2) + '%', signal: priceChangePct >= 0 ? '偏多' : '偏空', color: priceChangePct >= 0 ? 'text-red-500' : 'text-green-600' },
          { name: '数据条数', value: chartData.length + '条', signal: '', color: 'text-text-muted' },
        ].map(ind => (
          <div key={ind.name} className="stock-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{ind.name}</span>
              {ind.signal && (
                <span className={`text-xs px-2 py-0.5 rounded ${
                  ind.signal === '偏多' || ind.signal === '买入'
                    ? 'bg-red-50 text-red-500 border border-red-200'
                    : ind.signal === '偏空' || ind.signal === '卖出'
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : 'bg-gray-100 text-text-muted border border-gray-200'
                }`}>
                  {ind.signal}
                </span>
              )}
            </div>
            <div className={`text-xl font-bold ${ind.color} font-mono mt-2`}>{ind.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

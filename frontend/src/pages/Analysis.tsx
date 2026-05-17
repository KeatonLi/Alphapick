import { useState } from 'react'

interface ChartData {
  date: string
  value: number
}

export default function Analysis() {
  const [selectedPeriod, setSelectedPeriod] = useState('1W')
  const [selectedIndex, setSelectedIndex] = useState('000001')

  const periods = ['1D', '1W', '1M', '3M', '6M', '1Y']

  const generateMockData = (): ChartData[] => {
    const data: ChartData[] = []
    let value = 3200
    const now = new Date()
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      value += (Math.random() - 0.48) * 30
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100,
      })
    }
    return data
  }

  const chartData = generateMockData()
  const minVal = Math.min(...chartData.map(d => d.value))
  const maxVal = Math.max(...chartData.map(d => d.value))
  const range = maxVal - minVal

  const indices = [
    { code: '000001', name: '上证指数' },
    { code: '399001', name: '深证成指' },
    { code: '399006', name: '创业板指' },
  ]

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

        {/* Simple Line Chart */}
        <div className="h-64 relative">
          <div className="absolute inset-0 flex items-end">
            {chartData.map((d, _i) => {
              const height = range > 0 ? ((d.value - minVal) / range) * 100 : 50
              const isUp = d.value >= chartData[0].value
              return (
                <div
                  key={d.date}
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
                    <div className="font-mono font-bold">{d.value}</div>
                    <div className="text-text-muted text-[10px]">{d.date}</div>
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
              <div className="text-lg font-bold text-blue-900 font-mono">{chartData[chartData.length - 1].value}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">涨跌额</div>
              <div className={`text-lg font-bold font-mono ${
                chartData[chartData.length - 1].value >= chartData[0].value ? 'stock-up' : 'stock-down'
              }`}>
                {(chartData[chartData.length - 1].value - chartData[0].value).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-text-muted">涨跌幅</div>
            <div className={`text-lg font-bold ${
              chartData[chartData.length - 1].value >= chartData[0].value ? 'stock-up' : 'stock-down'
            }`}>
              {(((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Technical Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { name: 'MA5', value: '3289.12', signal: '金叉', color: 'text-red-500' },
          { name: 'MA10', value: '3275.45', signal: '死叉', color: 'text-green-600' },
          { name: 'MA20', value: '3256.78', signal: '多头', color: 'text-blue-500' },
          { name: 'RSI(14)', value: '58.32', signal: '中性', color: 'text-text-muted' },
          { name: 'MACD', value: '+15.67', signal: '买入', color: 'text-red-500' },
          { name: 'KDJ', value: '72.5', signal: '超买', color: 'text-amber-500' },
        ].map(ind => (
          <div key={ind.name} className="stock-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{ind.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                ind.signal === '买入' || ind.signal === '金叉' || ind.signal === '多头'
                  ? 'bg-red-50 text-red-500 border border-red-200'
                  : ind.signal === '卖出' || ind.signal === '死叉' || ind.signal === '超买'
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-gray-100 text-text-muted border border-gray-200'
              }`}>
                {ind.signal}
              </span>
            </div>
            <div className={`text-xl font-bold ${ind.color} font-mono mt-2`}>{ind.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

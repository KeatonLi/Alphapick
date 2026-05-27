import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { PriceRangeStat } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface PriceRangeChartProps {
  data: Record<string, PriceRangeStat>
}

export default function PriceRangeChart({ data }: PriceRangeChartProps) {
  const ranges = ['低价股', '中价股', '高价股']
  const winRates = ranges.map(d => (data[d]?.win_rate ?? 0) * 100)
  const avgReturns = ranges.map(d => (data[d]?.avg_return ?? 0) * 100)

  const chartData = {
    labels: ranges,
    datasets: [
      {
        label: '胜率 (%)',
        data: winRates,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: '平均收益 (%)',
        data: avgReturns,
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: '价格区间推荐效果' },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: unknown) => `${value}%`,
        },
      },
    },
  }

  if (Object.keys(data).length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 h-80 flex items-center justify-center">
        <p className="text-gray-500">暂无数据</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <Bar data={chartData} options={options} />
    </div>
  )
}

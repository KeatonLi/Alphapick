import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { TrendDataPoint } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface SuccessTrendChartProps {
  data: TrendDataPoint[]
  trend: string
}

export default function SuccessTrendChart({ data, trend }: SuccessTrendChartProps) {
  const labels = data.map(d => d.month.slice(5))  // 只显示月份部分
  const winRates = data.map(d => d.win_rate * 100)

  const chartData = {
    labels,
    datasets: [
      {
        label: '胜率 (%)',
        data: winRates,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: `成功率趋势 (${trend})` },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => `${value}%`,
        },
      },
    },
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 h-80 flex items-center justify-center">
        <p className="text-gray-500">暂无数据</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <Line data={chartData} options={options} />
    </div>
  )
}

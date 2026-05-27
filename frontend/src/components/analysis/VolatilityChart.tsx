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
import type { VolatilityStat } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface VolatilityChartProps {
  data: VolatilityStat
}

export default function VolatilityChart({ data }: VolatilityChartProps) {
  const chartData = {
    labels: ['平均最大收益', '平均最大回撤'],
    datasets: [
      {
        label: '收益率 (%)',
        data: [data.avg_max_gain * 100, Math.abs(data.avg_max_drawdown) * 100],
        backgroundColor: [
          'rgba(16, 185, 129, 0.5)',
          'rgba(239, 68, 68, 0.5)',
        ],
        borderColor: [
          'rgb(16, 185, 129)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: '收益波动性分析' },
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4 text-sm text-gray-600">
        <span>最大收益正向率: <strong>{(data.gain_positive_rate * 100).toFixed(1)}%</strong></span>
      </div>
      <Bar data={chartData} options={options} />
    </div>
  )
}

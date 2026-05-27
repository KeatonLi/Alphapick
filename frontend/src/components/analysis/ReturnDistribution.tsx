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
import type { ReturnDistributionResponse } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface ReturnDistributionProps {
  data: ReturnDistributionResponse
}

export default function ReturnDistribution({ data }: ReturnDistributionProps) {
  const chartData = {
    labels: data.bins,
    datasets: [
      {
        label: '推荐数量',
        data: data.counts,
        backgroundColor: 'rgba(139, 92, 246, 0.5)',
        borderColor: 'rgb(139, 92, 246)',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: '收益分布' },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
      },
    },
  }

  if (data.bins.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 h-80 flex items-center justify-center">
        <p className="text-gray-500">暂无数据</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4 flex gap-4 text-sm text-gray-600">
        <span>25分位: {(data.percentiles.p25 * 100).toFixed(1)}%</span>
        <span>中位数: {(data.percentiles.p50 * 100).toFixed(1)}%</span>
        <span>75分位: {(data.percentiles.p75 * 100).toFixed(1)}%</span>
      </div>
      <Bar data={chartData} options={options} />
    </div>
  )
}

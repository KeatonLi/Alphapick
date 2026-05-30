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

  const chartOptions = {
    ...options,
    plugins: {
      ...options.plugins,
      legend: {
        ...options.plugins.legend,
        labels: { color: 'var(--text-secondary)' },
      },
      title: {
        ...options.plugins.title,
        color: 'var(--text-primary)',
      },
    },
    scales: {
      ...options.scales,
      x: {
        ticks: { color: 'var(--text-muted)' },
        grid: { color: 'var(--border-default)' },
      },
      y: {
        ...options.scales.y,
        ticks: {
          ...options.scales.y.ticks,
          color: 'var(--text-muted)',
        },
        grid: { color: 'var(--border-default)' },
      },
    },
  }

  if (data.bins.length === 0) {
    return (
      <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        暂无数据
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
        <span>25分位: {(data.percentiles.p25 * 100).toFixed(1)}%</span>
        <span>中位数: {(data.percentiles.p50 * 100).toFixed(1)}%</span>
        <span>75分位: {(data.percentiles.p75 * 100).toFixed(1)}%</span>
      </div>
      <Bar data={chartData} options={chartOptions} />
    </div>
  )
}

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
import type { WeekdayStat } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface WeekdayChartProps {
  data: Record<string, WeekdayStat>
}

export default function WeekdayChart({ data }: WeekdayChartProps) {
  const weekdays = ['周一', '周二', '周三', '周四', '周五']
  const winRates = weekdays.map(d => (data[d]?.win_rate ?? 0) * 100)
  const avgReturns = weekdays.map(d => (data[d]?.avg_return ?? 0) * 100)

  const chartData = {
    labels: weekdays,
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
      title: { display: true, text: '每周各天推荐效果' },
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

  if (Object.keys(data).length === 0) {
    return (
      <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        暂无数据
      </div>
    )
  }

  return (
    <div>
      <Bar data={chartData} options={chartOptions} />
    </div>
  )
}

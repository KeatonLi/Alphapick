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
import type { StockTypeStat } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface StockTypeChartProps {
  data: Record<string, StockTypeStat>
}

export default function StockTypeChart({ data }: StockTypeChartProps) {
  const types = ['60主板', '00中小板', '300创业板']
  const winRates = types.map(d => (data[d]?.win_rate ?? 0) * 100)
  const avgReturns = types.map(d => (data[d]?.avg_return ?? 0) * 100)

  const chartData = {
    labels: types,
    datasets: [
      {
        label: '胜率 (%)',
        data: winRates,
        backgroundColor: 'rgba(139, 92, 246, 0.5)',
        borderColor: 'rgb(139, 92, 246)',
        borderWidth: 1,
      },
      {
        label: '平均收益 (%)',
        data: avgReturns,
        backgroundColor: 'rgba(236, 72, 153, 0.5)',
        borderColor: 'rgb(236, 72, 153)',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const, labels: { color: 'var(--text-secondary)' } },
      title: { display: true, text: '股票代码类型推荐效果', color: 'var(--text-primary)' },
    },
    scales: {
      x: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-default)' } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: unknown) => `${value}%`,
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
      <Bar data={chartData} options={options} />
    </div>
  )
}

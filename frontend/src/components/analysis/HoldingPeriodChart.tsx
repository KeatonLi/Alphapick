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
import type { HoldingPeriodStat } from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface HoldingPeriodChartProps {
  data: Record<string, HoldingPeriodStat>
  optimalDays: number
}

export default function HoldingPeriodChart({ data, optimalDays }: HoldingPeriodChartProps) {
  const periods = ['1天', '2天', '3天']
  const avgReturns = periods.map(d => (data[d]?.avg_return ?? 0) * 100)
  const winRates = periods.map(d => (data[d]?.win_rate ?? 0) * 100)

  const chartData = {
    labels: periods,
    datasets: [
      {
        label: '平均收益 (%)',
        data: avgReturns,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
      },
      {
        label: '胜率 (%)',
        data: winRates,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        tension: 0.3,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: `持仓周期收益对比（最优：${optimalDays}天）` },
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

  if (Object.keys(data).length === 0) {
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

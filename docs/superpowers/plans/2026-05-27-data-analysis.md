# 数据分析功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增数据分析页面，挖掘历史推荐数据的价值，发现时间维度规律和最优持仓周期

**Architecture:** 后端新增 `/api/analysis` 路由模块，查询 `recommendations` 表进行统计计算；前端新增 `/analysis` 页面，使用 Chart.js 渲染图表，自动生成洞察卡片

**Tech Stack:** Python FastAPI + SQLAlchemy (后端), React + TypeScript + Chart.js (前端)

---

## 文件结构

### 新建文件

| 文件路径 | 职责 |
|---------|------|
| `backend/app/services/analysis_service.py` | 核心统计逻辑：周几胜率、持仓周期、收益分布、洞察生成 |
| `backend/app/routers/analysis.py` | API 路由：4个端点 |
| `backend/app/schemas/analysis.py` | Pydantic 响应模型 |
| `frontend/src/pages/AnalysisPage.tsx` | 数据分析主页面 |
| `frontend/src/components/analysis/InsightCard.tsx` | 洞察卡片组件 |
| `frontend/src/components/analysis/WeekdayChart.tsx` | 周几胜率柱状图 |
| `frontend/src/components/analysis/HoldingPeriodChart.tsx` | 持仓周期折线图 |
| `frontend/src/components/analysis/ReturnDistribution.tsx` | 收益分布直方图 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `backend/app/main.py` | 注册 analysis 路由 |
| `frontend/src/App.tsx` | 添加 `/analysis` 路由 |
| `frontend/src/components/Navbar.tsx` | 添加导航入口 |
| `frontend/src/services/api.ts` | 添加分析 API 调用 |
| `frontend/package.json` | 添加 chart.js 依赖 |

---

## Task 1: 后端 - Pydantic 响应模型

**Files:**
- Create: `backend/app/schemas/analysis.py`

- [ ] **Step 1: 创建 Pydantic 模型文件**

```python
# backend/app/schemas/analysis.py
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime


class WeekdayStat(BaseModel):
    count: int
    win_count: int
    win_rate: float
    avg_return: float
    max_return: float
    min_return: float


class WeekdayStatsResponse(BaseModel):
    data: Dict[str, WeekdayStat]
    summary: Dict[str, any]


class HoldingPeriodStat(BaseModel):
    count: int
    avg_return: float
    win_rate: float
    median_return: float


class OptimalPeriod(BaseModel):
    days: int
    reason: str


class HoldingPeriodStatsResponse(BaseModel):
    data: Dict[str, HoldingPeriodStat]
    optimal_period: OptimalPeriod


class ReturnDistributionResponse(BaseModel):
    bins: List[str]
    counts: List[int]
    percentiles: Dict[str, float]


class Insight(BaseModel):
    type: str
    icon: str
    title: str
    content: str


class InsightsResponse(BaseModel):
    insights: List[Insight]
    generated_at: datetime
```

- [ ] **Step 2: 验证模型可导入**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python -c "from app.schemas.analysis import WeekdayStatsResponse; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/analysis.py
git commit -m "feat(analysis): add Pydantic response models for analysis API"
```

---

## Task 2: 后端 - 统计服务核心逻辑

**Files:**
- Create: `backend/app/services/analysis_service.py`

- [ ] **Step 1: 创建分析服务文件**

```python
# backend/app/services/analysis_service.py
from datetime import date, timedelta
from typing import Dict, List, Optional
from collections import defaultdict
from statistics import median

from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.models import Recommendation


def get_weekday_stats(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
    """统计每周各天的推荐效果"""
    query = db.query(Recommendation).filter(
        Recommendation.final_return_rate.isnot(None)
    )
    if start_date:
        query = query.filter(Recommendation.recommend_date >= start_date)
    if end_date:
        query = query.filter(Recommendation.recommend_date <= end_date)

    recs = query.all()
    if not recs:
        return {"data": {}, "summary": {"total_recommendations": 0, "best_weekday": "", "worst_weekday": ""}}

    weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    stats = defaultdict(lambda: {"returns": [], "wins": 0, "count": 0})

    for rec in recs:
        weekday = rec.recommend_date.weekday()
        ret = float(rec.final_return_rate)
        stats[weekday]["returns"].append(ret)
        stats[weekday]["count"] += 1
        if ret > 0:
            stats[weekday]["wins"] += 1

    data = {}
    for weekday in range(7):
        if weekday in stats:
            s = stats[weekday]
            returns = s["returns"]
            data[weekday_names[weekday]] = {
                "count": s["count"],
                "win_count": s["wins"],
                "win_rate": round(s["wins"] / s["count"], 3) if s["count"] > 0 else 0,
                "avg_return": round(sum(returns) / len(returns), 4),
                "max_return": round(max(returns), 4),
                "min_return": round(min(returns), 4),
            }

    # 找最佳和最差 weekday
    best = max(data.items(), key=lambda x: x[1]["win_rate"], default=("", {"win_rate": 0}))
    worst = min(data.items(), key=lambda x: x[1]["win_rate"], default=("", {"win_rate": 1}))

    return {
        "data": data,
        "summary": {
            "total_recommendations": len(recs),
            "best_weekday": best[0],
            "worst_weekday": worst[0],
        }
    }


def get_holding_period_stats(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
    """统计不同持仓天数的收益表现"""
    query = db.query(Recommendation).filter(
        Recommendation.return_rate_day1.isnot(None)
    )
    if start_date:
        query = query.filter(Recommendation.recommend_date >= start_date)
    if end_date:
        query = query.filter(Recommendation.recommend_date <= end_date)

    recs = query.all()
    if not recs:
        return {"data": {}, "optimal_period": {"days": 0, "reason": "数据不足"}}

    period_data = {
        "1天": {"returns": [], "field": "return_rate_day1"},
        "2天": {"returns": [], "field": "return_rate_day2"},
        "3天": {"returns": [], "field": "return_rate_day3"},
    }

    for rec in recs:
        for period_name, info in period_data.items():
            val = getattr(rec, info["field"])
            if val is not None:
                info["returns"].append(float(val))

    data = {}
    for period_name, info in period_data.items():
        returns = info["returns"]
        if returns:
            wins = sum(1 for r in returns if r > 0)
            data[period_name] = {
                "count": len(returns),
                "avg_return": round(sum(returns) / len(returns), 4),
                "win_rate": round(wins / len(returns), 3),
                "median_return": round(median(returns), 4),
            }

    # 找最优持仓周期
    if data:
        best_period = max(data.items(), key=lambda x: x[1]["avg_return"])
        optimal_days = int(best_period[0].replace("天", ""))
        optimal_reason = f"{best_period[0]}持仓平均收益最高（{best_period[1]['avg_return']*100:.1f}%），胜率{best_period[1]['win_rate']*100:.1f}%"
    else:
        optimal_days = 0
        optimal_reason = "数据不足"

    return {
        "data": data,
        "optimal_period": {"days": optimal_days, "reason": optimal_reason}
    }


def get_return_distribution(db: Session, holding_days: int = 3, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
    """获取收益分布直方图数据"""
    field_map = {1: "return_rate_day1", 2: "return_rate_day2", 3: "final_return_rate"}
    field = field_map.get(holding_days, "final_return_rate")

    query = db.query(Recommendation).filter(getattr(Recommendation, field).isnot(None))
    if start_date:
        query = query.filter(Recommendation.recommend_date >= start_date)
    if end_date:
        query = query.filter(Recommendation.recommend_date <= end_date)

    recs = query.all()
    if not recs:
        return {"bins": [], "counts": [], "percentiles": {"p25": 0, "p50": 0, "p75": 0}}

    returns = [float(getattr(r, field)) for r in recs]

    # 创建直方图 bins
    min_ret = min(returns)
    max_ret = max(returns)
    bin_width = 0.02  # 2% 一个区间
    bins = []
    counts = []
    current = -0.10  # 从 -10% 开始
    while current <= 0.15:
        lower = current
        upper = current + bin_width
        count = sum(1 for r in returns if lower <= r < upper)
        bins.append(f"{lower*100:.0f}%")
        counts.append(count)
        current = upper

    # 计算百分位数
    sorted_returns = sorted(returns)
    n = len(sorted_returns)
    percentiles = {
        "p25": round(sorted_returns[int(n * 0.25)], 4),
        "p50": round(sorted_returns[int(n * 0.50)], 4),
        "p75": round(sorted_returns[int(n * 0.75)], 4),
    }

    return {"bins": bins, "counts": counts, "percentiles": percentiles}


def generate_insights(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
    """自动生成关键洞察"""
    insights = []

    # 获取周几统计
    weekday_stats = get_weekday_stats(db, start_date, end_date)
    if weekday_stats["data"]:
        best = weekday_stats["summary"]["best_weekday"]
        worst = weekday_stats["summary"]["worst_weekday"]
        if best and worst and best != worst:
            best_rate = weekday_stats["data"][best]["win_rate"] * 100
            worst_rate = weekday_stats["data"][worst]["win_rate"] * 100
            diff = best_rate - worst_rate
            insights.append({
                "type": "weekday",
                "icon": "📅",
                "title": "时间规律",
                "content": f"{best}推荐胜率最高（{best_rate:.1f}%），比{worst}高{diff:.1f}个百分点"
            })

    # 获取持仓周期统计
    holding_stats = get_holding_period_stats(db, start_date, end_date)
    if holding_stats["data"] and holding_stats["optimal_period"]["days"] > 0:
        opt = holding_stats["optimal_period"]
        opt_data = holding_stats["data"].get(f"{opt['days']}天", {})
        if opt_data:
            insights.append({
                "type": "holding_period",
                "icon": "📈",
                "title": "持仓周期",
                "content": opt["reason"]
            })

            # 策略建议
            if opt["days"] < 3:
                insights.append({
                    "type": "strategy",
                    "icon": "💡",
                    "title": "策略建议",
                    "content": f"建议将持仓周期从3天调整为{opt['days']}天，可提升整体收益"
                })

    # 如果洞察太少，添加数据量提示
    total = weekday_stats["summary"]["total_recommendations"]
    if total < 50:
        insights.append({
            "type": "data",
            "icon": "⚠️",
            "title": "数据提示",
            "content": f"当前仅有{total}条历史推荐数据，建议积累更多数据以获得更准确的分析结果"
        })

    return {
        "insights": insights,
        "generated_at": datetime.now().isoformat()
    }
```

- [ ] **Step 2: 添加 datetime 导入**

在文件顶部添加：
```python
from datetime import datetime
```

- [ ] **Step 3: 验证服务可导入**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python -c "from app.services.analysis_service import get_weekday_stats; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/analysis_service.py
git commit -m "feat(analysis): implement core statistics service"
```

---

## Task 3: 后端 - API 路由

**Files:**
- Create: `backend/app/routers/analysis.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 创建路由文件**

```python
# backend/app/routers/analysis.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.services.analysis_service import (
    get_weekday_stats,
    get_holding_period_stats,
    get_return_distribution,
    generate_insights,
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/weekday-stats")
async def weekday_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """获取每周各天的推荐效果统计"""
    return get_weekday_stats(db, start_date, end_date)


@router.get("/holding-period-stats")
async def holding_period_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """获取不同持仓天数的收益表现"""
    return get_holding_period_stats(db, start_date, end_date)


@router.get("/return-distribution")
async def return_distribution(
    holding_days: int = Query(3, ge=1, le=3),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """获取收益分布直方图数据"""
    return get_return_distribution(db, holding_days, start_date, end_date)


@router.get("/insights")
async def insights(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """自动生成关键洞察"""
    return generate_insights(db, start_date, end_date)
```

- [ ] **Step 2: 在 main.py 注册路由**

在 `backend/app/main.py` 中找到路由注册位置，添加：

```python
from app.routers.analysis import router as analysis_router
app.include_router(analysis_router)
```

- [ ] **Step 3: 验证服务启动**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python -c "from app.main import app; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/analysis.py backend/app/main.py
git commit -m "feat(analysis): add analysis API router with 4 endpoints"
```

---

## Task 4: 前端 - 安装 Chart.js 依赖

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 安装依赖**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npm install chart.js react-chartjs-2`

Expected: 安装成功，package.json 更新

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add chart.js and react-chartjs-2 dependencies"
```

---

## Task 5: 前端 - API 调用层

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 添加分析 API 函数**

在 `frontend/src/services/api.ts` 文件末尾添加：

```typescript
// ─── 数据分析 API ────────────────────────────────────────────────────────

export interface WeekdayStat {
  count: number
  win_count: number
  win_rate: number
  avg_return: number
  max_return: number
  min_return: number
}

export interface WeekdayStatsResponse {
  data: Record<string, WeekdayStat>
  summary: {
    total_recommendations: number
    best_weekday: string
    worst_weekday: string
  }
}

export interface HoldingPeriodStat {
  count: number
  avg_return: number
  win_rate: number
  median_return: number
}

export interface HoldingPeriodStatsResponse {
  data: Record<string, HoldingPeriodStat>
  optimal_period: {
    days: number
    reason: string
  }
}

export interface ReturnDistributionResponse {
  bins: string[]
  counts: number[]
  percentiles: {
    p25: number
    p50: number
    p75: number
  }
}

export interface Insight {
  type: string
  icon: string
  title: string
  content: string
}

export interface InsightsResponse {
  insights: Insight[]
  generated_at: string
}

export const analysisApi = {
  getWeekdayStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<WeekdayStatsResponse>(`/analysis/weekday-stats?${params}`)
  },

  getHoldingPeriodStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<HoldingPeriodStatsResponse>(`/analysis/holding-period-stats?${params}`)
  },

  getReturnDistribution: (holdingDays: number = 3, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    params.append('holding_days', String(holdingDays))
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<ReturnDistributionResponse>(`/analysis/return-distribution?${params}`)
  },

  getInsights: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<InsightsResponse>(`/analysis/insights?${params}`)
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(frontend): add analysis API client functions"
```

---

## Task 6: 前端 - 洞察卡片组件

**Files:**
- Create: `frontend/src/components/analysis/InsightCard.tsx`

- [ ] **Step 1: 创建组件目录和文件**

```bash
mkdir -p /Users/libokai/IdeaProjects/QuantForge/frontend/src/components/analysis
```

- [ ] **Step 2: 创建 InsightCard 组件**

```tsx
// frontend/src/components/analysis/InsightCard.tsx
interface InsightCardProps {
  icon: string
  title: string
  content: string
}

export default function InsightCard({ icon, title, content }: InsightCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/analysis/InsightCard.tsx
git commit -m "feat(frontend): create InsightCard component"
```

---

## Task 7: 前端 - 周几胜率柱状图

**Files:**
- Create: `frontend/src/components/analysis/WeekdayChart.tsx`

- [ ] **Step 1: 创建 WeekdayChart 组件**

```tsx
// frontend/src/components/analysis/WeekdayChart.tsx
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
      <Bar data={chartData} options={options} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/analysis/WeekdayChart.tsx
git commit -m "feat(frontend): create WeekdayChart component with bar chart"
```

---

## Task 8: 前端 - 持仓周期折线图

**Files:**
- Create: `frontend/src/components/analysis/HoldingPeriodChart.tsx`

- [ ] **Step 1: 创建 HoldingPeriodChart 组件**

```tsx
// frontend/src/components/analysis/HoldingPeriodChart.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/analysis/HoldingPeriodChart.tsx
git commit -m "feat(frontend): create HoldingPeriodChart component with line chart"
```

---

## Task 9: 前端 - 收益分布直方图

**Files:**
- Create: `frontend/src/components/analysis/ReturnDistribution.tsx`

- [ ] **Step 1: 创建 ReturnDistribution 组件**

```tsx
// frontend/src/components/analysis/ReturnDistribution.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/analysis/ReturnDistribution.tsx
git commit -m "feat(frontend): create ReturnDistribution component with histogram"
```

---

## Task 10: 前端 - 数据分析主页面

**Files:**
- Create: `frontend/src/pages/AnalysisPage.tsx`

- [ ] **Step 1: 创建 AnalysisPage 组件**

```tsx
// frontend/src/pages/AnalysisPage.tsx
import { useState, useEffect } from 'react'
import { analysisApi } from '../services/api'
import type {
  WeekdayStatsResponse,
  HoldingPeriodStatsResponse,
  ReturnDistributionResponse,
  InsightsResponse,
} from '../services/api'
import InsightCard from '../components/analysis/InsightCard'
import WeekdayChart from '../components/analysis/WeekdayChart'
import HoldingPeriodChart from '../components/analysis/HoldingPeriodChart'
import ReturnDistribution from '../components/analysis/ReturnDistribution'

export default function AnalysisPage() {
  const [weekdayStats, setWeekdayStats] = useState<WeekdayStatsResponse | null>(null)
  const [holdingStats, setHoldingStats] = useState<HoldingPeriodStatsResponse | null>(null)
  const [distribution, setDistribution] = useState<ReturnDistributionResponse | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 日期筛选状态
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [weekday, holding, dist, ins] = await Promise.all([
        analysisApi.getWeekdayStats(startDate || undefined, endDate || undefined),
        analysisApi.getHoldingPeriodStats(startDate || undefined, endDate || undefined),
        analysisApi.getReturnDistribution(3, startDate || undefined, endDate || undefined),
        analysisApi.getInsights(startDate || undefined, endDate || undefined),
      ])
      setWeekdayStats(weekday)
      setHoldingStats(holding)
      setDistribution(dist)
      setInsights(ins)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">📊 数据分析</h1>
        <div className="flex gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
            placeholder="开始日期"
          />
          <span className="text-gray-400 self-center">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
            placeholder="结束日期"
          />
        </div>
      </div>

      {/* 关键洞察 */}
      {insights && insights.insights.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">💡 关键洞察</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.insights.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
          </div>
        </div>
      )}

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {weekdayStats && <WeekdayChart data={weekdayStats.data} />}
        {holdingStats && (
          <HoldingPeriodChart
            data={holdingStats.data}
            optimalDays={holdingStats.optimal_period.days}
          />
        )}
      </div>

      {/* 收益分布 */}
      {distribution && (
        <div className="mb-8">
          <ReturnDistribution data={distribution} />
        </div>
      )}

      {/* 统计摘要 */}
      {weekdayStats && (
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p>共分析 <strong>{weekdayStats.summary.total_recommendations}</strong> 条历史推荐数据</p>
          <p>最佳推荐日：<strong>{weekdayStats.summary.best_weekday}</strong> | 最差推荐日：<strong>{weekdayStats.summary.worst_weekday}</strong></p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/AnalysisPage.tsx
git commit -m "feat(frontend): create AnalysisPage with charts and insights"
```

---

## Task 11: 前端 - 路由与导航配置

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navbar.tsx`

- [ ] **Step 1: 更新 App.tsx 路由**

在 `frontend/src/App.tsx` 中添加 import 和路由：

```tsx
// 添加 import
import AnalysisPage from './pages/AnalysisPage'

// 在 Routes 中添加
<Route path="/analysis" element={<AnalysisPage />} />
```

- [ ] **Step 2: 更新 Navbar.tsx 导航**

在 `frontend/src/components/Navbar.tsx` 的导航链接中添加：

```tsx
<NavLink to="/analysis" className={...}>
  数据分析
</NavLink>
```

- [ ] **Step 3: 验证前端编译**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npm run build`
Expected: 编译成功，无错误

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Navbar.tsx
git commit -m "feat(frontend): add /analysis route and navigation entry"
```

---

## Task 12: 集成测试与验证

**Files:**
- None (手动测试)

- [ ] **Step 1: 启动后端服务**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python -m uvicorn app.main:app --reload --port 8000`

- [ ] **Step 2: 测试 API 端点**

```bash
curl http://localhost:8000/api/analysis/weekday-stats
curl http://localhost:8000/api/analysis/holding-period-stats
curl http://localhost:8000/api/analysis/return-distribution
curl http://localhost:8000/api/analysis/insights
```

Expected: 每个端点返回 JSON 数据

- [ ] **Step 3: 启动前端开发服务器**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npm run dev`

- [ ] **Step 4: 浏览器测试**

访问 `http://localhost:5173/analysis`，验证：
- 页面正常加载
- 图表正确渲染
- 洞察卡片显示
- 日期筛选功能正常

- [ ] **Step 5: Commit 最终版本**

```bash
git add -A
git commit -m "feat: complete data analysis feature with charts and insights"
```

---

## 自检清单

完成所有任务后，验证以下内容：

- [ ] 后端 API 4个端点全部正常响应
- [ ] 前端页面正确渲染图表
- [ ] 日期筛选功能正常工作
- [ ] 空数据时显示友好提示
- [ ] 响应式布局在移动端正常显示
- [ ] 代码无 TypeScript 错误
- [ ] 代码无 Python 语法错误

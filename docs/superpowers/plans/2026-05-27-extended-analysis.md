# 扩展数据分析功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展数据分析页面，添加价格区间、股票代码类型、收益波动性、成功率趋势四个新分析维度

**Architecture:** 在现有 AnalysisPage 中添加 Tab 切换，后端新增4个 API 端点，前端新增4个图表组件

**Tech Stack:** Python FastAPI + SQLAlchemy (后端), React + TypeScript + Chart.js (前端)

---

## 文件结构

### 新建文件

| 文件路径 | 职责 |
|---------|------|
| `frontend/src/components/analysis/PriceRangeChart.tsx` | 价格区间胜率柱状图 |
| `frontend/src/components/analysis/StockTypeChart.tsx` | 股票代码类型胜率柱状图 |
| `frontend/src/components/analysis/VolatilityChart.tsx` | 收益波动性分析图 |
| `frontend/src/components/analysis/SuccessTrendChart.tsx` | 成功率趋势折线图 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `backend/app/services/analysis_service.py` | 添加4个新统计函数 |
| `backend/app/routers/analysis.py` | 添加4个新端点 |
| `backend/app/schemas/analysis.py` | 添加新 Pydantic 模型 |
| `frontend/src/pages/AnalysisPage.tsx` | 添加 Tab 切换，集成新组件 |
| `frontend/src/services/api.ts` | 添加新 API 调用函数 |

---

## Task 1: 后端 - 扩展 Pydantic 模型

**Files:**
- Modify: `backend/app/schemas/analysis.py`

- [ ] **Step 1: 添加价格区间统计模型**

在 `backend/app/schemas/analysis.py` 文件末尾添加：

```python
class PriceRangeStat(BaseModel):
    count: int
    win_count: int
    win_rate: float
    avg_return: float
    avg_price: float


class PriceRangeStatsResponse(BaseModel):
    data: Dict[str, PriceRangeStat]
    summary: Dict[str, any]


class StockTypeStat(BaseModel):
    count: int
    win_count: int
    win_rate: float
    avg_return: float


class StockTypeStatsResponse(BaseModel):
    data: Dict[str, StockTypeStat]
    summary: Dict[str, any]


class VolatilityStat(BaseModel):
    avg_max_gain: float
    avg_max_drawdown: float
    max_gain_count: int
    max_drawdown_count: int
    gain_drawdown_ratio: float


class VolatilityStatsResponse(BaseModel):
    data: VolatilityStat
    summary: Dict[str, any]


class TrendDataPoint(BaseModel):
    month: str
    win_rate: float
    count: int
    avg_return: float


class SuccessTrendResponse(BaseModel):
    data: List[TrendDataPoint]
    summary: Dict[str, any]
```

- [ ] **Step 2: 更新 __init__.py 导出**

在 `backend/app/schemas/__init__.py` 中添加新模型的导入。

- [ ] **Step 3: 验证模型可导入**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -c "from app.schemas.analysis import PriceRangeStatsResponse; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/analysis.py backend/app/schemas/__init__.py
git commit -m "feat(analysis): add Pydantic models for extended analysis"
```

---

## Task 2: 后端 - 扩展统计服务

**Files:**
- Modify: `backend/app/services/analysis_service.py`

- [ ] **Step 1: 添加价格区间统计函数**

在 `analysis_service.py` 文件末尾添加：

```python
def get_price_range_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计不同价格区间的推荐效果"""
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {"data": {}, "summary": {"total_recommendations": 0, "best_range": "", "worst_range": ""}}

    # 按价格区间分组
    ranges = {
        "低价股": {"returns": [], "prices": []},
        "中价股": {"returns": [], "prices": []},
        "高价股": {"returns": [], "prices": []},
    }

    for r in recs:
        if r.final_return_rate is None or r.recommend_price is None:
            continue
        price = float(r.recommend_price)
        ret = float(r.final_return_rate)
        if price < 10:
            ranges["低价股"]["returns"].append(ret)
            ranges["低价股"]["prices"].append(price)
        elif price < 50:
            ranges["中价股"]["returns"].append(ret)
            ranges["中价股"]["prices"].append(price)
        else:
            ranges["高价股"]["returns"].append(ret)
            ranges["高价股"]["prices"].append(price)

    data = {}
    for range_name, info in ranges.items():
        returns = info["returns"]
        prices = info["prices"]
        if returns:
            count = len(returns)
            win_count = sum(1 for r in returns if r > 0)
            data[range_name] = {
                "count": count,
                "win_count": win_count,
                "win_rate": round(win_count / count, 3),
                "avg_return": round(sum(returns) / count, 4),
                "avg_price": round(sum(prices) / len(prices), 2),
            }
        else:
            data[range_name] = {
                "count": 0,
                "win_count": 0,
                "win_rate": 0,
                "avg_return": 0,
                "avg_price": 0,
            }

    # 找最佳和最差价格区间
    ranges_with_data = {k: v for k, v in data.items() if v["count"] > 0}
    if ranges_with_data:
        best = max(ranges_with_data.items(), key=lambda x: x[1]["win_rate"])
        worst = min(ranges_with_data.items(), key=lambda x: x[1]["win_rate"])
    else:
        best = ("", {"win_rate": 0})
        worst = ("", {"win_rate": 1})

    return {
        "data": data,
        "summary": {
            "total_recommendations": sum(v["count"] for v in data.values()),
            "best_range": best[0],
            "worst_range": worst[0],
        }
    }
```

- [ ] **Step 2: 添加股票代码类型统计函数**

```python
def get_stock_type_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计不同股票代码类型的推荐效果"""
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {"data": {}, "summary": {"total_recommendations": 0, "best_type": "", "worst_type": ""}}

    # 按代码类型分组
    types = {
        "60主板": [],
        "00中小板": [],
        "002创业板": [],
    }

    for r in recs:
        if r.final_return_rate is None:
            continue
        code = r.stock_code
        ret = float(r.final_return_rate)
        if code.startswith("60"):
            types["60主板"].append(ret)
        elif code.startswith("00"):
            types["00中小板"].append(ret)
        elif code.startswith("002"):
            types["002创业板"].append(ret)

    data = {}
    for type_name, returns in types.items():
        if returns:
            count = len(returns)
            win_count = sum(1 for r in returns if r > 0)
            data[type_name] = {
                "count": count,
                "win_count": win_count,
                "win_rate": round(win_count / count, 3),
                "avg_return": round(sum(returns) / count, 4),
            }
        else:
            data[type_name] = {
                "count": 0,
                "win_count": 0,
                "win_rate": 0,
                "avg_return": 0,
            }

    # 找最佳和最差类型
    types_with_data = {k: v for k, v in data.items() if v["count"] > 0}
    if types_with_data:
        best = max(types_with_data.items(), key=lambda x: x[1]["win_rate"])
        worst = min(types_with_data.items(), key=lambda x: x[1]["win_rate"])
    else:
        best = ("", {"win_rate": 0})
        worst = ("", {"win_rate": 1})

    return {
        "data": data,
        "summary": {
            "total_recommendations": sum(v["count"] for v in data.values()),
            "best_type": best[0],
            "worst_type": worst[0],
        }
    }
```

- [ ] **Step 3: 添加收益波动性统计函数**

```python
def get_volatility_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计收益波动性，分析最大收益和最大回撤"""
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "data": {
                "avg_max_gain": 0,
                "avg_max_drawdown": 0,
                "max_gain_count": 0,
                "max_drawdown_count": 0,
                "gain_drawdown_ratio": 0,
            },
            "summary": {"total_recommendations": 0, "risk_level": "无数据", "insight": "暂无数据"}
        }

    max_gains = []
    max_drawdowns = []

    for r in recs:
        if r.max_gain is not None:
            max_gains.append(float(r.max_gain))
        if r.max_drawdown is not None:
            max_drawdowns.append(float(r.max_drawdown))

    avg_gain = sum(max_gains) / len(max_gains) if max_gains else 0
    avg_drawdown = sum(max_drawdowns) / len(max_drawdowns) if max_drawdowns else 0
    ratio = abs(avg_gain / avg_drawdown) if avg_drawdown != 0 else 0

    # 判断风险等级
    if ratio > 2:
        risk_level = "低"
    elif ratio > 1:
        risk_level = "中等"
    else:
        risk_level = "高"

    return {
        "data": {
            "avg_max_gain": round(avg_gain, 4),
            "avg_max_drawdown": round(avg_drawdown, 4),
            "max_gain_count": len(max_gains),
            "max_drawdown_count": len(max_drawdowns),
            "gain_drawdown_ratio": round(ratio, 2),
        },
        "summary": {
            "total_recommendations": len(recs),
            "risk_level": risk_level,
            "insight": f"平均最大收益{avg_gain*100:.1f}%，平均最大回撤{abs(avg_drawdown)*100:.1f}%，收益风险比{ratio:.2f}"
        }
    }
```

- [ ] **Step 4: 添加成功率趋势函数**

```python
def get_success_trend(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计月度成功率趋势"""
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {"data": [], "summary": {"total_months": 0, "trend": "无数据", "avg_monthly_win_rate": 0}}

    # 按月分组
    monthly_data = {}
    for r in recs:
        if r.final_return_rate is None:
            continue
        month = r.recommend_date.strftime("%Y-%m")
        if month not in monthly_data:
            monthly_data[month] = []
        monthly_data[month].append(float(r.final_return_rate))

    # 计算每月统计
    trend_data = []
    for month in sorted(monthly_data.keys()):
        returns = monthly_data[month]
        count = len(returns)
        win_count = sum(1 for r in returns if r > 0)
        win_rate = win_count / count if count > 0 else 0
        avg_return = sum(returns) / count if count > 0 else 0
        trend_data.append({
            "month": month,
            "win_rate": round(win_rate, 3),
            "count": count,
            "avg_return": round(avg_return, 4),
        })

    # 判断趋势
    if len(trend_data) >= 3:
        recent = trend_data[-3:]
        earlier = trend_data[:3]
        recent_avg = sum(d["win_rate"] for d in recent) / len(recent)
        earlier_avg = sum(d["win_rate"] for d in earlier) / len(earlier)
        if recent_avg > earlier_avg + 0.05:
            trend = "上升"
        elif recent_avg < earlier_avg - 0.05:
            trend = "下降"
        else:
            trend = "平稳"
    else:
        trend = "数据不足"

    # 找最佳和最差月份
    if trend_data:
        best = max(trend_data, key=lambda x: x["win_rate"])
        worst = min(trend_data, key=lambda x: x["win_rate"])
    else:
        best = {"month": "", "win_rate": 0}
        worst = {"month": "", "win_rate": 1}

    avg_rate = sum(d["win_rate"] for d in trend_data) / len(trend_data) if trend_data else 0

    return {
        "data": trend_data,
        "summary": {
            "total_months": len(trend_data),
            "trend": trend,
            "avg_monthly_win_rate": round(avg_rate, 3),
            "best_month": best["month"],
            "worst_month": worst["month"],
        }
    }
```

- [ ] **Step 5: 验证服务可导入**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -c "from app.services.analysis_service import get_price_range_stats; print('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/analysis_service.py
git commit -m "feat(analysis): add price range, stock type, volatility, and trend stats"
```

---

## Task 3: 后端 - 扩展 API 路由

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: 添加新端点**

在 `backend/app/routers/analysis.py` 文件末尾添加：

```python
from app.services.analysis_service import (
    get_weekday_stats,
    get_holding_period_stats,
    get_return_distribution,
    generate_insights,
    get_price_range_stats,
    get_stock_type_stats,
    get_volatility_stats,
    get_success_trend,
)

@router.get("/price-range-stats")
def price_range_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """统计不同价格区间的推荐效果"""
    return get_price_range_stats(db, start_date, end_date)


@router.get("/stock-type-stats")
def stock_type_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """统计不同股票代码类型的推荐效果"""
    return get_stock_type_stats(db, start_date, end_date)


@router.get("/volatility-stats")
def volatility_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """统计收益波动性"""
    return get_volatility_stats(db, start_date, end_date)


@router.get("/success-trend")
def success_trend(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """统计月度成功率趋势"""
    return get_success_trend(db, start_date, end_date)
```

- [ ] **Step 2: 验证路由注册**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -c "from app.main import app; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat(analysis): add 4 new API endpoints for extended analysis"
```

---

## Task 4: 前端 - 扩展 API 调用层

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 添加新 TypeScript 接口**

在 `frontend/src/services/api.ts` 文件末尾添加：

```typescript
// ─── 扩展数据分析 API ────────────────────────────────────────────────────

export interface PriceRangeStat {
  count: number
  win_count: number
  win_rate: number
  avg_return: number
  avg_price: number
}

export interface PriceRangeStatsResponse {
  data: Record<string, PriceRangeStat>
  summary: {
    total_recommendations: number
    best_range: string
    worst_range: string
  }
}

export interface StockTypeStat {
  count: number
  win_count: number
  win_rate: number
  avg_return: number
}

export interface StockTypeStatsResponse {
  data: Record<string, StockTypeStat>
  summary: {
    total_recommendations: number
    best_type: string
    worst_type: string
  }
}

export interface VolatilityStat {
  avg_max_gain: number
  avg_max_drawdown: number
  max_gain_count: number
  max_drawdown_count: number
  gain_drawdown_ratio: number
}

export interface VolatilityStatsResponse {
  data: VolatilityStat
  summary: {
    total_recommendations: number
    risk_level: string
    insight: string
  }
}

export interface TrendDataPoint {
  month: string
  win_rate: number
  count: number
  avg_return: number
}

export interface SuccessTrendResponse {
  data: TrendDataPoint[]
  summary: {
    total_months: number
    trend: string
    avg_monthly_win_rate: number
    best_month: string
    worst_month: string
  }
}

export const extendedAnalysisApi = {
  getPriceRangeStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<PriceRangeStatsResponse>(`/analysis/price-range-stats?${params}`)
  },

  getStockTypeStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<StockTypeStatsResponse>(`/analysis/stock-type-stats?${params}`)
  },

  getVolatilityStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<VolatilityStatsResponse>(`/analysis/volatility-stats?${params}`)
  },

  getSuccessTrend: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    return apiGet<SuccessTrendResponse>(`/analysis/success-trend?${params}`)
  },
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(frontend): add extended analysis API client functions"
```

---

## Task 5: 前端 - 价格区间胜率图

**Files:**
- Create: `frontend/src/components/analysis/PriceRangeChart.tsx`

- [ ] **Step 1: 创建 PriceRangeChart 组件**

```tsx
// frontend/src/components/analysis/PriceRangeChart.tsx
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

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/analysis/PriceRangeChart.tsx
git commit -m "feat(frontend): create PriceRangeChart component"
```

---

## Task 6: 前端 - 股票代码类型胜率图

**Files:**
- Create: `frontend/src/components/analysis/StockTypeChart.tsx`

- [ ] **Step 1: 创建 StockTypeChart 组件**

```tsx
// frontend/src/components/analysis/StockTypeChart.tsx
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
  const types = ['60主板', '00中小板', '002创业板']
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
      legend: { position: 'top' as const },
      title: { display: true, text: '股票代码类型推荐效果' },
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
git add frontend/src/components/analysis/StockTypeChart.tsx
git commit -m "feat(frontend): create StockTypeChart component"
```

---

## Task 7: 前端 - 收益波动性分析图

**Files:**
- Create: `frontend/src/components/analysis/VolatilityChart.tsx`

- [ ] **Step 1: 创建 VolatilityChart 组件**

```tsx
// frontend/src/components/analysis/VolatilityChart.tsx
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
        <span>收益风险比: <strong>{data.gain_drawdown_ratio}</strong></span>
      </div>
      <Bar data={chartData} options={options} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/analysis/VolatilityChart.tsx
git commit -m "feat(frontend): create VolatilityChart component"
```

---

## Task 8: 前端 - 成功率趋势折线图

**Files:**
- Create: `frontend/src/components/analysis/SuccessTrendChart.tsx`

- [ ] **Step 1: 创建 SuccessTrendChart 组件**

```tsx
// frontend/src/components/analysis/SuccessTrendChart.tsx
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
  const months = data.map(d => d.month.slice(5))  // 只显示月份
  const winRates = data.map(d => d.win_rate * 100)

  const chartData = {
    labels: months,
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/analysis/SuccessTrendChart.tsx
git commit -m "feat(frontend): create SuccessTrendChart component"
```

---

## Task 9: 前端 - 扩展 AnalysisPage 支持 Tab

**Files:**
- Modify: `frontend/src/pages/AnalysisPage.tsx`

- [ ] **Step 1: 添加 Tab 状态和扩展数据加载**

在 `AnalysisPage.tsx` 中添加 Tab 状态和扩展数据加载逻辑。需要：
1. 添加 `activeTab` 状态（'basic' 或 'extended'）
2. 添加扩展数据状态
3. 修改 `loadData` 函数，根据 Tab 加载对应数据
4. 添加 Tab 切换 UI
5. 根据 Tab 显示不同的图表

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AnalysisPage.tsx
git commit -m "feat(frontend): add Tab switching to AnalysisPage"
```

---

## Task 10: 集成测试与验证

**Files:**
- None (手动测试)

- [ ] **Step 1: 测试后端 API**

```bash
cd /Users/libokai/IdeaProjects/QuantForge/backend
python3 -m uvicorn app.main:app --port 8000 &
sleep 2
curl http://localhost:8000/api/analysis/price-range-stats
curl http://localhost:8000/api/analysis/stock-type-stats
curl http://localhost:8000/api/analysis/volatility-stats
curl http://localhost:8000/api/analysis/success-trend
```

- [ ] **Step 2: 测试前端页面**

```bash
cd /Users/libokai/IdeaProjects/QuantForge/frontend
npm run dev
```

访问 `http://localhost:5173/analysis`，验证：
- Tab 切换正常
- 扩展分析图表正确渲染
- 洞察卡片显示

- [ ] **Step 3: Commit 最终版本**

```bash
git add -A
git commit -m "feat: complete extended analysis with price range, stock type, volatility, and trend"
```

---

## 自检清单

完成所有任务后，验证以下内容：

- [ ] 后端 API 4个新端点全部正常响应
- [ ] 前端 Tab 切换正常工作
- [ ] 扩展分析图表正确渲染
- [ ] 日期筛选功能正常
- [ ] 空数据时显示友好提示
- [ ] 代码无 TypeScript 错误
- [ ] 代码无 Python 语法错误

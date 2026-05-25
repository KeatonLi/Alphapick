# 市场情绪仪表盘实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「市场情绪」Tab，展示涨跌家数、涨停数、市场温度计、昨日涨停股今日表现

**Architecture:** 独立 mood_service + mood_router，数据直接调 akshare 获取不存储；report_service 生成报告时存储昨日涨停股供后续使用

**Tech Stack:** akshare, FastAPI, React+TypeScript, matplotlib chart_service

---

## 文件变更总览

| 文件 | 操作 |
|------|------|
| `backend/app/models/__init__.py` | 修改（MarketReport 新增字段） |
| `backend/app/services/mood_service.py` | 新增 |
| `backend/app/routers/mood.py` | 新增 |
| `backend/app/main.py` | 修改（注册新 router） |
| `frontend/src/pages/DailyReport.tsx` | 修改（新增 MarketMoodTab） |
| `frontend/src/App.tsx` | 无需修改（路由不变） |

---

## Task 1: 数据库模型新增字段

**Files:**
- Modify: `backend/app/models/__init__.py`

### Task 1.1: MarketReport 新增字段

在 `MarketReport` 类的 `html_report_path` 之后、`created_at` 之前添加两个字段：

```python
    yesterday_limit_ups: Mapped[str | None] = mapped_column(Text, nullable=True, comment="昨日涨停股代码列表JSON")
    yesterday_limit_ups_performance: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True, comment="昨日涨停股今日平均涨幅")
```

---

## Task 2: 新增 mood_service.py

**Files:**
- Create: `backend/app/services/mood_service.py`

### Task 2.1: 编写 mood_service.py

```python
# backend/app/services/mood_service.py
"""
市场情绪数据服务
直接调 akshare 获取，不依赖数据库存储
"""

import akshare as ak
import numpy as np
from datetime import date
from sqlalchemy.orm import Session
from app.models import MarketReport


def _temperature_label(score: int) -> str:
    if score <= 30:
        return "冰点"
    elif score <= 50:
        return "冷淡"
    elif score <= 65:
        return "平稳"
    elif score <= 80:
        return "活跃"
    else:
        return "狂热"


async def get_market_mood(db: Session, target_date: date) -> dict:
    """
    获取指定日期的市场情绪数据
    直接调 akshare 实时获取，辅助数据从 market_reports 表读取
    """
    try:
        df = ak.stock_zh_a_spot()
        up = int(df[df["涨跌幅"] > 0].shape[0])
        down = int(df[df["涨跌幅"] < 0].shape[0])
        flat = int(df[df["涨跌幅"] == 0].shape[0])
        limit_up = int(df[df["涨跌幅"] >= 9.5].shape[0])
        limit_down = int(df[df["涨跌幅"] <= -9.5].shape[0])

        # 市场温度计
        total = up + down + flat
        temperature = int(up / total * 100) if total > 0 else 50
        temperature = max(0, min(100, temperature))
        label = _temperature_label(temperature)

        # 从 market_reports 读取昨日涨停股今日表现
        yesterday_perf = None
        report = db.query(MarketReport).filter(
            MarketReport.report_date == target_date
        ).first()
        if report and report.yesterday_limit_ups_performance is not None:
            yesterday_perf = float(report.yesterday_limit_ups_performance)

        return {
            "success": True,
            "data": {
                "date": str(target_date),
                "up": up,
                "down": down,
                "flat": flat,
                "limit_up": limit_up,
                "limit_down": limit_down,
                "total": total,
                "temperature": temperature,
                "temperature_label": label,
                "yesterday_limit_ups_performance": yesterday_perf,
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## Task 3: 新增 mood_router.py

**Files:**
- Create: `backend/app/routers/mood.py`

### Task 3.1: 编写 mood_router.py

```python
# backend/app/routers/mood.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.services.mood_service import get_market_mood

router = APIRouter(prefix="/api/mood", tags=["mood"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/daily")
@limiter.limit("10/minute")
async def daily(
    report_date: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场情绪数据"""
    target_date = report_date or date.today()
    result = await get_market_mood(db, target_date)
    if not result["success"]:
        return result
    return result
```

---

## Task 4: 注册 mood_router

**Files:**
- Modify: `backend/app/main.py`

### Task 4.1: 在 main.py 注册 router

```python
# 在现有的 router 导入中添加：
from app.routers import stock, recommend, report, mood

# 在 app.include_router 那一行添加：
app.include_router(mood.router)
```

---

## Task 5: 重写 report_service.py（生成报告时记录昨日涨停）

**Files:**
- Modify: `backend/app/services/report_service.py`

### Task 5.1: 修改 generate_daily_report

在 `generate_daily_report` 函数中，生成报告时额外抓取昨日涨停股票代码列表并存储：

在 `index_data` 和 `sectors_data` 抓取完成后，添加：

```python
    # 抓取昨日涨停股（用于市场情绪仪表盘）
    try:
        df_spot = ak.stock_zh_a_spot()
        yesterday_limit_ups = df_spot[df_spot["涨跌幅"] >= 9.5]["代码"].tolist()
        yesterday_limit_ups_json = json.dumps(yesterday_limit_ups, ensure_ascii=False)
    except Exception:
        yesterday_limit_ups_json = "[]"

    # 计算昨日涨停股今日表现（从数据库读昨天的报告）
    yesterday_limit_ups_perf = None
    yesterday_report = db.query(MarketReport).filter(
        MarketReport.report_date == today
    ).first()
    if yesterday_report and yesterday_report.yesterday_limit_ups:
        try:
            yesterday_codes = json.loads(yesterday_report.yesterday_limit_ups)
            if yesterday_codes:
                df_today = ak.stock_zh_a_spot()
                today_perfs = []
                for code in yesterday_codes[:50]:  # 最多50只
                    row = df_today[df_today["代码"] == code]
                    if not row.empty:
                        pct = float(str(row.iloc[0].get("涨跌幅", "0")))
                        today_perfs.append(pct)
                if today_perfs:
                    yesterday_limit_ups_perf = round(np.mean(today_perfs), 2)
        except Exception:
            pass
```

同时在创建 `MarketReport` 时添加这两个字段的赋值：

```python
        target_report = MarketReport(
            report_date=today,
            market_summary=market_summary,
            index_data=json.dumps(index_data, ensure_ascii=False),
            hot_sectors=json.dumps(sectors_data, ensure_ascii=False),
            ai_report=ai_report_text,
            yesterday_limit_ups=yesterday_limit_ups_json,
            yesterday_limit_ups_performance=yesterday_limit_ups_perf,
        )
```

更新 existing 报告时也同步：

```python
        existing.yesterday_limit_ups = yesterday_limit_ups_json
        existing.yesterday_limit_ups_performance = yesterday_limit_ups_perf
```

---

## Task 6: 前端新增 MarketMoodTab

**Files:**
- Modify: `frontend/src/pages/DailyReport.tsx`

### Task 6.1: 新增 MarketMoodTab 组件

在 `DailyReport.tsx` 文件末尾（在 `export default function DailyReport()` 之前）添加：

```typescript
// ─── Tab: 市场情绪 ───────────────────────────────────────────────────────

interface MoodData {
  date: string; up: number; down: number; flat: number
  limit_up: number; limit_down: number; total: number
  temperature: number; temperature_label: string
  yesterday_limit_ups_performance: number | null
}

function MarketMoodTab({ date }: { date: string }) {
  const [mood, setMood] = useState<MoodData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await apiGet<any>(`/mood/daily?date=${date}`)
      if (r.success) setMood(r.data)
      else setError(r.error || '获取失败')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const tempColor = (score: number) =>
    score <= 30 ? 'text-blue-600' : score <= 50 ? 'text-slate-500' :
    score <= 65 ? 'text-amber-500' : score <= 80 ? 'text-orange-500' : 'text-red-500'

  const tempBg = (score: number) =>
    score <= 30 ? 'from-blue-50 to-blue-100 border-blue-200' :
    score <= 50 ? 'from-slate-50 to-slate-100 border-slate-200' :
    score <= 65 ? 'from-amber-50 to-amber-100 border-amber-200' :
    score <= 80 ? 'from-orange-50 to-orange-100 border-orange-200' :
    'from-red-50 to-red-100 border-red-200'

  const tempEmoji = (label: string) =>
    label === '冰点' ? '🧊' : label === '冷淡' ? '❄' :
    label === '平稳' ? '🌤' : label === '活跃' ? '🔥' : '🤯'

  if (loading) return <div className="space-y-4">{[0,1,2].map(i => <div key={i} className="skeleton h-28 rounded-2xl"/>)}</div>
  if (error) return <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
  if (!mood) return null

  return (
    <div className="space-y-5 fade-in-up">
      {/* 涨跌家数卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '上涨', value: mood.up, color: 'from-red-50 to-red-100 border-red-200', text: 'text-red-500', suffix: '' },
          { label: '下跌', value: mood.down, color: 'from-green-50 to-green-100 border-green-200', text: 'text-green-500', suffix: '' },
          { label: '平盘', value: mood.flat, color: 'from-slate-50 to-slate-100 border-slate-200', text: 'text-slate-400', suffix: '' },
          { label: '涨停', value: mood.limit_up, color: 'from-amber-50 to-amber-100 border-amber-200', text: 'text-amber-500', suffix: '' },
        ].map((s, i) => (
          <div key={i} className={`stock-card p-4 text-center bg-gradient-to-br ${s.color} border`}>
            <div className={`text-2xl md:text-3xl font-extrabold ${s.text} mb-0.5`}>{s.value.toLocaleString()}{s.suffix}</div>
            <div className="text-xs text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 市场温度计 + 昨日涨停表现 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 温度计 */}
        <div className={`stock-card p-5 bg-gradient-to-br ${tempBg(mood.temperature)} border`}>
          <div className="text-xs text-text-muted mb-2">市场温度计</div>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{tempEmoji(mood.temperature_label)}</span>
            <div>
              <div className={`text-4xl font-extrabold ${tempColor(mood.temperature)}`}>{mood.temperature}</div>
              <div className={`text-sm font-semibold ${tempColor(mood.temperature)}`}>{mood.temperature_label}</div>
            </div>
          </div>
          <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${
              mood.temperature <= 30 ? 'bg-blue-400' :
              mood.temperature <= 50 ? 'bg-slate-400' :
              mood.temperature <= 65 ? 'bg-amber-400' :
              mood.temperature <= 80 ? 'bg-orange-400' : 'bg-red-400'
            }`} style={{ width: `${mood.temperature}%` }}/>
          </div>
        </div>

        {/* 昨日涨停表现 */}
        <div className="stock-card p-5 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
          <div className="text-xs text-text-muted mb-2">昨日涨停股今日表现</div>
          {mood.yesterday_limit_ups_performance !== null ? (
            <div>
              <div className={`text-4xl font-extrabold ${mood.yesterday_limit_ups_performance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {mood.yesterday_limit_ups_performance >= 0 ? '+' : ''}{mood.yesterday_limit_ups_performance}%
              </div>
              <div className="text-xs text-text-muted mt-1">昨日涨停股今日平均涨幅</div>
            </div>
          ) : (
            <div className="text-text-muted text-sm">暂无数据</div>
          )}
        </div>
      </div>

      {/* 涨跌家数柱状图 */}
      <div className="stock-card p-5">
        <div className="text-sm font-semibold text-text-muted mb-4">涨跌家数分布</div>
        <div className="flex gap-2 items-end h-32">
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-red-400 rounded-t-md" style={{ height: `${(mood.up / mood.total * 100).toFixed(1)}%` }} />
            <div className="text-xs text-red-500 font-bold">{mood.up}</div>
            <div className="text-xs text-text-muted">上涨</div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-green-400 rounded-t-md" style={{ height: `${(mood.down / mood.total * 100).toFixed(1)}%` }} />
            <div className="text-xs text-green-500 font-bold">{mood.down}</div>
            <div className="text-xs text-text-muted">下跌</div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-slate-300 rounded-t-md" style={{ height: `${(mood.flat / mood.total * 100).toFixed(1)}%` }} />
            <div className="text-xs text-slate-500 font-bold">{mood.flat}</div>
            <div className="text-xs text-text-muted">平盘</div>
          </div>
        </div>
        <div className="text-center text-xs text-text-muted mt-2">全市场共 {mood.total.toLocaleString()} 只</div>
      </div>
    </div>
  )
}
```

### Task 6.2: 在 Tab 列表和渲染中添加 mood tab

在 `DailyReport.tsx` 的 `tabs` 数组中添加：

```typescript
{ key: 'mood', label: '市场情绪' },
```

在 tab 内容渲染中添加：

```typescript
{tab === 'mood' && <MarketMoodTab date={selectedDate}/>}
```

---

## 实施顺序

1. Task 1 — 数据库模型新增字段
2. Task 2 — 新增 mood_service.py
3. Task 3 — 新增 mood_router.py
4. Task 4 — 注册 router
5. Task 5 — 修改 report_service.py
6. Task 6 — 前端新增 MarketMoodTab
7. 构建 + 部署

---

## Spec Coverage 检查

| 设计需求 | 对应实现 |
|---------|---------|
| 上涨/下跌/平盘家数 | Task 2 + Task 6 |
| 涨停/跌停数 | Task 2 + Task 6 |
| 昨日涨停股今日表现 | Task 5（存储）+ Task 2（读取）+ Task 6 |
| 市场温度计 | Task 2 + Task 6 |
| 新增 Tab | Task 6 |
| 数据库字段 | Task 1 + Task 5 |

---

## 自查

- ✅ 无 placeholder
- ✅ 类型一致性（`temperature` int, `yesterday_limit_ups_performance` float|null）
- ✅ 范围集中（每个 Task 单一职责）
- ✅ 依赖关系清晰（Task 1,2,3,4 → 5 → 6）

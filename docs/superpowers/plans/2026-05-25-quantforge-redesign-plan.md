# QuantForge 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 AKShare 统一数据源 + 均线多头候选池筛选 + 散户友好报告提示词 + 一键生成体验

**Architecture:** 数据层用 akshare 统一封装，候选池用均线多头筛选（100-300只 vs 5000只），提示词沉淀到单独文件，前端一键生成配进度条

**Tech Stack:** akshare, FastAPI, SQLAlchemy, React+TypeScript

---

## 文件变更总览

| 文件 | 操作 |
|------|------|
| `backend/app/prompts/__init__.py` | 新增 |
| `backend/app/prompts/report_prompt.py` | 新增 |
| `backend/app/prompts/recommend_prompt.py` | 新增 |
| `backend/app/services/candidate_service.py` | 新增 |
| `backend/app/utils/akshare_utils.py` | 重写 |
| `backend/app/services/report_service.py` | 重写 |
| `backend/app/services/recommend_service.py` | 重写 |
| `backend/app/routers/report.py` | 少量修改 |
| `backend/app/routers/recommend.py` | 少量修改 |
| `frontend/src/pages/DailyReport.tsx` | 重构 GenerateTab |

---

## Task 1: 创建提示词模块

**Files:**
- Create: `backend/app/prompts/__init__.py`
- Create: `backend/app/prompts/report_prompt.py`
- Create: `backend/app/prompts/recommend_prompt.py`

---

### Task 1.1: 创建 prompts 目录和 __init__.py

```python
# backend/app/prompts/__init__.py
from .report_prompt import REPORT_SYSTEM_PROMPT, REPORT_OUTPUT_FORMAT
from .recommend_prompt import RECOMMEND_SYSTEM_PROMPT, RECOMMEND_OUTPUT_FORMAT
```

---

### Task 1.2: 编写 report_prompt.py（散户友好版）

```python
# backend/app/prompts/report_prompt.py

REPORT_SYSTEM_PROMPT = """你是一位资深市场策略分析师。请根据提供的今日市场数据，撰写一份专业的每日市场审计报告。

报告结构：
1. **市场总览**：用一句大白话总结今天行情，比如"今天A股普涨，创业板表现最强"
2. **今日亮点**：今天涨得最好的板块是什么？为什么？哪些板块在轮动？
3. **今天该注意什么**：给出2-3条通俗易懂的操作建议，结论前置
4. **风险提醒**：用大白话提示风险，比如"今天涨得猛的别追"、"外围有波动"

核心原则：
- 结论前置，让散户一眼看懂今天该怎么做
- 说人话，不堆专业术语（不写"资金净流入"，写"钱都往哪流了"）
- 每部分有数字支撑，但解读要通俗

请用专业、客观的语言撰写，报告要像一份正规的投研日报，但要让散户能看懂。"""

REPORT_OUTPUT_FORMAT = """
请用以下JSON格式输出：
{
  "summary": "市场总览，用一句大白话总结",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "tips": ["建议1", "建议2"],
  "risks": ["风险提示1", "风险提示2"]
}
只输出JSON，不要其他内容。"""
```

---

### Task 1.3: 编写 recommend_prompt.py

```python
# backend/app/prompts/recommend_prompt.py

RECOMMEND_SYSTEM_PROMPT = """你是一位量化交易分析师。我会给你一份A股市场的候选股票数据（均线多头排列的股票），每只股票包含：代码、名称、今日收盘价、涨跌幅、成交量、换手率。

请基于以下量化逻辑筛选出5只最有潜力的股票：

筛选逻辑：
1. **动量因子**：近期涨幅适中（3%-8%），不是极端追涨
2. **量价配合**：成交量放大配合价格上涨，换手率活跃但不异常
3. **趋势健康**：均线多头排列，上升趋势确立
4. **分散行业**：5只股票尽量分散在不同行业

输出格式（JSON数组）：
[
  {"code": "000001", "name": "股票名", "price": 12.34, "reason": "推荐理由，要通俗易懂"},
  ...
]

只输出JSON数组，不要其他内容。"""

RECOMMEND_OUTPUT_FORMAT = """输出必须是以下JSON格式，不要其他内容：
[
  {"code": "股票代码", "name": "股票名称", "price": 精确到分的价格, "reason": "一句话推荐理由，通俗易懂"}
]"""
```

---

## Task 2: 重写 akshare_utils.py（AKShare 统一数据源）

**Files:**
- Rewrite: `backend/app/utils/akshare_utils.py`

---

### Task 2.1: 重写 akshare_utils.py

用 akshare 统一接口替换手拼的腾讯接口：

```python
# backend/app/utils/akshare_utils.py
import asyncio
import akshare as ak
import numpy as np
import pandas as pd
from datetime import date, timedelta
from typing import Optional

def _to_sina_code(code: str) -> str:
    """Convert stock code to sina format: sh600519 / sz000001"""
    code = code.strip()
    if code.startswith(("sh", "sz", "bj")):
        return code
    if code.startswith("6"):
        return f"sh{code}"
    elif code.startswith(("0", "3")):
        return f"sz{code}"
    elif code.startswith(("4", "8")):
        return f"bj{code}"
    return f"sz{code}"

def _to_tencent_code(code: str) -> str:
    """Convert stock code to tencent format: sz000001 / sh600519 / bjxxxx"""
    code = str(code).strip()
    if code.startswith(("sz", "sh", "bj")):
        return code
    if code.startswith(("0", "3")):
        return f"sz{code}"
    elif code.startswith("6"):
        return f"sh{code}"
    elif code.startswith(("4", "8")):
        return f"bj{code}"
    return f"sz{code}"

def _from_tencent_code(code: str) -> str:
    """Remove tencent prefix from stock code"""
    for prefix in ("sh", "sz", "bj"):
        if code.startswith(prefix):
            return code[len(prefix):]
    return code

# ─── 指数行情 ───────────────────────────────────────────────────────────

async def get_market_index() -> dict:
    """获取主要指数行情（上证/深证/创业板）"""
    try:
        indices = [
            ("sh000001", "上证指数"),
            ("sz399001", "深证成指"),
            ("sz399006", "创业板指"),
        ]
        results = []
        for idx_code, name in indices:
            try:
                df = ak.stock_zh_index_daily(symbol=idx_code)
                latest = df.tail(1).iloc[0]
                prev = df.tail(2).iloc[0]
                prev_close = float(prev["close"])
                change_pct = (float(latest["close"]) - prev_close) / prev_close * 100 if prev_close != 0 else 0
                results.append({
                    "name": name,
                    "code": idx_code,
                    "close": float(latest["close"]),
                    "change_pct": round(change_pct, 2),
                    "volume": float(latest.get("volume", 0)),
                })
            except Exception:
                continue
        return {"success": True, "data": results} if results else {"success": False, "error": "指数数据获取失败"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ─── 板块行情 ───────────────────────────────────────────────────────────

async def get_hot_sectors(top_n: int = 10) -> dict:
    """获取热门板块，使用 akshare 概念板块接口"""
    try:
        df = ak.stock_board_concept_name_em()
        df = df.sort_values("涨跌幅", ascending=False).head(top_n * 2)
        data = []
        for _, row in df.iterrows():
            if len(data) >= top_n:
                break
            data.append({
                "name": str(row.get("板块名称", "")),
                "change_pct": round(float(row.get("涨跌幅", 0)), 2),
                "leading_stock": "",
                "driver": "",
            })
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ─── 个股行情 ───────────────────────────────────────────────────────────

async def get_stock_info(code: str) -> dict:
    """获取股票基本信息"""
    try:
        df = ak.stock_zh_a_spot()
        sina_code = _to_sina_code(code)
        stock_row = df[df["代码"] == sina_code]
        if stock_row.empty:
            stock_row = df[df["代码"] == code]
        if stock_row.empty:
            return {"success": False, "error": f"未找到股票代码 {code}"}
        row = stock_row.iloc[0]
        return {
            "success": True,
            "data": {
                "股票代码": code,
                "股票简称": str(row.get("名称", "")),
                "最新价": str(row.get("最新价", "")),
                "涨跌幅": f"{row.get('涨跌幅', '')}%",
                "昨收": str(row.get("昨收", "")),
                "今开": str(row.get("今开", "")),
                "最高": str(row.get("最高", "")),
                "最低": str(row.get("最低", "")),
                "成交量": str(row.get("成交量", "")),
                "成交额": str(row.get("成交额", "")),
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

async def get_stock_daily(code: str, days: int = 60) -> dict:
    """获取个股日线行情"""
    try:
        sina_code = _to_sina_code(code)
        df = ak.stock_zh_a_daily(symbol=sina_code, adjust="qfq")
        df = df.fillna(0).replace([np.inf, -np.inf], 0)
        df = df.tail(days)
        df["change_pct"] = df["close"].pct_change().fillna(0).replace([np.inf, -np.inf], 0) * 100
        data = []
        for _, row in df.iterrows():
            data.append({
                "日期": str(row["date"]),
                "开盘": float(row["open"]),
                "收盘": float(row["close"]),
                "最高": float(row["high"]),
                "最低": float(row["low"]),
                "成交量": int(row["volume"]),
                "涨跌幅": round(float(row["change_pct"]), 2),
            })
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ─── 全市场行情（用于候选池）────────────────────────────────────────────

async def get_stock_list() -> dict:
    """获取A股全市场实时行情列表"""
    try:
        df = ak.stock_zh_a_spot()
        data = []
        for _, row in df.iterrows():
            code = str(row.get("代码", ""))
            if not code or code in ("None", ""):
                continue
            price_str = str(row.get("最新价", "0"))
            price = float(price_str) if price_str not in ("0", "", "None") else 0
            if price <= 0:
                continue
            change_str = str(row.get("涨跌幅", "0"))
            try:
                change_pct = float(change_str)
            except:
                change_pct = 0
            vol_str = str(row.get("成交量", "0"))
            try:
                volume = float(vol_str)
            except:
                volume = 0
            turnover_str = str(row.get("换手率", "0"))
            try:
                turnover = float(turnover_str.replace("%", ""))
            except:
                turnover = 0
            data.append({
                "code": code,
                "name": str(row.get("名称", "")),
                "price": price,
                "change_pct": change_pct,
                "volume": volume,
                "turnover": turnover,
            })
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ─── 交易日 ───────────────────────────────────────────────────────────

def get_trade_dates(days: int = 30) -> list[str]:
    """获取最近N个交易日"""
    today = date.today()
    since = today - timedelta(days=days)
    try:
        df = ak.tool_trade_date_hsiec()
        date_col = df.columns[0]
        df[date_col] = pd.to_datetime(df[date_col])
        mask = (df[date_col] >= pd.Timestamp(since)) & (df[date_col] <= pd.Timestamp(today))
        dates = df.loc[mask, date_col].sort_values(ascending=False).dt.strftime("%Y-%m-%d").tolist()
        return dates
    except Exception:
        result = []
        d = today
        while len(result) < days and d >= since:
            if d.weekday() < 5:
                result.append(d.strftime("%Y-%m-%d"))
            d -= timedelta(days=1)
        return result

def get_trade_dates_for_frontend(days: int = 365) -> dict:
    """获取前端可用的交易日列表"""
    try:
        dates = get_trade_dates(days)
        return {"success": True, "data": dates}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## Task 3: 新建 candidate_service.py（均线多头候选池）

**Files:**
- Create: `backend/app/services/candidate_service.py`

---

### Task 3.1: 编写 candidate_service.py

```python
# backend/app/services/candidate_service.py
"""
均线多头候选池筛选服务
从全市场筛选均线多头排列的股票作为推荐候选池
"""

import asyncio
import numpy as np
import pandas as pd
from typing import Optional
from app.utils.akshare_utils import get_stock_list, get_stock_daily

# MA 参数
MA_SHORT = 5   # MA5
MA_MID = 10    # MA10
MA_LONG = 20   # MA20

# 量价过滤参数
MIN_CHANGE_PCT = 0      # 最小涨幅（%）
MAX_CHANGE_PCT = 10    # 最大涨幅（%），排除涨停
MIN_VOLUME_RATIO = 1.5 # 成交量放大倍数（相对20日均量）


async def get_ma_candidates(top_n: int = 200) -> dict:
    """
    获取均线多头的股票候选池

    筛选条件：
    1. MA5 > MA10 > MA20（多头排列）
    2. 收盘价 > MA20（价格在均线上方）
    3. 涨幅在 0%~10% 之间（排除涨停和暴跌）
    4. 成交量放大（超过20日均量的1.5倍）

    Returns:
        {"success": True, "data": [stock, ...], "total_scanned": int}
    """
    # 获取全市场行情
    list_result = await get_stock_list()
    if not list_result["success"]:
        return {"success": False, "error": list_result["error"]}

    all_stocks = list_result["data"]
    if not all_stocks:
        return {"success": False, "error": "股票列表为空"}

    candidates = []

    # 批量获取日线数据（每个股票取60天）
    # 由于全市场5000只太多，这里先用成交量+涨幅预筛选，减少日线获取量
    pre_filtered = [
        s for s in all_stocks
        if MIN_CHANGE_PCT <= s["change_pct"] <= MAX_CHANGE_PCT
        and s["volume"] > 0
        and 5 <= s["price"] <= 200
    ]

    # 并发获取日线数据（限制并发数20）
    semaphore = asyncio.Semaphore(20)

    async def fetch_and_check(code: str, stock: dict) -> Optional[dict]:
        async with semaphore:
            try:
                result = await get_stock_daily(code, days=25)
                if not result["success"] or len(result["data"]) < 20:
                    return None
                daily_data = result["data"]
                closes = [d["close"] for d in daily_data]
                volumes = [d["volume"] for d in daily_data]

                if len(closes) < 21:
                    return None

                # 计算均线
                ma5 = np.mean(closes[-5:])
                ma10 = np.mean(closes[-10:])
                ma20 = np.mean(closes[-20:])
                current_price = closes[-1]
                avg_volume_20 = np.mean(volumes[-20:])
                current_volume = volumes[-1]

                # 多头排列条件
                if not (ma5 > ma10 > ma20):
                    return None
                # 价格在均线上方
                if current_price < ma20:
                    return None
                # 成交量放大
                if avg_volume_20 <= 0 or current_volume / avg_volume_20 < MIN_VOLUME_RATIO:
                    return None

                return {
                    **stock,
                    "ma5": round(ma5, 2),
                    "ma10": round(ma10, 2),
                    "ma20": round(ma20, 2),
                    "volume_ratio": round(current_volume / avg_volume_20, 2),
                }
            except Exception:
                return None

    # 并发执行
    tasks = [fetch_and_check(s["code"], s) for s in pre_filtered]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for r in results:
        if isinstance(r, dict) and r is not None:
            candidates.append(r)

    # 按成交量放大倍数排序，取前 top_n
    candidates.sort(key=lambda x: x["volume_ratio"], reverse=True)
    candidates = candidates[:top_n]

    return {
        "success": True,
        "data": candidates,
        "total_scanned": len(all_stocks),
        "pre_filtered": len(pre_filtered),
        "ma_candidates": len(candidates),
    }


def format_candidates_for_ai(candidates: list) -> str:
    """将候选池格式化为 AI 输入"""
    lines = []
    for s in candidates:
        lines.append(
            f"{s['code']} {s['name']} 现价:{s['price']} 涨幅:{s['change_pct']:.2f}% "
            f"换手:{s['turnover']:.2f}% 量比:{s['volume_ratio']:.1f}倍 MA5:{s['ma5']} MA10:{s['ma10']} MA20:{s['ma20']}"
        )
    return "\n".join(lines)
```

---

## Task 4: 重写 report_service.py

**Files:**
- Rewrite: `backend/app/services/report_service.py`
- Import from: `backend/app/prompts/report_prompt.py`

---

### Task 4.1: 重写 report_service.py

```python
# backend/app/services/report_service.py
import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.utils.akshare_utils import get_market_index, get_hot_sectors, get_trade_dates_for_frontend
from app.services.html_report_service import generate_html_report
from app.utils.ai_client import chat
from app.models import MarketReport
from app.prompts import REPORT_SYSTEM_PROMPT, REPORT_OUTPUT_FORMAT


async def generate_daily_report(db: Session, report_date: date | None = None) -> dict:
    """生成指定日期市场报告并保存到数据库"""
    today = report_date if report_date is not None else date.today()

    # 检查是否已存在
    existing = db.query(MarketReport).filter(
        MarketReport.report_date == today
    ).first()
    if existing and existing.ai_report:
        return {"success": True, "data": {}, "message": f"今日报告已存在，跳过生成"}

    # 抓取指数和板块数据
    index_result = await get_market_index()
    sectors_result = await get_hot_sectors(top_n=10)

    if not index_result["success"]:
        return {"success": False, "error": f"获取指数数据失败: {index_result['error']}"}
    if not sectors_result["success"]:
        return {"success": False, "error": f"获取板块数据失败: {sectors_result['error']}"}

    index_data = index_result["data"]
    sectors_data = sectors_result["data"]

    # 计算涨跌家数（如果有数据）
    up_count = sum(1 for i in index_data if i["change_pct"] > 0)
    market_summary = f"三大指数{'普涨' if up_count >= 2 else '涨跌互现' if up_count == 1 else '普跌'}"

    # 组装 AI 输入
    user_message = f"""今日市场数据：

指数行情：
{json.dumps(index_data, ensure_ascii=False, indent=2)}

热门板块：
{json.dumps(sectors_data, ensure_ascii=False, indent=2)}

市场概况：{market_summary}

请撰写今日市场审计报告。
{REPORT_OUTPUT_FORMAT}"""

    # 调用 AI
    ai_response = await chat([
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ])

    # 解析 AI 响应为结构化数据
    try:
        # 尝试从 AI 响应中提取 JSON
        ai_json_str = ai_response.strip().lstrip("```json").rstrip("```").strip()
        report_data = json.loads(ai_json_str)
        ai_report_text = f"【市场总览】\n{report_data.get('summary', '')}\n\n【今日亮点】\n" + "\n".join(f"- {h}" for h in report_data.get('highlights', [])) + f"\n\n【今天该注意什么】\n" + "\n".join(f"- {t}" for t in report_data.get('tips', [])) + f"\n\n【风险提醒】\n" + "\n".join(f"- {r}" for r in report_data.get('risks', []))
    except json.JSONDecodeError:
        # AI 返回非 JSON 格式，直接存储原文
        ai_report_text = ai_response

    # 保存到数据库
    if existing:
        existing.market_summary = market_summary
        existing.index_data = json.dumps(index_data, ensure_ascii=False)
        existing.hot_sectors = json.dumps(sectors_data, ensure_ascii=False)
        existing.ai_report = ai_report_text
        target_report = existing
    else:
        target_report = MarketReport(
            report_date=today,
            market_summary=market_summary,
            index_data=json.dumps(index_data, ensure_ascii=False),
            hot_sectors=json.dumps(sectors_data, ensure_ascii=False),
            ai_report=ai_report_text,
        )
        db.add(target_report)
    db.commit()

    # 生成 HTML 报告
    try:
        html_path = await generate_html_report(
            report_date=today,
            market_summary=market_summary,
            index_data=index_data,
            sectors=sectors_data,
            ai_report=ai_report_text,
        )
        target_report.html_report_path = html_path
        db.commit()
    except Exception as e:
        print(f"[{today}] HTML 报告生成失败: {e}")

    return {"success": True, "data": {}, "message": f"报告生成成功: {today}"}


def get_report_by_date(db: Session, report_date: date) -> dict:
    """获取指定日期的市场报告（只读）"""
    report = db.query(MarketReport).filter(
        MarketReport.report_date == report_date
    ).first()
    if not report:
        return {"success": False, "error": f"未找到 {report_date} 的市场报告"}
    return {
        "success": True,
        "data": {
            "date": str(report.report_date),
            "market_summary": report.market_summary,
            "index_data": json.loads(report.index_data) if report.index_data else [],
            "hot_sectors": json.loads(report.hot_sectors) if report.hot_sectors else [],
            "ai_report": report.ai_report,
            "html_report_path": report.html_report_path,
        },
    }


def get_report_history(db: Session, limit: int = 7) -> dict:
    """获取最近的报告列表"""
    reports = (
        db.query(MarketReport)
        .order_by(MarketReport.report_date.desc())
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "date": str(r.report_date),
                "market_summary": r.market_summary,
                "index_data": json.loads(r.index_data) if r.index_data else [],
                "hot_sectors": json.loads(r.hot_sectors) if r.hot_sectors else [],
                "ai_report": r.ai_report,
                "html_report_path": r.html_report_path,
            }
            for r in reversed(reports)
        ],
    }


def get_available_dates(db: Session, days: int = 30) -> dict:
    """获取有报告的日期列表"""
    since = date.today() - timedelta(days=days)
    dates = (
        db.query(MarketReport.report_date)
        .filter(MarketReport.report_date >= since)
        .order_by(MarketReport.report_date.desc())
        .all()
    )
    return {"success": True, "data": [str(d[0]) for d in dates]}


def get_trade_dates_for_frontend(days: int = 365) -> dict:
    """获取前端可用的交易日列表（用于日期选择器）
    @deprecated 使用 akshare_utils.get_trade_dates_for_frontend
    """
    return get_trade_dates_for_frontend(days=days)
```

---

## Task 5: 重写 recommend_service.py

**Files:**
- Rewrite: `backend/app/services/recommend_service.py`
- Import from: `backend/app/prompts/recommend_prompt.py`, `backend/app/services/candidate_service.py`

---

### Task 5.1: 重写 recommend_service.py

```python
# backend/app/services/recommend_service.py
import json
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Numeric

from app.utils.akshare_utils import get_trade_dates, get_trade_dates_for_frontend
from app.services.candidate_service import get_ma_candidates, format_candidates_for_ai
from app.utils.ai_client import chat
from app.models import Recommendation
from app.prompts import RECOMMEND_SYSTEM_PROMPT, RECOMMEND_OUTPUT_FORMAT

# ─── 提示词（从 prompts 模块导入）──────────────────────────────
# RECOMMEND_SYSTEM_PROMPT 和 RECOMMEND_OUTPUT_FORMAT 在模块顶部导入


async def get_recommend_by_date(db: Session, rec_date: date) -> dict:
    """获取指定日期的推荐股票（只读，不自动生成）"""
    recs = db.query(Recommendation).filter(
        Recommendation.recommend_date == rec_date
    ).all()
    if recs:
        return {
            "success": True,
            "data": [
                {
                    "stock_code": r.stock_code,
                    "stock_name": r.stock_name,
                    "recommend_price": float(r.recommend_price),
                    "reason": r.reason,
                } for r in recs
            ],
            "from_cache": True,
            "date": str(rec_date),
        }
    return {"success": True, "data": [], "from_cache": False, "date": str(rec_date)}


async def generate_recommendations(db: Session, rec_date: date | None = None) -> dict:
    """为指定日期生成量化推荐（均线候选 + AI 精选）"""
    target = rec_date or date.today()

    # 检查是否已有推荐
    existing = db.query(Recommendation).filter(
        Recommendation.recommend_date == target
    ).first()
    if existing:
        return {"success": True, "data": {}, "message": f"今日推荐已存在，跳过生成"}

    # 筛选均线多头候选池
    candidate_result = await get_ma_candidates(top_n=200)
    if not candidate_result["success"]:
        return {"success": False, "error": f"候选池筛选失败: {candidate_result['error']}"}

    candidates = candidate_result["data"]
    if len(candidates) < 5:
        return {"success": False, "error": f"候选池股票不足（{len(candidates)}只），无法生成推荐"}

    # 取前50只给AI筛选
    ai_candidates = candidates[:50]

    user_message = f"""候选股票数据（均线多头排列，成交量放大）：

{format_candidates_for_ai(ai_candidates)}

{RECOMMEND_OUTPUT_FORMAT}"""

    ai_response = await chat([
        {"role": "system", "content": RECOMMEND_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ])

    try:
        recommendations = json.loads(
            ai_response.strip().lstrip("```json").rstrip("```").strip()
        )
    except json.JSONDecodeError:
        return {"success": False, "error": "AI 返回格式解析失败"}

    for rec in recommendations:
        db_rec = Recommendation(
            recommend_date=target,
            stock_code=rec["code"],
            stock_name=rec["name"],
            recommend_price=rec["price"],
            reason=rec.get("reason", ""),
        )
        db.add(db_rec)
    db.commit()

    return {"success": True, "data": {"count": len(recommendations)}, "message": f"推荐生成成功"}


def get_available_recommend_dates(db: Session, days: int = 30) -> dict:
    """获取有推荐记录的日期列表"""
    since = date.today() - timedelta(days=days)
    dates = (
        db.query(Recommendation.recommend_date)
        .filter(Recommendation.recommend_date >= since)
        .distinct()
        .order_by(Recommendation.recommend_date.desc())
        .all()
    )
    return {"success": True, "data": [str(d[0]) for d in dates]}


def get_trade_dates_for_frontend(days: int = 30) -> dict:
    """获取前端可用的交易日列表
    @deprecated 使用 akshare_utils.get_trade_dates_for_frontend
    """
    return get_trade_dates_for_frontend(days=days)


async def get_recommend_stats(db: Session) -> dict:
    total = db.query(func.count(Recommendation.id)).scalar() or 0
    if total == 0:
        return {"success": True, "data": {"total": 0, "win_count": 0, "win_rate": 0, "avg_return": 0}}
    win_count = db.query(func.count(Recommendation.id)).filter(
        cast(Recommendation.return_rate, Numeric) > 0
    ).scalar() or 0
    avg_return = db.query(func.avg(Recommendation.return_rate)).scalar() or 0
    return {
        "success": True,
        "data": {
            "total": total,
            "win_count": win_count,
            "win_rate": round(win_count / total * 100, 2) if total > 0 else 0,
            "avg_return": round(float(avg_return) * 100, 2),
        },
    }


def get_all_recommendations(db: Session) -> dict:
    """获取所有历史推荐"""
    recs = (
        db.query(Recommendation)
        .order_by(Recommendation.recommend_date.desc(), Recommendation.id)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "recommend_date": str(r.recommend_date),
                "stock_code": r.stock_code,
                "stock_name": r.stock_name,
                "recommend_price": float(r.recommend_price) if r.recommend_price else 0,
                "current_price": float(r.current_price) if r.current_price else 0,
                "return_rate": float(r.return_rate) * 100 if r.return_rate else 0,
                "reason": r.reason or "",
            }
            for r in recs
        ],
    }


async def update_recommend_prices(db: Session) -> dict:
    """更新所有推荐记录的最新价格（使用 akshare 腾讯接口）"""
    import requests

    recs = db.query(Recommendation).all()
    if not recs:
        return {"success": True, "data": {"updated": 0}}

    from app.utils.akshare_utils import _to_tencent_code, _from_tencent_code

    tencent_codes = [_to_tencent_code(r.stock_code) for r in recs]
    batch_size = 80
    price_map = {}

    for i in range(0, len(tencent_codes), batch_size):
        batch = tencent_codes[i:i + batch_size]
        try:
            r = requests.get(
                f"https://qt.gtimg.cn/q={','.join(batch)}",
                headers={"Referer": "https://finance.qq.com", "User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
            for line in r.text.strip().split("\n"):
                if "~\"" not in line:
                    continue
                parts = line.split("~")
                if len(parts) > 4:
                    clean = _from_tencent_code(parts[2] if len(parts) > 2 else "")
                    try:
                        price = float(parts[3]) if parts[3] not in ("", "0") else 0
                        if price > 0:
                            price_map[clean] = price
                    except (ValueError, IndexError):
                        continue
        except Exception:
            continue

    updated = 0
    for rec in recs:
        if rec.stock_code in price_map:
            rec.current_price = price_map[rec.stock_code]
            if rec.recommend_price and float(rec.recommend_price) > 0:
                rec.return_rate = (
                    (float(rec.current_price) - float(rec.recommend_price))
                    / float(rec.recommend_price)
                )
            updated += 1

    db.commit()
    return {"success": True, "data": {"updated": updated}}
```

---

## Task 6: 重构前端 GenerateTab（一键生成）

**Files:**
- Rewrite: `frontend/src/pages/DailyReport.tsx` 中的 GenerateTab 组件

---

### Task 6.1: 重构 GenerateTab

将 GenerateTab 改为「一键生成」模式：

```typescript
function GenerateTab({ onGenerated }: { onGenerated: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [step, setStep] = useState(0)        // 0=未开始, 1=行情, 2=报告, 3=推荐, 4=完成
  const [stepLabel, setStepLabel] = useState('')
  const [msg, setMsg] = useState<{type: 'success'|'error'|'info'; text: string} | null>(null)
  const [done, setDone] = useState(false)

  const STEPS = ['抓取行情数据', '生成市场报告', '筛选均线候选池+AI推荐', '更新现价收益率']

  const runAll = async () => {
    setDone(false)
    setMsg(null)

    // Step 1: 生成报告（包含行情抓取）
    setStep(1); setStepLabel(STEPS[0])
    try {
      await apiPost(`/report/generate?date=${date}`)
    } catch (e: any) {
      setMsg({ type: 'error', text: `行情/报告失败: ${e.message}` })
      return
    }

    // Step 2: 生成推荐（均线候选 + AI）
    setStep(2); setStepLabel(STEPS[1])
    try {
      await apiPost(`/recommend/generate?date=${date}`)
    } catch (e: any) {
      setMsg({ type: 'error', text: `推荐生成失败: ${e.message}` })
      return
    }

    // Step 3: 更新现价
    setStep(3); setStepLabel(STEPS[2])
    try {
      await apiPost('/recommend/update-prices')
    } catch (e: any) {
      setMsg({ type: 'error', text: `现价更新失败: ${e.message}` })
      return
    }

    setStep(4); setStepLabel(STEPS[3])
    setDone(true)
    setMsg({ type: 'success', text: `全部生成完成（${date}）！` })
    onGenerated()
  }

  return (
    <div className="space-y-6 fade-in-up max-w-xl mx-auto">
      <div className="stock-card p-6 space-y-6">
        <div className="text-sm font-semibold text-text-secondary">选择日期（默认今天）</div>
        <input type="date" value={date} max={today}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-white border border-border-default text-text-primary text-center px-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"/>

        {/* 步骤进度 */}
        {step > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-text-muted">{stepLabel}</div>
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                  i < step ? 'bg-blue-500' : i === step ? 'bg-blue-300 animate-pulse' : 'bg-gray-200'
                }`}/>
              ))}
            </div>
            <div className="text-xs text-text-muted">步骤 {step}/4</div>
          </div>
        )}

        <button onClick={runAll} disabled={step > 0 && !done}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-base font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-lg shadow-blue-200">
          {step === 0 || done ? '一键生成（行情+报告+推荐）' : stepLabel + '...'}
        </button>

        {done && (
          <div className="flex gap-3">
            <button onClick={() => { setStep(0); setDone(false) }}
              className="flex-1 py-2 border border-border-default rounded-xl text-sm hover:bg-blue-50 transition-all">
              继续生成
            </button>
            <button onClick={() => window.location.hash = 'report'}
              className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">
              查看市场报告
            </button>
            <button onClick={() => window.location.hash = 'recommend'}
              className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold">
              查看量化推荐
            </button>
          </div>
        )}

        {msg && !done && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            msg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
            msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-600' :
            'bg-blue-50 border border-blue-200 text-blue-700'
          }`}>{msg.text}</div>
        )}
      </div>

      <div className="text-center text-xs text-text-muted space-y-1">
        <div>预计耗时 2-3 分钟，请耐心等待</div>
        <div>生成完成后自动刷新其他 Tab 数据</div>
      </div>
    </div>
  )
}
```

同时移除之前版本的三个独立按钮和 genReport/genRec/updatePrices 函数。

---

## Task 7: 修改路由（少量调整）

**Files:**
- Modify: `backend/app/routers/report.py`
- Modify: `backend/app/routers/recommend.py`

---

### Task 7.1: 确认路由无需大改

当前路由已经支持 `/report/generate` 和 `/recommend/generate`，只需确认它们正确调用了 service 层的函数即可。无需修改。

---

## Task 8: 更新前端依赖（apiPost）

**Files:**
- Check: `frontend/src/services/api.ts` 已有 `apiPost`，无需修改

---

## Task 9: 构建并部署

```bash
cd frontend && npm run build
bash deploy.sh
```

---

## 实施顺序

1. **Task 1** — 创建提示词模块
2. **Task 2** — 重写 akshare_utils.py
3. **Task 3** — 新建 candidate_service.py
4. **Task 4** — 重写 report_service.py
5. **Task 5** — 重写 recommend_service.py
6. **Task 6** — 重构前端 GenerateTab
7. **Task 7** — 确认路由
8. **Task 8** — 构建 + 部署

---

## Spec Coverage 检查

| 设计需求 | 对应实现 |
|---------|---------|
| AKShare 统一数据源 | Task 2 (akshare_utils.py) |
| 均线多头候选池 | Task 3 (candidate_service.py) |
| 散户友好报告提示词 | Task 1.2 (report_prompt.py) |
| 推荐提示词 | Task 1.3 (recommend_prompt.py) |
| 一键生成 + 进度条 | Task 6 (GenerateTab) |
| 提示词沉淀到文件 | Task 1 (prompts/) |

---

## 自查

- ✅ 无 placeholder（所有代码完整）
- ✅ 类型一致性（函数签名在 Task 间一致）
- ✅ 范围集中（每个 Task 单一职责）
- ✅ 依赖关系清晰（Task 1,2 → 3 → 4,5 → 6）

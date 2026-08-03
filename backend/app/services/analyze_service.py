"""智能股票分析服务：输入代码/名称 → 事实包 → LLM 决策 → buy/hold 报告。

数据只读数据库（快照/日线/候选池），结论由 LLM 基于确定性事实包产出。
"""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.datasource.models import StockDailyBar, StockSpotSnapshot
from app.models import StockAnalysis
from app.services.strategy_service import compute_factor_snapshot
from app.utils.ai_client import chat

CODE_RE = re.compile(r"^(sh|sz|bj)?(\d{6})$")

ANALYZE_SYSTEM_PROMPT = """你是一位专业的A股分析师。你的任务是基于给定的确定性数据"事实包"，对个股给出中期（1-3个月）买卖判断。

判断规则：
- 仅允许输出 buy 或 hold 两种结论。
- buy：中期技术趋势、量化因子、估值中有明确支撑，风险可控。
- hold：依据不足、趋势不明朗、或估值/风险偏高，建议观望。

综合考量维度：
1. 技术面：均线排列、MACD、KDJ、区间涨跌幅、波动率
2. 量化因子：动量/趋势/流动性/数据源质量/风险惩罚，及综合评分
3. 估值：PE/PB 及相对全市场百分位（若缺失则说明数据不足）

输出必须为合法 JSON，禁止任何多余文字，格式如下：
{
  "decision": "buy" 或 "hold",
  "confidence": 0-100 的整数,
  "summary": "一句话结论",
  "reasons": ["理由1", "理由2", ...],
  "dimensions": {"technical": "技术面判断", "factors": "因子判断", "valuation": "估值判断"}
}"""


def _clean_query(query: str) -> str:
    return str(query or "").strip().lower()


def _clean_code(query: str) -> str:
    m = CODE_RE.match(query.strip().lower())
    if not m:
        return ""
    return m.group(2)


def resolve_stock(db: Session, query: str) -> dict[str, Any]:
    """把代码或名称解析为库内唯一股票。只读数据库。"""
    q = _clean_query(query)
    if not q:
        return {"success": False, "error": "empty query"}

    code = _clean_code(q)
    if code:
        row = (
            db.query(StockSpotSnapshot)
            .filter(StockSpotSnapshot.stock_code == code)
            .order_by(StockSpotSnapshot.trade_date.desc())
            .first()
        )
        if row:
            return {"success": True, "data": {"code": row.stock_code, "name": row.stock_name}}
        bar = (
            db.query(StockDailyBar)
            .filter(StockDailyBar.stock_code == code)
            .order_by(StockDailyBar.trade_date.desc())
            .first()
        )
        if bar:
            return {"success": True, "data": {"code": bar.stock_code, "name": bar.stock_name or code}}
        return {"success": False, "error": f"stock {query} not found in database"}

    exact_rows = (
        db.query(StockSpotSnapshot.stock_code, StockSpotSnapshot.stock_name)
        .filter(StockSpotSnapshot.stock_name == query.strip())
        .distinct()
        .all()
    )
    if len(exact_rows) == 1:
        return {"success": True, "data": {"code": exact_rows[0][0], "name": exact_rows[0][1]}}
    if len(exact_rows) > 1:
        candidates = [{"code": c, "name": n} for c, n in exact_rows[:10]]
        return {"success": False, "error": f"multiple stocks match '{query}', please use exact name or code", "data": {"candidates": candidates}}

    fuzzy_rows = (
        db.query(StockSpotSnapshot.stock_code, StockSpotSnapshot.stock_name)
        .filter(StockSpotSnapshot.stock_name.like(f"%{query.strip()}%"))
        .distinct()
        .all()
    )
    if len(fuzzy_rows) == 1:
        return {"success": True, "data": {"code": fuzzy_rows[0][0], "name": fuzzy_rows[0][1]}}
    if len(fuzzy_rows) > 1:
        candidates = [{"code": c, "name": n} for c, n in fuzzy_rows[:10]]
        return {"success": False, "error": f"multiple stocks match '{query}', please use exact name or code", "data": {"candidates": candidates}}

    return {"success": False, "error": f"stock '{query}' not found in database"}


def _latest_snapshot(db: Session, code: str) -> StockSpotSnapshot | None:
    return (
        db.query(StockSpotSnapshot)
        .filter(StockSpotSnapshot.stock_code == code)
        .order_by(StockSpotSnapshot.trade_date.desc())
        .first()
    )


def _daily_rows(db: Session, code: str, days: int = 60) -> list[StockDailyBar]:
    return (
        db.query(StockDailyBar)
        .filter(StockDailyBar.stock_code == code)
        .order_by(StockDailyBar.trade_date.desc())
        .limit(days)
        .all()
    )[::-1]


def _technical_facts(daily: list[StockDailyBar], latest_close: float) -> dict[str, Any]:
    if not daily:
        return {"ma": {}, "macd": {}, "kdj": {}, "range_change": None, "volatility": None}

    bars = [d for d in daily]
    closes = [float(b.close) for b in bars]
    highs = [float(b.high) for b in bars]
    lows = [float(b.low) for b in bars]

    def sma(period: int) -> float | None:
        if len(closes) < period:
            return None
        return round(sum(closes[-period:]) / period, 3)

    ma5, ma20, ma60 = sma(5), sma(20), sma(60)

    macd = _macd(closes)
    kdj = _kdj(highs, lows, closes)

    range_change = round((closes[-1] / closes[0] - 1) * 100, 2) if len(closes) >= 2 else None

    returns = [(closes[i] / closes[i - 1] - 1) for i in range(1, len(closes))]
    mean = sum(returns) / len(returns) if returns else 0
    variance = sum((r - mean) ** 2 for r in returns) / len(returns) if returns else 0
    volatility = round((variance ** 0.5) * 100, 2) if returns else None

    ma_trend = None
    if ma5 and ma20 and ma60:
        if ma5 > ma20 > ma60 and closes[-1] > ma5:
            ma_trend = "多头排列"
        elif ma5 < ma20 < ma60 and closes[-1] < ma5:
            ma_trend = "空头排列"
        else:
            ma_trend = "震荡"

    return {
        "ma": {"ma5": ma5, "ma20": ma20, "ma60": ma60, "trend": ma_trend},
        "macd": macd,
        "kdj": kdj,
        "range_change": range_change,
        "volatility": volatility,
        "latest_close": latest_close,
    }


def _ema(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    k = 2.0 / (period + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def _macd(closes: list[float]) -> dict[str, Any]:
    if len(closes) < 26:
        return {"dif": None, "dea": None, "macd": None}
    fast = _ema(closes, 12)
    slow = _ema(closes, 26)
    dif = [f - s for f, s in zip(fast, slow)]
    dea = _ema(dif, 9)
    hist = [(d - e) * 2 for d, e in zip(dif, dea)]
    return {
        "dif": round(dif[-1], 3),
        "dea": round(dea[-1], 3),
        "macd": round(hist[-1], 3),
    }


def _kdj(highs: list[float], lows: list[float], closes: list[float]) -> dict[str, Any]:
    if len(closes) < 9:
        return {"k": None, "d": None, "j": None}
    k, d = 50.0, 50.0
    for i in range(len(closes)):
        hh = max(highs[max(0, i - 8):i + 1])
        ll = min(lows[max(0, i - 8):i + 1])
        rsv = 50.0 if hh == ll else (closes[i] - ll) / (hh - ll) * 100
        k = 2 / 3 * k + 1 / 3 * rsv
        d = 2 / 3 * d + 1 / 3 * k
    j = 3 * k - 2 * d
    return {"k": round(k, 2), "d": round(d, 2), "j": round(j, 2)}


def _percentile(value: float, others: list[float]) -> float | None:
    if not others:
        return None
    below = sum(1 for v in others if v < value)
    return round(below / len(others) * 100, 1)


def _valuation_facts(db: Session, snapshot: StockSpotSnapshot | None, code: str) -> dict[str, Any]:
    if snapshot is None or snapshot.pe_dynamic is None or snapshot.pb is None:
        return {"pe": None, "pb": None, "pe_percentile": None, "pb_percentile": None}

    peers = (
        db.query(StockSpotSnapshot)
        .filter(
            StockSpotSnapshot.trade_date == snapshot.trade_date,
            StockSpotSnapshot.pe_dynamic.isnot(None),
            StockSpotSnapshot.pb.isnot(None),
        )
        .all()
    )
    pe_list = [float(p.pe_dynamic) for p in peers if p.pe_dynamic and p.pe_dynamic > 0]
    pb_list = [float(p.pb) for p in peers if p.pb and p.pb > 0]
    pe = float(snapshot.pe_dynamic)
    pb = float(snapshot.pb)
    return {
        "pe": pe,
        "pb": pb,
        "pe_percentile": _percentile(pe, pe_list),
        "pb_percentile": _percentile(pb, pb_list),
    }


def build_fact_pack(db: Session, code: str) -> dict[str, Any] | None:
    """构建确定性事实包。库内无该股数据时返回 None。"""
    snapshot = _latest_snapshot(db, code)
    daily = _daily_rows(db, code)

    if snapshot is None and not daily:
        return None

    code = snapshot.stock_code if snapshot else code
    name = snapshot.stock_name if snapshot else (daily[-1].stock_name or code if daily else code)
    latest_close = float(snapshot.close) if snapshot else float(daily[-1].close)
    asof = snapshot.trade_date if snapshot else daily[-1].trade_date

    technicals = _technical_facts(daily, latest_close)

    candidate = {
        "code": code,
        "name": name,
        "price": latest_close,
        "change_pct": float(snapshot.change_pct or 0) if snapshot else None,
        "turnover": float(snapshot.turnover_rate or 0) if snapshot else None,
        "volume": snapshot.volume if snapshot else None,
        "continuous_days": 1 if (snapshot and snapshot.change_pct and snapshot.change_pct > 0) else 0,
        "source": "db_snapshot",
    }
    factors = compute_factor_snapshot(candidate)

    valuation = _valuation_facts(db, snapshot, code)

    return {
        "stock": {"code": code, "name": name, "latest_close": latest_close, "asof": str(asof)},
        "technicals": technicals,
        "factors": factors,
        "valuation": valuation,
        "data_asof": str(asof),
    }


def parse_llm_decision(raw: str) -> dict[str, Any] | None:
    """解析 LLM 结构化输出。失败返回 None。"""
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None

    decision = data.get("decision")
    if decision not in {"buy", "hold"}:
        return None
    try:
        confidence = int(data.get("confidence"))
    except (TypeError, ValueError):
        confidence = 50
    confidence = max(0, min(confidence, 100))
    return {
        "decision": decision,
        "confidence": confidence,
        "summary": data.get("summary") or "",
        "reasons": data.get("reasons") or [],
        "dimensions": data.get("dimensions") or {},
    }


async def analyze_stock(db: Session, query: str) -> dict[str, Any]:
    """主流程：解析 → 事实包 → LLM 决策（失败重试 1 次）→ 入库。"""
    resolved = resolve_stock(db, query)
    if not resolved["success"]:
        return resolved
    code = resolved["data"]["code"]
    name = resolved["data"]["name"]

    fact_pack = build_fact_pack(db, code)
    if fact_pack is None:
        return {"success": False, "error": f"stock {code} has no data in database"}

    user_message = f"""请基于以下事实包对 {name}（{code}）给出中期（1-3个月）投资判断。

股票信息：
{json.dumps(fact_pack["stock"], ensure_ascii=False, indent=2)}

技术面：
{json.dumps(fact_pack["technicals"], ensure_ascii=False, indent=2)}

量化因子：
{json.dumps(fact_pack["factors"], ensure_ascii=False, indent=2)}

估值：
{json.dumps(fact_pack["valuation"], ensure_ascii=False, indent=2)}

请严格按要求输出 JSON。"""

    decision = None
    raw = await chat([
        {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ])
    decision = parse_llm_decision(raw)
    if decision is None:
        raw = await chat([
            {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
            {"role": "user", "content": user_message + "\n\n注意：上一次输出不是合法 JSON，请务必只输出 JSON。"},
        ])
        decision = parse_llm_decision(raw)

    if decision is None:
        return {"success": False, "error": "AI 输出无法解析为有效 JSON，请稍后重试"}

    row = StockAnalysis(
        stock_code=code,
        stock_name=name,
        decision=decision["decision"],
        confidence=decision["confidence"],
        summary=decision["summary"],
        technicals=json.dumps(fact_pack["technicals"], ensure_ascii=False),
        factors=json.dumps(fact_pack["factors"], ensure_ascii=False),
        valuation=json.dumps(fact_pack["valuation"], ensure_ascii=False),
        reasons=json.dumps(decision["reasons"], ensure_ascii=False),
        data_asof=date.fromisoformat(fact_pack["data_asof"]),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "success": True,
        "data": {
            "id": row.id,
            "stock_code": code,
            "stock_name": name,
            "decision": decision["decision"],
            "confidence": decision["confidence"],
            "summary": decision["summary"],
            "reasons": decision["reasons"],
            "dimensions": decision["dimensions"],
            "technicals": fact_pack["technicals"],
            "factors": fact_pack["factors"],
            "valuation": fact_pack["valuation"],
            "data_asof": fact_pack["data_asof"],
        },
    }


def get_analyses(db: Session, limit: int = 20) -> dict[str, Any]:
    rows = (
        db.query(StockAnalysis)
        .order_by(StockAnalysis.created_at.desc(), StockAnalysis.id.desc())
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "stock_code": r.stock_code,
                "stock_name": r.stock_name,
                "decision": r.decision,
                "confidence": r.confidence,
                "summary": r.summary or "",
                "data_asof": str(r.data_asof) if r.data_asof else None,
                "created_at": str(r.created_at) if r.created_at else None,
            }
            for r in rows
        ],
    }


def get_analysis_detail(db: Session, analysis_id: int) -> dict[str, Any] | None:
    row = db.query(StockAnalysis).filter(StockAnalysis.id == analysis_id).first()
    if row is None:
        return None

    def _loads(text: str | None) -> Any:
        if not text:
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {}

    return {
        "success": True,
        "data": {
            "id": row.id,
            "stock_code": row.stock_code,
            "stock_name": row.stock_name,
            "decision": row.decision,
            "confidence": row.confidence,
            "summary": row.summary or "",
            "reasons": _loads(row.reasons),
            "technicals": _loads(row.technicals),
            "factors": _loads(row.factors),
            "valuation": _loads(row.valuation),
            "data_asof": str(row.data_asof) if row.data_asof else None,
            "created_at": str(row.created_at) if row.created_at else None,
        },
    }

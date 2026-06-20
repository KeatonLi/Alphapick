import json
from collections import Counter, defaultdict
from datetime import date
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.datasource.models import RawDataRecord


def _num(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _int(value: Any, default: int = 0) -> int:
    if value in (None, ""):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _format_time(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = text.zfill(6)
    return f"{text[:2]}:{text[2:4]}:{text[4:6]}"


def _parse_limit_stat(value: Any) -> tuple[int, int]:
    text = str(value or "").strip()
    if "/" not in text:
        return 0, 0
    left, right = text.split("/", 1)
    return _int(left), _int(right)


def _load_latest_record(db: Session, target_date: date | None = None) -> RawDataRecord | None:
    query = db.query(RawDataRecord).filter(RawDataRecord.data_type == "limit_up_pool")
    if target_date is not None:
        query = query.filter(RawDataRecord.target_date == target_date)
    return query.order_by(desc(RawDataRecord.target_date), desc(RawDataRecord.created_at)).first()


def _normalize_item(raw: dict[str, Any]) -> dict[str, Any]:
    limit_total, limit_success = _parse_limit_stat(raw.get("涨停统计"))
    seal_amount = _num(raw.get("封板资金"))
    amount = _num(raw.get("成交额"))
    board_count = _int(raw.get("连板数"))
    break_count = _int(raw.get("炸板次数"))
    industry = raw.get("所属行业") or "未分类"
    stock_name = raw.get("名称") or ""
    stock_code = raw.get("代码") or ""
    seal_strength = min(100, round((seal_amount / max(amount, 1)) * 100, 2))

    return {
        "rank": _int(raw.get("序号")),
        "stock_code": stock_code,
        "stock_name": stock_name,
        "change_pct": round(_num(raw.get("涨跌幅")), 2),
        "latest_price": _num(raw.get("最新价")),
        "amount": amount,
        "float_market_value": _num(raw.get("流通市值")),
        "market_value": _num(raw.get("总市值")),
        "turnover_rate": round(_num(raw.get("换手率")), 2),
        "seal_amount": seal_amount,
        "first_limit_time": _format_time(raw.get("首次封板时间")),
        "last_limit_time": _format_time(raw.get("最后封板时间")),
        "break_count": break_count,
        "limit_stat": raw.get("涨停统计") or "",
        "limit_total": limit_total,
        "limit_success": limit_success,
        "board_count": board_count,
        "industry": industry,
        "seal_strength": seal_strength,
    }


def _build_industries(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        grouped[item["industry"]].append(item)

    result = []
    for industry, rows in grouped.items():
        leader = sorted(rows, key=lambda x: (x["board_count"], x["seal_amount"], -x["break_count"]), reverse=True)[0]
        avg_strength = sum(row["seal_strength"] for row in rows) / max(len(rows), 1)
        result.append({
            "industry": industry,
            "count": len(rows),
            "leader_code": leader["stock_code"],
            "leader_name": leader["stock_name"],
            "max_board_count": max(row["board_count"] for row in rows),
            "avg_seal_strength": round(avg_strength, 2),
        })

    return sorted(result, key=lambda x: (x["count"], x["max_board_count"], x["avg_seal_strength"]), reverse=True)


def get_limit_up_dates(db: Session, days: int = 60) -> dict:
    rows = (
        db.query(RawDataRecord.target_date)
        .filter(RawDataRecord.data_type == "limit_up_pool")
        .distinct()
        .order_by(desc(RawDataRecord.target_date))
        .limit(days)
        .all()
    )
    return {"success": True, "data": [str(row[0]) for row in rows]}


def get_limit_up_overview(db: Session, target_date: date | None = None) -> dict:
    record = _load_latest_record(db, target_date)
    if not record:
        return {
            "success": True,
            "data": {
                "date": str(target_date) if target_date else "",
                "source": "",
                "items": [],
                "industries": [],
                "summary": {
                    "total": 0,
                    "max_board_count": 0,
                    "first_board_count": 0,
                    "break_rate": 0,
                    "avg_seal_strength": 0,
                    "total_seal_amount": 0,
                    "top_industry": "",
                },
            },
        }

    raw = json.loads(record.raw_json)
    raw_items = raw.get("data") or []
    items = [_normalize_item(item) for item in raw_items]
    items = sorted(items, key=lambda x: (x["board_count"], x["seal_amount"], -x["break_count"]), reverse=True)
    for index, item in enumerate(items, start=1):
        item["rank"] = index

    industries = _build_industries(items)
    total = len(items)
    break_items = sum(1 for item in items if item["break_count"] > 0)
    industry_counts = Counter(item["industry"] for item in items)
    summary = {
        "total": total,
        "max_board_count": max((item["board_count"] for item in items), default=0),
        "first_board_count": sum(1 for item in items if item["board_count"] <= 1),
        "break_rate": round(break_items / total * 100, 2) if total else 0,
        "avg_seal_strength": round(sum(item["seal_strength"] for item in items) / total, 2) if total else 0,
        "total_seal_amount": sum(item["seal_amount"] for item in items),
        "top_industry": industry_counts.most_common(1)[0][0] if industry_counts else "",
    }

    return {
        "success": True,
        "data": {
            "date": str(record.target_date),
            "source": raw.get("_source") or record.source_name,
            "items": items,
            "industries": industries,
            "summary": summary,
        },
    }

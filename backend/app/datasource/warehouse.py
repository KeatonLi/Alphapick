"""Normalized market data warehouse helpers.

This module is the boundary between external collectors and strategy code:
fetchers write raw API payloads first, these helpers normalize them into query
tables, and recommendation generation reads only those normalized tables.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.datasource.models import (
    DataQualityCheck,
    RawDataRecord,
    StockCandidate,
    StockDailyBar,
    StockSpotSnapshot,
)


def _to_float(value: Any, default: float | None = None) -> float | None:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int | None = None) -> int | None:
    try:
        if value is None or value == "":
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _valid_turnover(value: Any) -> float | None:
    turnover = _to_float(value)
    if turnover is None:
        return None
    if turnover < 0 or turnover > 100:
        return None
    return turnover


def _clean_code(value: Any) -> str:
    code = str(value or "").strip().lower()
    for prefix in ("sh", "sz", "bj"):
        if code.startswith(prefix):
            code = code[2:]
    return code.zfill(6) if code.isdigit() else code


def _as_dict(row: Any) -> dict[str, Any]:
    if isinstance(row, dict):
        return row
    return {
        "stock_code": getattr(row, "stock_code", None),
        "stock_name": getattr(row, "stock_name", None),
        "close": getattr(row, "close", None),
        "change_pct": getattr(row, "change_pct", None),
        "turnover_rate": getattr(row, "turnover_rate", None),
        "volume": getattr(row, "volume", None),
    }


def parse_tencent_quote_line(line: str, target_date: date) -> dict[str, Any] | None:
    """Parse one Tencent quote string into a normalized spot snapshot row."""
    if not line or "~" not in line:
        return None

    payload = line.strip()
    if '="' in payload:
        payload = payload.split('="', 1)[1]
    payload = payload.rstrip('";')
    parts = payload.split("~")
    if len(parts) < 39:
        return None

    code = _clean_code(parts[2])
    close = _to_float(parts[3])
    if not code or close is None or close <= 0:
        return None

    return {
        "trade_date": target_date,
        "stock_code": code,
        "stock_name": parts[1],
        "open": _to_float(parts[5]),
        "high": _to_float(parts[33]),
        "low": _to_float(parts[34]),
        "close": close,
        "prev_close": _to_float(parts[4]),
        "change_pct": _to_float(parts[32]),
        "volume": _to_int(parts[36]),
        "amount": _to_float(parts[37]),
        "turnover_rate": _valid_turnover(parts[38]),
        "pe_dynamic": _to_float(parts[39]) if len(parts) > 39 else None,
        "pb": _to_float(parts[46]) if len(parts) > 46 else None,
        "source_name": "tencent",
        "raw_payload": line,
    }


def normalize_quote_item(item: Any, target_date: date) -> dict[str, Any] | None:
    """Normalize quote payloads from Tencent strings or multi-source dict rows."""
    if isinstance(item, str):
        return parse_tencent_quote_line(item, target_date)
    if not isinstance(item, dict):
        return None

    code = _clean_code(item.get("code") or item.get("stock_code") or item.get("symbol"))
    close = _to_float(item.get("price") or item.get("close") or item.get("latest"))
    if not code or close is None or close <= 0:
        return None

    return {
        "trade_date": target_date,
        "stock_code": code,
        "stock_name": item.get("name") or item.get("stock_name") or "",
        "open": _to_float(item.get("open")),
        "high": _to_float(item.get("high")),
        "low": _to_float(item.get("low")),
        "close": close,
        "prev_close": _to_float(item.get("prev_close") or item.get("pre_close")),
        "change_pct": _to_float(item.get("change_pct") or item.get("pct_chg")),
        "volume": _to_int(item.get("volume")),
        "amount": _to_float(item.get("amount")),
        "turnover_rate": _valid_turnover(item.get("turnover_rate") if item.get("turnover_rate") is not None else item.get("turnover")),
        "pe_dynamic": _to_float(item.get("pe") or item.get("pe_dynamic")),
        "pb": _to_float(item.get("pb")),
        "source_name": item.get("_source") or item.get("source") or "multi_source",
        "raw_payload": json.dumps(item, ensure_ascii=False, default=str),
    }


def build_candidates_from_snapshots(rows: Iterable[Any], top_n: int = 50) -> list[dict[str, Any]]:
    """Build a strategy candidate pool from normalized DB snapshot rows only."""
    candidates: list[dict[str, Any]] = []
    for row in rows:
        item = _as_dict(row)
        code = _clean_code(item.get("stock_code"))
        price = _to_float(item.get("close"), 0.0) or 0.0
        change_pct = _to_float(item.get("change_pct"), 0.0) or 0.0
        turnover = _to_float(item.get("turnover_rate"), 0.0) or 0.0

        if not code or not code.startswith(("00", "60")):
            continue
        if price < 5 or price > 80:
            continue
        if change_pct <= -3:
            continue

        continuous_days = 1 if change_pct > 0 else 0
        candidates.append({
            "code": code,
            "name": item.get("stock_name") or code,
            "price": price,
            "change_pct": change_pct,
            "turnover": turnover,
            "volume": _to_int(item.get("volume"), 0) or 0,
            "continuous_days": continuous_days,
            "sector": "",
            "source": "db_snapshot",
        })

    candidates.sort(key=lambda s: (-float(s["change_pct"]), -float(s["turnover"]), s["code"]))
    return candidates[:top_n]


def _upsert_quality(
    db: Session,
    target_date: date,
    data_type: str,
    status: str,
    actual_count: int,
    expected_count: int | None = None,
    message: str | None = None,
) -> None:
    row = (
        db.query(DataQualityCheck)
        .filter(DataQualityCheck.trade_date == target_date, DataQualityCheck.data_type == data_type)
        .first()
    )
    missing_count = max((expected_count or actual_count) - actual_count, 0) if expected_count else 0
    if not row:
        row = DataQualityCheck(trade_date=target_date, data_type=data_type, status=status)
        db.add(row)
    row.status = status
    row.expected_count = expected_count
    row.actual_count = actual_count
    row.missing_count = missing_count
    row.message = message


def upsert_stock_spot_snapshots_from_raw(db: Session, target_date: date) -> dict[str, Any]:
    """Normalize one day's raw stock_spot record into stock_spot_snapshots."""
    record = (
        db.query(RawDataRecord)
        .filter(RawDataRecord.data_type == "stock_spot", RawDataRecord.target_date == target_date)
        .first()
    )
    if not record:
        _upsert_quality(db, target_date, "stock_spot_snapshot", "missing", 0, message="raw stock_spot not found")
        db.commit()
        return {"success": False, "error": "raw stock_spot not found", "count": 0}

    raw = json.loads(record.raw_json)
    quotes = raw.get("quotes") or []
    rows = [r for r in (normalize_quote_item(q, target_date) for q in quotes) if r]

    db.query(StockSpotSnapshot).filter(StockSpotSnapshot.trade_date == target_date).delete()
    db.bulk_save_objects([StockSpotSnapshot(**row) for row in rows])

    status = "success" if len(rows) >= 3000 else "partial" if rows else "empty"
    _upsert_quality(
        db,
        target_date,
        "stock_spot_snapshot",
        status,
        actual_count=len(rows),
        expected_count=raw.get("quotes_count") or raw.get("total_stocks"),
        message=f"normalized {len(rows)} rows from raw stock_spot",
    )
    db.commit()
    return {"success": bool(rows), "count": len(rows), "status": status}


def get_candidates_from_db(db: Session, target_date: date, top_n: int = 50) -> dict[str, Any]:
    rows = (
        db.query(StockSpotSnapshot)
        .filter(StockSpotSnapshot.trade_date == target_date)
        .all()
    )
    if not rows:
        return {
            "success": False,
            "error": f"{target_date} has no normalized stock_spot_snapshots",
            "data": [],
        }

    candidates = build_candidates_from_snapshots(rows, top_n=top_n)
    for item in candidates:
        existing = (
            db.query(StockCandidate)
            .filter(
                StockCandidate.trade_date == target_date,
                StockCandidate.stock_code == item["code"],
            )
            .first()
        )
        payload = {
            "trade_date": target_date,
            "stock_code": item["code"],
            "stock_name": item["name"],
            "price": Decimal(str(item["price"])),
            "change_pct": Decimal(str(item["change_pct"])),
            "turnover_rate": Decimal(str(item["turnover"])),
            "volume": item.get("volume"),
            "source_name": item["source"],
            "candidate_reason": "snapshot DB filter: main board + price/liquidity/momentum",
        }
        if not existing:
            db.add(StockCandidate(**payload))
        else:
            for key, value in payload.items():
                setattr(existing, key, value)

    _upsert_quality(
        db,
        target_date,
        "stock_candidates",
        "success" if candidates else "empty",
        actual_count=len(candidates),
        message="built from stock_spot_snapshots",
    )
    db.commit()
    return {
        "success": True,
        "data": candidates,
        "total_snapshot": len(rows),
        "total_candidates": len(candidates),
        "source": "db_snapshot",
    }


def get_daily_close_rows(db: Session, stock_code: str, dates: Iterable[date]) -> dict[date, float]:
    target_dates = list(dates)
    if not target_dates:
        return {}
    rows = (
        db.query(StockDailyBar)
        .filter(
            StockDailyBar.stock_code == _clean_code(stock_code),
            StockDailyBar.trade_date.in_(target_dates),
        )
        .all()
    )
    return {row.trade_date: float(row.close) for row in rows if row.close is not None}

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.datasource.models import DataFetchLog, DataQualityCheck, StockSpotSnapshot
from app.display.data_reader import read_is_trade_date, read_trade_dates
from app.models import Recommendation
from app.models.schedule_config import ScheduleConfig
from app.services.recommend_service import get_recommend_stats


def _safe_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _safe_json(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _pick_row(rec: Recommendation) -> dict[str, Any]:
    return {
        "id": rec.id,
        "stock_code": rec.stock_code,
        "stock_name": rec.stock_name,
        "recommend_date": str(rec.recommend_date),
        "recommend_price": _safe_float(rec.recommend_price),
        "rank": rec.rec_rank or 0,
        "score": _safe_float(rec.score),
        "reason": rec.reason or "",
        "strategy_version": rec.strategy_version or "",
        "factor_snapshot": _safe_json(rec.factor_snapshot),
    }


def _tracking_row(rec: Recommendation) -> dict[str, Any]:
    row = _pick_row(rec)
    row.update({
        "status": rec.status or "tracking",
        "tracking_days": rec.tracking_days or 0,
        "current_price": _safe_float(rec.current_price),
        "return_rate": _safe_float(rec.return_rate) * 100,
        "price_day1": _safe_float(rec.price_day1),
        "price_day2": _safe_float(rec.price_day2),
        "price_day3": _safe_float(rec.price_day3),
        "price_day5": _safe_float(rec.price_day5),
        "price_day7": _safe_float(rec.price_day7),
        "return_rate_day1": _safe_float(rec.return_rate_day1) * 100,
        "return_rate_day2": _safe_float(rec.return_rate_day2) * 100,
        "return_rate_day3": _safe_float(rec.return_rate_day3) * 100,
        "return_rate_day5": _safe_float(rec.return_rate_day5) * 100,
        "return_rate_day7": _safe_float(rec.return_rate_day7) * 100,
        "final_return_rate": _safe_float(rec.final_return_rate) * 100,
        "max_gain": _safe_float(rec.max_gain) * 100,
        "max_drawdown": _safe_float(rec.max_drawdown) * 100,
    })
    return row


def _pipeline_status(db: Session, target: date, rec_count: int) -> dict[str, Any]:
    latest_stock_log = (
        db.query(DataFetchLog)
        .filter(DataFetchLog.target_date == target, DataFetchLog.data_type == "stock_spot")
        .order_by(desc(DataFetchLog.created_at))
        .first()
    )
    snapshot_quality = (
        db.query(DataQualityCheck)
        .filter(DataQualityCheck.trade_date == target, DataQualityCheck.data_type == "stock_spot_snapshot")
        .first()
    )
    snapshot_count = (
        db.query(func.count(StockSpotSnapshot.id))
        .filter(StockSpotSnapshot.trade_date == target)
        .scalar()
        or 0
    )
    config = db.query(ScheduleConfig).first()
    return {
        "data_status": snapshot_quality.status if snapshot_quality else ("success" if snapshot_count else "missing"),
        "snapshot_count": snapshot_count,
        "recommend_status": "success" if rec_count else "missing",
        "returns_status": "active",
        "last_fetch_status": latest_stock_log.status if latest_stock_log else None,
        "last_run_at": config.last_run_at if config else None,
        "last_run_result": config.last_run_result if config else None,
    }


def _avg_percent(records: list[Recommendation], field_name: str) -> float | None:
    values = [_safe_float(getattr(rec, field_name)) * 100 for rec in records if getattr(rec, field_name) is not None]
    return round(sum(values) / len(values), 2) if values else None


def _tracking_batches(recs: list[Recommendation], limit: int = 8) -> list[dict[str, Any]]:
    grouped: dict[date, list[Recommendation]] = defaultdict(list)
    for rec in recs:
        grouped[rec.recommend_date].append(rec)

    batches = []
    for rec_date in sorted(grouped.keys(), reverse=True)[:limit]:
        rows = sorted(grouped[rec_date], key=lambda rec: (rec.rec_rank or 99, rec.id))
        completed = [rec for rec in rows if rec.status == "completed"]
        batches.append({
            "date": str(rec_date),
            "count": len(rows),
            "completed_count": len(completed),
            "tracking_count": len(rows) - len(completed),
            "max_tracking_days": max((rec.tracking_days or 0 for rec in rows), default=0),
            "avg_day3": _avg_percent(rows, "return_rate_day3"),
            "avg_day5": _avg_percent(rows, "return_rate_day5"),
            "avg_day7": _avg_percent(rows, "return_rate_day7"),
            "items": [_tracking_row(rec) for rec in rows],
        })
    return batches


def _strategy_review(stats: dict[str, Any], total_tracking: int) -> dict[str, Any]:
    day3 = _safe_float(stats.get("avg_return_day3"))
    win3 = _safe_float(stats.get("win_rate_day3"))
    if day3 > 1 and win3 >= 55:
        verdict = "策略表现偏强"
        tone = "positive"
        summary = "3日收益和胜率同时站上观察线，当前推荐系统具备继续跟踪价值。"
    elif day3 < 0 or win3 < 45:
        verdict = "策略需要降温观察"
        tone = "caution"
        summary = "短周期收益或胜率偏弱，建议降低仓位假设，优先复盘失败样本。"
    else:
        verdict = "策略处于观察区间"
        tone = "neutral"
        summary = "当前结果没有明显失效，也还不足以激进放大，需要继续看5日和7日表现。"
    return {
        "verdict": verdict,
        "tone": tone,
        "summary": summary,
        "tracking_count": total_tracking,
    }


async def build_dashboard_async(db: Session, today: date | None = None) -> dict[str, Any]:
    stats_payload = (await get_recommend_stats(db)).get("data", {})
    return build_dashboard(db, today=today, stats=stats_payload)


def build_dashboard(db: Session, today: date | None = None, stats: dict[str, Any] | None = None) -> dict[str, Any]:
    current = today or date.today()
    trade_dates = read_trade_dates(db, days=60)
    parsed_trade_dates = [date.fromisoformat(d) if isinstance(d, str) else d for d in trade_dates]
    latest_trade_date = next((d for d in parsed_trade_dates if d <= current), current)
    is_trade_day = read_is_trade_date(db, current)
    target = current if is_trade_day else latest_trade_date

    today_recs = (
        db.query(Recommendation)
        .filter(Recommendation.recommend_date == target)
        .order_by(Recommendation.rec_rank.asc(), Recommendation.id.asc())
        .all()
    )
    recent_recs = (
        db.query(Recommendation)
        .order_by(Recommendation.recommend_date.desc(), Recommendation.rec_rank.asc(), Recommendation.id.asc())
        .limit(80)
        .all()
    )
    stats_payload = stats or {}
    total_tracking = sum(1 for rec in recent_recs if rec.status != "completed")

    return {
        "success": True,
        "data": {
            "today": str(current),
            "trade_date": str(target),
            "is_trade_day": is_trade_day,
            "pipeline": _pipeline_status(db, target, len(today_recs)),
            "today_picks": [_pick_row(rec) for rec in today_recs],
            "tracking_batches": _tracking_batches(recent_recs),
            "strategy_summary": stats_payload,
            "strategy_review": _strategy_review(stats_payload, total_tracking),
        },
    }

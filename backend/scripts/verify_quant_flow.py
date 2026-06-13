"""Verify the QuantForge datasource -> strategy -> tracking loop.

The default mode is read-only. Use --generate-missing-recommendations or
--update-tracking to execute write operations intentionally.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func, inspect

from app.database import Base, SessionLocal, engine
from app.datasource.flow_checks import evaluate_candidate_quality, evaluate_tracking_gaps
from app.datasource.models import DataQualityCheck, RawDataRecord, StockDailyBar, StockSpotSnapshot
from app.datasource.warehouse import build_candidates_from_snapshots, upsert_stock_spot_snapshots_from_raw
from app.display.data_reader import read_trade_days_after
from app.models import Recommendation
from app.services.recommend_service import generate_recommendations, update_recommend_prices


REQUIRED_TABLES = {
    "raw_data_records",
    "data_fetch_log",
    "stock_spot_snapshots",
    "stock_daily_bars",
    "stock_candidates",
    "data_quality_checks",
    "recommendations",
    "schedule_config",
}


def _json_default(value: Any):
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def table_status() -> dict:
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    missing = sorted(REQUIRED_TABLES - existing)
    return {
        "status": "success" if not missing else "failed",
        "missing_tables": missing,
    }


def datasource_status(db, target: date, normalize_existing_raw: bool) -> dict:
    raw = (
        db.query(RawDataRecord)
        .filter(RawDataRecord.data_type == "stock_spot", RawDataRecord.target_date == target)
        .first()
    )
    snapshot_count = db.query(func.count(StockSpotSnapshot.id)).filter(StockSpotSnapshot.trade_date == target).scalar() or 0
    normalized = None
    if raw and snapshot_count == 0 and normalize_existing_raw:
        normalized = upsert_stock_spot_snapshots_from_raw(db, target)
        snapshot_count = db.query(func.count(StockSpotSnapshot.id)).filter(StockSpotSnapshot.trade_date == target).scalar() or 0

    quality_rows = (
        db.query(DataQualityCheck)
        .filter(DataQualityCheck.trade_date == target)
        .order_by(DataQualityCheck.data_type.asc())
        .all()
    )
    return {
        "status": "success" if raw and snapshot_count > 0 else "failed",
        "has_raw_stock_spot": bool(raw),
        "snapshot_count": snapshot_count,
        "normalized": normalized,
        "quality": [
            {
                "data_type": row.data_type,
                "status": row.status,
                "actual_count": row.actual_count,
                "expected_count": row.expected_count,
                "missing_count": row.missing_count,
                "message": row.message,
            }
            for row in quality_rows
        ],
    }


def candidate_status(db, target: date) -> dict:
    snapshots = (
        db.query(StockSpotSnapshot)
        .filter(StockSpotSnapshot.trade_date == target)
        .all()
    )
    candidates = build_candidates_from_snapshots(snapshots, top_n=50)
    quality = evaluate_candidate_quality(
        snapshot_count=len(snapshots),
        candidate_count=len(candidates),
    )
    return {
        **quality,
        "top_candidates": [
            {
                "code": item["code"],
                "name": item["name"],
                "price": item["price"],
                "change_pct": item["change_pct"],
                "turnover": item["turnover"],
            }
            for item in candidates[:5]
        ],
    }


async def recommendation_status(db, target: date, generate_missing: bool) -> dict:
    rows = (
        db.query(Recommendation)
        .filter(Recommendation.recommend_date == target)
        .order_by(Recommendation.rec_rank.asc(), Recommendation.id.asc())
        .all()
    )
    generated = None
    if not rows and generate_missing:
        generated = await generate_recommendations(db, rec_date=target)
        rows = (
            db.query(Recommendation)
            .filter(Recommendation.recommend_date == target)
            .order_by(Recommendation.rec_rank.asc(), Recommendation.id.asc())
            .all()
        )

    missing_scores = [row.stock_code for row in rows if row.score is None or not row.factor_snapshot]
    return {
        "status": "success" if rows and not missing_scores else "failed" if not rows else "partial",
        "count": len(rows),
        "generated": generated,
        "missing_score_or_factor": missing_scores,
        "items": [
            {
                "code": row.stock_code,
                "name": row.stock_name,
                "rank": row.rec_rank,
                "score": float(row.score) if row.score is not None else None,
                "price": float(row.recommend_price) if row.recommend_price else None,
            }
            for row in rows[:5]
        ],
    }


async def tracking_status(db, target: date, update_tracking: bool) -> dict:
    if update_tracking:
        await update_recommend_prices(db)

    rows = db.query(Recommendation).filter(Recommendation.recommend_date == target).all()
    if not rows:
        return {"status": "failed", "error": "no recommendations for tracking"}

    checks = []
    for row in rows:
        trade_days = read_trade_days_after(db, row.recommend_date, 7)
        available = {
            d for (d,) in db.query(StockDailyBar.trade_date)
            .filter(
                StockDailyBar.stock_code == row.stock_code,
                StockDailyBar.trade_date.in_(trade_days),
            )
            .all()
        }
        gap = evaluate_tracking_gaps(row.recommend_date, trade_days, available, as_of=date.today())
        checks.append({
            "code": row.stock_code,
            "name": row.stock_name,
            "tracking_days": row.tracking_days or 0,
            "status": row.status or "tracking",
            "gap": gap,
        })

    statuses = {item["gap"]["status"] for item in checks}
    if statuses == {"success"}:
        overall = "success"
    elif statuses == {"pending"}:
        overall = "pending"
    elif "failed" in statuses and not ({"success", "partial"} & statuses):
        overall = "failed"
    else:
        overall = "partial"
    return {"status": overall, "items": checks}


async def run(args) -> dict:
    Base.metadata.create_all(bind=engine)
    target = date.fromisoformat(args.date)
    db = SessionLocal()
    try:
        result = {
            "date": target,
            "tables": table_status(),
            "datasource": datasource_status(db, target, normalize_existing_raw=args.normalize_existing_raw),
            "candidates": candidate_status(db, target),
            "recommendations": await recommendation_status(db, target, generate_missing=args.generate_missing_recommendations),
            "tracking": await tracking_status(db, target, update_tracking=args.update_tracking),
        }
        failed_sections = [
            name for name, section in result.items()
            if isinstance(section, dict) and section.get("status") == "failed"
        ]
        result["overall_status"] = "success" if not failed_sections else "failed"
        result["failed_sections"] = failed_sections
        return result
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--normalize-existing-raw", action="store_true")
    parser.add_argument("--generate-missing-recommendations", action="store_true")
    parser.add_argument("--update-tracking", action="store_true")
    args = parser.parse_args()

    result = asyncio.run(run(args))
    print(json.dumps(result, ensure_ascii=False, indent=2, default=_json_default))
    raise SystemExit(0 if result["overall_status"] == "success" else 1)


if __name__ == "__main__":
    main()

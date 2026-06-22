"""Run an isolated SQLite end-to-end quant flow check.

This script does not connect to the production database. It creates a small
SQLite database, seeds deterministic market snapshots, generates picks, advances
simulated trading days, updates returns, and prints a compact report.

Example:
    py scripts/run_sqlite_flow_check.py
    py scripts/run_sqlite_flow_check.py --db-path logs/flow_check.sqlite
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import Base
from app.datasource.models import RawDataRecord, StockSpotSnapshot
from app.models import Recommendation
from app.services.recommend_service import generate_recommendations, update_recommend_prices


STOCKS = {
    "000001": "Alpha Bank",
    "000002": "Beta Estate",
    "600001": "Gamma Steel",
}


def next_trade_days(start: date, count: int) -> list[date]:
    days = [start]
    cursor = start
    while len(days) < count:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            days.append(cursor)
    return days


def seed_trade_calendar(db, trade_days: list[date]) -> None:
    db.add(RawDataRecord(
        source_name="sqlite_flow_check",
        data_type="trade_calendar",
        target_date=trade_days[0],
        raw_json=json.dumps({"data": [day.isoformat() for day in trade_days]}),
    ))
    db.commit()


def seed_snapshot(db, trade_date: date, prices: dict[str, float]) -> None:
    for idx, (code, close) in enumerate(prices.items(), start=1):
        db.add(StockSpotSnapshot(
            trade_date=trade_date,
            stock_code=code,
            stock_name=STOCKS[code],
            open=round(close - 0.1, 4),
            high=round(close + 0.2, 4),
            low=round(close - 0.3, 4),
            close=close,
            prev_close=round(close - 0.2, 4),
            change_pct=5 - idx,
            turnover_rate=4 + idx,
            volume=1_000_000 * idx,
            source_name="sqlite_flow_check",
        ))
    db.commit()


def print_step(name: str, ok: bool, detail: str) -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")


def recommendation_rows(db) -> list[Recommendation]:
    return db.query(Recommendation).order_by(Recommendation.rec_rank.asc(), Recommendation.stock_code.asc()).all()


def run_flow(db, recommend_date: date) -> int:
    trade_days = next_trade_days(recommend_date, 8)
    seed_trade_calendar(db, trade_days)

    price_path = [
        {"000001": 10.0, "000002": 20.0, "600001": 30.0},
        {"000001": 10.5, "000002": 19.5, "600001": 31.5},
        {"000001": 11.0, "000002": 20.5, "600001": 33.0},
        {"000001": 11.5, "000002": 21.0, "600001": 34.5},
    ]

    seed_snapshot(db, trade_days[0], price_path[0])
    generated = asyncio.run(generate_recommendations(db, trade_days[0]))
    recs = recommendation_rows(db)
    print_step(
        "A new-day recommendation",
        generated.get("success") and len(recs) == 3,
        f"date={trade_days[0]}, generated={len(recs)}, result={generated.get('message')}",
    )

    for offset, prices in enumerate(price_path[1:], start=1):
        seed_snapshot(db, trade_days[offset], prices)
        updated = asyncio.run(update_recommend_prices(db, as_of=trade_days[offset]))
        recs = recommendation_rows(db)
        filled = sum(1 for rec in recs if getattr(rec, f"return_rate_day{offset}") is not None)
        print_step(
            f"B day-{offset} return update",
            updated.get("success") and filled == len(recs),
            f"as_of={trade_days[offset]}, updated_points={updated.get('data', {}).get('updated')}, filled={filled}/{len(recs)}",
        )

    print("\nFinal recommendation tracking report")
    print("rank code   name          rec_price day1%   day2%   day3%   tracking")
    for rec in recommendation_rows(db):
        day1 = float(rec.return_rate_day1 or 0) * 100
        day2 = float(rec.return_rate_day2 or 0) * 100
        day3 = float(rec.return_rate_day3 or 0) * 100
        print(
            f"{rec.rec_rank or 0:>4} {rec.stock_code:<6} {rec.stock_name:<12} "
            f"{float(rec.recommend_price):>9.2f} {day1:>6.2f} {day2:>7.2f} {day3:>7.2f} {rec.tracking_days:>8}"
        )

    failures = 0
    recs = recommendation_rows(db)
    if len(recs) != 3:
        failures += 1
    for rec in recs:
        if rec.return_rate_day1 is None or rec.return_rate_day2 is None or rec.return_rate_day3 is None:
            failures += 1
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", default=str(BACKEND_ROOT / "logs" / "quant_flow_check.sqlite"))
    parser.add_argument("--recommend-date", default=(date.today() - timedelta(days=7)).isoformat())
    args = parser.parse_args()

    db_path = Path(args.db_path)
    if not db_path.is_absolute():
        db_path = BACKEND_ROOT / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        failures = run_flow(db, date.fromisoformat(args.recommend_date))
    finally:
        db.close()

    print(f"\nSQLite database: {db_path}")
    if failures:
        print(f"Flow check failed: {failures} issue(s)")
        return 1
    print("Flow check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

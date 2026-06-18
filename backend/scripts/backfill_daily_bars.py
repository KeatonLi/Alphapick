"""Backfill A-share daily bars into stock_daily_bars.

Example:
    python scripts/backfill_daily_bars.py --start 2026-05-01 --end 2026-05-30
    python scripts/backfill_daily_bars.py --start 2026-05-01 --end 2026-05-30 --limit 20
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pandas as pd

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import Base, SessionLocal, engine
from app.datasource.models import DataQualityCheck, RawDataRecord, StockDailyBar, StockSpotSnapshot


def clean_code(value: Any) -> str:
    code = str(value or "").strip().lower()
    for prefix in ("sh", "sz", "bj"):
        if code.startswith(prefix):
            code = code[2:]
    return code.zfill(6) if code.isdigit() else code


def market_code(code: str) -> str:
    if code.startswith(("6", "9")):
        return f"sh.{code}"
    return f"sz.{code}"


def to_decimal(value: Any, default: str = "0") -> Decimal:
    try:
        if value is None or value == "":
            return Decimal(default)
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def to_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except Exception:
        return None


def load_universe(db, limit: int | None, offset: int) -> list[dict[str, str]]:
    rows = (
        db.query(StockSpotSnapshot.stock_code, StockSpotSnapshot.stock_name)
        .order_by(StockSpotSnapshot.trade_date.desc(), StockSpotSnapshot.stock_code.asc())
        .all()
    )
    seen = set()
    universe = []
    for code, name in rows:
        code = clean_code(code)
        if code and code not in seen:
            universe.append({"code": code, "name": name or ""})
            seen.add(code)

    if not universe:
        record = db.query(RawDataRecord).filter(RawDataRecord.data_type == "stock_spot").order_by(RawDataRecord.target_date.desc()).first()
        if record:
            import json

            raw = json.loads(record.raw_json)
            for item in raw.get("stock_list", []):
                code = clean_code(item.get("code"))
                if code and code not in seen:
                    universe.append({"code": code, "name": item.get("name", "")})
                    seen.add(code)

    sliced = universe[offset:]
    if limit:
        sliced = sliced[:limit]
    return sliced


def fetch_with_akshare(code: str, start: date, end: date) -> tuple[str, pd.DataFrame]:
    import akshare as ak

    df = ak.stock_zh_a_hist(
        symbol=code,
        period="daily",
        start_date=start.strftime("%Y%m%d"),
        end_date=end.strftime("%Y%m%d"),
        adjust="qfq",
    )
    return "akshare", df


def fetch_with_eastmoney_direct(code: str, start: date, end: date) -> tuple[str, pd.DataFrame]:
    import requests

    secid = f"1.{code}" if code.startswith(("6", "9")) else f"0.{code}"
    session = requests.Session()
    session.trust_env = False
    response = session.get(
        "https://push2his.eastmoney.com/api/qt/stock/kline/get",
        params={
            "secid": secid,
            "fields1": "f1,f2,f3,f4,f5,f6",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            "klt": "101",
            "fqt": "1",
            "beg": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
        },
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://quote.eastmoney.com/"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    klines = (payload.get("data") or {}).get("klines") or []
    rows = []
    for line in klines:
        parts = line.split(",")
        if len(parts) < 11:
            continue
        rows.append({
            "date": parts[0],
            "open": parts[1],
            "close": parts[2],
            "high": parts[3],
            "low": parts[4],
            "volume": parts[5],
            "amount": parts[6],
            "amplitude": parts[7],
            "pctChg": parts[8],
            "change": parts[9],
            "turn": parts[10],
        })
    return "eastmoney_direct", pd.DataFrame(rows)


def fetch_with_baostock(code: str, start: date, end: date) -> tuple[str, pd.DataFrame]:
    import baostock as bs

    rs = bs.query_history_k_data_plus(
        market_code(code),
        "date,code,open,high,low,close,preclose,volume,amount,turn,pctChg",
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        frequency="d",
        adjustflag="2",
    )
    rows = []
    while rs.error_code == "0" and rs.next():
        rows.append(rs.get_row_data())
    if rs.error_code != "0":
        raise RuntimeError(f"baostock error {rs.error_code}: {rs.error_msg}")
    return "baostock", pd.DataFrame(rows, columns=rs.fields)


def normalize_rows(source: str, code: str, name: str, df: pd.DataFrame) -> list[dict[str, Any]]:
    rows = []
    if df is None or df.empty:
        return rows

    if source == "akshare":
        for _, row in df.iterrows():
            trade_date = pd.to_datetime(row.get("日期")).date()
            rows.append({
                "trade_date": trade_date,
                "stock_code": code,
                "stock_name": name,
                "open": to_decimal(row.get("开盘")),
                "high": to_decimal(row.get("最高")),
                "low": to_decimal(row.get("最低")),
                "close": to_decimal(row.get("收盘")),
                "prev_close": None,
                "change_pct": to_decimal(row.get("涨跌幅"), "0"),
                "volume": to_int(row.get("成交量")),
                "amount": to_decimal(row.get("成交额"), "0"),
                "turnover_rate": to_decimal(row.get("换手率"), "0"),
                "adjust": "qfq",
                "source_name": source,
            })
        return rows

    for _, row in df.iterrows():
        trade_date = pd.to_datetime(row.get("date")).date()
        rows.append({
            "trade_date": trade_date,
            "stock_code": code,
            "stock_name": name,
            "open": to_decimal(row.get("open")),
            "high": to_decimal(row.get("high")),
            "low": to_decimal(row.get("low")),
            "close": to_decimal(row.get("close")),
            "prev_close": to_decimal(row.get("preclose"), "0"),
            "change_pct": to_decimal(row.get("pctChg"), "0"),
            "volume": to_int(row.get("volume")),
            "amount": to_decimal(row.get("amount"), "0"),
            "turnover_rate": to_decimal(row.get("turn"), "0"),
            "adjust": "qfq",
            "source_name": source,
        })
    return rows


def upsert_bars(db, rows: list[dict[str, Any]]) -> int:
    count = 0
    for payload in rows:
        existing = (
            db.query(StockDailyBar)
            .filter(
                StockDailyBar.trade_date == payload["trade_date"],
                StockDailyBar.stock_code == payload["stock_code"],
                StockDailyBar.adjust == payload["adjust"],
            )
            .first()
        )
        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(StockDailyBar(**payload))
        count += 1
    return count


def upsert_quality(db, target: date, status: str, actual_count: int, message: str):
    row = (
        db.query(DataQualityCheck)
        .filter(DataQualityCheck.trade_date == target, DataQualityCheck.data_type == "stock_daily_bars")
        .first()
    )
    if not row:
        row = DataQualityCheck(trade_date=target, data_type="stock_daily_bars", status=status)
        db.add(row)
    row.status = status
    row.actual_count = actual_count
    row.message = message


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--sleep", type=float, default=0.15)
    args = parser.parse_args()

    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    Path("logs").mkdir(exist_ok=True)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        universe = load_universe(db, args.limit, args.offset)
        if not universe:
            raise RuntimeError("No stock universe found. Normalize a stock_spot snapshot first.")

        try:
            import baostock as bs

            bs.login()
            baostock_logged_in = True
        except Exception:
            baostock_logged_in = False

        ok = 0
        failed = []
        written = 0
        for idx, stock in enumerate(universe, start=1 + args.offset):
            code = stock["code"]
            name = stock["name"]
            errors = []
            rows = []
            for fetcher in (fetch_with_eastmoney_direct, fetch_with_akshare, fetch_with_baostock):
                if fetcher is fetch_with_baostock and not baostock_logged_in:
                    continue
                try:
                    source, df = fetcher(code, start, end)
                    rows = normalize_rows(source, code, name, df)
                    if rows:
                        break
                except Exception as exc:
                    errors.append(f"{fetcher.__name__}: {exc}")
            if rows:
                written += upsert_bars(db, rows)
                ok += 1
                print(f"[{idx}/{len(universe) + args.offset}] {code} ok rows={len(rows)}")
            else:
                error = " | ".join(errors) if errors else "empty"
                failed.append({"code": code, "error": error})
                print(f"[{idx}/{len(universe) + args.offset}] {code} failed: {error}")

            if idx % 20 == 0:
                db.commit()
            time.sleep(args.sleep)

        db.commit()
        status = "success" if ok == len(universe) else "partial" if ok else "failed"
        upsert_quality(
            db,
            end,
            status,
            written,
            f"stocks ok={ok}/{len(universe)}, rows={written}, failed={len(failed)}",
        )
        db.commit()
        if failed:
            Path("logs/backfill_daily_bars_failed.json").write_text(
                json.dumps(failed, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        print(f"done status={status} stocks_ok={ok}/{len(universe)} rows={written} failed={len(failed)}")
    finally:
        try:
            import baostock as bs

            bs.logout()
        except Exception:
            pass
        db.close()


if __name__ == "__main__":
    main()

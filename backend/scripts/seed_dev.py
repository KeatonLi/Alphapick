"""本地开发数据种子：采集全市场快照 + 指定股票日线，填充 SQLite dev.db"""
import asyncio
import sys
from datetime import date, timedelta

sys.path.insert(0, ".")

from app.database import SessionLocal, Base, engine
from app.datasource import models  # noqa: F401  注册所有表
from app.datasource.multi_source import multi_source
from app.datasource.warehouse import upsert_stock_spot_snapshots_from_raw, get_candidates_from_db

DAILY_CODES = ["600519", "000001", "600036", "601318", "000858", "300750", "000333", "600900", "002594", "601899"]
DAYS = 60

async def seed_spot(db):
    r = await asyncio.to_thread(multi_source.get_stock_spot)
    if not r.get("success") or not r.get("data"):
        print("spot fetch failed:", r.get("error"))
        return False
    quotes = r["data"]
    # 构造与 upsert_stock_spot_snapshots_from_raw 一致的 raw 结构
    from app.datasource.models import RawDataRecord
    target = date.today()
    existing = db.query(RawDataRecord).filter_by(data_type="stock_spot", target_date=target).first()
    import json
    payload = json.dumps({"quotes": quotes, "quotes_count": len(quotes)}, ensure_ascii=False)
    if existing:
        existing.raw_json = payload
    else:
        db.add(RawDataRecord(source_name="multi_source", data_type="stock_spot", target_date=target, raw_json=payload))
    db.commit()
    res = upsert_stock_spot_snapshots_from_raw(db, target)
    print("snapshot normalize:", res)
    return res.get("success", False)

async def seed_daily(db, code):
    end = date.today()
    start = end - timedelta(days=DAYS * 2)
    r = await asyncio.to_thread(multi_source.get_stock_daily, code, days=DAYS * 2, adjust="qfq")
    if not r.get("success") or not r.get("data"):
        print(f"  {code} daily failed: {r.get('error')}")
        return
    rows = r["data"]
    filtered = [x for x in rows if start <= date.fromisoformat(str(x.get("日期", x.get("date", "")))) <= end][-DAYS:]
    from app.datasource.models import StockDailyBar
    name = ""
    for row in filtered:
        d = date.fromisoformat(str(row.get("日期", row.get("date", ""))))
        bar = db.query(StockDailyBar).filter_by(trade_date=d, stock_code=code, adjust="qfq").first()
        payload = {
            "trade_date": d,
            "stock_code": code,
            "stock_name": str(row.get("名称", row.get("name", name))),
            "open": row.get("开盘", row.get("open", 0)),
            "high": row.get("最高", row.get("high", 0)),
            "low": row.get("最低", row.get("low", 0)),
            "close": row.get("收盘", row.get("close", 0)),
            "change_pct": row.get("涨跌幅", row.get("change_pct", 0)),
            "volume": row.get("成交量", row.get("volume", 0)),
            "amount": row.get("成交额", row.get("amount", 0)),
            "turnover_rate": row.get("换手率", row.get("turnover_rate", 0)),
            "adjust": "qfq",
            "source_name": r.get("_source", "multi_source"),
        }
        if bar:
            for k, v in payload.items():
                setattr(bar, k, v)
        else:
            db.add(StockDailyBar(**payload))
        if payload["stock_name"]:
            name = payload["stock_name"]
    db.commit()
    print(f"  {code} {name}: {len(filtered)} bars")

async def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ok = await seed_spot(db)
        if not ok:
            print("skip daily seeding because spot failed")
            return
        for code in DAILY_CODES:
            await seed_daily(db, code)
        res = get_candidates_from_db(db, date.today())
        print("candidates:", res.get("success"), len(res.get("data") or []))
    finally:
        db.close()

asyncio.run(main())

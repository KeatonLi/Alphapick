"""数据源模块一次性测试脚本 — 跑所有 Fetcher，验证能采到数据"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date
from app.database import SessionLocal, create_tables
from app.datasource.models import DataFetchLog, RawDataRecord  # 确保表被注册
from app.datasource.fetchers.index import IndexFetcher
from app.datasource.fetchers.sector import SectorFetcher
from app.datasource.fetchers.calendar import CalendarFetcher
from app.datasource.fetchers.hsgt import HSGTFetcher
from app.datasource.fetchers.limit_up import LimitUpFetcher
from app.datasource.fetchers.stock import StockFetcher


def run_all(target_date: date):
    create_tables()
    db = SessionLocal()

    fetchers = [
        IndexFetcher(),
        SectorFetcher(),
        CalendarFetcher(),
        HSGTFetcher(),
        LimitUpFetcher(),
        StockFetcher(),
    ]

    for f in fetchers:
        print(f"\n{'='*60}")
        print(f"Running {f.data_type} ...")
        print(f"{'='*60}")
        result = f.run(db, target_date)
        print(f"  Status: {result.status}")
        if result.error:
            print(f"  Error: {result.error}")
        print(f"  Retries: {result.retry_count}")
        print(f"  Duration: {result.duration_ms}ms")
        print(f"  Response size: {result.response_size} bytes")

    db.close()
    print(f"\n{'='*60}")
    print("All fetchers complete.")


if __name__ == "__main__":
    target = date.today()
    if len(sys.argv) > 1:
        from datetime import datetime
        target = datetime.strptime(sys.argv[1], "%Y-%m-%d").date()
    print(f"Target date: {target}")
    run_all(target)

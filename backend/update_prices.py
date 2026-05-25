#!/usr/bin/env python3
"""
更新所有推荐股票的最新价格和收益率
Usage: python3 update_prices.py
Crontab: 30 16 * * 1-5 cd /opt/quantforge && python3 backend/update_prices.py >> backend/cron_prices.log 2>&1
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.services.recommend_service import update_recommend_prices


async def main():
    db = SessionLocal()
    try:
        print("[update-prices] Starting price update...")
        result = await update_recommend_prices(db)
        if result["success"]:
            updated = result["data"]["updated"]
            print(f"[update-prices] Updated {updated} records")
        else:
            print(f"[update-prices] Failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)
    except Exception as e:
        print(f"[update-prices] Exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())

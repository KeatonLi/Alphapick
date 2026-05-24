#!/usr/bin/env python3
"""
每日定时生成市场报告 + 量化推荐脚本
Usage: python3 generate_report.py [YYYY-MM-DD]
Examples:
  python3 generate_report.py             # 生成今日报告 + 推荐
  python3 generate_report.py 2025-05-22  # 生成指定日期报告 + 推荐
Crontab: 0 16 * * 1-5 cd /opt/quantforge && python3 backend/generate_report.py >> backend/cron.log 2>&1
第二步（更新现价）：每个交易日凌晨运行 python3 backend/update_prices.py >> backend/cron_prices.log 2>&1
"""
import asyncio
import sys
import os
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.services.report_service import generate_daily_report
from app.services.recommend_service import generate_recommendations


async def main():
    db = SessionLocal()
    try:
        target_date = date.today()
        if len(sys.argv) >= 2:
            target_date = date.fromisoformat(sys.argv[1])

        # Step 1: 生成市场报告
        print(f"[{target_date}] [1/2] Generating market report...")
        result = await generate_daily_report(db, report_date=target_date)
        if result["success"]:
            print(f"[{target_date}] [1/2] Market report generated successfully")
        else:
            print(f"[{target_date}] [1/2] Market report failed: {result.get('error', 'Unknown error')}")
            # 报告失败不退出，继续尝试推荐

        # Step 2: 生成量化推荐
        print(f"[{target_date}] [2/2] Generating recommendations...")
        rec_result = await generate_recommendations(db, rec_date=target_date)
        if rec_result["success"]:
            print(f"[{target_date}] [2/2] Recommendations generated successfully ({len(rec_result.get('data', []))} stocks)")
        else:
            print(f"[{target_date}] [2/2] Recommendations failed: {rec_result.get('error', 'Unknown error')}")

    except Exception as e:
        print(f"[{date.today()}] Exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
定时生成每日市场报告脚本
Usage: python3 generate_report.py [YYYY-MM-DD]
Examples:
  python3 generate_report.py          # 生成今日报告
  python3 generate_report.py 2025-05-22  # 生成指定日期报告
Crontab: 30 15 * * 1-5 cd /opt/quantforge && python3 backend/generate_report.py >> backend/cron.log 2>&1
"""
import asyncio
import sys
import os
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.services.report_service import generate_daily_report


async def main():
    db = SessionLocal()
    try:
        target_date = date.today()
        if len(sys.argv) >= 2:
            target_date = date.fromisoformat(sys.argv[1])
        print(f"[{target_date}] Starting report generation...")
        result = await generate_daily_report(db, report_date=target_date)
        if result["success"]:
            print(f"[{target_date}] Report generated successfully")
        else:
            print(f"[{target_date}] Generation failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)
    except Exception as e:
        print(f"[{date.today()}] Exception: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())

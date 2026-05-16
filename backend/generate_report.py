#!/usr/bin/env python3
"""
定时生成每日市场报告脚本
在 crontab 中配置: 30 15 * * 1-5 cd /opt/quantforge && python3 backend/generate_report.py >> backend/cron.log 2>&1
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
        today = date.today()
        print(f"[{today}] 开始生成市场报告...")
        result = await generate_daily_report(db)
        if result["success"]:
            print(f"[{today}] 报告生成成功")
        else:
            print(f"[{today}] 报告生成失败: {result.get('error', '未知错误')}")
            sys.exit(1)
    except Exception as e:
        print(f"[{date.today()}] 异常: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())

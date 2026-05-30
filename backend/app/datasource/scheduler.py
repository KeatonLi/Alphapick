"""数据采集调度器 — APScheduler 管理每日定时采集 + 动态重调度"""

import logging
from datetime import date, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.datasource.fetchers.index import IndexFetcher
from app.datasource.fetchers.sector import SectorFetcher
from app.datasource.fetchers.calendar import CalendarFetcher
from app.datasource.fetchers.hsgt import HSGTFetcher
from app.datasource.fetchers.limit_up import LimitUpFetcher
from app.datasource.fetchers.stock import StockFetcher
from app.models.schedule_config import ScheduleConfig

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Shanghai")

FETCHERS = [
    ("index_daily", IndexFetcher()),
    ("sector_summary", SectorFetcher()),
    ("trade_calendar", CalendarFetcher()),
    ("hsgt_flow", HSGTFetcher()),
    ("limit_up_pool", LimitUpFetcher()),
    ("stock_spot", StockFetcher()),
]


def _get_config(db: Session):
    config = db.query(ScheduleConfig).first()
    if not config:
        config = ScheduleConfig(enabled=False, run_time="16:00")
        db.add(config)
        db.commit()
    return config


def run_daily_fetch():
    """每日定时采集任务 — 由 APScheduler 触发"""
    db = SessionLocal()
    today = date.today()
    results = []
    try:
        config = _get_config(db)
        if not config.enabled:
            logger.info("[scheduler] 定时采集已禁用，跳过")
            return

        for dtype, fetcher in FETCHERS:
            try:
                r = fetcher.run(db, today)
                results.append(f"{dtype}={r.status}")
                logger.info(f"[scheduler] {dtype}: {r.status} ({r.duration_ms}ms)")
            except Exception as e:
                results.append(f"{dtype}=error:{e}")
                logger.error(f"[scheduler] {dtype} failed: {e}")

        # 更新执行记录
        config.last_run_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        success_count = sum(1 for r in results if "=success" in r or "=skipped" in r)
        config.last_run_result = f"采集完成: {success_count}/{len(FETCHERS)}"
        db.commit()
        logger.info(f"[scheduler] 采集任务完成: {config.last_run_result}")

    except Exception as e:
        logger.error(f"[scheduler] 采集任务异常: {e}")
    finally:
        db.close()


def update_schedule(enabled: bool, run_time: str):
    """对外接口：更新定时采集配置并重调度 APScheduler job"""
    db = SessionLocal()
    try:
        config = _get_config(db)
        config.enabled = enabled
        config.run_time = run_time
        db.commit()
    finally:
        db.close()

    job_id = "daily_data_fetch"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    if enabled:
        hour, minute = int(run_time.split(":")[0]), int(run_time.split(":")[1])
        scheduler.add_job(
            run_daily_fetch,
            trigger=CronTrigger(hour=hour, minute=minute),
            id=job_id,
            name="每日数据采集",
            replace_existing=True,
        )
        logger.info(f"[scheduler] 定时采集已启用: 每天 {run_time}")
    else:
        logger.info("[scheduler] 定时采集已禁用")


def start_scheduler():
    """应用启动时调用：根据数据库配置启动 scheduler"""
    db = SessionLocal()
    try:
        config = _get_config(db)
        enabled = config.enabled
        run_time = config.run_time or "16:00"
    finally:
        db.close()

    scheduler.start()
    update_schedule(enabled, run_time)
    logger.info(f"[scheduler] 调度器已启动 (enabled={enabled}, time={run_time})")


def stop_scheduler():
    """应用关闭时调用"""
    scheduler.shutdown(wait=False)
    logger.info("[scheduler] 调度器已停止")

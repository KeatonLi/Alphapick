"""APScheduler datasource jobs."""

import logging
from datetime import date, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.datasource.fetchers.calendar import CalendarFetcher
from app.datasource.fetchers.hsgt import HSGTFetcher
from app.datasource.fetchers.index import IndexFetcher
from app.datasource.fetchers.limit_up import LimitUpFetcher
from app.datasource.fetchers.sector import SectorFetcher
from app.datasource.fetchers.stock import StockFetcher
from app.datasource.warehouse import upsert_stock_spot_snapshots_from_raw
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


def _normalize_if_needed(db: Session, data_type: str, target: date) -> str | None:
    if data_type != "stock_spot":
        return None
    result = upsert_stock_spot_snapshots_from_raw(db, target)
    return f"normalized={result.get('count', 0)}:{result.get('status', 'unknown')}"


def run_daily_fetch():
    db = SessionLocal()
    target = date.today()
    results = []
    try:
        config = _get_config(db)
        if not config.enabled:
            logger.info("[scheduler] daily datasource fetch disabled")
            return

        for data_type, fetcher in FETCHERS:
            try:
                result = fetcher.run(db, target)
                normalized = _normalize_if_needed(db, data_type, target) if result.status in ("success", "skipped") else None
                suffix = f",{normalized}" if normalized else ""
                results.append(f"{data_type}={result.status}{suffix}")
                logger.info("[scheduler] %s: %s %s", data_type, result.status, suffix)
            except Exception as exc:
                results.append(f"{data_type}=error:{exc}")
                logger.exception("[scheduler] %s failed", data_type)

        config.last_run_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        success_count = sum(1 for item in results if "=success" in item or "=skipped" in item)
        config.last_run_result = f"fetch completed: {success_count}/{len(FETCHERS)}; " + "; ".join(results)
        db.commit()
        logger.info("[scheduler] %s", config.last_run_result)
    except Exception:
        logger.exception("[scheduler] daily datasource fetch crashed")
    finally:
        db.close()


def update_schedule(enabled: bool, run_time: str):
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
        hour, minute = [int(part) for part in run_time.split(":")[:2]]
        scheduler.add_job(
            run_daily_fetch,
            trigger=CronTrigger(hour=hour, minute=minute),
            id=job_id,
            name="Daily datasource fetch",
            replace_existing=True,
        )
        logger.info("[scheduler] daily datasource fetch enabled at %s", run_time)
    else:
        logger.info("[scheduler] daily datasource fetch disabled")


def start_scheduler():
    db = SessionLocal()
    try:
        config = _get_config(db)
        enabled = bool(config.enabled)
        run_time = config.run_time or "16:00"
    finally:
        db.close()

    scheduler.start()
    update_schedule(enabled, run_time)
    logger.info("[scheduler] scheduler started (enabled=%s, time=%s)", enabled, run_time)


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("[scheduler] scheduler stopped")

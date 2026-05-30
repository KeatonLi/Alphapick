"""数据源管理 API — 手动触发采集 / 查看日志 / 查看状态"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.datasource.models import DataFetchLog, RawDataRecord
from app.datasource.fetchers.index import IndexFetcher
from app.datasource.fetchers.sector import SectorFetcher
from app.datasource.fetchers.calendar import CalendarFetcher
from app.datasource.fetchers.hsgt import HSGTFetcher
from app.datasource.fetchers.limit_up import LimitUpFetcher
from app.datasource.fetchers.stock import StockFetcher

router = APIRouter(prefix="/api/datasource", tags=["datasource"], dependencies=[Depends(require_admin)])

FETCHERS = {
    "index_daily": IndexFetcher(),
    "sector_summary": SectorFetcher(),
    "trade_calendar": CalendarFetcher(),
    "hsgt_flow": HSGTFetcher(),
    "limit_up_pool": LimitUpFetcher(),
    "stock_spot": StockFetcher(),
}

FETCHER_LABELS = {
    "index_daily": "指数日线",
    "sector_summary": "板块行业",
    "trade_calendar": "交易日历",
    "hsgt_flow": "北向资金",
    "limit_up_pool": "涨停池",
    "stock_spot": "全市场快照",
}


@router.get("/status")
def datasource_status(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    """获取各数据源今日采集状态（优化：只查必要字段，不拉 raw_json）"""
    today = target_date or date.today()

    # 一次性查出所有数据类型的 log（只取需要的列）
    logs = (
        db.query(
            DataFetchLog.data_type,
            DataFetchLog.status,
            DataFetchLog.duration_ms,
            DataFetchLog.response_size,
            DataFetchLog.error_message,
            DataFetchLog.retry_count,
            DataFetchLog.created_at,
        )
        .filter(DataFetchLog.target_date == today)
        .order_by(desc(DataFetchLog.created_at))
        .all()
    )

    # 一次性查出有数据的所有类型（只查 id，不拉 raw_json）
    record_types = set(
        r[0] for r in db.query(RawDataRecord.data_type)
        .filter(RawDataRecord.target_date == today)
        .all()
    )

    # 每种类型取最新一条 log
    log_map = {}
    for l in logs:
        if l.data_type not in log_map:
            log_map[l.data_type] = l

    result = []
    for dtype, label in FETCHER_LABELS.items():
        log = log_map.get(dtype)
        result.append({
            "data_type": dtype,
            "label": label,
            "status": log.status if log else "never",
            "duration_ms": log.duration_ms if log else None,
            "response_size": log.response_size if log else None,
            "error_message": log.error_message if log else None,
            "retry_count": log.retry_count if log else None,
            "has_data": dtype in record_types,
            "fetched_at": str(log.created_at) if log else None,
        })
    return {"success": True, "data": result}


@router.post("/trigger/{data_type}")
def trigger_fetch(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    """手动触发某类数据采集"""
    if data_type not in FETCHERS:
        raise HTTPException(status_code=400, detail=f"未知数据类型: {data_type}")
    today = target_date or date.today()
    fetcher = FETCHERS[data_type]
    result = fetcher.run(db, today)
    return {
        "success": True if result.status in ("success", "skipped") else False,
        "data": {
            "data_type": data_type,
            "status": result.status,
            "error": result.error,
            "duration_ms": result.duration_ms,
            "response_size": result.response_size,
            "retry_count": result.retry_count,
        },
    }


@router.post("/trigger-all")
def trigger_all(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    """手动触发全部数据采集"""
    today = target_date or date.today()
    results = {}
    for dtype, fetcher in FETCHERS.items():
        r = fetcher.run(db, today)
        results[dtype] = {
            "status": r.status,
            "error": r.error,
            "duration_ms": r.duration_ms,
            "response_size": r.response_size,
            "retry_count": r.retry_count,
        }
    # 统计成功数
    success_count = sum(1 for v in results.values() if v["status"] in ("success", "skipped"))
    return {
        "success": True,
        "data": {
            "total": len(results),
            "success": success_count,
            "results": results,
        },
    }


@router.get("/logs")
def datasource_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    data_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """查询采集日志（分页，可按类型/状态筛选）"""
    q = db.query(DataFetchLog)
    if data_type:
        q = q.filter(DataFetchLog.data_type == data_type)
    if status:
        q = q.filter(DataFetchLog.status == status)
    total = q.count()
    logs = (
        q.order_by(desc(DataFetchLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "success": True,
        "data": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "logs": [
                {
                    "id": l.id,
                    "source_name": l.source_name,
                    "data_type": l.data_type,
                    "label": FETCHER_LABELS.get(l.data_type, l.data_type),
                    "target_date": str(l.target_date),
                    "status": l.status,
                    "error_message": l.error_message,
                    "retry_count": l.retry_count,
                    "duration_ms": l.duration_ms,
                    "response_size": l.response_size,
                    "created_at": str(l.created_at),
                }
                for l in logs
            ],
        },
    }


@router.delete("/records/{data_type}")
def delete_record(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    """删除某类数据的采集记录（可重新采集）"""
    if data_type not in FETCHER_LABELS:
        raise HTTPException(status_code=400, detail=f"未知数据类型: {data_type}")
    today = target_date or date.today()

    deleted_records = (
        db.query(RawDataRecord)
        .filter(RawDataRecord.data_type == data_type, RawDataRecord.target_date == today)
        .delete()
    )
    deleted_logs = (
        db.query(DataFetchLog)
        .filter(DataFetchLog.data_type == data_type, DataFetchLog.target_date == today)
        .delete()
    )
    db.commit()
    return {
        "success": True,
        "data": {
            "data_type": data_type,
            "date": str(today),
            "deleted_records": deleted_records,
            "deleted_logs": deleted_logs,
        },
    }


@router.get("/dates")
def datasource_dates(db: Session = Depends(get_db)):
    """获取各数据源已采集的日期列表（单次查询）"""
    from collections import defaultdict
    rows = (
        db.query(RawDataRecord.data_type, RawDataRecord.target_date)
        .order_by(RawDataRecord.target_date.desc())
        .all()
    )
    grouped = defaultdict(list)
    for dtype, d in rows:
        if len(grouped[dtype]) < 60:
            grouped[dtype].append(str(d))

    result = {}
    for dtype, label in FETCHER_LABELS.items():
        result[dtype] = {"label": label, "dates": grouped.get(dtype, [])}
    return {"success": True, "data": result}


@router.delete("/records")
def delete_all_records(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    """删除指定日期所有采集记录（全部清空）"""
    today = target_date or date.today()
    dr = db.query(RawDataRecord).filter(RawDataRecord.target_date == today).delete()
    dl = db.query(DataFetchLog).filter(DataFetchLog.target_date == today).delete()
    db.commit()
    return {"success": True, "data": {"date": str(today), "deleted_records": dr, "deleted_logs": dl}}

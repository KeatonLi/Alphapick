"""Datasource management APIs."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.datasource.fetchers.calendar import CalendarFetcher
from app.datasource.fetchers.hsgt import HSGTFetcher
from app.datasource.fetchers.index import IndexFetcher
from app.datasource.fetchers.limit_up import LimitUpFetcher
from app.datasource.fetchers.sector import SectorFetcher
from app.datasource.fetchers.stock import StockFetcher
from app.datasource.models import DataFetchLog, DataQualityCheck, RawDataRecord
from app.datasource.warehouse import upsert_stock_spot_snapshots_from_raw


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
    "index_daily": "Index daily",
    "sector_summary": "Sector summary",
    "trade_calendar": "Trade calendar",
    "hsgt_flow": "Northbound flow",
    "limit_up_pool": "Limit-up pool",
    "stock_spot": "Full market snapshot",
}


def _normalize_after_fetch(db: Session, data_type: str, target_date: date) -> dict | None:
    if data_type != "stock_spot":
        return None
    return upsert_stock_spot_snapshots_from_raw(db, target_date)


@router.get("/status")
def datasource_status(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    target = target_date or date.today()
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
        .filter(DataFetchLog.target_date == target)
        .order_by(desc(DataFetchLog.created_at))
        .all()
    )
    record_types = {
        row[0]
        for row in db.query(RawDataRecord.data_type)
        .filter(RawDataRecord.target_date == target)
        .all()
    }
    quality = {
        row.data_type: row
        for row in db.query(DataQualityCheck)
        .filter(DataQualityCheck.trade_date == target)
        .all()
    }

    latest_log = {}
    for row in logs:
        if row.data_type not in latest_log:
            latest_log[row.data_type] = row

    result = []
    for data_type, label in FETCHER_LABELS.items():
        log = latest_log.get(data_type)
        q = quality.get("stock_spot_snapshot") if data_type == "stock_spot" else quality.get(data_type)
        result.append({
            "data_type": data_type,
            "label": label,
            "status": log.status if log else "never",
            "duration_ms": log.duration_ms if log else None,
            "response_size": log.response_size if log else None,
            "error_message": log.error_message if log else None,
            "retry_count": log.retry_count if log else None,
            "has_data": data_type in record_types,
            "fetched_at": str(log.created_at) if log else None,
            "quality_status": q.status if q else None,
            "quality_count": q.actual_count if q else None,
            "quality_message": q.message if q else None,
        })
    return {"success": True, "data": result}


@router.post("/trigger/{data_type}")
def trigger_fetch(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    if data_type not in FETCHERS:
        raise HTTPException(status_code=400, detail=f"unknown datasource type: {data_type}")
    target = target_date or date.today()
    result = FETCHERS[data_type].run(db, target)
    normalized = _normalize_after_fetch(db, data_type, target) if result.status in ("success", "skipped") else None
    return {
        "success": result.status in ("success", "skipped"),
        "data": {
            "data_type": data_type,
            "status": result.status,
            "error": result.error,
            "duration_ms": result.duration_ms,
            "response_size": result.response_size,
            "retry_count": result.retry_count,
            "normalized": normalized,
        },
    }


@router.post("/trigger-all")
def trigger_all(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    target = target_date or date.today()
    results = {}
    for data_type, fetcher in FETCHERS.items():
        result = fetcher.run(db, target)
        normalized = _normalize_after_fetch(db, data_type, target) if result.status in ("success", "skipped") else None
        results[data_type] = {
            "status": result.status,
            "error": result.error,
            "duration_ms": result.duration_ms,
            "response_size": result.response_size,
            "retry_count": result.retry_count,
            "normalized": normalized,
        }

    success_count = sum(1 for value in results.values() if value["status"] in ("success", "skipped"))
    return {"success": True, "data": {"total": len(results), "success": success_count, "results": results}}


@router.post("/normalize/{data_type}")
def normalize_record(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    target = target_date or date.today()
    if data_type != "stock_spot":
        raise HTTPException(status_code=400, detail=f"normalization not supported for {data_type}")
    result = upsert_stock_spot_snapshots_from_raw(db, target)
    return {"success": result.get("success", False), "data": result}


@router.get("/quality")
def datasource_quality(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    target = target_date or date.today()
    rows = (
        db.query(DataQualityCheck)
        .filter(DataQualityCheck.trade_date == target)
        .order_by(DataQualityCheck.data_type.asc())
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "data_type": row.data_type,
                "date": str(row.trade_date),
                "status": row.status,
                "expected_count": row.expected_count,
                "actual_count": row.actual_count,
                "missing_count": row.missing_count,
                "message": row.message,
                "created_at": str(row.created_at),
            }
            for row in rows
        ],
    }


@router.get("/logs")
def datasource_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    data_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(DataFetchLog)
    if data_type:
        query = query.filter(DataFetchLog.data_type == data_type)
    if status:
        query = query.filter(DataFetchLog.status == status)
    total = query.count()
    rows = query.order_by(desc(DataFetchLog.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "success": True,
        "data": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "logs": [
                {
                    "id": row.id,
                    "source_name": row.source_name,
                    "data_type": row.data_type,
                    "label": FETCHER_LABELS.get(row.data_type, row.data_type),
                    "target_date": str(row.target_date),
                    "status": row.status,
                    "error_message": row.error_message,
                    "retry_count": row.retry_count,
                    "duration_ms": row.duration_ms,
                    "response_size": row.response_size,
                    "created_at": str(row.created_at),
                }
                for row in rows
            ],
        },
    }


@router.get("/dates")
def datasource_dates(db: Session = Depends(get_db)):
    from collections import defaultdict

    rows = (
        db.query(RawDataRecord.data_type, RawDataRecord.target_date)
        .order_by(RawDataRecord.target_date.desc())
        .all()
    )
    grouped = defaultdict(list)
    for data_type, target_date in rows:
        if len(grouped[data_type]) < 60:
            grouped[data_type].append(str(target_date))
    return {
        "success": True,
        "data": {
            data_type: {"label": label, "dates": grouped.get(data_type, [])}
            for data_type, label in FETCHER_LABELS.items()
        },
    }


@router.delete("/records/{data_type}")
def delete_record(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    if data_type not in FETCHER_LABELS:
        raise HTTPException(status_code=400, detail=f"unknown datasource type: {data_type}")
    target = target_date or date.today()
    deleted_records = db.query(RawDataRecord).filter(RawDataRecord.data_type == data_type, RawDataRecord.target_date == target).delete()
    deleted_logs = db.query(DataFetchLog).filter(DataFetchLog.data_type == data_type, DataFetchLog.target_date == target).delete()
    db.commit()
    return {"success": True, "data": {"data_type": data_type, "date": str(target), "deleted_records": deleted_records, "deleted_logs": deleted_logs}}


@router.delete("/records")
def delete_all_records(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    target = target_date or date.today()
    deleted_records = db.query(RawDataRecord).filter(RawDataRecord.target_date == target).delete()
    deleted_logs = db.query(DataFetchLog).filter(DataFetchLog.target_date == target).delete()
    db.commit()
    return {"success": True, "data": {"date": str(target), "deleted_records": deleted_records, "deleted_logs": deleted_logs}}

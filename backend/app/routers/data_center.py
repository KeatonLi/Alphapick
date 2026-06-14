from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.datasource.router import (
    datasource_dates,
    datasource_logs,
    datasource_quality,
    datasource_status,
    delete_all_records,
    delete_record,
    normalize_record,
    trigger_all,
    trigger_fetch,
)

router = APIRouter(prefix="/api/data", tags=["data"], dependencies=[Depends(require_admin)])


@router.get("/status")
def data_status(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return datasource_status(target_date, db)


@router.get("/quality")
def data_quality(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return datasource_quality(target_date, db)


@router.get("/logs")
def data_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    data_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return datasource_logs(page, page_size, data_type, status, db)


@router.get("/dates")
def data_dates(db: Session = Depends(get_db)):
    return datasource_dates(db)


@router.post("/fetch/{data_type}")
def data_fetch(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return trigger_fetch(data_type, target_date, db)


@router.post("/fetch-all")
def data_fetch_all(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return trigger_all(target_date, db)


@router.post("/normalize/{data_type}")
def data_normalize(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return normalize_record(data_type, target_date, db)


@router.delete("/records/{data_type}")
def data_delete_record(data_type: str, target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return delete_record(data_type, target_date, db)


@router.delete("/records")
def data_delete_all_records(target_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    return delete_all_records(target_date, db)

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.report_service import (
    get_report_by_date,
    get_report_history,
    get_available_dates,
)

router = APIRouter(prefix="/api/report", tags=["report"])


@router.get("/daily")
async def daily(
    report_date: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场报告（只读），默认今天"""
    target_date = report_date or date.today()
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/history")
async def history(limit: int = 7, db: Session = Depends(get_db)):
    """获取最近 N 天的历史报告"""
    result = get_report_history(db, limit)
    return result


@router.get("/dates")
async def dates(db: Session = Depends(get_db)):
    """获取有报告的日期列表"""
    result = get_available_dates(db)
    return result

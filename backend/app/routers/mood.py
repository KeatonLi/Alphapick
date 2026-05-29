# backend/app/routers/mood.py
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.dependencies import get_current_user
from app.services.mood_service import get_market_mood

router = APIRouter(prefix="/api/mood", tags=["mood"], dependencies=[Depends(get_current_user)])
limiter = Limiter(key_func=get_remote_address)


@router.get("/daily")
@limiter.limit("10/minute")
async def daily(
    request: Request,
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场情绪数据"""
    target_date = report_date or date.today()
    result = await get_market_mood(db, target_date)
    return result

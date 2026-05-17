from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.services.recommend_service import (
    get_daily_recommendations,
    get_recommend_stats,
    update_recommend_prices,
    get_recommend_by_date,
)

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.get("/daily")
async def daily(
    rec_date: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的推荐股票，默认今天"""
    target_date = rec_date or date.today()
    result = await get_recommend_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/dates")
async def dates(db: Session = Depends(get_db)):
    """获取有推荐数据的日期列表"""
    from app.services.recommend_service import get_available_recommend_dates
    result = get_available_recommend_dates(db)
    return result


@router.get("/stats")
async def stats(db: Session = Depends(get_db)):
    """获取推荐统计信息"""
    result = await get_recommend_stats(db)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/update-prices")
async def update_prices(db: Session = Depends(get_db)):
    """更新所有推荐股票的最新价格"""
    result = await update_recommend_prices(db)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

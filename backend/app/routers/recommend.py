from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.recommend_service import (
    get_daily_recommendations,
    get_recommend_stats,
    update_recommend_prices,
)

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.get("/daily")
async def daily(db: Session = Depends(get_db)):
    """获取每日推荐股票"""
    result = await get_daily_recommendations(db)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
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

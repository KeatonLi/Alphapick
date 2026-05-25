from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from datetime import date
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.services.recommend_service import (
    get_recommend_stats,
    update_recommend_prices,
    get_recommend_by_date,
    get_all_recommendations,
    generate_recommendations,
)

router = APIRouter(prefix="/api/recommend", tags=["recommend"])
limiter = Limiter(key_func=get_remote_address)


# ─── 读 MySQL 缓存，不限流 ────────────────────────────────────────────────


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


@router.get("/today")
async def today(db: Session = Depends(get_db)):
    """获取今日推荐（快捷接口）"""
    result = await get_recommend_by_date(db, date.today())
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/history")
async def history(db: Session = Depends(get_db)):
    """获取所有历史推荐（用于收益跟踪）"""
    result = get_all_recommendations(db)
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


# ─── 调外部 API，限流 ────────────────────────────────────────────────────


@router.post("/generate")
@limiter.limit("3/minute")
async def generate(request: Request, rec_date: date | None = Query(None, alias="date"), db: Session = Depends(get_db)):
    """手动触发生成指定日期的量化推荐"""
    target_date = rec_date or date.today()
    result = await generate_recommendations(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/update-prices")
@limiter.limit("3/minute")
async def update_prices(request: Request, db: Session = Depends(get_db)):
    """更新所有推荐股票的最新价格"""
    result = await update_recommend_prices(db)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

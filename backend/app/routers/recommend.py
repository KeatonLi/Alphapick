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


@router.get("/daily")
@limiter.limit("10/minute")
async def daily(
    request: Request,
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
@limiter.limit("10/minute")
async def today(request: Request, db: Session = Depends(get_db)):
    """获取今日推荐（快捷接口）"""
    result = await get_recommend_by_date(db, date.today())
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/history")
@limiter.limit("30/minute")
async def history(request: Request, db: Session = Depends(get_db)):
    """获取所有历史推荐（用于收益跟踪）"""
    result = get_all_recommendations(db)
    return result


@router.get("/dates")
@limiter.limit("30/minute")
async def dates(request: Request, db: Session = Depends(get_db)):
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


@router.post("/generate")
async def generate(rec_date: date | None = Query(None, alias="date"), db: Session = Depends(get_db)):
    """手动触发生成指定日期的量化推荐（供手动调用，不走页面）"""
    target_date = rec_date or date.today()
    result = await generate_recommendations(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/update-prices")
async def update_prices(db: Session = Depends(get_db)):
    """更新所有推荐股票的最新价格"""
    result = await update_recommend_prices(db)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

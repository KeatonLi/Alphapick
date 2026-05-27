from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.services.recommend_service import (
    get_recommend_stats,
    update_recommend_prices,
    get_recommend_by_date,
    get_all_recommendations,
    generate_recommendations,
    delete_recommendation,
    reset_recommend_tracking,
    update_single_recommend_price,
    batch_reset_tracking,
    batch_delete_recommendations,
)

router = APIRouter(prefix="/api/recommend", tags=["recommend"])
limiter = Limiter(key_func=get_remote_address)


# ─── 读 MySQL 缓存，不限流 ────────────────────────────────────────────────


@router.get("/daily")
async def daily(
    rec_date: Optional[date] = Query(None, alias="date"),
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
async def generate(request: Request, rec_date: Optional[date] = Query(None, alias="date"), db: Session = Depends(get_db)):
    """手动触发生成指定日期的量化推荐"""
    target_date = rec_date or date.today()
    result = await generate_recommendations(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/update-prices")
@limiter.limit("10/minute")
async def update_prices(request: Request, db: Session = Depends(get_db)):
    """更新所有推荐股票的最新价格"""
    result = await update_recommend_prices(db)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ─── 控制台：精细化管理 ─────────────────────────────────────────────────


@router.delete("/item/{rec_id}")
async def delete_item(rec_id: int, db: Session = Depends(get_db)):
    """删除一条推荐记录"""
    result = delete_recommendation(db, rec_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/item/{rec_id}/reset")
async def reset_item(rec_id: int, db: Session = Depends(get_db)):
    """重置一条推荐的收益跟踪（清空跟踪数据，状态回到 tracking）"""
    result = reset_recommend_tracking(db, rec_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/item/{rec_id}/update")
@limiter.limit("20/minute")
async def update_item(request: Request, rec_id: int, db: Session = Depends(get_db)):
    """单独更新一条推荐的价格"""
    result = await update_single_recommend_price(db, rec_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/batch/reset")
async def batch_reset(ids: list[int] = Body(...), db: Session = Depends(get_db)):
    """批量重置多条推荐的收益跟踪"""
    result = batch_reset_tracking(db, ids)
    return result


@router.post("/batch/delete")
async def batch_delete(ids: list[int] = Body(...), db: Session = Depends(get_db)):
    """批量删除多条推荐记录"""
    result = batch_delete_recommendations(db, ids)
    return result

import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.dependencies import get_current_user
from app.models import MarketReport
from app.services.stock_service import analyze_stock
from app.utils.akshare_utils import get_stock_info, get_market_index
from app.datasource.fetchers.stock_daily import fetch_stock_daily

router = APIRouter(prefix="/api/stock", tags=["stock"], dependencies=[Depends(get_current_user)])
limiter = Limiter(key_func=get_remote_address)


# ─── 以下接口只读市场报告缓存，没有生成数据就返回空 ─────────────────────


@router.get("/market")
async def market_overview(db: Session = Depends(get_db)):
    """读取今日生成的报告缓存，无数据则返回空"""
    report = db.query(MarketReport).filter(
        MarketReport.report_date == date.today()
    ).first()

    if not report or not report.index_data:
        return {"success": True, "data": {"indices": [], "breadth": {"up": 0, "down": 0, "flat": 0, "limit_up": 0, "limit_down": 0}}}

    indices = json.loads(report.index_data) if report.index_data else []
    up = sum(1 for i in indices if i.get("change_pct", 0) > 0)
    down = sum(1 for i in indices if i.get("change_pct", 0) < 0)
    flat = len(indices) - up - down

    return {
        "success": True,
        "data": {
            "indices": indices,
            "breadth": {"up": up, "down": down, "flat": flat, "limit_up": 0, "limit_down": 0},
        },
    }


@router.get("/hot-sectors")
async def hot_sectors(db: Session = Depends(get_db)):
    """读取今日生成的板块缓存，无数据则返回空"""
    report = db.query(MarketReport).filter(
        MarketReport.report_date == date.today()
    ).first()

    if not report or not report.hot_sectors:
        return {"success": True, "data": []}

    return {"success": True, "data": json.loads(report.hot_sectors) if report.hot_sectors else []}


# ─── 以下接口实时调 AKShare（个股查询类） ────────────────────────────────


@router.get("/analyze")
@limiter.limit("10/minute")
async def analyze(request: Request, code: str):
    """AI 分析单只股票"""
    result = await analyze_stock(code)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/info")
@limiter.limit("20/minute")
async def info(request: Request, code: str):
    """获取股票基本信息"""
    result = await get_stock_info(code)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/daily")
@limiter.limit("20/minute")
async def daily(request: Request, code: str, days: int = 60, db: Session = Depends(get_db)):
    """获取个股日线数据（通过 datasource 模块按需拉取）"""
    end_date = date.today()
    start_date = end_date - timedelta(days=days + 10)  # 多取几天应对非交易日
    result = fetch_stock_daily(db, code, start_date=start_date, end_date=end_date)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    # 只返回最近 days 条
    result["data"] = result["data"][-days:]
    return result


@router.get("/market-index")
@limiter.limit("20/minute")
async def market_index(request: Request):
    """获取主要指数行情（实时调 AKShare，个股分析用）"""
    result = await get_market_index()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

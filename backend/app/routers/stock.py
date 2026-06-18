import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.datasource.models import StockDailyBar
from app.models import MarketReport
from app.services.stock_service import analyze_stock
from app.utils.akshare_utils import get_market_index, get_stock_info


router = APIRouter(prefix="/api/stock", tags=["stock"], dependencies=[Depends(get_current_user)])
limiter = Limiter(key_func=get_remote_address)


@router.get("/market")
async def market_overview(db: Session = Depends(get_db)):
    report = db.query(MarketReport).filter(MarketReport.report_date == date.today()).first()
    if not report or not report.index_data:
        return {"success": True, "data": {"indices": [], "breadth": {"up": 0, "down": 0, "flat": 0, "limit_up": 0, "limit_down": 0}}}

    indices = json.loads(report.index_data) if report.index_data else []
    up = sum(1 for item in indices if item.get("change_pct", 0) > 0)
    down = sum(1 for item in indices if item.get("change_pct", 0) < 0)
    flat = len(indices) - up - down
    return {"success": True, "data": {"indices": indices, "breadth": {"up": up, "down": down, "flat": flat, "limit_up": 0, "limit_down": 0}}}


@router.get("/hot-sectors")
async def hot_sectors(db: Session = Depends(get_db)):
    report = db.query(MarketReport).filter(MarketReport.report_date == date.today()).first()
    if not report or not report.hot_sectors:
        return {"success": True, "data": []}
    return {"success": True, "data": json.loads(report.hot_sectors)}


@router.get("/daily")
@limiter.limit("20/minute")
async def daily(request: Request, code: str, days: int = 60, db: Session = Depends(get_db)):
    end_date = date.today()
    start_date = end_date - timedelta(days=days + 10)
    clean_code = code.lower().removeprefix("sh").removeprefix("sz").removeprefix("bj").zfill(6)
    rows = (
        db.query(StockDailyBar)
        .filter(
            StockDailyBar.stock_code == clean_code,
            StockDailyBar.trade_date >= start_date,
            StockDailyBar.trade_date <= end_date,
        )
        .order_by(StockDailyBar.trade_date.asc())
        .all()
    )
    data = [
        {
            "date": str(row.trade_date),
            "open": float(row.open),
            "high": float(row.high),
            "low": float(row.low),
            "close": float(row.close),
            "volume": int(row.volume or 0),
            "amount": float(row.amount or 0),
            "turnover": float(row.turnover_rate or 0),
            "source": row.source_name,
        }
        for row in rows
    ][-days:]
    return {"success": True, "data": data, "source": "db_daily_bars"}


@router.get("/analyze")
@limiter.limit("10/minute")
async def analyze(request: Request, code: str):
    result = await analyze_stock(code)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/info")
@limiter.limit("20/minute")
async def info(request: Request, code: str):
    result = await get_stock_info(code)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/market-index")
@limiter.limit("20/minute")
async def market_index(request: Request):
    result = await get_market_index()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

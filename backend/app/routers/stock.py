from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.stock_service import analyze_stock
from app.utils.akshare_utils import get_stock_info, get_stock_daily, get_market_index, get_hot_sectors

router = APIRouter(prefix="/api/stock", tags=["stock"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/analyze")
async def analyze(code: str):
    """AI 分析单只股票"""
    result = await analyze_stock(code)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/info")
async def info(code: str):
    """获取股票基本信息"""
    result = await get_stock_info(code)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/daily")
async def daily(code: str, days: int = 60):
    """获取个股日线数据"""
    result = await get_stock_daily(code, days)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/market-index")
@limiter.limit("10/minute")
async def market_index(request: Request):
    """获取主要指数行情（上证、深证、创业板）"""
    result = await get_market_index()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/hot-sectors")
@limiter.limit("5/minute")
async def hot_sectors(request: Request, top_n: int = 10):
    """获取热门板块"""
    result = await get_hot_sectors(top_n)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

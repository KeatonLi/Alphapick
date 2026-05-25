from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.stock_service import analyze_stock
from app.utils.akshare_utils import get_stock_info, get_stock_daily, get_market_index, get_hot_sectors, get_stock_list

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


@router.get("/market")
async def market_overview():
    """获取市场概览：主要指数和涨跌家数统计"""
    index_result = await get_market_index()
    stock_result = await get_stock_list()

    market_breadth = {"up": 0, "down": 0, "flat": 0, "limit_up": 0, "limit_down": 0}
    if stock_result["success"]:
        for s in stock_result["data"]:
            try:
                change_pct = float(s.get("change_pct") or 0)
                if change_pct > 9.5:
                    market_breadth["limit_up"] += 1
                elif change_pct < -9.5:
                    market_breadth["limit_down"] += 1
                elif change_pct > 0:
                    market_breadth["up"] += 1
                elif change_pct < 0:
                    market_breadth["down"] += 1
                else:
                    market_breadth["flat"] += 1
            except (ValueError, TypeError):
                pass

    if not index_result["success"]:
        raise HTTPException(status_code=400, detail=index_result["error"])

    return {
        "success": True,
        "data": {
            "indices": index_result["data"],
            "breadth": market_breadth,
        },
    }


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

from datetime import date
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.report_service import (
    get_report_by_date,
    get_report_history,
    get_available_dates,
)
from app.services.chart_service import generate_all_charts
from app.utils.akshare_utils import get_market_index, get_hot_sectors, get_stock_list, get_stock_daily

router = APIRouter(prefix="/api/report", tags=["report"])


@router.get("/daily")
async def daily(
    report_date: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场报告（只读），默认今天"""
    target_date = report_date or date.today()
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/detail")
async def detail(
    report_date: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """
    获取指定日期的完整市场报告详情（含图表）
    包含指数数据、板块数据、技术指标图表、市场广度
    """
    target_date = report_date or date.today()

    # 获取市场指数数据
    index_result = await get_market_index()
    indices = index_result["data"] if index_result["success"] else []

    # 获取热门板块
    sectors_result = await get_hot_sectors(top_n=10)
    sectors = sectors_result["data"] if sectors_result["success"] else []

    # 获取市场广度（涨跌家数）
    breadth = {"up": 0, "down": 0, "flat": 0, "limit_up": 0, "limit_down": 0}
    stock_result = await get_stock_list()
    if stock_result["success"]:
        for s in stock_result["data"]:
            try:
                change_pct = float(s.get("change_pct") or 0)
                if change_pct > 9.5:
                    breadth["limit_up"] += 1
                elif change_pct < -9.5:
                    breadth["limit_down"] += 1
                elif change_pct > 0:
                    breadth["up"] += 1
                elif change_pct < 0:
                    breadth["down"] += 1
                else:
                    breadth["flat"] += 1
            except (ValueError, TypeError):
                pass

    # 获取日线数据用于技术指标计算
    daily_data = []
    if indices:
        main_index_code = indices[0].get("code", "sh000001")
        daily_result = await get_stock_daily(main_index_code, 90)
        if daily_result["success"]:
            daily_data = daily_result["data"]

    # 生成图表
    charts = generate_all_charts(daily_data, sectors, breadth)

    # 获取 AI 报告（如有）
    report_result = get_report_by_date(db, target_date)
    ai_report = ""
    market_summary = ""
    if report_result["success"]:
        ai_report = report_result["data"].get("ai_report", "")
        market_summary = report_result["data"].get("market_summary", "")

    return {
        "success": True,
        "data": {
            "date": str(target_date),
            "indices": indices,
            "sectors": sectors,
            "breadth": breadth,
            "charts": {
                "kline": charts.get("kline") or "",
                "macd": charts.get("macd") or "",
                "kdj": charts.get("kdj") or "",
                "sectors": charts.get("sectors") or "",
                "market_breadth": charts.get("market_breadth") or "",
            },
            "ai_report": ai_report,
            "market_summary": market_summary,
        },
    }


@router.get("/history")
async def history(limit: int = 7, db: Session = Depends(get_db)):
    """获取最近 N 天的历史报告"""
    result = get_report_history(db, limit)
    return result


@router.get("/dates")
async def dates(db: Session = Depends(get_db)):
    """获取有报告的日期列表"""
    result = get_available_dates(db)
    return result


@router.get("/trade-dates")
async def trade_dates():
    """获取交易日列表（用于日期选择器）"""
    from app.services.report_service import get_trade_dates_for_frontend
    return get_trade_dates_for_frontend()

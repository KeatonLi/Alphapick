from datetime import date
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import MarketReport
from app.services.report_service import (
    get_report_by_date,
    get_report_history,
    get_available_dates,
    generate_daily_report,
)
from app.services.html_report_service import generate_html_report
from app.services.chart_service import generate_all_charts
from app.utils.akshare_utils import get_market_index, get_hot_sectors, get_stock_list, get_stock_daily

router = APIRouter(prefix="/api/report", tags=["report"])
limiter = Limiter(key_func=get_remote_address)


# ─── 读 MySQL 缓存，不限流 ────────────────────────────────────────────────


@router.get("/daily")
async def daily(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场报告（只读），默认今天"""
    target_date = report_date or date.today()
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


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
async def trade_dates(days: int = Query(365)):
    """获取交易日列表（用于日期选择器）"""
    from app.services.report_service import get_trade_dates_for_frontend
    return get_trade_dates_for_frontend(days=days)


@router.get("/html")
async def html_report(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """
    获取指定日期的 HTML 报告文件。
    若报告尚未生成，返回 404。
    """
    from fastapi.responses import HTMLResponse
    from app.services.html_report_service import get_html_report_path, read_html_report

    target_date = report_date or date.today()
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])

    html_path = get_html_report_path(target_date)
    if html_path:
        html_content = read_html_report(html_path)
        if html_content:
            return HTMLResponse(content=html_content, media_type="text/html")

    raise HTTPException(status_code=404, detail=f"{target_date} 的 HTML 报告尚未生成，请先调用 /api/report/generate 接口")


# ─── 调外部 API（AKShare / AI），限流 ─────────────────────────────────────


@router.get("/detail")
@limiter.limit("6/minute")
async def detail(
    request: Request,
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的完整市场报告详情（含图表）"""
    target_date = report_date or date.today()

    index_result = await get_market_index()
    indices = index_result["data"] if index_result["success"] else []

    sectors_result = await get_hot_sectors(top_n=10)
    sectors = sectors_result["data"] if sectors_result["success"] else []

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

    daily_data = []
    if indices:
        main_index_code = indices[0].get("code", "sh000001")
        daily_result = await get_stock_daily(main_index_code, 90)
        if daily_result["success"]:
            daily_data = daily_result["data"]

    charts = generate_all_charts(daily_data, sectors, breadth)

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


@router.post("/generate")
@limiter.limit("3/minute")
async def generate_report(
    request: Request,
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """手动触发指定日期的市场报告生成（包括数据 + HTML）"""
    target_date = report_date or date.today()

    result = get_report_by_date(db, target_date)
    if not result["success"]:
        gen_result = await generate_daily_report(db, report_date=target_date)
        if not gen_result["success"]:
            raise HTTPException(status_code=500, detail=gen_result.get("error", "报告生成失败"))
        result = get_report_by_date(db, target_date)

    data = result["data"]
    html_path = await generate_html_report(
        report_date=target_date,
        market_summary=data["market_summary"],
        index_data=data["index_data"],
        sectors=data["hot_sectors"],
        ai_report=data["ai_report"],
    )

    report = db.query(MarketReport).filter(MarketReport.report_date == target_date).first()
    if report:
        report.html_report_path = html_path
        db.commit()

    return {"success": True, "data": {"html_path": html_path, "report_date": str(target_date)}}

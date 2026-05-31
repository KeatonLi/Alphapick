from datetime import date, timedelta
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.dependencies import get_current_user

from app.database import get_db
from app.models import MarketReport
from app.services.report_service import (
    get_report_by_date,
    get_report_history,
    get_available_dates,
    generate_daily_report,
)
from app.services.chart_service import generate_all_charts
from app.services.poster_service import generate_poster, generate_poster_base64
from app.utils.akshare_utils import get_market_index, get_hot_sectors, get_stock_list, get_stock_daily

router = APIRouter(prefix="/api/report", tags=["report"], dependencies=[Depends(get_current_user)])
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
    from app.utils.akshare_utils import get_trade_dates_for_frontend
    return get_trade_dates_for_frontend(days=days)


@router.get("/hsgt-history")
async def hsgt_history(days: int = Query(60, description="历史天数"), db: Session = Depends(get_db)):
    """获取沪深港通历史趋势数据"""
    from app.utils.akshare_utils import get_hsgt_flow

    # 实时拉取
    result = await get_hsgt_flow()
    if result["success"]:
        return {
            "success": True,
            "data": result["data"],
        }

    # fallback: 从 MarketReport 缓存读取
    since = date.today() - timedelta(days=days)
    reports = (
        db.query(MarketReport.report_date, MarketReport.hsgt_flow)
        .filter(MarketReport.report_date >= since, MarketReport.hsgt_flow.isnot(None))
        .order_by(MarketReport.report_date.desc())
        .all()
    )

    history = []
    for r in reports:
        try:
            flow = json.loads(r.hsgt_flow)
            if flow and "today" in flow:
                history.append({
                    "date": str(r.report_date),
                    **flow["today"],
                })
        except (json.JSONDecodeError, TypeError):
            continue

    return {
        "success": True,
        "data": {
            "today": history[0] if history else None,
            "history": history,
        },
    }


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
    """手动触发指定日期的市场报告生成"""
    target_date = report_date or date.today()

    result = get_report_by_date(db, target_date)
    if result["success"]:
        return {"success": True, "data": {"report_date": str(target_date)}, "message": "报告已存在"}

    gen_result = await generate_daily_report(db, report_date=target_date)
    if not gen_result["success"]:
        raise HTTPException(status_code=500, detail=gen_result.get("error", "报告生成失败"))

    return {"success": True, "data": {"report_date": str(target_date)}}


# ─── 市场海报 ─────────────────────────────────────────────────────────────────


@router.get("/poster")
async def poster_image(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场日报海报图片（PNG）"""
    target_date = report_date or date.today()
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail="暂无该日期的市场报告")

    data = result["data"]
    index_data = data.get("index_data", [])
    if isinstance(index_data, str):
        try:
            index_data = json.loads(index_data)
        except json.JSONDecodeError:
            index_data = []

    hot_sectors = data.get("hot_sectors", [])
    if isinstance(hot_sectors, str):
        try:
            hot_sectors = json.loads(hot_sectors)
        except json.JSONDecodeError:
            hot_sectors = []

    png_bytes = generate_poster(
        report_date=str(target_date),
        market_summary=data.get("market_summary", ""),
        index_data=index_data,
        hot_sectors=hot_sectors,
        ai_report=data.get("ai_report", ""),
        limit_up_data=data.get("today_limit_up", []),
        yesterday_limit_up_perf=data.get("yesterday_limit_ups_performance"),
    )
    if not png_bytes:
        raise HTTPException(status_code=500, detail="海报生成失败，请检查 Pillow 是否安装")

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="market_report_{target_date}.png"'},
    )


@router.get("/poster/base64")
async def poster_base64(
    report_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场日报海报（Base64 编码）"""
    target_date = report_date or date.today()
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail="暂无该日期的市场报告")

    data = result["data"]
    index_data = data.get("index_data", [])
    if isinstance(index_data, str):
        try:
            index_data = json.loads(index_data)
        except json.JSONDecodeError:
            index_data = []

    hot_sectors = data.get("hot_sectors", [])
    if isinstance(hot_sectors, str):
        try:
            hot_sectors = json.loads(hot_sectors)
        except json.JSONDecodeError:
            hot_sectors = []

    b64 = generate_poster_base64(
        report_date=str(target_date),
        market_summary=data.get("market_summary", ""),
        index_data=index_data,
        hot_sectors=hot_sectors,
        ai_report=data.get("ai_report", ""),
        limit_up_data=data.get("today_limit_up", []),
        yesterday_limit_up_perf=data.get("yesterday_limit_ups_performance"),
    )
    if not b64:
        raise HTTPException(status_code=500, detail="海报生成失败")

    return {"success": True, "data": {"base64": b64, "date": str(target_date)}}

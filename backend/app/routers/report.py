from datetime import date

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

router = APIRouter(prefix="/api/report", tags=["report"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/daily")
@limiter.limit("10/minute")
async def daily(
    request: Request,
    report_date: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """获取指定日期的市场报告（只读），默认今天"""
    target_date = report_date or date.today()
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/history")
@limiter.limit("30/minute")
async def history(request: Request, limit: int = 7, db: Session = Depends(get_db)):
    """获取最近 N 天的历史报告"""
    result = get_report_history(db, limit)
    return result


@router.get("/dates")
@limiter.limit("30/minute")
async def dates(request: Request, db: Session = Depends(get_db)):
    """获取有报告的日期列表"""
    result = get_available_dates(db)
    return result


@router.get("/trade-dates")
@limiter.limit("10/minute")
async def trade_dates(request: Request, days: int = Query(365)):
    """获取交易日列表（用于日期选择器）"""
    from app.services.report_service import get_trade_dates_for_frontend
    return get_trade_dates_for_frontend(days=days)


@router.get("/html")
async def html_report(
    report_date: date | None = Query(None, alias="date"),
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

    # HTML 尚未生成，但数据存在，返回 404 并提示需要先生成
    raise HTTPException(status_code=404, detail=f"{target_date} 的 HTML 报告尚未生成，请先调用 /api/report/generate 接口")


@router.post("/generate")
async def generate_report(
    report_date: date | None = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """
    手动触发指定日期的市场报告生成（包括数据 + HTML）。
    若报告已存在，自动跳过数据生成，只生成 HTML。
    """
    target_date = report_date or date.today()

    # 检查报告是否已存在，不存在则生成
    result = get_report_by_date(db, target_date)
    if not result["success"]:
        # 报告不存在，调用生成逻辑
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

    # 更新数据库
    report = db.query(MarketReport).filter(MarketReport.report_date == target_date).first()
    if report:
        report.html_report_path = html_path
        db.commit()

    return {"success": True, "data": {"html_path": html_path, "report_date": str(target_date)}}

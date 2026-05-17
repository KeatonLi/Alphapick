import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.utils.akshare_utils import get_market_index, get_hot_sectors
from app.utils.ai_client import chat
from app.models import MarketReport

REPORT_PROMPT = """你是一位资深市场策略分析师。请根据提供的今日市场数据，撰写一份专业的每日市场审计报告。

报告结构：
1. **市场总览**：三大指数表现，市场整体涨跌家数判断
2. **板块分析**：今日热点板块及驱动逻辑
3. **资金面分析**：成交量变化，资金流向判断
4. **后市展望**：短期市场预判和关注要点
5. **风险提示**：当前市场主要风险

请用专业、客观的语言撰写，报告要像一份正规的投研日报。"""


async def generate_daily_report(db: Session) -> dict:
    """生成今日市场报告并保存到数据库（由定时脚本调用）"""
    today = date.today()

    # 检查是否已存在
    existing = db.query(MarketReport).filter(
        MarketReport.report_date == today
    ).first()
    if existing and existing.ai_report:
        return {
            "success": True,
            "data": {},
            "message": f"今日报告已存在，跳过生成",
        }

    index_result = await get_market_index()
    sectors_result = await get_hot_sectors(top_n=10)

    if not index_result["success"]:
        return {"success": False, "error": f"获取指数数据失败: {index_result['error']}"}
    if not sectors_result["success"]:
        return {"success": False, "error": f"获取板块数据失败: {sectors_result['error']}"}

    index_data = index_result["data"]
    sectors_data = sectors_result["data"]

    up_count = sum(1 for i in index_data if i["change_pct"] > 0)
    market_summary = f"三大指数{'普涨' if up_count >= 2 else '涨跌互现' if up_count == 1 else '普跌'}"

    user_message = f"""
今日市场数据：

指数行情：
{json.dumps(index_data, ensure_ascii=False, indent=2)}

热门板块：
{json.dumps(sectors_data, ensure_ascii=False, indent=2)}

市场概况：{market_summary}

请撰写今日市场审计报告。
"""

    ai_response = await chat([
        {"role": "system", "content": REPORT_PROMPT},
        {"role": "user", "content": user_message},
    ])

    report = MarketReport(
        report_date=today,
        market_summary=market_summary,
        index_data=json.dumps(index_data, ensure_ascii=False),
        hot_sectors=json.dumps(sectors_data, ensure_ascii=False),
        ai_report=ai_response,
    )
    if existing:
        existing.market_summary = report.market_summary
        existing.index_data = report.index_data
        existing.hot_sectors = report.hot_sectors
        existing.ai_report = report.ai_report
    else:
        db.add(report)
    db.commit()

    return {
        "success": True,
        "data": {},
        "message": f"报告生成成功: {today}",
    }


def get_report_by_date(db: Session, report_date: date) -> dict:
    """获取指定日期的市场报告（只读）"""
    report = db.query(MarketReport).filter(
        MarketReport.report_date == report_date
    ).first()

    if not report:
        return {"success": False, "error": f"未找到 {report_date} 的市场报告"}

    return {
        "success": True,
        "data": {
            "date": str(report.report_date),
            "market_summary": report.market_summary,
            "index_data": json.loads(report.index_data) if report.index_data else [],
            "hot_sectors": json.loads(report.hot_sectors) if report.hot_sectors else [],
            "ai_report": report.ai_report,
        },
    }


def get_report_history(db: Session, limit: int = 7) -> dict:
    """获取最近的报告列表（概要，不含完整 AI 内容）"""
    reports = (
        db.query(MarketReport)
        .order_by(MarketReport.report_date.desc())
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "date": str(r.report_date),
                "market_summary": r.market_summary,
                "index_data": json.loads(r.index_data) if r.index_data else [],
                "hot_sectors": json.loads(r.hot_sectors) if r.hot_sectors else [],
                "ai_report": r.ai_report,
            }
            for r in reversed(reports)  # 正序，最早在前
        ],
    }


def get_available_dates(db: Session, days: int = 30) -> dict:
    """获取有报告的日期列表"""
    since = date.today() - timedelta(days=days)
    dates = (
        db.query(MarketReport.report_date)
        .filter(MarketReport.report_date >= since)
        .order_by(MarketReport.report_date.desc())
        .all()
    )
    return {
        "success": True,
        "data": [str(d[0]) for d in dates],
    }


def get_trade_dates_for_frontend(days: int = 30) -> dict:
    """获取前端可用的交易日列表（用于日期选择器）"""
    from app.utils.akshare_utils import get_trade_dates
    try:
        dates = get_trade_dates(days)
        return {"success": True, "data": dates}
    except Exception as e:
        return {"success": False, "error": str(e)}

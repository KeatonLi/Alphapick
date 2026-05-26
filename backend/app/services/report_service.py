# backend/app/services/report_service.py
import json
from datetime import date, timedelta
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from app.utils.akshare_utils import get_market_index, get_hot_sectors, get_stock_list
from app.services.html_report_service import generate_html_report
from app.utils.ai_client import chat
from app.models import MarketReport
from app.prompts import REPORT_SYSTEM_PROMPT, REPORT_OUTPUT_FORMAT


async def generate_daily_report(db: Session, report_date: Optional[date] = None) -> dict:
    """生成指定日期市场报告并保存到数据库"""
    today = report_date if report_date is not None else date.today()

    # 检查是否已存在
    existing = db.query(MarketReport).filter(
        MarketReport.report_date == today
    ).first()
    if existing and existing.ai_report:
        return {"success": True, "data": {}, "message": f"今日报告已存在，跳过生成"}

    # 抓取指数和板块数据
    index_result = await get_market_index()
    sectors_result = await get_hot_sectors(top_n=10)

    if not index_result["success"]:
        return {"success": False, "error": f"获取指数数据失败: {index_result['error']}"}
    if not sectors_result["success"]:
        return {"success": False, "error": f"获取板块数据失败: {sectors_result['error']}"}

    index_data = index_result["data"]
    sectors_data = sectors_result["data"]

    # 获取全市场实时行情（腾讯批量接口，带缓存）
    stock_list_result = await get_stock_list()
    today_limit_ups_json = "[]"
    yesterday_limit_ups_perf = None

    if stock_list_result["success"]:
        stocks = stock_list_result["data"]
        # 今日涨停股
        limit_up_codes = [s["code"] for s in stocks if s.get("change_pct", 0) >= 9.5]
        today_limit_ups_json = json.dumps(limit_up_codes[:100], ensure_ascii=False)

        # 计算昨日涨停股今日表现（从数据库读昨天的记录）
        yesterday_report = db.query(MarketReport).filter(
            MarketReport.report_date == today - timedelta(days=1)
        ).first()
        if yesterday_report and yesterday_report.yesterday_limit_ups:
            try:
                yesterday_codes = json.loads(yesterday_report.yesterday_limit_ups)
                if yesterday_codes:
                    stock_map = {s["code"]: s for s in stocks}
                    today_perfs = []
                    for code in yesterday_codes[:50]:
                        if code in stock_map:
                            pct = stock_map[code].get("change_pct", 0)
                            if pct != 0:
                                today_perfs.append(pct)
                    if today_perfs:
                        yesterday_limit_ups_perf = round(float(np.mean(today_perfs)), 2)
            except Exception:
                pass

    # 市场概况
    up_count = sum(1 for i in index_data if i["change_pct"] > 0)
    market_summary = f"三大指数{'普涨' if up_count >= 2 else '涨跌互现' if up_count == 1 else '普跌'}"

    # 组装 AI 输入
    user_message = f"""今日市场数据：

指数行情：
{json.dumps(index_data, ensure_ascii=False, indent=2)}

热门板块：
{json.dumps(sectors_data, ensure_ascii=False, indent=2)}

市场概况：{market_summary}

请撰写今日市场审计报告。
{REPORT_OUTPUT_FORMAT}"""

    # 调用 AI
    ai_response = await chat([
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ])

    # 解析 AI 响应为结构化数据
    ai_report_text = ai_response
    try:
        ai_json_str = ai_response.strip().lstrip("```json").rstrip("```").strip()
        report_data = json.loads(ai_json_str)
        ai_report_text = (
            f"【市场总览】\n{report_data.get('summary', '')}\n\n"
            f"【今日亮点】\n" + "\n".join(f"- {h}" for h in report_data.get('highlights', [])) + "\n\n"
            f"【今天该注意什么】\n" + "\n".join(f"- {t}" for t in report_data.get('tips', [])) + "\n\n"
            f"【风险提醒】\n" + "\n".join(f"- {r}" for r in report_data.get('risks', []))
        )
    except (json.JSONDecodeError, KeyError):
        # AI 返回非 JSON 格式，直接存储原文
        ai_report_text = ai_response

    # 保存到数据库
    if existing:
        existing.market_summary = market_summary
        existing.index_data = json.dumps(index_data, ensure_ascii=False)
        existing.hot_sectors = json.dumps(sectors_data, ensure_ascii=False)
        existing.ai_report = ai_report_text
        existing.yesterday_limit_ups = today_limit_ups_json
        existing.yesterday_limit_ups_performance = yesterday_limit_ups_perf
        target_report = existing
    else:
        target_report = MarketReport(
            report_date=today,
            market_summary=market_summary,
            index_data=json.dumps(index_data, ensure_ascii=False),
            hot_sectors=json.dumps(sectors_data, ensure_ascii=False),
            ai_report=ai_report_text,
            yesterday_limit_ups=today_limit_ups_json,
            yesterday_limit_ups_performance=yesterday_limit_ups_perf,
        )
        db.add(target_report)
    db.commit()

    # 生成 HTML 报告
    try:
        html_path = await generate_html_report(
            report_date=today,
            market_summary=market_summary,
            index_data=index_data,
            sectors=sectors_data,
            ai_report=ai_report_text,
        )
        target_report.html_report_path = html_path
        db.commit()
    except Exception as e:
        print(f"[{today}] HTML 报告生成失败: {e}")

    return {"success": True, "data": {}, "message": f"报告生成成功: {today}"}


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
            "html_report_path": report.html_report_path,
        },
    }


def get_report_history(db: Session, limit: int = 7) -> dict:
    """获取最近的报告列表"""
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
                "html_report_path": r.html_report_path,
            }
            for r in reversed(reports)
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
    return {"success": True, "data": [str(d[0]) for d in dates]}

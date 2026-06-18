# backend/app/services/report_service.py
import json
import numpy as np
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.display.data_reader import (
    read_index_data,
    read_sector_data,
    read_hsgt_data,
    read_limit_up_codes,
    read_limit_up_details,
    read_stock_quotes_for_codes,
)
from app.utils.ai_client import chat
from app.models import MarketReport
from app.prompts import REPORT_SYSTEM_PROMPT, REPORT_OUTPUT_FORMAT


async def generate_daily_report(
    db: Session,
    report_date: Optional[date] = None,
    on_progress=None,
) -> dict:
    """生成指定日期市场报告并保存到数据库（数据来源：raw_data_records）"""
    today = report_date if report_date is not None else date.today()

    async def _progress(step: int, total: int, label: str, pct: int):
        if on_progress:
            await on_progress(step, total, label, pct)

    # 检查是否已存在
    existing = db.query(MarketReport).filter(
        MarketReport.report_date == today
    ).first()
    if existing and existing.ai_report:
        return {"success": True, "data": {}, "message": f"今日报告已存在，跳过生成"}

    await _progress(1, 5, "正在读取指数数据...", 10)
    index_result = read_index_data(db, today)
    sectors_result = read_sector_data(db, today, top_n=10)

    if not index_result["success"]:
        return {"success": False, "error": f"获取指数数据失败: {index_result['error']}"}
    if not sectors_result["success"]:
        return {"success": False, "error": f"获取板块数据失败: {sectors_result['error']}"}

    await _progress(2, 5, "正在读取板块/北向/涨停数据...", 25)

    index_data = index_result["data"]
    sectors_data = sectors_result["data"]

    # ── 全量板块数据 ─────────────────────────────────────────────
    sectors_full_data = []
    try:
        full_sectors_result = read_sector_data(db, today, top_n=200)
        if full_sectors_result["success"]:
            sectors_full_data = full_sectors_result["data"]
    except Exception:
        pass

    # ── 沪深港通资金流 ──────────────────────────────────────────
    hsgt_data = None
    try:
        hsgt_result = read_hsgt_data(db, today)
        if hsgt_result["success"]:
            hsgt_data = hsgt_result["data"]
    except Exception:
        pass

    # ── 涨停板池 ──────────────────────────────────────────────
    today_limit_up_codes = "[]"
    yesterday_limit_ups_perf = None
    today_limit_up_details = []

    try:
        # 今日涨停板详情（用于 AI 分析）
        limit_up_result = read_limit_up_details(db, today, main_board_only=True)
        if limit_up_result["success"]:
            today_limit_up_details = limit_up_result["data"]

        codes = read_limit_up_codes(db, today)
        if codes:
            today_limit_up_codes = json.dumps(codes, ensure_ascii=False)

        # 查询昨日涨停股今日表现
        yesterday_report = db.query(MarketReport).filter(
            MarketReport.report_date == today - timedelta(days=1)
        ).first()
        if yesterday_report and yesterday_report.yesterday_limit_ups:
            try:
                yesterday_codes = json.loads(yesterday_report.yesterday_limit_ups)
                if yesterday_codes:
                    quotes = read_stock_quotes_for_codes(db, today, yesterday_codes)
                    today_perfs = [
                        q["change_pct"] for q in quotes.values()
                        if q.get("change_pct", 0) != 0
                    ]
                    if today_perfs:
                        yesterday_limit_ups_perf = round(float(np.mean(today_perfs)), 2)
            except Exception:
                pass
    except Exception:
        pass

    # 市场概况
    up_count = sum(1 for i in index_data if i["change_pct"] > 0)
    market_summary = f"三大指数{'普涨' if up_count >= 2 else '涨跌互现' if up_count == 1 else '普跌'}"

    await _progress(3, 5, "AI 正在分析市场数据生成报告...", 40)

    # 涨停板数据摘要（供 AI 分析）
    limit_up_summary = ""
    if today_limit_up_details:
        total_count = len(today_limit_up_details)
        # 按行业统计
        industry_count = {}
        for s in today_limit_up_details:
            ind = s.get("industry", "未知")
            industry_count[ind] = industry_count.get(ind, 0) + 1
        top_industries = sorted(industry_count.items(), key=lambda x: -x[1])[:5]

        # 连板股
        multi_day = [s for s in today_limit_up_details if s["consecutive_days"] >= 2]

        # 一字板
        yizi = [s for s in today_limit_up_details if s["board_type"] == "一字板"]

        # 封单前10
        top_sealed = sorted(today_limit_up_details, key=lambda x: -x["sealed_amount"])[:10]

        limit_up_summary = f"""
主板涨停板数据（共{total_count}只）：
- 涨停分布：{"、".join(f"{ind}({cnt}只)" for ind, cnt in top_industries)}
- 连板股（≥2连板）：{len(multi_day)}只 {", ".join(f"{s['name']}({s['consecutive_days']}板)" for s in multi_day[:8]) if multi_day else '无'}
- 一字板（极度强势）：{len(yizi)}只 {", ".join(f"{s['name']}" for s in yizi[:5]) if yizi else '无'}
- 换手板（充分换手）：{sum(1 for s in today_limit_up_details if s['board_type'] == '换手板')}只
- 封单最强TOP10：{", ".join(f"{s['name']}(封{s['sealed_amount']:.0f}万)" for s in top_sealed)}
- 涨停板连板最高：{max(s['consecutive_days'] for s in today_limit_up_details)}板"""

    # 组装 AI 输入
    user_message = f"""今日市场数据：

指数行情：
{json.dumps(index_data, ensure_ascii=False, indent=2)}

热门板块：
{json.dumps(sectors_data, ensure_ascii=False, indent=2)}

市场概况：{market_summary}
{limit_up_summary}

请撰写今日市场审计报告（含涨停板分析）。
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
        # 涨停板分析格式化
        limit_up_analysis_text = ""
        la = report_data.get("limit_up_analysis", {})
        if la:
            limit_up_analysis_text = f"【涨停板分析】\n"
            if la.get("theme"):
                limit_up_analysis_text += f"核心题材：{la['theme']}\n"
            if la.get("features"):
                limit_up_analysis_text += "\n".join(f"- {f}" for f in la["features"]) + "\n"
            if la.get("notable_stocks"):
                limit_up_analysis_text += "\n关注个股：\n"
                limit_up_analysis_text += "\n".join(
                    f"  · {s['name']}({s.get('code', '')}) — {s.get('reason', '')}"
                    for s in la["notable_stocks"][:5]
                ) + "\n"
            if la.get("tomorrow_outlook"):
                limit_up_analysis_text += f"\n明日展望：{la['tomorrow_outlook']}\n"

        ai_report_text = (
            f"【市场总览】\n{report_data.get('summary', '')}\n\n"
            f"【今日亮点】\n" + "\n".join(f"- {h}" for h in report_data.get('highlights', [])) + "\n\n"
            + (limit_up_analysis_text + "\n" if limit_up_analysis_text else "")
            + f"【今天该注意什么】\n" + "\n".join(f"- {t}" for t in report_data.get('tips', [])) + "\n\n"
            f"【风险提醒】\n" + "\n".join(f"- {r}" for r in report_data.get('risks', []))
        )
    except (json.JSONDecodeError, KeyError):
        ai_report_text = ai_response

    await _progress(4, 5, "正在保存报告...", 85)

    # 序列化今日涨停板详情
    today_limit_up_json = json.dumps(today_limit_up_details, ensure_ascii=False) if today_limit_up_details else None

    # 保存到数据库
    if existing:
        existing.market_summary = market_summary
        existing.index_data = json.dumps(index_data, ensure_ascii=False)
        existing.hot_sectors = json.dumps(sectors_data, ensure_ascii=False)
        existing.ai_report = ai_report_text
        existing.yesterday_limit_ups = today_limit_up_codes
        existing.yesterday_limit_ups_performance = yesterday_limit_ups_perf
        existing.today_limit_up_data = today_limit_up_json
        existing.sectors_full = json.dumps(sectors_full_data, ensure_ascii=False) if sectors_full_data else None
        existing.hsgt_flow = json.dumps(hsgt_data, ensure_ascii=False) if hsgt_data else None
        target_report = existing
    else:
        target_report = MarketReport(
            report_date=today,
            market_summary=market_summary,
            index_data=json.dumps(index_data, ensure_ascii=False),
            hot_sectors=json.dumps(sectors_data, ensure_ascii=False),
            ai_report=ai_report_text,
            yesterday_limit_ups=today_limit_up_codes,
            yesterday_limit_ups_performance=yesterday_limit_ups_perf,
            today_limit_up_data=today_limit_up_json,
            sectors_full=json.dumps(sectors_full_data, ensure_ascii=False) if sectors_full_data else None,
            hsgt_flow=json.dumps(hsgt_data, ensure_ascii=False) if hsgt_data else None,
        )
        db.add(target_report)
    db.commit()

    return {"success": True, "data": {}, "message": f"报告生成成功: {today}"}


def get_report_by_date(db: Session, report_date: date) -> dict:
    """获取指定日期的市场报告（只读）"""
    report = db.query(MarketReport).filter(
        MarketReport.report_date == report_date
    ).first()
    if not report:
        return {"success": False, "error": f"未找到 {report_date} 的市场报告"}
    # 涨停数据：优先从 today_limit_up_data 读取，fallback 到 raw_data_records
    today_limit_up = []
    yesterday_limit_ups_perf = float(report.yesterday_limit_ups_performance) if report.yesterday_limit_ups_performance else None
    yesterday_limit_ups_list = json.loads(report.yesterday_limit_ups) if report.yesterday_limit_ups else []

    if report.today_limit_up_data:
        try:
            today_limit_up = json.loads(report.today_limit_up_data) if isinstance(report.today_limit_up_data, str) else report.today_limit_up_data
        except (json.JSONDecodeError, TypeError):
            today_limit_up = []

    # fallback：从 raw_data_records 实时读取
    if not today_limit_up:
        try:
            lu_result = read_limit_up_details(db, report_date, main_board_only=True)
            if lu_result["success"]:
                today_limit_up = lu_result["data"]
        except Exception:
            pass

    return {
        "success": True,
        "data": {
            "date": str(report.report_date),
            "market_summary": report.market_summary,
            "index_data": json.loads(report.index_data) if report.index_data else [],
            "hot_sectors": json.loads(report.hot_sectors) if report.hot_sectors else [],
            "ai_report": report.ai_report,
            "html_report_path": report.html_report_path,
            "hsgt_flow": json.loads(report.hsgt_flow) if report.hsgt_flow else None,
            "sectors_full": json.loads(report.sectors_full) if report.sectors_full else [],
            "today_limit_up": today_limit_up,
            "yesterday_limit_ups": yesterday_limit_ups_list,
            "yesterday_limit_ups_performance": yesterday_limit_ups_perf,
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
                "hsgt_flow": json.loads(r.hsgt_flow) if r.hsgt_flow else None,
                "sectors_full": json.loads(r.sectors_full) if r.sectors_full else [],
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


def edit_report_fields(db: Session, report_date: date, fields: dict) -> dict:
    """编辑报告的文本字段（market_summary / ai_report）"""
    report = db.query(MarketReport).filter(
        MarketReport.report_date == report_date
    ).first()
    if not report:
        return {"success": False, "error": f"未找到 {report_date} 的市场报告"}

    if "market_summary" in fields:
        report.market_summary = fields["market_summary"]
    if "ai_report" in fields:
        report.ai_report = fields["ai_report"]

    db.commit()
    return {"success": True, "data": {"date": str(report_date)}}


def delete_report(db: Session, report_date: date) -> dict:
    """删除某日市场报告"""
    count = db.query(MarketReport).filter(
        MarketReport.report_date == report_date
    ).delete()
    db.commit()
    if count == 0:
        return {"success": False, "error": f"未找到 {report_date} 的市场报告"}
    return {"success": True, "data": {"deleted": count}}

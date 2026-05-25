# backend/app/services/mood_service.py
"""
市场情绪数据服务
使用腾讯批量接口获取全市场行情数据
"""

import numpy as np
from datetime import date
from sqlalchemy.orm import Session
from app.models import MarketReport
from app.utils.akshare_utils import get_stock_list


def _temperature_label(score: int) -> str:
    if score <= 30:
        return "冰点"
    elif score <= 50:
        return "冷淡"
    elif score <= 65:
        return "平稳"
    elif score <= 80:
        return "活跃"
    else:
        return "狂热"


async def get_market_mood(db: Session, target_date: date) -> dict:
    """
    获取指定日期的市场情绪数据
    直接调腾讯批量接口获取全市场实时行情
    """
    try:
        list_result = await get_stock_list()
        if not list_result["success"]:
            return {"success": False, "error": list_result["error"]}

        stocks = list_result["data"]
        up = sum(1 for s in stocks if s["change_pct"] > 0)
        down = sum(1 for s in stocks if s["change_pct"] < 0)
        flat = sum(1 for s in stocks if s["change_pct"] == 0)
        limit_up = sum(1 for s in stocks if s["change_pct"] >= 9.5)
        limit_down = sum(1 for s in stocks if s["change_pct"] <= -9.5)

        # 市场温度计
        total = up + down + flat
        temperature = int(up / total * 100) if total > 0 else 50
        temperature = max(0, min(100, temperature))
        label = _temperature_label(temperature)

        # 从 market_reports 读取昨日涨停股今日表现
        yesterday_perf = None
        if db is not None:
            report = db.query(MarketReport).filter(
                MarketReport.report_date == target_date
            ).first()
            if report and report.yesterday_limit_ups_performance is not None:
                yesterday_perf = float(report.yesterday_limit_ups_performance)

        return {
            "success": True,
            "data": {
                "date": str(target_date),
                "up": up,
                "down": down,
                "flat": flat,
                "limit_up": limit_up,
                "limit_down": limit_down,
                "total": total,
                "temperature": temperature,
                "temperature_label": label,
                "yesterday_limit_ups_performance": yesterday_perf,
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

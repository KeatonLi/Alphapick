# backend/app/services/mood_service.py
"""
市场情绪数据服务
使用 MarketCache 数据库缓存 + AKShare 全市场行情
"""

import json
import numpy as np
from datetime import date
from sqlalchemy.orm import Session
from app.models import MarketReport, MarketCache
from app.utils.akshare_utils import get_stock_list


def _temperature_label(score: int) -> str:
    if score <= 30:
        return "冰点"
    elif score <= 65:
        return "冷淡"
    elif score <= 80:
        return "平稳"
    else:
        return "活跃"


async def get_market_mood(db: Session, target_date: date) -> dict:
    """
    获取指定日期的市场情绪数据
    优先使用 MarketCache 数据库缓存，避免重复抓取全市场数据
    """
    try:
        # 从 MarketCache 读取当日缓存
        stocks = None
        if db is not None:
            cached = db.query(MarketCache).filter(
                MarketCache.cache_date == target_date,
                MarketCache.key == "stock_list",
            ).first()
            if cached:
                try:
                    stocks = json.loads(cached.data)
                except (json.JSONDecodeError, TypeError):
                    stocks = None

        if stocks is None:
            list_result = await get_stock_list()
            if not list_result["success"]:
                return {"success": False, "error": list_result["error"]}
            stocks = list_result["data"]

            # 写入 MarketCache
            if db is not None:
                try:
                    existing = db.query(MarketCache).filter(
                        MarketCache.cache_date == target_date,
                        MarketCache.key == "stock_list",
                    ).first()
                    if existing:
                        existing.data = json.dumps(stocks, ensure_ascii=False)
                    else:
                        cache_entry = MarketCache(
                            cache_date=target_date,
                            key="stock_list",
                            data=json.dumps(stocks, ensure_ascii=False),
                        )
                        db.add(cache_entry)
                    db.commit()
                except Exception:
                    db.rollback()
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

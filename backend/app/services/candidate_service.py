# backend/app/services/candidate_service.py
"""
均线多头候选池筛选服务
从全市场筛选均线多头排列的股票作为推荐候选池
"""

import asyncio
import numpy as np
from typing import Optional
from app.utils.akshare_utils import get_stock_list, get_stock_daily

# MA 参数
MA_SHORT = 5   # MA5
MA_MID = 10    # MA10
MA_LONG = 20   # MA20

# 量价过滤参数
MIN_CHANGE_PCT = 0      # 最小涨幅（%），排除暴跌
MAX_CHANGE_PCT = 10     # 最大涨幅（%），排除涨停
MIN_PRICE = 5           # 最低价格
MAX_PRICE = 200         # 最高价格
MIN_VOLUME_RATIO = 1.5  # 成交量放大倍数（相对20日均量）


async def get_ma_candidates(top_n: int = 200) -> dict:
    """
    获取均线多头的股票候选池

    筛选条件：
    1. MA5 > MA10 > MA20（多头排列）
    2. 收盘价 > MA20（价格在均线上方）
    3. 涨幅在 0%~10% 之间（排除涨停和暴跌）
    4. 成交量放大（超过20日均量的1.5倍）
    5. 价格在 5-200 元之间

    Returns:
        {"success": True, "data": [stock, ...], "total_scanned": int, ...}
    """
    # 获取全市场行情
    list_result = await get_stock_list()
    if not list_result["success"]:
        return {"success": False, "error": list_result["error"]}

    all_stocks = list_result["data"]
    if not all_stocks:
        return {"success": False, "error": "股票列表为空"}

    # 预过滤：涨幅/价格/成交量初步筛选，减少日线请求量
    pre_filtered = [
        s for s in all_stocks
        if MIN_CHANGE_PCT <= s["change_pct"] <= MAX_CHANGE_PCT
        and s["volume"] > 0
        and MIN_PRICE <= s["price"] <= MAX_PRICE
    ]

    # 并发获取日线数据（限制并发数20，避免请求过快）
    semaphore = asyncio.Semaphore(20)

    async def fetch_and_check(code: str, stock: dict) -> Optional[dict]:
        async with semaphore:
            try:
                result = await get_stock_daily(code, days=25)
                if not result["success"] or len(result["data"]) < 21:
                    return None
                daily_data = result["data"]
                closes = [d["close"] for d in daily_data]
                volumes = [d["volume"] for d in daily_data]

                # 计算均线
                ma5 = np.mean(closes[-5:])
                ma10 = np.mean(closes[-10:])
                ma20 = np.mean(closes[-20:])
                current_price = closes[-1]
                avg_volume_20 = np.mean(volumes[-20:])
                current_volume = volumes[-1]

                # 多头排列条件
                if not (ma5 > ma10 > ma20):
                    return None
                # 价格在均线上方
                if current_price < ma20:
                    return None
                # 成交量放大
                if avg_volume_20 <= 0 or current_volume / avg_volume_20 < MIN_VOLUME_RATIO:
                    return None

                return {
                    **stock,
                    "ma5": round(ma5, 2),
                    "ma10": round(ma10, 2),
                    "ma20": round(ma20, 2),
                    "volume_ratio": round(current_volume / avg_volume_20, 2),
                }
            except Exception:
                return None

    # 并发执行
    tasks = [fetch_and_check(s["code"], s) for s in pre_filtered]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    candidates = []
    for r in results:
        if isinstance(r, dict) and r is not None:
            candidates.append(r)

    # 按成交量放大倍数排序，取前 top_n
    candidates.sort(key=lambda x: x["volume_ratio"], reverse=True)
    candidates = candidates[:top_n]

    return {
        "success": True,
        "data": candidates,
        "total_scanned": len(all_stocks),
        "pre_filtered": len(pre_filtered),
        "ma_candidates": len(candidates),
    }


def format_candidates_for_ai(candidates: list) -> str:
    """将候选池格式化为 AI 输入"""
    lines = []
    for s in candidates:
        lines.append(
            f"{s['code']} {s['name']} 现价:{s['price']} 涨幅:{s['change_pct']:.2f}% "
            f"换手:{s['turnover']:.2f}% 量比:{s['volume_ratio']:.1f}倍 "
            f"MA5:{s['ma5']} MA10:{s['ma10']} MA20:{s['ma20']}"
        )
    return "\n".join(lines)

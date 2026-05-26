# backend/app/services/candidate_service.py
"""
均线多头候选池筛选服务
从全市场筛选均线多头排列的股票作为推荐候选池

设计原则：
- 全市场实时数据：腾讯批量接口，一次请求获取所有股票今日行情
- 预过滤：用今日成交量/价格/涨幅初步筛选，将候选从5000只缩到200只以内
- 日线数据：只对预过滤后的候选股票逐个获取，计算MA
- 整体控制在 200 次日线请求以内（而不是 5000 次）
"""

import asyncio
import numpy as np
from typing import Optional

from app.utils.akshare_utils import get_stock_list, get_stock_daily

# ─── 预过滤参数（今日实时数据） ──────────────────────────────────────────

MA_SHORT = 5
MA_MID = 10
MA_LONG = 20

MIN_CHANGE_PCT = 0
MAX_CHANGE_PCT = 10
MIN_PRICE = 5
MAX_PRICE = 200
MIN_VOLUME_RATIO = 1.5  # 成交量放大倍数（相对20日均量，估算用）

# 预过滤后最多取 top_n 只（按成交量降序），控制日线请求次数
MAX_PREFILTERED = 200


async def get_ma_candidates(top_n: int = 200) -> dict:
    """
    获取均线多头的股票候选池

    筛选分两阶段：
    1. 预过滤（腾讯批量实时数据，无需额外请求）：
       - 涨幅 0%~10%（排除暴跌/涨停）
       - 价格 5-200 元
       - 成交量 > 0
       - 按今日成交量降序，只保留 top 200
    2. 日线筛选（逐个获取日线数据）：
       - MA5 > MA10 > MA20（多头排列）
       - 收盘价 > MA20
       - 估算量比 > 1.5
    """
    list_result = await get_stock_list()
    if not list_result["success"]:
        return {"success": False, "error": list_result["error"]}

    all_stocks = list_result["data"]
    if not all_stocks:
        return {"success": False, "error": "股票列表为空"}

    # ─── Stage 1: 预过滤（基于今日实时数据，无需额外请求） ───────────────
    pre_filtered = [
        s for s in all_stocks
        if MIN_CHANGE_PCT <= s.get("change_pct", -999) <= MAX_CHANGE_PCT
        and MIN_PRICE <= s.get("price", 0) <= MAX_PRICE
        and s.get("volume", 0) > 0
    ]

    # 按今日成交量降序，取 top N（控制日线请求数量）
    pre_filtered.sort(key=lambda s: s.get("volume", 0), reverse=True)
    pre_filtered = pre_filtered[:MAX_PREFILTERED]

    if not pre_filtered:
        return {"success": False, "error": f"预过滤后无候选股票（原始 {len(all_stocks)} 只）"}

    # ─── Stage 2: 并发获取日线数据 ──────────────────────────────────────
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

                ma5 = np.mean(closes[-5:])
                ma10 = np.mean(closes[-10:])
                ma20 = np.mean(closes[-20:])
                current_price = closes[-1]
                avg_vol_20 = np.mean(volumes[-20:])
                current_vol = volumes[-1]

                if not (ma5 > ma10 > ma20):
                    return None
                if current_price < ma20:
                    return None
                vol_ratio = current_vol / avg_vol_20 if avg_vol_20 > 0 else 0
                if vol_ratio < MIN_VOLUME_RATIO:
                    return None

                return {
                    **stock,
                    "ma5": round(ma5, 2),
                    "ma10": round(ma10, 2),
                    "ma20": round(ma20, 2),
                    "volume_ratio": round(vol_ratio, 2),
                }
            except Exception:
                return None

    tasks = [fetch_and_check(s["code"], s) for s in pre_filtered]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    candidates = [r for r in results if isinstance(r, dict) and r is not None]

    # 按量比降序，取 top_n
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
            f"换手:{s.get('turnover', 0):.2f}% 量比:{s.get('volume_ratio', 0):.1f}倍 "
            f"MA5:{s.get('ma5', 0)} MA10:{s.get('ma10', 0)} MA20:{s.get('ma20', 0)}"
        )
    return "\n".join(lines)

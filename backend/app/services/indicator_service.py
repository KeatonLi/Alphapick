"""
技术指标计算服务
提供 MA、MACD、KDJ 等常用技术指标的计算
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any


def calculate_ma(closes: List[float], period: int) -> List[float]:
    """计算简单移动平均线"""
    if len(closes) < period:
        return [0.0] * len(closes)
    result = []
    for i in range(len(closes)):
        if i < period - 1:
            result.append(0.0)
        else:
            result.append(round(sum(closes[i - period + 1:i + 1]) / period, 3))
    return result


def calculate_macd(
    closes: List[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> Dict[str, List[float]]:
    """
    计算 MACD 指标
    返回 DIF, DEA, MACD柱
    """
    if len(closes) < slow_period:
        return {"dif": [0.0] * len(closes), "dea": [0.0] * len(closes), "macd": [0.0] * len(closes)}

    # Calculate EMAs
    def ema(data: List[float], period: int) -> List[float]:
        result = []
        k = 2.0 / (period + 1)
        for i in range(len(data)):
            if i == 0:
                result.append(data[0])
            else:
                result.append(round(data[i] * k + result[-1] * (1 - k), 4))
        return result

    ema_fast = ema(closes, fast_period)
    ema_slow = ema(closes, slow_period)

    dif = [round(f - s, 4) for f, s in zip(ema_fast, ema_slow)]
    dea = ema(dif, signal_period)

    macd = [round((d - de) * 2, 4) for d, de in zip(dif, dea)]

    return {"dif": dif, "dea": dea, "macd": macd}


def calculate_kdj(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    n: int = 9,
    m1: int = 3,
    m2: int = 3,
) -> Dict[str, List[float]]:
    """
    计算 KDJ 指标
    返回 K, D, J 值
    """
    if len(closes) < n:
        return {"k": [50.0] * len(closes), "d": [50.0] * len(closes), "j": [50.0] * len(closes)}

    k_values = []
    d_values = []

    # Initialize with 50
    k_values.append(50.0)
    d_values.append(50.0)

    for i in range(1, len(closes)):
        if i < n - 1:
            k_values.append(50.0)
            d_values.append(50.0)
            continue

        # Calculate RSV
        recent_highs = highs[i - n + 1:i + 1]
        recent_lows = lows[i - n + 1:i + 1]
        hh = max(recent_highs) if recent_highs else closes[i]
        ll = min(recent_lows) if recent_lows else closes[i]
        c = closes[i]

        if hh == ll:
            rsv = 50.0
        else:
            rsv = (c - ll) / (hh - ll) * 100

        # K = 2/3 * prev_K + 1/3 * RSV
        k = 2.0 / 3.0 * k_values[-1] + 1.0 / 3.0 * rsv
        # D = 2/3 * prev_D + 1/3 * K
        d = 2.0 / 3.0 * d_values[-1] + 1.0 / 3.0 * k
        # J = 3*K - 2*D
        j = 3 * k - 2 * d

        k_values.append(round(k, 4))
        d_values.append(round(d, 4))

    j_values = [round(3 * k - 2 * d, 4) for k, d in zip(k_values, d_values)]

    return {"k": k_values, "d": d_values, "j": j_values}


def compute_indicators(daily_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    从日线数据计算所有技术指标
    daily_data: [{"date", "open", "close", "high", "low", "volume"}, ...]
    """
    if not daily_data:
        return {}

    closes = [d["close"] for d in daily_data]
    highs = [d["high"] for d in daily_data]
    lows = [d["low"] for d in daily_data]

    ma5 = calculate_ma(closes, 5)
    ma10 = calculate_ma(closes, 10)
    ma20 = calculate_ma(closes, 20)

    macd = calculate_macd(closes)
    kdj = calculate_kdj(highs, lows, closes)

    # Convert to chart-friendly format (last 60 data points)
    tail_len = min(60, len(daily_data))
    start_idx = len(daily_data) - tail_len

    dates = [d["date"] for d in daily_data[start_idx:]]
    close_prices = closes[start_idx:]
    high_prices = highs[start_idx:]
    low_prices = lows[start_idx:]

    return {
        "dates": dates,
        "prices": {
            "close": close_prices,
            "high": high_prices,
            "low": low_prices,
        },
        "ma": {
            "ma5": ma5[start_idx:],
            "ma10": ma10[start_idx:],
            "ma20": ma20[start_idx:],
        },
        "macd": {
            "dif": macd["dif"][start_idx:],
            "dea": macd["dea"][start_idx:],
            "macd": macd["macd"][start_idx:],
        },
        "kdj": {
            "k": kdj["k"][start_idx:],
            "d": kdj["d"][start_idx:],
            "j": kdj["j"][start_idx:],
        },
    }

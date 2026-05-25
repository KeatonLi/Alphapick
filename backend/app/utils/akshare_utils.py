# backend/app/utils/akshare_utils.py
"""
AKShare 统一数据源封装
替代原有的腾讯财经 + EastMoney 手拼方案
"""

import asyncio

import akshare as ak
import numpy as np
import pandas as pd
from datetime import date, timedelta
from typing import Optional


# ─── 代码格式转换 ────────────────────────────────────────────────────────

def _to_sina_code(code: str) -> str:
    """Convert stock code to sina format: sh600519 / sz000001"""
    code = code.strip()
    if code.startswith(("sh", "sz", "bj")):
        return code
    if code.startswith("6"):
        return f"sh{code}"
    elif code.startswith(("0", "3")):
        return f"sz{code}"
    elif code.startswith(("4", "8")):
        return f"bj{code}"
    return f"sz{code}"


def _to_tencent_code(code: str) -> str:
    """Convert stock code to tencent format: sz000001 / sh600519 / bjxxxx"""
    code = str(code).strip()
    if code.startswith(("sz", "sh", "bj")):
        return code
    if code.startswith(("0", "3")):
        return f"sz{code}"
    elif code.startswith("6"):
        return f"sh{code}"
    elif code.startswith(("4", "8")):
        return f"bj{code}"
    return f"sz{code}"


def _from_tencent_code(code: str) -> str:
    """Remove tencent prefix from stock code"""
    for prefix in ("sh", "sz", "bj"):
        if code.startswith(prefix):
            return code[len(prefix):]
    return code


# ─── 指数行情 ────────────────────────────────────────────────────────────

async def _fetch_index(idx_code: str, name: str) -> Optional[dict]:
    """获取单个指数数据"""
    try:
        df = ak.stock_zh_index_daily(symbol=idx_code)
        if df is None or len(df) < 2:
            return None
        latest = df.tail(1).iloc[0]
        prev = df.tail(2).iloc[0]
        prev_close = float(prev["close"])
        if prev_close == 0:
            return None
        change_pct = (float(latest["close"]) - prev_close) / prev_close * 100
        return {
            "name": name,
            "code": idx_code,
            "close": round(float(latest["close"]), 2),
            "change_pct": round(change_pct, 2),
            "volume": float(latest.get("volume", 0)),
        }
    except Exception:
        return None


async def get_market_index() -> dict:
    """获取主要指数行情（上证/深证/创业板）"""
    try:
        indices = [
            ("sh000001", "上证指数"),
            ("sz399001", "深证成指"),
            ("sz399006", "创业板指"),
        ]
        results = await asyncio.gather(*[
            _fetch_index(idx_code, name)
            for idx_code, name in indices
        ])
        valid_results = [r for r in results if r is not None]
        if not valid_results:
            return {"success": False, "error": "所有指数数据获取失败"}
        return {"success": True, "data": valid_results}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 板块行情 ────────────────────────────────────────────────────────────

async def get_hot_sectors(top_n: int = 10) -> dict:
    """获取热门板块（行业板块），按涨跌幅排序"""
    try:
        df = ak.stock_sector_spot()
        if df is None or df.empty:
            return {"success": False, "error": "板块数据为空"}
        df = df.sort_values("涨跌幅", ascending=False).head(top_n)
        data = []
        for _, row in df.iterrows():
            try:
                change_str = str(row.get("涨跌幅", "0"))
                change_pct = float(change_str) if change_str not in ("", "None") else 0
                leading = str(row.get("股票名称", ""))
                data.append({
                    "name": str(row.get("板块", "")),
                    "change_pct": round(change_pct, 2),
                    "leading_stock": leading,
                    "driver": "",
                })
            except (ValueError, TypeError):
                continue
        if not data:
            return {"success": False, "error": "板块数据解析失败"}
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 个股行情 ────────────────────────────────────────────────────────────

async def get_stock_info(code: str) -> dict:
    """获取股票基本信息"""
    try:
        df = ak.stock_zh_a_spot()
        sina_code = _to_sina_code(code)
        stock_row = df[df["代码"] == sina_code]
        if stock_row.empty:
            stock_row = df[df["代码"] == code]
        if stock_row.empty:
            return {"success": False, "error": f"未找到股票代码 {code}"}
        row = stock_row.iloc[0]
        info = {
            "股票代码": code,
            "股票简称": str(row.get("名称", "")),
            "最新价": str(row.get("最新价", "")),
            "涨跌幅": f"{row.get('涨跌幅', '')}%",
            "昨收": str(row.get("昨收", "")),
            "今开": str(row.get("今开", "")),
            "最高": str(row.get("最高", "")),
            "最低": str(row.get("最低", "")),
            "成交量": str(row.get("成交量", "")),
            "成交额": str(row.get("成交额", "")),
        }
        return {"success": True, "data": info}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_stock_daily(code: str, days: int = 60) -> dict:
    """获取个股日线行情（复权）"""
    try:
        sina_code = _to_sina_code(code)
        df = ak.stock_zh_a_daily(symbol=sina_code, adjust="qfq")
        if df is None or df.empty:
            return {"success": False, "error": "无日线数据"}
        df = df.fillna(0).replace([np.inf, -np.inf], 0)
        df = df.tail(days)
        df["change_pct"] = df["close"].pct_change().fillna(0).replace([np.inf, -np.inf], 0) * 100
        data = []
        for _, row in df.iterrows():
            data.append({
                "日期": str(row["date"]),
                "开盘": float(row["open"]),
                "收盘": float(row["close"]),
                "最高": float(row["high"]),
                "最低": float(row["low"]),
                "成交量": int(row["volume"]),
                "涨跌幅": round(float(row["change_pct"]), 2),
            })
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 全市场行情（用于候选池）────────────────────────────────────────────

async def get_stock_list() -> dict:
    """获取A股全市场实时行情列表"""
    try:
        df = ak.stock_zh_a_spot()
        if df is None or df.empty:
            return {"success": False, "error": "股票列表为空"}
        data = []
        for _, row in df.iterrows():
            code = str(row.get("代码", ""))
            if not code or code in ("None", ""):
                continue
            try:
                price_str = str(row.get("最新价", "0"))
                price = float(price_str) if price_str not in ("0", "", "None") else 0
                if price <= 0:
                    continue
                change_str = str(row.get("涨跌幅", "0"))
                change_pct = float(change_str) if change_str not in ("", "None") else 0
                vol_str = str(row.get("成交量", "0"))
                volume = float(vol_str) if vol_str not in ("0", "", "None") else 0
                turnover_str = str(row.get("换手率", "0"))
                turnover = float(turnover_str.replace("%", "")) if turnover_str not in ("", "None") else 0
                data.append({
                    "code": code,
                    "name": str(row.get("名称", "")),
                    "price": price,
                    "change_pct": change_pct,
                    "volume": volume,
                    "turnover": turnover,
                })
            except (ValueError, TypeError):
                continue
        if not data:
            return {"success": False, "error": "股票数据解析失败"}
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 交易日 ───────────────────────────────────────────────────────────────

def get_trade_dates(days: int = 30) -> list[str]:
    """获取最近N个交易日"""
    today = date.today()
    since = today - timedelta(days=days)
    try:
        df = ak.tool_trade_date_hsiec()
        if df is None or df.empty:
            raise ValueError("交易日历为空")
        date_col = df.columns[0]
        df[date_col] = pd.to_datetime(df[date_col])
        mask = (df[date_col] >= pd.Timestamp(since)) & (df[date_col] <= pd.Timestamp(today))
        dates = df.loc[mask, date_col].sort_values(ascending=False).dt.strftime("%Y-%m-%d").tolist()
        return dates
    except Exception:
        # fallback: 按工作日过滤
        result = []
        d = today
        while len(result) < days and d >= since:
            if d.weekday() < 5:
                result.append(d.strftime("%Y-%m-%d"))
            d -= timedelta(days=1)
        return result


def get_trade_dates_for_frontend(days: int = 365) -> dict:
    """获取前端可用的交易日列表（用于日期选择器）"""
    try:
        dates = get_trade_dates(days)
        return {"success": True, "data": dates}
    except Exception as e:
        return {"success": False, "error": str(e)}

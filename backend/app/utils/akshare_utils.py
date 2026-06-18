# backend/app/utils/akshare_utils.py
"""
AKShare 统一数据源封装 — 已升级为多源互备架构

底层通过 MultiSourceManager 按优先级轮询多个数据源：
  1. AKShare（主源，数据最全）
  2. 腾讯证券（备1，实时行情快）
  3. 新浪财经（备2，极简稳定）

对外接口完全保持向后兼容，调用方无需任何修改。
"""

import asyncio
import time
import json
import logging

import akshare as ak
import numpy as np
import pandas as pd
from datetime import date, timedelta
from typing import Optional

from app.datasource.multi_source import multi_source

logger = logging.getLogger(__name__)


# ─── 代码格式转换（保持向后兼容）───────────────────────────────────────────

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


# ─── 指数行情（多源互备）──────────────────────────────────────────────────

async def _fetch_index(idx_code: str, name: str) -> Optional[dict]:
    """获取单个指数数据（通过多源管理器）"""
    try:
        result = multi_source.get_index_daily(idx_code)
        if not result["success"]:
            return None
        data = result["data"]
        if len(data) < 2:
            return None
        latest = data[-1]
        prev = data[-2]
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
    """获取主要指数行情（上证/深证/创业板）— 多源互备"""
    try:
        # 优先尝试多源管理器（可能走 AKShare/腾讯/新浪）
        result = multi_source.get_market_index()
        if result["success"]:
            # 添加来源标记到日志
            source = result.get("_source", "unknown")
            logger.info(f"[get_market_index] 数据源: {source}")
            return result

        # 多源全部失败，fallback 到并行获取单个指数
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


# ─── 板块行情（多源互备）─────────────────────────────────────────────────

async def get_hot_sectors(top_n: int = 10) -> dict:
    """获取热门板块（行业板块），按涨跌幅排序 — 多源互备"""
    result = multi_source.get_hot_sectors(top_n)
    if result["success"]:
        source = result.get("_source", "unknown")
        logger.info(f"[get_hot_sectors] 数据源: {source}")
    return result


# ─── 个股行情（多源互备）─────────────────────────────────────────────────

async def get_stock_info(code: str) -> dict:
    """获取股票基本信息 — 多源互备"""
    result = multi_source.get_stock_info(code)
    if result["success"]:
        source = result.get("_source", "unknown")
        logger.info(f"[get_stock_info] 数据源: {source}")
    return result


async def get_stock_daily(code: str, days: int = 60) -> dict:
    """获取个股日线行情（复权）— 多源互备

    注意：腾讯和新浪不支持历史日线，所以此接口实际上主要依赖 AKShare。
    如果 AKShare 失败，会返回错误（历史数据没有备用源）。
    未来可接入 Baostock 或麦蕊数据作为历史数据备用源。
    """
    result = multi_source.get_stock_daily(code, days, adjust="qfq")
    if result["success"]:
        source = result.get("_source", "unknown")
        logger.info(f"[get_stock_daily] 数据源: {source}")
        # 统一字段名（兼容旧格式）
        data = result["data"]
        unified = []
        for row in data:
            unified.append({
                "日期": row.get("日期", row.get("date", "")),
                "开盘": row.get("开盘", row.get("open", 0)),
                "收盘": row.get("收盘", row.get("close", 0)),
                "最高": row.get("最高", row.get("high", 0)),
                "最低": row.get("最低", row.get("low", 0)),
                "成交量": row.get("成交量", row.get("volume", 0)),
                "涨跌幅": row.get("涨跌幅", row.get("change_pct", 0)),
            })
        return {"success": True, "data": unified}
    return result


# ─── 全市场行情（多源互备 + 缓存）────────────────────────────────────────

_stock_list_cache = {
    "data": None,
    "timestamp": 0,
    "cache_key": "",
}

_CACHE_TTL = 300  # 5分钟内存缓存


async def get_stock_list(force_refresh: bool = False) -> dict:
    """获取A股全市场实时行情列表（带5分钟内存缓存）— 多源互备"""
    now = time.time()
    cache_valid = (
        _stock_list_cache["data"] is not None
        and not force_refresh
        and now - _stock_list_cache["timestamp"] < _CACHE_TTL
    )
    if cache_valid:
        return _stock_list_cache["data"]

    # 优先使用多源管理器（AKShare → 腾讯）
    result = multi_source.get_stock_spot()
    if result["success"]:
        source = result.get("_source", "unknown")
        logger.info(f"[get_stock_list] 数据源: {source}")
        _stock_list_cache["data"] = result
        _stock_list_cache["timestamp"] = now
        return result

    # 多源全部失败，fallback 到原生的 EastMoney + 腾讯组合
    logger.warning("[get_stock_list] 多源管理器全部失败，fallback 到原生组合")
    result = await _fetch_stock_list_raw()
    if result["success"]:
        _stock_list_cache["data"] = result
        _stock_list_cache["timestamp"] = now
    return result


async def _fetch_stock_list_raw() -> dict:
    """原生 EastMoney + 腾讯组合（作为最终 fallback）"""
    import requests

    try:
        # Step 1: 从 EastMoney 数据中心获取所有 A 股代码列表
        all_codes = []
        page = 1
        while True:
            url = (
                "https://datacenter.eastmoney.com/api/data/v1/get"
                "?reportName=RPT_F10_ORG_BASICINFO"
                "&columns=SECURITY_CODE,SECURITY_NAME_ABBR"
                f"&pageSize=500"
                f"&pageNumber={page}"
                "&source=HSF10&client=PC"
            )
            r = requests.get(url, headers={
                "Referer": "https://data.eastmoney.com",
                "User-Agent": "Mozilla/5.0",
            }, timeout=15)
            r.raise_for_status()
            em_data = r.json()
            items = em_data.get("result", {}).get("data", [])
            if not items:
                break
            for item in items:
                code = str(item.get("SECURITY_CODE", ""))
                if code:
                    all_codes.append({
                        "code": code,
                        "name": str(item.get("SECURITY_NAME_ABBR", "")),
                    })
            total_pages = em_data.get("result", {}).get("pages", 1)
            if page >= total_pages or page >= 50:
                break
            page += 1

        if not all_codes:
            return {"success": False, "error": "股票列表为空"}

        # Step 2: 腾讯批量查行情（每次最多100个代码）
        data = []
        batch_size = 100
        headers = {
            "Referer": "https://finance.qq.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }

        for i in range(0, len(all_codes), batch_size):
            batch = all_codes[i:i + batch_size]
            tencent_codes = [_to_tencent_code(c["code"]) for c in batch]
            qt_url = f"https://qt.gtimg.cn/q={','.join(tencent_codes)}"
            try:
                r = requests.get(qt_url, headers=headers, timeout=10)
                lines = r.text.strip().split("\n")
                code_idx_map = {c["code"]: idx for idx, c in enumerate(batch)}
                price_map = {}

                for line in lines:
                    if "~\"" not in line:
                        continue
                    try:
                        parts = line.split("~")
                        if len(parts) < 35:
                            continue
                        raw_code = parts[2] if len(parts) > 2 else ""
                        clean_code = _from_tencent_code(raw_code)
                        if clean_code not in code_idx_map:
                            continue
                        price_str = parts[3] if len(parts) > 3 else "0"
                        price = float(price_str) if price_str not in ("", "0") else 0
                        if price <= 0:
                            continue
                        change_str = parts[32] if len(parts) > 32 else "0"
                        change_pct = float(change_str) if change_str not in ("",) else 0
                        vol_str = parts[6] if len(parts) > 6 else "0"
                        volume = float(vol_str) if vol_str not in ("",) else 0
                        turnover_str = parts[36] if len(parts) > 36 else "0"
                        try:
                            turnover = float(turnover_str) if turnover_str not in ("", "None") else 0
                        except ValueError:
                            turnover = 0
                        orig = batch[code_idx_map[clean_code]]
                        data.append({
                            "code": clean_code,
                            "name": orig["name"],
                            "price": price,
                            "change_pct": change_pct,
                            "volume": volume,
                            "turnover": turnover,
                        })
                    except (ValueError, IndexError):
                        continue
            except Exception:
                continue

        if not data:
            return {"success": False, "error": "行情数据获取失败"}
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 交易日（多源互备）────────────────────────────────────────────────────

def is_trade_date(d: date) -> bool:
    """判断指定日期是否为 A 股交易日 — 多源互备"""
    # 周末直接返回 False
    if d.weekday() >= 5:
        return False
    try:
        result = multi_source.get_trade_calendar()
        if not result["success"]:
            raise ValueError("交易日历获取失败")
        dates = result["data"]
        return d.strftime("%Y-%m-%d") in dates
    except Exception:
        # fallback: 周末判断 + 简单规则
        return d.weekday() < 5


def get_trade_days_after(from_date: date, n: int) -> list[date]:
    """获取 from_date 之后的第 1 到第 n 个交易日（按升序返回）— 多源互备"""
    try:
        result = multi_source.get_trade_calendar()
        if not result["success"]:
            raise ValueError("交易日历获取失败")
        dates = result["data"]
        # 转为 date 对象并筛选
        trade_dates = []
        for ds in dates:
            try:
                trade_dates.append(date.fromisoformat(ds))
            except ValueError:
                continue
        trade_dates.sort()
        after = [d for d in trade_dates if d > from_date]
        return after[:n]
    except Exception:
        # fallback: 按工作日推算
        result = []
        d = from_date + timedelta(days=1)
        while len(result) < n:
            if d.weekday() < 5:
                result.append(d)
            d += timedelta(days=1)
        return result


def get_trade_dates(days: int = 30) -> list[str]:
    """获取最近N个交易日 — 多源互备"""
    today = date.today()
    since = today - timedelta(days=days)
    try:
        result = multi_source.get_trade_calendar()
        if not result["success"]:
            raise ValueError("交易日历获取失败")
        all_dates = result["data"]
        # 筛选最近 days 个
        filtered = []
        for ds in reversed(all_dates):
            try:
                d = date.fromisoformat(ds)
                if d <= today and d >= since:
                    filtered.append(ds)
                if len(filtered) >= days:
                    break
            except ValueError:
                continue
        return filtered
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
    """获取前端可用的交易日列表（用于日期选择器）— 多源互备"""
    try:
        dates = get_trade_dates(days)
        return {"success": True, "data": dates}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 沪深港通资金流（多源互备）────────────────────────────────────────────

async def get_hsgt_flow() -> dict:
    """获取沪深港通（北向）资金流数据 — 多源互备"""
    result = multi_source.get_hsgt_flow()
    if result["success"]:
        source = result.get("_source", "unknown")
        logger.info(f"[get_hsgt_flow] 数据源: {source}")
        return result

    # fallback 到原生 AKShare 直接调用
    logger.warning("[get_hsgt_flow] 多源管理器失败，fallback 到原生 AKShare")
    try:
        loop = asyncio.get_event_loop()
        sh_df = await loop.run_in_executor(
            None, lambda: ak.stock_hsgt_hist_em(symbol="沪股通")
        )
        sz_df = await loop.run_in_executor(
            None, lambda: ak.stock_hsgt_hist_em(symbol="深股通")
        )
    except Exception as e:
        return {"success": False, "error": str(e)}

    if sh_df is None or sh_df.empty or sz_df is None or sz_df.empty:
        return {"success": False, "error": "沪深港通数据为空"}

    sh_latest = sh_df.tail(1).iloc[0]
    sz_latest = sz_df.tail(1).iloc[0]

    today_flow = {
        "date": str(sh_latest["日期"]),
        "sh_net_buy": round(float(sh_latest["当日成交净买额"]), 2),
        "sh_total_inflow": round(float(sh_latest["当日资金流入"]), 2),
        "sh_cumulative": round(float(sh_latest["历史累计净买额"]), 2),
        "sz_net_buy": round(float(sz_latest["当日成交净买额"]), 2),
        "sz_total_inflow": round(float(sz_latest["当日资金流入"]), 2),
        "sz_cumulative": round(float(sz_latest["历史累计净买额"]), 2),
        "total_net_buy": round(float(sh_latest["当日成交净买额"]) + float(sz_latest["当日成交净买额"]), 2),
    }

    sh_hist = sh_df.tail(30)
    sz_hist = sz_df.tail(30)
    history = []
    for i in range(len(sh_hist)):
        sh_row = sh_hist.iloc[i]
        sz_row = sz_hist.iloc[i] if i < len(sz_hist) else None
        entry = {
            "date": str(sh_row["日期"]),
            "sh_net_buy": round(float(sh_row["当日成交净买额"]), 2),
            "sz_net_buy": round(float(sz_row["当日成交净买额"]), 2) if sz_row is not None else 0,
        }
        history.append(entry)

    return {
        "success": True,
        "data": {
            "today": today_flow,
            "history": history,
        }
    }

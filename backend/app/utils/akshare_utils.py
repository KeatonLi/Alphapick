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
    """获取A股全市场实时行情列表
    数据来源：EastMoney数据中心获取股票列表 + 腾讯批量接口获取实时行情
    """
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
            if page >= total_pages or page >= 50:  # 最多50页（约25000条）
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

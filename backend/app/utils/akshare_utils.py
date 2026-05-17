import asyncio

import akshare as ak
import numpy as np
import pandas as pd
from datetime import date, timedelta


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


async def get_stock_info(code: str) -> dict:
    """获取股票基本信息，使用 sina 数据源"""
    try:
        sina_code = _to_sina_code(code)
        df_spot = ak.stock_zh_a_spot()

        # stock_zh_a_spot uses prefixed codes: sh600519, sz000001
        stock_row = df_spot[df_spot["代码"] == sina_code]
        if stock_row.empty:
            stock_row = df_spot[df_spot["代码"] == code]
        if stock_row.empty:
            return {"success": False, "error": f"未找到股票代码 {code}"}

        row = stock_row.iloc[0]
        info = {
            "股票代码": code,
            "股票简称": str(row.get("名称", "")),
            "最新价": str(row.get("最新价", "")),
            "涨跌额": str(row.get("涨跌额", "")),
            "涨跌幅": f"{row.get('涨跌幅', '')}%",
            "昨收": str(row.get("昨收", "")),
            "今开": str(row.get("今开", "")),
            "最高": str(row.get("最高", "")),
            "最低": str(row.get("最低", "")),
            "成交量": str(row.get("成交量", "")),
            "成交额": str(row.get("成交额", "")),
        }

        # Try to get company profile from cninfo
        try:
            profile = ak.stock_profile_cninfo(symbol=code)
            if not profile.empty:
                info["公司名称"] = str(profile.iloc[0, 1]) if profile.shape[1] > 1 else ""
        except Exception:
            pass

        return {"success": True, "data": info}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_stock_daily(code: str, days: int = 60) -> dict:
    """获取个股日线行情，使用 sina 数据源"""
    try:
        sina_code = _to_sina_code(code)
        df = ak.stock_zh_a_daily(symbol=sina_code, adjust="qfq")
        df = df.fillna(0).replace([np.inf, -np.inf], 0)
        df = df.tail(days)

        # Add change_pct column
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


async def _fetch_index(idx_code: str, name: str) -> dict:
    df = ak.stock_zh_index_daily(symbol=idx_code)
    latest = df.tail(1).iloc[0]
    prev = df.tail(2).iloc[0]
    change_pct = (latest["close"] - prev["close"]) / prev["close"] * 100
    return {
        "name": name,
        "code": idx_code,
        "close": float(latest["close"]),
        "change_pct": round(change_pct, 2),
        "volume": float(latest["volume"]),
    }


async def get_market_index() -> dict:
    """获取主要指数行情"""
    try:
        indices = ["sh000001", "sz399001", "sz399006"]
        names = ["上证指数", "深证成指", "创业板指"]

        results = await asyncio.gather(*[
            _fetch_index(idx_code, name)
            for idx_code, name in zip(indices, names)
        ])
        return {"success": True, "data": list(results)}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _fetch_sector(concept_name: str, today_str: str, start_str: str, row: pd.Series) -> dict | None:
    change_pct = 0.0
    try:
        idx_df = ak.stock_board_concept_index_ths(
            symbol=concept_name,
            start_date=start_str,
            end_date=today_str,
        )
        if idx_df is not None and len(idx_df) >= 2:
            latest_close = float(idx_df.iloc[-1]["收盘"])
            prev_close = float(idx_df.iloc[-2]["收盘"])
            if prev_close != 0:
                change_pct = (latest_close - prev_close) / prev_close * 100
    except Exception:
        return None
    return {
        "name": concept_name,
        "change_pct": round(change_pct, 2),
        "leading_stock": str(row.get("龙头股", "")),
        "driver": str(row.get("驱动事件", "")),
    }


async def get_hot_sectors(top_n: int = 10) -> dict:
    """获取热门板块，使用同花顺数据源"""
    try:
        summary = ak.stock_board_concept_summary_ths()
        today_str = date.today().strftime("%Y%m%d")
        start_str = (date.today() - timedelta(days=5)).strftime("%Y%m%d")

        concepts = list(summary.head(top_n * 2).iterrows())
        results = await asyncio.gather(*[
            _fetch_sector(row["概念名称"], today_str, start_str, row)
            for _, row in concepts
        ])

        data = [r for r in results if r is not None][:top_n]
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_stock_list() -> dict:
    """获取A股列表，使用 sina 数据源"""
    try:
        df = ak.stock_zh_a_spot()
        data = []
        for _, row in df.head(5000).iterrows():
            try:
                price = float(row["最新价"]) if pd.notna(row["最新价"]) else 0
            except (ValueError, TypeError):
                price = 0
            try:
                change_pct = float(row["涨跌幅"]) if pd.notna(row["涨跌幅"]) else 0
            except (ValueError, TypeError):
                change_pct = 0
            try:
                volume = float(row["成交量"]) if pd.notna(row["成交量"]) else 0
            except (ValueError, TypeError):
                volume = 0
            # Old API doesn't have 换手率, calculate from 成交额 as rough activity proxy
            try:
                amount = float(row["成交额"]) if pd.notna(row["成交额"]) else 0
                turnover = amount / 1e7 if amount > 0 else 0  # rough proxy scaled to 0-10 range
            except (ValueError, TypeError):
                turnover = 0

            # Strip prefix from code for cleaner display (sh600519 -> 600519)
            code = str(row["代码"])
            if len(code) > 6 and code[:2] in ("sh", "sz", "bj"):
                code = code[2:]

            data.append({
                "code": code,
                "name": str(row["名称"]),
                "price": price,
                "change_pct": change_pct,
                "volume": volume,
                "turnover": turnover,
            })
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_trade_dates(days: int = 30) -> list[str]:
    """获取最近N个交易日的日期列表（使用 akshare 官方交易日历）"""
    try:
        df = ak.tool_trade_date_hsiec()
        today = date.today()
        since = today - timedelta(days=days)
        # df 的日期列可能是 trade_date 或类似的列名
        date_col = [c for c in df.columns if "trade" in c.lower() and "date" in c.lower()]
        if not date_col:
            date_col = df.columns[0]
        else:
            date_col = date_col[0]
        df[date_col] = pd.to_datetime(df[date_col])
        mask = (df[date_col] >= pd.Timestamp(since)) & (df[date_col] <= pd.Timestamp(today))
        dates = df.loc[mask, date_col].sort_values(ascending=False).dt.strftime("%Y-%m-%d").tolist()
        return dates
    except Exception:
        # fallback: 简单按周一到周五过滤
        result = []
        d = today
        while len(result) < days and d >= since:
            if d.weekday() < 5:
                result.append(d.strftime("%Y-%m-%d"))
            d -= timedelta(days=1)
        return result

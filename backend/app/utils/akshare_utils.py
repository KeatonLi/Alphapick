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
            close_col = "收盘价" if "收盘价" in idx_df.columns else "收盘"
            latest_close = float(idx_df.iloc[-1][close_col])
            prev_close = float(idx_df.iloc[-2][close_col])
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
    """获取A股列表，使用 EastMoney 数据中心 + 腾讯批量行情接口"""
    try:
        import requests

        # Step 1: 获取所有 A 股代码列表（EastMoney 数据中心）
        em_url = (
            "https://datacenter.eastmoney.com/api/data/v1/get"
            "?reportName=RPT_F10_ORG_BASICINFO"
            "&columns=SECURITY_CODE,SECURITY_NAME_ABBR"
            "&pageSize=500"
            "&pageNumber=1"
            "&source=HSF10&client=PC"
        )
        r = requests.get(em_url, headers={
            "Referer": "https://data.eastmoney.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }, timeout=15)
        r.raise_for_status()
        em_data = r.json()
        total_pages = em_data.get("result", {}).get("pages", 1)
        total_count = em_data.get("result", {}).get("count", 0)

        # 收集所有股票代码
        all_codes = []
        for page in range(1, min(total_pages + 1, 50)):  # 最多50页（约25000条）
            r_page = requests.get(
                em_url.replace("&pageNumber=1", f"&pageNumber={page}"),
                headers={"Referer": "https://data.eastmoney.com",
                         "User-Agent": "Mozilla/5.0"},
                timeout=15
            )
            items = r_page.json().get("result", {}).get("data", [])
            for item in items:
                code = str(item.get("SECURITY_CODE", ""))
                if code:
                    all_codes.append(code)
            if page >= total_pages:
                break

        # Step 2: 腾讯批量查行情（每次最多120个代码）
        data = []
        batch_size = 100
        headers = {
            "Referer": "https://finance.qq.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }

        for i in range(0, len(all_codes), batch_size):
            batch = all_codes[i:i + batch_size]
            # 转换代码格式：000001 -> sz000001, 600519 -> sh600519
            tencent_codes = []
            for c in batch:
                if c.startswith(("0", "3")):
                    tencent_codes.append(f"sz{c}")
                elif c.startswith(("6",)):
                    tencent_codes.append(f"sh{c}")
                elif c.startswith(("4", "8")):
                    tencent_codes.append(f"bj{c}")
                else:
                    tencent_codes.append(f"sz{c}")

            qt_url = f"https://qt.gtimg.cn/q={','.join(tencent_codes)}"
            try:
                r = requests.get(qt_url, headers=headers, timeout=10)
                lines = r.text.strip().split("\n")
                for line in lines:
                    if "~\"" not in line:
                        continue
                    try:
                        parts = line.split("~")
                        # 格式: v_sz000001="1~name~code~price~..."
                        # parts[1]=name, parts[2]=code, parts[3]=current, parts[4]=yesterday_close
                        # parts[5]=open, parts[6]=vol, parts[32]=change_pct, parts[36]=turnover
                        name = parts[1] if len(parts) > 1 else ""
                        code = parts[2] if len(parts) > 2 else ""
                        price_str = parts[3] if len(parts) > 3 else "0"
                        vol_str = parts[6] if len(parts) > 6 else "0"
                        change_str = parts[32] if len(parts) > 32 else "0"
                        turnover_str = parts[36] if len(parts) > 36 else "0"

                        price = float(price_str) if price_str not in ("0", "") else 0
                        if price == 0:
                            continue  # 停牌或无效

                        volume = float(vol_str) if vol_str not in ("0", "") else 0
                        change_pct = float(change_str) if change_str not in ("",) else 0
                        try:
                            turnover = float(turnover_str) if turnover_str not in ("", "None") else 0
                        except (ValueError, TypeError):
                            turnover = 0

                        # 去除前缀
                        clean_code = code
                        for prefix in ("sh", "sz", "bj"):
                            if clean_code.startswith(prefix):
                                clean_code = clean_code[len(prefix):]
                                break

                        data.append({
                            "code": clean_code,
                            "name": name,
                            "price": price,
                            "change_pct": change_pct,
                            "volume": volume,
                            "turnover": turnover,
                        })
                    except (ValueError, IndexError):
                        continue
            except Exception:
                continue

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_trade_dates(days: int = 30) -> list[str]:
    """获取最近N个交易日的日期列表（使用 akshare 官方交易日历）"""
    today = date.today()
    since = today - timedelta(days=days)
    try:
        df = ak.tool_trade_date_hsiec()
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

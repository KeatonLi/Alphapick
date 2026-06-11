"""AKShare Provider — 主数据源，数据最全面"""

import logging
from datetime import date
from typing import Optional

import akshare as ak
import numpy as np
import pandas as pd

from app.datasource.providers.base import DataProvider

logger = logging.getLogger(__name__)


class AkShareProvider(DataProvider):
    """AKShare 数据源 Provider

    作为主数据源，数据覆盖面最广（个股/指数/板块/资金流向/涨停池/交易日历）。
    当 AKShare 失败时，MultiSourceManager 自动降级到备用 Provider。
    """

    name = "akshare"
    priority = 1  # 优先级最高（数字越小越优先）

    # ── 代码格式转换 ──

    @staticmethod
    def _to_sina_code(code: str) -> str:
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

    # ── 个股行情 ──

    def get_stock_info(self, code: str) -> dict:
        try:
            df = ak.stock_zh_a_spot()
            sina_code = self._to_sina_code(code)
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
            logger.warning(f"[AkShare] get_stock_info({code}) failed: {e}")
            return {"success": False, "error": str(e)}

    def get_stock_daily(self, code: str, days: int = 60, adjust: str = "qfq") -> dict:
        try:
            sina_code = self._to_sina_code(code)
            df = ak.stock_zh_a_daily(symbol=sina_code, adjust=adjust)
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
            logger.warning(f"[AkShare] get_stock_daily({code}) failed: {e}")
            return {"success": False, "error": str(e)}

    def get_stock_spot(self, code: Optional[str] = None) -> dict:
        """获取实时行情快照
        code 为 None 时返回全市场列表（通过 stock_zh_a_spot_em）
        """
        try:
            if code:
                # 单股查询：用 stock_zh_a_spot 全量过滤
                df = ak.stock_zh_a_spot()
                sina_code = self._to_sina_code(code)
                row = df[df["代码"] == sina_code]
                if row.empty:
                    return {"success": False, "error": f"未找到 {code}"}
                r = row.iloc[0]
                return {
                    "success": True,
                    "data": [{
                        "code": code,
                        "name": str(r.get("名称", "")),
                        "price": float(r.get("最新价", 0) or 0),
                        "change_pct": float(r.get("涨跌幅", 0) or 0),
                        "volume": float(r.get("成交量", 0) or 0),
                        "turnover": float(r.get("成交额", 0) or 0),
                    }]
                }
            else:
                # 全市场
                df = ak.stock_zh_a_spot_em()
                if df is None or df.empty:
                    return {"success": False, "error": "全市场数据为空"}
                data = []
                for _, row in df.iterrows():
                    data.append({
                        "code": str(row.get("代码", "")).replace("sh", "").replace("sz", "").replace("bj", ""),
                        "name": str(row.get("名称", "")),
                        "price": float(row.get("最新价", 0) or 0),
                        "change_pct": float(row.get("涨跌幅", 0) or 0),
                        "volume": float(row.get("成交量", 0) or 0),
                        "turnover": float(row.get("成交额", 0) or 0),
                    })
                return {"success": True, "data": data}
        except Exception as e:
            logger.warning(f"[AkShare] get_stock_spot({code}) failed: {e}")
            return {"success": False, "error": str(e)}

    # ── 指数行情 ──

    def get_index_daily(self, idx_code: str) -> dict:
        try:
            df = ak.stock_zh_index_daily(symbol=idx_code)
            if df is None or len(df) < 2:
                return {"success": False, "error": "指数数据不足"}
            data = []
            for _, row in df.iterrows():
                data.append({
                    "date": str(row["date"]),
                    "open": float(row["open"]),
                    "close": float(row["close"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "volume": float(row.get("volume", 0)),
                })
            return {"success": True, "data": data}
        except Exception as e:
            logger.warning(f"[AkShare] get_index_daily({idx_code}) failed: {e}")
            return {"success": False, "error": str(e)}

    def get_market_index(self) -> dict:
        try:
            indices = [
                ("sh000001", "上证指数"),
                ("sz399001", "深证成指"),
                ("sz399006", "创业板指"),
            ]
            results = []
            for code, name in indices:
                result = self.get_index_daily(code)
                if result["success"] and result["data"]:
                    latest = result["data"][-1]
                    prev = result["data"][-2] if len(result["data"]) >= 2 else latest
                    prev_close = float(prev["close"])
                    if prev_close == 0:
                        continue
                    change_pct = (float(latest["close"]) - prev_close) / prev_close * 100
                    results.append({
                        "name": name,
                        "code": code,
                        "close": round(float(latest["close"]), 2),
                        "change_pct": round(change_pct, 2),
                        "volume": float(latest.get("volume", 0)),
                    })
            if not results:
                return {"success": False, "error": "所有指数数据获取失败"}
            return {"success": True, "data": results}
        except Exception as e:
            logger.warning(f"[AkShare] get_market_index failed: {e}")
            return {"success": False, "error": str(e)}

    # ── 板块行情 ──

    def get_hot_sectors(self, top_n: int = 10) -> dict:
        try:
            df = ak.stock_board_industry_summary_ths()
            if df is None or df.empty:
                return {"success": False, "error": "板块数据为空"}
            df = df.sort_values("涨跌幅", ascending=False).head(top_n)
            data = []
            for _, row in df.iterrows():
                try:
                    change_str = str(row.get("涨跌幅", "0"))
                    change_pct = float(change_str) if change_str not in ("", "None") else 0
                    leading = str(row.get("领涨股", ""))
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
            logger.warning(f"[AkShare] get_hot_sectors failed: {e}")
            return {"success": False, "error": str(e)}

    # ── 资金流向 ──

    def get_hsgt_flow(self) -> dict:
        try:
            result = {}
            for symbol in ["沪股通", "深股通"]:
                try:
                    df = ak.stock_hsgt_hist_em(symbol=symbol)
                    if df is not None and not df.empty:
                        result[symbol] = df.to_dict(orient="records")
                except Exception:
                    continue
            if not result:
                return {"success": False, "error": "沪深港通数据为空"}

            sh_df = pd.DataFrame(result.get("沪股通", []))
            sz_df = pd.DataFrame(result.get("深股通", []))

            if sh_df.empty or sz_df.empty:
                return {"success": False, "error": "沪深港通数据不完整"}

            sh_latest = sh_df.tail(1).iloc[0]
            sz_latest = sz_df.tail(1).iloc[0]

            today_flow = {
                "date": str(sh_latest.get("日期", "")),
                "sh_net_buy": round(float(sh_latest.get("当日成交净买额", 0)), 2),
                "sh_total_inflow": round(float(sh_latest.get("当日资金流入", 0)), 2),
                "sh_cumulative": round(float(sh_latest.get("历史累计净买额", 0)), 2),
                "sz_net_buy": round(float(sz_latest.get("当日成交净买额", 0)), 2),
                "sz_total_inflow": round(float(sz_latest.get("当日资金流入", 0)), 2),
                "sz_cumulative": round(float(sz_latest.get("历史累计净买额", 0)), 2),
                "total_net_buy": round(
                    float(sh_latest.get("当日成交净买额", 0)) + float(sz_latest.get("当日成交净买额", 0)), 2
                ),
            }

            sh_hist = sh_df.tail(30)
            sz_hist = sz_df.tail(30)
            history = []
            for i in range(len(sh_hist)):
                sh_row = sh_hist.iloc[i]
                sz_row = sz_hist.iloc[i] if i < len(sz_hist) else None
                entry = {
                    "date": str(sh_row.get("日期", "")),
                    "sh_net_buy": round(float(sh_row.get("当日成交净买额", 0)), 2),
                    "sz_net_buy": round(float(sz_row.get("当日成交净买额", 0)), 2) if sz_row is not None else 0,
                }
                history.append(entry)

            return {
                "success": True,
                "data": {
                    "today": today_flow,
                    "history": history,
                }
            }
        except Exception as e:
            logger.warning(f"[AkShare] get_hsgt_flow failed: {e}")
            return {"success": False, "error": str(e)}

    # ── 涨停池 ──

    def get_limit_up_pool(self, target_date: date) -> dict:
        try:
            df = ak.stock_zt_pool_em(date=target_date.strftime("%Y%m%d"))
            if df is None or df.empty:
                return {"success": False, "error": "涨停池为空"}
            return {"success": True, "data": df.to_dict(orient="records")}
        except Exception as e:
            logger.warning(f"[AkShare] get_limit_up_pool({target_date}) failed: {e}")
            return {"success": False, "error": str(e)}

    # ── 交易日历 ──

    def get_trade_calendar(self) -> dict:
        try:
            df = ak.tool_trade_date_hist_sina()
            if df is None or df.empty:
                return {"success": False, "error": "交易日历为空"}
            date_col = df.columns[0]
            df[date_col] = pd.to_datetime(df[date_col])
            dates = df[date_col].dt.strftime("%Y-%m-%d").tolist()
            return {"success": True, "data": dates}
        except Exception as e:
            logger.warning(f"[AkShare] get_trade_calendar failed: {e}")
            return {"success": False, "error": str(e)}

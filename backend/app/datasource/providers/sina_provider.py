"""新浪财经 Provider — 极简备用实时行情源

特点：
- 接口极简，200ms 级响应
- 支持批量查询（逗号分隔多代码）
- 返回文本需解析
- 适合作为实时行情的最后一道备用
"""

import logging
import requests
from datetime import date
from typing import Optional

from app.datasource.providers.base import DataProvider

logger = logging.getLogger(__name__)


class SinaProvider(DataProvider):
    """新浪财经数据源 Provider（备用）"""

    name = "sina"
    priority = 3  # 优先级最低（最后备用）

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

    @staticmethod
    def _from_sina_code(code: str) -> str:
        for prefix in ("sh", "sz", "bj"):
            if code.startswith(prefix):
                return code[len(prefix):]
        return code

    # ── 个股行情 ──

    def get_stock_info(self, code: str) -> dict:
        """用实时行情接口获取基本信息"""
        result = self.get_stock_spot(code)
        if not result["success"] or not result["data"]:
            return result
        item = result["data"][0]
        return {
            "success": True,
            "data": {
                "股票代码": code,
                "股票简称": item.get("name", ""),
                "最新价": str(item.get("price", "")),
                "涨跌幅": f"{item.get('change_pct', '')}%",
                "昨收": str(item.get("prev_close", "")),
                "今开": str(item.get("open", "")),
                "最高": str(item.get("high", "")),
                "最低": str(item.get("low", "")),
                "成交量": str(item.get("volume", "")),
                "成交额": "",
            }
        }

    def get_stock_daily(self, code: str, days: int = 60, adjust: str = "qfq") -> dict:
        """新浪接口不提供历史日线数据"""
        return {"success": False, "error": "新浪接口不支持历史日线数据"}

    def get_stock_spot(self, code: Optional[str] = None) -> dict:
        """获取实时行情快照"""
        try:
            if code:
                codes = [self._to_sina_code(code)]
            else:
                # 全市场：新浪接口不支持直接获取全市场，返回错误
                return {"success": False, "error": "新浪接口不支持全市场批量查询（请用腾讯或 AKShare）"}

            url = f"http://hq.sinajs.cn/list={','.join(codes)}"
            headers = {
                "Referer": "https://finance.sina.com.cn",
                "User-Agent": "Mozilla/5.0",
            }
            r = requests.get(url, headers=headers, timeout=10)
            r.raise_for_status()
            return self._parse_sina_response(r.text, codes)
        except Exception as e:
            logger.warning(f"[Sina] get_stock_spot({code}) failed: {e}")
            return {"success": False, "error": str(e)}

    def _parse_sina_response(self, text: str, expected_codes: list) -> dict:
        """解析新浪接口返回的 JavaScript 变量格式

        格式: var hq_str_sh600519="贵州茅台,1745.00,1730.00,...";
        字段顺序: 名称,今开,昨收,当前价,最高,最低,竞买价,竞卖价,
                 成交量,成交金额,买1-5量/价,卖1-5量/价,日期,时间
        """
        data = []
        expected_clean = {self._from_sina_code(c): True for c in expected_codes}

        for line in text.strip().split(";"):
            line = line.strip()
            if not line.startswith("var hq_str_"):
                continue
            try:
                # 提取代码和值
                prefix = "var hq_str_"
                rest = line[len(prefix):]
                if "=\"" not in rest:
                    continue
                sina_code, value = rest.split("=\"", 1)
                value = value.rstrip("\"")
                if not value:
                    continue

                clean_code = self._from_sina_code(sina_code)
                if clean_code not in expected_clean:
                    continue

                parts = value.split(",")
                if len(parts) < 3:
                    continue

                name = parts[0] if len(parts) > 0 else ""
                open_price = float(parts[1]) if len(parts) > 1 and parts[1] else 0
                prev_close = float(parts[2]) if len(parts) > 2 and parts[2] else 0
                price = float(parts[3]) if len(parts) > 3 and parts[3] else 0
                high = float(parts[4]) if len(parts) > 4 and parts[4] else 0
                low = float(parts[5]) if len(parts) > 5 and parts[5] else 0
                volume = float(parts[8]) if len(parts) > 8 and parts[8] else 0

                change_pct = 0
                if prev_close > 0 and price > 0:
                    change_pct = round((price - prev_close) / prev_close * 100, 2)

                data.append({
                    "code": clean_code,
                    "name": name,
                    "price": price,
                    "change_pct": change_pct,
                    "volume": volume,
                    "turnover": 0,
                    "open": open_price,
                    "high": high,
                    "low": low,
                    "prev_close": prev_close,
                })
            except (ValueError, IndexError) as e:
                logger.debug(f"[Sina] parse line failed: {e}, line: {line[:80]}")
                continue

        if not data:
            return {"success": False, "error": "解析结果为空"}
        return {"success": True, "data": data}

    # ── 指数行情 ──

    def get_index_daily(self, idx_code: str) -> dict:
        return {"success": False, "error": "新浪接口不支持指数日线历史数据"}

    def get_market_index(self) -> dict:
        """通过新浪接口获取三大指数实时行情"""
        try:
            indices = [
                ("sh000001", "上证指数"),
                ("sz399001", "深证成指"),
                ("sz399006", "创业板指"),
            ]
            sina_codes = [self._to_sina_code(c) for c, _ in indices]
            url = f"http://hq.sinajs.cn/list={','.join(sina_codes)}"
            headers = {
                "Referer": "https://finance.sina.com.cn",
                "User-Agent": "Mozilla/5.0",
            }
            r = requests.get(url, headers=headers, timeout=10)
            result = self._parse_sina_response(r.text, sina_codes)
            if not result["success"]:
                return result

            data = []
            for item in result["data"]:
                data.append({
                    "name": item.get("name", ""),
                    "code": item.get("code", ""),
                    "close": item.get("price", 0),
                    "change_pct": item.get("change_pct", 0),
                    "volume": item.get("volume", 0),
                })
            return {"success": True, "data": data}
        except Exception as e:
            logger.warning(f"[Sina] get_market_index failed: {e}")
            return {"success": False, "error": str(e)}

    # ── 其他接口（不支持） ──

    def get_hot_sectors(self, top_n: int = 10) -> dict:
        return {"success": False, "error": "新浪接口不支持板块数据"}

    def get_hsgt_flow(self) -> dict:
        return {"success": False, "error": "新浪接口不支持沪深港通数据"}

    def get_limit_up_pool(self, target_date: date) -> dict:
        return {"success": False, "error": "新浪接口不支持涨停池数据"}

    def get_trade_calendar(self) -> dict:
        return {"success": False, "error": "新浪接口不支持交易日历"}

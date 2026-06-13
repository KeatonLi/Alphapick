"""腾讯证券 Provider — 备用实时行情源

特点：
- 更新频率约 3 秒，响应极快
- 支持 A 股/港股批量查询（每批最多 100 个）
- 返回格式为文本，需解析
- 适合作为 AKShare 实时行情的备用源
"""

import logging
from datetime import date
from typing import Optional

from app.datasource.http_client import datasource_session
from app.datasource.providers.base import DataProvider

logger = logging.getLogger(__name__)


class TencentProvider(DataProvider):
    """腾讯证券数据源 Provider（备用）"""

    name = "tencent"
    priority = 2  # 优先级次于 AKShare

    _HEADERS = {
        "Referer": "https://finance.qq.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    # ── 代码格式转换 ──

    @staticmethod
    def _to_tencent_code(code: str) -> str:
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

    @staticmethod
    def _from_tencent_code(code: str) -> str:
        for prefix in ("sh", "sz", "bj"):
            if code.startswith(prefix):
                return code[len(prefix):]
        return code

    # ── 个股行情 ──

    def get_stock_info(self, code: str) -> dict:
        """腾讯接口没有单独的股票信息接口，用实时行情代替"""
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
                "昨收": "",
                "今开": "",
                "最高": "",
                "最低": "",
                "成交量": str(item.get("volume", "")),
                "成交额": str(item.get("turnover", "")),
            }
        }

    def get_stock_daily(self, code: str, days: int = 60, adjust: str = "qfq") -> dict:
        """腾讯接口不提供历史日线数据，返回不支持"""
        return {"success": False, "error": "腾讯接口不支持历史日线数据"}

    def get_stock_spot(self, code: Optional[str] = None) -> dict:
        """获取实时行情快照"""
        try:
            if code:
                tcode = self._to_tencent_code(code)
                url = f"https://qt.gtimg.cn/q={tcode}"
                r = datasource_session.get(url, headers=self._HEADERS, timeout=10)
                r.raise_for_status()
                return self._parse_tencent_response(r.text, [code])
            else:
                # 全市场：需要先从 EastMoney 获取列表（与 StockFetcher 逻辑一致）
                all_codes = self._fetch_stock_list_from_eastmoney()
                if not all_codes:
                    return {"success": False, "error": "无法获取股票列表"}
                return self._fetch_tencent_quotes(all_codes)
        except Exception as e:
            logger.warning(f"[Tencent] get_stock_spot({code}) failed: {e}")
            return {"success": False, "error": str(e)}

    def _fetch_stock_list_from_eastmoney(self) -> list:
        """从 EastMoney 获取全 A 股代码列表"""
        all_codes = []
        page = 1
        headers = {
            "Referer": "https://data.eastmoney.com",
            "User-Agent": "Mozilla/5.0",
        }
        while True:
            url = (
                "https://datacenter.eastmoney.com/api/data/v1/get"
                "?reportName=RPT_F10_ORG_BASICINFO"
                "&columns=SECURITY_CODE,SECURITY_NAME_ABBR"
                "&pageSize=500"
                f"&pageNumber={page}"
                "&source=HSF10&client=PC"
            )
            try:
                r = datasource_session.get(url, headers=headers, timeout=15)
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
            except Exception as e:
                logger.warning(f"[Tencent] EastMoney list fetch failed: {e}")
                break
        return all_codes

    def _fetch_tencent_quotes(self, all_codes: list) -> dict:
        """批量获取腾讯行情"""
        quotes = []
        batch_size = 100
        for i in range(0, len(all_codes), batch_size):
            batch = all_codes[i:i + batch_size]
            tencent_codes = [self._to_tencent_code(c["code"]) for c in batch]
            qt_url = f"https://qt.gtimg.cn/q={','.join(tencent_codes)}"
            try:
                r = datasource_session.get(qt_url, headers=self._HEADERS, timeout=10)
                result = self._parse_tencent_response(r.text, [c["code"] for c in batch])
                if result["success"]:
                    quotes.extend(result["data"])
            except Exception as e:
                logger.warning(f"[Tencent] batch fetch failed: {e}")
                continue
        if not quotes:
            return {"success": False, "error": "行情数据获取失败"}
        return {"success": True, "data": quotes}

    def _parse_tencent_response(self, text: str, expected_codes: list) -> dict:
        """解析腾讯接口返回的文本"""
        data = []
        lines = text.strip().split("\n")
        code_map = {c: True for c in expected_codes}

        for line in lines:
            if "~\"" not in line and "~" not in line:
                continue
            try:
                # 格式: v_sh600000="1~浦发银行~600000~7.63~..."
                if "=\"" in line:
                    content = line.split("=\"")[1].rstrip("\";")
                elif "=" in line:
                    content = line.split("=")[1].strip().strip('"').strip(";")
                else:
                    continue

                parts = content.split("~")
                if len(parts) < 35:
                    continue

                raw_code = parts[2] if len(parts) > 2 else ""
                clean_code = self._from_tencent_code(raw_code)
                if clean_code not in code_map:
                    continue

                price_str = parts[3] if len(parts) > 3 else "0"
                price = float(price_str) if price_str not in ("", "0") else 0
                if price <= 0:
                    continue

                change_str = parts[32] if len(parts) > 32 else "0"
                change_pct = float(change_str) if change_str not in ("",) else 0
                vol_str = parts[6] if len(parts) > 6 else "0"
                volume = float(vol_str) if vol_str not in ("",) else 0
                turnover_str = parts[38] if len(parts) > 38 else "0"
                try:
                    turnover = float(turnover_str) if turnover_str not in ("", "None") else 0
                except ValueError:
                    turnover = 0

                data.append({
                    "code": clean_code,
                    "name": parts[1] if len(parts) > 1 else "",
                    "price": price,
                    "change_pct": change_pct,
                    "volume": volume,
                    "turnover": turnover,
                })
            except (ValueError, IndexError) as e:
                logger.debug(f"[Tencent] parse line failed: {e}, line: {line[:80]}")
                continue

        if not data:
            return {"success": False, "error": "解析结果为空"}
        return {"success": True, "data": data}

    # ── 指数行情 ──

    def get_index_daily(self, idx_code: str) -> dict:
        """腾讯接口不提供指数日线历史数据"""
        return {"success": False, "error": "腾讯接口不支持指数日线历史数据"}

    def get_market_index(self) -> dict:
        """通过腾讯接口获取三大指数实时行情"""
        try:
            indices = [
                ("sh000001", "上证指数"),
                ("sz399001", "深证成指"),
                ("sz399006", "创业板指"),
            ]
            tencent_codes = [self._to_tencent_code(c) for c, _ in indices]
            url = f"https://qt.gtimg.cn/q={','.join(tencent_codes)}"
            r = datasource_session.get(url, headers=self._HEADERS, timeout=10)
            result = self._parse_tencent_response(r.text, [c for c, _ in indices])
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
            logger.warning(f"[Tencent] get_market_index failed: {e}")
            return {"success": False, "error": str(e)}

    # ── 板块行情 ──

    def get_hot_sectors(self, top_n: int = 10) -> dict:
        """腾讯接口不提供板块数据"""
        return {"success": False, "error": "腾讯接口不支持板块数据"}

    # ── 资金流向 ──

    def get_hsgt_flow(self) -> dict:
        """腾讯接口不提供沪深港通数据"""
        return {"success": False, "error": "腾讯接口不支持沪深港通数据"}

    # ── 涨停池 ──

    def get_limit_up_pool(self, target_date: date) -> dict:
        """腾讯接口不提供涨停池数据"""
        return {"success": False, "error": "腾讯接口不支持涨停池数据"}

    # ── 交易日历 ──

    def get_trade_calendar(self) -> dict:
        """腾讯接口不提供交易日历"""
        return {"success": False, "error": "腾讯接口不支持交易日历"}

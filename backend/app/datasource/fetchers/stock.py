"""全市场行情采集器 — EastMoney 股票列表 + 腾讯批量行情（多源互备版）"""

from datetime import date
from app.datasource.fetchers.base import DataFetcher
from app.datasource.http_client import datasource_session
from app.datasource.multi_source import multi_source
from app.utils.akshare_utils import _to_tencent_code, _from_tencent_code


class StockFetcher(DataFetcher):
    """采集全 A 股列表和实时行情快照

    优先使用 MultiSourceManager（AKShare → 腾讯 → 新浪），
    全部失败时 fallback 到原生的 EastMoney + 腾讯组合。
    """

    source_name = "multi_source"
    data_type = "stock_spot"
    max_retries = 2

    def fetch(self, target_date: date) -> dict:
        # Step 1: 优先尝试多源管理器获取全市场实时行情
        ms_result = multi_source.get_stock_spot()
        if ms_result["success"] and ms_result["data"]:
            quotes = ms_result["data"]
            # 构建股票列表（从行情数据中反推）
            stock_list = [{"code": q["code"], "name": q.get("name", "")} for q in quotes]
            return {
                "total_stocks": len(stock_list),
                "quotes_count": len(quotes),
                "stock_list": stock_list,
                "quotes": quotes,
                "_source": ms_result.get("_source", "unknown"),
            }

        # Step 2: 多源全部失败，fallback 到原生 EastMoney + 腾讯
        return self._fetch_fallback(target_date)

    def _fetch_fallback(self, target_date: date) -> dict:
        """原生 EastMoney 列表 + 腾讯行情（最终 fallback）"""
        all_codes = self._fetch_stock_list()
        if not all_codes:
            return {}

        quotes = self._fetch_tencent_quotes(all_codes)

        return {
            "total_stocks": len(all_codes),
            "quotes_count": len(quotes),
            "stock_list": all_codes,
            "quotes": quotes,
            "_source": "eastmoney+tencent(fallback)",
        }

    def _fetch_stock_list(self) -> list:
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
        return all_codes

    def _fetch_tencent_quotes(self, all_codes: list) -> list:
        """从腾讯接口批量获取实时行情"""
        quotes = []
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
                r = datasource_session.get(qt_url, headers=headers, timeout=10)
                lines = r.text.strip().split("\n")
                for line in lines:
                    if "~\"" in line:
                        quotes.append(line.strip())
            except Exception:
                continue
        return quotes

    def request_params(self, target_date: date) -> dict:
        return {"target_date": str(target_date)}

"""指数日线采集器 — 上证/深证/创业板（多源互备版）"""

from datetime import date

from app.datasource.fetchers.base import DataFetcher
from app.datasource.multi_source import multi_source


class IndexFetcher(DataFetcher):
    source_name = "multi_source"
    data_type = "index_daily"

    INDICES = [
        ("sh000001", "上证指数"),
        ("sz399001", "深证成指"),
        ("sz399006", "创业板指"),
    ]

    def fetch(self, target_date: date) -> dict:
        result = {}
        for code, name in self.INDICES:
            try:
                ms_result = multi_source.get_index_daily(code)
                if ms_result["success"] and ms_result["data"]:
                    result[code] = {
                        "name": name,
                        "data": ms_result["data"],
                        "_source": ms_result.get("_source", "unknown"),
                    }
            except Exception:
                pass
        return result

    def request_params(self, target_date: date) -> dict:
        return {"indices": [c for c, _ in self.INDICES]}

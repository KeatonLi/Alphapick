"""北向资金采集器 — 沪深港通资金流（多源互备版）"""

from datetime import date

from app.datasource.fetchers.base import DataFetcher
from app.datasource.multi_source import multi_source


class HSGTFetcher(DataFetcher):
    source_name = "multi_source"
    data_type = "hsgt_flow"

    def fetch(self, target_date: date) -> dict:
        result = multi_source.get_hsgt_flow()
        if not result["success"]:
            return {}
        data = result["data"]
        return {
            "today": data.get("today", {}),
            "history": data.get("history", []),
            "_source": result.get("_source", "unknown"),
        }

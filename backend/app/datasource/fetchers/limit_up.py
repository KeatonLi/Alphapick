"""涨停池采集器（多源互备版）"""

from datetime import date

from app.datasource.fetchers.base import DataFetcher
from app.datasource.multi_source import multi_source


class LimitUpFetcher(DataFetcher):
    source_name = "multi_source"
    data_type = "limit_up_pool"

    def fetch(self, target_date: date) -> dict:
        result = multi_source.get_limit_up_pool(target_date)
        if not result["success"]:
            return {}
        return {
            "columns": [],
            "row_count": len(result["data"]),
            "data": result["data"],
            "_source": result.get("_source", "unknown"),
        }

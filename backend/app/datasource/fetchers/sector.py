"""板块行业摘要采集器 — THS 行业板块（多源互备版）"""

from datetime import date

from app.datasource.fetchers.base import DataFetcher
from app.datasource.multi_source import multi_source


class SectorFetcher(DataFetcher):
    source_name = "multi_source"
    data_type = "sector_summary"

    def fetch(self, target_date: date) -> dict:
        result = multi_source.get_hot_sectors(top_n=200)
        if not result["success"]:
            return {}
        data = result["data"]
        return {
            "columns": ["板块", "涨跌幅", "领涨股", "driver"],
            "row_count": len(data),
            "data": data,
            "_source": result.get("_source", "unknown"),
        }

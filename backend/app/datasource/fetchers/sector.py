"""板块行业摘要采集器 — THS 行业板块"""

from datetime import date
import akshare as ak

from app.datasource.fetchers.base import DataFetcher


class SectorFetcher(DataFetcher):
    source_name = "akshare"
    data_type = "sector_summary"

    def fetch(self, target_date: date) -> dict:
        df = ak.stock_board_industry_summary_ths()
        if df is None or df.empty:
            return {}
        return {
            "columns": list(df.columns),
            "row_count": len(df),
            "data": df.to_dict(orient="records"),
        }

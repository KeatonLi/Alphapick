"""涨停池采集器"""

from datetime import date
import akshare as ak

from app.datasource.fetchers.base import DataFetcher


class LimitUpFetcher(DataFetcher):
    source_name = "akshare"
    data_type = "limit_up_pool"

    def fetch(self, target_date: date) -> dict:
        df = ak.stock_zt_pool_em(date=target_date.strftime("%Y%m%d"))
        if df is None or df.empty:
            return {}
        return {
            "columns": list(df.columns),
            "row_count": len(df),
            "data": df.to_dict(orient="records"),
        }

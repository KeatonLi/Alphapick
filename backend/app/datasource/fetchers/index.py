"""指数日线采集器 — 上证/深证/创业板"""

from datetime import date
import akshare as ak

from app.datasource.fetchers.base import DataFetcher


class IndexFetcher(DataFetcher):
    source_name = "akshare"
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
                df = ak.stock_zh_index_daily(symbol=code)
                if df is not None and len(df) > 0:
                    result[code] = {
                        "name": name,
                        "data": df.to_dict(orient="records"),
                    }
            except Exception:
                pass
        return result

    def request_params(self, target_date: date) -> dict:
        return {"indices": [c for c, _ in self.INDICES]}

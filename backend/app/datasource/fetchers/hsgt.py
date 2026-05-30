"""北向资金采集器 — 沪深港通资金流"""

from datetime import date
import akshare as ak

from app.datasource.fetchers.base import DataFetcher


class HSGTFetcher(DataFetcher):
    source_name = "akshare"
    data_type = "hsgt_flow"

    def fetch(self, target_date: date) -> dict:
        result = {}
        for symbol in ["沪股通", "深股通"]:
            try:
                df = ak.stock_hsgt_hist_em(symbol=symbol)
                if df is not None and not df.empty:
                    result[symbol] = df.to_dict(orient="records")
            except Exception:
                pass
        return result

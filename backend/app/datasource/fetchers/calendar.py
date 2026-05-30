"""交易日历采集器"""

from datetime import date
import akshare as ak
import pandas as pd

from app.datasource.fetchers.base import DataFetcher


class CalendarFetcher(DataFetcher):
    source_name = "akshare"
    data_type = "trade_calendar"

    def fetch(self, target_date: date) -> dict:
        df = ak.tool_trade_date_hist_sina()
        if df is None or df.empty:
            return {}
        date_col = df.columns[0]
        df[date_col] = pd.to_datetime(df[date_col])
        return {
            "date_column": date_col,
            "total_dates": len(df),
            "first_date": str(df[date_col].min().date()),
            "last_date": str(df[date_col].max().date()),
            "data": df[date_col].dt.strftime("%Y-%m-%d").tolist(),
        }

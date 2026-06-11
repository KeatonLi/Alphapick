"""交易日历采集器（多源互备版）"""

from datetime import date

from app.datasource.fetchers.base import DataFetcher
from app.datasource.multi_source import multi_source


class CalendarFetcher(DataFetcher):
    source_name = "multi_source"
    data_type = "trade_calendar"

    def fetch(self, target_date: date) -> dict:
        result = multi_source.get_trade_calendar()
        if not result["success"]:
            return {}
        dates = result["data"]
        return {
            "date_column": "trade_date",
            "total_dates": len(dates),
            "first_date": dates[0] if dates else "",
            "last_date": dates[-1] if dates else "",
            "data": dates,
            "_source": result.get("_source", "unknown"),
        }

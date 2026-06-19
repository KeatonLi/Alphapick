import asyncio
import json
import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class SQLiteQuantFlowTests(unittest.TestCase):
    def _make_db(self):
        from app.database import Base

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        return Session()

    def _seed_trade_calendar(self, db, dates):
        from app.datasource.models import RawDataRecord

        db.add(RawDataRecord(
            source_name="test",
            data_type="trade_calendar",
            target_date=dates[0],
            raw_json=json.dumps({"data": [d.isoformat() for d in dates]}),
        ))
        db.commit()

    def _seed_snapshot(self, db, trade_date, prices):
        from app.datasource.models import StockSpotSnapshot

        names = {
            "000001": "Alpha Bank",
            "000002": "Beta Estate",
            "600001": "Gamma Steel",
        }
        for idx, (code, close) in enumerate(prices.items(), start=1):
            db.add(StockSpotSnapshot(
                trade_date=trade_date,
                stock_code=code,
                stock_name=names[code],
                open=close - 0.1,
                high=close + 0.2,
                low=close - 0.3,
                close=close,
                prev_close=close - 0.2,
                change_pct=5 - idx,
                turnover_rate=4 + idx,
                volume=1_000_000 * idx,
                source_name="sqlite_flow_test",
            ))
        db.commit()

    def test_recommendations_track_day_three_returns_in_sqlite(self):
        from app.models import Recommendation
        from app.services.recommend_service import generate_recommendations, update_recommend_prices

        trade_days = [
            date(2026, 6, 12),
            date(2026, 6, 15),
            date(2026, 6, 16),
            date(2026, 6, 17),
            date(2026, 6, 18),
        ]
        db = self._make_db()
        try:
            self._seed_trade_calendar(db, trade_days)
            self._seed_snapshot(db, trade_days[0], {
                "000001": 10.0,
                "000002": 20.0,
                "600001": 30.0,
            })

            generated = asyncio.run(generate_recommendations(db, trade_days[0]))

            self.assertTrue(generated["success"])
            self.assertEqual(generated["data"]["count"], 3)

            self._seed_snapshot(db, trade_days[1], {
                "000001": 10.5,
                "000002": 19.5,
                "600001": 31.5,
            })
            day1 = asyncio.run(update_recommend_prices(db, as_of=trade_days[1]))
            self.assertEqual(day1["data"]["updated"], 3)

            self._seed_snapshot(db, trade_days[2], {
                "000001": 11.0,
                "000002": 20.5,
                "600001": 33.0,
            })
            day2 = asyncio.run(update_recommend_prices(db, as_of=trade_days[2]))
            self.assertEqual(day2["data"]["updated"], 3)

            self._seed_snapshot(db, trade_days[3], {
                "000001": 11.5,
                "000002": 21.0,
                "600001": 34.5,
            })
            day3 = asyncio.run(update_recommend_prices(db, as_of=trade_days[3]))
            self.assertEqual(day3["data"]["updated"], 3)

            recs = db.query(Recommendation).order_by(Recommendation.stock_code.asc()).all()
            self.assertEqual(len(recs), 3)
            for rec in recs:
                self.assertIsNotNone(rec.price_day1)
                self.assertIsNotNone(rec.return_rate_day1)
                self.assertIsNotNone(rec.price_day2)
                self.assertIsNotNone(rec.return_rate_day2)
                self.assertIsNotNone(rec.price_day3)
                self.assertIsNotNone(rec.return_rate_day3)
                self.assertEqual(rec.tracking_days, 3)
                self.assertEqual(rec.status, "tracking")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

import json
import unittest
from datetime import date
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class DashboardServiceTests(unittest.TestCase):
    def _make_db(self):
        from app.database import Base

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        return Session()

    def test_dashboard_summarizes_picks_tracking_and_strategy(self):
        from app.datasource.models import DataFetchLog, DataQualityCheck, RawDataRecord, StockSpotSnapshot
        from app.models import Recommendation
        from app.services.dashboard_service import build_dashboard

        db = self._make_db()
        try:
            db.add(RawDataRecord(
                source_name="test",
                data_type="trade_calendar",
                target_date=date(2026, 6, 18),
                raw_json=json.dumps({"data": ["2026-06-16", "2026-06-17", "2026-06-18"]}),
            ))
            db.add(DataFetchLog(source_name="test", data_type="stock_spot", target_date=date(2026, 6, 18), status="success"))
            db.add(DataQualityCheck(trade_date=date(2026, 6, 18), data_type="stock_spot_snapshot", status="success", actual_count=5000))
            db.add(StockSpotSnapshot(trade_date=date(2026, 6, 18), stock_code="000001", stock_name="Alpha", close=10, source_name="test"))
            for idx, code in enumerate(["000001", "000002", "600001"], start=1):
                db.add(Recommendation(
                    recommend_date=date(2026, 6, 18),
                    stock_code=code,
                    stock_name=f"Stock {idx}",
                    recommend_price=10 * idx,
                    rec_rank=idx,
                    score=90 - idx,
                    reason="momentum and liquidity",
                    strategy_version="test-v1",
                    factor_snapshot=json.dumps({"momentum": 80, "trend": 60}),
                ))
            db.add(Recommendation(
                recommend_date=date(2026, 6, 16),
                stock_code="000777",
                stock_name="Winner",
                recommend_price=10,
                rec_rank=1,
                score=88,
                status="tracking",
                tracking_days=2,
                price_day1=10.4,
                price_day2=10.8,
                return_rate_day1=0.04,
                return_rate_day2=0.08,
                return_rate=0.08,
                current_price=10.8,
            ))
            db.commit()

            result = build_dashboard(db, today=date(2026, 6, 18))

            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["trade_date"], "2026-06-18")
            self.assertTrue(result["data"]["is_trade_day"])
            self.assertEqual(result["data"]["pipeline"]["data_status"], "success")
            self.assertEqual(result["data"]["pipeline"]["recommend_status"], "success")
            self.assertEqual(len(result["data"]["today_picks"]), 3)
            self.assertEqual(result["data"]["today_picks"][0]["stock_code"], "000001")
            self.assertEqual(result["data"]["tracking_batches"][0]["date"], "2026-06-18")
            self.assertEqual(result["data"]["tracking_batches"][1]["date"], "2026-06-16")
            self.assertIn("verdict", result["data"]["strategy_review"])
        finally:
            db.close()

class DashboardCacheTests(unittest.IsolatedAsyncioTestCase):
    def _make_db(self):
        from app.database import Base

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        return Session()

    async def test_dashboard_async_reuses_short_lived_payload(self):
        from app.datasource.models import RawDataRecord
        from app.models import Recommendation
        from app.services import dashboard_service

        dashboard_service.clear_dashboard_cache()
        db = self._make_db()
        calls = 0

        async def fake_stats(_db):
            nonlocal calls
            calls += 1
            return {
                "success": True,
                "data": {
                    "avg_return_day3": 1.2,
                    "win_rate_day3": 60,
                },
            }

        try:
            db.add(RawDataRecord(
                source_name="test",
                data_type="trade_calendar",
                target_date=date(2026, 6, 18),
                raw_json=json.dumps({"data": ["2026-06-18"]}),
            ))
            db.add(Recommendation(
                recommend_date=date(2026, 6, 18),
                stock_code="000001",
                stock_name="Alpha",
                recommend_price=10,
                rec_rank=1,
                score=90,
            ))
            db.commit()

            with patch.object(dashboard_service, "get_recommend_stats", side_effect=fake_stats):
                first = await dashboard_service.build_dashboard_async(db, today=date(2026, 6, 18))
                second = await dashboard_service.build_dashboard_async(db, today=date(2026, 6, 18))

            self.assertTrue(first["success"])
            self.assertEqual(second["data"]["today_picks"][0]["stock_code"], "000001")
            self.assertEqual(calls, 1)
        finally:
            db.close()
            dashboard_service.clear_dashboard_cache()


if __name__ == "__main__":
    unittest.main()

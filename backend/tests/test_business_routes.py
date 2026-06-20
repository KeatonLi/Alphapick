import unittest
from datetime import date


class BusinessRouteRegistrationTests(unittest.TestCase):
    def test_product_architecture_routes_are_registered(self):
        from app.main import app

        routes = {getattr(route, "path", "") for route in app.routes}

        required = {
            "/api/picks/daily",
            "/api/dashboard",
            "/api/auth/guest",
            "/api/picks/latest",
            "/api/picks/dates",
            "/api/picks/trade-dates",
            "/api/review/history",
            "/api/review/summary",
            "/api/review/update-prices",
            "/api/review/batch/delete",
            "/api/review/batch/reset",
            "/api/analytics/overview",
            "/api/analytics/holding-period",
            "/api/analytics/risk",
            "/api/data/status",
            "/api/data/quality",
            "/api/data/fetch-all",
            "/api/ops/run-daily",
            "/api/ops/backtest",
            "/api/ops/schedule",
        }

        self.assertEqual(required - routes, set())


class OpsFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_run_daily_stops_when_fetch_fails(self):
        from app.routers import ops

        original_trigger_all = ops.trigger_all
        original_start_all = ops.start_all
        generated = False

        def fake_trigger_all(target, db):
            return {"success": True, "data": {"success": 1, "failed": 1, "total": 2}}

        async def fake_start_all(target, db, admin):
            nonlocal generated
            generated = True
            return {"success": True, "data": {"task_id": 1}}

        try:
            ops.trigger_all = fake_trigger_all
            ops.start_all = fake_start_all

            result = await ops.ops_run_daily(date(2026, 5, 8), db=object(), admin=object())

            self.assertFalse(result["success"])
            self.assertFalse(generated)
            self.assertEqual(result["error"], "data fetch failed")
        finally:
            ops.trigger_all = original_trigger_all
            ops.start_all = original_start_all

    async def test_backtest_skips_generation_for_failed_fetch_days(self):
        from app.routers import ops

        original_trigger_all = ops.trigger_all
        original_generate = ops.generate_recommendations
        original_update = ops.update_recommend_prices
        generated_dates = []

        def fake_trigger_all(target, db):
            if target == date(2026, 5, 8):
                return {"success": True, "data": {"success": 1, "failed": 1, "total": 2}}
            return {"success": True, "data": {"success": 2, "failed": 0, "total": 2}}

        async def fake_generate(db, target):
            generated_dates.append(target)
            return {"success": True, "data": {"count": 5}, "message": "ok"}

        async def fake_update(db):
            return {"success": True, "data": {"updated": 0}}

        try:
            ops.trigger_all = fake_trigger_all
            ops.generate_recommendations = fake_generate
            ops.update_recommend_prices = fake_update

            result = await ops.ops_backtest(date(2026, 5, 8), date(2026, 5, 11), db=object())

            self.assertTrue(result["success"])
            self.assertEqual(generated_dates, [date(2026, 5, 11)])
            self.assertFalse(result["data"]["results"][0]["recommend_success"])
            self.assertEqual(result["data"]["results"][0]["recommend_message"], "skipped: data fetch failed")
        finally:
            ops.trigger_all = original_trigger_all
            ops.generate_recommendations = original_generate
            ops.update_recommend_prices = original_update


if __name__ == "__main__":
    unittest.main()

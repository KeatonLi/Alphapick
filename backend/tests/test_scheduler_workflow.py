import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import patch


class SchedulerWorkflowTests(unittest.TestCase):
    def test_configured_workflow_runs_report_recommend_and_returns(self):
        from app.datasource import scheduler

        calls = []
        config = SimpleNamespace(
            run_report=True,
            run_recommend=True,
            run_update_returns=True,
        )

        async def fake_report(db, report_date):
            calls.append(("report", report_date))
            return {"success": True}

        async def fake_recommend(db, rec_date):
            calls.append(("recommend", rec_date))
            return {"success": True}

        async def fake_returns(db):
            calls.append(("returns", None))
            return {"success": True}

        with (
            patch.object(scheduler, "generate_daily_report", side_effect=fake_report),
            patch.object(scheduler, "generate_recommendations", side_effect=fake_recommend),
            patch.object(scheduler, "update_recommend_prices", side_effect=fake_returns),
        ):
            results = scheduler.run_configured_workflow(object(), config, date(2026, 6, 18))

        self.assertEqual(
            calls,
            [
                ("report", date(2026, 6, 18)),
                ("recommend", date(2026, 6, 18)),
                ("returns", None),
            ],
        )
        self.assertEqual(results, ["report=success", "recommend=success", "returns=success"])

    def test_daily_fetch_skips_non_trading_day_before_fetching(self):
        from app.datasource import scheduler

        class FakeQuery:
            def __init__(self, config):
                self.config = config

            def first(self):
                return self.config

        class FakeDb:
            def __init__(self, config):
                self.config = config
                self.commit_count = 0
                self.closed = False

            def query(self, _model):
                return FakeQuery(self.config)

            def commit(self):
                self.commit_count += 1

            def close(self):
                self.closed = True

        class FakeDate:
            @classmethod
            def today(cls):
                return date(2026, 6, 19)

        class FakeDatetime:
            @classmethod
            def now(cls):
                return datetime(2026, 6, 19, 16, 10, 0)

        class FailingFetcher:
            def run(self, _db, _target):
                raise AssertionError("fetcher should not run on non-trading day")

        config = SimpleNamespace(
            enabled=True,
            run_time="16:10",
            last_run_at=None,
            last_run_result=None,
        )
        db = FakeDb(config)

        with (
            patch.object(scheduler, "SessionLocal", return_value=db),
            patch.object(scheduler, "date", FakeDate),
            patch.object(scheduler, "datetime", FakeDatetime),
            patch.object(scheduler, "FETCHERS", [("stock_spot", FailingFetcher())]),
            patch.object(scheduler, "read_is_trade_date", return_value=False),
            patch.object(scheduler, "run_configured_workflow", side_effect=AssertionError("workflow should not run on non-trading day")),
        ):
            scheduler.run_daily_fetch()

        self.assertEqual(config.last_run_at, "2026-06-19 16:10:00")
        self.assertEqual(config.last_run_result, "skipped: non-trading day 2026-06-19")
        self.assertEqual(db.commit_count, 1)
        self.assertTrue(db.closed)


if __name__ == "__main__":
    unittest.main()

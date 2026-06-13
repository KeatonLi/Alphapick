import unittest


class StrategyServiceTests(unittest.TestCase):
    def test_db_snapshot_candidate_gets_high_source_quality_and_readable_reason(self):
        from app.services.strategy_service import score_candidate

        scored = score_candidate({
            "code": "000001",
            "name": "Ping An Bank",
            "price": 10.5,
            "change_pct": 3.2,
            "turnover": 4.1,
            "continuous_days": 1,
            "sector": "Banking",
            "source": "db_snapshot",
        })

        self.assertIsNotNone(scored)
        self.assertGreaterEqual(scored["factor_snapshot"]["source_quality"], 90)
        self.assertIn("Momentum", scored["reason"])
        self.assertIn("Score", scored["reason"])

    def test_volume_improves_liquidity_when_turnover_is_missing(self):
        from app.services.strategy_service import score_candidate

        low_volume = score_candidate({
            "code": "000001",
            "name": "Low Volume",
            "price": 10,
            "change_pct": 4,
            "turnover": 0,
            "volume": 100_000,
            "source": "db_snapshot",
        })
        high_volume = score_candidate({
            "code": "000002",
            "name": "High Volume",
            "price": 10,
            "change_pct": 4,
            "turnover": 0,
            "volume": 5_000_000,
            "source": "db_snapshot",
        })

        self.assertGreater(high_volume["factor_snapshot"]["liquidity"], low_volume["factor_snapshot"]["liquidity"])
        self.assertGreater(high_volume["score"], low_volume["score"])


if __name__ == "__main__":
    unittest.main()

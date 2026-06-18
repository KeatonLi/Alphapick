import unittest
from datetime import date


class MarketWarehouseTests(unittest.TestCase):
    def test_parse_tencent_quote_line_extracts_stable_fields(self):
        from app.datasource.warehouse import parse_tencent_quote_line

        line = (
            'v_sz000001="51~Ping An Bank~000001~10.93~10.66~10.65~1399368~'
            '844000~555368~10.92~1232~10.91~2827~10.90~3482~10.89~2171~'
            '10.88~1479~10.93~12481~10.94~6046~10.95~11971~10.96~9878~'
            '10.97~15224~~20260529161454~0.27~2.53~10.93~10.62~'
            '10.93/1399368/1515692068~1399368~151569~0.72~4.93~~10.93~10.62~'
            '2.91~2121.03~2121.07~0.46~11.73~9.59~1.67~-44409~10.83~";'
        )

        parsed = parse_tencent_quote_line(line, target_date=date(2026, 5, 29))

        self.assertEqual(parsed["stock_code"], "000001")
        self.assertEqual(parsed["stock_name"], "Ping An Bank")
        self.assertEqual(parsed["trade_date"], date(2026, 5, 29))
        self.assertAlmostEqual(parsed["close"], 10.93)
        self.assertAlmostEqual(parsed["prev_close"], 10.66)
        self.assertAlmostEqual(parsed["change_pct"], 2.53)
        self.assertAlmostEqual(parsed["turnover_rate"], 0.72)
        self.assertEqual(parsed["source_name"], "tencent")

    def test_build_candidates_uses_db_snapshots_only(self):
        from app.datasource.warehouse import build_candidates_from_snapshots

        rows = [
            {
                "stock_code": "000001", "stock_name": "Ping An Bank", "close": 10.93,
                "change_pct": 2.53, "turnover_rate": 0.72, "volume": 1399368,
            },
            {
                "stock_code": "300750", "stock_name": "CATL", "close": 280.00,
                "change_pct": 4.00, "turnover_rate": 2.5, "volume": 123,
            },
            {
                "stock_code": "600519", "stock_name": "Kweichow Moutai", "close": 1500.00,
                "change_pct": 1.10, "turnover_rate": 0.4, "volume": 456,
            },
            {
                "stock_code": "002001", "stock_name": "New Hope", "close": 22.20,
                "change_pct": 6.50, "turnover_rate": 5.2, "volume": 789,
            },
        ]

        candidates = build_candidates_from_snapshots(rows, top_n=10)

        self.assertEqual([c["code"] for c in candidates], ["002001", "000001"])
        self.assertEqual(candidates[0]["source"], "db_snapshot")
        self.assertGreater(candidates[0]["turnover"], candidates[1]["turnover"])

    def test_normalize_quote_item_discards_impossible_turnover_values(self):
        from app.datasource.warehouse import normalize_quote_item

        parsed = normalize_quote_item({
            "code": "000001",
            "name": "Ping An Bank",
            "price": 11.24,
            "change_pct": 2.74,
            "volume": 2032355,
            "turnover": 2032355,
        }, target_date=date(2026, 6, 13))

        self.assertEqual(parsed["stock_code"], "000001")
        self.assertIsNone(parsed["turnover_rate"])


if __name__ == "__main__":
    unittest.main()

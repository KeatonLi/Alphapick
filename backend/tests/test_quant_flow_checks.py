import unittest
from datetime import date


class QuantFlowCheckTests(unittest.TestCase):
    def test_candidate_snapshot_quality_requires_enough_rows_and_candidates(self):
        from app.datasource.flow_checks import evaluate_candidate_quality

        result = evaluate_candidate_quality(snapshot_count=4986, candidate_count=50)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["snapshot_count"], 4986)
        self.assertEqual(result["candidate_count"], 50)
        self.assertEqual(result["issues"], [])

    def test_candidate_snapshot_quality_reports_missing_data(self):
        from app.datasource.flow_checks import evaluate_candidate_quality

        result = evaluate_candidate_quality(snapshot_count=0, candidate_count=0)

        self.assertEqual(result["status"], "failed")
        self.assertIn("no normalized stock snapshot", result["issues"])

    def test_tracking_gap_report_identifies_missing_daily_bars(self):
        from app.datasource.flow_checks import evaluate_tracking_gaps

        result = evaluate_tracking_gaps(
            recommend_date=date(2026, 5, 29),
            trade_days=[
                date(2026, 6, 1),
                date(2026, 6, 2),
                date(2026, 6, 3),
                date(2026, 6, 5),
                date(2026, 6, 8),
                date(2026, 6, 9),
                date(2026, 6, 10),
            ],
            available_bar_dates={date(2026, 6, 1), date(2026, 6, 3), date(2026, 6, 10)},
            as_of=date(2026, 6, 10),
        )

        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["missing_dates"], ["2026-06-02", "2026-06-08"])
        self.assertEqual(result["available_dates"], ["2026-06-01", "2026-06-03", "2026-06-10"])

    def test_tracking_gap_report_marks_future_dates_pending(self):
        from app.datasource.flow_checks import evaluate_tracking_gaps

        result = evaluate_tracking_gaps(
            recommend_date=date(2026, 6, 13),
            trade_days=[
                date(2026, 6, 15),
                date(2026, 6, 16),
                date(2026, 6, 17),
            ],
            available_bar_dates=set(),
            as_of=date(2026, 6, 13),
        )

        self.assertEqual(result["status"], "pending")
        self.assertEqual(result["missing_dates"], [])
        self.assertEqual(result["future_dates"], ["2026-06-15", "2026-06-16", "2026-06-17"])


if __name__ == "__main__":
    unittest.main()

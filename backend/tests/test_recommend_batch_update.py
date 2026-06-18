import unittest
from datetime import date
from unittest.mock import patch


class _Rec:
    def __init__(self, rec_id, status="tracking", return_rate_day7=None):
        self.id = rec_id
        self.status = status
        self.return_rate_day7 = return_rate_day7


class _Query:
    def __init__(self, recs):
        self._recs = recs

    def filter(self, *_args, **_kwargs):
        return self

    def all(self):
        return self._recs


class _Db:
    def __init__(self, recs):
        self._recs = recs
        self.commit_count = 0

    def query(self, _model):
        return _Query(self._recs)

    def commit(self):
        self.commit_count += 1


class RecommendBatchUpdateTests(unittest.TestCase):
    def test_batch_update_dedupes_and_reports_errors(self):
        from app.services import recommend_service

        db = _Db([
            _Rec(1),
            _Rec(2, status="completed", return_rate_day7=0.05),
            _Rec(3),
        ])

        def fake_fill(_db, rec, as_of):
            self.assertEqual(as_of, date.today())
            return rec.id

        with patch.object(recommend_service, "_fill_tracking_from_db", side_effect=fake_fill) as fill:
            result = recommend_service.batch_update_tracking_prices(db, [1, 1, 2, 9, 3])

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["updated"], 2)
        self.assertEqual(result["data"]["filled"], 4)
        self.assertEqual(db.commit_count, 1)
        self.assertEqual([call.args[1].id for call in fill.call_args_list], [1, 3])
        self.assertEqual(
            result["data"]["errors"],
            [
                {"id": 2, "error": "record already completed; reset before recalculating"},
                {"id": 9, "error": "record not found"},
            ],
        )


if __name__ == "__main__":
    unittest.main()

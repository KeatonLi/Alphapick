import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker


class RecommendServiceQueryTests(unittest.TestCase):
    def _make_db(self):
        from app.database import Base

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        return Session()

    def test_get_all_recommendations_filters_in_query(self):
        from app.models import Recommendation
        from app.services.recommend_service import clear_recommend_cache, get_all_recommendations

        clear_recommend_cache()

        db = self._make_db()
        try:
            db.add(Recommendation(
                recommend_date=date(2026, 6, 17),
                stock_code="000001",
                stock_name="Old",
                recommend_price=10,
                status="tracking",
            ))
            db.add(Recommendation(
                recommend_date=date(2026, 6, 18),
                stock_code="000002",
                stock_name="Done",
                recommend_price=11,
                status="completed",
                final_return_rate=0.02,
            ))
            db.commit()

            result = get_all_recommendations(
                db,
                start_date=date(2026, 6, 18),
                end_date=date(2026, 6, 18),
                status="completed",
            )

            self.assertTrue(result["success"])
            self.assertEqual([row["stock_code"] for row in result["data"]], ["000002"])
        finally:
            db.close()
            clear_recommend_cache()

    def test_get_all_recommendations_reuses_short_lived_cache(self):
        from app.database import Base
        from app.models import Recommendation
        from app.services.recommend_service import clear_recommend_cache, get_all_recommendations

        clear_recommend_cache()
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        query_count = 0

        def count_selects(_conn, _cursor, statement, _parameters, _context, _executemany):
            nonlocal query_count
            if statement.lstrip().upper().startswith("SELECT"):
                query_count += 1

        event.listen(engine, "before_cursor_execute", count_selects)
        try:
            db.add(Recommendation(
                recommend_date=date(2026, 6, 18),
                stock_code="000001",
                stock_name="Cached",
                recommend_price=10,
                status="tracking",
            ))
            db.commit()

            first = get_all_recommendations(db)
            after_first = query_count
            second = get_all_recommendations(db)

            self.assertEqual(first, second)
            self.assertEqual(after_first, query_count)
        finally:
            event.remove(engine, "before_cursor_execute", count_selects)
            db.close()
            clear_recommend_cache()

    def test_get_all_recommendations_applies_limit(self):
        from app.models import Recommendation
        from app.services.recommend_service import clear_recommend_cache, get_all_recommendations

        clear_recommend_cache()

        db = self._make_db()
        try:
            db.add_all([
                Recommendation(
                    recommend_date=date(2026, 6, 18),
                    stock_code="000001",
                    stock_name="First",
                    recommend_price=10,
                    status="tracking",
                ),
                Recommendation(
                    recommend_date=date(2026, 6, 17),
                    stock_code="000002",
                    stock_name="Second",
                    recommend_price=11,
                    status="tracking",
                ),
            ])
            db.commit()

            result = get_all_recommendations(db, limit=1)

            self.assertEqual(len(result["data"]), 1)
            self.assertEqual(result["data"][0]["stock_code"], "000001")
        finally:
            db.close()
            clear_recommend_cache()


if __name__ == "__main__":
    unittest.main()

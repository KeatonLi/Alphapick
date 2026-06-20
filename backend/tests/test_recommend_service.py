import unittest
from datetime import date

from sqlalchemy import create_engine
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
        from app.services.recommend_service import get_all_recommendations

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


if __name__ == "__main__":
    unittest.main()

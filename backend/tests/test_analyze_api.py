import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import StockAnalysis


def _make_db():
    from app.database import Base
    from app.datasource import models  # noqa: F401
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


class AnalyzeRouteRegistrationTests(unittest.TestCase):
    def test_analyze_routes_are_registered(self):
        from app.main import app
        routes = {getattr(route, "path", "") for route in app.routes}
        required = {
            "/api/analyze",
            "/api/analyze/{analysis_id}",
        }
        self.assertEqual(required - routes, set())


class AnalyzeListTests(unittest.TestCase):
    def test_list_empty(self):
        from app.routers.analyze import analyze_list
        db = _make_db()
        try:
            result = analyze_list(db=db, limit=10)
            self.assertTrue(result["success"])
            self.assertEqual(result["data"], [])
        finally:
            db.close()

    def test_list_returns_records_desc(self):
        from app.routers.analyze import analyze_list
        db = _make_db()
        try:
            db.add_all([
                StockAnalysis(stock_code="000001", stock_name="平安银行", decision="buy", confidence=80, summary="a"),
                StockAnalysis(stock_code="000002", stock_name="万科A", decision="hold", confidence=50, summary="b"),
            ])
            db.commit()
            result = analyze_list(db=db, limit=10)
            self.assertEqual(len(result["data"]), 2)
        finally:
            db.close()

    def test_list_limit(self):
        from app.routers.analyze import analyze_list
        db = _make_db()
        try:
            db.add_all([
                StockAnalysis(stock_code="000001", stock_name="A", decision="buy", confidence=80, summary="a"),
                StockAnalysis(stock_code="000002", stock_name="B", decision="hold", confidence=50, summary="b"),
            ])
            db.commit()
            result = analyze_list(db=db, limit=1)
            self.assertEqual(len(result["data"]), 1)
        finally:
            db.close()


class AnalyzeDetailTests(unittest.TestCase):
    def test_detail_returns_full_report(self):
        from app.routers.analyze import analyze_detail
        db = _make_db()
        try:
            row = StockAnalysis(
                stock_code="600519", stock_name="贵州茅台", decision="buy", confidence=80,
                summary="值得买入", technicals='{"ma": {"ma5": 1}}',
                factors='{"score": 70}', valuation='{"pe": 28}',
                reasons='["趋势向上"]', data_asof=date(2026, 6, 18),
            )
            db.add(row)
            db.commit()
            result = analyze_detail(analysis_id=row.id, db=db)
            self.assertTrue(result["success"])
            data = result["data"]
            self.assertEqual(data["decision"], "buy")
            self.assertEqual(data["technicals"]["ma"]["ma5"], 1)
            self.assertEqual(data["valuation"]["pe"], 28)
        finally:
            db.close()

    def test_detail_not_found(self):
        from app.routers.analyze import analyze_detail
        from fastapi import HTTPException
        db = _make_db()
        try:
            with self.assertRaises(HTTPException):
                analyze_detail(analysis_id=999, db=db)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

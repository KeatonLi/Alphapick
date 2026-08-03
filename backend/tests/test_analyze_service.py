import unittest
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _make_db():
    from app.database import Base
    from app.datasource import models  # noqa: F401  确保表已注册
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _seed_snapshot(db, code, name, trade_date, close, change_pct, turnover=2.0, volume=5_000_000, pe=None, pb=None, source="db_snapshot"):
    from app.datasource.models import StockSpotSnapshot
    db.add(StockSpotSnapshot(
        trade_date=trade_date, stock_code=code, stock_name=name,
        open=close, high=close, low=close, close=close, prev_close=close * 0.99,
        change_pct=change_pct, volume=volume, amount=volume * close,
        turnover_rate=turnover, pe_dynamic=pe, pb=pb, source_name=source,
    ))
    db.commit()


def _seed_daily(db, code, name, start_date, count=60, base=100.0):
    from app.datasource.models import StockDailyBar
    for i in range(count):
        d = start_date - timedelta(days=count - 1 - i)
        close = base + i
        db.add(StockDailyBar(
            trade_date=d, stock_code=code, stock_name=name,
            open=close, high=close + 1, low=close - 1, close=close, prev_close=close - 1,
            change_pct=1.0, volume=1_000_000, amount=1_000_000 * close,
            turnover_rate=2.0, adjust="qfq", source_name="db_snapshot",
        ))
    db.commit()


class NameResolutionTests(unittest.TestCase):
    def test_six_digit_code_resolves_directly(self):
        from app.services.analyze_service import resolve_stock
        db = _make_db()
        try:
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 1500, 1.2, pe=28, pb=9)
            result = resolve_stock(db, "600519")
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["code"], "600519")
            self.assertEqual(result["data"]["name"], "贵州茅台")
        finally:
            db.close()

    def test_prefixed_code_resolves(self):
        from app.services.analyze_service import resolve_stock
        db = _make_db()
        try:
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 1500, 1.2)
            result = resolve_stock(db, "sh600519")
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["code"], "600519")
        finally:
            db.close()

    def test_exact_name_resolves(self):
        from app.services.analyze_service import resolve_stock
        db = _make_db()
        try:
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 1500, 1.2)
            result = resolve_stock(db, "贵州茅台")
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["code"], "600519")
        finally:
            db.close()

    def test_fuzzy_name_resolves(self):
        from app.services.analyze_service import resolve_stock
        db = _make_db()
        try:
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 1500, 1.2)
            result = resolve_stock(db, "茅台")
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["code"], "600519")
        finally:
            db.close()

    def test_unknown_stock_returns_error(self):
        from app.services.analyze_service import resolve_stock
        db = _make_db()
        try:
            result = resolve_stock(db, "不存在的股票")
            self.assertFalse(result["success"])
        finally:
            db.close()

    def test_ambiguous_name_returns_error(self):
        from app.services.analyze_service import resolve_stock
        db = _make_db()
        try:
            _seed_snapshot(db, "000001", "平安银行", date(2026, 6, 18), 10, 1.0)
            _seed_snapshot(db, "000002", "平安银行", date(2026, 6, 18), 10, 1.0)
            result = resolve_stock(db, "平安银行")
            self.assertFalse(result["success"])
            self.assertIn("multiple", result["error"])
        finally:
            db.close()


class FactPackTests(unittest.TestCase):
    def test_fact_pack_includes_indicators_factors_valuation(self):
        from app.services.analyze_service import build_fact_pack
        db = _make_db()
        try:
            _seed_daily(db, "600519", "贵州茅台", date(2026, 6, 18))
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 159, 1.2, turnover=3.5, pe=28, pb=9)
            _seed_snapshot(db, "000001", "平安银行", date(2026, 6, 18), 10, 0.5, pe=6, pb=0.8)
            _seed_snapshot(db, "000002", "万科A", date(2026, 6, 18), 8, -1.0, pe=9, pb=1.0)

            pack = build_fact_pack(db, "600519")
            self.assertIsNotNone(pack)
            self.assertEqual(pack["stock"]["code"], "600519")
            self.assertIn("ma", pack["technicals"])
            self.assertIn("macd", pack["technicals"])
            self.assertIn("kdj", pack["technicals"])
            self.assertIn("range_change", pack["technicals"])
            self.assertIn("total", pack["factors"])
            self.assertGreaterEqual(pack["factors"]["total"], 0)
            self.assertIsNotNone(pack["valuation"]["pe"])
            self.assertIsNotNone(pack["valuation"]["pe_percentile"])
        finally:
            db.close()

    def test_fact_pack_valuation_missing_degrades(self):
        from app.services.analyze_service import build_fact_pack
        db = _make_db()
        try:
            _seed_daily(db, "600519", "贵州茅台", date(2026, 6, 18))
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 159, 1.2, pe=None, pb=None)
            pack = build_fact_pack(db, "600519")
            self.assertIsNotNone(pack)
            self.assertIsNone(pack["valuation"]["pe"])
            self.assertIsNone(pack["valuation"]["pe_percentile"])
        finally:
            db.close()

    def test_fact_pack_without_daily_bars_uses_snapshot_only(self):
        from app.services.analyze_service import build_fact_pack
        db = _make_db()
        try:
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 1500, 1.2)
            pack = build_fact_pack(db, "600519")
            self.assertIsNotNone(pack)
            self.assertEqual(pack["stock"]["code"], "600519")
        finally:
            db.close()

    def test_fact_pack_unknown_code_returns_none(self):
        from app.services.analyze_service import build_fact_pack
        db = _make_db()
        try:
            self.assertIsNone(build_fact_pack(db, "999999"))
        finally:
            db.close()


class LLMParseTests(unittest.TestCase):
    def test_parse_valid_decision(self):
        from app.services.analyze_service import parse_llm_decision
        raw = '{"decision": "buy", "confidence": 75, "summary": "趋势向好", "reasons": ["MA 多头", "估值合理"], "dimensions": {"technical": "看多", "valuation": "中性"}}'
        result = parse_llm_decision(raw)
        self.assertIsNotNone(result)
        self.assertEqual(result["decision"], "buy")
        self.assertEqual(result["confidence"], 75)

    def test_parse_with_code_fence(self):
        from app.services.analyze_service import parse_llm_decision
        raw = '```json\n{"decision": "hold", "confidence": 50, "summary": "观望", "reasons": [], "dimensions": {}}\n```'
        result = parse_llm_decision(raw)
        self.assertEqual(result["decision"], "hold")

    def test_parse_invalid_decision_returns_none(self):
        from app.services.analyze_service import parse_llm_decision
        raw = '{"decision": "sell", "confidence": 80, "summary": "x", "reasons": [], "dimensions": {}}'
        self.assertIsNone(parse_llm_decision(raw))

    def test_parse_invalid_json_returns_none(self):
        from app.services.analyze_service import parse_llm_decision
        self.assertIsNone(parse_llm_decision("not json at all"))


class AnalyzeStockFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_stock_saves_record(self):
        from app.models import StockAnalysis
        from app.services.analyze_service import analyze_stock
        db = _make_db()
        try:
            _seed_daily(db, "600519", "贵州茅台", date(2026, 6, 18))
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 159, 1.2, pe=28, pb=9)
            _seed_snapshot(db, "000001", "平安银行", date(2026, 6, 18), 10, 0.5, pe=6, pb=0.8)

            fake_llm = AsyncMock(return_value='{"decision": "buy", "confidence": 80, "summary": "值得买入", "reasons": ["趋势向上"], "dimensions": {"technical": "看多"}}')
            with patch("app.services.analyze_service.chat", fake_llm):
                result = await analyze_stock(db, "600519")

            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["decision"], "buy")
            row = db.query(StockAnalysis).first()
            self.assertIsNotNone(row)
            self.assertEqual(row.stock_code, "600519")
            self.assertEqual(row.decision, "buy")
        finally:
            db.close()

    async def test_analyze_unknown_stock_returns_error(self):
        from app.services.analyze_service import analyze_stock
        db = _make_db()
        try:
            result = await analyze_stock(db, "不存在的股票")
            self.assertFalse(result["success"])
        finally:
            db.close()

    async def test_analyze_retries_once_then_fails(self):
        from app.models import StockAnalysis
        from app.services.analyze_service import analyze_stock
        db = _make_db()
        try:
            _seed_daily(db, "600519", "贵州茅台", date(2026, 6, 18))
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 159, 1.2)

            fake_llm = AsyncMock(return_value="not valid json")
            with patch("app.services.analyze_service.chat", fake_llm):
                result = await analyze_stock(db, "600519")

            self.assertFalse(result["success"])
            self.assertEqual(fake_llm.await_count, 2)
            self.assertEqual(db.query(StockAnalysis).count(), 0)
        finally:
            db.close()

    async def test_analysis_history_and_detail(self):
        from app.models import StockAnalysis
        from app.services.analyze_service import analyze_stock, get_analysis_detail, get_analyses
        db = _make_db()
        try:
            _seed_daily(db, "600519", "贵州茅台", date(2026, 6, 18))
            _seed_snapshot(db, "600519", "贵州茅台", date(2026, 6, 18), 159, 1.2, pe=28, pb=9)

            fake_llm = AsyncMock(return_value='{"decision": "hold", "confidence": 55, "summary": "观望", "reasons": [], "dimensions": {}}')
            with patch("app.services.analyze_service.chat", fake_llm):
                await analyze_stock(db, "600519")

            rows = db.query(StockAnalysis).all()
            self.assertEqual(len(rows), 1)
            detail = get_analysis_detail(db, rows[0].id)
            self.assertEqual(detail["data"]["decision"], "hold")
            history = get_analyses(db, limit=10)
            self.assertEqual(len(history["data"]), 1)
            self.assertEqual(history["data"][0]["stock_code"], "600519")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

import json
import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class LimitUpServiceTests(unittest.TestCase):
    def _make_db(self):
        from app.database import Base

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        return Session()

    def test_limit_up_overview_parses_raw_eastmoney_fields(self):
        from app.datasource.models import RawDataRecord
        from app.services.limit_up_service import get_limit_up_overview

        db = self._make_db()
        try:
            db.add(RawDataRecord(
                source_name="multi_source",
                data_type="limit_up_pool",
                target_date=date(2026, 6, 19),
                raw_json=json.dumps({
                    "_source": "akshare",
                    "data": [
                        {
                            "序号": 1,
                            "代码": "000811",
                            "名称": "冰轮环境",
                            "涨跌幅": 9.99,
                            "最新价": 40.17,
                            "成交额": 170190288,
                            "流通市值": 39302154505.77,
                            "总市值": 39867840617.28,
                            "换手率": 0.43,
                            "封板资金": 341234067,
                            "首次封板时间": "092500",
                            "最后封板时间": "092500",
                            "炸板次数": 0,
                            "涨停统计": "8/4",
                            "连板数": 2,
                            "所属行业": "通用设备",
                        },
                        {
                            "序号": 2,
                            "代码": "000889",
                            "名称": "中嘉博创",
                            "涨跌幅": 10.13,
                            "最新价": 4.02,
                            "成交额": 185238794,
                            "封板资金": 55683030,
                            "首次封板时间": "092500",
                            "最后封板时间": "093754",
                            "炸板次数": 1,
                            "涨停统计": "1/1",
                            "连板数": 1,
                            "所属行业": "通信服务",
                        },
                    ],
                }, ensure_ascii=False),
            ))
            db.commit()

            result = get_limit_up_overview(db, date(2026, 6, 19))

            self.assertTrue(result["success"])
            data = result["data"]
            self.assertEqual(data["date"], "2026-06-19")
            self.assertEqual(data["summary"]["total"], 2)
            self.assertEqual(data["summary"]["max_board_count"], 2)
            self.assertEqual(data["items"][0]["stock_code"], "000811")
            self.assertEqual(data["items"][0]["stock_name"], "冰轮环境")
            self.assertEqual(data["items"][0]["first_limit_time"], "09:25:00")
            self.assertEqual(data["items"][0]["limit_total"], 8)
            self.assertEqual(data["items"][0]["limit_success"], 4)
            self.assertEqual(data["industries"][0]["leader_name"], "冰轮环境")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

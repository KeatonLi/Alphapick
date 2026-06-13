from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Date, DateTime, Numeric, Text, Integer, func, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.generation_task import GenerationTask
from app.models.schedule_config import ScheduleConfig
from app.models.user import User


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("idx_recommend_date", "recommend_date"),
        Index("idx_stock_code", "stock_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommend_date: Mapped[date] = mapped_column(Date, nullable=False, comment="推荐日期")
    stock_code: Mapped[str] = mapped_column(String(10), nullable=False, comment="股票代码")
    stock_name: Mapped[str] = mapped_column(String(50), nullable=False, comment="股票名称")
    recommend_price: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, comment="推荐价格")
    rec_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="策略排名")
    score: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="量化综合分")
    strategy_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="策略版本")
    factor_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="因子快照 JSON")
    current_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 3), nullable=True, comment="最新价格")
    return_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="收益率")
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="推荐理由")
    tracking_days: Mapped[int] = mapped_column(Integer, default=0, comment="已跟踪交易日数（0-7）")
    status: Mapped[str] = mapped_column(String(20), default="tracking", comment="状态：tracking/completed")
    price_day1: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 3), nullable=True, comment="持股第一天价格")
    price_day2: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 3), nullable=True, comment="持股第二天价格")
    price_day3: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 3), nullable=True, comment="持股第三天价格")
    price_day5: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 3), nullable=True, comment="持股第五天价格")
    price_day7: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 3), nullable=True, comment="持股第七天价格")
    return_rate_day1: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="第一天收益率")
    return_rate_day2: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="第二天收益率")
    return_rate_day3: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="第三天收益率")
    return_rate_day5: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="第五天收益率")
    return_rate_day7: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="第七天收益率")
    final_return_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="最终跟踪收益率")
    max_gain: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="最高收益率（跟踪期最高价相对推荐价）")
    max_drawdown: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, comment="最大回撤（跟踪期最低价相对推荐价）")
    price_updated_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, comment="最近一次价格更新的交易日日期")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间"
    )


class MarketReport(Base):
    __tablename__ = "market_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True, comment="报告日期")
    market_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="市场概况")
    index_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="指数数据 JSON")
    hot_sectors: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="热门板块 JSON")
    ai_report: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="AI 分析报告")
    html_report_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="HTML 报告文件路径")
    yesterday_limit_ups: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="昨日涨停股代码列表JSON")
    yesterday_limit_ups_performance: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True, comment="昨日涨停股今日平均涨幅")
    today_limit_up_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="今日涨停板详情JSON(代码/名称/行业/连板数/封单等)")
    hsgt_flow: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="沪深港通资金流 JSON")
    sectors_full: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="全量行业板块 JSON")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="创建时间"
    )


# === 数据库迁移 SQL（无 Alembic 时手动执行）===
# ALTER TABLE market_reports
#     ADD COLUMN hsgt_flow TEXT COMMENT '沪深港通资金流 JSON' AFTER yesterday_limit_ups_performance;
# ALTER TABLE market_reports
#     ADD COLUMN sectors_full TEXT COMMENT '全量行业板块 JSON' AFTER hsgt_flow;
# ALTER TABLE market_reports
#     ADD COLUMN today_limit_up_data TEXT COMMENT '今日涨停板详情JSON' AFTER yesterday_limit_ups_performance;

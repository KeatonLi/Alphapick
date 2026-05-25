from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import String, Date, DateTime, Numeric, Text, Integer, func, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.generation_task import GenerationTask
from app.models.schedule_config import ScheduleConfig


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
    current_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True, comment="最新价格")
    return_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True, comment="收益率")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True, comment="推荐理由")
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
    market_summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment="市场概况")
    index_data: Mapped[str | None] = mapped_column(Text, nullable=True, comment="指数数据 JSON")
    hot_sectors: Mapped[str | None] = mapped_column(Text, nullable=True, comment="热门板块 JSON")
    ai_report: Mapped[str | None] = mapped_column(Text, nullable=True, comment="AI 分析报告")
    html_report_path: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="HTML 报告文件路径")
    yesterday_limit_ups: Mapped[str | None] = mapped_column(Text, nullable=True, comment="昨日涨停股代码列表JSON")
    yesterday_limit_ups_performance: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True, comment="昨日涨停股今日平均涨幅")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="创建时间"
    )

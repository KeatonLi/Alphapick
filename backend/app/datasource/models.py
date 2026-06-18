"""数据源模块 ORM：采集日志 + 原始数据存储"""

from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Text, ForeignKey, UniqueConstraint,
    Numeric, BigInteger, Index,
)
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.orm import relationship

from app.database import Base


class DataFetchLog(Base):
    __tablename__ = "data_fetch_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_name = Column(String(50), nullable=False, comment="数据源: akshare / tencent / eastmoney")
    data_type = Column(String(50), nullable=False, comment="类型: index_daily / sector_summary / stock_daily / hsgt_flow / limit_up_pool / trade_calendar / stock_spot")
    target_date = Column(Date, nullable=False, comment="采集的目标数据日期")
    status = Column(String(20), nullable=False, comment="success / failed / empty")
    request_params = Column(Text, nullable=True, comment="请求参数 JSON")
    response_size = Column(Integer, nullable=True, comment="响应字节数")
    error_message = Column(Text, nullable=True, comment="失败时的错误信息")
    retry_count = Column(Integer, default=0, comment="实际重试次数")
    duration_ms = Column(Integer, nullable=True, comment="采集耗时（毫秒）")
    created_at = Column(DateTime, default=datetime.now)

    record = relationship("RawDataRecord", back_populates="fetch_log", uselist=False)


class RawDataRecord(Base):
    __tablename__ = "raw_data_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_name = Column(String(50), nullable=False, comment="数据源标识")
    data_type = Column(String(50), nullable=False, comment="数据类型标识")
    target_date = Column(Date, nullable=False, comment="数据日期")
    raw_json = Column(MEDIUMTEXT().with_variant(Text(), "sqlite"), nullable=False, comment="API 原始 JSON 响应，不做任何清洗")
    fetch_log_id = Column(Integer, ForeignKey("data_fetch_log.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    fetch_log = relationship("DataFetchLog", back_populates="record")

    __table_args__ = (
        UniqueConstraint("data_type", "target_date", name="uq_data_type_target_date"),
    )


class StockSpotSnapshot(Base):
    __tablename__ = "stock_spot_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date, nullable=False)
    stock_code = Column(String(10), nullable=False)
    stock_name = Column(String(50), nullable=False)
    open = Column(Numeric(12, 4), nullable=True)
    high = Column(Numeric(12, 4), nullable=True)
    low = Column(Numeric(12, 4), nullable=True)
    close = Column(Numeric(12, 4), nullable=False)
    prev_close = Column(Numeric(12, 4), nullable=True)
    change_pct = Column(Numeric(10, 4), nullable=True)
    volume = Column(BigInteger, nullable=True)
    amount = Column(Numeric(20, 4), nullable=True)
    turnover_rate = Column(Numeric(10, 4), nullable=True)
    pe_dynamic = Column(Numeric(12, 4), nullable=True)
    pb = Column(Numeric(12, 4), nullable=True)
    source_name = Column(String(50), nullable=False)
    raw_payload = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint("trade_date", "stock_code", name="uq_stock_spot_trade_code"),
        Index("idx_stock_spot_trade_date", "trade_date"),
        Index("idx_stock_spot_code", "stock_code"),
    )


class StockDailyBar(Base):
    __tablename__ = "stock_daily_bars"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date, nullable=False)
    stock_code = Column(String(10), nullable=False)
    stock_name = Column(String(50), nullable=True)
    open = Column(Numeric(12, 4), nullable=False)
    high = Column(Numeric(12, 4), nullable=False)
    low = Column(Numeric(12, 4), nullable=False)
    close = Column(Numeric(12, 4), nullable=False)
    prev_close = Column(Numeric(12, 4), nullable=True)
    change_pct = Column(Numeric(10, 4), nullable=True)
    volume = Column(BigInteger, nullable=True)
    amount = Column(Numeric(20, 4), nullable=True)
    turnover_rate = Column(Numeric(10, 4), nullable=True)
    adjust = Column(String(10), default="qfq")
    source_name = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint("trade_date", "stock_code", "adjust", name="uq_daily_bar_trade_code_adjust"),
        Index("idx_daily_bar_trade_date", "trade_date"),
        Index("idx_daily_bar_code", "stock_code"),
    )


class StockCandidate(Base):
    __tablename__ = "stock_candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date, nullable=False)
    stock_code = Column(String(10), nullable=False)
    stock_name = Column(String(50), nullable=False)
    price = Column(Numeric(12, 4), nullable=False)
    change_pct = Column(Numeric(10, 4), nullable=True)
    turnover_rate = Column(Numeric(10, 4), nullable=True)
    volume = Column(BigInteger, nullable=True)
    source_name = Column(String(50), nullable=False, default="db_snapshot")
    candidate_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        UniqueConstraint("trade_date", "stock_code", name="uq_candidate_trade_code"),
        Index("idx_candidate_trade_date", "trade_date"),
    )


class DataQualityCheck(Base):
    __tablename__ = "data_quality_checks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(Date, nullable=False)
    data_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    expected_count = Column(Integer, nullable=True)
    actual_count = Column(Integer, nullable=True)
    missing_count = Column(Integer, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        UniqueConstraint("trade_date", "data_type", name="uq_quality_trade_type"),
        Index("idx_quality_trade_date", "trade_date"),
    )

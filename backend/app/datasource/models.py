"""数据源模块 ORM：采集日志 + 原始数据存储"""

from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Text, ForeignKey, UniqueConstraint,
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
    raw_json = Column(MEDIUMTEXT, nullable=False, comment="API 原始 JSON 响应，不做任何清洗")
    fetch_log_id = Column(Integer, ForeignKey("data_fetch_log.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    fetch_log = relationship("DataFetchLog", back_populates="record")

    __table_args__ = (
        UniqueConstraint("data_type", "target_date", name="uq_data_type_target_date"),
    )

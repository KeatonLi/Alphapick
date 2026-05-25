from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MarketCache(Base):
    """每日行情快照缓存，每天只调一次 AKShare"""
    __tablename__ = "market_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True, comment="缓存日期")
    key: Mapped[str] = mapped_column(String(50), nullable=False, comment="缓存 key: market_index / hot_sectors")
    data: Mapped[str] = mapped_column(Text, nullable=False, comment="JSON 数据")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

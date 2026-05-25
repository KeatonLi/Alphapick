from datetime import datetime

from sqlalchemy import Boolean, Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScheduleConfig(Base):
    """定时任务配置"""
    __tablename__ = "schedule_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否启用")
    run_time: Mapped[str] = mapped_column(String(5), default="16:00", comment="运行时间 HH:MM")
    run_report: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否自动生成报告")
    run_recommend: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否自动生成推荐")
    last_run_at: Mapped[str | None] = mapped_column(String(19), nullable=True, comment="上次运行时间")
    last_run_result: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="上次运行结果")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

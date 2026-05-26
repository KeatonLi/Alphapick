from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import String, Date, DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GenerationTask(Base):
    __tablename__ = "generation_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="report / recommend")
    target_date: Mapped[date] = mapped_column(Date, nullable=False, comment="目标日期")
    status: Mapped[str] = mapped_column(String(20), default="pending", comment="pending / running / completed / failed")
    current_step: Mapped[int] = mapped_column(Integer, default=0, comment="当前步骤序号")
    total_steps: Mapped[int] = mapped_column(Integer, default=0, comment="总步骤数")
    step_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="当前步骤描述")
    progress_pct: Mapped[int] = mapped_column(Integer, default=0, comment="进度百分比 0-100")
    candidate_stocks: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="候选股票 JSON，用于前端展示")
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="生成结果 JSON")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="错误信息")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间"
    )

"""DataFetcher 抽象基类 — 统一重试、日志、存储逻辑"""

import json
import time
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


@dataclass
class FetchResult:
    data_type: str
    target_date: date
    status: str  # success / failed / empty / skipped
    error: Optional[str] = None
    retry_count: int = 0
    duration_ms: int = 0
    response_size: int = 0


class DataFetcher(ABC):
    """数据采集器基类

    子类只需实现 fetch()，基类自动处理：
    - 幂等检查（同一天同一类型只采一次）
    - 3 次指数退避重试（1s → 3s → 9s）
    - 原始 JSON 写入 raw_data_records
    - 采集日志写入 data_fetch_log
    """

    source_name: str = "unknown"
    data_type: str = "unknown"
    max_retries: int = 3
    retry_delays: tuple = (1, 3, 9)

    # ── 子类必须实现 ──

    @abstractmethod
    def fetch(self, target_date: date) -> dict:
        """调用外部 API，返回原始响应 dict。

        Returns:
            包含 API 原始数据的 dict，顶层必须有至少一个数据键。
            返回空 dict {} 表示数据为空（status='empty'）。
        """
        ...

    # ── 可选覆盖 ──

    def request_params(self, target_date: date) -> dict:
        """返回请求参数 dict，用于日志记录。默认空。"""
        return {}

    # ── 模板方法 ──

    def run(self, db: Session, target_date: date) -> FetchResult:
        """执行采集：幂等 → 重试 → 存储 → 日志。db 由调用方传入。"""
        from app.datasource.models import DataFetchLog, RawDataRecord

        # 1. 幂等检查
        existing = (
            db.query(RawDataRecord)
            .filter(
                RawDataRecord.data_type == self.data_type,
                RawDataRecord.target_date == target_date,
            )
            .first()
        )
        if existing:
            return FetchResult(
                data_type=self.data_type,
                target_date=target_date,
                status="skipped",
            )

        # 2. 带重试的 fetch
        raw_dict = {}
        last_error = None
        retry_count = 0
        start = time.time()

        for attempt in range(self.max_retries + 1):
            try:
                raw_dict = self.fetch(target_date)
                if raw_dict is None:
                    raw_dict = {}
                last_error = None
                break
            except Exception as e:
                last_error = str(e)
                retry_count = attempt
                if attempt < self.max_retries:
                    delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                    logger.warning(
                        f"[{self.data_type}] fetch attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay}s..."
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"[{self.data_type}] all {self.max_retries + 1} attempts failed: {e}"
                    )

        duration_ms = int((time.time() - start) * 1000)
        raw_json = json.dumps(raw_dict, ensure_ascii=False, default=str)
        response_size = len(raw_json.encode("utf-8"))

        # 3. 确定状态
        if last_error:
            status = "failed"
        elif not raw_dict:
            status = "empty"
        else:
            status = "success"

        # 4. 写入日志
        log_entry = DataFetchLog(
            source_name=self.source_name,
            data_type=self.data_type,
            target_date=target_date,
            status=status,
            request_params=json.dumps(self.request_params(target_date), ensure_ascii=False),
            response_size=response_size if status == "success" else None,
            error_message=last_error,
            retry_count=retry_count,
            duration_ms=duration_ms,
        )
        db.add(log_entry)
        db.flush()

        # 5. 成功时写原始数据
        if status == "success":
            record = RawDataRecord(
                source_name=self.source_name,
                data_type=self.data_type,
                target_date=target_date,
                raw_json=raw_json,
                fetch_log_id=log_entry.id,
            )
            db.add(record)

        db.commit()

        return FetchResult(
            data_type=self.data_type,
            target_date=target_date,
            status=status,
            error=last_error,
            retry_count=retry_count,
            duration_ms=duration_ms,
            response_size=response_size if status == "success" else 0,
        )

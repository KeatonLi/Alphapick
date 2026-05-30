"""个股日线按需获取 — 前端请求时实时拉取，带重试和日志"""

import json
import time
import logging
from datetime import date
from typing import Optional

import akshare as ak
import pandas as pd
from sqlalchemy.orm import Session

from app.utils.akshare_utils import _to_sina_code

logger = logging.getLogger(__name__)


def fetch_stock_daily(
    db: Session,
    code: str,
    start_date: date,
    end_date: date,
    adjust: str = "qfq",
    max_retries: int = 2,
) -> dict:
    """按需获取个股日线数据

    通过 datasource 模块统一管理：重试 + 日志 + 返回原始 dict。
    不存入 raw_data_records（按需数据不做持久化缓存）。

    Args:
        db: 数据库会话
        code: 股票代码（如 "600519"）
        start_date: 开始日期
        end_date: 结束日期
        adjust: 复权方式，默认前复权 "qfq"
        max_retries: 最大重试次数

    Returns:
        {"success": True, "data": [{"date": ..., "open": ..., ...}, ...]}
    """
    from app.datasource.models import DataFetchLog

    sina_code = _to_sina_code(code)
    params = {
        "code": code,
        "sina_code": sina_code,
        "start_date": start_date.strftime("%Y%m%d"),
        "end_date": end_date.strftime("%Y%m%d"),
        "adjust": adjust,
    }

    retry_count = 0
    last_error = None
    start = time.time()
    df = None

    for attempt in range(max_retries + 1):
        try:
            df = ak.stock_zh_a_daily(
                symbol=sina_code,
                start_date=start_date.strftime("%Y%m%d"),
                end_date=end_date.strftime("%Y%m%d"),
                adjust=adjust,
            )
            if df is not None and not df.empty:
                break
            last_error = "数据为空"
        except Exception as e:
            last_error = str(e)
            retry_count = attempt
            if attempt < max_retries:
                delay = [1, 3][attempt]
                logger.warning(
                    f"[stock_daily] fetch {code} attempt {attempt + 1} failed: {e}. "
                    f"Retrying in {delay}s..."
                )
                time.sleep(delay)
            else:
                logger.error(
                    f"[stock_daily] all {max_retries + 1} attempts failed for {code}: {e}"
                )

    duration_ms = int((time.time() - start) * 1000)
    success = df is not None and not df.empty

    # 记录日志
    log_entry = DataFetchLog(
        source_name="akshare",
        data_type="stock_daily",
        target_date=end_date,
        status="success" if success else ("failed" if last_error else "empty"),
        request_params=json.dumps(params, ensure_ascii=False),
        response_size=len(df) if success else None,
        error_message=last_error,
        retry_count=retry_count,
        duration_ms=duration_ms,
    )
    db.add(log_entry)
    db.commit()

    if not success:
        return {"success": False, "error": last_error or "数据为空"}

    # 转为 dict 返回（不存 raw_data_records）
    df = df.fillna(0).replace([float("inf"), float("-inf")], 0)
    df["change_pct"] = df["close"].pct_change().fillna(0).replace([float("inf"), float("-inf")], 0) * 100

    data = []
    for _, row in df.iterrows():
        row_date = row["date"]
        if isinstance(row_date, pd.Timestamp):
            row_date = row_date.date()
        else:
            row_date = pd.Timestamp(str(row_date)).date()

        data.append({
            "date": str(row_date),
            "open": float(row["open"]),
            "close": float(row["close"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "volume": int(row["volume"]),
            "change_pct": round(float(row["change_pct"]), 2),
        })

    return {"success": True, "data": data}

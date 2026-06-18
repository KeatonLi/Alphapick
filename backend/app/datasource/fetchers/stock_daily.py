"""个股日线按需获取 — 前端请求时实时拉取，带重试和日志（多源互备版）"""

import json
import time
import logging
from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.datasource.multi_source import multi_source
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
    """按需获取个股日线数据（多源互备）

    通过 MultiSourceManager 按优先级尝试多个数据源：
    1. AKShare（主源，支持历史日线）
    2. 腾讯/新浪（不支持历史日线，会跳过）

    不存入 raw_data_records（按需数据不做持久化缓存）。
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
    data = None

    for attempt in range(max_retries + 1):
        try:
            # 使用多源管理器获取日线数据
            result = multi_source.get_stock_daily(code, days=365, adjust=adjust)
            if result["success"] and result["data"]:
                # 过滤日期范围
                all_data = result["data"]
                filtered = []
                for row in all_data:
                    row_date_str = row.get("日期", row.get("date", ""))
                    try:
                        row_date = date.fromisoformat(row_date_str)
                        if start_date <= row_date <= end_date:
                            filtered.append(row)
                    except ValueError:
                        continue
                if filtered:
                    data = filtered
                    source = result.get("_source", "unknown")
                    logger.info(f"[stock_daily] {code} 数据源: {source}")
                    break
                else:
                    last_error = "指定日期范围内无数据"
            else:
                last_error = result.get("error", "数据为空")
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
    success = data is not None and len(data) > 0

    # 记录日志
    log_entry = DataFetchLog(
        source_name="multi_source",
        data_type="stock_daily",
        target_date=end_date,
        status="success" if success else ("failed" if last_error else "empty"),
        request_params=json.dumps(params, ensure_ascii=False),
        response_size=len(data) if success else None,
        error_message=last_error,
        retry_count=retry_count,
        duration_ms=duration_ms,
    )
    db.add(log_entry)
    db.commit()

    if not success:
        return {"success": False, "error": last_error or "数据为空"}

    # 统一输出格式
    output = []
    for row in data:
        output.append({
            "date": row.get("日期", row.get("date", "")),
            "open": float(row.get("开盘", row.get("open", 0))),
            "close": float(row.get("收盘", row.get("close", 0))),
            "high": float(row.get("最高", row.get("high", 0))),
            "low": float(row.get("最低", row.get("low", 0))),
            "volume": int(row.get("成交量", row.get("volume", 0))),
            "change_pct": round(float(row.get("涨跌幅", row.get("change_pct", 0))), 2),
        })

    return {"success": True, "data": output}

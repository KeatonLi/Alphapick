"""展示层数据读取 — 从 raw_data_records 读取原始 JSON 并解析为结构化数据"""

import json
import numpy as np
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from app.datasource.models import RawDataRecord


def _get_raw(db: Session, data_type: str, target_date: date) -> Optional[dict]:
    """获取指定日期和类型的原始数据"""
    record = (
        db.query(RawDataRecord)
        .filter(
            RawDataRecord.data_type == data_type,
            RawDataRecord.target_date == target_date,
        )
        .first()
    )
    if not record:
        return None
    return json.loads(record.raw_json)


def read_index_data(db: Session, target_date: date) -> dict:
    """读取指数日线，返回与 get_market_index() 相同的格式"""
    raw = _get_raw(db, "index_daily", target_date)
    if not raw:
        return {"success": False, "error": f"未找到 {target_date} 的指数数据，请等待数据采集完成"}

    data = []
    index_map = {
        "sh000001": "上证指数",
        "sz399001": "深证成指",
        "sz399006": "创业板指",
    }
    for code, name in index_map.items():
        if code in raw and raw[code].get("data"):
            records = raw[code]["data"]
            if len(records) < 2:
                continue
            latest = records[-1]
            prev = records[-2]
            prev_close = float(prev.get("close", 0))
            if prev_close == 0:
                continue
            change_pct = (float(latest["close"]) - prev_close) / prev_close * 100
            data.append({
                "name": name,
                "code": code,
                "close": round(float(latest["close"]), 2),
                "change_pct": round(change_pct, 2),
                "volume": float(latest.get("volume", 0)),
            })

    if not data:
        return {"success": False, "error": "指数数据解析失败"}
    return {"success": True, "data": data}


def read_sector_data(db: Session, target_date: date, top_n: int = 10) -> dict:
    """读取板块行业摘要，返回与 get_hot_sectors() 相同的格式"""
    raw = _get_raw(db, "sector_summary", target_date)
    if not raw:
        return {"success": False, "error": f"未找到 {target_date} 的板块数据，请等待数据采集完成"}

    records = raw.get("data", [])
    if not records:
        return {"success": False, "error": "板块数据为空"}

    # 按涨跌幅排序，取前 top_n
    sorted_records = sorted(
        records,
        key=lambda r: float(r.get("涨跌幅", 0) or 0),
        reverse=True,
    )
    top = sorted_records[:top_n]

    data = []
    for row in top:
        try:
            change_str = str(row.get("涨跌幅", "0"))
            change_pct = float(change_str) if change_str not in ("", "None") else 0
            data.append({
                "name": str(row.get("板块", "")),
                "change_pct": round(change_pct, 2),
                "leading_stock": str(row.get("领涨股", "")),
                "driver": "",
            })
        except (ValueError, TypeError):
            continue

    if not data:
        return {"success": False, "error": "板块数据解析失败"}
    return {"success": True, "data": data}


def read_hsgt_data(db: Session, target_date: date) -> dict:
    """读取北向资金，返回与 get_hsgt_flow() 相同的格式"""
    from datetime import datetime

    raw = _get_raw(db, "hsgt_flow", target_date)
    if not raw:
        return {"success": False, "error": f"未找到 {target_date} 的北向资金数据，请等待数据采集完成"}

    sh_data = raw.get("沪股通", [])
    sz_data = raw.get("深股通", [])

    if not sh_data or not sz_data:
        return {"success": False, "error": "沪深港通数据为空"}

    sh_latest = sh_data[-1]
    sz_latest = sz_data[-1]

    today_flow = {
        "date": str(sh_latest.get("日期", "")),
        "sh_net_buy": round(float(sh_latest.get("当日成交净买额", 0)), 2),
        "sh_total_inflow": round(float(sh_latest.get("当日资金流入", 0)), 2),
        "sh_cumulative": round(float(sh_latest.get("历史累计净买额", 0)), 2),
        "sz_net_buy": round(float(sz_latest.get("当日成交净买额", 0)), 2),
        "sz_total_inflow": round(float(sz_latest.get("当日资金流入", 0)), 2),
        "sz_cumulative": round(float(sz_latest.get("历史累计净买额", 0)), 2),
        "total_net_buy": round(
            float(sh_latest.get("当日成交净买额", 0)) + float(sz_latest.get("当日成交净买额", 0)), 2
        ),
    }

    sh_hist = sh_data[-30:]
    sz_hist = sz_data[-30:]
    history = []
    for i in range(len(sh_hist)):
        sh_row = sh_hist[i]
        sz_row = sz_hist[i] if i < len(sz_hist) else None
        history.append({
            "date": str(sh_row.get("日期", "")),
            "sh_net_buy": round(float(sh_row.get("当日成交净买额", 0)), 2),
            "sz_net_buy": round(float(sz_row.get("当日成交净买额", 0)), 2) if sz_row else 0,
        })

    return {"success": True, "data": {"today": today_flow, "history": history}}


def read_limit_up_codes(db: Session, target_date: date) -> list:
    """读取涨停池股票代码列表"""
    raw = _get_raw(db, "limit_up_pool", target_date)
    if not raw:
        return []
    records = raw.get("data", [])
    return [str(r.get("代码", "")) for r in records if r.get("代码")]


def read_stock_quotes_for_codes(db: Session, target_date: date, codes: list) -> dict:
    """从全市场快照中读取指定股票的行情（用于涨停股表现等场景）

    返回: {code: {"price": ..., "change_pct": ...}, ...}
    """
    raw = _get_raw(db, "stock_spot", target_date)
    if not raw:
        return {}

    quotes = raw.get("quotes", [])
    if not quotes:
        return {}

    code_set = set(str(c).zfill(6) for c in codes)
    result = {}

    for line in quotes:
        if "~\"" not in line:
            continue
        try:
            parts = line.split("~")
            if len(parts) < 35:
                continue
            raw_code = parts[2] if len(parts) > 2 else ""
            clean_code = raw_code.replace("sz", "").replace("sh", "").replace("bj", "")
            if clean_code not in code_set:
                continue
            price = float(parts[3]) if parts[3] not in ("", "0") else 0
            change_pct = float(parts[32]) if parts[32] not in ("",) else 0
            if price > 0:
                result[clean_code] = {"price": price, "change_pct": change_pct}
        except (ValueError, IndexError):
            continue

    return result


# ─── 交易日历 ────────────────────────────────────────────────

def _get_trade_dates_list(db: Session) -> list:
    """从 raw_data_records 获取交易日列表（缓存到内存）"""
    # 取最新的交易日历记录（按 created_at 排序）
    from app.datasource.models import RawDataRecord as RR

    record = (
        db.query(RR)
        .filter(RR.data_type == "trade_calendar")
        .order_by(RR.created_at.desc())
        .first()
    )
    if not record:
        return []

    raw = json.loads(record.raw_json)
    return raw.get("data", [])


def read_trade_days_after(db: Session, from_date: date, n: int) -> list:
    """获取 from_date 之后第 1 到第 n 个交易日"""
    dates = _get_trade_dates_list(db)
    if not dates:
        return []
    from_str = from_date.strftime("%Y-%m-%d")
    result = [d for d in dates if d > from_str]
    return [date.fromisoformat(d) for d in result[:n]]


def read_trade_dates(db: Session, days: int = 30) -> list:
    """获取最近 N 个交易日（按日期降序）"""
    dates = _get_trade_dates_list(db)
    if not dates:
        return []
    today = date.today()
    today_str = today.strftime("%Y-%m-%d")
    result = [d for d in dates if d <= today_str]
    return sorted(result, reverse=True)[:days]


def read_is_trade_date(db: Session, d: date) -> bool:
    """判断指定日期是否为交易日"""
    dates = _get_trade_dates_list(db)
    if not dates:
        # fallback: 周末为非交易日
        return d.weekday() < 5
    return d.strftime("%Y-%m-%d") in dates

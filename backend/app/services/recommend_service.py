# backend/app/services/recommend_service.py
import json
from datetime import date, timedelta
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Numeric

from app.utils.akshare_utils import get_trade_dates_for_frontend
from app.services.candidate_service import get_ma_filtered_candidates, format_candidates_for_ai
from app.utils.ai_client import chat
from app.models import Recommendation
from app.prompts import RECOMMEND_SYSTEM_PROMPT, RECOMMEND_OUTPUT_FORMAT


async def get_recommend_by_date(db: Session, rec_date: date) -> dict:
    """获取指定日期的推荐股票（只读，不自动生成）"""
    recs = db.query(Recommendation).filter(
        Recommendation.recommend_date == rec_date
    ).all()
    if recs:
        return {
            "success": True,
            "data": [
                {
                    "stock_code": r.stock_code,
                    "stock_name": r.stock_name,
                    "recommend_price": float(r.recommend_price),
                    "reason": r.reason,
                } for r in recs
            ],
            "from_cache": True,
            "date": str(rec_date),
        }
    return {"success": True, "data": [], "from_cache": False, "date": str(rec_date)}


async def generate_recommendations(db: Session, rec_date: Optional[date] = None) -> dict:
    """为指定日期生成量化推荐（THS 候选池 + AI 精选）"""
    target = rec_date or date.today()

    # 检查是否已有推荐
    existing = db.query(Recommendation).filter(
        Recommendation.recommend_date == target
    ).first()
    if existing:
        return {"success": True, "data": {}, "message": f"今日推荐已存在，跳过生成"}

    # 获取候选池（THS ∩ 热度排名 → 主板 → 消息面）
    candidate_result = await get_ma_filtered_candidates(top_n=50)
    if not candidate_result["success"]:
        return {"success": False, "error": f"候选池筛选失败: {candidate_result['error']}"}

    candidates = candidate_result["data"]

    if not candidates:
        return {"success": True, "data": {"count": 0}, "message": "无候选股票，跳过AI精选"}

    user_message = f"""候选股票数据：

{format_candidates_for_ai(candidates)}

{RECOMMEND_OUTPUT_FORMAT}"""
    ai_response = await chat([
        {"role": "system", "content": RECOMMEND_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ])

    try:
        recommendations = json.loads(
            ai_response.strip().lstrip("```json").rstrip("```").strip()
        )
    except json.JSONDecodeError:
        return {"success": False, "error": "AI 返回格式解析失败"}

    for rec in recommendations:
        db_rec = Recommendation(
            recommend_date=target,
            stock_code=rec["code"],
            stock_name=rec["name"],
            recommend_price=rec["price"],
            reason=rec.get("reason", ""),
        )
        db.add(db_rec)
    db.commit()

    return {"success": True, "data": {"count": len(recommendations)}, "message": f"推荐生成成功"}


def get_available_recommend_dates(db: Session, days: int = 30) -> dict:
    """获取有推荐记录的日期列表"""
    since = date.today() - timedelta(days=days)
    dates = (
        db.query(Recommendation.recommend_date)
        .filter(Recommendation.recommend_date >= since)
        .distinct()
        .order_by(Recommendation.recommend_date.desc())
        .all()
    )
    return {"success": True, "data": [str(d[0]) for d in dates]}


async def get_recommend_stats(db: Session) -> dict:
    total = db.query(func.count(Recommendation.id)).scalar() or 0
    if total == 0:
        return {"success": True, "data": {"total": 0, "completed": 0, "win_count": 0, "win_rate": 0, "avg_return": 0, "avg_max_gain": 0, "avg_max_drawdown": 0}}

    completed = db.query(func.count(Recommendation.id)).filter(
        Recommendation.status == "completed"
    ).scalar() or 0

    if completed == 0:
        return {"success": True, "data": {"total": total, "completed": 0, "win_count": 0, "win_rate": 0, "avg_return": 0, "avg_max_gain": 0, "avg_max_drawdown": 0}}

    win_count = db.query(func.count(Recommendation.id)).filter(
        Recommendation.status == "completed",
        cast(Recommendation.final_return_rate, Numeric) > 0
    ).scalar() or 0
    avg_return = db.query(func.avg(Recommendation.final_return_rate)).filter(
        Recommendation.status == "completed"
    ).scalar() or 0
    avg_max_gain = db.query(func.avg(Recommendation.max_gain)).filter(
        Recommendation.status == "completed"
    ).scalar() or 0
    avg_max_drawdown = db.query(func.avg(Recommendation.max_drawdown)).filter(
        Recommendation.status == "completed"
    ).scalar() or 0

    return {
        "success": True,
        "data": {
            "total": total,
            "completed": completed,
            "win_count": win_count,
            "win_rate": round(win_count / completed * 100, 2) if completed > 0 else 0,
            "avg_return": round(float(avg_return) * 100, 2),
            "avg_max_gain": round(float(avg_max_gain) * 100, 2),
            "avg_max_drawdown": round(float(avg_max_drawdown) * 100, 2),
        },
    }


def get_all_recommendations(db: Session) -> dict:
    """获取所有历史推荐"""
    recs = (
        db.query(Recommendation)
        .order_by(Recommendation.recommend_date.desc(), Recommendation.id)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "recommend_date": str(r.recommend_date),
                "stock_code": r.stock_code,
                "stock_name": r.stock_name,
                "recommend_price": float(r.recommend_price) if r.recommend_price else 0,
                "current_price": float(r.current_price) if r.current_price else 0,
                "return_rate": float(r.return_rate) * 100 if r.return_rate else 0,
                "reason": r.reason or "",
                "tracking_days": r.tracking_days or 0,
                "status": r.status or "tracking",
                "price_day1": float(r.price_day1) if r.price_day1 else 0,
                "price_day2": float(r.price_day2) if r.price_day2 else 0,
                "price_day3": float(r.price_day3) if r.price_day3 else 0,
                "return_rate_day1": float(r.return_rate_day1) * 100 if r.return_rate_day1 else 0,
                "return_rate_day2": float(r.return_rate_day2) * 100 if r.return_rate_day2 else 0,
                "return_rate_day3": float(r.return_rate_day3) * 100 if r.return_rate_day3 else 0,
                "final_return_rate": float(r.final_return_rate) * 100 if r.final_return_rate else 0,
                "max_gain": float(r.max_gain) * 100 if r.max_gain else 0,
                "max_drawdown": float(r.max_drawdown) * 100 if r.max_drawdown else 0,
            }
            for r in recs
        ],
    }


async def update_recommend_prices(db: Session) -> dict:
    """基于交易日回溯填充推荐股票收盘价

    对每条 tracking 状态的记录，计算 recommend_date 之后的第1/2/3个交易日，
    如果该交易日 ≤ today 且数据未填，则拉取当日收盘价回填。
    幂等：已有数据不重复覆盖。
    纯按钮触发，无自动调度。
    """
    import asyncio
    import akshare as ak
    from app.utils.akshare_utils import _to_sina_code, get_trade_days_after

    today = date.today()

    recs = db.query(Recommendation).filter(
        Recommendation.status == "tracking"
    ).all()
    if not recs:
        return {"success": True, "data": {"updated": 0, "message": "没有 tracking 状态的记录"}}

    updated = 0

    for rec in recs:
        base = float(rec.recommend_price)
        if base <= 0:
            continue

        rec_date = rec.recommend_date
        # 推荐当天或更晚 → 还没到第一个交易日，跳过
        if rec_date >= today:
            continue

        # 获取 T 之后第 1..3 个交易日
        trade_days = get_trade_days_after(rec_date, 3)
        if not trade_days:
            continue

        # 确定哪些天需要补填
        needs_fetch = []
        day_map = {}  # date -> (day_index, price_attr, rate_attr)
        for i, d in enumerate(trade_days):
            if d > today:
                break
            day_idx = i + 1
            price_attr = f"price_day{day_idx}"
            rate_attr = f"return_rate_day{day_idx}"
            if getattr(rec, price_attr) is not None:
                continue  # 已有数据不覆盖
            needs_fetch.append(d)
            day_map[d] = (day_idx, price_attr, rate_attr)

        if not needs_fetch:
            continue

        # 拉取历史日线数据
        sina_code = _to_sina_code(rec.stock_code)
        try:
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(
                None,
                lambda: ak.stock_zh_a_daily(
                    symbol=sina_code,
                    start_date=needs_fetch[0].strftime("%Y%m%d"),
                    end_date=needs_fetch[-1].strftime("%Y%m%d"),
                    adjust="qfq",
                ),
            )
        except Exception:
            # 单只股票失败不影响其他
            continue

        if df is None or df.empty:
            continue

        # 从日线数据提取指定日期的收盘价
        for _, row in df.iterrows():
            raw_date = row["date"]
            if isinstance(raw_date, pd.Timestamp):
                row_date = raw_date.date()
            else:
                row_date = pd.Timestamp(str(raw_date)).date()

            if row_date not in day_map:
                continue

            close_price = float(row["close"])
            if close_price <= 0:
                continue

            day_idx, price_attr, rate_attr = day_map[row_date]
            day_return = (close_price - base) / base

            setattr(rec, price_attr, close_price)
            setattr(rec, rate_attr, day_return)

            # 如果是第3天 → 完结
            if day_idx == 3:
                rec.status = "completed"
                rec.final_return_rate = day_return

            # 更新 current_price / return_rate 为最新一天的数据
            rec.current_price = close_price
            rec.return_rate = day_return

            updated += 1

        # 全部填完后统一算 tracking_days 和衍生指标
        all_prices = [base]
        td = 0
        for i in range(1, 4):
            p = getattr(rec, f"price_day{i}", None)
            if p is not None:
                td = i
                all_prices.append(float(p))
        rec.tracking_days = td

        if td > 0:
            max_p = max(all_prices)
            min_p = min(all_prices)
            rec.max_gain = (max_p - base) / base
            rec.max_drawdown = (min_p - base) / base

        rec.price_updated_date = today

    db.commit()
    return {"success": True, "data": {"updated": updated}}


def edit_day_recommendations(db: Session, rec_date: date, updates: list) -> dict:
    """编辑某日推荐：批量更新各条记录的字段，可选删除某些条

    updates 格式: [{"id": 123, "recommend_price": 25.5, "reason": "...", "delete": false}]
    """
    recs = db.query(Recommendation).filter(
        Recommendation.recommend_date == rec_date
    ).all()
    rec_map = {r.id: r for r in recs}

    updated_count = 0
    deleted_count = 0
    for item in updates:
        rid = item.get("id")
        if rid not in rec_map:
            continue
        rec = rec_map[rid]

        if item.get("delete"):
            db.delete(rec)
            deleted_count += 1
            continue

        if "recommend_price" in item:
            rec.recommend_price = item["recommend_price"]
        if "reason" in item:
            rec.reason = item["reason"]
        updated_count += 1

    db.commit()
    return {"success": True, "data": {"updated": updated_count, "deleted": deleted_count}}


def delete_day_recommendations(db: Session, rec_date: date) -> dict:
    """删除某日全部推荐记录"""
    count = db.query(Recommendation).filter(
        Recommendation.recommend_date == rec_date
    ).delete()
    db.commit()
    return {"success": True, "data": {"deleted": count}}


def delete_recommendation(db: Session, rec_id: int) -> dict:
    """删除一条推荐记录"""
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        return {"success": False, "error": "记录不存在"}
    db.delete(rec)
    db.commit()
    return {"success": True, "data": {"id": rec_id}}


def reset_recommend_tracking(db: Session, rec_id: int) -> dict:
    """重置一条推荐的收益跟踪数据"""
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        return {"success": False, "error": "记录不存在"}
    rec.tracking_days = 0
    rec.status = "tracking"
    rec.price_day1 = None
    rec.price_day2 = None
    rec.price_day3 = None
    rec.return_rate_day1 = None
    rec.return_rate_day2 = None
    rec.return_rate_day3 = None
    rec.final_return_rate = None
    rec.max_gain = None
    rec.max_drawdown = None
    rec.current_price = None
    rec.return_rate = None
    rec.price_updated_date = None
    db.commit()
    return {"success": True, "data": {"id": rec_id}}


async def update_single_recommend_price(db: Session, rec_id: int) -> dict:
    """单独更新一条推荐的收益跟踪价格"""
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        return {"success": False, "error": "记录不存在"}
    if rec.status == "completed":
        return {"success": False, "error": "该记录已完结，如需重新跟踪请先重置"}

    import asyncio
    import akshare as ak
    from app.utils.akshare_utils import _to_sina_code, get_trade_days_after

    today = date.today()
    rec_date = rec.recommend_date
    if rec_date >= today:
        return {"success": True, "data": {"message": "推荐当天尚未开始跟踪"}}

    base = float(rec.recommend_price)
    if base <= 0:
        return {"success": False, "error": "推荐价格异常"}

    trade_days = get_trade_days_after(rec_date, 3)
    if not trade_days:
        return {"success": False, "error": "无法获取交易日"}

    needs_fetch = []
    day_map = {}
    for i, d in enumerate(trade_days):
        if d > today:
            break
        day_idx = i + 1
        price_attr = f"price_day{day_idx}"
        rate_attr = f"return_rate_day{day_idx}"
        if getattr(rec, price_attr) is not None:
            continue
        needs_fetch.append(d)
        day_map[d] = (day_idx, price_attr, rate_attr)

    if not needs_fetch:
        return {"success": True, "data": {"message": "所有交易日数据已存在，无需更新"}}

    sina_code = _to_sina_code(rec.stock_code)
    try:
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(
            None,
            lambda: ak.stock_zh_a_daily(
                symbol=sina_code,
                start_date=needs_fetch[0].strftime("%Y%m%d"),
                end_date=needs_fetch[-1].strftime("%Y%m%d"),
                adjust="qfq",
            ),
        )
    except Exception as e:
        return {"success": False, "error": f"获取行情失败: {str(e)}"}

    if df is None or df.empty:
        return {"success": False, "error": "行情数据为空"}

    filled = 0
    for _, row in df.iterrows():
        raw_date = row["date"]
        if isinstance(raw_date, pd.Timestamp):
            row_date = raw_date.date()
        else:
            row_date = pd.Timestamp(str(raw_date)).date()

        if row_date not in day_map:
            continue
        close_price = float(row["close"])
        if close_price <= 0:
            continue

        day_idx, price_attr, rate_attr = day_map[row_date]
        day_return = (close_price - base) / base

        setattr(rec, price_attr, close_price)
        setattr(rec, rate_attr, day_return)
        filled += 1

        if day_idx == 3:
            rec.status = "completed"
            rec.final_return_rate = day_return

        rec.current_price = close_price
        rec.return_rate = day_return

    if filled:
        all_prices = [base]
        td = 0
        for i in range(1, 4):
            p = getattr(rec, f"price_day{i}", None)
            if p is not None:
                td = i
                all_prices.append(float(p))
        rec.tracking_days = td

        if td > 0:
            rec.max_gain = (max(all_prices) - base) / base
            rec.max_drawdown = (min(all_prices) - base) / base

        rec.price_updated_date = today
        db.commit()

    return {"success": True, "data": {"filled": filled, "id": rec_id}}


def batch_reset_tracking(db: Session, ids: list[int]) -> dict:
    """批量重置多条推荐的收益跟踪数据"""
    results = {"reset": 0, "errors": []}
    for rid in ids:
        result = reset_recommend_tracking(db, rid)
        if result["success"]:
            results["reset"] += 1
        else:
            results["errors"].append({"id": rid, "error": result["error"]})
    return {"success": True, "data": results}


def batch_delete_recommendations(db: Session, ids: list[int]) -> dict:
    """批量删除多条推荐记录"""
    results = {"deleted": 0, "errors": []}
    for rid in ids:
        result = delete_recommendation(db, rid)
        if result["success"]:
            results["deleted"] += 1
        else:
            results["errors"].append({"id": rid, "error": result["error"]})
    return {"success": True, "data": results}

import json
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import Numeric, cast, func, or_
from sqlalchemy.orm import Session

from app.datasource.warehouse import get_candidates_from_db, get_daily_close_rows
from app.models import Recommendation
from app.services.strategy_service import rank_candidates


TRACKING_MILESTONES = (1, 2, 3, 5, 7)


async def get_recommend_by_date(db: Session, rec_date: date) -> dict:
    recs = db.query(Recommendation).filter(Recommendation.recommend_date == rec_date).all()
    if not recs:
        return {"success": True, "data": [], "from_cache": False, "date": str(rec_date)}

    return {
        "success": True,
        "data": [
            {
                "stock_code": r.stock_code,
                "stock_name": r.stock_name,
                "recommend_price": float(r.recommend_price),
                "rank": r.rec_rank or 0,
                "score": float(r.score) if r.score is not None else 0,
                "strategy_version": r.strategy_version or "",
                "factor_snapshot": json.loads(r.factor_snapshot) if r.factor_snapshot else {},
                "reason": r.reason,
            }
            for r in recs
        ],
        "from_cache": True,
        "date": str(rec_date),
    }


async def generate_recommendations(db: Session, rec_date: Optional[date] = None) -> dict:
    """Generate quant recommendations from normalized DB snapshots only."""
    target = rec_date or date.today()
    existing = db.query(Recommendation).filter(Recommendation.recommend_date == target).first()
    if existing:
        return {"success": True, "data": {}, "message": f"{target} recommendations already exist"}

    candidate_result = get_candidates_from_db(db, target, top_n=50)
    if not candidate_result["success"]:
        return {"success": False, "error": f"candidate pool unavailable: {candidate_result['error']}"}

    candidates = candidate_result["data"]
    if not candidates:
        return {"success": True, "data": {"count": 0}, "message": "no DB candidates"}

    recommendations = rank_candidates(candidates, top_n=5)
    if not recommendations:
        return {"success": True, "data": {"count": 0}, "message": "no qualified strategy candidates"}

    for rec in recommendations:
        db.add(Recommendation(
            recommend_date=target,
            stock_code=rec["code"],
            stock_name=rec["name"],
            recommend_price=rec["price"],
            rec_rank=rec.get("rank"),
            score=rec.get("score"),
            strategy_version=rec.get("strategy_version"),
            factor_snapshot=json.dumps(rec.get("factor_snapshot", {}), ensure_ascii=False),
            reason=rec.get("reason", ""),
        ))
    db.commit()

    return {"success": True, "data": {"count": len(recommendations)}, "message": "recommendations generated"}


def get_available_recommend_dates(db: Session, days: int = 30) -> dict:
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(Recommendation.recommend_date)
        .filter(Recommendation.recommend_date >= since)
        .distinct()
        .order_by(Recommendation.recommend_date.desc())
        .all()
    )
    return {"success": True, "data": [str(row[0]) for row in rows]}


async def get_recommend_stats(db: Session) -> dict:
    empty = {
        "total": 0,
        "completed": 0,
        "win_count": 0,
        "win_rate": 0,
        "avg_return": 0,
        "avg_max_gain": 0,
        "avg_max_drawdown": 0,
        "avg_return_day3": 0,
        "avg_return_day5": 0,
        "avg_return_day7": 0,
        "win_rate_day3": 0,
        "win_rate_day5": 0,
        "win_rate_day7": 0,
    }
    total = db.query(func.count(Recommendation.id)).scalar() or 0
    if total == 0:
        return {"success": True, "data": empty}

    completed = db.query(func.count(Recommendation.id)).filter(Recommendation.status == "completed").scalar() or 0
    if completed == 0:
        return {"success": True, "data": {**empty, "total": total}}

    win_count = (
        db.query(func.count(Recommendation.id))
        .filter(Recommendation.status == "completed", cast(Recommendation.final_return_rate, Numeric) > 0)
        .scalar()
        or 0
    )
    avg_return = db.query(func.avg(Recommendation.final_return_rate)).filter(Recommendation.status == "completed").scalar() or 0
    avg_max_gain = db.query(func.avg(Recommendation.max_gain)).filter(Recommendation.status == "completed").scalar() or 0
    avg_max_drawdown = db.query(func.avg(Recommendation.max_drawdown)).filter(Recommendation.status == "completed").scalar() or 0

    period_stats = {}
    for days, field in [
        (3, Recommendation.return_rate_day3),
        (5, Recommendation.return_rate_day5),
        (7, Recommendation.return_rate_day7),
    ]:
        count = (
            db.query(func.count(Recommendation.id))
            .filter(Recommendation.status == "completed", field.isnot(None))
            .scalar()
            or 0
        )
        wins = (
            db.query(func.count(Recommendation.id))
            .filter(Recommendation.status == "completed", cast(field, Numeric) > 0)
            .scalar()
            or 0
        )
        avg = db.query(func.avg(field)).filter(Recommendation.status == "completed", field.isnot(None)).scalar() or 0
        period_stats[f"avg_return_day{days}"] = round(float(avg) * 100, 2)
        period_stats[f"win_rate_day{days}"] = round(wins / count * 100, 2) if count else 0

    return {
        "success": True,
        "data": {
            "total": total,
            "completed": completed,
            "win_count": win_count,
            "win_rate": round(win_count / completed * 100, 2) if completed else 0,
            "avg_return": round(float(avg_return) * 100, 2),
            "avg_max_gain": round(float(avg_max_gain) * 100, 2),
            "avg_max_drawdown": round(float(avg_max_drawdown) * 100, 2),
            **period_stats,
        },
    }


def get_all_recommendations(db: Session) -> dict:
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
                "rank": r.rec_rank or 0,
                "score": float(r.score) if r.score is not None else 0,
                "strategy_version": r.strategy_version or "",
                "factor_snapshot": json.loads(r.factor_snapshot) if r.factor_snapshot else {},
                "current_price": float(r.current_price) if r.current_price else 0,
                "return_rate": float(r.return_rate) * 100 if r.return_rate else 0,
                "reason": r.reason or "",
                "tracking_days": r.tracking_days or 0,
                "status": r.status or "tracking",
                "price_day1": float(r.price_day1) if r.price_day1 else 0,
                "price_day2": float(r.price_day2) if r.price_day2 else 0,
                "price_day3": float(r.price_day3) if r.price_day3 else 0,
                "price_day5": float(r.price_day5) if r.price_day5 else 0,
                "price_day7": float(r.price_day7) if r.price_day7 else 0,
                "return_rate_day1": float(r.return_rate_day1) * 100 if r.return_rate_day1 else 0,
                "return_rate_day2": float(r.return_rate_day2) * 100 if r.return_rate_day2 else 0,
                "return_rate_day3": float(r.return_rate_day3) * 100 if r.return_rate_day3 else 0,
                "return_rate_day5": float(r.return_rate_day5) * 100 if r.return_rate_day5 else 0,
                "return_rate_day7": float(r.return_rate_day7) * 100 if r.return_rate_day7 else 0,
                "final_return_rate": float(r.final_return_rate) * 100 if r.final_return_rate else 0,
                "max_gain": float(r.max_gain) * 100 if r.max_gain else 0,
                "max_drawdown": float(r.max_drawdown) * 100 if r.max_drawdown else 0,
            }
            for r in recs
        ],
    }


def _fill_tracking_from_db(db: Session, rec: Recommendation, today: date) -> int:
    from app.display.data_reader import read_trade_days_after

    base = float(rec.recommend_price)
    if base <= 0 or rec.recommend_date >= today:
        return 0

    trade_days = read_trade_days_after(db, rec.recommend_date, max(TRACKING_MILESTONES))
    day_map = {}
    needed_dates = []
    for i, d in enumerate(trade_days):
        if d > today:
            break
        day_idx = i + 1
        if day_idx not in TRACKING_MILESTONES:
            continue
        price_attr = f"price_day{day_idx}"
        if getattr(rec, price_attr) is not None:
            continue
        needed_dates.append(d)
        day_map[d] = (day_idx, price_attr, f"return_rate_day{day_idx}")

    close_map = get_daily_close_rows(db, rec.stock_code, needed_dates)
    filled = 0
    for row_date, close_price in close_map.items():
        if row_date not in day_map or close_price <= 0:
            continue
        day_idx, price_attr, rate_attr = day_map[row_date]
        day_return = (close_price - base) / base
        setattr(rec, price_attr, close_price)
        setattr(rec, rate_attr, day_return)
        rec.current_price = close_price
        rec.return_rate = day_return
        if day_idx == max(TRACKING_MILESTONES):
            rec.status = "completed"
            rec.final_return_rate = day_return
        filled += 1

    all_prices = [base]
    tracking_days = 0
    latest_return = None
    for i in TRACKING_MILESTONES:
        price = getattr(rec, f"price_day{i}", None)
        if price is not None:
            tracking_days = i
            all_prices.append(float(price))
            latest_return = getattr(rec, f"return_rate_day{i}", None)
    rec.tracking_days = tracking_days
    if latest_return is not None:
        rec.final_return_rate = latest_return
    if tracking_days > 0:
        rec.max_gain = (max(all_prices) - base) / base
        rec.max_drawdown = (min(all_prices) - base) / base
    if filled:
        rec.price_updated_date = today
    return filled


async def update_recommend_prices(db: Session) -> dict:
    today = date.today()
    recs = db.query(Recommendation).filter(
        or_(Recommendation.status == "tracking", Recommendation.return_rate_day7.is_(None))
    ).all()
    if not recs:
        return {"success": True, "data": {"updated": 0, "message": "no tracking records"}}

    updated = sum(_fill_tracking_from_db(db, rec, today) for rec in recs)
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
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        return {"success": False, "error": "record not found"}
    db.delete(rec)
    db.commit()
    return {"success": True, "data": {"id": rec_id}}


def reset_recommend_tracking(db: Session, rec_id: int) -> dict:
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        return {"success": False, "error": "record not found"}
    rec.tracking_days = 0
    rec.status = "tracking"
    for days in TRACKING_MILESTONES:
        setattr(rec, f"price_day{days}", None)
        setattr(rec, f"return_rate_day{days}", None)
    rec.final_return_rate = None
    rec.max_gain = None
    rec.max_drawdown = None
    rec.current_price = None
    rec.return_rate = None
    rec.price_updated_date = None
    db.commit()
    return {"success": True, "data": {"id": rec_id}}


async def update_single_recommend_price(db: Session, rec_id: int) -> dict:
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        return {"success": False, "error": "record not found"}
    if rec.status == "completed" and rec.return_rate_day7 is not None:
        return {"success": False, "error": "record already completed; reset before recalculating"}
    filled = _fill_tracking_from_db(db, rec, date.today())
    if filled:
        db.commit()
    return {"success": True, "data": {"filled": filled, "id": rec_id}}


def batch_update_tracking_prices(db: Session, ids: list[int]) -> dict:
    unique_ids = list(dict.fromkeys(ids))
    results = {"updated": 0, "filled": 0, "errors": []}
    if not unique_ids:
        return {"success": True, "data": results}

    recs = db.query(Recommendation).filter(Recommendation.id.in_(unique_ids)).all()
    rec_by_id = {rec.id: rec for rec in recs}
    today = date.today()

    for rid in unique_ids:
        rec = rec_by_id.get(rid)
        if not rec:
            results["errors"].append({"id": rid, "error": "record not found"})
            continue
        if rec.status == "completed" and rec.return_rate_day7 is not None:
            results["errors"].append({"id": rid, "error": "record already completed; reset before recalculating"})
            continue
        filled = _fill_tracking_from_db(db, rec, today)
        results["updated"] += 1
        results["filled"] += filled

    db.commit()
    return {"success": True, "data": results}


def batch_reset_tracking(db: Session, ids: list[int]) -> dict:
    results = {"reset": 0, "errors": []}
    for rid in ids:
        result = reset_recommend_tracking(db, rid)
        if result["success"]:
            results["reset"] += 1
        else:
            results["errors"].append({"id": rid, "error": result["error"]})
    return {"success": True, "data": results}


def batch_delete_recommendations(db: Session, ids: list[int]) -> dict:
    results = {"deleted": 0, "errors": []}
    for rid in ids:
        result = delete_recommendation(db, rid)
        if result["success"]:
            results["deleted"] += 1
        else:
            results["errors"].append({"id": rid, "error": result["error"]})
    return {"success": True, "data": results}

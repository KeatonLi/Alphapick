# backend/app/services/recommend_service.py
import json
from datetime import date, timedelta
from typing import Optional

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
        return {"success": True, "data": {"total": 0, "win_count": 0, "win_rate": 0, "avg_return": 0}}
    win_count = db.query(func.count(Recommendation.id)).filter(
        cast(Recommendation.return_rate, Numeric) > 0
    ).scalar() or 0
    avg_return = db.query(func.avg(Recommendation.return_rate)).scalar() or 0
    return {
        "success": True,
        "data": {
            "total": total,
            "win_count": win_count,
            "win_rate": round(win_count / total * 100, 2) if total > 0 else 0,
            "avg_return": round(float(avg_return) * 100, 2),
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
                "price_day1": float(r.price_day1) if r.price_day1 else 0,
                "price_day2": float(r.price_day2) if r.price_day2 else 0,
                "price_day3": float(r.price_day3) if r.price_day3 else 0,
                "return_rate_day1": float(r.return_rate_day1) * 100 if r.return_rate_day1 else 0,
                "return_rate_day2": float(r.return_rate_day2) * 100 if r.return_rate_day2 else 0,
                "return_rate_day3": float(r.return_rate_day3) * 100 if r.return_rate_day3 else 0,
                "final_return_rate": float(r.final_return_rate) * 100 if r.final_return_rate else 0,
            }
            for r in recs
        ],
    }


async def update_recommend_prices(db: Session) -> dict:
    """更新推荐记录价格（只更新未满 3 个交易日的记录）"""
    import requests

    recs = db.query(Recommendation).filter(
        Recommendation.tracking_days < 3
    ).all()
    if not recs:
        return {"success": True, "data": {"updated": 0, "message": "所有记录已满 3 个交易日，无需更新"}}

    from app.utils.akshare_utils import _to_tencent_code, _from_tencent_code

    tencent_codes = [_to_tencent_code(r.stock_code) for r in recs]
    batch_size = 80
    price_map = {}

    for i in range(0, len(tencent_codes), batch_size):
        batch = tencent_codes[i:i + batch_size]
        try:
            r = requests.get(
                f"https://qt.gtimg.cn/q={','.join(batch)}",
                headers={"Referer": "https://finance.qq.com", "User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
            for line in r.text.strip().split("\n"):
                if "~\"" not in line:
                    continue
                parts = line.split("~")
                if len(parts) > 4:
                    clean = _from_tencent_code(parts[2] if len(parts) > 2 else "")
                    try:
                        price = float(parts[3]) if parts[3] not in ("", "0") else 0
                        if price > 0:
                            price_map[clean] = price
                    except (ValueError, IndexError):
                        continue
        except Exception:
            continue

    updated = 0
    for rec in recs:
        if rec.stock_code not in price_map:
            continue
        price = price_map[rec.stock_code]
        rec.tracking_days = (rec.tracking_days or 0) + 1
        day = rec.tracking_days
        base = float(rec.recommend_price)
        if base <= 0:
            continue
        day_return = (price - base) / base

        if day == 1:
            rec.price_day1 = price
            rec.return_rate_day1 = day_return
        elif day == 2:
            rec.price_day2 = price
            rec.return_rate_day2 = day_return
        elif day == 3:
            rec.price_day3 = price
            rec.return_rate_day3 = day_return
            rec.final_return_rate = day_return

        rec.current_price = price
        rec.return_rate = day_return
        updated += 1

    db.commit()
    return {"success": True, "data": {"updated": updated}}

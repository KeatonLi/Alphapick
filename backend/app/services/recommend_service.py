# backend/app/services/recommend_service.py
import json
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Numeric

from app.utils.akshare_utils import get_trade_dates_for_frontend
from app.services.candidate_service import get_ma_candidates, format_candidates_for_ai
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


async def generate_recommendations(db: Session, rec_date: date | None = None) -> dict:
    """为指定日期生成量化推荐（均线候选 + AI 精选）"""
    target = rec_date or date.today()

    # 检查是否已有推荐
    existing = db.query(Recommendation).filter(
        Recommendation.recommend_date == target
    ).first()
    if existing:
        return {"success": True, "data": {}, "message": f"今日推荐已存在，跳过生成"}

    # 筛选均线多头候选池
    candidate_result = await get_ma_candidates(top_n=200)
    if not candidate_result["success"]:
        return {"success": False, "error": f"候选池筛选失败: {candidate_result['error']}"}

    candidates = candidate_result["data"]
    if len(candidates) < 5:
        return {"success": False, "error": f"候选池股票不足（{len(candidates)}只），无法生成推荐"}

    # 取前50只给AI筛选
    ai_candidates = candidates[:50]

    user_message = f"""候选股票数据（均线多头排列，成交量放大）：

{format_candidates_for_ai(ai_candidates)}

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


def get_trade_dates_for_frontend(days: int = 30) -> dict:
    """获取前端可用的交易日列表
    @deprecated 使用 akshare_utils.get_trade_dates_for_frontend
    """
    return get_trade_dates_for_frontend(days=days)


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
            }
            for r in recs
        ],
    }


async def update_recommend_prices(db: Session) -> dict:
    """更新所有推荐记录的最新价格（使用 akshare 腾讯接口）"""
    import requests

    recs = db.query(Recommendation).all()
    if not recs:
        return {"success": True, "data": {"updated": 0}}

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
        if rec.stock_code in price_map:
            rec.current_price = price_map[rec.stock_code]
            if rec.recommend_price and float(rec.recommend_price) > 0:
                rec.return_rate = (
                    (float(rec.current_price) - float(rec.recommend_price))
                    / float(rec.recommend_price)
                )
            updated += 1

    db.commit()
    return {"success": True, "data": {"updated": updated}}

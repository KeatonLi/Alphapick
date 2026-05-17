import json
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Numeric

from app.utils.akshare_utils import get_stock_list
from app.utils.ai_client import chat
from app.models import Recommendation

RECOMMEND_PROMPT = """你是一位量化交易分析师。我会给你一份A股市场的股票数据（包含代码、名称、价格、涨跌幅、成交量、换手率），请你基于以下量化逻辑筛选出 5 只最有潜力的股票：

筛选逻辑：
1. **动量因子**：近期涨幅适中（3%-8%），不是极端追涨
2. **量价配合**：成交量放大配合价格上涨，换手率活跃但不异常
3. **趋势健康**：排除连续暴涨暴跌的异常标的
4. **分散行业**：5只股票尽量分散在不同行业

输出格式（JSON）：
[
  {{"code": "000001", "name": "股票名", "price": 12.34, "reason": "推荐理由"}},
  ...
]

只输出JSON数组，不要其他内容。"""


async def get_daily_recommendations(db: Session) -> dict:
    today = date.today()
    recs = db.query(Recommendation).filter(
        Recommendation.recommend_date == today
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
        }

    stock_result = await get_stock_list()
    if not stock_result["success"]:
        return {"success": False, "error": f"获取股票列表失败: {stock_result['error']}"}

    all_stocks = stock_result["data"]
    # Filter: price between 5-100, volume > 0, turnover > 1%
    candidates = [
        s for s in all_stocks
        if 5 <= s["price"] <= 100 and s["volume"] > 0 and s["turnover"] > 1
    ]
    # Sort by momentum + volume and take top 200 for AI screening
    candidates.sort(key=lambda x: x["change_pct"] * x["turnover"], reverse=True)
    candidates = candidates[:200]

    user_message = f"候选股票数据：\n{json.dumps(candidates, ensure_ascii=False)}"
    ai_response = await chat([
        {"role": "system", "content": RECOMMEND_PROMPT},
        {"role": "user", "content": user_message},
    ])

    try:
        recommendations = json.loads(ai_response.strip().lstrip("```json").rstrip("```").strip())
    except json.JSONDecodeError:
        return {"success": False, "error": "AI 返回格式解析失败"}

    for rec in recommendations:
        db_rec = Recommendation(
            recommend_date=today,
            stock_code=rec["code"],
            stock_name=rec["name"],
            recommend_price=rec["price"],
            reason=rec.get("reason", ""),
        )
        db.add(db_rec)
    db.commit()

    return {"success": True, "data": recommendations, "from_cache": False}


async def get_recommend_stats(db: Session) -> dict:
    total = db.query(func.count(Recommendation.id)).scalar() or 0
    if total == 0:
        return {"success": True, "data": {"total": 0, "win_rate": 0, "avg_return": 0}}

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


async def update_recommend_prices(db: Session) -> dict:
    """更新所有推荐记录的最新价格"""
    import akshare as ak
    try:
        df = ak.stock_zh_a_spot()
        price_map = {}
        for _, row in df.iterrows():
            price_map[row["代码"]] = float(row["最新价"])

        stock_codes = list(price_map.keys())
        recs = db.query(Recommendation).filter(
            Recommendation.stock_code.in_(stock_codes)
        ).all()
        updated = 0
        for rec in recs:
            if rec.stock_code in price_map:
                rec.current_price = price_map[rec.stock_code]
                if rec.recommend_price and rec.recommend_price > 0:
                    rec.return_rate = (
                        (rec.current_price - float(rec.recommend_price))
                        / float(rec.recommend_price)
                    )
                updated += 1
        db.commit()
        return {"success": True, "data": {"updated": updated}}
    except Exception as e:
        return {"success": False, "error": str(e)}

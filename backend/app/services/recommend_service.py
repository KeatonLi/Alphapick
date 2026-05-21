import json
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Numeric

from app.utils.akshare_utils import get_stock_list, get_trade_dates
from app.utils.ai_client import chat
from app.models import Recommendation

# Sector mapping for top stocks (simplified)
SECTOR_KEYWORDS = {
    "科技": ["科技", "软件", "电子", "通信", "半导体", "芯片", "互联网"],
    "消费": ["消费", "食品", "饮料", "家电", "纺织", "服装", "零售"],
    "金融": ["银行", "保险", "证券", "信托", "金融"],
    "医药": ["医药", "医疗", "生物", "健康"],
    "新能源": ["新能源", "光伏", "锂电", "储能", "电动车", "汽车"],
    "周期": ["钢铁", "煤炭", "有色", "化工", "建材", "地产", "建筑"],
    "基建": ["基建", "工程", "机械", "设备"],
    "公用": ["电力", "燃气", "水务", "环保", "公用"],
}

def _guess_sector(name: str) -> str:
    """Guess sector from stock name/industry keywords"""
    for sector, keywords in SECTOR_KEYWORDS.items():
        for kw in keywords:
            if kw in name:
                return sector
    return "其他"


RECOMMEND_PROMPT = """你是一位量化交易分析师。我会给你一份A股市场的候选股票数据（代码、名称、价格、涨跌幅、成交量、换手率），请你筛选出 5 只最有潜力的股票。

筛选标准（重要性从高到低）：
1. **趋势健康**：排除连续暴涨暴跌的异常标的，涨幅适中（1%~10%最佳）
2. **动量可持续**：成交量放大配合价格上涨，换手率活跃（>2%），量价配合良好
3. **价格合理**：价格 5~100 元之间，流动性好
4. **行业分散**：5只股票必须分散在4个以上不同行业，避免集中持股风险

排除标准（必须排除）：
- ST 股、*ST 股
- 涨跌停板（极端行情）
- 股价低于 3 元（流动性风险）或高于 100 元（波动过大）
- 换手率低于 1%（资金关注度不足）

每只股票的推荐理由要具体说明为什么该股符合上述标准。

输出格式（严格 JSON 数组，不要任何其他内容）：
[
  {"code": "000001", "name": "股票名", "price": 12.34, "reason": "推荐理由（从量价配合、动量、行业地位等角度具体说明）"},
  ...
]

必须输出恰好 5 只股票。"""


async def get_daily_recommendations(db: Session) -> dict:
    return await get_recommend_by_date(db, date.today())


async def get_recommend_by_date(db: Session, rec_date: date) -> dict:
    """获取指定日期的推荐股票"""
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

    # 如果不是今天，不允许生成新推荐
    if rec_date != date.today():
        return {"success": False, "error": f"暂无 {rec_date} 的推荐数据"}

    stock_result = await get_stock_list()
    if not stock_result["success"]:
        return {"success": False, "error": f"获取股票列表失败: {stock_result['error']}"}

    all_stocks = stock_result["data"]

    # Phase 1: Rough filtering - remove obvious bad candidates
    candidates = []
    for s in all_stocks:
        price = s.get("price") or 0
        change_pct = s.get("change_pct") or 0
        volume = s.get("volume") or 0
        turnover = s.get("turnover") or 0

        # Skip invalid entries
        if price <= 0 or price > 500:
            continue
        # Skip extreme price range
        if price < 3 or price > 100:
            continue
        # Skip extreme change (likely limit up/down or anomaly)
        if abs(change_pct) > 12:
            continue
        # Skip zero volume
        if volume <= 0:
            continue
        # Skip low activity
        if turnover < 1:
            continue
        # Prefer positive momentum but not too extreme
        if change_pct < 0.5:
            continue

        s["_sector"] = _guess_sector(s.get("name", ""))
        candidates.append(s)

    if len(candidates) < 10:
        # If too few candidates after filtering, relax constraints
        candidates = [
            s for s in all_stocks
            if 3 <= (s.get("price") or 0) <= 100
            and (s.get("volume") or 0) > 0
            and abs(s.get("change_pct") or 0) < 12
        ]
        for s in candidates:
            s["_sector"] = _guess_sector(s.get("name", ""))

    # Phase 2: Score and rank candidates
    # Score = momentum * turnover * price_factor
    # Price factor: prefer mid-range prices (10-50)
    for s in candidates:
        price = s.get("price", 50)
        price_factor = 1.0
        if 10 <= price <= 50:
            price_factor = 1.2
        elif 50 < price <= 80:
            price_factor = 1.0
        else:
            price_factor = 0.8

        change_pct = abs(s.get("change_pct", 0))
        # Prefer moderate momentum (1%~8%), not extreme
        momentum_factor = 1.0
        if 1 <= change_pct <= 5:
            momentum_factor = 1.3
        elif 5 < change_pct <= 8:
            momentum_factor = 1.1
        elif change_pct > 8:
            momentum_factor = 0.7

        s["_score"] = (
            s.get("change_pct", 0)
            * s.get("turnover", 0)
            * price_factor
            * momentum_factor
        )

    # Sort by score and take top candidates
    candidates.sort(key=lambda x: x.get("_score", 0), reverse=True)

    # Phase 3: Sector diversification check - pick top from each sector first
    final_candidates = []
    sectors_selected = set()
    remaining = []

    for s in candidates:
        sector = s.get("_sector", "其他")
        if sector not in sectors_selected and len(final_candidates) < 5:
            final_candidates.append(s)
            sectors_selected.add(sector)
        else:
            remaining.append(s)

    # Fill remaining slots from remaining candidates
    while len(final_candidates) < 5 and remaining:
        s = remaining.pop(0)
        final_candidates.append(s)

    # Limit to top 150 for AI screening
    candidates_for_ai = candidates[:150]

    user_message = f"候选股票数据（已按多因子模型打分排序）：\n{json.dumps(candidates_for_ai, ensure_ascii=False)}"
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
            recommend_date=rec_date,
            stock_code=rec["code"],
            stock_name=rec["name"],
            recommend_price=rec["price"],
            reason=rec.get("reason", ""),
        )
        db.add(db_rec)
    db.commit()

    return {"success": True, "data": recommendations, "from_cache": False, "date": str(rec_date)}


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
    return {
        "success": True,
        "data": [str(d[0]) for d in dates],
    }


def get_trade_dates_for_frontend(days: int = 30) -> dict:
    """获取前端可用的交易日列表（用于日期选择器）"""
    try:
        dates = get_trade_dates(days)
        return {"success": True, "data": dates}
    except Exception as e:
        return {"success": False, "error": str(e)}


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

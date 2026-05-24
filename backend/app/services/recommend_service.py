import json
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Numeric

from app.utils.akshare_utils import get_stock_list, get_trade_dates
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

    # 不限制日期：今天查实时推荐，历史日期查缓存（无缓存则生成后缓存）
    # 注意：历史日期若缓存为空，返回空列表而非报错，确保市场报告仍能展示
    try:
        stock_result = await get_stock_list()
    except Exception as e:
        return {"success": False, "error": f"获取股票列表失败: {e}"}
    if not stock_result["success"]:
        # 股票数据获取失败时，历史日期返回空列表（不报错）
        if rec_date != date.today():
            return {"success": True, "data": [], "from_cache": False, "date": str(rec_date)}
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


def get_all_recommendations(db: Session) -> dict:
    """获取所有历史推荐（用于收益跟踪），按推荐日期倒序"""
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


async def generate_recommendations(db: Session, rec_date: date | None = None) -> dict:
    """为指定日期生成量化推荐（供 cron 调用）"""
    target = rec_date or date.today()
    return await get_recommend_by_date(db, target)


async def update_recommend_prices(db: Session) -> dict:
    """更新所有推荐记录的最新价格（使用腾讯批量接口）"""
    import requests

    recs = db.query(Recommendation).all()
    if not recs:
        return {"success": True, "data": {"updated": 0}}

    # 转换代码：000001 -> sz000001, 600519 -> sh600519
    def to_tencent_code(code):
        code = str(code).strip()
        for prefix in ("sh", "sz", "bj"):
            if code.startswith(prefix):
                return code
        if code.startswith(("0", "3")):
            return f"sz{code}"
        elif code.startswith(("6",)):
            return f"sh{code}"
        else:
            return f"sz{code}"

    tencent_codes = [to_tencent_code(r.stock_code) for r in recs]
    batch_size = 80

    price_map = {}
    for i in range(0, len(tencent_codes), batch_size):
        batch = tencent_codes[i:i + batch_size]
        try:
            r = requests.get(
                f"https://qt.gtimg.cn/q={','.join(batch)}",
                headers={
                    "Referer": "https://finance.qq.com",
                    "User-Agent": "Mozilla/5.0",
                },
                timeout=10,
            )
            for line in r.text.strip().split("\n"):
                if "~\"" not in line:
                    continue
                parts = line.split("~")
                if len(parts) > 4:
                    raw_code = parts[2] if len(parts) > 2 else ""
                    clean = raw_code
                    for prefix in ("sh", "sz", "bj"):
                        if clean.startswith(prefix):
                            clean = clean[len(prefix):]
                            break
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

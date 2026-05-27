# backend/app/services/analysis_service.py
"""数据分析服务 - 对推荐记录进行多维度统计分析"""

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func, cast, Numeric, case, extract
from sqlalchemy.orm import Session

from app.models import Recommendation


# MySQL 周几: 1=Sunday, 2=Monday, ..., 7=Saturday
WEEKDAY_NAMES = {
    1: "周日",
    2: "周一",
    3: "周二",
    4: "周三",
    5: "周四",
    6: "周五",
    7: "周六",
}

# 用于只取工作日（周一到周五）
WORKDAY_CODES = [2, 3, 4, 5, 6]


def _base_query(db: Session, start_date: Optional[date], end_date: Optional[date]):
    """构建基础已完成推荐查询"""
    q = db.query(Recommendation).filter(Recommendation.status == "completed")
    if start_date:
        q = q.filter(Recommendation.recommend_date >= start_date)
    if end_date:
        q = q.filter(Recommendation.recommend_date <= end_date)
    return q


def _safe_float(val) -> float:
    """安全转换 Decimal/None 为 float"""
    if val is None:
        return 0.0
    return float(val)


def get_weekday_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计每周各交易日的推荐效果

    返回每个交易日的推荐数量、胜率、平均收益、平均最大涨幅、平均最大回撤。
    """
    q = _base_query(db, start_date, end_date)

    rows = (
        q.with_entities(
            func.dayofweek(Recommendation.recommend_date).label("weekday"),
            func.count(Recommendation.id).label("total"),
            func.sum(
                case(
                    (cast(Recommendation.final_return_rate, Numeric) > 0, 1),
                    else_=0,
                )
            ).label("win_count"),
            func.avg(Recommendation.final_return_rate).label("avg_return"),
            func.avg(Recommendation.max_gain).label("avg_max_gain"),
            func.avg(Recommendation.max_drawdown).label("avg_max_drawdown"),
        )
        .group_by(func.dayofweek(Recommendation.recommend_date))
        .all()
    )

    weekday_data = {}
    for row in rows:
        wd = int(row.weekday)
        total = int(row.total)
        win = int(row.win_count or 0)
        weekday_data[wd] = {
            "weekday": WEEKDAY_NAMES.get(wd, f"未知({wd})"),
            "total": total,
            "win_count": win,
            "win_rate": round(win / total * 100, 2) if total > 0 else 0,
            "avg_return": round(_safe_float(row.avg_return) * 100, 2),
            "avg_max_gain": round(_safe_float(row.avg_max_gain) * 100, 2),
            "avg_max_drawdown": round(_safe_float(row.avg_max_drawdown) * 100, 2),
        }

    # 补全没有数据的工作日
    result = []
    for wd in WORKDAY_CODES:
        if wd in weekday_data:
            result.append(weekday_data[wd])
        else:
            result.append({
                "weekday": WEEKDAY_NAMES[wd],
                "total": 0,
                "win_count": 0,
                "win_rate": 0,
                "avg_return": 0,
                "avg_max_gain": 0,
                "avg_max_drawdown": 0,
            })

    return {"success": True, "data": result}


def get_holding_period_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计不同持仓天数的收益表现

    分别看第1天、第2天、第3天的收益率分布情况。
    """
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "success": True,
            "data": {
                "day1": _empty_period_stats("第1天"),
                "day2": _empty_period_stats("第2天"),
                "day3": _empty_period_stats("第3天"),
            },
        }

    periods = {"day1": [], "day2": [], "day3": []}
    for r in recs:
        if r.return_rate_day1 is not None:
            periods["day1"].append(float(r.return_rate_day1))
        if r.return_rate_day2 is not None:
            periods["day2"].append(float(r.return_rate_day2))
        if r.return_rate_day3 is not None:
            periods["day3"].append(float(r.return_rate_day3))

    result = {}
    for key, label in [("day1", "第1天"), ("day2", "第2天"), ("day3", "第3天")]:
        vals = periods[key]
        if not vals:
            result[key] = _empty_period_stats(label)
            continue

        vals_sorted = sorted(vals)
        n = len(vals_sorted)
        result[key] = {
            "label": label,
            "count": n,
            "win_rate": round(sum(1 for v in vals if v > 0) / n * 100, 2),
            "avg_return": round(sum(vals) / n * 100, 2),
            "median_return": round(_percentile(vals_sorted, 50) * 100, 2),
            "max_return": round(max(vals) * 100, 2),
            "min_return": round(min(vals) * 100, 2),
            "p25": round(_percentile(vals_sorted, 25) * 100, 2),
            "p75": round(_percentile(vals_sorted, 75) * 100, 2),
        }

    return {"success": True, "data": result}


def get_return_distribution(
    db: Session,
    holding_days: int = 3,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """获取指定持仓天数的收益分布直方图数据

    Args:
        holding_days: 持仓天数 (1, 2, 3)
        start_date: 起始日期
        end_date: 结束日期

    Returns:
        直方图的区间和计数
    """
    q = _base_query(db, start_date, end_date)

    # 根据持仓天数选择对应的收益率字段
    rate_col = {
        1: Recommendation.return_rate_day1,
        2: Recommendation.return_rate_day2,
        3: Recommendation.return_rate_day3,
    }.get(holding_days, Recommendation.final_return_rate)

    q = q.filter(rate_col.isnot(None))
    recs = q.all()

    if not recs:
        return {"success": True, "data": {"bins": [], "holding_days": holding_days}}

    rates = []
    for r in recs:
        val = getattr(r, f"return_rate_day{holding_days}", None)
        if val is not None:
            rates.append(float(val) * 100)  # 转为百分比

    if not rates:
        return {"success": True, "data": {"bins": [], "holding_days": holding_days}}

    # 构建直方图: 区间宽度 1%
    min_val = min(rates)
    max_val = max(rates)
    bin_width = 1.0
    bin_start = int(min_val / bin_width) * bin_width  # 向下取整到 bin_width 的倍数
    bin_end = (int(max_val / bin_width) + 1) * bin_width + bin_width

    bins = []
    edge = bin_start
    while edge < bin_end:
        low = edge
        high = edge + bin_width
        count = sum(1 for r in rates if low <= r < high)
        if count > 0 or (bin_start <= edge <= bin_end):
            bins.append({
                "range": f"[{low:.1f}%, {high:.1f}%)",
                "low": round(low, 1),
                "high": round(high, 1),
                "count": count,
            })
        edge = high

    # 过滤掉首尾空桶
    while bins and bins[0]["count"] == 0:
        bins.pop(0)
    while bins and bins[-1]["count"] == 0:
        bins.pop()

    return {
        "success": True,
        "data": {
            "holding_days": holding_days,
            "total": len(rates),
            "bins": bins,
            "stats": {
                "avg": round(sum(rates) / len(rates), 2),
                "median": round(_percentile(sorted(rates), 50), 2),
                "std": round(_std(rates), 2),
                "min": round(min(rates), 2),
                "max": round(max(rates), 2),
            },
        },
    }


def generate_insights(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """自动生成关键洞察文本

    基于统计数据，输出人类可读的分析结论列表。
    """
    insights = []

    # --- 1. 整体表现 ---
    q = _base_query(db, start_date, end_date)
    recs = q.all()
    total = len(recs)

    if total == 0:
        return {"success": True, "data": {"insights": ["暂无已完成的推荐数据，无法生成洞察。"], "period": _format_period(start_date, end_date)}}

    final_rates = [float(r.final_return_rate) for r in recs if r.final_return_rate is not None]
    win_count = sum(1 for r in final_rates if r > 0)
    win_rate = win_count / len(final_rates) * 100 if final_rates else 0
    avg_return = sum(final_rates) / len(final_rates) * 100 if final_rates else 0

    insights.append(
        f"统计周期内共完成 {total} 笔推荐，胜率 {win_rate:.1f}%，"
        f"平均收益率 {avg_return:+.2f}%。"
    )

    # --- 2. 最佳/最差交易日 ---
    weekday_result = get_weekday_stats(db, start_date, end_date)
    if weekday_result["success"]:
        days = [d for d in weekday_result["data"] if d["total"] > 0]
        if days:
            best_day = max(days, key=lambda d: d["avg_return"])
            worst_day = min(days, key=lambda d: d["avg_return"])
            if best_day["weekday"] != worst_day["weekday"]:
                insights.append(
                    f"表现最佳的交易日是{best_day['weekday']}（平均收益 {best_day['avg_return']:+.2f}%，"
                    f"胜率 {best_day['win_rate']:.1f}%），"
                    f"最差的是{worst_day['weekday']}（平均收益 {worst_day['avg_return']:+.2f}%）。"
                )
            else:
                insights.append(
                    f"数据仅涵盖{best_day['weekday']}，平均收益 {best_day['avg_return']:+.2f}%，"
                    f"胜率 {best_day['win_rate']:.1f}%。"
                )

    # --- 3. 持仓天数对比 ---
    holding_result = get_holding_period_stats(db, start_date, end_date)
    if holding_result["success"]:
        period_data = holding_result["data"]
        periods_with_data = {k: v for k, v in period_data.items() if v.get("count", 0) > 0}
        if len(periods_with_data) >= 2:
            best_period = max(periods_with_data.items(), key=lambda x: x[1]["avg_return"])
            worst_period = min(periods_with_data.items(), key=lambda x: x[1]["avg_return"])
            insights.append(
                f"持仓{best_period[1]['label']}收益最佳（平均 {best_period[1]['avg_return']:+.2f}%），"
                f"持仓{worst_period[1]['label']}收益最差（平均 {worst_period[1]['avg_return']:+.2f}%）。"
            )

    # --- 4. 收益波动 ---
    if len(final_rates) >= 5:
        std = _std(final_rates) * 100
        if std > 5:
            insights.append(f"收益波动较大（标准差 {std:.2f}%），建议关注风控。")
        elif std < 2:
            insights.append(f"收益波动较小（标准差 {std:.2f}%），推荐稳定性较好。")

    # --- 5. 极值提醒 ---
    max_gain_records = [r for r in recs if r.max_gain is not None and float(r.max_gain) > 0.05]
    if max_gain_records:
        insights.append(
            f"有 {len(max_gain_records)} 笔推荐盘中最高涨幅超过 5%，"
            f"平均最大涨幅 {_avg_pct([r.max_gain for r in max_gain_records]):+.2f}%。"
        )

    max_dd_records = [r for r in recs if r.max_drawdown is not None and float(r.max_drawdown) < -0.05]
    if max_dd_records:
        insights.append(
            f"有 {len(max_dd_records)} 笔推荐盘中最大回撤超过 5%，"
            f"平均最大回撤 {_avg_pct([r.max_drawdown for r in max_dd_records]):+.2f}%。"
        )

    # --- 6. 日期范围提示 ---
    insights.append(f"统计周期：{_format_period(start_date, end_date)}")

    return {"success": True, "data": {"insights": insights, "period": _format_period(start_date, end_date)}}


# ============ 辅助函数 ============


def _empty_period_stats(label: str) -> dict:
    """返回空的持仓周期统计"""
    return {
        "label": label,
        "count": 0,
        "win_rate": 0,
        "avg_return": 0,
        "median_return": 0,
        "max_return": 0,
        "min_return": 0,
        "p25": 0,
        "p75": 0,
    }


def _percentile(sorted_vals: list, pct: float) -> float:
    """计算百分位数（线性插值法），输入必须已排序"""
    if not sorted_vals:
        return 0.0
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    k = (n - 1) * pct / 100.0
    f = int(k)
    c = f + 1
    if c >= n:
        return sorted_vals[-1]
    return sorted_vals[f] + (k - f) * (sorted_vals[c] - sorted_vals[f])


def _std(vals: list) -> float:
    """计算总体标准差"""
    if len(vals) < 2:
        return 0.0
    mean = sum(vals) / len(vals)
    variance = sum((v - mean) ** 2 for v in vals) / len(vals)
    return variance ** 0.5


def _avg_pct(vals: list) -> float:
    """将 Decimal/None 列表转为 float 并计算平均百分比"""
    floats = [float(v) for v in vals if v is not None]
    if not floats:
        return 0.0
    return sum(floats) / len(floats) * 100


def _format_period(start_date: Optional[date], end_date: Optional[date]) -> str:
    """格式化日期区间"""
    if start_date and end_date:
        return f"{start_date} ~ {end_date}"
    if start_date:
        return f"{start_date} ~ 至今"
    if end_date:
        return f"起始 ~ {end_date}"
    return "全部历史"

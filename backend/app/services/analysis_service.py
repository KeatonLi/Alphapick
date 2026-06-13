# backend/app/services/analysis_service.py
"""数据分析服务 - 对推荐记录进行多维度统计分析"""

from datetime import date, datetime
from typing import Optional

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


def get_weekday_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计每周各交易日的推荐效果

    返回每个交易日的推荐数量、胜率、平均收益、最大收益、最小收益。
    """
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "data": {},
            "summary": {"total_recommendations": 0, "best_weekday": "", "worst_weekday": ""},
        }

    # 按工作日分组
    weekday_returns: dict = {}
    for r in recs:
        if r.final_return_rate is None:
            continue
        wd = r.recommend_date.isoweekday()  # 1=周一 ... 7=周日
        if wd not in weekday_returns:
            weekday_returns[wd] = []
        weekday_returns[wd].append(float(r.final_return_rate))

    data = {}
    # WEEKDAY_NAMES uses MySQL dayofweek codes (2=周一...6=周五),
    # Python isoweekday() returns 1=周一...5=周五. Build a mapping.
    mysql_to_iso = {2: 1, 3: 2, 4: 3, 5: 4, 6: 5}
    for wd in WORKDAY_CODES:
        name = WEEKDAY_NAMES[wd]
        iso_wd = mysql_to_iso.get(wd, wd)
        returns = weekday_returns.get(iso_wd, [])
        if returns:
            count = len(returns)
            win_count = sum(1 for r in returns if r > 0)
            data[name] = {
                "count": count,
                "win_count": win_count,
                "win_rate": round(win_count / count, 3) if count > 0 else 0,
                "avg_return": round(sum(returns) / count, 4),
                "max_return": round(max(returns), 4),
                "min_return": round(min(returns), 4),
            }
        else:
            data[name] = {
                "count": 0,
                "win_count": 0,
                "win_rate": 0,
                "avg_return": 0,
                "max_return": 0,
                "min_return": 0,
            }

    # 找最佳和最差 weekday（按 win_rate 排序）
    weekdays_with_data = {k: v for k, v in data.items() if v["count"] > 0}
    if weekdays_with_data:
        best = max(weekdays_with_data.items(), key=lambda x: x[1]["win_rate"])
        worst = min(weekdays_with_data.items(), key=lambda x: x[1]["win_rate"])
        best_name = best[0]
        worst_name = worst[0]
    else:
        best_name = ""
        worst_name = ""

    return {
        "data": data,
        "summary": {
            "total_recommendations": len(recs),
            "best_weekday": best_name,
            "worst_weekday": worst_name,
        },
    }


def get_holding_period_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计不同持仓天数的收益表现

    分别看第1/2/3/5/7个交易日的收益率分布情况。
    """
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "data": {},
            "optimal_period": {"days": 0, "reason": "数据不足"},
        }

    period_map = {
        "1天": "return_rate_day1",
        "2天": "return_rate_day2",
        "3天": "return_rate_day3",
        "5天": "return_rate_day5",
        "7天": "return_rate_day7",
    }

    data = {}
    for period_name, field in period_map.items():
        returns = []
        for r in recs:
            val = getattr(r, field, None)
            if val is not None:
                returns.append(float(val))
        if not returns:
            continue
        n = len(returns)
        returns_sorted = sorted(returns)
        wins = sum(1 for v in returns if v > 0)
        data[period_name] = {
            "count": n,
            "avg_return": round(sum(returns) / n, 4),
            "win_rate": round(wins / n, 3),
            "median_return": round(_percentile(returns_sorted, 50), 4),
        }

    # 找最优持仓周期
    if data:
        best_period = max(data.items(), key=lambda x: x[1]["avg_return"])
        optimal_days = int(best_period[0].replace("天", ""))
        avg_ret_pct = best_period[1]["avg_return"] * 100
        win_pct = best_period[1]["win_rate"] * 100
        optimal_reason = (
            f"{best_period[0]}持仓平均收益最高（{avg_ret_pct:.1f}%），"
            f"胜率{win_pct:.1f}%"
        )
    else:
        optimal_days = 0
        optimal_reason = "数据不足"

    return {
        "data": data,
        "optimal_period": {"days": optimal_days, "reason": optimal_reason},
    }


def get_return_distribution(
    db: Session,
    holding_days: int = 3,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """获取指定持仓天数的收益分布直方图数据

    Args:
        holding_days: 持仓天数 (1, 2, 3, 5, 7)
        start_date: 起始日期
        end_date: 结束日期

    Returns:
        直方图的区间和计数，以及百分位数
    """
    q = _base_query(db, start_date, end_date)

    # 根据持仓天数选择对应的收益率字段
    field_map = {
        1: "return_rate_day1",
        2: "return_rate_day2",
        3: "return_rate_day3",
        5: "return_rate_day5",
        7: "return_rate_day7",
    }
    field = field_map.get(holding_days, "return_rate_day7")
    rate_col = getattr(Recommendation, field)

    q = q.filter(rate_col.isnot(None))
    recs = q.all()

    if not recs:
        return {"bins": [], "counts": [], "percentiles": {"p25": 0, "p50": 0, "p75": 0}}

    returns = [float(getattr(r, field)) for r in recs]

    # 构建直方图: 区间宽度 2%，从 -10% 到 15%
    bin_width = 0.02
    bins = []
    counts = []
    current = -0.10
    while current <= 0.15:
        lower = current
        upper = current + bin_width
        count = sum(1 for r in returns if lower <= r < upper)
        bins.append(f"{lower * 100:.0f}%")
        counts.append(count)
        current = upper

    # 计算百分位数
    sorted_returns = sorted(returns)
    n = len(sorted_returns)
    percentiles = {
        "p25": round(_percentile(sorted_returns, 25), 4),
        "p50": round(_percentile(sorted_returns, 50), 4),
        "p75": round(_percentile(sorted_returns, 75), 4),
    }

    return {"bins": bins, "counts": counts, "percentiles": percentiles}


def generate_insights(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """自动生成关键洞察

    基于统计数据，输出结构化的分析结论列表。
    """
    insights: list = []

    # --- 1. 整体表现 ---
    q = _base_query(db, start_date, end_date)
    recs = q.all()
    total = len(recs)

    if total == 0:
        return {
            "insights": [
                {
                    "type": "data",
                    "icon": "⚠️",
                    "title": "数据提示",
                    "content": "暂无已完成的推荐数据，无法生成洞察。",
                }
            ],
            "generated_at": datetime.now().isoformat(),
        }

    final_rates = [float(r.final_return_rate) for r in recs if r.final_return_rate is not None]
    win_count = sum(1 for r in final_rates if r > 0)
    win_rate = win_count / len(final_rates) * 100 if final_rates else 0
    avg_return = sum(final_rates) / len(final_rates) * 100 if final_rates else 0

    insights.append({
        "type": "overview",
        "icon": "📊",
        "title": "整体表现",
        "content": (
            f"统计周期内共完成 {total} 笔推荐，胜率 {win_rate:.1f}%，"
            f"平均收益率 {avg_return:+.2f}%。"
        ),
    })

    # --- 2. 最佳/最差交易日 ---
    weekday_result = get_weekday_stats(db, start_date, end_date)
    if weekday_result["data"]:
        best_name = weekday_result["summary"]["best_weekday"]
        worst_name = weekday_result["summary"]["worst_weekday"]
        if best_name and worst_name and best_name != worst_name:
            best_d = weekday_result["data"][best_name]
            worst_d = weekday_result["data"][worst_name]
            best_rate = best_d["win_rate"] * 100
            worst_rate = worst_d["win_rate"] * 100
            diff = best_rate - worst_rate
            insights.append({
                "type": "weekday",
                "icon": "📅",
                "title": "时间规律",
                "content": (
                    f"{best_name}推荐胜率最高（{best_rate:.1f}%），"
                    f"比{worst_name}高{diff:.1f}个百分点"
                ),
            })

    # --- 3. 持仓天数对比 ---
    holding_result = get_holding_period_stats(db, start_date, end_date)
    if holding_result["data"] and holding_result["optimal_period"]["days"] > 0:
        opt = holding_result["optimal_period"]
        insights.append({
            "type": "holding_period",
            "icon": "📈",
            "title": "持仓周期",
            "content": opt["reason"],
        })

        # 策略建议
        if opt["days"] < 7:
            insights.append({
                "type": "strategy",
                "icon": "💡",
                "title": "策略建议",
                "content": f"当前历史样本里 {opt['days']} 天窗口表现最好，可作为短线持仓重点观察周期。",
            })

    # --- 4. 收益波动 ---
    if len(final_rates) >= 5:
        std = _std(final_rates) * 100
        if std > 5:
            insights.append({
                "type": "volatility",
                "icon": "📉",
                "title": "收益波动",
                "content": f"收益波动较大（标准差 {std:.2f}%），建议关注风控。",
            })
        elif std < 2:
            insights.append({
                "type": "volatility",
                "icon": "📉",
                "title": "收益波动",
                "content": f"收益波动较小（标准差 {std:.2f}%），推荐稳定性较好。",
            })

    # --- 5. 极值提醒 ---
    max_gain_records = [r for r in recs if r.max_gain is not None and float(r.max_gain) > 0.05]
    if max_gain_records:
        insights.append({
            "type": "extreme",
            "icon": "🚀",
            "title": "高涨幅提醒",
            "content": (
                f"有 {len(max_gain_records)} 笔推荐盘中最高涨幅超过 5%，"
                f"平均最大涨幅 {_avg_pct([r.max_gain for r in max_gain_records]):+.2f}%。"
            ),
        })

    max_dd_records = [r for r in recs if r.max_drawdown is not None and float(r.max_drawdown) < -0.05]
    if max_dd_records:
        insights.append({
            "type": "extreme",
            "icon": "⚠️",
            "title": "高回撤提醒",
            "content": (
                f"有 {len(max_dd_records)} 笔推荐盘中最大回撤超过 5%，"
                f"平均最大回撤 {_avg_pct([r.max_drawdown for r in max_dd_records]):+.2f}%。"
            ),
        })

    # --- 6. 数据量提示 ---
    if total < 50:
        insights.append({
            "type": "data",
            "icon": "⚠️",
            "title": "数据提示",
            "content": f"当前仅有{total}条历史推荐数据，建议积累更多数据以获得更准确的分析结果",
        })

    return {
        "insights": insights,
        "generated_at": datetime.now().isoformat(),
    }


def get_price_range_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计不同价格区间的推荐效果

    按推荐价格分组：低价股 <10元、中价股 10-50元、高价股 >50元。
    返回每个区间的推荐数量、胜率、平均收益等指标。
    """
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "data": {},
            "summary": {
                "total_recommendations": 0,
                "best_range": "",
                "worst_range": "",
            },
        }

    # 按价格区间分组
    price_groups: dict = {"低价股": [], "中价股": [], "高价股": []}
    for r in recs:
        if r.recommend_price is None or r.final_return_rate is None:
            continue
        price = float(r.recommend_price)
        ret = float(r.final_return_rate)
        if price < 10:
            price_groups["低价股"].append(ret)
        elif price <= 50:
            price_groups["中价股"].append(ret)
        else:
            price_groups["高价股"].append(ret)

    data = {}
    for group_name, returns in price_groups.items():
        if returns:
            count = len(returns)
            win_count = sum(1 for r in returns if r > 0)
            data[group_name] = {
                "count": count,
                "win_count": win_count,
                "win_rate": round(win_count / count, 3),
                "avg_return": round(sum(returns) / count, 4),
                "max_return": round(max(returns), 4),
                "min_return": round(min(returns), 4),
            }
        else:
            data[group_name] = {
                "count": 0,
                "win_count": 0,
                "win_rate": 0,
                "avg_return": 0,
                "max_return": 0,
                "min_return": 0,
            }

    # 找最佳和最差价格区间
    ranges_with_data = {k: v for k, v in data.items() if v["count"] > 0}
    if ranges_with_data:
        best = max(ranges_with_data.items(), key=lambda x: x[1]["win_rate"])
        worst = min(ranges_with_data.items(), key=lambda x: x[1]["win_rate"])
        best_range = best[0]
        worst_range = worst[0]
    else:
        best_range = ""
        worst_range = ""

    return {
        "data": data,
        "summary": {
            "total_recommendations": len(recs),
            "best_range": best_range,
            "worst_range": worst_range,
        },
    }


def get_stock_type_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计不同股票代码类型的推荐效果

    按代码前缀分组：60开头（沪市主板）、002开头（中小板）、300/301开头（创业板）。
    """
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "data": {},
            "summary": {
                "total_recommendations": 0,
                "best_type": "",
                "worst_type": "",
            },
        }

    # 按代码前缀分组（注意：300/301 要先于 002，002 要先于 00 匹配）
    type_groups: dict = {"60主板": [], "00中小板": [], "300创业板": []}
    for r in recs:
        if r.stock_code is None or r.final_return_rate is None:
            continue
        code = r.stock_code.strip()
        ret = float(r.final_return_rate)
        if code.startswith("60"):
            type_groups["60主板"].append(ret)
        elif code.startswith("300") or code.startswith("301"):
            type_groups["300创业板"].append(ret)
        elif code.startswith("002"):
            type_groups["00中小板"].append(ret)

    data = {}
    for group_name, returns in type_groups.items():
        if returns:
            count = len(returns)
            win_count = sum(1 for r in returns if r > 0)
            data[group_name] = {
                "count": count,
                "win_count": win_count,
                "win_rate": round(win_count / count, 3),
                "avg_return": round(sum(returns) / count, 4),
                "max_return": round(max(returns), 4),
                "min_return": round(min(returns), 4),
            }
        else:
            data[group_name] = {
                "count": 0,
                "win_count": 0,
                "win_rate": 0,
                "avg_return": 0,
                "max_return": 0,
                "min_return": 0,
            }

    # 找最佳和最差类型
    types_with_data = {k: v for k, v in data.items() if v["count"] > 0}
    if types_with_data:
        best = max(types_with_data.items(), key=lambda x: x[1]["win_rate"])
        worst = min(types_with_data.items(), key=lambda x: x[1]["win_rate"])
        best_type = best[0]
        worst_type = worst[0]
    else:
        best_type = ""
        worst_type = ""

    return {
        "data": data,
        "summary": {
            "total_recommendations": len(recs),
            "best_type": best_type,
            "worst_type": worst_type,
        },
    }


def get_volatility_stats(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计收益波动性

    分析 max_gain 和 max_drawdown 的分布情况，衡量推荐的风险收益特征。
    """
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "data": {},
            "summary": {
                "total_recommendations": 0,
                "volatility_assessment": "数据不足",
            },
        }

    # 收集有效的 max_gain 和 max_drawdown
    gains = []
    drawdowns = []
    final_rates = []
    for r in recs:
        if r.max_gain is not None:
            gains.append(float(r.max_gain))
        if r.max_drawdown is not None:
            drawdowns.append(float(r.max_drawdown))
        if r.final_return_rate is not None:
            final_rates.append(float(r.final_return_rate))

    data: dict = {}

    if gains:
        n = len(gains)
        data["avg_max_gain"] = round(sum(gains) / n, 4)
        data["max_gain_std"] = round(_std(gains), 4)
        data["median_max_gain"] = round(_percentile(sorted(gains), 50), 4)
        data["gain_positive_rate"] = round(sum(1 for g in gains if g > 0) / n, 3)

    if drawdowns:
        n = len(drawdowns)
        data["avg_max_drawdown"] = round(sum(drawdowns) / n, 4)
        data["max_drawdown_std"] = round(_std(drawdowns), 4)
        data["median_max_drawdown"] = round(_percentile(sorted(drawdowns), 50), 4)

    if final_rates:
        n = len(final_rates)
        data["final_return_std"] = round(_std(final_rates), 4)

    # 波动性评估
    volatility_assessment = "数据不足"
    if data.get("max_gain_std") is not None and data.get("max_drawdown_std") is not None:
        gain_std = data.get("max_gain_std", 0)
        dd_std = data.get("max_drawdown_std", 0)
        if gain_std > 0.05 or dd_std > 0.05:
            volatility_assessment = "波动较大，风险较高"
        elif gain_std < 0.02 and dd_std < 0.02:
            volatility_assessment = "波动较小，收益稳定"
        else:
            volatility_assessment = "波动适中"

    return {
        "data": data,
        "summary": {
            "total_recommendations": len(recs),
            "volatility_assessment": volatility_assessment,
        },
    }


def get_success_trend(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """统计月度成功率趋势

    按月分组统计每月的推荐数量和胜率。
    """
    q = _base_query(db, start_date, end_date)
    recs = q.all()

    if not recs:
        return {
            "data": [],
            "summary": {
                "total_months": 0,
                "trend_direction": "数据不足",
                "best_month": "",
                "worst_month": "",
            },
        }

    # 按月分组
    monthly: dict = {}
    for r in recs:
        if r.final_return_rate is None:
            continue
        month_key = r.recommend_date.strftime("%Y-%m")
        if month_key not in monthly:
            monthly[month_key] = []
        monthly[month_key].append(float(r.final_return_rate))

    # 构建结果列表（按月份排序）
    result = []
    for month_key in sorted(monthly.keys()):
        returns = monthly[month_key]
        count = len(returns)
        win_count = sum(1 for r in returns if r > 0)
        result.append({
            "month": month_key,
            "count": count,
            "win_rate": round(win_count / count, 3) if count > 0 else 0,
            "avg_return": round(sum(returns) / count, 4) if count > 0 else 0,
        })

    # 趋势判断（用胜率的线性趋势）
    trend_direction = "数据不足"
    best_month = ""
    worst_month = ""

    if result:
        win_rates = [item["win_rate"] for item in result]
        best = max(result, key=lambda x: x["win_rate"])
        worst = min(result, key=lambda x: x["win_rate"])
        best_month = best["month"]
        worst_month = worst["month"]

        # 简单线性趋势：比较后半段平均胜率 vs 前半段
        mid = len(win_rates) // 2
        if mid > 0:
            first_half_avg = sum(win_rates[:mid]) / mid
            second_half_avg = sum(win_rates[mid:]) / len(win_rates[mid:])
            diff = second_half_avg - first_half_avg
            if diff > 0.05:
                trend_direction = "胜率上升"
            elif diff < -0.05:
                trend_direction = "胜率下降"
            else:
                trend_direction = "胜率平稳"

    return {
        "data": result,
        "summary": {
            "total_months": len(result),
            "trend_direction": trend_direction,
            "best_month": best_month,
            "worst_month": worst_month,
        },
    }


# ============ 辅助函数 ============


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

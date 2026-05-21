"""
图表生成服务
使用 matplotlib 生成 K 线图、MACD、KDJ 等技术图表
如果 matplotlib 不可用，则返回 chart config 数据供前端渲染
"""

import io
import base64
import json
from typing import List, Dict, Any, Optional

MATPLOTLIB_AVAILABLE = False
try:
    import matplotlib
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Rectangle
    matplotlib.use("Agg")
    MATPLOTLIB_AVAILABLE = True
except Exception:
    pass


def _configure_chinese_font():
    """配置中文字体"""
    if not MATPLOTLIB_AVAILABLE:
        return
    plt.rcParams["font.sans-serif"] = ["WenQuanYi Micro Hei", "SimHei", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False


def _to_chart_date(dates: List[str]) -> List:
    """Convert string dates to matplotlib date format"""
    if not MATPLOTLIB_AVAILABLE:
        return dates
    return mdates.datestr2num(dates)


def generate_kline_chart(
    dates: List[str],
    opens: List[float],
    highs: List[float],
    lows: List[float],
    closes: List[float],
    ma5: List[float],
    ma10: List[float],
    ma20: List[float],
) -> Optional[str]:
    """
    生成 K 线 + 均线图
    返回 base64 encoded PNG 或 None
    """
    if not MATPLOTLIB_AVAILABLE:
        return None
    _configure_chinese_font()

    fig, ax = plt.subplots(figsize=(10, 5), facecolor="white")
    ax.set_facecolor("#fafafa")

    chart_dates = _to_chart_date(dates)
    x = range(len(chart_dates))

    # K线：红涨绿跌
    for i in x:
        open_price = opens[i]
        close_price = closes[i]
        high_price = highs[i]
        low_price = lows[i]
        color = "#dc2626" if close_price >= open_price else "#16a34a"
        # 实体
        body_bottom = min(open_price, close_price)
        body_height = abs(close_price - open_price) or 0.1
        rect = Rectangle(
            (i - 0.35, body_bottom - body_height / 2),
            0.7, body_height,
            facecolor=color, edgecolor=color, linewidth=0.5
        )
        ax.add_patch(rect)
        # 上影线
        ax.plot([i, i], [high_price, body_bottom + body_height], color=color, linewidth=0.8)
        # 下影线
        ax.plot([i, i], [body_bottom - body_height / 2, low_price], color=color, linewidth=0.8)

    # 均线
    ax.plot(x, ma5, color="#eab308", linewidth=1.2, label="MA5")
    ax.plot(x, ma10, color="#a855f7", linewidth=1.2, label="MA10")
    ax.plot(x, ma20, color="#22c55e", linewidth=1.2, label="MA20")

    ax.set_xlim(-0.5, len(x) - 0.5)
    ax.set_xticks(x[:: max(1, len(x) // 6)])
    ax.set_xticklabels([dates[i] for i in range(0, len(dates), max(1, len(dates) // 6))], rotation=45, fontsize=8)
    ax.set_ylabel("价格")
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=80, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def generate_macd_chart(
    dates: List[str],
    dif: List[float],
    dea: List[float],
    macd: List[float],
) -> Optional[str]:
    """生成 MACD 指标图，返回 base64 PNG"""
    if not MATPLOTLIB_AVAILABLE:
        return None
    _configure_chinese_font()

    fig, ax = plt.subplots(figsize=(10, 2.5), facecolor="white")
    ax.set_facecolor("#fafafa")
    x = range(len(dates))

    # MACD柱（红绿）
    colors = ["#dc2626" if m >= 0 else "#16a34a" for m in macd]
    ax.bar(x, macd, color=colors, width=0.6, alpha=0.8)

    ax.plot(x, dif, color="#3b82f6", linewidth=1.2, label="DIF")
    ax.plot(x, dea, color="#f97316", linewidth=1.2, label="DEA")

    ax.set_xlim(-0.5, len(x) - 0.5)
    ax.set_xticks(x[:: max(1, len(x) // 6)])
    ax.set_xticklabels([dates[i] for i in range(0, len(dates), max(1, len(dates) // 6))], rotation=45, fontsize=8)
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(True, alpha=0.3, axis="y")
    ax.axhline(y=0, color="gray", linewidth=0.5)
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=80, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def generate_kdj_chart(
    dates: List[str],
    k: List[float],
    d: List[float],
    j: List[float],
) -> Optional[str]:
    """生成 KDJ 指标图，返回 base64 PNG"""
    if not MATPLOTLIB_AVAILABLE:
        return None
    _configure_chinese_font()

    fig, ax = plt.subplots(figsize=(10, 2.5), facecolor="white")
    ax.set_facecolor("#fafafa")
    x = range(len(dates))

    ax.plot(x, k, color="#ffffff", linewidth=1.2, label="K")
    ax.plot(x, d, color="#eab308", linewidth=1.2, label="D")
    ax.plot(x, j, color="#ef4444", linewidth=1.2, label="J")

    # 超买超卖线
    ax.axhline(y=80, color="gray", linewidth=0.5, linestyle="--", alpha=0.7)
    ax.axhline(y=20, color="gray", linewidth=0.5, linestyle="--", alpha=0.7)

    ax.set_xlim(-0.5, len(x) - 0.5)
    ax.set_ylim(-10, 110)
    ax.set_xticks(x[:: max(1, len(x) // 6)])
    ax.set_xticklabels([dates[i] for i in range(0, len(dates), max(1, len(dates) // 6))], rotation=45, fontsize=8)
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=80, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def generate_sector_chart(sectors: List[Dict[str, Any]]) -> Optional[str]:
    """
    生成板块涨跌幅排行横向柱状图
    sectors: [{"name": "板块名", "change_pct": 3.5}, ...]
    """
    if not MATPLOTLIB_AVAILABLE or not sectors:
        return None
    _configure_chinese_font()

    fig, ax = plt.subplots(figsize=(8, max(4, len(sectors) * 0.4)), facecolor="white")
    ax.set_facecolor("#fafafa")

    names = [s["name"][:8] for s in sectors]
    changes = [s["change_pct"] for s in sectors]
    colors = ["#dc2626" if c >= 0 else "#16a34a" for c in changes]

    y = range(len(names))
    ax.barh(y, changes, color=colors, height=0.6, alpha=0.85)
    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=9)
    ax.axvline(x=0, color="gray", linewidth=0.8)
    ax.set_xlabel("涨跌幅 (%)")
    ax.grid(True, alpha=0.3, axis="x")
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=80, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def generate_market_breadth_chart(breadth: Dict[str, int]) -> Optional[str]:
    """
    生成涨跌家数统计图
    breadth: {"up": 2847, "down": 1523, "flat": 342, "limit_up": 89, "limit_down": 23}
    """
    if not MATPLOTLIB_AVAILABLE:
        return None
    _configure_chinese_font()

    labels = ["涨停", "上涨", "平盘", "下跌", "跌停"]
    values = [breadth.get("limit_up", 0), breadth.get("up", 0),
              breadth.get("flat", 0), breadth.get("down", 0), breadth.get("limit_down", 0)]
    colors = ["#f97316", "#dc2626", "#9ca3af", "#16a34a", "#3b82f6"]

    fig, ax = plt.subplots(figsize=(6, 4), facecolor="white")
    ax.set_facecolor("#fafafa")
    bars = ax.bar(labels, values, color=colors, width=0.5, alpha=0.85)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 20,
                 str(val), ha="center", va="bottom", fontsize=9)
    ax.set_ylabel("家数")
    ax.grid(True, alpha=0.3, axis="y")
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=80, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def generate_all_charts(
    daily_data: List[Dict[str, Any]],
    sectors: List[Dict[str, Any]],
    breadth: Dict[str, int],
) -> Dict[str, Any]:
    """
    生成所有图表
    daily_data: [{"date", "open", "close", "high", "low", "volume"}, ...]
    返回 {"kline": base64_png, "macd": base64_png, "kdj": base64_png, ...} 或空 dict
    """
    if not MATPLOTLIB_AVAILABLE or not daily_data:
        return {}

    from app.services.indicator_service import compute_indicators

    indicators = compute_indicators(daily_data)
    dates = indicators.get("dates", [])
    if not dates:
        return {}

    closes = indicators["prices"]["close"]
    highs = indicators["prices"]["high"]
    lows = indicators["prices"]["low"]
    opens = closes  # use close as open approximation for simplicity

    ma5 = indicators["ma"]["ma5"]
    ma10 = indicators["ma"]["ma10"]
    ma20 = indicators["ma"]["ma20"]

    dif = indicators["macd"]["dif"]
    dea = indicators["macd"]["dea"]
    macd = indicators["macd"]["macd"]

    k = indicators["kdj"]["k"]
    d = indicators["kdj"]["d"]
    j_val = indicators["kdj"]["j"]

    return {
        "kline": generate_kline_chart(dates, opens, highs, lows, closes, ma5, ma10, ma20),
        "macd": generate_macd_chart(dates, dif, dea, macd),
        "kdj": generate_kdj_chart(dates, k, d, j_val),
        "sectors": generate_sector_chart(sectors[:10]),
        "market_breadth": generate_market_breadth_chart(breadth),
    }

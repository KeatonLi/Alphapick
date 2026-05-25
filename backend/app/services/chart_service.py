"""图表生成服务：matplotlib 生成图表，返回 Base64 编码的 PNG"""
import io
import base64
from typing import List, Dict, Any

MATPLOTLIB_AVAILABLE = False
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import numpy as np
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    pass


def _apply_rcparams():
    if not MATPLOTLIB_AVAILABLE:
        return
    plt.rcParams['figure.facecolor'] = 'white'
    plt.rcParams['axes.facecolor'] = 'white'
    plt.rcParams['axes.edgecolor'] = '#cccccc'
    plt.rcParams['axes.labelcolor'] = '#333333'
    plt.rcParams['xtick.color'] = '#666666'
    plt.rcParams['ytick.color'] = '#666666'
    plt.rcParams['axes.titlesize'] = 12
    plt.rcParams['axes.labelsize'] = 10
    plt.rcParams['axes.grid'] = True
    plt.rcParams['grid.alpha'] = 0.3
    plt.rcParams['grid.linestyle'] = '--'

    try:
        font_paths = fm.findSystemFonts()
        chinese_fonts = [f for f in font_paths if 'Hei' in f or 'hei' in f or 'Micro' in f or 'WenQuan' in f]
        if chinese_fonts:
            plt.rcParams['font.sans-serif'] = [chinese_fonts[0]] + plt.rcParams['font.sans-serif']
    except Exception:
        pass
    plt.rcParams['axes.unicode_minus'] = False


if MATPLOTLIB_AVAILABLE:
    _apply_rcparams()


def _to_base64(fig) -> str:
    """将 matplotlib Figure 转为 Base64 PNG 字符串"""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=100, facecolor='white')
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def _moving_average(series: np.ndarray, window: int) -> np.ndarray:
    """计算简单移动平均"""
    if len(series) < window:
        return np.full_like(series, np.nan)
    return np.convolve(series, np.ones(window) / window, mode='valid')


# ─── K 线 ────────────────────────────────────────────────────────────────────

def generate_kline_chart(
    dates: List[str],
    opens: List[float],
    highs: List[float],
    lows: List[float],
    closes: List[float],
    name: str = "上证指数",
) -> str:
    """生成 K 线 + MA5/10/20 图表，返回 Base64 字符串"""
    if not MATPLOTLIB_AVAILABLE:
        return ""
    fig, ax = plt.subplots(figsize=(10, 5))

    n = len(closes)
    x = np.arange(n)

    for i in range(n):
        color = '#e74c3c' if closes[i] >= opens[i] else '#27ae60'
        ax.plot([i, i], [lows[i], highs[i]], color=color, linewidth=0.8)
        ax.plot([i, i], [opens[i], closes[i]], color=color, linewidth=2.5)

    close_arr = np.array(closes)
    if n >= 5:
        ma5 = _moving_average(close_arr, 5)
        ma5_padded = np.concatenate([np.full(4, np.nan), ma5])
        ax.plot(x, ma5_padded, color='#f39c12', linewidth=1.2, label='MA5')
    if n >= 10:
        ma10 = _moving_average(close_arr, 10)
        ma10_padded = np.concatenate([np.full(9, np.nan), ma10])
        ax.plot(x, ma10_padded, color='#9b59b6', linewidth=1.2, label='MA10')
    if n >= 20:
        ma20 = _moving_average(close_arr, 20)
        ma20_padded = np.concatenate([np.full(19, np.nan), ma20])
        ax.plot(x, ma20_padded, color='#2ecc71', linewidth=1.2, label='MA20')

    ax.set_title(f'{name} K线走势', fontsize=14, fontweight='bold', color='#2c3e50')
    ax.set_xlabel('日期', color='#333')
    ax.set_ylabel('点位', color='#333')
    ax.legend(loc='upper left', framealpha=0.8)
    ax.set_xlim(-0.5, n - 0.5)

    tick_step = max(1, n // 8)
    tick_positions = list(range(0, n, tick_step))
    tick_labels = [dates[i] if i < len(dates) else '' for i in tick_positions]
    ax.set_xticks(tick_positions)
    ax.set_xticklabels(tick_labels, rotation=30, ha='right', fontsize=8)

    plt.tight_layout()
    result = _to_base64(fig)
    plt.close(fig)
    return result


# ─── MACD ────────────────────────────────────────────────────────────────────

def _calc_macd(closes: List[float], fast: int = 12, slow: int = 26, signal: int = 9):
    """计算 MACD: DIF, DEA, MACD 柱"""
    close_arr = np.array(closes)

    def ema(data, period):
        ema_arr = np.zeros_like(data)
        ema_arr[0] = data[0]
        k = 2 / (period + 1)
        for i in range(1, len(data)):
            ema_arr[i] = data[i] * k + ema_arr[i - 1] * (1 - k)
        return ema_arr

    ema_fast = ema(close_arr, fast)
    ema_slow = ema(close_arr, slow)
    dif = ema_fast - ema_slow
    dea = ema(dif, signal)
    macd_hist = (dif - dea) * 2
    return dif, dea, macd_hist


def generate_macd_chart(dates: List[str], closes: List[float], name: str = "MACD") -> str:
    """生成 MACD 图表，返回 Base64 字符串"""
    if not MATPLOTLIB_AVAILABLE:
        return ""
    dif, dea, macd_hist = _calc_macd(closes)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 5), gridspec_kw={'height_ratios': [2, 1]})

    n = len(dif)
    x = np.arange(n)

    ax1.plot(x, dif, color='#3498db', linewidth=1.2, label='DIF')
    ax1.plot(x, dea, color='#e67e22', linewidth=1.2, label='DEA')
    ax1.set_title(f'{name} MACD', fontsize=14, fontweight='bold', color='#2c3e50')
    ax1.legend(loc='upper left')
    ax1.set_xlim(-0.5, n - 0.5)

    colors = ['#e74c3c' if macd_hist[i] >= 0 else '#27ae60' for i in range(n)]
    ax2.bar(x, macd_hist, color=colors, width=0.7)
    ax2.axhline(0, color='#333', linewidth=0.5)
    ax2.set_title('MACD 柱', fontsize=11, color='#333')
    ax2.set_xlim(-0.5, n - 0.5)

    tick_step = max(1, n // 8)
    tick_positions = list(range(0, n, tick_step))
    tick_labels = [dates[i] if i < len(dates) else '' for i in tick_positions]
    for ax in (ax1, ax2):
        ax.set_xticks(tick_positions)
        ax.set_xticklabels(tick_labels, rotation=30, ha='right', fontsize=8)

    plt.tight_layout()
    result = _to_base64(fig)
    plt.close(fig)
    return result


# ─── KDJ ─────────────────────────────────────────────────────────────────────

def _calc_kdj(highs: List[float], lows: List[float], closes: List[float], n: int = 9):
    """计算 KDJ"""
    close_arr = np.array(closes)
    high_arr = np.array(highs)
    low_arr = np.array(lows)

    k = np.zeros(len(close_arr))
    d = np.zeros(len(close_arr))
    k[0] = 50.0
    d[0] = 50.0

    for i in range(1, len(close_arr)):
        period_high = high_arr[max(0, i - n + 1):i + 1]
        period_low = low_arr[max(0, i - n + 1):i + 1]
        rsv = (close_arr[i] - np.min(period_low)) / (np.max(period_high) - np.min(period_low) + 1e-9) * 100
        k[i] = 2 / 3 * k[i - 1] + 1 / 3 * rsv
        d[i] = 2 / 3 * d[i - 1] + 1 / 3 * k[i]

    j = 3 * k - 2 * d
    return k, d, j


def generate_kdj_chart(dates: List[str], highs: List[float], lows: List[float], closes: List[float], name: str = "KDJ") -> str:
    """生成 KDJ 图表，返回 Base64 字符串"""
    if not MATPLOTLIB_AVAILABLE:
        return ""
    k, d, j = _calc_kdj(highs, lows, closes)

    fig, ax = plt.subplots(figsize=(10, 3))
    n = len(k)
    x = np.arange(n)

    ax.plot(x, k, color='#ecf0f1', linewidth=1.2, label='K')
    ax.plot(x, d, color='#f1c40f', linewidth=1.2, label='D')
    ax.plot(x, j, color='#e74c3c', linewidth=1.2, label='J')
    ax.axhline(80, color='#e74c3c', linestyle='--', linewidth=0.8, alpha=0.6)
    ax.axhline(20, color='#27ae60', linestyle='--', linewidth=0.8, alpha=0.6)
    ax.fill_between(x, 80, 100, alpha=0.1, color='#e74c3c')
    ax.fill_between(x, 0, 20, alpha=0.1, color='#27ae60')

    ax.set_title(f'{name} KDJ', fontsize=14, fontweight='bold', color='#2c3e50')
    ax.legend(loc='upper left')
    ax.set_xlim(-0.5, n - 0.5)
    ax.set_ylim(-10, 110)

    tick_step = max(1, n // 8)
    tick_positions = list(range(0, n, tick_step))
    tick_labels = [dates[i] if i < len(dates) else '' for i in tick_positions]
    ax.set_xticks(tick_positions)
    ax.set_xticklabels(tick_labels, rotation=30, ha='right', fontsize=8)

    plt.tight_layout()
    result = _to_base64(fig)
    plt.close(fig)
    return result


# ─── 板块涨跌幅 ──────────────────────────────────────────────────────────────

def generate_sector_chart(sectors: List[dict]) -> str:
    """生成板块涨跌幅排行图表，返回 Base64 字符串"""
    if not MATPLOTLIB_AVAILABLE or not sectors:
        return ""
    sorted_sectors = sorted(sectors, key=lambda x: x.get('change_pct', 0), reverse=True)
    names = [s.get('name', '') for s in sorted_sectors]
    changes = [s.get('change_pct', 0) for s in sorted_sectors]
    colors = ['#e74c3c' if c >= 0 else '#27ae60' for c in changes]

    fig, ax = plt.subplots(figsize=(9, max(4, len(names) * 0.45)))
    y_pos = np.arange(len(names))
    ax.barh(y_pos, changes, color=colors, height=0.6)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(names, fontsize=10)
    ax.invert_yaxis()
    ax.set_xlabel('涨跌幅 (%)', color='#333')
    ax.set_title('板块涨跌幅排行', fontsize=14, fontweight='bold', color='#2c3e50')
    ax.axvline(0, color='#333', linewidth=0.8)

    for i, v in enumerate(changes):
        ax.text(v + 0.05 if v >= 0 else v - 0.05, i, f'{v:+.2f}%',
                va='center', ha='left' if v >= 0 else 'right', fontsize=9, color='#333')

    plt.tight_layout()
    result = _to_base64(fig)
    plt.close(fig)
    return result


# ─── 市场涨跌家数 ────────────────────────────────────────────────────────────

def generate_market_breadth_chart(breadth: Dict[str, int]) -> str:
    """生成市场涨跌家数统计图，返回 Base64 字符串"""
    if not MATPLOTLIB_AVAILABLE:
        return ""
    labels = ['涨停', '上涨', '平盘', '下跌', '跌停']
    values = [
        breadth.get("limit_up", 0),
        breadth.get("up", 0),
        breadth.get("flat", 0),
        breadth.get("down", 0),
        breadth.get("limit_down", 0),
    ]
    colors = ['#f97316', '#dc2626', '#9ca3af', '#16a34a', '#3b82f6']

    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(labels, values, color=colors, width=0.5)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 20,
                str(val), ha='center', va='bottom', fontsize=9)

    ax.set_title('市场涨跌家数', fontsize=14, fontweight='bold', color='#2c3e50')
    ax.set_ylabel('家数', color='#333')
    ax.set_ylim(0, max(values) * 1.1)

    plt.tight_layout()
    result = _to_base64(fig)
    plt.close(fig)
    return result


# ─── 指数对比 ────────────────────────────────────────────────────────────────

def generate_index_comparison_chart(indices: List[dict]) -> str:
    """生成指数对比柱状图，返回 Base64 字符串"""
    if not MATPLOTLIB_AVAILABLE or not indices:
        return ""
    names = [idx.get('name', '') for idx in indices]
    changes = [idx.get('change_pct', 0) for idx in indices]
    colors = ['#e74c3c' if c >= 0 else '#27ae60' for c in changes]

    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(names, changes, color=colors, width=0.5)
    for bar, val in zip(bars, changes):
        y_pos = bar.get_height() + 0.05 if val >= 0 else bar.get_height() - 0.15
        ax.text(bar.get_x() + bar.get_width() / 2, y_pos,
                f'{val:+.2f}%', ha='center', va='bottom' if val >= 0 else 'top',
                fontsize=11, fontweight='bold', color='#333')

    ax.set_title('主要指数涨跌对比', fontsize=14, fontweight='bold', color='#2c3e50')
    ax.set_ylabel('涨跌幅 (%)', color='#333')
    ax.axhline(0, color='#333', linewidth=0.8)
    plt.xticks(fontsize=10)
    plt.tight_layout()
    result = _to_base64(fig)
    plt.close(fig)
    return result


# ─── 一键生成所有图表 ────────────────────────────────────────────────────────

def generate_all_charts(
    daily_data: List[Dict[str, Any]],
    sectors: List[Dict[str, Any]],
    breadth: Dict[str, int],
) -> Dict[str, Any]:
    """
    生成所有图表：K线、MACD、KDJ、板块排行、涨跌家数
    daily_data: [{"date", "open", "close", "high", "low", "volume"}, ...]
    返回 {"kline": base64, "macd": base64, ...} 或空 dict
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
    opens = closes

    return {
        "kline": generate_kline_chart(dates, opens, highs, lows, closes),
        "macd": generate_macd_chart(dates, closes),
        "kdj": generate_kdj_chart(dates, highs, lows, closes),
        "sectors": generate_sector_chart(sectors[:10]),
        "market_breadth": generate_market_breadth_chart(breadth),
    }

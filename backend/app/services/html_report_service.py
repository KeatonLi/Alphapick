"""HTML 报告生成服务：使用 Jinja2 模板 + Base64 图表生成完整 HTML 市场报告"""
from datetime import date
from pathlib import Path
from typing import List, Optional

import akshare as ak
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.services.chart_service import (
    generate_kline_chart,
    generate_macd_chart,
    generate_kdj_chart,
    generate_sector_chart,
    generate_market_breadth_chart,
    generate_index_comparison_chart,
)

# HTML 报告存储目录
REPORTS_DIR = Path(__file__).parent.parent.parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def _get_index_daily(code: str, days: int = 60) -> dict:
    """获取指数日线数据，返回 KDJ 所需要的 highs/lows/closes"""
    try:
        df = ak.stock_zh_index_daily(symbol=code)
        df = df.tail(days)
        return {
            "dates": [str(d) for d in df["date"].tolist()],
            "opens": [float(o) for o in df["open"].tolist()],
            "highs": [float(h) for h in df["high"].tolist()],
            "lows": [float(l) for l in df["low"].tolist()],
            "closes": [float(c) for c in df["close"].tolist()],
        }
    except Exception:
        return {"dates": [], "opens": [], "highs": [], "lows": [], "closes": []}


async def get_market_breadth() -> dict:
    """获取市场广度：上涨/下跌/平盘家数"""
    try:
        df = ak.stock_zh_a_spot()
        up = int(df[df["涨跌幅"] > 0].shape[0])
        down = int(df[df["涨跌幅"] < 0].shape[0])
        flat = int(df[df["涨跌幅"] == 0].shape[0])

        # 涨停跌停
        limit_up = int(df[df["涨跌幅"] >= 9.5].shape[0])
        limit_down = int(df[df["涨跌幅"] <= -9.5].shape[0])

        return {"up": up, "down": down, "flat": flat, "limit_up": limit_up, "limit_down": limit_down}
    except Exception:
        return {"up": 0, "down": 0, "flat": 0, "limit_up": 0, "limit_down": 0}


async def get_main_index_data() -> List[dict]:
    """获取三大指数的日线数据（用于生成 K 线图）"""
    indices = [
        ("sh000001", "上证指数"),
        ("sz399001", "深证成指"),
        ("sz399006", "创业板指"),
    ]
    results = []
    for code, name in indices:
        data = _get_index_daily(code, 60)
        if data["closes"]:
            results.append({
                "code": code,
                "name": name,
                "dates": data["dates"],
                "opens": data["opens"],
                "highs": data["highs"],
                "lows": data["lows"],
                "closes": data["closes"],
            })
    return results


def _render_html_report(
    date_str: str,
    market_summary: str,
    indices: List[dict],
    sectors: List[dict],
    market_breadth: dict,
    ai_report: str,
    charts: dict,
) -> str:
    """用 Jinja2 模板渲染 HTML 报告"""
    templates_dir = Path(__file__).parent.parent / "templates"
    env = Environment(
        loader=FileSystemLoader(str(templates_dir)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    template = env.get_template("market_report.html")

    return template.render(
        date=date_str,
        market_summary=market_summary,
        indices=indices,
        sectors=sectors,
        market_breadth=market_breadth,
        ai_report=ai_report,
        charts=charts,
    )


async def generate_html_report(
    report_date: date,
    market_summary: str,
    index_data: List[dict],
    sectors: List[dict],
    ai_report: str,
) -> str:
    """
    生成完整的 HTML 市场报告文件，返回文件路径。
    """
    date_str = str(report_date)
    output_path = REPORTS_DIR / f"market_report_{date_str}.html"

    # 如果已存在，直接返回
    if output_path.exists():
        return str(output_path)

    # 生成图表
    chart_tasks = {}

    # K 线图（用上证指数）
    sh_data = None
    for idx in index_data:
        if "sh000001" in idx.get("code", ""):
            sh_data = idx
            break
    if sh_data is None:
        # 取第一个指数
        sh_data = index_data[0] if index_data else None

    if sh_data:
        daily_data = _get_index_daily("sh000001", 60)
        if daily_data["closes"]:
            chart_tasks["kline"] = generate_kline_chart(
                dates=daily_data["dates"],
                opens=daily_data["opens"],
                highs=daily_data["highs"],
                lows=daily_data["lows"],
                closes=daily_data["closes"],
                name="上证指数",
            )
            chart_tasks["macd"] = generate_macd_chart(
                dates=daily_data["dates"],
                closes=daily_data["closes"],
                name="上证指数",
            )
            chart_tasks["kdj"] = generate_kdj_chart(
                dates=daily_data["dates"],
                highs=daily_data["highs"],
                lows=daily_data["lows"],
                closes=daily_data["closes"],
                name="上证指数",
            )
    else:
        chart_tasks["kline"] = ""
        chart_tasks["macd"] = ""
        chart_tasks["kdj"] = ""

    # 板块图
    chart_tasks["sectors"] = generate_sector_chart(sectors)

    # 市场广度
    mb = await get_market_breadth()
    chart_tasks["market_breadth"] = generate_market_breadth_chart(
        up=mb["up"], down=mb["down"], flat=mb["flat"]
    )
    # 指数对比
    chart_tasks["index_comparison"] = generate_index_comparison_chart(index_data)

    # 渲染 HTML
    html_content = _render_html_report(
        date_str=date_str,
        market_summary=market_summary,
        indices=index_data,
        sectors=sectors,
        market_breadth=mb,
        ai_report=ai_report,
        charts=chart_tasks,
    )

    # 写入文件
    output_path.write_text(html_content, encoding="utf-8")
    return str(output_path)


def get_html_report_path(report_date: date) -> Optional[str]:
    """获取指定日期 HTML 报告的路径，若不存在返回 None"""
    date_str = str(report_date)
    path = REPORTS_DIR / f"market_report_{date_str}.html"
    return str(path) if path.exists() else None


def read_html_report(path: str) -> Optional[str]:
    """读取 HTML 报告内容"""
    try:
        return Path(path).read_text(encoding="utf-8")
    except Exception:
        return None

import json

from app.utils.akshare_utils import get_stock_info, get_stock_daily
from app.utils.ai_client import chat

STOCK_ANALYSIS_PROMPT = """你是一位专业的A股分析师。请根据以下股票数据进行全面分析，输出结构化的分析报告。

分析维度：
1. **基本面概况**：公司主营业务、行业地位
2. **近期走势分析**：根据日线数据分析近期趋势、支撑压力位
3. **技术指标信号**：结合成交量和价格变动给出技术面判断
4. **风险提示**：需要注意的风险因素
5. **综合评级**：给出 1-5 星的评级和操作建议

请用专业但易懂的语言输出，格式清晰。"""


async def analyze_stock(code: str) -> dict:
    info_result = await get_stock_info(code)
    daily_result = await get_stock_daily(code, days=60)

    if not info_result["success"]:
        return {"success": False, "error": f"获取股票信息失败: {info_result['error']}"}
    if not daily_result["success"]:
        return {"success": False, "error": f"获取行情数据失败: {daily_result['error']}"}

    stock_info = info_result["data"]
    daily_data = daily_result["data"]

    recent_data = daily_data[-20:] if len(daily_data) > 20 else daily_data
    daily_summary = []
    for d in recent_data:
        daily_summary.append({
            "日期": d.get("日期", ""),
            "开盘": d.get("开盘", ""),
            "收盘": d.get("收盘", ""),
            "最高": d.get("最高", ""),
            "最低": d.get("最低", ""),
            "成交量": d.get("成交量", ""),
            "涨跌幅": d.get("涨跌幅", ""),
        })

    user_message = f"""
股票基本信息：
{json.dumps(stock_info, ensure_ascii=False, indent=2)}

近20个交易日行情：
{json.dumps(daily_summary, ensure_ascii=False, indent=2)}

请对这个股票进行全面分析。
"""

    ai_response = await chat([
        {"role": "system", "content": STOCK_ANALYSIS_PROMPT},
        {"role": "user", "content": user_message},
    ])

    return {
        "success": True,
        "data": {
            "code": code,
            "analysis": ai_response,
            "stock_info": stock_info,
            "recent_daily": daily_summary,
        },
    }

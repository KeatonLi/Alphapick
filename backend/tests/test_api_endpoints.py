"""
AKShare + 直连API 接口连通性测试（完整版）
覆盖所有 A 股相关接口 + 当前项目直连接口 + 雪球备选

运行: python test_api_endpoints.py
输出: ✅ 可通 / ❌ 不通 / ⚠️ 异常

注意：
  - 带 _em 后缀 = 东方财富数据源
  - 带 _ths 后缀 = 同花顺数据源
  - 带 _sina / _tx 后缀 = 新浪 / 腾讯
  - 无后缀 / 混合 = 不确定上游
"""

import time
import json
import sys
from datetime import date, timedelta
from typing import Optional

import requests
import pandas as pd


# ─── 工具 ────────────────────────────────────────────────────────────────

OK = "✅"
FAIL = "❌"
WARN = "⚠️"
SKIP = "⏭️"

stats = {"ok": 0, "fail": 0, "warn": 0, "skip": 0}


def log(name: str, status: str, detail: str = ""):
    icon = {"ok": OK, "fail": FAIL, "warn": WARN, "skip": SKIP}[status]
    stats[status] += 1
    print(f"  {icon} {name}")
    if detail:
        print(f"      → {detail}")


def section(title: str):
    print(f"\n{'='*65}")
    print(f" {title}")
    print(f"{'='*65}\n")


# ─── 辅助 ────────────────────────────────────────────────────────────────

def _to_tencent_code(code: str) -> str:
    code = str(code).strip()
    if code.startswith(("sz", "sh", "bj")):
        return code
    if code.startswith(("0", "3")):
        return f"sz{code}"
    elif code.startswith("6"):
        return f"sh{code}"
    elif code.startswith(("4", "8")):
        return f"bj{code}"
    return f"sz{code}"


TEST_CODES = ["600519", "000001", "300750", "000333", "601318"]
TODAY = date.today().strftime("%Y-%m-%d")


# ====================================================================
# 一、AKShare 函数测试（按分类）
# ====================================================================

def test_akshare_import():
    name = "[导入] akshare 库"
    try:
        import akshare as ak
        log(name, "ok", f"版本 {ak.__version__}")
        return ak
    except Exception as e:
        log(name, "fail", str(e))
        return None


# ─── 1.1 市场总貌 ────────────────────────────────────────────────────

def test_market_summary(ak):
    section("1.1 市场总貌")

    tests = [
        ("stock_sse_summary",      "上交所市场总貌",          lambda: ak.stock_sse_summary()),
        ("stock_szse_summary",     "深交所统计(20250529)",    lambda: ak.stock_szse_summary(date="20250529")),
        ("stock_szse_area_summary","深交所地区成交排行",      lambda: ak.stock_szse_area_summary(date="20250529")),
        ("stock_szse_sector_summary","深交所行业成交",        lambda: ak.stock_szse_sector_summary(symbol="1", date="20250529")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[市场] {name} {desc}", "ok", f"返回 {len(df)} 行")
            else:
                log(f"[市场] {name} {desc}", "warn", "返回空数据")
        except Exception as e:
            log(f"[市场] {name} {desc}", "fail", str(e)[:80])


# ─── 1.2 股票名录 ────────────────────────────────────────────────────

def test_stock_listing(ak):
    section("1.2 股票名录")

    tests = [
        ("stock_info_a_code_name",   "全部A股代码简称",         lambda: ak.stock_info_a_code_name()),
        ("stock_info_sh_name_code",  "上交所主板",             lambda: ak.stock_info_sh_name_code(symbol="主板A股")),
        ("stock_info_sz_name_code",  "深交所主板",             lambda: ak.stock_info_sz_name_code(symbol="A股列表")),
        ("stock_info_bj_name_code",  "北交所",                 lambda: ak.stock_info_bj_name_code()),
        ("stock_individual_info_em", "个股基础信息(600519)",     lambda: ak.stock_individual_info_em(symbol="600519")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            ok = df is not None and ((isinstance(df, pd.DataFrame) and not df.empty) or isinstance(df, (dict, list)))
            if ok:
                n = len(df) if hasattr(df, '__len__') else 'ok'
                log(f"[名录] {name} {desc}", "ok", f"返回 {n}")
            else:
                log(f"[名录] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[名录] {name} {desc}", "fail", str(e)[:80])


# ─── 1.3 实时行情 ────────────────────────────────────────────────────

def test_real_time_quotes(ak):
    section("1.3 实时行情")

    tests = [
        ("stock_zh_a_spot",     "A股实时(新浪)",       lambda: ak.stock_zh_a_spot()),
        ("stock_zh_a_spot_em",  "A股实时(东财)",       lambda: ak.stock_zh_a_spot_em()),
        ("stock_sh_a_spot_em",  "沪A实时(东财)",       lambda: ak.stock_sh_a_spot_em()),
        ("stock_sz_a_spot_em",  "深A实时(东财)",       lambda: ak.stock_sz_a_spot_em()),
        ("stock_bj_a_spot_em",  "京A实时(东财)",       lambda: ak.stock_bj_a_spot_em()),
        ("stock_kc_a_spot_em",  "科创板实时(东财)",     lambda: ak.stock_kc_a_spot_em()),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[行情] {name} {desc}", "ok", f"返回 {len(df)} 条")
            else:
                log(f"[行情] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[行情] {name} {desc}", "fail", str(e)[:80])


# ─── 1.4 历史行情 ────────────────────────────────────────────────────

def test_historical_quotes(ak):
    section("1.4 历史行情")

    tests = [
        ("stock_zh_a_hist",     "日线(东财,600519,30d)",  lambda: ak.stock_zh_a_hist(symbol="600519", period="daily", start_date="20250501", end_date=TODAY, adjust="qfq")),
        ("stock_zh_a_daily",    "日线(新浪,sh600519)",    lambda: ak.stock_zh_a_daily(symbol="sh600519", adjust="qfq")),
        ("stock_zh_index_daily","指数(上证sh000001)",      lambda: ak.stock_zh_index_daily(symbol="sh000001")),
        ("stock_zh_a_minute",   "分时(600519)",           lambda: ak.stock_zh_a_minute(symbol="600519", period="1", start_date="2025-05-28", end_date="2025-05-29")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[历史] {name} {desc}", "ok", f"返回 {len(df)} 行")
            else:
                log(f"[历史] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[历史] {name} {desc}", "fail", str(e)[:80])


# ─── 1.5 板块 ────────────────────────────────────────────────────────

def test_sectors(ak):
    section("1.5 板块数据")

    tests = [
        ("stock_board_industry_summary_ths", "行业板块涨跌(同花顺)",    lambda: ak.stock_board_industry_summary_ths()),
        ("stock_board_industry_name_em",     "行业板块列表(东财)",      lambda: ak.stock_board_industry_name_em()),
        ("stock_board_concept_name_em",      "概念板块列表(东财)",      lambda: ak.stock_board_concept_name_em()),
        ("stock_board_industry_cons_em",     "行业板块成份(东财,银行)", lambda: ak.stock_board_industry_cons_em(symbol="银行")),
        ("stock_board_concept_cons_em",      "概念板块成份(东财)",      lambda: ak.stock_board_concept_cons_em(symbol="锂电池")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[板块] {name} {desc}", "ok", f"返回 {len(df)} 行")
            else:
                log(f"[板块] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[板块] {name} {desc}", "fail", str(e)[:80])


# ─── 1.6 选股 / 排行 / 涨停 ─────────────────────────────────────────

def test_stock_picking(ak):
    section("1.6 选股/排行/涨停板")

    tests = [
        ("stock_rank_lxsz_ths",       "理想选股(同花顺)",               lambda: ak.stock_rank_lxsz_ths()),
        ("stock_rank_cxg_ths",        "持续强势股(同花顺)",             lambda: ak.stock_rank_cxg_ths()),
        ("stock_zt_pool_em",          "涨停板池(东财)",                 lambda: ak.stock_zt_pool_em(date=TODAY)),
        ("stock_zt_pool_zb_em",       "炸板池(东财)",                   lambda: ak.stock_zt_pool_zb_em(date=TODAY)),
        ("stock_zt_pool_strong_em",   "强势股池(东财)",                 lambda: ak.stock_zt_pool_strong_em(date=TODAY)),
        ("stock_zt_pool_dt_em",       "跌停板池(东财)",                 lambda: ak.stock_zt_pool_dt_em(date=TODAY)),
        ("stock_zt_pool_old_em",      "昨日涨停板池(东财)",             lambda: ak.stock_zt_pool_old_em(date=TODAY)),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[选股] {name} {desc}", "ok", f"返回 {len(df)} 条")
            else:
                log(f"[选股] {name} {desc}", "warn", "返回空(可能今日无数据)")
        except Exception as e:
            log(f"[选股] {name} {desc}", "fail", str(e)[:80])


# ─── 1.7 资金流向 ────────────────────────────────────────────────────

def test_fund_flow(ak):
    section("1.7 资金流向")

    tests = [
        ("stock_individual_fund_flow",    "个股资金流(新浪,600519)",    lambda: ak.stock_individual_fund_flow(stock="600519", market="sh")),
        ("stock_market_fund_flow_em",     "市场资金流(东财)",           lambda: ak.stock_market_fund_flow_em()),
        ("stock_sector_fund_flow_em",     "板块资金流(东财)",           lambda: ak.stock_sector_fund_flow_em(indicator="今日")),
        ("stock_individual_fund_flow_em", "个股资金流(东财,600519)",    lambda: ak.stock_individual_fund_flow_em(symbol="600519", market="sh")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[资金] {name} {desc}", "ok", f"返回 {len(df)} 行")
            else:
                log(f"[资金] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[资金] {name} {desc}", "fail", str(e)[:80])


# ─── 1.8 财务数据 ────────────────────────────────────────────────────

def test_financial(ak):
    section("1.8 财务数据")

    tests = [
        ("stock_financial_abstract_ths",               "业绩快报(600519,ths)", lambda: ak.stock_financial_abstract_ths(stock="600519")),
        ("stock_financial_profit_by_report_em",        "利润表(东财,600519)", lambda: ak.stock_financial_profit_by_report_em(symbol="600519")),
        ("stock_financial_balance_sheet_by_report_em", "资产负债表(600519)",  lambda: ak.stock_financial_balance_sheet_by_report_em(symbol="600519")),
        ("stock_financial_cash_flow_by_report_em",     "现金流量表(600519)",  lambda: ak.stock_financial_cash_flow_by_report_em(symbol="600519")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[财务] {name} {desc}", "ok", f"返回 {len(df)} 行")
            else:
                log(f"[财务] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[财务] {name} {desc}", "fail", str(e)[:80])


# ─── 1.9 沪深港通 ────────────────────────────────────────────────────

def test_hsgt(ak):
    section("1.9 沪深港通")

    tests = [
        ("stock_hsgt_hist_em",     "沪深港通历史(沪股通)", lambda: ak.stock_hsgt_hist_em(symbol="沪股通")),
        ("stock_hsgt_fund_flow_em","沪深港通资金流(南向)", lambda: ak.stock_hsgt_fund_flow_em(symbol="南向")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[港股通] {name} {desc}", "ok", f"返回 {len(df)} 行")
            else:
                log(f"[港股通] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[港股通] {name} {desc}", "fail", str(e)[:80])


# ─── 1.10 交易日历 + 其他工具 ────────────────────────────────────────

def test_utils(ak):
    section("1.10 交易日历 & 工具")

    tests = [
        ("tool_trade_date_hsiec",   "交易日历(深交所)",    lambda: ak.tool_trade_date_hsiec()),
        ("tool_trade_date_hist_sina","交易日历(新浪,2024)", lambda: ak.tool_trade_date_hist_sina(year="2024")),
    ]
    for name, desc, fn in tests:
        try:
            df = fn()
            if df is not None and not df.empty:
                log(f"[工具] {name} {desc}", "ok", f"返回 {len(df)} 行")
            else:
                log(f"[工具] {name} {desc}", "warn", "返回空")
        except Exception as e:
            log(f"[工具] {name} {desc}", "fail", str(e)[:80])


# ====================================================================
# 二、直连 HTTP API 测试
# ====================================================================

def test_http_apis():
    section("二、直连 HTTP API")

    # ── 2.1 腾讯 ──
    name = "[HTTP] 腾讯 qt.gtimg.cn 批量行情"
    try:
        codes = [_to_tencent_code(c) for c in TEST_CODES]
        url = f"https://qt.gtimg.cn/q={','.join(codes)}"
        r = requests.get(url, headers={
            "Referer": "https://finance.qq.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }, timeout=15)
        r.raise_for_status()
        n = len([l for l in r.text.strip().split("\n") if "~\"" in l])
        log(name, "ok", f"返回 {n} 只行情数据")
    except Exception as e:
        log(name, "fail", str(e)[:80])

    # ── 2.2 东财数据中心 ──
    name = "[HTTP] 东财 datacenter 股票列表(10条)"
    try:
        url = ("https://datacenter.eastmoney.com/api/data/v1/get"
               "?reportName=RPT_F10_ORG_BASICINFO"
               "&columns=SECURITY_CODE,SECURITY_NAME_ABBR"
               "&pageSize=10&pageNumber=1&source=HSF10&client=PC")
        r = requests.get(url, headers={"Referer": "https://data.eastmoney.com", "User-Agent": "Mozilla/5.0"}, timeout=15)
        r.raise_for_status()
        items = r.json().get("result", {}).get("data", [])
        log(name, "ok", f"返回 {len(items)} 条")
    except Exception as e:
        log(name, "fail", str(e)[:80])

    # ── 2.3 东财热度排名 ──
    name = "[HTTP] 东财 push2 热度排名(前10)"
    try:
        url = "https://push2.eastmoney.com/api/qt/clist/get"
        params = {'pn': 1, 'pz': 10, 'po': 1, 'np': 1, 'fields': 'f12,f14,f2,f3,f62', 'fid': 'f62',
                  'fs': 'm:0+t:6+f:!2,m:0+t:80+f:!2,m:1+t:2+f:!2,m:1+t:23+f:!2'}
        r = requests.get(url, params=params, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/'}, timeout=15)
        r.raise_for_status()
        items = r.json().get('data', {}).get('diff', [])
        log(name, "ok", f"返回 {len(items)} 条")
    except Exception as e:
        log(name, "fail", str(e)[:80])

    # ── 2.4 东财个股新闻 ──
    name = "[HTTP] 东财 search-api-web 个股新闻(000001)"
    try:
        url = "http://search-api-web.eastmoney.com/search/jsonp"
        params = {
            "cb": "jQuery",
            "param": json.dumps({
                "uid": "", "keyword": "000001", "type": ["cmsArticleWebOld"],
                "client": "web", "clientType": "web", "clientVersion": "current",
                "param": {"cmsArticleWebOld": {"searchScope": "default", "sort": "default", "pageIndex": 1, "pageSize": 3}}
            })
        }
        r = requests.get(url, params=params, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.eastmoney.com/'}, timeout=15)
        data = json.loads(r.text.strip('jQuery(').rstrip(')'))
        items = data.get('result', {}).get('cmsArticleWebOld', [])
        log(name, "ok", f"返回 {len(items)} 条新闻")
    except Exception as e:
        log(name, "fail", str(e)[:80])

    # ── 2.5 腾讯板块行情 ──
    name = "[HTTP] 腾讯 proxy.finance 板块排行"
    try:
        url = "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/views/windowRank.php"
        r = requests.get(url, params={"type": "1", "market": "0", "offset": 0, "count": 10},
                         headers={"Referer": "https://finance.qq.com", "User-Agent": "Mozilla/5.0"}, timeout=15)
        data = r.json()
        code = data.get("code", -1)
        log(name, "ok" if code == 0 else "warn", f"code={code}, data_keys={list(data.keys())}")
    except Exception as e:
        log(name, "fail", str(e)[:80])


# ====================================================================
# 三、雪球备选 API
# ====================================================================

def test_xueqiu():
    section("三、雪球 API（备选方案）")

    # 注意: 雪球很多接口需要 Cookie（访问首页获取），这里只测试直连
    tests = [
        ("批量行情",    "https://stock.xueqiu.com/v5/stock/batch/quote.json",
         {"symbol": "SH600519,SZ000001,SZ300750", "extend": "detail"}),
        ("热度排名",    "https://xueqiu.com/service/v5/stock/rank",
         {"order": "desc", "page": 1, "size": 10}),
        ("个股详情",    "https://stock.xueqiu.com/v5/stock/quote.json",
         {"symbol": "SH600519", "extend": "detail"}),
        ("K线数据",     "https://stock.xueqiu.com/v5/stock/chart/kline.json",
         {"symbol": "SH600519", "begin": int(time.time() - 86400*30), "period": "day", "type": "before", "count": -30}),
    ]

    for desc, url, params in tests:
        name = f"[雪球] {desc}"
        try:
            r = requests.get(url, params=params, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }, timeout=15)
            if r.status_code == 200:
                data = r.json()
                log(name, "ok", f"HTTP 200, response: {str(data)[:120]}")
            else:
                log(name, "warn", f"HTTP {r.status_code} (可能需要 Cookie 或 Cookie 过期)")
        except Exception as e:
            log(name, "fail", str(e)[:80])


# ====================================================================
# 四、其他备选：Sina / Sohu / 新浪财经
# ====================================================================

def test_others():
    section("四、其他备选 & 腾讯直连")

    # ── 4.1 腾讯全量股票列表 ──
    name = "[其他] 腾讯板块/股票列表 ifzqgtimg"
    try:
        url = "https://ifzqgtimg.applinzi.com/stock/rank"
        r = requests.get(url, timeout=15)
        log(name, "ok" if r.status_code == 200 else "warn", f"HTTP {r.status_code}")
    except Exception as e:
        log(name, "fail", str(e)[:80])

    # ── 4.2 新浪全量股票 ──
    name = "[其他] 新浪 stocklist (sh)"
    try:
        url = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"
        params = {"page": 1, "num": 10, "sort": "code", "asc": 1, "node": "sh_a", "symbol": "", "_s_r_a": "init"}
        r = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.sina.com.cn"}, timeout=15)
        data = r.json()
        log(name, "ok" if data else "warn", f"返回 {len(data) if isinstance(data, list) else 0} 条")
    except Exception as e:
        log(name, "fail", str(e)[:80])

    # ── 4.3 新浪实时批量 ──
    name = "[其他] 新浪 hq.sinajs.cn 批量行情"
    try:
        codes = ["sh600519", "sz000001", "sz300750"]
        url = f"https://hq.sinajs.cn/list={','.join(codes)}"
        r = requests.get(url, headers={"Referer": "https://finance.sina.com.cn", "User-Agent": "Mozilla/5.0"}, timeout=15)
        r.encoding = "gbk"
        log(name, "ok", f"返回 {len(r.text.split(';'))} 条")
    except Exception as e:
        log(name, "fail", str(e)[:80])


# ====================================================================
# 主流程
# ====================================================================

def run_all():
    print(f"\n{'='*65}")
    print(f"  AKShare 接口连通性测试（完整版）")
    print(f"  测试日期: {TODAY}")
    print(f"  共计: 市场总貌 / 股票名录 / 实时行情 / 历史行情 / 板块")
    print(f"        选股排行 / 资金流向 / 财务 / 沪深港通 / 工具")
    print(f"        直连HTTP / 雪球 / 其他备选")
    print(f"{'='*65}\n")

    # ── 一、AKShare ──
    section("一、AKShare 函数测试（10个分类）")
    ak = test_akshare_import()
    if ak is None:
        print("\n⚠️   akshare 未安装。跳过所有 AKShare 测试。\n")
    else:
        test_market_summary(ak)
        test_stock_listing(ak)
        test_real_time_quotes(ak)
        test_historical_quotes(ak)
        test_sectors(ak)
        test_stock_picking(ak)
        test_fund_flow(ak)
        test_financial(ak)
        test_hsgt(ak)
        test_utils(ak)

    # ── 二、直连 HTTP ──
    test_http_apis()

    # ── 三、雪球 ──
    test_xueqiu()

    # ── 四、其他 ──
    test_others()

    # ── 汇总 ──
    total = stats["ok"] + stats["fail"] + stats["warn"] + stats["skip"]
    print(f"\n{'='*65}")
    print(f"  📊 汇总: ✅ {stats['ok']}  ❌ {stats['fail']}  ⚠️ {stats['warn']}  ⏭️ {stats['skip']}  (共 {total} 项)")
    print(f"  说明:")
    print(f"    ✅ = 接口返回正常数据")
    print(f"    ❌ = 请求抛异常（很可能是接口挂了/被封）")
    print(f"    ⚠️ = 返回空数据或非预期响应（可能当日无数据/需登录Cookie）")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    run_all()

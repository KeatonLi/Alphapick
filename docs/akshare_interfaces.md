# AKShare 接口清单

> 与 `backend/tests/test_api_endpoints.py` 一一对应，共 **56 项**（其中 1 项是库导入检查，55 项是实际接口测试）。
>
> 供应商标记：**东财**=东方财富  **同花顺**=THS  **新浪**=sina  **腾讯**=tencent  **深交所**=hsiec  **雪球**=xueqiu

---

## 一、AKShare 函数（43 项）

### 1.1 市场总貌（4 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 1 | `stock_sse_summary()` | 上交所市场总貌 | 上交所官网 | py:89 |
| 2 | `stock_szse_summary(date)` | 深交所证券类别统计 | 深交所官网 | py:90 |
| 3 | `stock_szse_area_summary(date)` | 深交所地区交易排行 | 深交所官网 | py:91 |
| 4 | `stock_szse_sector_summary(symbol, date)` | 深交所股票行业成交 | 深交所官网 | py:92 |

### 1.2 股票名录（5 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 5 | `stock_info_a_code_name()` | 全部 A 股代码和简称 | 东财 | py:111 |
| 6 | `stock_info_sh_name_code(symbol)` | 上交所股票（主板/科创板） | 上交所 | py:112 |
| 7 | `stock_info_sz_name_code(symbol)` | 深交所股票（A/B 股） | 深交所 | py:113 |
| 8 | `stock_info_bj_name_code()` | 北交所股票 | 北交所 | py:114 |
| 9 | `stock_individual_info_em(symbol)` | 个股基础信息 | **东财** | py:115 |

### 1.3 实时行情（6 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 10 | `stock_zh_a_spot()` | A 股实时行情 | 新浪 | py:136 |
| 11 | `stock_zh_a_spot_em()` | A 股实时行情 | **东财** | py:137 |
| 12 | `stock_sh_a_spot_em()` | 沪 A 实时行情 | **东财** | py:138 |
| 13 | `stock_sz_a_spot_em()` | 深 A 实时行情 | **东财** | py:139 |
| 14 | `stock_bj_a_spot_em()` | 京 A 实时行情 | **东财** | py:140 |
| 15 | `stock_kc_a_spot_em()` | 科创板实时行情 | **东财** | py:141 |

### 1.4 历史行情（4 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 16 | `stock_zh_a_hist(symbol, period, ...)` | A 股日线（支持复权） | **东财** | py:160 |
| 17 | `stock_zh_a_daily(symbol, adjust)` | A 股日线 | 新浪 | py:161 |
| 18 | `stock_zh_index_daily(symbol)` | 指数日线（如上证） | 新浪 | py:162 |
| 19 | `stock_zh_a_minute(symbol, period, ...)` | A 股分时历史 | 新浪 | py:163 |

### 1.5 板块数据（5 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 20 | `stock_board_industry_summary_ths()` | 行业板块涨跌幅汇总 | **同花顺** | py:182 |
| 21 | `stock_board_industry_name_em()` | 行业板块列表 | **东财** | py:183 |
| 22 | `stock_board_concept_name_em()` | 概念板块列表 | **东财** | py:184 |
| 23 | `stock_board_industry_cons_em(symbol)` | 行业板块成份股 | **东财** | py:185 |
| 24 | `stock_board_concept_cons_em(symbol)` | 概念板块成份股 | **东财** | py:186 |

### 1.6 选股 / 排行 / 涨停板（7 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 25 | `stock_rank_lxsz_ths()` | 理想选股（连续上涨） | **同花顺** | py:205 |
| 26 | `stock_rank_cxg_ths()` | 持续强势股 | **同花顺** | py:206 |
| 27 | `stock_zt_pool_em(date)` | 涨停板池 | **东财** | py:207 |
| 28 | `stock_zt_pool_zb_em(date)` | 炸板池 | **东财** | py:208 |
| 29 | `stock_zt_pool_strong_em(date)` | 强势股池 | **东财** | py:209 |
| 30 | `stock_zt_pool_dt_em(date)` | 跌停板池 | **东财** | py:210 |
| 31 | `stock_zt_pool_old_em(date)` | 昨日涨停板池 | **东财** | py:211 |

### 1.7 资金流向（4 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 32 | `stock_individual_fund_flow(stock, market)` | 个股资金流 | 新浪 | py:230 |
| 33 | `stock_market_fund_flow_em()` | 市场资金流 | **东财** | py:231 |
| 34 | `stock_sector_fund_flow_em(indicator)` | 板块资金流排名 | **东财** | py:232 |
| 35 | `stock_individual_fund_flow_em(symbol, market)` | 个股资金流 | **东财** | py:233 |

### 1.8 财务数据（4 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 36 | `stock_financial_abstract_ths(stock)` | 业绩快报/预告 | **同花顺** | py:252 |
| 37 | `stock_financial_profit_by_report_em(symbol)` | 利润表 | **东财** | py:253 |
| 38 | `stock_financial_balance_sheet_by_report_em(symbol)` | 资产负债表 | **东财** | py:254 |
| 39 | `stock_financial_cash_flow_by_report_em(symbol)` | 现金流量表 | **东财** | py:255 |

### 1.9 沪深港通（2 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 40 | `stock_hsgt_hist_em(symbol)` | 沪深港通历史 | **东财** | py:274 |
| 41 | `stock_hsgt_fund_flow_em(symbol)` | 沪深港通资金流 | **东财** | py:275 |

### 1.10 交易日历 & 工具（2 项）

| # | 函数 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 42 | `tool_trade_date_hsiec()` | 交易日历 | 深交所 | py:294 |
| 43 | `tool_trade_date_hist_sina(year)` | 交易日历 | 新浪 | py:295 |

---

## 二、直连 HTTP API（5 项）

| # | 接口 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 44 | `https://qt.gtimg.cn/q={codes}` | 批量实时行情（最多100只） | **腾讯** | py:317 |
| 45 | `https://datacenter.eastmoney.com/api/data/v1/get` | 股票列表分页 | **东财** | py:332 |
| 46 | `https://push2.eastmoney.com/api/qt/clist/get` | 热度排名 | **东财** | py:346 |
| 47 | `http://search-api-web.eastmoney.com/search/jsonp` | 个股新闻搜索 | **东财** | py:358 |
| 48 | `https://proxy.finance.qq.com/ifzqgtimg/appstock/...` | 腾讯板块排行 | **腾讯** | py:378 |

---

## 三、雪球 API 备选（4 项）

| # | 接口 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 49 | `https://stock.xueqiu.com/v5/stock/batch/quote.json` | 批量行情 | 雪球 | py:398 |
| 50 | `https://xueqiu.com/service/v5/stock/rank` | 热度排名 | 雪球 | py:400 |
| 51 | `https://stock.xueqiu.com/v5/stock/quote.json` | 个股详情 | 雪球 | py:402 |
| 52 | `https://stock.xueqiu.com/v5/stock/chart/kline.json` | K 线数据 | 雪球 | py:404 |

---

## 四、其他备选（3 项）

| # | 接口 | 说明 | 供应商 | 对应代码行 |
|---|------|------|--------|-----------|
| 53 | `https://ifzqgtimg.applinzi.com/stock/rank` | 腾讯板块强弱势排名 | 腾讯 | py:432 |
| 54 | `https://vip.stock.finance.sina.com.cn/...` | 新浪全市场股票列表 | 新浪 | py:441 |
| 55 | `https://hq.sinajs.cn/list={codes}` | 新浪批量实时行情 | 新浪 | py:452 |

---

## 汇总

| 大分类 | 数量 |
|--------|------|
| 一、AKShare 函数 | 43 |
| 二、直连 HTTP API | 5 |
| 三、雪球 API | 4 |
| 四、其他备选 | 3 |
| **合计** | **55** |

（另含 1 项库导入检查 `test_akshare_import()`，脚本共计 56 项可运行项。）

### 按供应商统计

| 供应商 | 数量 | 涉及分类 |
|--------|------|---------|
| **东财** `_em` | 22 | 名录/实时/历史/板块/涨停板/资金/财务/沪深港通/HTTP直连 |
| **同花顺** `_ths` | 5 | 板块/选股/财务 |
| **新浪** `_sina` / 无后缀 | 9 | 实时/历史/资金/工具/直连 |
| **深交所** `_hsiec` | 2 | 工具 |
| **腾讯** | 2 | 直连HTTP/其他 |
| **雪球** | 4 | 全部备选 |
| **上交所** | 1 | 市场总貌 |
| **其他** | 1 | 其他备选 |

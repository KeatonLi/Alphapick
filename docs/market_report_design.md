# 市场报告模块详细设计方案

## 一、概述

市场报告是每日收盘后（下午四点）自动生成的 A 股市场分析报告，以**完整 HTML 文件**方式输出，包含 K 线图、技术指标、板块轮动，资金流向等多维度数据。

报告有两种视图：
- **React 视图**：现有交互式前端页面，适合日常浏览
- **HTML 报告**：自包含的 HTML 文件，可直接浏览器打开、分享、后续支持推文到其他平台

## 二、设计目标

1. **HTML 文件输出**：后端生成完整自包含 HTML 报告，matplotlib 图表以 Base64 PNG 嵌入
2. **图文并茂**：使用 matplotlib 生成专业图表，白底风格
3. **技术指标**：MACD、KDJ 等常用技术指标
4. **板块分析**：热门板块涨跌幅排行榜
5. **市场广度**：涨跌家数统计反映市场整体情绪
6. **推文扩展**：HTML 报告含 Open Graph meta，便于后续抓取分享

## 三、数据来源

### 3.1 akshare 数据接口

| 数据类型 | akshare 函数 | 说明 |
|---------|-------------|------|
| 全市场行情 | `stock_zh_a_spot` | 获取所有股票实时数据（计算市场广度） |
| 板块数据 | `stock_board_concept_summary_ths` | 同花顺板块汇总 |
| 指数数据 | `stock_zh_index_daily` | 指数日线数据（生成 K 线图） |
| 交易日历 | `tool_trade_date_hsiec` | 获取交易日列表 |

### 3.2 自计算指标

| 指标 | 计算方法 |
|-----|---------|
| MA5/10/20 | 简单移动平均线 |
| MACD | EMA(12), EMA(26), DIF = EMA12 - EMA26, DEA = EMA(DIF,9), MACD柱 = (DIF-DEA)*2 |
| KDJ | RSV = (收盘-N日内最低) / (N日内最高-N日内最低) * 100，K = 2/3 * 前K值 + 1/3 * RSV，D = 2/3 * 前D值 + 1/3 * K，J = 3*K - 2*D |

## 四、图表设计

所有图表使用 matplotlib 生成，白底风格，统一通过 `chart_service.py` 生成，返回 Base64 PNG 字符串。

### 4.1 K 线 + 均线图 (Kline Chart)

**内容**:
- K 线（红涨 `#e74c3c`，绿跌 `#27ae60`）
- MA5 均线（黄色 `#f39c12`）
- MA10 均线（紫色 `#9b59b6`）
- MA20 均线（绿色 `#2ecc71`）

### 4.2 MACD 指标图

**内容**:
- DIF 线（蓝色 `#3498db`）
- DEA 线（橙色 `#e67e22`）
- MACD 柱（红涨绿跌）

### 4.3 KDJ 指标图

**内容**:
- K 线（白色 `#ecf0f1`）
- D 线（黄色 `#f1c40f`）
- J 线（红色 `#e74c3c`）
- 超买超卖线（80/20 虚线）

### 4.4 板块涨跌幅排行榜

**内容**:
- 横向柱状图，显示涨幅前 10 板块，红涨绿跌

### 4.5 涨跌家数统计图

**内容**:
- 上涨/下跌/平盘三家数柱状图

### 4.6 主要指数涨跌对比图

**内容**:
- 三大指数涨跌柱状图对比

## 五、API 设计

### 5.1 现有接口

| 接口 | 方法 | 说明 |
|-----|------|------|
| `/api/report/daily` | GET | 获取指定日期报告数据（JSON） |
| `/api/report/history` | GET | 获取最近 N 天报告列表 |
| `/api/report/dates` | GET | 获取有报告的日期列表 |
| `/api/report/trade-dates` | GET | 获取交易日列表 |

### 5.2 新增 HTML 报告接口

```
GET /api/report/html?date=2026-05-16
```
返回完整的 HTML 报告内容（`Content-Type: text/html`），可直接在 iframe 中嵌入或浏览器中打开。

```
POST /api/report/generate?date=2026-05-16
```
手动触发指定日期 HTML 报告的生成。响应：
```json
{
  "success": true,
  "data": {
    "html_path": "reports/market_report_2026-05-16.html"
  }
}
```

### 5.3 数据库模型变更

`MarketReport` 表新增字段：

| 字段 | 类型 | 说明 |
|-----|------|------|
| `html_report_path` | VARCHAR(500) | HTML 报告文件路径 |

## 六、前端页面布局

### 6.1 React 视图（默认）

保持现有交互式页面，包含指数卡片、热门板块列表、AI 分析文字。

### 6.2 HTML 视图（新增）

用户点击"HTML 报告"切换按钮，页面下方 iframe 嵌入 `/api/report/html?date=...`。

页面顶部新增：
- 视图切换按钮（React 视图 / HTML 报告）
- "生成 HTML 报告"按钮（当 HTML 未生成时显示）
- "新窗口打开"链接（当 HTML 已生成时显示）

## 七、技术实现

### 7.1 后端模块结构

```
backend/
├── app/
│   ├── services/
│   │   ├── chart_service.py        # matplotlib 图表生成，返回 Base64
│   │   ├── report_service.py      # 报告数据服务（JSON）
│   │   └── html_report_service.py  # HTML 报告生成服务（Jinja2）
│   ├── templates/
│   │   └── market_report.html      # Jinja2 HTML 报告模板
│   └── routers/
│       └── report.py               # 报告路由（含新增 /html 和 /generate）
├── reports/                        # HTML 报告存储目录
│   └── market_report_2026-05-16.html
└── generate_report.py              # 定时生成脚本
```

### 7.2 chart_service.py 主要函数

| 函数 | 功能 |
|-----|------|
| `generate_kline_chart(dates, opens, highs, lows, closes, name)` | 生成 K 线图 |
| `generate_macd_chart(dates, closes, name)` | 生成 MACD 图 |
| `generate_kdj_chart(dates, highs, lows, closes, name)` | 生成 KDJ 图 |
| `generate_sector_chart(sectors)` | 生成板块排行图 |
| `generate_market_breadth_chart(up, down, flat)` | 生成涨跌家数图 |
| `generate_index_comparison_chart(indices)` | 生成指数对比图 |

### 7.3 html_report_service.py 主要函数

| 函数 | 功能 |
|-----|------|
| `generate_html_report(...)` | 生成完整 HTML 报告文件 |
| `get_html_report_path(report_date)` | 获取 HTML 报告文件路径 |
| `read_html_report(path)` | 读取 HTML 报告内容 |
| `get_market_breadth()` | 获取市场广度数据 |

### 7.4 工作流程

1. **定时任务**（下午 4 点）：`generate_daily_report()` 生成 JSON 报告并存库，同时触发 HTML 生成
2. **手动触发**：用户调用 `POST /api/report/generate` 生成指定日期 HTML
3. **前端展示**：用户可在 React 视图和 HTML 视图之间切换

## 八、部署注意事项

1. 确保 matplotlib 中文显示正常（安装中文字体后重启服务）
2. 图表生成可能较慢（约 5-10 秒），建议异步生成或缓存
3. HTML 报告文件较大（每份约 1-3 MB），注意存储空间
4. 考虑将 HTML 报告上传到 OSS/CDN，减少服务器压力
5. 新增依赖：`jinja2==3.1.4`、`matplotlib==3.9.3`、`numpy==2.2.2`

## 九、后续扩展

1. **推文功能**：解析 HTML 提取关键数据，通过推特/公众号 API 推送摘要
2. **新增图表**：布林带、RSI、筹码分布图
3. **PDF 导出**：将 HTML 报告转换为 PDF

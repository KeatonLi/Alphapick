# QuantForge — AI 量化分析平台设计文档

> 版本：v0.4 | 日期：2026-05-24 | 状态：已实现

---

## 一、项目定位

QuantForge 是一款面向个人投资者的 AI 辅助工具：

1. **理解市场** — 每日收盘后自动生成市场审计报告（三大指数 + 热门板块 + AI 解读）
2. **发现机会** — AI 从全市场筛选 5 只潜力标的，给出理由
3. **跟踪收益** — 记录推荐价格与现价，自动计算每日收益率

> 本产品不提供投资建议，所有数据仅供参考。

---

## 二、页面结构

### 入口：导航栏「每日量化报告」→ 单页面 3 个 Tab

| Tab | 内容 |
|-----|------|
| 市场审计报告 | 三大指数涨跌、热门板块、AI 解读 |
| 量化推荐 | 今日 5 只推荐股票（名称、理由、推荐价格） |
| 收益跟踪 | 所有历史推荐的现价与收益率（按推荐日期分组） |

---

### Tab 1：市场审计报告

- 三大指数（上证/深证/创业板）收盘价 + 涨跌幅
- 热门板块 Top 10（涨跌幅）
- AI 市场解读正文
- 数据来源：`market_reports` 表

---

### Tab 2：量化推荐

- 今日推荐的 5 只股票
- 每只显示：名称、代码、推荐理由、推荐价格（当日收盘价）
- 附加：当前最新价格 + 今日收益率（收盘前显示"待更新"）
- 数据来源：`recommendations` 表（按 `recommend_date = today`）

---

### Tab 3：收益跟踪

- 按推荐日期分组，展示所有历史推荐
- 每只股票显示：
  - 推荐日期、股票名称、股票代码
  - 推荐价格（当时的收盘价）
  - 当前最新价格
  - 累计收益率
- 排序：最新推荐日期在前
- 数据来源：`recommendations` 表

---

## 三、数据生成机制

### 3.1 每日定时 cron（16:00 执行）

每天 16:00（A股收盘后）自动执行两步：

```
0 16 * * 1-5 cd /opt/quantforge && python3 backend/generate_report.py >> backend/cron.log 2>&1
```

**第一步**：`generate_report.py` 生成当日市场报告 + 量化推荐
- 写入 `market_reports` 表
- 写入 `recommendations` 表（5 只股票，推荐价格 = 当日收盘价）

**第二步**：`update_prices.py` 更新所有推荐股的现价 + 收益率
- 抓取所有 `recommendations` 记录
- 更新 `current_price`（现价）和 `return_rate`（收益率）

---

### 3.2 手动触发生成接口

提供手动触发接口（不走页面按钮，直接调接口）：

| 接口 | 说明 |
|------|------|
| `POST /api/report/generate?date=YYYY-MM-DD` | 触发生成市场报告 + 量化推荐 |
| `POST /api/recommend/update-prices` | 更新所有推荐的现价和收益率 |

---

## 四、数据库表

### `market_reports`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| report_date | date | 报告日期（唯一） |
| market_summary | text | 市场概况 |
| index_data | text(JSON) | 三大指数数据 |
| hot_sectors | text(JSON) | 热门板块数据 |
| ai_report | text | AI 分析正文 |
| html_report_path | varchar(500) | HTML 报告路径 |
| created_at | datetime | 创建时间 |

### `recommendations`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| recommend_date | date | 推荐日期 |
| stock_code | varchar(10) | 股票代码 |
| stock_name | varchar(50) | 股票名称 |
| recommend_price | decimal(10,3) | 推荐当日收盘价 |
| current_price | decimal(10,3) | 当前最新价 |
| return_rate | decimal(10,4) | 累计收益率 |
| reason | text | 推荐理由 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

---

## 五、API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/report/daily?date=YYYY-MM-DD` | GET | 获取市场报告 |
| `/api/report/trade-dates?days=365` | GET | 交易日列表（前端日期选择器用） |
| `/api/report/generate?date=YYYY-MM-DD` | POST | **手动生成报告 + 推荐** |
| `/api/recommend/daily?date=YYYY-MM-DD` | GET | 获取指定日期的 5 只推荐 |
| `/api/recommend/today` | GET | 获取今日推荐（快捷接口） |
| `/api/recommend/history` | GET | 获取所有历史推荐（用于收益跟踪） |
| `/api/recommend/stats` | GET | 全局统计（累计/胜率/平均收益） |
| `/api/recommend/update-prices` | POST | 更新所有推荐的现价和收益率 |

---

## 六、技术约束

| 约束 | 说明 |
|------|------|
| 数据源 | 新浪被封，使用 EastMoney 数据中心 + 腾讯财经批量接口 |
| 推荐生成耗时 | 约 60 秒（抓 5000 股 + AI 筛选），不适合同步 HTTP，cron 和手动接口均为异步调用 |
| cron 执行时间 | 每天 16:00（收盘后） |
| AI API | MiniMax M2.7，Endpoint: `https://api.minimaxi.com/anthropic` |
| 数据库 | MySQL `111.231.107.210:13306`，库名 `prompt` |

---

## 七、环境信息

| 信息 | 值 |
|------|-----|
| 服务器 | root@111.231.107.210 |
| 前端 | http://111.231.107.210:3002 |
| 后端 | http://111.231.107.210:8084 |
| 数据库 | 111.231.107.210:13306 (库名: prompt) |
| 部署目录 | /opt/quantforge |
| 部署脚本 | Windows: `deploy-windows.sh` / Linux: `deploy.sh` |

---

## 八、实现计划

| 优先级 | 功能 | 状态 |
|--------|------|------|
| P0 | Tab 3 收益跟踪页面 | ✅ 已完成 |
| P0 | 更新 `generate_report.py` | ✅ 已完成 |
| P0 | 每日 cron 两步 | ✅ 已完成（16:00） |
| P1 | Tab 2 量化推荐 | ✅ 已完成 |
| P1 | 新增 `GET /recommend/today` | ✅ 已完成 |
| P1 | 新增 `GET /recommend/history` | ✅ 已完成 |
| P2 | 更新 README + DESIGN.md | ✅ 已完成 |

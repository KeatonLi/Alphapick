# QuantForge 产品重构设计文档

更新时间：2026-06-14  
状态：当前执行版

## 1. 产品定位

QuantForge 不是行情资讯站，也不是单纯的股票看板。它的核心定位是：

> 每天自动采集行情数据，落库后用量化策略生成 Top 5 股票推荐，并持续跟踪 1/3/5/7 个交易日收益，用历史结果验证策略是否可信。

用户每天真正关心五件事：

1. 今天系统选了哪 5 只股票。
2. 每只股票为什么入选。
3. 历史推荐到底赚没赚钱。
4. 数据源是否完整、可复现、可信。
5. 整个流程是否能稳定自动跑起来。

产品主线：

```text
外部数据源
-> 定时采集
-> 数据落库
-> 数据质量检查
-> 策略生成 Top 5
-> 发布今日选股
-> 跟踪 1/3/5/7 个交易日收益
-> 策略复盘与分析
-> 反向优化策略
```

核心原则：

- 策略生成和页面展示只读数据库。
- 外部行情接口只允许在采集任务里使用。
- 今日选股、收益复盘、策略分析必须能从数据库结果复现。
- 用户页看结果，管理员页管流程。
- 先闭环，再追求更多功能。

## 2. 五个主导航

本轮重构只保留 5 个主导航，其他页面暂时移除主入口。

| 主导航 | 路由 | 角色 | 一句话目的 |
| --- | --- | --- | --- |
| 今日选股 | `/picks` | 普通用户、管理员 | 用户每天看系统选出的 Top 5 股票 |
| 策略复盘 | `/review` | 普通用户、管理员 | 看历史推荐 1/3/5/7 个交易日收益 |
| 策略分析 | `/analytics` | 普通用户、管理员 | 判断策略长期是否靠谱 |
| 数据中台 | `/data` | 管理员 | 管理数据采集、落库、质量、补拉 |
| 运行控制台 | `/ops` | 管理员 | 一键跑单日流程、区间回测、定时任务 |

用户心智顺序：

```text
今天买什么
-> 过去赚没赚
-> 长期靠不靠谱
-> 数据有没有问题
-> 流程怎么跑起来
```

## 3. 页面职责

### 3.1 今日选股

路由：`/picks`

目标：用户打开网站第一眼知道今天系统推荐了哪 5 只股票，以及这批推荐是否值得信任。

页面内容：

- 交易日期选择。
- 数据日期、生成时间、策略版本。
- Top 5 股票卡片。
- 排名、股票代码、股票名称、推荐价、综合评分。
- 入选理由。
- 因子评分明细。
- 是否可交易、是否缺数据、是否停牌。
- 没有推荐时，引导管理员去运行控制台生成。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `rank` | 推荐排名 |
| `stock_code` | 股票代码 |
| `stock_name` | 股票名称 |
| `recommend_price` | 推荐价 |
| `score` | 综合评分 |
| `reason` | 入选理由 |
| `factor_snapshot` | 因子快照 |
| `strategy_version` | 策略版本 |
| `data_status` | 数据是否完整 |
| `trade_status` | 是否可交易 |
| `generated_at` | 生成时间 |

### 3.2 策略复盘

路由：`/review`

目标：回答“过去推荐的股票到底赚没赚钱”。

页面内容：

- 时间范围筛选。
- 总推荐数、已完成跟踪数、跟踪中数量。
- 1/3/5/7 个交易日胜率。
- 1/3/5/7 个交易日平均收益。
- 按推荐日期分组展示历史 Top 5。
- 单票收益矩阵。
- 批量更新现价和收益。
- 单条重置、删除、重新计算。

收益口径：

- 推荐日使用推荐价或当日可用收盘价作为基准。
- 第 1/3/5/7 个交易日收益使用数据库中对应交易日价格计算。
- 如果目标交易日缺数据，状态必须明确标记为未完成或缺数据。

### 3.3 策略分析

路由：`/analytics`

目标：判断策略长期是否值得信任，而不是只看某一天表现。

页面内容：

- 时间范围筛选。
- 胜率趋势。
- 收益分布。
- 最佳持有期分析。
- 价格区间表现。
- 股票类型表现。
- 波动率与回撤分析。
- AI 洞察可作为辅助解释，但不能替代量化指标。

优先展示指标：

| 指标 | 用途 |
| --- | --- |
| 胜率趋势 | 看策略是否稳定 |
| 平均收益 | 看收益中枢 |
| 收益分布 | 看尾部风险 |
| 最大回撤 | 看最坏情况 |
| 最佳持有期 | 判断持有 3/5/7 日哪个更优 |

### 3.4 数据中台

路由：`/data`

目标：管理员确认数据源是否健康、行情数据是否已经落库、缺失数据是否能补拉。

页面内容：

- 目标日期选择。
- 数据健康总览。
- 数据源状态卡片。
- 数据质量检查。
- 缺失数据提示。
- 采集日志。
- 单项补拉。
- 全量补拉。
- 删除指定日期数据后重拉。

数据源原则：

- 页面不直接请求外部行情。
- 策略生成不直接请求外部行情。
- 所有外部行情访问集中在采集层。
- 采集结果必须保存到数据库。
- 数据质量检查必须在生成策略前完成。

### 3.5 运行控制台

路由：`/ops`

目标：管理员一键跑完整流程，并能做单日验证、区间回测、定时任务管理。

页面内容：

- 单日完整闭环：采集数据 -> 质量检查 -> 生成推荐 -> 更新收益 -> 查看结果。
- 区间回测：选择开始日期和结束日期，批量采集、生成、更新收益。
- 单独操作：只采集、只生成、只更新收益。
- 后台任务状态。
- 定时任务配置。

标准流程：

```text
Run Daily
-> Fetch Data
-> Quality Check
-> Generate Picks
-> Update Returns
-> Verify Result
```

定时任务建议：

- 交易日下午或晚上采集当天行情。
- 采集完成后生成推荐。
- 每天自动更新历史推荐的 1/3/5/7 日收益。
- 每一步都要记录日志，失败时可以从失败步骤重跑。

## 4. 后端接口设计

后端按业务语义新增 5 组接口，前端主流程只调用这些接口。

```text
/api/picks       今日选股
/api/review      策略复盘
/api/analytics   策略分析
/api/data        数据中台
/api/ops         运行控制台
```

旧接口暂时保留兼容，但不作为前端主入口：

```text
/api/recommend
/api/analysis
/api/datasource
/api/generate
/api/schedule
/api/report
/api/stock
```

### 4.1 Picks API

```http
GET /api/picks/daily?date=2026-06-14
GET /api/picks/latest
GET /api/picks/dates
GET /api/picks/trade-dates?limit=365
```

职责：

- 返回某个交易日的推荐列表。
- 返回最近一次推荐。
- 返回可查看的推荐日期。
- 返回可用于日期选择器的交易日。

### 4.2 Review API

```http
GET /api/review/history?start_date=&end_date=&status=
GET /api/review/summary?start_date=&end_date=
POST /api/review/update-prices
POST /api/review/batch/update
POST /api/review/item/{id}/reset
DELETE /api/review/item/{id}
```

职责：

- 查询历史推荐。
- 汇总收益表现。
- 更新当前价和持有收益。
- 支持批量更新。
- 支持单条重置和删除。

后续建议补齐：

```http
POST /api/review/batch/reset
POST /api/review/batch/delete
```

### 4.3 Analytics API

```http
GET /api/analytics/overview
GET /api/analytics/holding-period
GET /api/analytics/return-distribution
GET /api/analytics/success-trend
GET /api/analytics/risk
GET /api/analytics/stock-profile
GET /api/analytics/insights
```

职责：

- 为策略分析页提供聚合指标。
- 不做数据采集。
- 不直接调用行情接口。
- 只基于推荐记录和已落库行情计算。

### 4.4 Data API

```http
GET /api/data/status?date=
GET /api/data/quality?date=
GET /api/data/logs?page=&data_type=&status=
GET /api/data/dates
POST /api/data/fetch/{data_type}?date=
POST /api/data/fetch-all?date=
POST /api/data/normalize/{data_type}?date=
DELETE /api/data/records/{data_type}?date=
DELETE /api/data/records?date=
```

职责：

- 统一管理采集、落库、质量检查和补拉。
- 对前端屏蔽旧数据源接口细节。
- 给策略生成前的质量判断提供依据。

### 4.5 Ops API

```http
POST /api/ops/run-daily?date=
POST /api/ops/backtest?start_date=&end_date=
POST /api/ops/fetch?date=
POST /api/ops/generate-picks?date=
POST /api/ops/update-returns
GET /api/ops/task/{task_id}
GET /api/ops/schedule
POST /api/ops/schedule
```

职责：

- 管理完整运行流程。
- 管理区间回测流程。
- 管理定时任务配置。
- 查询后台任务状态。

## 5. 前端文件结构

页面：

```text
frontend/src/pages/PicksPage.tsx
frontend/src/pages/ReviewPage.tsx
frontend/src/pages/AnalyticsPage.tsx
frontend/src/pages/DataCenterPage.tsx
frontend/src/pages/OpsConsolePage.tsx
```

服务层：

```text
frontend/src/services/picksApi.ts
frontend/src/services/reviewApi.ts
frontend/src/services/analyticsApi.ts
frontend/src/services/dataApi.ts
frontend/src/services/opsApi.ts
```

主路由：

```text
/           -> /picks
/picks      -> 今日选股
/review     -> 策略复盘
/analytics  -> 策略分析
/data       -> 数据中台，仅管理员
/ops        -> 运行控制台，仅管理员
*           -> /picks
```

旧页面处理：

| 旧页面 | 处理方式 |
| --- | --- |
| `/recommend` | 合并到 `/picks` |
| `/tracking` | 合并到 `/review` |
| `/analysis` | 改为 `/analytics` |
| `/settings` | 拆到 `/data` 和 `/ops` |
| `/console` | 合并到 `/ops` |
| `/report` | 暂时隐藏 |
| `/poster` | 暂时隐藏 |
| `/stock-daily` | 暂时隐藏 |

## 6. 权限设计

| 页面 | 普通用户 | 管理员 |
| --- | --- | --- |
| 今日选股 | 可见 | 可见 |
| 策略复盘 | 可见 | 可见 |
| 策略分析 | 可见 | 可见 |
| 数据中台 | 不可见 | 可见 |
| 运行控制台 | 不可见 | 可见 |

普通用户关注结果，管理员关注数据和流程。

## 7. 视觉方向

整体风格：

- 专业量化终端。
- 苹果式毛玻璃质感。
- 深色背景优先。
- 信息密度高，但层级清楚。
- 强调数字、趋势、状态。
- 减少营销文案。
- 减少无意义装饰。

关键词：

```text
precise
premium
data-dense
decision-oriented
calm
```

页面设计准则：

- 首页直接展示今日选股，不做营销落地页。
- 图表、收益、日期、状态比大段文字更重要。
- 每个页面只解决一个核心问题。
- 管理操作和用户阅读操作分开。
- 缺数据、未生成、运行中、失败状态必须明确展示。

## 8. 数据闭环验收标准

### 8.1 单日闭环

输入：一个交易日期。

验收流程：

1. `/api/ops/run-daily?date=目标日期` 可启动完整任务。
2. 数据中台能看到该日期采集状态。
3. 数据质量检查能说明是否可用于策略。
4. 今日选股能看到该日期 Top 5。
5. 策略复盘能看到该日期推荐记录。
6. 更新收益后，1/3/5/7 个交易日收益字段能变化或明确显示缺数据。

### 8.2 区间回测

输入：开始日期、结束日期。

验收流程：

1. `/api/ops/backtest?start_date=&end_date=` 可启动区间任务。
2. 每个交易日都能独立采集、生成、记录。
3. 已有记录重复执行时不能产生不可控重复数据。
4. 策略复盘按日期展开能看到历史推荐。
5. 策略分析能基于区间数据产出胜率、收益、分布等指标。

### 8.3 数据源隔离

验收规则：

- `/picks`、`/review`、`/analytics` 不直接调用外部行情接口。
- 外部行情只在 `/api/data` 和 `/api/ops` 的采集步骤中触发。
- 推荐生成只读数据库中的行情和候选数据。
- 缺数据时不能静默生成“看起来正常”的推荐。

### 8.4 定时任务

验收规则：

- 能配置是否启用定时任务。
- 能配置每天运行时间。
- 能配置是否生成推荐。
- 能配置是否生成报告。
- 能配置是否自动更新收益。
- 定时任务执行后有日志可查。

## 9. 当前实施顺序

### 阶段一：页面和导航收敛

目标：

- 只保留 5 个主导航。
- 前端路由切到新页面。
- 普通用户和管理员权限分离。

交付：

- `PicksPage`
- `ReviewPage`
- `AnalyticsPage`
- `DataCenterPage`
- `OpsConsolePage`
- 新侧边栏导航

### 阶段二：后端语义接口

目标：

- 新增 5 组业务接口。
- 前端服务层切到新接口。
- 旧接口只作为兼容层。

交付：

- `picks.py`
- `review.py`
- `analytics.py`
- `data_center.py`
- `ops.py`

### 阶段三：数据闭环补强

目标：

- 单日完整流程可跑。
- 区间回测可跑。
- 定时任务能自动更新收益。
- 数据质量结果在页面上可见。

交付：

- 单日闭环 API。
- 区间回测 API。
- 收益批量更新。
- 定时任务配置。
- 数据源状态和日志展示。

### 阶段四：策略可信度增强

目标：

- 明确策略版本。
- 明确因子打分。
- 明确每个推荐的收益归因。
- 支持长期策略分析。

交付：

- 策略版本字段。
- 因子快照字段。
- 收益统计。
- 持有期比较。
- 风险和回撤指标。

## 10. 不做什么

本轮暂时不做：

- 新增大量资讯页面。
- 把报告、海报、个股日线作为主入口。
- 页面直接读取实时行情。
- 用户端暴露复杂运维按钮。
- 在数据缺失时强行生成无质量标记的推荐。

## 11. 一句话结论

QuantForge 现在要从“功能很多但混乱的网站”收敛成一个清晰的量化选股闭环：

```text
今日选股：今天买什么
策略复盘：过去赚没赚
策略分析：长期靠不靠谱
数据中台：数据有没有问题
运行控制台：流程怎么跑起来
```

后续开发、页面设计、接口命名、测试验收，都围绕这个闭环推进。

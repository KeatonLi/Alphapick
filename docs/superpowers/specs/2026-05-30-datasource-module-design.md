# QuantForge 数据源模块设计规格

## 概述

将后端拆分为 `datasource`（数据源管理）和 `display`（展示）两大模块，物理隔离。本次重点实现 datasource 模块——稳定的、日频批量的数据采集与原始 JSON 存储，解决当前数据采集频繁报错、错误被静默吞掉、无原始数据回溯等问题。

## 架构概览

```
外部 API (AKShare / Tencent / EastMoney)
        │
        ▼
┌───────────────────┐     ┌───────────────────┐
│   datasource/     │     │    display/       │
│                   │     │                   │
│ fetchers/         │     │ routers/          │
│   - index.py      │     │ services/         │
│   - sector.py     │  →  │   - report_service│
│   - stock.py      │ 读库 │   - recommend_svc │
│   - hsgt.py       │     │ models/           │
│   - limit_up.py   │     │ prompts/          │
│   - calendar.py   │     │                   │
│   - spot.py       │     └───────────────────┘
│                   │              │
│ models.py         │              ▼
│ scheduler.py      │     ┌───────────────────┐
│ router.py         │     │  MySQL (prompt)   │
└───────────────────┘     │                   │
        │                 │ raw_data_records  │
        ▼                 │ data_fetch_log    │
┌───────────────────┐     │ market_reports    │
│   shared/         │     │ recommendations   │
│   database.py     │     │ schedule_config   │
│   config.py       │     └───────────────────┘
│   dependencies.py │
│   utils/          │
└───────────────────┘
```

**核心铁则：**
- datasource 只负责采集 + 存原始 JSON，不做任何数据清洗
- display 只读 raw_data_records 表，不调任何外部 API
- 两个模块互不 import，通过 shared/ 共用基础设施

## 目录结构

```
backend/app/
├── datasource/               # 数据源管理模块
│   ├── __init__.py
│   ├── models.py             # RawDataRecord + DataFetchLog ORM
│   ├── router.py             # /api/datasource/* 端点
│   ├── scheduler.py          # APScheduler 定时采集
│   └── fetchers/
│       ├── __init__.py
│       ├── base.py           # DataFetcher 抽象基类
│       ├── index.py          # 指数日线
│       ├── sector.py         # 板块行业摘要
│       ├── stock.py          # 个股日线 + 股票列表
│       ├── hsgt.py           # 北向资金
│       ├── limit_up.py       # 涨停池
│       ├── calendar.py       # 交易日历
│       └── spot.py           # 全市场实时快照
│
├── display/                  # 展示模块（老代码重构迁移）
│   ├── __init__.py
│   ├── models.py             # MarketReport + Recommendation + GenerationTask
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── analysis.py
│   │   ├── report.py
│   │   ├── recommend.py
│   │   ├── stock.py
│   │   ├── auth.py
│   │   ├── generate.py
│   │   └── settings.py       # Settings 页面接口
│   ├── services/
│   │   ├── __init__.py
│   │   ├── report_service.py     # 改为读 raw_data_records
│   │   ├── recommend_service.py  # 改为读 raw_data_records
│   │   ├── analysis_service.py
│   │   ├── candidate_service.py
│   │   ├── chart_service.py
│   │   ├── indicator_service.py
│   │   ├── poster_service.py
│   │   └── stock_service.py
│   └── prompts/
│       ├── __init__.py
│       ├── report_prompt.py
│       └── recommend_prompt.py
│
├── shared/                   # 共用基础设施
│   ├── __init__.py
│   ├── database.py           # SQLAlchemy engine + session
│   ├── config.py             # 环境变量配置
│   ├── dependencies.py       # JWT 鉴权依赖
│   └── utils/
│       ├── __init__.py
│       ├── ai_client.py      # DeepSeek LLM 客户端
│       └── akshare_utils.py  # 仅保留腾讯代码转换等工具函数
│
└── main.py                   # FastAPI 应用入口，注册 router + 启动 scheduler
```

## 数据库新增表

### data_fetch_log — 采集日志

每次 API 调用记录一条，用于监控采集健康状态。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK AUTO_INCREMENT | |
| source_name | VARCHAR(50) | NOT NULL | 数据源：`akshare` / `tencent` / `eastmoney` |
| data_type | VARCHAR(50) | NOT NULL | 类型：`index_daily` / `sector_summary` / `stock_daily` / `hsgt_flow` / `limit_up_pool` / `trade_calendar` / `stock_spot` |
| target_date | DATE | NOT NULL | 采集的目标数据日期 |
| status | VARCHAR(20) | NOT NULL | `success` / `failed` / `empty` |
| request_params | TEXT | NULL | 请求参数 JSON |
| response_size | INT | NULL | 响应字节数 |
| error_message | TEXT | NULL | 失败时的错误信息 |
| retry_count | INT | DEFAULT 0 | 实际重试次数 |
| duration_ms | INT | NULL | 采集耗时（毫秒） |
| created_at | DATETIME | DEFAULT NOW() | |

索引：`(data_type, target_date, status)`, `(created_at)`

### raw_data_records — 原始数据

API 原始响应直接存为 JSON，不做任何清洗或解析。只写不改，是展示层的唯一数据来源。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK AUTO_INCREMENT | |
| source_name | VARCHAR(50) | NOT NULL | 同 data_fetch_log |
| data_type | VARCHAR(50) | NOT NULL | 同 data_fetch_log |
| target_date | DATE | NOT NULL | 数据日期 |
| raw_json | MEDIUMTEXT | NOT NULL | API 原始 JSON 响应 |
| fetch_log_id | INT | FK → data_fetch_log.id | 关联采集日志 |
| created_at | DATETIME | DEFAULT NOW() | |

唯一约束：`UNIQUE(data_type, target_date)` — 同一天同一类型只存一份，重复触发自动幂等跳过。

## DataFetcher 基类设计

```python
class DataFetcher(ABC):
    source_name: str          # 数据源标识
    data_type: str            # 数据类型标识
    max_retries: int = 3
    retry_delays: tuple = (1, 3, 9)  # 指数退避秒数

    @abstractmethod
    def fetch(self, target_date: date) -> dict:
        """子类实现：调用 API，返回原始响应 dict"""
        ...

    def run(self, target_date: date) -> FetchResult:
        """基类模板方法：
        1. 幂等检查 — (data_type, target_date) 已有成功记录则跳过
        2. 调用 fetch()，失败按 1s→3s→9s 重试
        3. 成功：raw_json 写入 raw_data_records
        4. 记录 data_fetch_log（成功/失败/重试次数/耗时）
        5. 返回 FetchResult
        """
        ...
```

每个 Fetcher 只需实现 `fetch()` 方法，所有重试、日志、存储逻辑由基类统一处理。

## 各采集器

| Fetcher | data_type | API 调用 | 说明 |
|---------|-----------|----------|------|
| IndexFetcher | `index_daily` | `ak.stock_zh_index_daily()` | 上证/深证/创业板日线 |
| SectorFetcher | `sector_summary` | `ak.stock_board_industry_summary_ths()` | THS 行业板块摘要 |
| StockFetcher | `stock_daily` | `ak.stock_zh_a_daily()` + EastMoney 列表 + 腾讯行情 | 全 A 股日线 + 行情快照 |
| HSGTFetcher | `hsgt_flow` | `ak.stock_hsgt_hist_em()` | 北向资金 30 日 |
| LimitUpFetcher | `limit_up_pool` | `ak.stock_zt_pool_em()` | 当日涨停池 |
| CalendarFetcher | `trade_calendar` | `ak.tool_trade_date_hsiec()` | A 股交易日历 |
| SpotFetcher | `stock_spot` | 腾讯 `qt.gtimg.cn` + EastMoney 列表 | 全市场实时快照 |

## 调度器设计

- 使用 APScheduler 的 `CronTrigger`，单 job `daily_fetch`
- 默认触发时间从 `schedule_config.run_time` 读取
- Settings 页面修改时间 → API 调用 → 更新 DB → 调用 `scheduler.reschedule_job()`
- Settings 页面启停各采集器 → 更新 `schedule_config` 中对应开关字段
- 手动触发 → 直接调 `Fetcher.run(today)`，返回结果给前端

### schedule_config 表增强

在现有表基础上新增字段（或新建字段）：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enabled | BOOL | FALSE | 总开关（已有） |
| run_time | VARCHAR(5) | "16:00" | 调度时间（已有） |
| run_index | BOOL | TRUE | 新增：指数采集开关 |
| run_sector | BOOL | TRUE | 新增：板块采集开关 |
| run_stock | BOOL | TRUE | 新增：个股采集开关 |
| run_hsgt | BOOL | TRUE | 新增：北向资金开关 |
| run_limit_up | BOOL | TRUE | 新增：涨停池开关 |
| run_calendar | BOOL | TRUE | 新增：交易日历开关 |
| run_spot | BOOL | TRUE | 新增：全市场快照开关 |

## datasource API 端点

全部挂载在 `/api/datasource` 下，admin 权限保护：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/datasource/trigger/{data_type}` | 手动触发某类数据采集 |
| POST | `/api/datasource/trigger-all` | 手动触发全部采集 |
| GET | `/api/datasource/logs` | 查询采集日志（分页，可按 data_type/status/日期 筛选） |
| GET | `/api/datasource/status` | 各数据源今日采集状态摘要 |

## display 模块改造

**核心变化：** 展示层不再直接调用任何外部数据 API。所有数据从 `raw_data_records` 读取。

```
之前：report_service → ak.stock_zh_index_daily() → IndexError/ConnectionError 炸
之后：report_service → SELECT raw_json FROM raw_data_records
                       WHERE data_type='index_daily' AND target_date='2026-05-30'
                     → json.loads(raw_json) → 甩给 DeepSeek AI
```

改造顺序：
1. `report_service.py` — 指数数据、板块数据、北向资金、涨停池 全部切到读库
2. `recommend_service.py` — 候选池、行情价格 切到读库
3. `analysis_service.py` / `stock_service.py` — 个股数据切到读库
4. 确认所有调用方已切走后，清理 `akshare_utils.py` 中废弃的实时调用函数

## 错误处理原则

- **datasource：** 采集失败 → 重试 3 次 → 仍失败 → 记录 `data_fetch_log.status='failed'` + error_message → 不抛异常，继续执行下一个 Fetcher
- **display：** 读库时数据缺失 → 返回明确错误给前端（"请等待数据采集完成"），而不是静默降级
- **所有异常** 写入日志（Python logging 模块），线上可查

## 迁移策略

分 4 个阶段，不推翻重来：

1. **搭建骨架** — 创建 `datasource/` + `display/` + `shared/` 目录，迁移 `database.py`/`config.py` 到 shared，确保 FastAPI 正常启动
2. **上线采集** — 实现各 Fetcher + scheduler，跑几天确认 `raw_data_records` 稳定有数据
3. **切换展示层** — service 逐个切到读库，验证报告/推荐生成正常
4. **清理** — 删除 `akshare_utils.py` 中废弃函数，移除旧的实时调用代码

## 不在本次范围内

- 实时行情推送（WebSocket）
- 多数据源容灾切换（备用源）
- 数据清洗 / 结构化存储
- 前端 Settings 页面 UI 改造（另行设计）

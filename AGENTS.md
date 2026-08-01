# AGENTS.md

This file provides guidance to AI agents (Codex / Claude / opencode) when working in this repository.

## 项目概述

QuantForge 是 AI 驱动的 A 股量化分析平台。前端 React+TypeScript+Vite，后端 FastAPI+SQLAlchemy，数据源为多源互备（AKShare / 腾讯 / 新浪自动降级），LLM 走 OpenAI 兼容协议。

**产品主线（数据闭环）**：定时采集 → 原始数据落库 → 归一化 → 确定性策略评分 Top5 推荐 → 1/3/5/7 交易日收益跟踪 → 统计复盘。

**核心约束**：
- 页面展示与策略生成只读数据库，不直接请求外部行情接口
- 外部行情访问集中在 `app/datasource/` 采集层（fetcher → raw_data_records → warehouse 归一化）
- 数据缺失时不得静默生成推荐

## SDD 开发工作流（规格驱动开发）

**本仓库是 SDD 工程：任何开发必须规格先行。** 规格体系在 `docs/specs/`（见 `docs/specs/00-index.md`）。

```
1. 规格先行   新增或更新规格（编号 + 需求 + 验收标准），状态标记
2. 测试驱动   按验收标准写测试（先红）
3. 实现       实现功能让测试变绿
4. 收尾       更新规格：状态 ✅、验收标准勾选、测试映射补齐
5. 回归       跑全套测试 + 规格自检（无失配）
```

- 没有对应规格的代码改动不落地
- 没有验收标准的规格不实现
- 提交前跑规格自检清单（`docs/specs/00-index.md` 末尾）

## 常用命令

### 部署
```bash
bash deploy.sh                    # 唯一部署方式！停止旧服务 → kill 端口占用 → 上传 → 安装依赖 → 启动前后端
```
**重要：不要手动启动服务。** 服务器上不要手动跑 uvicorn/systemctl/nohup。部署前 commit + push。

### 后端开发
```bash
cd backend && source .venv/bin/activate   # Python 3.11+（venv 已建，需 3.10+ 语法）
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 前端开发
```bash
cd frontend && npm install
npm run dev          # 开发服务器 localhost:5173
npm run build        # 生产构建
```

### 测试
```bash
cd backend && DATABASE_URL="sqlite:///./test.db" .venv/bin/python -m pytest tests/ -q   # 单元/集成（SQLite，无需 MySQL）
bash scripts/test_integration.sh                                                         # 端到端 curl（需服务运行）
cd frontend && npm run test:smoke                                                        # Playwright 页面冒烟
```

## 架构要点

### 后端结构
- `app/routers/` — API 路由（auth/dashboard/picks/review/limit_up/ops/report/stock/generate/schedule）
- `app/services/` — 业务逻辑（recommend_service 推荐+收益跟踪、report_service 市场报告、strategy_service 策略评分、dashboard_service 工作台、limit_up_service 涨停、analysis_service 统计）
- `app/datasource/` — 采集层：`fetchers/`（6 类 fetcher，幂等+重试+日志）、`providers/`（AKShare/腾讯/新浪多源降级）、`warehouse.py`（归一化：快照/日线/候选池）、`scheduler.py`（APScheduler 定时）
- `app/display/data_reader.py` — 数据库只读层（交易日历/行情读取），页面与策略只能经此读库
- `app/utils/ai_client.py` — OpenAI 兼容 LLM 客户端（`chat()`），配置走 `LLM_*` 环境变量
- `app/config.py` — 环境变量配置（兼容旧 ANTHROPIC_*/DEEPSEEK_* 别名）

### 前端结构
- `pages/RecommendLoopPage.tsx` — 核心工作台（今日推荐 + 策略可信度 + 收益跟踪）
- `pages/LimitUpPage.tsx` — 涨停板分析；`pages/OpsConsolePage.tsx` — 管理后台；`pages/AccountPage.tsx` — 用户中心
- `services/` — API 调用层（api.ts 基础封装 + 各模块 api）
- `scripts/smoke-pages.mjs` — Playwright 页面冒烟测试（mock API）

### 数据流
1. 推荐生成：`stock_spot_snapshots` 快照 → 候选池（Top50）→ 策略评分 v2（动量30/趋势25/流动性20/数据源质量15/风险-10）→ Top5 → `recommendations` 表
2. 收益跟踪：里程碑 (1,2,3,5,7) 交易日，收盘价优先 `stock_daily_bars` 回退快照；满 7 日锁定 completed
3. 市场报告：落库指数/板块/北向/涨停数据 + AI 复盘 → `market_reports` 表（JSON 字段）
4. 定时任务：APScheduler 进程内（工作日 16:00 可配置），非交易日跳过，采集全成功才跑工作流

### 数据库
- MySQL `111.231.107.210:13306`，库名 `prompt`（本地开发用 SQLite，`DATABASE_URL=sqlite:///...`）
- 核心表：`recommendations`、`market_reports`、`raw_data_records`、`stock_spot_snapshots`、`stock_daily_bars`、`stock_candidates`、`data_fetch_log`、`data_quality_checks`、`generation_tasks`、`schedule_configs`、`users`

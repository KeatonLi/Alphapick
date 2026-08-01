# AGENTS.md

> 本仓库的**唯一权威开发指南**。Claude Code / opencode 等 AI 助手必须以此为准。
> 设计系统等辅助细节见 `@CLAUDE.md`。

## 项目

QuantForge 是 AI 驱动的 A 股量化平台：每天采集行情 → 落库 → 策略评分生成 Top 5 推荐 → 跟踪 1/3/5/7 日收益 → 统计复盘。

- 前端 React 19 + TypeScript + Vite；后端 FastAPI + SQLAlchemy（Python 3.11+）
- 数据源多源互备（AKShare/腾讯/新浪自动降级）；LLM 走 OpenAI 兼容协议（`LLM_*` 环境变量）

## 铁律：规格先行（本仓库是 SDD 工程）

**任何代码改动必须先在 `docs/specs/` 有对应规格，否则不落地。**

- 所有需求/规则/接口行为都已固化为**编号规格**（如 `REC-003`），含验收标准与测试映射
- 动手前必读：
  1. `docs/specs/00-index.md` — 编号体系、规格格式、工作流、自检清单
  2. 相关模块规格（auth / datasource / recommendation / tracking / limit-up / report / ops / api）
  3. `docs/system-requirements.md` — 需求总览
- 改需求 = 先改规格 → 再改测试 → 再改代码；禁止跳过规格直接写代码

## SDD 工作流（怎么做的具体流程）

```text
1. 规格先行   新增/更新规格（编号 + 需求 + 验收标准），状态标记
2. 测试驱动   按验收标准写测试（先红）
3. 实现       实现功能让测试变绿
4. 收尾       更新规格：状态 ✅、验收勾选、测试映射补齐
5. 回归       跑全套测试 + 规格自检（无失配）
```

## 架构约束（不可违反）

- 页面展示与策略生成**只读数据库**，不直接请求外部行情
- 外部行情访问集中在 `backend/app/datasource/`（fetcher → raw_data_records → warehouse 归一化）
- 数据缺失时**不得静默生成推荐**

## 常用命令

```bash
# 后端（venv：backend/.venv，Python 3.11+）
cd backend && source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000

# 前端
cd frontend && npm run dev        # 开发（localhost:5173）
npm run build                     # 生产构建

# 测试
cd backend && DATABASE_URL="sqlite:///./test.db" .venv/bin/python -m pytest tests/ -q
bash scripts/test_integration.sh  # 端到端 curl（需服务运行）
cd frontend && npm run test:smoke # Playwright 页面冒烟

# 部署（唯一方式，不要手动启服务）
bash deploy.sh                    # 停止旧服务 → 杀端口 → 上传 → 装依赖 → 启动前后端
```

## 架构速览

- **后端** `backend/app/`：`routers/`（API 路由）、`services/`（推荐/报告/策略评分/工作台/涨停/统计）、`datasource/`（采集层）、`display/data_reader.py`（只读层）、`utils/ai_client.py`（LLM）
- **前端** `frontend/src/`：`pages/`（RecommendLoopPage 工作台 / LimitUpPage 涨停 / OpsConsolePage 管理后台 / AccountPage 用户中心）、`services/`（API 调用）、`scripts/smoke-pages.mjs`（冒烟）
- **数据流**：快照表 → 候选池 Top50 → 策略评分 v2（动量30/趋势25/流动性20/质量15/风险-10）→ Top5 → `recommendations`；收益跟踪里程碑 (1,2,3,5,7) 交易日，收盘价日线优先回退快照，满 7 日锁定
- **调度**：APScheduler 进程内，工作日定时（可配置），非交易日跳过，采集全成功才跑工作流

## 设计系统

界面设计语言与色彩规范见 `@CLAUDE.md`（Liquid Glass Finance：毛玻璃 + 金融灰基调 + A股红涨绿跌）。

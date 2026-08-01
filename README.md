# AlphaPick — AI 量化分析平台

AI 驱动的 A 股量化分析平台：每日自动采集行情、量化生成 Top 5 推荐、跟踪 1/3/5/7 交易日收益，用历史结果验证策略可信度。

## 功能

| 功能 | 说明 |
|------|------|
| **推荐工作台** | 每日 Top 5 推荐（量化评分）+ 入选理由 + 因子明细 + 策略可信度复盘 |
| **收益跟踪** | 自动跟踪推荐股 1/3/5/7 个交易日收益，胜率/均收益统计，历史批量回放 |
| **涨停板分析** | 按连板数分组的涨停池、行业热度、封板强度、炸板率 |
| **市场报告** | AI 生成每日市场报告（指数/板块/涨停/北向资金分析），可出 HTML 报告 |
| **数据采集** | 6 类行情数据多源互备采集（AKShare/腾讯/新浪自动降级）、质量检查、补拉 |
| **运维控制台** | 一键单日闭环、区间回测、定时任务配置、异步任务进度 |

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy 2 |
| 数据库 | MySQL（生产）/ SQLite（测试） |
| 数据源 | AKShare / 腾讯财经 / 新浪，多源互备自动降级 |
| AI | OpenAI 兼容协议（DeepSeek / MiniMax） |

## 项目结构

```
AlphaPick/
├── deploy.sh                  # 一键部署到服务器
├── scripts/
│   └── test_integration.sh    # 端到端集成测试（curl 版本）
├── backend/
│   ├── .env.example           # 环境变量模板
│   ├── requirements.txt
│   ├── tests/                 # pytest 测试（SQLite 全链路）
│   ├── scripts/               # 运维脚本（回填日线等）
│   └── app/
│       ├── main.py            # FastAPI 入口
│       ├── config.py          # 配置管理
│       ├── database.py        # 数据库连接
│       ├── models/            # 数据模型
│       ├── routers/           # API 路由
│       ├── services/          # 业务逻辑（推荐/报告/分析/策略评分）
│       ├── datasource/        # 数据采集层（fetcher → 原始库 → 归一化）
│       ├── display/           # 数据库只读层（交易日/行情读取）
│       ├── prompts/           # AI prompt
│       └── utils/             # AI 客户端
└── frontend/
    ├── server.js              # 生产环境 Node 静态服务器（3002）
    └── src/
        ├── App.tsx            # 路由入口
        ├── components/        # 通用组件
        ├── pages/             # RecommendLoopPage / LimitUpPage / OpsConsolePage / AccountPage
        └── services/          # API 调用层
```

## 快速开始

### 1. 环境配置

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 MySQL 连接信息和 LLM API Key
```

### 2. 本地开发

```bash
# 后端（Python 3.11+）
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

### 3. 生产部署

```bash
bash deploy.sh
```

脚本自动处理：停止旧服务 → 释放端口（后端 8084 / 前端 3002）→ 上传 → 安装依赖 → 启动。

### 4. 定时任务

默认管理员账号：`admin / admin123`（登录后可在运维控制台配置定时任务）。

定时任务在**后端进程内**（APScheduler）运行，非独立脚本：

- 配置项：开关、运行时间（HH:MM）、是否生成报告 / 推荐 / 更新收益
- 仅工作日执行，非交易日自动跳过；采集全部成功后才执行报告/推荐/收益工作流
- 每次执行结果记录在定时任务配置中

## 数据闭环

```
外部行情源（AKShare/腾讯/新浪，多源互备）
  → 定时采集（幂等 + 重试 + 原始数据落库）
  → 归一化（快照表 / 日线表 / 候选池 + 质量检查）
  → 策略评分（确定性因子，版本 qf-db-strength-v2）
  → Top 5 推荐
  → 收益跟踪（1/3/5/7 交易日里程碑）
  → 策略复盘与统计
```

核心约束：

- 页面展示与策略生成只读数据库，不直接请求外部行情
- 外部行情访问集中在 datasource 采集层
- 数据缺失时不得静默生成推荐

## API 文档

### 推荐与工作台

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard` | 工作台总览（管道状态/今日推荐/策略统计/复盘结论） |
| GET | `/api/picks/daily?date=` | 指定日期推荐列表 |
| GET | `/api/picks/latest` | 最近一次推荐 |
| GET | `/api/picks/dates` | 有推荐的日期列表 |
| GET | `/api/picks/trade-dates?days=` | 交易日列表 |
| GET | `/api/review/history?limit=` | 历史推荐（收益跟踪） |
| GET | `/api/review/summary` | 收益汇总 |
| POST | `/api/review/update-prices` | 更新所有推荐收益 |
| POST | `/api/review/batch/update` / `/batch/reset` / `/batch/delete` | 批量操作 |
| POST | `/api/review/item/{id}/reset` / DELETE | 单条操作 |

### 涨停板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/limit-up?date=` | 涨停池总览（分组/行业/汇总） |
| GET | `/api/limit-up/dates?days=` | 有涨停数据的日期 |

### 运维（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ops/run-daily?date=` | 单日完整闭环 |
| POST | `/api/ops/backtest?start_date=&end_date=` | 区间回测 |
| POST | `/api/ops/fetch` / `/generate-picks` / `/update-returns` | 单独操作 |
| GET | `/api/ops/task/{id}` | 异步任务进度 |
| GET/POST | `/api/ops/schedule` | 定时任务配置 |
| GET | `/api/datasource/status` | 数据源采集状态 |
| POST | `/api/datasource/trigger/{type}` / `/trigger-all` | 补拉 |
| GET | `/api/datasource/quality` / `/logs` | 质量检查与日志 |

### 报告 / 个股

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/report/daily?date=` | 市场报告数据 |
| POST | `/api/report/generate?date=` | 生成报告 |
| GET | `/api/stock/analyze?code=` | AI 个股分析 |
| GET | `/api/stock/daily?code=&days=` | 日线行情 |

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` / `/login` / `/guest` | 注册 / 登录 / 游客 |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/auth/users` / PUT `/api/auth/role/{id}` | 用户管理（管理员） |

## 测试

```bash
cd backend
.venv/bin/python -m pytest tests/ -x -q        # 单元/集成测试（SQLite）
bash ../scripts/test_integration.sh             # 端到端 curl 测试

cd frontend
npm run test:smoke                              # 页面冒烟测试（Playwright）
npm run lint
```

## License

MIT

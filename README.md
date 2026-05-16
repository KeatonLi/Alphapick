# QuantForge — AI 量化分析平台

AI 驱动的 A 股分析工具，支持个股深度分析、每日量化推荐、定时市场报告。

## 功能

| 功能 | 说明 |
|------|------|
| **个股分析** | 输入股票代码，AI 从基本面、技术面、消息面多维度生成分析报告 |
| **每日推荐** | 基于动量因子、量价配合、趋势健康度等量化逻辑，每日推荐 5 只潜力标的，跟踪收益率 |
| **市场报告** | 每天 15:30 定时生成投研日报，含三大指数、热门板块、AI 策略分析，可按日期翻看历史 |

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React + TypeScript + Tailwind CSS |
| 后端 | Python FastAPI + SQLAlchemy |
| 数据库 | MySQL |
| 数据源 | AKShare（sina / 同花顺） |
| AI | MiniMax M2.7（Anthropic 兼容协议） |

## 项目结构

```
QuantForge/
├── deploy.sh                  # 一键部署到服务器
├── start_backend.sh           # 服务器端直接启动后端
├── install_py_deps.sh         # 安装 Python 依赖
├── backend/
│   ├── .env.example           # 环境变量模板
│   ├── generate_report.py     # 定时生成市场报告脚本
│   ├── requirements.txt
│   └── app/
│       ├── main.py            # FastAPI 入口
│       ├── config.py          # 配置管理
│       ├── database.py        # 数据库连接
│       ├── models/            # 数据模型
│       ├── routers/           # API 路由
│       ├── services/          # 业务逻辑
│       └── utils/             # AKShare 封装 / AI 客户端
└── frontend/
    ├── server.js              # 生产环境 Node 静态服务器
    └── src/
        ├── App.tsx            # 路由入口
        ├── components/        # 通用组件
        ├── pages/             # 页面组件
        └── services/          # API 调用
```

## 快速开始

### 1. 环境配置

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 MySQL 连接信息和 MiniMax API Key
```

### 2. 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

### 3. 生产部署

```bash
./deploy.sh
# 前端: http://<server>:3002
# 后端: http://<server>:8084/api
```

### 4. 设置定时报告

服务器上配置 crontab，每个交易日收盘后自动生成市场报告：

```cron
30 15 * * 1-5 cd /opt/quantforge && python3 backend/generate_report.py >> /opt/quantforge/cron.log 2>&1
```

## API 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stock/analyze?code=000001` | AI 分析个股 |
| GET | `/api/stock/info?code=000001` | 股票基本信息 |
| GET | `/api/stock/daily?code=000001&days=60` | 日线行情 |
| GET | `/api/recommend/daily` | 每日推荐列表 |
| GET | `/api/recommend/stats` | 推荐统计（胜率/收益率） |
| GET | `/api/report/daily?date=2026-05-16` | 指定日期市场报告 |
| GET | `/api/report/dates` | 有报告的日期列表 |
| GET | `/api/report/history?limit=7` | 最近 N 天报告 |

## License

MIT

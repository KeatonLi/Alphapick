# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

QuantForge 是 AI 驱动的 A 股量化分析平台，前端 React+TypeScript，后端 FastAPI+SQLAlchemy，数据来源为 EastMoney 数据中心 + 腾讯财经批量接口（新浪接口已不可用）。

## 常用命令

### 前端开发
```bash
cd frontend && npm install
npm run dev          # 开发服务器 localhost:5173
npm run build        # 生产构建（构建产物在 dist/）
```

### 后端开发
```bash
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 部署
```bash
bash deploy.sh                    # Linux/Git Bash
bash deploy-windows.sh            # Windows 原生 bash
```

### 定时脚本
```bash
python backend/generate_report.py [YYYY-MM-DD]   # 生成市场报告+量化推荐
python backend/update_prices.py                   # 更新所有推荐股的现价和收益率
```

## 架构要点

### 后端结构
- `app/routers/` — API 路由定义（Analysis/Report/Recommend/Stock）
- `app/services/` — 业务逻辑层（report_service 处理报告生成，recommend_service 处理推荐）
- `app/utils/akshare_utils.py` — 数据源封装，统一腾讯代码格式（`_to_tencent_code` / `_from_tencent_code`）
- `app/utils/ai_client.py` — MiniMax M2.7 AI 客户端

### 前端结构
- `pages/DailyReport.tsx` — 核心页面，三个 Tab：市场报告 / 量化推荐 / 收益跟踪
- `services/api.ts` — API 调用层
- `services/mockData.ts` — 非核心页面的 mock 数据

### 数据流向
1. `generate_report.py` 调用 `report_service.generate_daily_report` + `recommend_service.get_recommend_by_date`
2. 推荐生成：全市场股票 → AKShare 腾讯批量接口 → AI 筛选 5 只 → 存入 MySQL
3. HTML 报告由 `html_report_service.generate_html_report` 生成到文件系统

### 关键约束
- 数据源：新浪被封，使用 EastMoney 数据中心 + 腾讯财经批量接口
- 推荐生成约 60 秒，cron 和手动接口均为同步调用（不走异步队列）
- cron 执行时间：每天 16:00（A股收盘后）
- `get_trade_dates_for_frontend` 公共函数在 `akshare_utils.py`，两个 service 共用

### 数据库
- MySQL `111.231.107.210:13306`，库名 `prompt`
- 核心表：`market_reports`（市场报告）、`recommendations`（量化推荐）

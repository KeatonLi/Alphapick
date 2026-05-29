# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

QuantForge 是 AI 驱动的 A 股量化分析平台，前端 React+TypeScript，后端 FastAPI+SQLAlchemy，数据来源为 EastMoney 数据中心 + 腾讯财经批量接口（新浪接口已不可用）。

## 常用命令

### 部署
```bash
bash deploy.sh                    # 唯一部署方式！脚本自动处理：停止旧服务 → kill 端口占用 → 上传文件 → 安装依赖 → 启动前后端
```

**重要：不要手动启动服务。** 不要在服务器上手动跑 uvicorn、systemctl 或 nohup。`deploy.sh` 会先杀掉旧进程、释放 8084（后端）和 3002（前端）端口，再重新部署。部署前记得 commit + push 代码。

### 后端开发
```bash
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 前端开发
```bash
cd frontend && npm install
npm run dev          # 开发服务器 localhost:5173
npm run build        # 生产构建
```

### 定时脚本
```bash
# 报告和推荐已改为通过前端 Settings 页面按钮触发，无需手动执行
```

## 架构要点

### 后端结构
- `app/routers/` — API 路由定义（Analysis/Report/Recommend/Stock）
- `app/services/` — 业务逻辑层（report_service 处理报告生成，recommend_service 处理推荐）
- `app/utils/akshare_utils.py` — 数据源封装，统一腾讯代码格式（`_to_tencent_code` / `_from_tencent_code`）
- `app/utils/ai_client.py` — LLM 客户端

### 前端结构
- `pages/DailyReport.tsx` — 核心页面，三个 Tab：市场报告 / 量化推荐 / 收益跟踪
- `services/api.ts` — API 调用层

### 数据流向
1. 推荐生成：THS 服务端选股池（理想选股 + 持续强势股，~500只）→ 并发获取日线，MA5>MA10>MA20 多头筛选 → AI 精选 5 只 → 存入 MySQL
2. 收益跟踪：`update_recommend_prices` 只更新 `tracking_days < 3` 的记录，每天推进一天，3 天后冻结
3. 市场报告：AKShare 指数数据 + 板块数据 + AI 分析报告 → MySQL + 文件系统

### 关键约束
- 数据源：新浪被封，使用 EastMoney 数据中心 + 腾讯财经批量接口
- 推荐生成约 60 秒，cron 和手动接口均为同步调用（不走异步队列）
- cron 执行时间：每天 16:00（A股收盘后）
- `get_trade_dates_for_frontend` 公共函数在 `akshare_utils.py`，两个 service 共用

### 数据库
- MySQL `111.231.107.210:13306`，库名 `prompt`
- 核心表：`market_reports`（市场报告）、`recommendations`（量化推荐）

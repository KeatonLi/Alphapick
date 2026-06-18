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

## 设计系统

### 设计理念：Liquid Glass Finance（液态玻璃金融）

QuantForge 的设计语言基于两个核心原则：
1. **毛玻璃层次感** — 卡片使用 `backdrop-filter: blur()` 产生透视玻璃效果，而非纯色块，营造"净透亮"的空间纵深感
2. **金融灰基调** — 避免纯黑/纯白，使用暖灰和冷灰的微妙渐变，传递专业、冷静、可信赖的金融工具气质

### 色彩系统

#### 暗色主题 — "Frosted Charcoal"（霜炭灰）
| 层级 | 变量 | 色值 | 用途 |
|------|------|------|------|
| 页面基底 | `--bg-page` | `#1a1a1e` | 暖炭灰，非纯黑 |
| 玻璃卡片 | `--bg-card` | `rgba(255,255,255,0.04)` | 毛玻璃主体 |
| 悬浮卡片 | `--bg-elevated` | `rgba(255,255,255,0.07)` | 次级容器 |
| 导航栏 | `--bg-nav` | `rgba(24,24,28,0.85)` | 强模糊导航 |
| 主强调色 | `--accent` | `#818cf8` | indigo-400，柔和紫蓝 |
| 亮强调色 | `--accent-light` | `#a5b4fc` | indigo-300 |
| 涨色 | `--up` | `#f87171` | A股红涨 |
| 跌色 | `--down` | `#34d399` | A股绿跌 |
| 主文字 | `--text-primary` | `#f5f5f7` | 95% 白 |
| 次文字 | `--text-secondary` | `rgba(255,255,255,0.60)` | 60% 白 |
| 辅助文字 | `--text-muted` | `rgba(255,255,255,0.36)` | 36% 白 |
| 卡片边框 | `--border-default` | `rgba(255,255,255,0.08)` | 微弱边框 |

#### 亮色主题 — "Silver Mist"（银雾白）
| 层级 | 变量 | 色值 | 用途 |
|------|------|------|------|
| 页面基底 | `--bg-page` | `#f5f5f7` | Apple 冷灰白 |
| 玻璃卡片 | `--bg-card` | `rgba(255,255,255,0.70)` | 半透白玻璃 |
| 悬浮卡片 | `--bg-elevated` | `rgba(255,255,255,0.85)` | 更不透明白 |
| 导航栏 | `--bg-nav` | `rgba(245,245,247,0.80)` | 模糊导航 |
| 主强调色 | `--accent` | `#5856d6` | 深 indigo |
| 亮强调色 | `--accent-light` | `#7c7cf8` | 浅 indigo |
| 涨色 | `--up` | `#ff3b30` | A股红涨 |
| 跌色 | `--down` | `#34c759` | A股绿跌 |
| 主文字 | `--text-primary` | `#1c1c1e` | 95% 黑 |
| 次文字 | `--text-secondary` | `#636366` | iOS gray-500 |
| 卡片边框 | `--border-default` | `rgba(0,0,0,0.08)` | 微弱边框 |

### 毛玻璃实现

所有 `.card` 类统一使用：
```css
background: var(--bg-card);
backdrop-filter: blur(40px) saturate(180%);
-webkit-backdrop-filter: blur(40px) saturate(180%);
border: 1px solid var(--border-default);
```

亮色和暗色都使用毛玻璃效果。暗色下玻璃透视产生深度感，亮色下产生清透感。

### 排版

- **正文字体**: System font stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`（Mac 上渲染为 SF Pro，Windows 上为 Segoe UI，都是各自平台最优正文字体）
- **等宽字体**: `'JetBrains Mono', 'SF Mono', monospace` — 用于数字、代码、价格展示
- **字重策略**: Light(300) 极少使用，Regular(400) 用于正文，Medium(500) 用于标签，Semibold(600) 用于标题，Bold(700)+ 用于 Hero

### 动效原则

1. **首页叙事式滚动** — 使用 Intersection Observer，各区块从右侧滑入 + 淡入，延迟递增，让滚动如同翻阅精心编排的演示文稿
2. **卡片悬浮** — `transform: translateY(-2px)` + 阴影增强，200ms ease-out
3. **状态切换** — 主题切换、数据加载使用 300ms ease 过渡
4. **数字滚动** — 统计数据使用 count-up 动画，从 0 递增到目标值

### 空间与布局

- 最大内容宽度 `max-w-5xl`（1024px），大屏居中
- 卡片间距 16-20px，内外边距充裕
- 圆角系统：卡片 20px（暗）/ 16px（亮），按钮 8-12px，标签 100px（胶囊）
- 玻璃卡片之间保留足够间距，让背景光晕透过

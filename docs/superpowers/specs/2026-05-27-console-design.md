# 控制台功能设计

**日期：** 2026-05-27
**状态：** 已确认

## 目标

将现有 SettingsPage 升级为 ConsolePage（控制台），新增推荐、报告、跟踪、海报的 CRUD 管理能力。

## 整体布局

页面顶部保留日期选择器，下方用 Tab 切换五个功能区：

| Tab | 功能 |
|-----|------|
| 智能推荐 | 按天增删改推荐 + AI 一键生成 + 更新现价 |
| 市场报告 | 编辑/删除报告内容 + AI 一键生成 |
| 收益跟踪 | 按日期触发价格更新，展示跟踪状态 |
| 海报管理 | 预览、下载、删除海报 |
| 系统设置 | 定时任务配置（保留原设置页内容） |

## 各模块设计

### Tab 1: 智能推荐管理

**数据流：** 选择日期 → 加载该日推荐列表 → 按天操作

- 表格展示：#、股票代码、名称、推荐价、收益率、跟踪状态
- 底部统计：共 X 只，胜率 XX%，平均收益 XX%
- 「编辑整组」：弹窗展示该日所有推荐，可修改任意一条的价格/理由，或删除某条
- 「删除整组」：二次确认后删除该日所有推荐记录
- 「AI 一键生成」：调 `/generate/recommend?date=xxx`，有进度条，完成后刷新列表
- 「更新现价」：调 `/recommend/update-prices`

### Tab 2: 市场报告管理

**数据流：** 选择日期 → 加载报告 → 操作

- 展示市场概况、AI 分析文本、指数数据、板块数据
- 「编辑市场概况」：弹窗 textarea 编辑
- 「编辑 AI 分析」：弹窗 textarea 编辑
- 「删除报告」：二次确认删除
- 「AI 一键生成」：调 `/generate/report?date=xxx`，有进度条

### Tab 3: 收益跟踪

**数据流：** 选择日期 → 展示该日推荐的跟踪状态

- 表格：#、代码、名称、跟踪天数、当前价、收益率
- 「触发更新」：调 `/recommend/update-prices`，完成后刷新

### Tab 4: 海报管理

- 预览：调 `/report/poster/base64` 展示
- 下载：调 `/report/poster` 触发下载
- 生成：调 `/report/poster?date=xxx` 生成
- 删除：清除服务端缓存文件

### Tab 5: 系统设置

保留原 SettingsPage 的定时任务配置功能。

## 后端新增接口

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/recommend/day/{date}` | 编辑某日推荐（批量更新/删除单条） |
| DELETE | `/api/recommend/day/{date}` | 删除某日全部推荐 |
| PUT | `/api/report/day/{date}` | 编辑报告文本（market_summary/ai_report） |
| DELETE | `/api/report/day/{date}` | 删除某日报告 |
| DELETE | `/api/report/poster/{date}` | 删除海报缓存 |

## 前端文件变更

| 文件 | 变更 |
|------|------|
| `frontend/src/pages/SettingsPage.tsx` | 重命名为 ConsolePage，加入 Tab 布局和 CRUD 功能 |
| `frontend/src/App.tsx` | 路由 `/settings` → `/console` |
| `frontend/src/components/Navbar.tsx` | 导航项"设置"改为"控制台" |
| `frontend/src/services/api.ts` | 新增推荐和报告的 API 调用 |
| `backend/app/routers/recommend.py` | 新增按天编辑/删除接口 |
| `backend/app/routers/report.py` | 新增按天编辑/删除接口 + 海报删除接口 |
| `backend/app/services/recommend_service.py` | 新增按天编辑/删除函数 |
| `backend/app/services/report_service.py` | 新增编辑/删除报告函数 |

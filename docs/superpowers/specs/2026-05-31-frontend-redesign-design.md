# QuantForge 前端重构设计规范

> 2026-05-31 | 交易日选择器 + 侧边栏导航 + 暗色主题唯一

## 1. 目标

1. **统一交易日选择器** — 所有页面使用同一个 `TradeDatePicker` 组件，只能选交易日，杜绝选到周末/节假日
2. **侧边栏导航** — 左侧固定竖排导航 + 右侧内容区，替代当前顶部横排导航
3. **暗色主题唯一** — 移除亮色切换，专注打磨暗色主题，增强层次感和可读性

## 2. 交易日选择器 TradeDatePicker

### 2.1 组件接口

```tsx
interface TradeDatePickerProps {
  value: string              // 当前选中日期 YYYY-MM-DD
  onChange: (date: string) => void
  tradeDates: string[]       // 交易日列表（降序，最新在前）
}
```

### 2.2 行为规范

- 只有 `tradeDates` 列表中的日期可选
- 左右箭头在列表中前后跳转，到达边界时禁用
- "返回今日"按钮一键跳到 `tradeDates[0]`（最近交易日）
- 组件内部显示星期几

### 2.3 涉及页面

| 页面 | 替换位置 |
|------|---------|
| ReportPage | 替换 pills + date input + 箭头按钮 |
| RecommendPage | 替换 date input + 箭头按钮 |
| PosterPage | 替换 date input + 箭头按钮 |
| SettingsPage | 替换 date input，需要新增 tradeDates 拉取 |
| AnalysisPage | start/end 替换为 TradeDatePicker |

### 2.4 交易日数据

- 统一通过 `GET /api/report/trade-dates?days=365` 获取
- 提取为全局 hook `useTradeDates()` 缓存，避免重复请求

## 3. 侧边栏导航

### 3.1 布局结构

```
┌──────────┬─────────────────────────────────────┐
│ Logo     │  ┌─ 页面标题 + 描述 ─────────────┐  │
│          │  │                                │  │
│ 📊 首页  │  │   TradeDatePicker (页面可选)   │  │
│ 📰 报告  │  │                                │  │
│ 🎯 推荐  │  ├────────────────────────────────┤  │
│ 📈 跟踪  │  │                                │  │
│ 🔍 分析  │  │   页面主体内容                  │  │
│ 🖼️ 海报  │  │                                │  │
│ ⚙️ 设置  │  │                                │  │
│          │  │                                │  │
│ ──────── │  │                                │  │
│ 👤 用户  │  │                                │  │
└──────────┴─────────────────────────────────────┘
```

### 3.2 侧边栏规格

- 宽度 220px，固定 `position: fixed`，不随内容滚动
- Logo 区域：图标 + "QuantForge" 文字，高度 64px
- 导航项：图标 + 文字，padding 12px 16px，gap 4px
- 当前页面导航项：accent 色背景 + 左侧 3px accent 色竖条
- 底部用户区：分隔线 + 登录/注册或用户头像
- 背景：`rgba(15, 15, 20, 0.92)` + `backdrop-filter: blur(40px)`
- 边框：右侧 `1px solid rgba(255,255,255,0.06)`

### 3.3 内容区域

- `margin-left: 220px`，padding 40px 32px
- 最大宽度 960px，居中
- 统一顶部 header（页面标题 + 描述 + TradeDatePicker）

### 3.4 导航项映射

| 路由 | 图标 | 文字 |
|------|------|------|
| / | 📊 | 首页 |
| /report | 📰 | 市场报告 |
| /recommend | 🎯 | 量化推荐 |
| /tracking | 📈 | 收益跟踪 |
| /analysis | 🔍 | 数据分析 |
| /poster | 🖼️ | 市场海报 |
| /settings | ⚙️ | 设置 |

## 4. 暗色主题唯一

### 4.1 色彩系统

| 变量 | 色值 | 说明 |
|------|------|------|
| `--bg-page` | `#0f0f14` | 页面基底，深炭黑 |
| `--bg-sidebar` | `rgba(15,15,20,0.92)` | 侧边栏 |
| `--bg-card` | `rgba(255,255,255,0.06)` | 玻璃卡片 |
| `--bg-card-hover` | `rgba(255,255,255,0.10)` | 悬浮状态 |
| `--bg-elevated` | `rgba(255,255,255,0.08)` | 次级容器 |
| `--bg-input` | `rgba(255,255,255,0.08)` | 输入框背景 |
| `--text-primary` | `#f5f5f7` | 主文字 |
| `--text-secondary` | `rgba(255,255,255,0.60)` | 次要文字 |
| `--text-muted` | `rgba(255,255,255,0.36)` | 辅助文字 |
| `--text-dim` | `rgba(255,255,255,0.18)` | 不可用文字 |
| `--accent` | `#6366f1` | 主强调色 indigo-500 |
| `--accent-light` | `#818cf8` | 浅强调色 |
| `--accent-bg` | `rgba(99,102,241,0.12)` | 强调色背景 |
| `--accent-glow` | `rgba(99,102,241,0.06)` | 光晕 |
| `--up` | `#ef4444` | 涨 (A股红) |
| `--down` | `#10b981` | 跌 (A股绿) |
| `--border-default` | `rgba(255,255,255,0.08)` | 边框 |
| `--border-hover` | `rgba(255,255,255,0.14)` | 悬浮边框 |

### 4.2 排版

- 正文字体：`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`（保持）
- 等宽字体：`'JetBrains Mono', monospace`（保持）
- 基础字号调整：正文 14px（从 16px 下调），小字 12px，标签 10px
- 行高：正文 1.6，标题 1.2~1.3

### 4.3 需要删除的内容

- `[data-theme="light"]` 所有 CSS 变量
- `ThemeContext.tsx` 中的亮色逻辑
- Navbar 中的主题切换按钮 ☀️
- `.ambient-glow-top` / `.ambient-glow-bottom` 的 `[data-theme="dark"]` 前缀（变为全局）
- `index.css` 中 `:root, [data-theme="dark"]` 改为 `:root`

### 4.4 卡片系统

- 毛玻璃效果保持：`backdrop-filter: blur(40px) saturate(180%)`
- 圆角统一 12px（从暗色 20px / 亮色 16px 统一）
- 悬浮效果：`translateY(-1px)` + 边框变亮

## 5. 实现范围

### 5.1 新建文件

| 文件 | 说明 |
|------|------|
| `src/components/Sidebar.tsx` | 侧边栏导航组件 |
| `src/components/TradeDatePicker.tsx` | 交易日选择器组件 |
| `src/hooks/useTradeDates.ts` | 交易日列表全局 hook |

### 5.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/index.css` | 删除亮色主题，重校准暗色变量，调整排版 |
| `src/App.tsx` | 添加 Sidebar 布局壳 |
| `src/contexts/ThemeContext.tsx` | 移除亮色切换逻辑 |
| `src/components/Navbar.tsx` | 删除（被 Sidebar 替代） |
| `src/pages/ReportPage.tsx` | 替换日期选择 + 套用新布局 |
| `src/pages/RecommendPage.tsx` | 替换日期选择 + 套用新布局 |
| `src/pages/PosterPage.tsx` | 替换日期选择 + 套用新布局 |
| `src/pages/SettingsPage.tsx` | 替换日期选择 + 套用新布局 |
| `src/pages/AnalysisPage.tsx` | 替换日期选择 + 套用新布局 |
| `src/pages/HomePage.tsx` | 套用新布局 |
| `src/pages/TrackingPage.tsx` | 套用新布局 |
| `src/pages/LoginPage.tsx` | 套用新布局 |
| `src/pages/RegisterPage.tsx` | 套用新布局 |
| `src/pages/StockDailyPage.tsx` | 套用新布局 |

## 6. 不在此范围

- 后端 API 修改
- 新增业务功能
- 移动端适配
- 夜间/日间主题切换（已明确只保留暗色）
- 国际化

# CLAUDE.md

> Claude Code 辅助文档。**开发规范、SDD 工作流、架构、命令以 `@AGENTS.md` 为准**，本文件只承载主文档引用的辅助细节（设计系统）。

## 设计系统：Liquid Glass Finance（液态玻璃金融）

QuantForge 的设计语言基于两个核心原则：

1. **毛玻璃层次感** — 卡片使用 `backdrop-filter: blur()` 产生透视玻璃效果，而非纯色块
2. **金融灰基调** — 避免纯黑/纯白，使用暖灰和冷灰的微妙渐变，传递专业、冷静、可信赖的金融工具气质

> 色值与实现细节以 `frontend/src/index.css` 中的 CSS 变量为准（本文件为设计意图说明）。

### 色彩系统

#### 暗色主题 — "Frosted Charcoal"（霜炭灰）
| 层级 | 变量 | 用途 |
|------|------|------|
| 页面基底 | `--bg-page` | 暖炭灰，非纯黑 |
| 玻璃卡片 | `--bg-card` | 毛玻璃主体 |
| 主强调色 | `--accent` | indigo 柔和紫蓝 |
| 涨色 | `--up` | A股红涨 |
| 跌色 | `--down` | A股绿跌 |
| 主文字 | `--text-primary` | 95% 白 |

#### 亮色主题 — "Silver Mist"（银雾白）
| 层级 | 变量 | 用途 |
|------|------|------|
| 页面基底 | `--bg-page` | Apple 冷灰白 |
| 玻璃卡片 | `--bg-card` | 半透白玻璃 |
| 主强调色 | `--accent` | 深 indigo |
| 涨色 | `--up` | A股红涨 |
| 跌色 | `--down` | A股绿跌 |
| 主文字 | `--text-primary` | 95% 黑 |

### 毛玻璃实现

```css
background: var(--bg-card);
backdrop-filter: blur(40px) saturate(180%);
-webkit-backdrop-filter: blur(40px) saturate(180%);
border: 1px solid var(--border-default);
```

### 排版

- **正文字体**：System font stack（`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`）
- **等宽字体**：`'JetBrains Mono', 'SF Mono', monospace` — 用于数字、代码、价格展示
- **字重策略**：Regular(400) 正文 / Medium(500) 标签 / Semibold(600) 标题 / Bold(700)+ Hero

### 动效原则

1. **叙事式滚动** — Intersection Observer，区块右侧滑入 + 淡入，延迟递增
2. **卡片悬浮** — `translateY(-2px)` + 阴影增强，200ms ease-out
3. **状态切换** — 主题切换、数据加载 300ms ease
4. **数字滚动** — 统计数据 count-up 动画

### 空间与布局

- 最大内容宽度 `max-w-5xl`（1024px），大屏居中
- 卡片间距 16-20px；圆角：卡片 20px（暗）/16px（亮），按钮 8-12px，标签胶囊
- 玻璃卡片间保留足够间距，让背景光晕透过

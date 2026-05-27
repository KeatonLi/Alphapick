# 扩展数据分析功能设计文档

## 背景

QuantForge 已完成基础数据分析功能（周几胜率、持仓周期、收益分布），用户希望扩展更多分析维度，挖掘历史数据价值。新功能将添加价格区间、股票代码类型、收益波动性、成功率趋势四个分析维度。

## 目标

1. **价格区间分析**：分析不同价格区间（低价/中价/高价股）的推荐效果
2. **股票代码类型分析**：分析不同代码类型（60主板/00中小板/002创业板）的推荐效果
3. **收益波动性分析**：分析推荐股票的最大收益和最大回撤，评估风险特征
4. **成功率趋势分析**：分析推荐成功率是否随时间改善，评估 AI 模型进化

## 非目标

- 不做实时行情分析
- 不做持仓和交易功能
- 不做 AI 策略建议
- 不做预测分析

## 架构设计

### Tab 结构

```
数据分析页面
├── Tab 1: 基础分析（现有）
│   ├── 周几胜率柱状图
│   ├── 持仓周期折线图
│   ├── 收益分布直方图
│   └── 洞察卡片
│
└── Tab 2: 扩展分析（新增）
    ├── 第一行：价格区间 + 股票代码类型
    │   ├── 价格区间胜率图（柱状图）
    │   └── 股票代码类型胜率图（柱状图）
    │
    ├── 第二行：收益波动性 + 成功率趋势
    │   ├── 最大收益/最大回撤分析（柱状图）
    │   └── 成功率趋势折线图
    │
    └── 洞察卡片（汇总所有洞察）
```

### 新增 API 端点

| 端点 | 功能 | 返回值结构 |
|-----|------|-----------|
| `GET /api/analysis/price-range-stats` | 价格区间统计 | `{data: {"低价股": {...}, "中价股": {...}, "高价股": {...}}, summary: {...}}` |
| `GET /api/analysis/stock-type-stats` | 股票代码类型统计 | `{data: {"60主板": {...}, "00中小板": {...}, "002创业板": {...}}, summary: {...}}` |
| `GET /api/analysis/volatility-stats` | 收益波动性统计 | `{data: {"avg_max_gain": ..., "avg_max_drawdown": ..., ...}}` |
| `GET /api/analysis/success-trend` | 成功率趋势 | `{data: [{"month": "2025-01", "win_rate": 0.65, "count": 20}, ...]}` |

### 数据来源

**价格区间分析**：
- 从 `recommendations` 表获取 `recommend_price`
- 按价格分组：低价股 <10元、中价股 10-50元、高价股 >50元

**股票代码类型分析**：
- 从 `recommendations` 表获取 `stock_code`
- 按代码前缀分组：60开头（主板）、00开头（中小板）、002开头（创业板）

**收益波动性分析**：
- 从 `recommendations` 表获取 `max_gain` 和 `max_drawdown`
- 统计平均最大收益和平均最大回撤

**成功率趋势分析**：
- 从 `recommendations` 表按月分组统计
- 计算每月的胜率和推荐数量

## 界面设计

### 扩展分析 Tab 布局

```
┌─────────────────────────────────────────────────────────────┐
│  📊 数据分析                    [基础分析] [扩展分析]  [日期筛选] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐       │
│  │  价格区间胜率          │  │  股票代码类型胜率    │       │
│  │  [柱状图]            │  │  [柱状图]            │       │
│  │                      │  │                      │       │
│  │  低价股 ████████ 68% │  │  60主板 ████████ 65% │       │
│  │  中价股 ██████   58% │  │  00中小 ██████  60% │       │
│  │  高价股 ████     52% │  │  002创业 ████   55% │       │
│  └──────────────────────┘  └──────────────────────┘       │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐       │
│  │  收益波动性分析        │  │  成功率趋势          │       │
│  │  [柱状图]            │  │  [折线图]            │       │
│  │                      │  │                      │       │
│  │  最大收益  ████ 8.5% │  │  胜率%               │       │
│  │  最大回撤  ███  5.2% │  │    ▲    ●           │       │
│  │                      │  │    │  /   \          │       │
│  │                      │  │    │ ●     ●         │       │
│  │                      │  │    └──────────►      │       │
│  │                      │  │    1月 2月 3月 4月   │       │
│  └──────────────────────┘  └──────────────────────┘       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💡 关键洞察                                         │   │
│  │  • 低价股推荐胜率最高（68%），比高价股高16%          │   │
│  │  • 60主板推荐效果最好，平均收益3.2%                  │   │
│  │  • 近3个月成功率呈上升趋势，AI模型在持续优化         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 数据模型

### 使用的现有字段

```sql
-- recommendations 表
recommend_date      DATE           -- 推荐日期
stock_code          VARCHAR(10)    -- 股票代码（用于代码类型分析）
recommend_price     DECIMAL(10,3)  -- 推荐价格（用于价格区间分析）
final_return_rate   DECIMAL(10,4)  -- 最终收益率（用于胜率计算）
max_gain            DECIMAL(10,4)  -- 最高收益率（用于波动性分析）
max_drawdown        DECIMAL(10,4)  -- 最大回撤（用于波动性分析）
```

### 新增计算字段（内存计算）

```python
# 价格区间分组
price_range = "低价股" if price < 10 else "中价股" if price < 50 else "高价股"

# 股票代码类型分组
stock_type = "60主板" if code.startswith("60") else "00中小板" if code.startswith("00") else "002创业板"

# 月份提取
month = recommend_date.strftime("%Y-%m")
```

## API 设计

### 1. 价格区间统计

```
GET /api/analysis/price-range-stats?start_date=2025-01-01&end_date=2025-12-31
```

**响应**：
```json
{
  "data": {
    "低价股": {
      "count": 50,
      "win_count": 34,
      "win_rate": 0.68,
      "avg_return": 0.035,
      "avg_price": 8.5
    },
    "中价股": {
      "count": 120,
      "win_count": 70,
      "win_rate": 0.58,
      "avg_return": 0.022,
      "avg_price": 25.3
    },
    "高价股": {
      "count": 80,
      "win_count": 42,
      "win_rate": 0.52,
      "avg_return": 0.015,
      "avg_price": 65.2
    }
  },
  "summary": {
    "total_recommendations": 250,
    "best_range": "低价股",
    "worst_range": "高价股"
  }
}
```

### 2. 股票代码类型统计

```
GET /api/analysis/stock-type-stats?start_date=2025-01-01&end_date=2025-12-31
```

**响应**：
```json
{
  "data": {
    "60主板": {
      "count": 150,
      "win_count": 98,
      "win_rate": 0.65,
      "avg_return": 0.032
    },
    "00中小板": {
      "count": 60,
      "win_count": 36,
      "win_rate": 0.60,
      "avg_return": 0.028
    },
    "002创业板": {
      "count": 40,
      "win_count": 22,
      "win_rate": 0.55,
      "avg_return": 0.020
    }
  },
  "summary": {
    "total_recommendations": 250,
    "best_type": "60主板",
    "worst_type": "002创业板"
  }
}
```

### 3. 收益波动性统计

```
GET /api/analysis/volatility-stats?start_date=2025-01-01&end_date=2025-12-31
```

**响应**：
```json
{
  "data": {
    "avg_max_gain": 0.085,
    "avg_max_drawdown": -0.052,
    "max_gain_count": 180,
    "max_drawdown_count": 180,
    "gain_drawdown_ratio": 1.63
  },
  "summary": {
    "total_recommendations": 250,
    "risk_level": "中等",
    "insight": "平均最大收益8.5%，平均最大回撤5.2%，收益风险比1.63"
  }
}
```

### 4. 成功率趋势

```
GET /api/analysis/success-trend?start_date=2025-01-01&end_date=2025-12-31
```

**响应**：
```json
{
  "data": [
    {"month": "2025-01", "win_rate": 0.55, "count": 20, "avg_return": 0.018},
    {"month": "2025-02", "win_rate": 0.58, "count": 22, "avg_return": 0.022},
    {"month": "2025-03", "win_rate": 0.62, "count": 25, "avg_return": 0.028},
    ...
  ],
  "summary": {
    "total_months": 12,
    "trend": "上升",
    "avg_monthly_win_rate": 0.58,
    "best_month": "2025-03",
    "worst_month": "2025-01"
  }
}
```

## 实现计划

### 第一阶段：后端 API（2天）

1. 扩展 `analysis_service.py`
   - 实现 `get_price_range_stats()`
   - 实现 `get_stock_type_stats()`
   - 实现 `get_volatility_stats()`
   - 实现 `get_success_trend()`

2. 扩展 `app/routers/analysis.py`
   - 添加4个新端点
   - 添加参数验证

3. 测试 API 端点

### 第二阶段：前端页面（3天）

1. 安装依赖（如需要）

2. 创建新组件
   - `PriceRangeChart.tsx` - 价格区间胜率图
   - `StockTypeChart.tsx` - 股票代码类型胜率图
   - `VolatilityChart.tsx` - 收益波动性分析图
   - `SuccessTrendChart.tsx` - 成功率趋势折线图

3. 扩展 AnalysisPage
   - 添加 Tab 切换功能
   - 集成新组件
   - 实现数据加载

4. 更新 API 调用层
   - 在 `services/api.ts` 添加新接口

### 第三阶段：优化与测试（1天）

1. 性能优化
2. 用户体验优化
3. 手动测试

## 风险与应对

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| 历史数据量不足 | 统计结果不准确 | 显示数据量提示 |
| 价格区间划分不合理 | 分析结果偏差 | 使用灵活的区间配置 |
| 趋势分析时间跨度不够 | 趋势不明显 | 支持自定义时间范围 |

## 成功指标

1. **功能完整性**：4个分析维度全部实现
2. **性能**：API 响应时间 < 2秒
3. **用户体验**：Tab 切换流畅，图表清晰
4. **数据准确性**：统计结果与手动计算一致

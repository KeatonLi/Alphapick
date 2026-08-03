# ANL — 智能股票分析规格

> 主功能：输入股票名称或代码，自动生成多维度分析报告，给出中期（1-3 月）buy/hold 结论。
> 数据只读数据库，结论由 LLM 主导，结果入库可查历史。

## ANL-001 分析触发与输入解析
- 状态：✅ 已实现
- 需求：用户输入股票代码或名称即可触发分析；名称解析为代码只查库内已收录数据，不请求外部接口。
- 验收标准：
  - [x] 输入 6 位数字代码（可带 sh/sz/bj 前缀）直接识别为代码
  - [x] 输入名称时在库内快照/日线表精确或模糊匹配到唯一代码
  - [x] 库内无该股票任何数据时返回明确错误，不生成报告
  - [x] 匹配到多只时返回歧义列表由用户选择（或明确报错）
- 测试：`backend/tests/test_analyze_service.py`

## ANL-002 数据只读约束
- 状态：✅ 已实现
- 需求：分析的事实包只从已归一化数据库读取（快照/日线/候选池/推荐），不得请求外部行情。
- 验收标准：
  - [x] 事实包生成过程不调用任何外部行情接口（多源管理器不被引用）
  - [x] 数据缺失（如 PE/PB 缺失）降级标记，不静默伪造数据
- 测试：`backend/tests/test_analyze_service.py`

## ANL-003 事实包构成
- 状态：✅ 已实现
- 需求：事实包包含基本信息、技术面、量化因子、估值四类事实，供 LLM 决策。
- 验收标准：
  - [x] 技术面含近 60 日 MA5/20/60、MACD、KDJ、区间涨跌、波动率
  - [x] 量化因子复用 `strategy_service.score_candidate` 输出五因子与总分
  - [x] 估值含最新快照 PE/PB，可与全市场对比给出百分位
  - [x] 报告标注数据截至日期 `data_asof`
- 测试：`backend/tests/test_analyze_service.py`（FactPackTests / NameResolutionTests）

## ANL-004 结论生成（LLM 结构化输出）
- 状态：✅ 已实现
- 需求：LLM 基于事实包一次调用输出结构化 JSON：buy/hold 决策、置信度 0-100、一句话结论、多维度理由。
- 验收标准：
  - [x] 输出可解析为 `{decision, confidence, summary, reasons, dimensions}`
  - [x] decision 仅允许 buy/hold，其余值视为解析失败
  - [x] LLM 返回非法 JSON 时自动重试 1 次，仍失败返回明确错误且不入库
- 测试：`backend/tests/test_analyze_service.py`（LLMParseTests）

## ANL-005 结果入库与历史
- 状态：✅ 已实现
- 需求：分析结果存入 `stock_analyses` 表，支持按创建时间倒序查询历史列表与单条详情。
- 验收标准：
  - [x] 字段齐全：code/name/decision/confidence/summary/technicals/factors/valuation/reasons/data_asof/created_at
  - [x] 历史列表按时间倒序，单条详情完整返回
- 测试：`backend/tests/test_analyze_api.py`

## ANL-006 前端交互
- 状态：✅ 已实现
- 需求：独立页面 `/analyze`，搜索框输入代码/名称触发分析，展示结论横幅、分维度卡片与历史记录。
- 验收标准：
  - [x] 导航栏新增"智能分析"入口
  - [x] 分析中显示加载态，完成后展示 BUY/HOLD 横幅 + 置信度 + summary + 技术/因子/估值维度
  - [x] 历史记录区可查看并点选查看详情
- 测试：`frontend/scripts/smoke-pages.mjs`（页面冒烟）

## ANL-007 接口契约
- 状态：✅ 已实现
- 需求：`/api/analyze` 提供创建、历史列表、单条详情三个接口，登录可用并限流。
- 验收标准：
  - [x] POST `/api/analyze` body `{query}` 返回完整报告
  - [x] GET `/api/analyze` 返回历史列表（limit 参数）
  - [x] GET `/api/analyze/{id}` 返回单条详情
  - [x] 限流：创建 10/min，查询 60/min
- 测试：`backend/tests/test_analyze_api.py`



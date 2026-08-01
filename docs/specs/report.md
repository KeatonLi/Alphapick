# REPORT — 市场报告规格

## REPORT-001 报告生成数据源
- 状态：✅ 已实现
- 需求：报告只从已落库数据读取（指数/板块/北向/涨停），不直接请求外部行情接口。
- 验收标准：
  - [ ] 生成过程调用 `display.data_reader` 只读层，不触发多源管理器
  - [ ] 指数数据缺失时生成失败并说明
  - [ ] 板块/北向/涨停缺失时降级跳过（不阻塞报告）
- 测试：`backend/tests/test_scheduler_workflow.py::test_configured_workflow_runs_report_recommend_and_returns`

## REPORT-002 报告内容结构
- 状态：✅ 已实现
- 需求：报告包含：市场总览、今日亮点、涨停板分析、注意事项、风险提醒。
- 验收标准：
  - [ ] `market_reports` 表字段齐全：index_data/hot_sectors/ai_report/yesterday_limit_ups/today_limit_up_data/hsgt_flow/sectors_full
  - [ ] AI 输出解析失败时回退原文保存，不丢报告
- 测试：`backend/tests/test_api_endpoints.py`（外部连通）、端到端验证

## REPORT-003 涨停板分析维度
- 状态：✅ 已实现
- 需求：涨停板分析包含：行业分布、连板股、一字板、换手板、封单强度 Top10、最高连板数、昨日涨停今日表现。
- 验收标准：
  - [ ] 昨日涨停代码可查今日表现并计算平均涨幅
  - [ ] 昨日报告不存在时该指标为空不报错
- 测试：端到端验证（生成后读取报告）

## REPORT-004 生成幂等
- 状态：✅ 已实现
- 需求：同日报告已生成（含 AI 内容）则跳过。
- 验收标准：
  - [ ] 重复生成返回 success 并提示已存在
- 测试：`backend/tests/test_scheduler_workflow.py`

## REPORT-005 报告查询与历史
- 状态：✅ 已实现
- 需求：支持按日期查询报告、历史报告列表、报告日期列表、交易日列表。
- 验收标准：
  - [ ] `/api/report/daily?date=`、`/history`、`/dates`、`/trade-dates` 可用
  - [ ] 报告涨停数据优先读库，缺失时回退原始数据实时解析
- 测试：`backend/tests/test_integration.py::test_report`（端到端）

## REPORT-006 报告编辑与删除
- 状态：✅ 已实现
- 需求：管理员可按日编辑报告字段、删除指定日期报告与海报。
- 验收标准：
  - [ ] PUT `/api/report/day/{date}`、DELETE `/api/report/day/{date}`、DELETE `/api/report/poster/{date}` 可用
- 测试：路由层验证

## REPORT-007 海报生成
- 状态：✅ 已实现
- 需求：支持将报告生成海报图片（Base64 或文件路径）。
- 验收标准：
  - [ ] `/api/report/poster`、`/api/report/poster/base64` 返回图片数据
- 测试：无自动测试（Pillow 渲染），人工验证

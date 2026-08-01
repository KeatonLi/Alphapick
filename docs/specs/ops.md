# OPS — 运维与调度规格

## OPS-001 单日完整闭环
- 状态：✅ 已实现
- 需求：一键执行：采集全部 6 类数据 → 生成报告 → 生成推荐 → 更新收益。
- 验收标准：
  - [ ] 采集存在失败时立即中止，不执行报告/推荐，返回失败原因
  - [ ] 成功后返回采集明细与生成任务 ID
- 测试：`backend/tests/test_business_routes.py::test_run_daily_stops_when_fetch_fails`

## OPS-002 区间回测
- 状态：✅ 已实现
- 需求：起止日期内逐交易日（工作日）独立采集+生成，重复执行不产生重复数据，最后统一更新收益。
- 验收标准：
  - [ ] 采集失败的日期跳过生成并记录原因
  - [ ] 工作日才处理，周末跳过
  - [ ] 幂等：已有推荐日期不重复生成
- 测试：`backend/tests/test_business_routes.py::test_backtest_skips_generation_for_failed_fetch_days`

## OPS-003 单独操作
- 状态：✅ 已实现
- 需求：支持只采集、只生成推荐、只更新收益的单独触发。
- 验收标准：
  - [ ] `/api/ops/fetch`、`/generate-picks`、`/update-returns` 可用且仅执行对应步骤
- 测试：`backend/tests/test_business_routes.py`（路由注册）

## OPS-004 异步任务
- 状态：✅ 已实现
- 需求：报告/推荐/全流程生成在后台线程执行，任务可查询进度（步骤/百分比）与结果；失败记录错误信息。
- 验收标准：
  - [ ] 任务状态：pending → running → completed / failed
  - [ ] 推荐任务完成时返回候选股票 JSON
- 测试：`backend/tests/test_business_routes.py`、端到端验证

## OPS-005 定时任务配置
- 状态：✅ 已实现
- 需求：可配置开关、运行时间（HH:MM）、是否生成报告/推荐/更新收益；配置联动 APScheduler。
- 验收标准：
  - [ ] 非法时间格式返回 400
  - [ ] 保存配置后调度器按新时间启停任务
  - [ ] 每次执行记录 last_run_at 与 last_run_result
- 测试：`backend/tests/test_scheduler_workflow.py`、`test_integration.py::test_schedule`

## OPS-006 非交易日跳过
- 状态：✅ 已实现
- 需求：定时任务在非交易日自动跳过，不采集不生成，结果明确标记"非交易日跳过"。
- 验收标准：
  - [ ] 非交易日执行后 last_run_result 含跳过标记
  - [ ] 不触发任何 fetcher
- 测试：`backend/tests/test_scheduler_workflow.py::test_daily_fetch_skips_non_trading_day_before_fetching`

## OPS-007 采集成功门槛
- 状态：✅ 已实现
- 需求：只有 6 类数据全部采集成功（含 skipped）才执行报告/推荐/收益工作流。
- 验收标准：
  - [ ] 部分成功时不执行工作流并记录失败明细
- 测试：`backend/tests/test_scheduler_workflow.py`

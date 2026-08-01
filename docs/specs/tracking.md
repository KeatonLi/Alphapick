# TRK — 收益跟踪与统计规格

## TRK-001 收益里程碑
- 状态：✅ 已实现
- 需求：推荐后第 1/2/3/5/7 个交易日为收益跟踪里程碑，基准价为推荐价。
- 验收标准：
  - [ ] 里程碑定义 (1, 2, 3, 5, 7) 生效
  - [ ] 每个里程碑落库 `price_dayN` 与 `return_rate_dayN`
- 测试：`backend/tests/test_recommend_service.py`

## TRK-002 收益计算口径
- 状态：✅ 已实现
- 需求：第 N 日收益 = (当日收盘价 − 推荐价) / 推荐价；收盘价取日线表，缺失回退快照表。
- 验收标准：
  - [ ] 收益率计算与口径一致
  - [ ] 日线缺失时快照兜底（SQLite 全链路验证）
- 测试：`backend/tests/test_sqlite_quant_flow.py::test_recommendations_track_day_three_returns_in_sqlite`、`test_market_warehouse.py::test_daily_close_rows_fall_back_to_spot_snapshots`

## TRK-003 跟踪状态机
- 状态：✅ 已实现
- 需求：记录状态为 tracking / completed；填满第 7 日里程碑即锁定 completed 并记录最终收益。
- 验收标准：
  - [ ] 未满第 7 日状态为 tracking
  - [ ] 第 7 日填满后状态为 completed，final_return_rate 锁定
  - [ ] 已完成记录不可重复计算，须先 reset
- 测试：`backend/tests/test_recommend_service.py`、`test_recommend_batch_update.py`

## TRK-004 区间极值统计
- 状态：✅ 已实现
- 需求：跟踪期间记录最大区间收益（max_gain）与最大回撤（max_drawdown）。
- 验收标准：
  - [ ] 以推荐价与已填里程碑价格为基准计算
- 测试：`backend/tests/test_recommend_service.py`

## TRK-005 增量更新
- 状态：✅ 已实现
- 需求：批量更新只处理 tracking 或第 7 日收益缺失的记录，已有里程碑不重复覆盖。
- 验收标准：
  - [ ] completed 且 day7 非空记录被跳过
  - [ ] 已填里程碑不被重复计算
- 测试：`backend/tests/test_recommend_batch_update.py::test_batch_update_dedupes_and_reports_errors`

## TRK-006 批量与单条管理
- 状态：✅ 已实现
- 需求：支持单条/批量 重置、删除、重新计算；批量重复 ID 去重，异常记录返回错误明细。
- 验收标准：
  - [ ] 批量更新重复 ID 去重
  - [ ] 不存在/已完成的记录返回错误信息且不影响其他记录
- 测试：`backend/tests/test_recommend_batch_update.py`

## TRK-007 整日编辑与删除
- 状态：✅ 已实现
- 需求：支持整日推荐记录批量编辑（改推荐价/理由/删条）与整日删除。
- 验收标准：
  - [ ] 编辑后可刷新缓存，页面展示新值
  - [ ] 整日删除幂等
- 测试：`backend/tests/test_recommend_service.py`（路由层）、端到端验证

## TRK-008 统计口径
- 状态：✅ 已实现
- 需求：胜率/平均收益仅统计 completed 样本；3/5/7 日均收益与胜率分周期统计。
- 验收标准：
  - [ ] stats 返回 total/completed/win_rate/avg_return/avg_max_gain/avg_max_drawdown
  - [ ] day3/day5/day7 均收益与胜率按 completed 过滤
- 测试：`backend/tests/test_dashboard_service.py::test_dashboard_summarizes_picks_tracking_and_strategy`

## TRK-009 查询缓存与失效
- 状态：✅ 已实现
- 需求：推荐/统计查询有短生命周期缓存（默认 30s），生成/更新/编辑/删除后立即失效。
- 验收标准：
  - [ ] 短缓存生效（重复查询命中缓存）
  - [ ] 数据变更后缓存清空，新查询返回新数据
- 测试：`backend/tests/test_recommend_service.py::test_get_all_recommendations_reuses_short_lived_cache`

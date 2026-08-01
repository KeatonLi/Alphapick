# REC — 推荐生成与策略评分规格

## REC-001 推荐生成幂等
- 状态：✅ 已实现
- 需求：同一交易日重复生成推荐不得产生重复数据，已有推荐则跳过。
- 验收标准：
  - [ ] 已存在当日推荐时返回 success 并提示已存在，不新增记录
- 测试：`backend/tests/test_sqlite_quant_flow.py`、`test_recommend_service.py`

## REC-002 候选数据源约束
- 状态：✅ 已实现
- 需求：推荐生成只从已归一化的数据库快照读候选，不请求外部行情；快照缺失必须显式失败。
- 验收标准：
  - [ ] 当日无 `stock_spot_snapshots` 时返回失败并说明原因
  - [ ] 生成过程不调用任何外部行情接口（多源管理器不被引用）
- 测试：`backend/tests/test_market_warehouse.py::test_build_candidates_uses_db_snapshots_only`、`test_sqlite_quant_flow.py`

## REC-003 策略评分因子与权重
- 状态：✅ 已实现
- 需求：策略版本 `qf-db-strength-v2`，综合评分 = 动量30% + 趋势25% + 流动性20% + 数据源质量15% − 风险惩罚10%，结果 0-100。
- 验收标准：
  - [ ] 评分公式与权重符合定义（含 clamp 到 [0,100]）
  - [ ] db_snapshot 来源数据源质量分最高（92）
  - [ ] 换手率缺失时成交量可改善流动性分
- 测试：`backend/tests/test_strategy_service.py::test_db_snapshot_candidate_gets_high_source_quality_and_readable_reason`、`test_volume_improves_liquidity_when_turnover_is_missing`

## REC-004 硬性过滤规则
- 状态：✅ 已实现
- 需求：价格 <5 或 >80 元、创业板（300/301）、科创板（688）、北交所（4/8 开头）、当日跌幅 >-3% 的股票必须被过滤。
- 验收标准：
  - [ ] 上述任一条件命中即返回 None（不入候选）
- 测试：`backend/tests/test_strategy_service.py`

## REC-005 推荐排序与取数
- 状态：✅ 已实现
- 需求：评分降序 → 连涨天数降序 → 换手率降序 → 代码升序，取前 5 名并编号 rank。
- 验收标准：
  - [ ] 恰返回 5 条（候选充足时），rank 1-5
  - [ ] 排序符合多级规则
- 测试：`backend/tests/test_strategy_service.py`、`test_sqlite_quant_flow.py`

## REC-006 推荐字段完整性
- 状态：✅ 已实现
- 需求：每条推荐记录必须包含：排名、代码、名称、推荐价、评分、策略版本、因子快照、入选理由。
- 验收标准：
  - [ ] `factor_snapshot` 以 JSON 持久化并可还原
  - [ ] `reason` 可读且包含动量/趋势/换手/评分信息
- 测试：`backend/tests/test_strategy_service.py`（reason 可读性）

## REC-007 候选池数量不足处理
- 状态：✅ 已实现
- 需求：候选为空或过滤后无合格股票时，不生成推荐且明确返回原因，不得静默产出空推荐。
- 验收标准：
  - [ ] 无候选返回 "no DB candidates"
  - [ ] 无合格候选返回 "no qualified strategy candidates"
  - [ ] 两种情况下不写任何推荐记录
- 测试：`backend/tests/test_sqlite_quant_flow.py`、`test_quant_flow_checks.py`

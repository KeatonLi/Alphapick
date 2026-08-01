# LIMIT — 涨停板分析规格

## LIMIT-001 数据来源隔离
- 状态：✅ 已实现
- 需求：涨停板页面与接口只读取已落库的涨停池原始数据，不直接请求外部接口。
- 验收标准：
  - [ ] 服务从 `raw_data_records`（limit_up_pool）解析，页面请求 `/api/limit-up` 不触发外部调用
- 测试：`backend/tests/test_limit_up_service.py`

## LIMIT-002 涨停数据解析
- 状态：✅ 已实现
- 需求：原始涨停池数据可解析出：代码、名称、涨幅、最新价、成交额、流通/总市值、换手率、封单额、封板时间、开板次数、连板状态、封板次数/成功次数、行业、封板强度。
- 验收标准：
  - [ ] 字段正确输出（含异常值兜底为 0/空）
- 测试：`backend/tests/test_limit_up_service.py::test_limit_up_overview_parses_raw_eastmoney_fields`

## LIMIT-003 连板分组
- 状态：✅ 已实现
- 需求：按连板数分组展示：首板、2板、3板、4板及以上。
- 验收标准：
  - [ ] 分组边界正确（≥4 板归入最高组）
- 测试：前端 `frontend/scripts/smoke-pages.mjs`（分组展示）

## LIMIT-004 行业聚合
- 状态：✅ 已实现
- 需求：按行业聚合：数量、龙头股、最高连板、平均封板强度。
- 验收标准：
  - [ ] industries 字段含 count/leader/max_board_count/avg_seal_strength
- 测试：`backend/tests/test_limit_up_service.py`

## LIMIT-005 汇总指标
- 状态：✅ 已实现
- 需求：输出涨停总数、最高连板、首板数、炸板率、平均封板强度、总封单额、最强行业。
- 验收标准：
  - [ ] summary 字段齐全且计算正确
- 测试：`backend/tests/test_limit_up_service.py`

## LIMIT-006 日期查询
- 状态：✅ 已实现
- 需求：支持按日期查询涨停数据，日期列表默认最近 60 天（可调 1-365）。
- 验收标准：
  - [ ] `/api/limit-up/dates?days=` 返回日期列表且限幅合法
- 测试：`backend/tests/test_limit_up_service.py::test_limit_up_dates`（如存在）

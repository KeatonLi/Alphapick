# DATA — 数据采集与归一化规格

## DATA-001 采集数据类型
- 状态：✅ 已实现
- 需求：定时采集 6 类数据：指数日线、板块汇总、交易日历、北向资金、涨停池、全市场快照。
- 验收标准：
  - [ ] 6 类 fetcher 均在调度器注册并可单类触发（`/api/datasource/trigger/{type}`）
  - [ ] 每类采集结果写入 `raw_data_records`（原始 JSON 原文，不做清洗）
- 测试：`backend/tests/test_scheduler_workflow.py`、`test_api_endpoints.py`（外部连通）

## DATA-002 幂等采集
- 状态：✅ 已实现
- 需求：同日同类型已采集成功则跳过（status=skipped），重复执行不产生重复数据。
- 验收标准：
  - [ ] `raw_data_records` 唯一约束 (data_type, target_date)
  - [ ] 已存在记录时 fetcher.run 返回 skipped
- 测试：`backend/tests/test_scheduler_workflow.py`

## DATA-003 失败重试
- 状态：✅ 已实现
- 需求：采集失败最多重试 3 次，指数退避（1s/3s/9s），最终失败记录错误日志。
- 验收标准：
  - [ ] 日志记录 retry_count、error_message、duration_ms
  - [ ] 全部尝试失败后 status=failed
- 测试：`backend/tests/test_http_client.py`（HTTP 会话）＋手工验证

## DATA-004 多源互备降级
- 状态：✅ 已实现
- 需求：AKShare → 腾讯 → 新浪按优先级尝试，第一个成功即返回，全部失败返回错误。
- 验收标准：
  - [ ] provider 按 priority 排序轮询
  - [ ] 成功响应标记 `_source` 来源
  - [ ] 全部失败时返回最后错误信息
- 测试：`backend/tests/test_api_endpoints.py`（外部连通）

## DATA-005 快照归一化
- 状态：✅ 已实现
- 需求：全市场快照原始数据归一化为 `stock_spot_snapshots`（代码清洗、字段转换、异常值过滤）。
- 验收标准：
  - [ ] 腾讯批量行情行可解析出稳定字段（代码/名称/开高低收/涨跌幅/换手率）
  - [ ] 换手率 <0 或 >100 视为非法丢弃
  - [ ] 唯一约束 (trade_date, stock_code)
- 测试：`backend/tests/test_market_warehouse.py::test_parse_tencent_quote_line_extracts_stable_fields`、`test_normalize_quote_item_discards_impossible_turnover_values`

## DATA-006 日线回退读取
- 状态：✅ 已实现
- 需求：读取收盘价时优先 `stock_daily_bars`，缺失日期回退 `stock_spot_snapshots`。
- 验收标准：
  - [ ] 快照可补充日线缺失日期
  - [ ] 返回 {日期: 收盘价} 映射
- 测试：`backend/tests/test_market_warehouse.py::test_daily_close_rows_fall_back_to_spot_snapshots`

## DATA-007 候选池构建
- 状态：✅ 已实现
- 需求：从当日快照构建候选池（主板+价格+流动性+动量过滤），写入 `stock_candidates` 并记录质量检查。
- 验收标准：
  - [ ] 候选构建只依赖快照表，不请求外部接口
  - [ ] 写入/更新唯一 (trade_date, stock_code)
  - [ ] 质量检查记录 status 与数量
- 测试：`backend/tests/test_market_warehouse.py::test_build_candidates_uses_db_snapshots_only`

## DATA-008 数据质量检查
- 状态：✅ 已实现
- 需求：每次归一化写入 `data_quality_checks`；策略生成前可查询质量状态。
- 验收标准：
  - [ ] 快照/候选数量不足时质量标记失败并说明
  - [ ] 收益跟踪缺日线时能识别缺失日期
  - [ ] 未来日期标记 pending 而非缺数据
- 测试：`backend/tests/test_quant_flow_checks.py`

## DATA-009 数据源管理 API
- 状态：✅ 已实现
- 需求：管理员可查看采集状态/质量/日志，支持单项与全量补拉、归一化重跑、删除指定日期数据。
- 验收标准：
  - [ ] `/api/datasource/status` 返回 6 类数据源状态与质量
  - [ ] `/api/datasource/trigger-all` 全量补拉
  - [ ] 删除操作幂等（无记录时返回成功）
- 测试：`backend/tests/test_business_routes.py`（路由注册）、手工验证

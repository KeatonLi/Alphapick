# API — 前端接口契约规格

## API-001 工作台总览
- 状态：✅ 已实现
- 需求：`GET /api/dashboard` 返回：交易日、是否交易日、管道状态（快照数/推荐/收益/上次采集）、今日推荐、跟踪批次、策略统计、AI 复盘结论。
- 验收标准：
  - [ ] 字段齐全：trade_date/is_trade_day/pipeline/today_picks/tracking_batches/strategy_summary/strategy_review
  - [ ] 无数据时返回空结构而非错误
- 测试：`backend/tests/test_dashboard_service.py::test_dashboard_summarizes_picks_tracking_and_strategy`

## API-002 今日推荐查询
- 状态：✅ 已实现
- 需求：`GET /api/picks/daily?date=` 返回指定日期推荐列表；`/latest`、`/dates`、`/trade-dates` 支持日期选择器。
- 验收标准：
  - [ ] daily 默认不带统计（性能），显式请求才返回
  - [ ] trade-dates 返回近 90 个交易日
- 测试：`backend/tests/test_business_routes.py::test_daily_picks_skips_stats_by_default`

## API-003 收益跟踪查询
- 状态：✅ 已实现
- 需求：`GET /api/review/history` 返回历史推荐含全部跟踪字段；`/summary` 返回收益汇总。
- 验收标准：
  - [ ] 支持 limit/日期/状态过滤
  - [ ] 返回字段与 TRK 规格一致
- 测试：`backend/tests/test_recommend_service.py::test_get_all_recommendations_filters_in_query`

## API-004 管理操作接口
- 状态：✅ 已实现
- 需求：管理员可更新收益、批量/单条重置删除、整日编辑删除。
- 验收标准：
  - [ ] 非管理员访问返回 403
  - [ ] 操作后缓存失效，页面显示新数据
- 测试：`backend/tests/test_business_routes.py`、`test_integration.py::test_permissions`

## API-005 接口错误契约
- 状态：✅ 已实现
- 需求：接口统一返回 `{success: bool, data?, error?}`；未登录 401、越权 403、限流 429。
- 验收标准：
  - [ ] 业务成功与失败均走统一信封
  - [ ] 权限错误码符合约定
- 测试：`backend/tests/test_integration.py::test_permissions`、`test_auth`

## API-006 前端页面冒烟
- 状态：✅ 已实现
- 需求：登录/注册/推荐工作台/用户中心/涨停板 5 个页面可加载且关键交互正常（Playwright 冒烟）。
- 验收标准：
  - [ ] 游客登录进入推荐工作台
  - [ ] 推荐卡片显示中文因子，隐藏"未分类"行业
  - [ ] 普通用户不显示手动更新收益按钮
  - [ ] 涨停板按 4/3/2/首板分组
  - [ ] 交易日选择器可切换并同步数据
- 测试：`frontend/scripts/smoke-pages.mjs`

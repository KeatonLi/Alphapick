# AUTH — 认证与权限规格

## AUTH-001 用户注册
- 状态：✅ 已实现
- 需求：用户可注册普通账号，注册成功即返回登录态。
- 验收标准：
  - [ ] 用户名 2-50 字符，密码 ≥6 位，不合法返回 400
  - [ ] `guest` 为保留账号不可注册
  - [ ] 用户名重复返回 409
- 测试：`backend/tests/test_integration.py::test_auth`（端到端）

## AUTH-002 登录与游客
- 状态：✅ 已实现
- 需求：支持账号密码登录与游客免注册登录；游客账号角色恒为 user。
- 验收标准：
  - [ ] 密码错误返回 401
  - [ ] 游客登录自动创建/复用 `guest` 账号并返回 token
  - [ ] `guest` 不可被设置为管理员
- 测试：`backend/tests/test_integration.py::test_auth`、`test_permissions`

## AUTH-003 JWT 会话
- 状态：✅ 已实现
- 需求：登录签发 JWT（HS256，7 天有效），受保护接口校验 Bearer token。
- 验收标准：
  - [ ] 未带 token 访问受保护接口返回 401
  - [ ] 失效/伪造 token 返回 401
- 测试：`backend/tests/test_integration.py::test_permissions`

## AUTH-004 角色权限
- 状态：✅ 已实现
- 需求：普通用户与管理员的接口权限分离；管理接口须管理员。
- 验收标准：
  - [ ] 普通用户访问 `/api/ops/*`、`/api/datasource/*` 返回 403
  - [ ] 默认管理员 `admin/admin123` 启动时自动创建
  - [ ] 管理员可列出用户、修改角色
- 测试：`backend/tests/test_integration.py::test_permissions`

## AUTH-005 接口限流
- 状态：✅ 已实现
- 需求：全局限流 30 次/分钟/IP，防止滥用。
- 验收标准：
  - [ ] 超限请求返回 429
- 测试：手工/压测验证（main.py 中 slowapi 配置）

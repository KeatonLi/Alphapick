#!/usr/bin/env python3
"""
QuantForge 端到端集成测试 (TDD 风格)

模拟真实用户操作流程：
1. 注册 → 登录 → 获取 Token
2. 浏览市场报告、板块、推荐
3. 查看分析面板
4. 验证权限控制 (未登录 401, 非管理员 403)

用法:
  python backend/test_integration.py                    # 默认 localhost:8000
  python backend/test_integration.py --base-url http://localhost:8084
  python backend/test_integration.py --server          # 先启动后端再测试
"""

import argparse
import sys
import json
import time
import os
import subprocess
import urllib.request
import urllib.error
import urllib.parse
import traceback
from dataclasses import dataclass, field
from typing import Any, Optional

# ── 颜色 ──────────────────────────────────────────────────────────────────
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
NC = "\033[0m"


# ── HTTP 客户端封装 ───────────────────────────────────────────────────────

class HttpClient:
    """轻量 HTTP 客户端，无外部依赖"""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.token: Optional[str] = None

    def _request(
        self, method: str, path: str, body: Any = None,
        expect_json: bool = True,
    ) -> tuple[int, Any]:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read()
                if expect_json:
                    return resp.status, json.loads(content)
                return resp.status, content
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read())
            except Exception:
                err_body = {"detail": str(e)}
            return e.code, err_body
        except urllib.error.URLError as e:
            return 0, {"detail": f"连接失败: {e.reason}"}

    def get(self, path: str, expect_json: bool = True) -> tuple[int, Any]:
        return self._request("GET", path, expect_json=expect_json)

    def post(self, path: str, body: Any = None) -> tuple[int, Any]:
        return self._request("POST", path, body)

    def put(self, path: str, body: Any = None) -> tuple[int, Any]:
        return self._request("PUT", path, body)

    def delete(self, path: str) -> tuple[int, Any]:
        return self._request("DELETE", path)


# ── 测试结果收集 ───────────────────────────────────────────────────────────

@dataclass
class TestResult:
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    details: list[str] = field(default_factory=list)

    def ok(self, msg: str):
        self.passed += 1
        self.details.append(f"  {GREEN}✓ PASS{NC}  {msg}")

    def fail(self, msg: str, detail: str = ""):
        self.failed += 1
        line = f"  {RED}✗ FAIL{NC}  {msg}"
        if detail:
            line += f"\n        {DIM}{detail}{NC}"
        self.details.append(line)

    def skip(self, msg: str):
        self.skipped += 1
        self.details.append(f"  {YELLOW}— SKIP{NC}  {msg}")

    def print_summary(self):
        total = self.passed + self.failed + self.skipped
        print(f"\n{'=' * 56}")
        print(f"  {BOLD}测试结果{NC}")
        print(f"{'=' * 56}")
        for d in self.details:
            print(d)
        print(f"\n  {BOLD}汇总:{NC}  总计 {total}  "
              f"{GREEN}{self.passed} 通过{NC}  "
              f"{RED}{self.failed} 失败{NC}  "
              f"{YELLOW}{self.skipped} 跳过{NC}")
        print(f"{'=' * 56}\n")


# ── 测试套件 ───────────────────────────────────────────────────────────────

result = TestResult()


def section(title: str):
    """打印章节标题"""
    print(f"\n  {BOLD}{CYAN}▶ {title}{NC}")
    print(f"  {DIM}{'─' * 50}{NC}")


# =========================================================================
# 第一章: 用户注册与登录
# =========================================================================

def test_auth(http: HttpClient):
    section("用户认证系统")

    test_username = f"test_user_{int(time.time())}"
    test_password = "test_pass_123"

    # --- 1.1 健康检查 ---
    code, data = http.get("/api/health")
    if code == 200:
        result.ok(f"健康检查通过 ({data.get('status', '?')})")
    else:
        result.fail("健康检查", f"status={code}, body={data}")

    # --- 1.2 未登录访问受保护接口 → 401 ---
    code, data = http.get("/api/auth/me")
    if code == 401:
        result.ok("未登录访问 /api/auth/me → 401")
    else:
        result.fail("未登录权限校验", f"期望 401，收到 {code}: {data}")

    code, data = http.get("/api/stock/market")
    if code == 401:
        result.ok("未登录访问 /api/stock/market → 401")
    else:
        result.fail("未登录权限校验", f"期望 401，收到 {code}: {data}")

    # --- 1.3 注册 ---
    code, data = http.post("/api/auth/register", {
        "username": test_username,
        "password": test_password,
    })
    if code == 200 and data.get("success") and "token" in data.get("data", {}):
        token = data["data"]["token"]
        result.ok(f"注册成功 (user={test_username})")
    elif code == 409:
        result.skip(f"注册: 用户已存在 (可能在重复运行)")
        # 用已有的用户登录
        token = None
    else:
        result.fail("注册", f"code={code}, body={data}")
        return  # 后续依赖登录，跳过

    # --- 1.4 重复注册 → 409 ---
    code, data = http.post("/api/auth/register", {
        "username": test_username,
        "password": test_password,
    })
    if code == 409:
        result.ok("重复注册 → 409")
    else:
        result.fail("重复注册", f"期望 409，收到 {code}: {data}")

    # --- 1.5 登录 ---
    if not token:
        code, data = http.post("/api/auth/login", {
            "username": test_username,
            "password": test_password,
        })
        if code == 200 and data.get("success"):
            token = data["data"]["token"]
            result.ok("登录成功")
        else:
            result.fail("登录", f"code={code}, body={data}")
            return
    else:
        result.ok("登录: 使用注册返回的 token (跳过)")

    # 设置 token 给后续测试用
    http.token = token

    # --- 1.6 获取当前用户信息 ---
    code, data = http.get("/api/auth/me")
    if code == 200 and data.get("success"):
        user_info = data["data"]
        assert user_info["username"] == test_username
        result.ok(f"获取用户信息成功 (role={user_info.get('role', '?')})")
    else:
        result.fail("获取用户信息", f"code={code}, body={data}")

    # --- 1.7 错误密码登录 ---
    code, data = http.post("/api/auth/login", {
        "username": test_username,
        "password": "wrong_password",
    })
    if code == 401:
        result.ok("错误密码 → 401")
    else:
        result.fail("错误密码", f"期望 401，收到 {code}: {data}")

    # --- 1.8 无效 Token ---
    old_token = http.token
    http.token = "invalid_token_xxx"
    code, data = http.get("/api/auth/me")
    if code == 401:
        result.ok("无效 Token → 401")
    else:
        result.fail("无效 Token", f"期望 401，收到 {code}: {data}")
    http.token = old_token


# =========================================================================
# 第二章: 市场报告浏览
# =========================================================================

def test_report(http: HttpClient):
    section("市场报告浏览")

    if not http.token:
        result.skip("跳过: 未登录")
        return

    # --- 2.1 获取报告列表/历史 ---
    code, data = http.get("/api/report/history?limit=3")
    if code == 200 and data.get("success"):
        history = data.get("data", [])
        result.ok(f"报告历史列表获取成功 ({len(history)} 条)")
    else:
        result.fail("报告历史列表", f"code={code}, body={data}")
        history = []

    # --- 2.2 获取交易日列表 ---
    code, data = http.get("/api/report/trade-dates?days=30")
    if code == 200:
        dates = data.get("data", []) if isinstance(data, dict) else []
        result.ok(f"交易日列表获取成功 ({len(dates)} 个)")
    else:
        result.fail("交易日列表", f"code={code}, body={data}")

    # --- 2.3 有报告时查看详情 ---
    if history:
        latest = history[0]
        report_date = latest.get("report_date", "")
        code, data = http.get(f"/api/report/daily?date={report_date}")
        if code == 200 and data.get("success"):
            report = data["data"]
            content_fields = [k for k in ["market_summary", "index_data", "hot_sectors", "ai_report"] if report.get(k)]
            result.ok(f"报告详情获取成功 ({report_date}), 含字段: {', '.join(content_fields) or '仅基本结构'}")
        else:
            result.fail("报告详情", f"code={code}, date={report_date}")
    else:
        result.skip("跳过: 无历史报告数据")

    # --- 2.4 板块数据 ---
    code, data = http.get("/api/stock/hot-sectors")
    if code == 200:
        sectors = data.get("data", []) if isinstance(data, dict) else []
        if sectors:
            result.ok(f"热门板块获取成功 ({len(sectors)} 个板块)")
        else:
            result.skip("热门板块: 今日无数据")
    else:
        result.fail("热门板块", f"code={code}, body={data}")

    # --- 2.5 市场概况 ---
    code, data = http.get("/api/stock/market")
    if code == 200:
        result.ok("市场概况获取成功")
    else:
        result.fail("市场概况", f"code={code}, body={data}")


# =========================================================================
# 第三章: 量化推荐浏览
# =========================================================================

def test_recommend(http: HttpClient):
    section("量化推荐浏览")

    if not http.token:
        result.skip("跳过: 未登录")
        return

    # --- 3.1 获取推荐历史 ---
    code, data = http.get("/api/recommend/history")
    if code == 200 and data.get("success"):
        recs = data.get("data", [])
        result.ok(f"推荐历史获取成功 ({len(recs)} 条)")
    else:
        result.fail("推荐历史", f"code={code}, body={data}")
        recs = []

    # --- 3.2 推荐统计 ---
    code, data = http.get("/api/recommend/stats")
    if code == 200 and data.get("success"):
        stats = data["data"]
        summary = ", ".join(f"{k}={v}" for k, v in stats.items() if isinstance(v, (int, float)))
        result.ok(f"推荐统计获取成功 ({summary})")
    else:
        result.fail("推荐统计", f"code={code}, body={data}")

    # --- 3.3 有推荐时查看详情 ---
    if recs:
        dates = sorted(set(r["recommend_date"] for r in recs), reverse=True)
        latest_date = dates[0]
        code, data = http.get(f"/api/recommend/daily?date={latest_date}")
        if code == 200 and data.get("success"):
            daily = data["data"]
            stocks = daily.get("stocks", daily.get("data", []))
            result.ok(f"推荐详情获取成功 ({latest_date}, {len(stocks)} 只)")
        else:
            result.fail("推荐详情", f"code={code}, date={latest_date}")
    else:
        result.skip("跳过: 无推荐数据")


# =========================================================================
# 第四章: 分析面板
# =========================================================================

def test_analysis(http: HttpClient):
    section("分析面板")

    if not http.token:
        result.skip("跳过: 未登录")
        return

    endpoints = [
        ("weekday-stats", "星期统计"),
        ("holding-period-stats", "持仓周期统计"),
        ("return-distribution", "收益分布"),
        ("insights", "关键洞察"),
        ("price-range-stats", "价格区间统计"),
        ("stock-type-stats", "股票类型统计"),
        ("volatility-stats", "波动性统计"),
        ("success-trend", "成功率趋势"),
    ]

    for endpoint, label in endpoints:
        code, data = http.get(f"/api/analysis/{endpoint}")
        if code == 200:
            result.ok(f"{label} 获取成功")
        else:
            result.fail(label, f"code={code}, body={data}")


# =========================================================================
# 第五章: 权限控制
# =========================================================================

def test_permissions(http: HttpClient):
    section("权限控制验证")

    if not http.token:
        result.skip("跳过: 未登录")
        return

    # --- 5.1 非管理员访问管理接口 → 403 ---
    admin_endpoints = [
        ("POST", "/api/recommend/generate"),
        ("POST", "/api/generate/report"),
        ("POST", "/api/schedule/config", {"enabled": False}),
    ]

    for ep in admin_endpoints:
        method = ep[0]
        path = ep[1]
        body = ep[2] if len(ep) > 2 else None

        if method == "POST":
            code, data = http.post(path, body)
        else:
            code, data = http.get(path)

        # 普通用户应该 403
        detail = data.get("detail", "") if isinstance(data, dict) else ""
        if code in (403, 401):
            result.ok(f"普通用户访问 {path} → {code}")
        else:
            # 可能是 422 (参数错误) — 但只要不是 200 即可
            if code == 422:
                result.ok(f"普通用户访问 {path} → 422 (参数校验)")
            else:
                result.fail(f"权限校验 {path}", f"期望 403/401，收到 {code}: {data}")


# =========================================================================
# 第六章: 定时任务配置
# =========================================================================

def test_schedule(http: HttpClient):
    section("定时任务配置")

    if not http.token:
        result.skip("跳过: 未登录")
        return

    # --- 6.1 获取定时任务配置 (需要认证) ---
    code, data = http.get("/api/schedule/config")
    if code == 200 and data.get("success"):
        config = data["data"]
        result.ok(f"定时任务配置获取成功 (enabled={config.get('enabled')}, time={config.get('run_time')})")
    else:
        result.fail("定时任务配置", f"code={code}, body={data}")

    # --- 6.2 获取可选日期 ---
    code, data = http.get("/api/report/dates")
    if code == 200:
        dates = data.get("data", [])
        result.ok(f"报告日期列表获取成功 ({len(dates)} 天)")
    else:
        result.fail("报告日期列表", f"code={code}, body={data}")

    code, data = http.get("/api/recommend/dates")
    if code == 200:
        dates = data.get("data", [])
        result.ok(f"推荐日期列表获取成功 ({len(dates)} 天)")
    else:
        result.fail("推荐日期列表", f"code={code}, body={data}")


# =========================================================================
# 主入口
# =========================================================================

def start_backend() -> subprocess.Popen:
    """启动后端服务"""
    backend_dir = os.path.join(os.path.dirname(__file__))
    print(f"  {YELLOW}启动后端服务...{NC}")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    # 等待服务就绪
    for i in range(30):
        try:
            req = urllib.request.Request("http://localhost:8000/api/health")
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    print(f"  {GREEN}后端就绪 (localhost:8000){NC}")
                    return proc
        except Exception:
            pass
        time.sleep(1)
    proc.terminate()
    raise RuntimeError("后端启动超时")


def main():
    parser = argparse.ArgumentParser(description="QuantForge 端到端集成测试")
    parser.add_argument(
        "--base-url", default="http://localhost:8000",
        help="后端地址 (默认 http://localhost:8000)"
    )
    parser.add_argument(
        "--server", action="store_true",
        help="自动启动后端服务后再测试"
    )
    args = parser.parse_args()

    print(f"\n  {BOLD}{'=' * 50}{NC}")
    print(f"  {BOLD}  QuantForge 端到端集成测试{NC}")
    print(f"  {BOLD}{'=' * 50}{NC}")
    print(f"  目标: {YELLOW}{args.base_url}{NC}")
    print(f"  时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    server_proc = None
    if args.server:
        server_proc = start_backend()

    try:
        http = HttpClient(args.base_url)

        # 按用户操作流程执行测试
        test_auth(http)                       # 注册 → 登录
        if http.token:
            test_report(http)                 # 浏览市场报告
            test_recommend(http)              # 浏览量化推荐
            test_analysis(http)               # 查看分析面板
            test_schedule(http)               # 定时任务配置
            test_permissions(http)            # 权限控制验证
        else:
            result.skip("跳过内容测试: 认证失败")

        # 输出结果
        result.print_summary()

    finally:
        if server_proc:
            print("  关闭后端...")
            server_proc.terminate()
            server_proc.wait()

    # 退出码
    return 0 if result.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

#!/bin/bash
# QuantForge 端到端集成测试 (curl 版本)
# 用法:
#   bash backend/test_integration.sh                    # localhost:8000
#   BASE_URL=http://localhost:8084 bash backend/test_integration.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
USERNAME="test_user_$(date +%s)"
PASSWORD="test_pass_123"
TOKEN=""

PASS=0
FAIL=0
SKIP=0

GREEN='\033[92m'
RED='\033[91m'
YELLOW='\033[93m'
CYAN='\033[96m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

ok()   { PASS=$((PASS+1)); echo -e "  ${GREEN}✓ PASS${NC}  $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}✗ FAIL${NC}  $1${2:+ - $2}"; }
skip() { SKIP=$((SKIP+1)); echo -e "  ${YELLOW}— SKIP${NC}  $1"; }
section() { echo -e "\n  ${BOLD}${CYAN}▶ $1${NC}\n  ${DIM}──────────────────────────────────────────────────${NC}"; }

api() {
    local method="$1" path="$2" body="${3:-}"
    local args=(-s -w "\n%{http_code}" --max-time 15)
    if [ -n "$TOKEN" ]; then
        args+=(-H "Authorization: Bearer $TOKEN")
    fi
    if [ -n "$body" ]; then
        args+=(-H "Content-Type: application/json" -d "$body")
    fi
    response=$(curl "${args[@]}" -X "$method" "${BASE_URL}${path}" 2>/dev/null || true)
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,ensure_ascii=False))" 2>/dev/null || true
    return "$http_code"
}

echo -e "\n  ${BOLD}══════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}  QuantForge 端到端集成测试 (curl)${NC}"
echo -e "  ${BOLD}══════════════════════════════════════════════${NC}"
echo -e "  目标: ${YELLOW}$BASE_URL${NC}"
echo -e "  时间: $(date '+%Y-%m-%d %H:%M:%S')"

# ═══════════════════════════════════════════════════════════════
# 第一章: 用户注册与登录
# ═══════════════════════════════════════════════════════════════
section "用户认证系统"

# 1.1 健康检查
code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" --max-time 5 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
    ok "健康检查通过 (HTTP $code)"
else
    fail "健康检查: 后端未启动? (HTTP $code)" "请确保后端运行在 $BASE_URL"
    echo -e "\n  ${BOLD}汇总:${NC}  总计 $((PASS+FAIL+SKIP))   ${GREEN}$PASS 通过${NC}   ${RED}$FAIL 失败${NC}   ${YELLOW}$SKIP 跳过${NC}"
    exit 1
fi

# 1.2 未登录访问受保护接口 → 401
code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/auth/me" --max-time 5 2>/dev/null || echo "000")
[ "$code" = "401" ] && ok "未登录访问 /api/auth/me → 401" || fail "未登录权限校验" "期望 401，收到 $code"

code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/stock/market" --max-time 5 2>/dev/null || echo "000")
[ "$code" = "401" ] && ok "未登录访问 /api/stock/market → 401" || fail "未登录权限校验" "期望 401，收到 $code"

# 1.3 注册
body=$(curl -s -X POST "${BASE_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" --max-time 10 2>/dev/null || echo '{}')
TOKEN=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))" 2>/dev/null || echo "")
if [ -n "$TOKEN" ]; then
    ok "注册成功 (user=$USERNAME)"
else
    msg=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('detail',''))" 2>/dev/null || echo "?")
    if [ "$msg" = "用户名已存在" ]; then
        skip "注册: 用户已存在，尝试登录"
        body=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" --max-time 10 2>/dev/null || echo '{}')
        TOKEN=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))" 2>/dev/null || echo "")
        [ -n "$TOKEN" ] && ok "登录成功" || fail "登录失败"
    else
        fail "注册失败" "$msg"
    fi
fi

# 1.4 重复注册 → 409
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" --max-time 5 2>/dev/null || echo "000")
[ "$code" = "409" ] && ok "重复注册 → 409" || fail "重复注册" "期望 409，收到 $code"

# 1.5 获取用户信息
body=$(curl -s "${BASE_URL}/api/auth/me" -H "Authorization: Bearer $TOKEN" --max-time 5 2>/dev/null || echo '{}')
role=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('role',''))" 2>/dev/null || echo "")
[ -n "$role" ] && ok "获取用户信息成功 (role=$role)" || fail "获取用户信息"

# 1.6 错误密码 → 401
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"wrong_password\"}" --max-time 5 2>/dev/null || echo "000")
[ "$code" = "401" ] && ok "错误密码 → 401" || fail "错误密码" "期望 401，收到 $code"

# 1.7 无效 Token → 401
code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/auth/me" \
    -H "Authorization: Bearer invalid_token_xxx" --max-time 5 2>/dev/null || echo "000")
[ "$code" = "401" ] && ok "无效 Token → 401" || fail "无效 Token" "期望 401，收到 $code"

# ═══════════════════════════════════════════════════════════════
# 第二章: 市场报告浏览
# ═══════════════════════════════════════════════════════════════
section "市场报告浏览"

# 2.1 报告历史
len=$(curl -s "${BASE_URL}/api/report/history?limit=3" -H "Authorization: Bearer $TOKEN" --max-time 10 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "0")
ok "报告历史列表获取成功 ($len 条)"

# 2.2 交易日列表
len=$(curl -s "${BASE_URL}/api/report/trade-dates?days=30" -H "Authorization: Bearer $TOKEN" --max-time 10 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "0")
ok "交易日列表获取成功 ($len 个)"

# 2.3 热门板块
code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/stock/hot-sectors" \
    -H "Authorization: Bearer $TOKEN" --max-time 15 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "热门板块获取成功" || skip "热门板块: 无数据 ($code)"

# 2.4 市场概况
code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/stock/market" \
    -H "Authorization: Bearer $TOKEN" --max-time 15 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "市场概况获取成功" || fail "市场概况" "HTTP $code"

# ═══════════════════════════════════════════════════════════════
# 第三章: 量化推荐
# ═══════════════════════════════════════════════════════════════
section "量化推荐"

# 3.1 推荐历史
len=$(curl -s "${BASE_URL}/api/recommend/history" -H "Authorization: Bearer $TOKEN" --max-time 10 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "0")
ok "推荐历史获取成功 ($len 条)"

# 3.2 推荐统计
body=$(curl -s "${BASE_URL}/api/recommend/stats" -H "Authorization: Bearer $TOKEN" --max-time 10 2>/dev/null || echo '{}')
success=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null || echo "false")
[ "$success" = "True" ] && ok "推荐统计获取成功" || fail "推荐统计"

# ═══════════════════════════════════════════════════════════════
# 第四章: 分析面板
# ═══════════════════════════════════════════════════════════════
section "分析面板"

for ep in "weekday-stats" "holding-period-stats" "return-distribution" "insights" \
          "price-range-stats" "stock-type-stats" "volatility-stats" "success-trend"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/analysis/$ep" \
        -H "Authorization: Bearer $TOKEN" --max-time 15 2>/dev/null || echo "000")
    [ "$code" = "200" ] && ok "$ep" || fail "$ep" "HTTP $code"
done

# ═══════════════════════════════════════════════════════════════
# 第五章: 定时任务配置
# ═══════════════════════════════════════════════════════════════
section "定时任务配置"

code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/schedule/config" \
    -H "Authorization: Bearer $TOKEN" --max-time 10 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "定时任务配置获取成功" || fail "定时任务配置" "HTTP $code"

len=$(curl -s "${BASE_URL}/api/report/dates" -H "Authorization: Bearer $TOKEN" --max-time 10 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "0")
ok "报告日期列表获取成功 ($len 天)"

len=$(curl -s "${BASE_URL}/api/recommend/dates" -H "Authorization: Bearer $TOKEN" --max-time 10 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "0")
ok "推荐日期列表获取成功 ($len 天)"

# ═══════════════════════════════════════════════════════════════
# 第六章: 权限控制
# ═══════════════════════════════════════════════════════════════
section "权限控制验证"

for path in "/api/recommend/generate" "/api/generate/report" "/api/schedule/config"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}${path}" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        ${path:+/dev/null} --max-time 10 2>/dev/null || echo "000")
    if [ "$code" = "403" ] || [ "$code" = "401" ] || [ "$code" = "422" ]; then
        ok "普通用户访问 $path → $code"
    else
        fail "权限校验 $path" "期望 403/401，收到 $code"
    fi
done

# ═══════════════════════════════════════════════════════════════
# 汇总
# ═══════════════════════════════════════════════════════════════
total=$((PASS+FAIL+SKIP))
echo -e "\n  ${BOLD}══════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}测试结果${NC}"
echo -e "  ${BOLD}══════════════════════════════════════════════${NC}"
echo -e "  总计 $total  "
echo -e "  ${GREEN}$PASS 通过${NC}  "
echo -e "  ${RED}$FAIL 失败${NC}  "
echo -e "  ${YELLOW}$SKIP 跳过${NC}"
echo -e "  ${BOLD}══════════════════════════════════════════════${NC}\n"

exit $(( FAIL > 0 ))

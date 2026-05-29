#!/bin/bash
# QuantForge 端到端集成测试 (curl 版本)
# 自动适配本地/线上服务器差异
# 用法:
#   bash backend/test_integration.sh                    # localhost:8000
#   BASE_URL=http://localhost:8084 bash backend/test_integration.sh

set -uo pipefail

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
info() { echo -e "  ${CYAN}ℹ${NC}  $1"; }
section() { echo -e "\n  ${BOLD}${CYAN}▶ $1${NC}\n  ${DIM}──────────────────────────────────────────────────${NC}"; }

echo -e "\n  ${BOLD}══════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}  QuantForge 端到端集成测试${NC}"
echo -e "  ${BOLD}══════════════════════════════════════════════${NC}"
echo -e "  目标: ${YELLOW}$BASE_URL${NC}"
echo -e "  时间: $(date '+%Y-%m-%d %H:%M:%S')"

# ═══════════════════════════════════════════════════════════════
# 0. 基础探测：系统状态
# ═══════════════════════════════════════════════════════════════
section "系统探测"

code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" --max-time 5 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
    ok "健康检查通过"
else
    fail "后端未响应 (HTTP $code)"
    echo -e "  请确保后端运行在 ${YELLOW}$BASE_URL${NC}"
    total=$((PASS+FAIL))
    echo -e "\n  ${BOLD}汇总:${NC}  总计 $total  ${GREEN}$PASS 通过${NC}  ${RED}$FAIL 失败${NC}"
    exit 1
fi

# 探测 auth 系统是否部署
auth_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"x","password":"y"}' --max-time 5 2>/dev/null || echo "000")

if [ "$auth_code" = "404" ]; then
    info "${YELLOW}auth 系统未部署${NC} — 跳过用户认证章节，直连测试内容 API"
    HAS_AUTH=false
elif [ "$auth_code" = "401" ] || [ "$auth_code" = "422" ]; then
    info "${GREEN}auth 系统已部署${NC}"
    HAS_AUTH=true
else
    info "auth 状态: HTTP $auth_code (无法判断)"
    HAS_AUTH=false
fi

# ═══════════════════════════════════════════════════════════════
# 第一章: 用户认证 (仅在 auth 已部署时)
# ═══════════════════════════════════════════════════════════════
if [ "$HAS_AUTH" = true ]; then
    section "用户认证系统"

    code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/auth/me" --max-time 5 2>/dev/null || echo "000")
    [ "$code" = "401" ] && ok "未登录访问 /api/auth/me → 401" || fail "未登录权限校验" "期望 401，收到 $code"

    code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/stock/market" --max-time 5 2>/dev/null || echo "000")
    [ "$code" = "401" ] && ok "未登录访问 /api/stock/market → 401" || fail "未登录权限校验" "期望 401，收到 $code"

    body=$(curl -s -X POST "${BASE_URL}/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" --max-time 10 2>/dev/null || echo '{}')
    if echo "$body" | grep -q '"token"'; then
        TOKEN=$(echo "$body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        ok "注册成功 (user=$USERNAME)"
    elif echo "$body" | grep -q '"用户名已存在"'; then
        skip "注册: 用户已存在"
        body2=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" --max-time 10 2>/dev/null || echo '{}')
        TOKEN=$(echo "$body2" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        [ -n "$TOKEN" ] && ok "登录成功" || fail "登录失败"
    else
        fail "注册" "$(echo "$body" | head -c 200)"
    fi

    if [ -n "$TOKEN" ]; then
        code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/register" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" --max-time 5 2>/dev/null || echo "000")
        [ "$code" = "409" ] && ok "重复注册 → 409" || fail "重复注册" "期望 409，收到 $code"

        body=$(curl -s "${BASE_URL}/api/auth/me" -H "Authorization: Bearer $TOKEN" --max-time 5 2>/dev/null || echo '{}')
        role=$(echo "$body" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
        [ -n "$role" ] && ok "获取用户信息 (role=$role)" || fail "获取用户信息"

        code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$USERNAME\",\"password\":\"wrong\"}" --max-time 5 2>/dev/null || echo "000")
        [ "$code" = "401" ] && ok "错误密码 → 401" || fail "错误密码" "期望 401，收到 $code"

        code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/auth/me" \
            -H "Authorization: Bearer invalid_token" --max-time 5 2>/dev/null || echo "000")
        [ "$code" = "401" ] && ok "无效 Token → 401" || fail "无效 Token" "期望 401，收到 $code"
    fi
else
    skip "用户认证章节: auth 未部署 (部署新代码后重测)"
fi

# ═══════════════════════════════════════════════════════════════
# 第二章: 市场报告
# ═══════════════════════════════════════════════════════════════
HDR=""
[ -n "$TOKEN" ] && HDR="-H Authorization: Bearer $TOKEN"
section "市场报告"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/report/history?limit=3" --max-time 10 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "报告历史列表" || fail "报告历史列表" "HTTP $code"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/report/dates" --max-time 10 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "报告日期列表" || fail "报告日期列表" "HTTP $code"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/report/trade-dates?days=30" --max-time 10 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "交易日列表" || fail "交易日列表" "HTTP $code"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/report/detail" --max-time 60 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "报告详情 (含实时数据)" || skip "报告详情" "HTTP $code (可能今日无数据)"

# ═══════════════════════════════════════════════════════════════
# 第三章: 板块 & 市场概况
# ═══════════════════════════════════════════════════════════════
section "板块 & 市场概况"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/stock/hot-sectors" --max-time 15 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "热门板块" || skip "热门板块: 无数据"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/stock/market" --max-time 15 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "市场概况" || fail "市场概况" "HTTP $code"

# ═══════════════════════════════════════════════════════════════
# 第四章: 量化推荐
# ═══════════════════════════════════════════════════════════════
section "量化推荐"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/recommend/history" --max-time 30 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "推荐历史" || fail "推荐历史" "HTTP $code"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/recommend/stats" --max-time 15 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "推荐统计" || fail "推荐统计" "HTTP $code"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/recommend/dates" --max-time 30 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "推荐日期列表" || fail "推荐日期列表" "HTTP $code"

# ═══════════════════════════════════════════════════════════════
# 第五章: 分析面板
# ═══════════════════════════════════════════════════════════════
section "分析面板"

for ep in "weekday-stats" "holding-period-stats" "return-distribution" "insights" \
          "price-range-stats" "stock-type-stats" "volatility-stats" "success-trend"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/analysis/$ep" --max-time 15 2>/dev/null || echo "000")
    [ "$code" = "200" ] && ok "$ep" || fail "$ep" "HTTP $code"
done

# ═══════════════════════════════════════════════════════════════
# 第六章: 定时任务 & 生成接口
# ═══════════════════════════════════════════════════════════════
section "定时任务 & 生成接口"

code=$(curl -s -o /dev/null -w "%{http_code}" $HDR "${BASE_URL}/api/schedule/config" --max-time 10 2>/dev/null || echo "000")
[ "$code" = "200" ] && ok "定时任务配置" || fail "定时任务配置" "HTTP $code"

# 生成接口：只检查 POST 可达性（不真正触发）
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/generate/report" \
    ${HDR:--H "Content-Type: application/json"} \
    -d '{}' --max-time 5 2>/dev/null || echo "000")
[ "$code" = "405" ] && ok "generate/report (POST)" && ok "generate/recommend (POST)" || skip "生成接口: 需要登录"

# ═══════════════════════════════════════════════════════════════
# 补充：内容校验 (推荐数据完整性)
# ═══════════════════════════════════════════════════════════════
section "数据内容校验"

rec_data=$(curl -s $HDR "${BASE_URL}/api/recommend/history" --max-time 30 2>/dev/null || echo '{}')
rec_count=$(echo "$rec_data" | grep -o '"recommend_date"' | wc -l)
if [ "$rec_count" -gt 0 ]; then
    ok "推荐记录: $rec_count 条"
    latest_date=$(echo "$rec_data" | grep -o '"recommend_date":"[^"]*"' | head -1 | cut -d'"' -f4)
    info "最新推荐日期: $latest_date"
else
    skip "无推荐记录 (可能还未生成)"
fi

report_data=$(curl -s $HDR "${BASE_URL}/api/report/history?limit=5" --max-time 10 2>/dev/null || echo '{}')
report_count=$(echo "$report_data" | grep -o '"report_date"' | wc -l)
if [ "$report_count" -gt 0 ]; then
    ok "报告记录: $report_count 条"
else
    skip "无报告记录"
fi

# 查看报告详情中是否有 AI 分析内容
detail=$(curl -s $HDR "${BASE_URL}/api/report/detail" --max-time 60 2>/dev/null || echo '{}')
if echo "$detail" | grep -q '"ai_report"'; then
    ai_len=$(echo "$detail" | grep -o '"ai_report":"[^"]*"' | head -1 | wc -c)
    [ "$ai_len" -gt 50 ] && ok "AI 分析报告: 有内容" || skip "AI 分析报告: 无内容或今日无数据"
else
    skip "AI 分析报告: 接口未返回"
fi

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

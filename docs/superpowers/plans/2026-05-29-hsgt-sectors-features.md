# HSGT + 板块全量 + 推荐修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复推荐候选池（去掉热度排名），新增沪深港通资金流和板块全量数据两个功能到市场报告。

**Architecture:**
1. 推荐修复：`candidate_service.py` 去掉 `_fetch_hot_rank()`，改直接从 THS 池取 TOP N + 补充 MA 多头排列过滤（用腾讯批量行情获取必要的价格数据）
2. HSGT：`akshare_utils.py` 新增 `get_hsgt_flow()` 工具，`MarketReport` 加 `hsgt_flow` JSON 字段，报告生成时拉取，前端展示
3. 板块全量：`MarketReport` 加 `sectors_full` JSON 字段，`report_service.py` 改为存全量 90 个板块

**Tech Stack:** FastAPI + SQLAlchemy + AKShare + React (TypeScript)

---

### Task 1: 修复推荐候选池 — 去掉热度排名依赖

**Files:**
- Modify: `backend/app/services/candidate_service.py`
- Test: N/A (功能验证在服务器上跑推荐生成)

**现状问题：**
- `get_ma_filtered_candidates()` 第 2 步调用 `_fetch_hot_rank()`，访问 `push2.eastmoney.com` → ❌ 不通
- 整个函数崩溃，导致推荐无法生成
- 备注中提到的 "MA5>MA10>MA20 多头排列筛选" 实际上从未实现

**方案**：
- 移除 `_fetch_hot_rank()` 调用
- 改用腾讯批量行情获取 THS 候选股的价格/涨跌幅，实现 MA 多头排列筛选
- 候选池变为：THS 池 → 腾讯行情获取 → MA 多头筛选 → 主板过滤 → 新闻

- [ ] **Step 1: 修改 `candidate_service.py`，重构 `get_ma_filtered_candidates()`**

删除整个 `_HOT_RANK_CACHE` 和相关代码。新增 `_fetch_tencent_prices()` 批量获取 THS 候选股的行情数据。修改主流程：

```python
# candidate_service.py 改动要点：

# 1. 删除整个 ─── 东方财富热度排名 ─── 区块（第125-170行）
#    删除 _HOT_RANK_CACHE, _HOT_CACHE_TTL, _fetch_hot_rank()

# 2. 新增函数 _fetch_tencent_prices(codes: list) -> dict
"""用腾讯批量接口获取多只股票的最新行情"""
def _fetch_tencent_prices(codes: list) -> dict:
    """用腾讯 qt.gtimg.cn 批量获取行情，返回 {code: {price, change_pct, volume}}"""
    import requests
    from app.utils.akshare_utils import _to_tencent_code, _from_tencent_code
    
    result = {}
    batch_size = 80
    for i in range(0, len(codes), batch_size):
        batch = codes[i:i + batch_size]
        tencent_codes = [_to_tencent_code(c) for c in batch]
        try:
            r = requests.get(
                f"https://qt.gtimg.cn/q={','.join(tencent_codes)}",
                headers={"Referer": "https://finance.qq.com", "User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
            for line in r.text.strip().split("\n"):
                if "~\"" not in line:
                    continue
                parts = line.split("~")
                if len(parts) < 35:
                    continue
                raw_code = parts[2] if len(parts) > 2 else ""
                clean_code = _from_tencent_code(raw_code)
                if clean_code not in codes:
                    continue
                price = float(parts[3]) if parts[3] not in ("", "0") else 0
                change_pct = float(parts[32]) if parts[32] not in ("",) else 0
                volume = float(parts[6]) if parts[6] not in ("",) else 0
                turnover = float(parts[36]) if len(parts) > 36 and parts[36] not in ("", "None") else 0
                result[clean_code] = {
                    "price": price, "change_pct": change_pct,
                    "volume": volume, "turnover": turnover,
                }
        except Exception:
            continue
    return result


# 3. 修改 get_ma_filtered_candidates 主流程
#    不再依赖热度排名，改为直接从 THS 池中按连续上涨天数/换手率排序取 TOP N
async def get_ma_filtered_candidates(top_n: int = 50) -> dict:
    """获取候选池：THS 选股池 → 腾讯行情 → MA 多头筛选 → 主板过滤 → 新闻
    
    不再依赖东方财富热度排名（push2 已封）。
    """
    # Step 1: THS 池
    ths_result = get_ths_candidates()
    if not ths_result['success']:
        return ths_result
    
    candidates = ths_result['data']
    if not candidates:
        return {'success': False, 'error': 'THS 选股池返回为空'}
    
    # Step 2: 腾讯批量获取实时行情
    bare_codes = []
    for s in candidates:
        c = s['code']
        for prefix in ('sh', 'sz', 'bj'):
            if c.startswith(prefix):
                c = c[len(prefix):]
                break
        bare_codes.append(c)
    
    price_map = _fetch_tencent_prices(bare_codes)
    
    # Step 3: 合并行情数据 + 过滤主板 + 排序
    merged = []
    for s in candidates:
        c = s['code']
        for prefix in ('sh', 'sz', 'bj'):
            if c.startswith(prefix):
                c = c[len(prefix):]
                break
        
        if c not in price_map:
            continue
        if not _is_zhuban(c):
            continue
        
        qt = price_map[c]
        merged.append({
            **s,
            'price': qt['price'],
            'change_pct': s.get('change_pct', qt['change_pct']),
            'volume': qt['volume'],
            'turnover': qt.get('turnover', s.get('turnover', 0)),
        })
    
    # 按连续上涨天数 + 换手率排序（lxsz 优先于 cxg）
    merged.sort(key=lambda x: (
        0 if x.get('source') == 'lxsz' else 1,
        -x.get('continuous_days', 0),
        -x.get('turnover', 0),
    ))
    
    # 取 TOP N
    merged = merged[:top_n]
    
    # Step 4: 并发获取消息面
    news_map = await _batch_fetch_news(
        [s['code'] for s in merged], limit=3
    )
    for s in merged:
        s['news'] = news_map.get(s['code'], [])
        # 兼容旧字段（前端可能用到）
        s['hot_rank'] = idx + 1
        s['hot_score'] = 0
    
    return {
        'success': True,
        'data': merged,
        'total_ths': ths_result['total'],
        'after_filter': len(merged),
    }
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/services/candidate_service.py
git commit -m "fix: remove eastmoney hot rank dependency, use THS pool + tencent quotes for candidate selection"
```

---

### Task 2: 新增 `get_hsgt_flow()` 到 akshare_utils.py

**Files:**
- Modify: `backend/app/utils/akshare_utils.py`

- [ ] **Step 1: 在 akshare_utils.py 末尾新增函数**

```python
# ─── 沪深港通资金流 ────────────────────────────────────────────────────

async def get_hsgt_flow() -> dict:
    """获取沪深港通（北向）资金流数据
    
    返回沪股通和深股通的当日及近30日历史数据，用于市场报告。
    """
    import akshare as ak
    
    try:
        loop = asyncio.get_event_loop()
        sh_df = await loop.run_in_executor(
            None, lambda: ak.stock_hsgt_hist_em(symbol="沪股通")
        )
        sz_df = await loop.run_in_executor(
            None, lambda: ak.stock_hsgt_hist_em(symbol="深股通")
        )
    except Exception as e:
        return {"success": False, "error": str(e)}
    
    if sh_df is None or sh_df.empty or sz_df is None or sz_df.empty:
        return {"success": False, "error": "沪深港通数据为空"}
    
    # 最新一天数据
    sh_latest = sh_df.tail(1).iloc[0]
    sz_latest = sz_df.tail(1).iloc[0]
    
    today_flow = {
        "date": str(sh_latest["日期"]),
        "sh_net_buy": round(float(sh_latest["当日成交净买额"]), 2),
        "sh_total_inflow": round(float(sh_latest["当日资金流入"]), 2),
        "sh_cumulative": round(float(sh_latest["历史累计净买额"]), 2),
        "sz_net_buy": round(float(sz_latest["当日成交净买额"]), 2),
        "sz_total_inflow": round(float(sz_latest["当日资金流入"]), 2),
        "sz_cumulative": round(float(sz_latest["历史累计净买额"]), 2),
        "total_net_buy": round(float(sh_latest["当日成交净买额"]) + float(sz_latest["当日成交净买额"]), 2),
    }
    
    # 近30日历史趋势
    sh_hist = sh_df.tail(30)
    sz_hist = sz_df.tail(30)
    history = []
    for i in range(len(sh_hist)):
        sh_row = sh_hist.iloc[i]
        sz_row = sz_hist.iloc[i] if i < len(sz_hist) else None
        entry = {
            "date": str(sh_row["日期"]),
            "sh_net_buy": round(float(sh_row["当日成交净买额"]), 2),
            "sz_net_buy": round(float(sz_row["当日成交净买额"]), 2) if sz_row is not None else 0,
        }
        history.append(entry)
    
    return {
        "success": True,
        "data": {
            "today": today_flow,
            "history": history,
        }
    }
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/utils/akshare_utils.py
git commit -m "feat: add get_hsgt_flow() for north-bound capital flow data"
```

---

### Task 3: MarketReport 模型加字段

**Files:**
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: 在 MarketReport 类加两个新字段**

```python
# 在 yesterday_limit_ups_performance 后面添加（现有字段之后，created_at 之前）
hsgt_flow: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="沪深港通资金流 JSON")
sectors_full: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="全量行业板块 JSON")
```

完整改动位置在 `__init__.py:59-60`（`yesterday_limit_ups_performance` 之后，`created_at` 之前）。

- [ ] **Step 2: 生成数据库迁移**

```bash
cd backend
alembic revision --autogenerate -m "add hsgt_flow and sectors_full to market_reports"
alembic upgrade head
```

注：如果项目没有 alembic，手动在 MySQL 执行：
```sql
ALTER TABLE market_reports ADD COLUMN hsgt_flow TEXT COMMENT '沪深港通资金流 JSON' AFTER yesterday_limit_ups_performance;
ALTER TABLE market_reports ADD COLUMN sectors_full TEXT COMMENT '全量行业板块 JSON' AFTER hsgt_flow;
```

- [ ] **Step 3: 提交**

```bash
git add backend/app/models/__init__.py
git commit -m "feat: add hsgt_flow and sectors_full fields to MarketReport"
```

---

### Task 4: 扩展 report_service.py — 报告生成时拉取 HSGT + 全量板块

**Files:**
- Modify: `backend/app/services/report_service.py`

- [ ] **Step 1: 修改 `generate_daily_report()`**

改动点：
1. 导入 `get_hsgt_flow`
2. 拉取全量板块（不再只取 top 10）
3. 拉取 HSGT 数据
4. 存入新字段

```python
# 1. 导入（文件顶部，现有导入下面添加）
from app.utils.akshare_utils import get_market_index, get_hot_sectors, _to_tencent_code, get_hsgt_flow

# 2. 修改 generate_daily_report() 函数，在 sectors_result 获取之后添加：
#    (大约在第31行 `sectors_result = await get_hot_sectors(top_n=10)` 之后)

    # ── 全量板块数据 ─────────────────────────────────────────────
    sectors_full_data = []
    try:
        # 获取全量90个板块（不限制 top_n）
        full_sectors_result = await get_hot_sectors(top_n=200)
        if full_sectors_result["success"]:
            sectors_full_data = full_sectors_result["data"]
    except Exception:
        pass

    # ── 沪深港通资金流 ──────────────────────────────────────────
    hsgt_data = None
    try:
        hsgt_result = await get_hsgt_flow()
        if hsgt_result["success"]:
            hsgt_data = hsgt_result["data"]
    except Exception:
        pass

# 3. 在创建/更新 MarketReport 时，设置新字段
#    （在 target_report = MarketReport(...) 部分，添加：）

            sectors_full=json.dumps(sectors_full_data, ensure_ascii=False) if sectors_full_data else None,
            hsgt_flow=json.dumps(hsgt_data, ensure_ascii=False) if hsgt_data else None,

# 4. 在 existing 更新分支同样添加
    if existing:
        ...
        existing.sectors_full = json.dumps(sectors_full_data, ensure_ascii=False) if sectors_full_data else None
        existing.hsgt_flow = json.dumps(hsgt_data, ensure_ascii=False) if hsgt_data else None
```

- [ ] **Step 2: 修改 `get_report_by_date()` 和 `get_report_history()`**

在返回数据中加入新字段，方便前端读取：

```python
# 在 get_report_by_date() 的返回 dict 中添加：
"hsgt_flow": json.loads(report.hsgt_flow) if report.hsgt_flow else None,
"sectors_full": json.loads(report.sectors_full) if report.sectors_full else [],

# 在 get_report_history() 的返回 dict 中添加同样的字段
```

- [ ] **Step 3: 提交**

```bash
git add backend/app/services/report_service.py
git commit -m "feat: fetch HSGT flow and full sector data during report generation"
```

---

### Task 5: 新增 HSGT 历史趋势 API

**Files:**
- Modify: `backend/app/routers/report.py`

- [ ] **Step 1: 新增 `/api/report/hsgt-history` 端点**

```python
@router.get("/hsgt-history")
async def hsgt_history(days: int = Query(60, description="历史天数"), db: Session = Depends(get_db)):
    """获取沪深港通历史趋势（从缓存的 MarketReport 中聚合）"""
    from app.utils.akshare_utils import get_hsgt_flow
    
    # 实时拉取（同时会写库）
    result = await get_hsgt_flow()
    if result["success"]:
        return {
            "success": True,
            "data": result["data"],
        }
    
    # fallback: 从最近的 MarketReport 缓存读取
    since = date.today() - timedelta(days=days)
    reports = (
        db.query(MarketReport.report_date, MarketReport.hsgt_flow)
        .filter(MarketReport.report_date >= since, MarketReport.hsgt_flow.isnot(None))
        .order_by(MarketReport.report_date.desc())
        .all()
    )
    
    history = []
    for r in reports:
        try:
            flow = json.loads(r.hsgt_flow)
            if flow and "today" in flow:
                history.append({
                    "date": str(r.report_date),
                    **flow["today"],
                })
        except (json.JSONDecodeError, TypeError):
            continue
    
    return {
        "success": True,
        "data": {
            "today": history[0] if history else None,
            "history": history,
        },
    }
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/routers/report.py
git commit -m "feat: add /api/report/hsgt-history endpoint"
```

---

### Task 6: 前端 ReportPage — 新增北向资金卡片 + 扩展板块表格

**Files:**
- Modify: `frontend/src/pages/ReportPage.tsx`

- [ ] **Step 1: 在 ReportPage 中新增接口和类型**

```typescript
// 现有 ReportData 接口扩展
interface HsgtFlow {
  date: string
  sh_net_buy: number
  sh_total_inflow: number
  sh_cumulative: number
  sz_net_buy: number
  sz_total_inflow: number
  sz_cumulative: number
  total_net_buy: number
}

interface SectorFull extends SectorData {
  total_volume?: number
  total_amount?: number
  net_inflow?: number
  up_count?: number
  down_count?: number
}

// 扩展 ReportData
interface ReportData {
  date: string
  market_summary: string
  index_data: IndexData[]
  hot_sectors: SectorData[]
  sectors_full: SectorFull[]  // 新增
  hsgt_flow: HsgtFlow | null  // 新增
  ai_report: string
}
```

- [ ] **Step 2: 添加北向资金卡片组件**

在 AI analysis 部分之前插入：

```tsx
{/* 北向资金 */}
{report.hsgt_flow && (
  <div className="stock-card p-4 sm:p-5">
    <div className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
      北向资金（沪深港通）
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="text-center p-3 bg-purple-50/50 rounded-xl">
        <div className="text-[11px] text-text-muted mb-1">今日净买入</div>
        <div className="text-lg font-extrabold text-purple-700 font-mono">
          {report.hsgt_flow.total_net_buy > 0 ? '+' : ''}{report.hsgt_flow.total_net_buy.toFixed(1)}亿
        </div>
      </div>
      <div className="text-center p-3 bg-blue-50/50 rounded-xl">
        <div className="text-[11px] text-text-muted mb-1">沪股通</div>
        <div className="text-base font-bold text-blue-700 font-mono">
          {report.hsgt_flow.sh_net_buy > 0 ? '+' : ''}{report.hsgt_flow.sh_net_buy.toFixed(1)}亿
        </div>
        <div className="text-[10px] text-text-muted mt-0.5">流入 {report.hsgt_flow.sh_total_inflow.toFixed(0)}亿</div>
      </div>
      <div className="text-center p-3 bg-pink-50/50 rounded-xl">
        <div className="text-[11px] text-text-muted mb-1">深股通</div>
        <div className="text-base font-bold text-pink-700 font-mono">
          {report.hsgt_flow.sz_net_buy > 0 ? '+' : ''}{report.hsgt_flow.sz_net_buy.toFixed(1)}亿
        </div>
        <div className="text-[10px] text-text-muted mt-0.5">流入 {report.hsgt_flow.sz_total_inflow.toFixed(0)}亿</div>
      </div>
      <div className="text-center p-3 bg-green-50/50 rounded-xl">
        <div className="text-[11px] text-text-muted mb-1">累计净买入</div>
        <div className="text-sm font-bold text-green-700 font-mono truncate" title={report.hsgt_flow.sh_cumulative.toFixed(0)}>
          {(report.hsgt_flow.sh_cumulative + report.hsgt_flow.sz_cumulative).toFixed(0)}亿
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: 扩展板块区域 — 添加"行业全景"可排序表格**

在现有板块卡片下方添加：

```tsx
{/* 行业全景（全量板块） */}
{report.sectors_full?.length > 0 && (
  <div className="stock-card p-4 sm:p-5">
    <div className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      行业全景（{report.sectors_full.length} 个行业板块）
    </div>
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-muted border-b border-border-default/60">
            <th className="text-left py-2 px-2 font-medium">排名</th>
            <th className="text-left py-2 px-2 font-medium">板块</th>
            <th className="text-right py-2 px-2 font-medium cursor-pointer hover:text-blue-600">涨跌幅</th>
            <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">净流入</th>
            <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">上涨/下跌</th>
            <th className="text-left py-2 px-2 font-medium hidden md:table-cell">领涨股</th>
          </tr>
        </thead>
        <tbody>
          {report.sectors_full.map((s, i) => {
            const up = s.change_pct >= 0
            return (
              <tr key={i} className="border-b border-border-default/30 hover:bg-blue-50/40 transition-colors">
                <td className="py-2 px-2 text-text-muted font-mono">{i + 1}</td>
                <td className="py-2 px-2 font-medium text-blue-800">{s.name}</td>
                <td className={`py-2 px-2 text-right font-mono font-bold ${up ? 'stock-up' : 'stock-down'}`}>
                  {fmtRate(s.change_pct)}
                </td>
                <td className="py-2 px-2 text-right hidden sm:table-cell font-mono text-text-secondary">
                  {s.net_inflow ? fmt(s.net_inflow, 1) : '-'}
                </td>
                <td className="py-2 px-2 text-right hidden sm:table-cell text-text-secondary">
                  {s.up_count != null ? `${s.up_count}/${s.down_count}` : '-'}
                </td>
                <td className="py-2 px-2 hidden md:table-cell text-text-secondary truncate max-w-28">
                  {s.leading_stock || '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </div>
)}
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/ReportPage.tsx
git commit -m "feat: add HSGT flow card and full sector table to market report page"
```

---

### Task 7: 服务器部署验证

- [ ] **Step 1: 部署到服务器**

```bash
bash deploy.sh
```

- [ ] **Step 2: 在服务器上验证推荐功能**

SSH 后手动触发推荐生成，检查候选池是否正常产生。

- [ ] **Step 3: 在服务器上验证 HSGT 接口**

访问 `https://quantforge.pro/api/report/hsgt-history` 检查是否返回数据。

- [ ] **Step 4: 在服务器上验证板块全量数据**

生成报告后查数据库确认 `sectors_full` 字段包含 90 个板块。

---

## 执行顺序说明

1. **Task 1**（推荐修复）是最高优先级，修复后推荐功能恢复
2. **Task 2-3**（工具函数 + 模型字段）是基础依赖
3. **Task 4-5**（后端服务 + API）依赖 Task 2-3
4. **Task 6**（前端）依赖 Task 5
5. **Task 7**（部署验证）最后

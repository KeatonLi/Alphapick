# 控制台功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade SettingsPage to ConsolePage with 5 tabs: recommendation management (day-level CRUD), report management (edit/delete), revenue tracking (date-triggered update), poster management (preview/download/delete), and system settings (existing schedule config).

**Architecture:** Backend gets new day-level edit/delete endpoints for recommendations and reports, plus poster file deletion. Frontend SettingsPage is refactored into a tabbed ConsolePage. Existing generation logic and polling code are preserved as-is.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TypeScript + TailwindCSS (frontend)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/services/recommend_service.py` | Modify | Add `edit_day_recommendations`, `delete_day_recommendations` |
| `backend/app/services/report_service.py` | Modify | Add `edit_report_fields`, `delete_report` |
| `backend/app/routers/recommend.py` | Modify | Add `PUT /day/{date}`, `DELETE /day/{date}` |
| `backend/app/routers/report.py` | Modify | Add `PUT /day/{date}`, `DELETE /day/{date}`, `DELETE /poster/{date}` |
| `frontend/src/services/api.ts` | Modify | Add `apiPut`, `apiDelete` helpers |
| `frontend/src/pages/SettingsPage.tsx` | Modify | Refactor into ConsolePage with 5 tabs |
| `frontend/src/App.tsx` | Modify | Update route `/settings` → `/console` |
| `frontend/src/components/Navbar.tsx` | Modify | Update nav label "设置" → "控制台" |

---

### Task 1: Backend — Recommendation Day-Level Edit & Delete Service Functions

**Files:**
- Modify: `backend/app/services/recommend_service.py` (append to end)

- [ ] **Step 1: Add `edit_day_recommendations` and `delete_day_recommendations` functions**

Append the following to the end of `backend/app/services/recommend_service.py`:

```python
def edit_day_recommendations(db: Session, rec_date: date, updates: list) -> dict:
    """编辑某日推荐：批量更新各条记录的字段，可选删除某些条

    updates 格式: [{"id": 123, "recommend_price": 25.5, "reason": "...", "delete": false}]
    """
    recs = db.query(Recommendation).filter(
        Recommendation.recommend_date == rec_date
    ).all()
    rec_map = {r.id: r for r in recs}

    updated_count = 0
    deleted_count = 0
    for item in updates:
        rid = item.get("id")
        if rid not in rec_map:
            continue
        rec = rec_map[rid]

        if item.get("delete"):
            db.delete(rec)
            deleted_count += 1
            continue

        if "recommend_price" in item:
            rec.recommend_price = item["recommend_price"]
        if "reason" in item:
            rec.reason = item["reason"]
        updated_count += 1

    db.commit()
    return {"success": True, "data": {"updated": updated_count, "deleted": deleted_count}}


def delete_day_recommendations(db: Session, rec_date: date) -> dict:
    """删除某日全部推荐记录"""
    count = db.query(Recommendation).filter(
        Recommendation.recommend_date == rec_date
    ).delete()
    db.commit()
    return {"success": True, "data": {"deleted": count}}
```

- [ ] **Step 2: Verify the file still imports correctly**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -c "from app.services.recommend_service import edit_day_recommendations, delete_day_recommendations; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/recommend_service.py
git commit -m "feat(recommend): add day-level edit and delete service functions"
```

---

### Task 2: Backend — Report Edit/Delete Service Functions

**Files:**
- Modify: `backend/app/services/report_service.py` (append to end)

- [ ] **Step 1: Add `edit_report_fields` and `delete_report` functions**

Append the following to the end of `backend/app/services/report_service.py`:

```python
def edit_report_fields(db: Session, report_date: date, fields: dict) -> dict:
    """编辑报告的文本字段（market_summary / ai_report）"""
    report = db.query(MarketReport).filter(
        MarketReport.report_date == report_date
    ).first()
    if not report:
        return {"success": False, "error": f"未找到 {report_date} 的市场报告"}

    if "market_summary" in fields:
        report.market_summary = fields["market_summary"]
    if "ai_report" in fields:
        report.ai_report = fields["ai_report"]

    db.commit()
    return {"success": True, "data": {"date": str(report_date)}}


def delete_report(db: Session, report_date: date) -> dict:
    """删除某日市场报告"""
    count = db.query(MarketReport).filter(
        MarketReport.report_date == report_date
    ).delete()
    db.commit()
    if count == 0:
        return {"success": False, "error": f"未找到 {report_date} 的市场报告"}
    return {"success": True, "data": {"deleted": count}}
```

- [ ] **Step 2: Verify the file still imports correctly**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -c "from app.services.report_service import edit_report_fields, delete_report; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/report_service.py
git commit -m "feat(report): add edit and delete service functions"
```

---

### Task 3: Backend — Recommendation Router Endpoints

**Files:**
- Modify: `backend/app/routers/recommend.py:1-91`

- [ ] **Step 1: Update imports to include new service functions**

In `backend/app/routers/recommend.py`, change the import block (lines 9-16):

```python
from app.services.recommend_service import (
    get_recommend_stats,
    update_recommend_prices,
    get_recommend_by_date,
    get_all_recommendations,
    generate_recommendations,
    edit_day_recommendations,
    delete_day_recommendations,
)
```

- [ ] **Step 2: Add PUT and DELETE day endpoints**

Append after the existing `update_prices` endpoint (after line 91):

```python
@router.put("/day/{rec_date}")
async def edit_day(
    rec_date: date,
    updates: list,
    db: Session = Depends(get_db),
):
    """编辑某日推荐（批量更新/删除单条）"""
    result = edit_day_recommendations(db, rec_date, updates)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/day/{rec_date}")
async def delete_day(
    rec_date: date,
    db: Session = Depends(get_db),
):
    """删除某日全部推荐"""
    result = delete_day_recommendations(db, rec_date)
    return result
```

- [ ] **Step 3: Verify imports**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -c "from app.routers.recommend import router; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/recommend.py
git commit -m "feat(recommend): add day-level edit/delete API endpoints"
```

---

### Task 4: Backend — Report Router Endpoints + Poster Deletion

**Files:**
- Modify: `backend/app/routers/report.py:1-242`

- [ ] **Step 1: Add `import os` at the top of report.py**

Add after the existing imports:

```python
import os
```

- [ ] **Step 2: Update service imports**

In `backend/app/routers/report.py`, change the import block (lines 14-18):

```python
from app.services.report_service import (
    get_report_by_date,
    get_report_history,
    get_available_dates,
    generate_daily_report,
    edit_report_fields,
    delete_report,
)
```

- [ ] **Step 3: Add PUT/DELETE day and DELETE poster endpoints**

Append after the `poster_base64` endpoint (after line 242):

```python
@router.put("/day/{report_date}")
async def edit_day_report(
    report_date: date,
    fields: dict,
    db: Session = Depends(get_db),
):
    """编辑报告文本字段"""
    result = edit_report_fields(db, report_date, fields)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/day/{report_date}")
async def delete_day_report(
    report_date: date,
    db: Session = Depends(get_db),
):
    """删除某日市场报告"""
    result = delete_report(db, report_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.delete("/poster/{report_date}")
async def delete_poster(
    report_date: date,
):
    """删除指定日期的海报缓存文件"""
    poster_dir = os.path.join(os.path.dirname(__file__), "..", "static", "posters")
    poster_path = os.path.join(poster_dir, f"poster_{report_date}.png")
    if os.path.exists(poster_path):
        os.remove(poster_path)
        return {"success": True, "data": {"deleted": str(report_date)}}
    return {"success": True, "data": {"deleted": 0, "message": "海报文件不存在，无需删除"}}
```

- [ ] **Step 4: Verify imports**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -c "from app.routers.report import router; print('OK')"`

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/report.py
git commit -m "feat(report): add edit/delete endpoints and poster deletion"
```

---

### Task 5: Backend Verification

- [ ] **Step 1: Start backend and test all new endpoints**

```bash
cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -m uvicorn app.main:app --reload --port 8000 &
sleep 3
```

```bash
# Test recommend day delete (should return success with 0 deleted)
curl -s -X DELETE http://localhost:8000/api/recommend/day/2026-01-01 | python3 -m json.tool

# Test report day delete (should return 404)
curl -s -X DELETE http://localhost:8000/api/report/day/2026-01-01 | python3 -m json.tool

# Test poster delete (should return success)
curl -s -X DELETE http://localhost:8000/api/report/poster/2026-01-01 | python3 -m json.tool

# Test report edit (should return 404)
curl -s -X PUT http://localhost:8000/api/report/day/2026-01-01 -H 'Content-Type: application/json' -d '{"market_summary": "test"}' | python3 -m json.tool
```

- [ ] **Step 2: Verify FastAPI docs**

Open `http://localhost:8000/docs` and confirm these 5 new endpoints appear:
- `PUT /api/recommend/day/{rec_date}`
- `DELETE /api/recommend/day/{rec_date}`
- `PUT /api/report/day/{report_date}`
- `DELETE /api/report/day/{report_date}`
- `DELETE /api/report/poster/{report_date}`

- [ ] **Step 3: Kill backend process**

```bash
kill %1 2>/dev/null
```

---

### Task 6: Frontend — Add apiPut and apiDelete Helpers

**Files:**
- Modify: `frontend/src/services/api.ts:1-25`

- [ ] **Step 1: Add `apiPut` and `apiDelete` functions**

After the existing `apiPost` function (line 25), add:

```typescript
export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(api): add apiPut and apiDelete helper functions"
```

---

### Task 7: Frontend — Refactor SettingsPage into ConsolePage with Tab Layout

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx` (full rewrite)

This is the largest task. The file currently contains SettingsPage with all generation logic, polling, schedule config, and sub-components (Section, Msg, PBar, StatusBadge). We add a tab bar and 4 new tab components while keeping all existing code.

- [ ] **Step 1: Add tab state and tab navigation UI**

At the top of the `SettingsPage` component, after the existing `date` state, add:

```typescript
type Tab = 'recommend' | 'report' | 'tracking' | 'poster' | 'settings'
const [activeTab, setActiveTab] = useState<Tab>('recommend')
```

Replace the entire return JSX (lines 166-356) with the new tabbed layout. The key structure:

```tsx
return (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in-up">
    <div className="text-center mb-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">控制台</h1>
      <p className="text-xs sm:text-sm text-text-secondary">数据管理 · 生成 · 系统配置</p>
    </div>

    {/* Tab Bar */}
    <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-xl overflow-x-auto scrollbar-none">
      {([
        { key: 'recommend' as Tab, label: '智能推荐', icon: '🎯' },
        { key: 'report' as Tab, label: '市场报告', icon: '📊' },
        { key: 'tracking' as Tab, label: '收益跟踪', icon: '📈' },
        { key: 'poster' as Tab, label: '海报管理', icon: '🖼️' },
        { key: 'settings' as Tab, label: '系统设置', icon: '⚙️' },
      ]).map(t => (
        <button key={t.key} onClick={() => setActiveTab(t.key)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
            activeTab === t.key
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}>
          <span>{t.icon}</span>
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-5">
      {/* Shared date picker */}
      <Section icon="📅" title="目标日期">
        <input type="date" value={date} max={today}
          onChange={e => setDate(e.target.value)}
          disabled={btnDisabled}
          className="w-full bg-white border border-border-default text-text-primary text-center px-3 py-2 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50" />
      </Section>

      {activeTab === 'recommend' && <RecommendTab date={date} />}
      {activeTab === 'report' && <ReportTab date={date} />}
      {activeTab === 'tracking' && <TrackingTab date={date} />}
      {activeTab === 'poster' && <PosterTab date={date} />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  </div>
)
```

- [ ] **Step 2: Create RecommendTab component (inline in same file)**

Add before the `SettingsPage` default export:

```tsx
function RecommendTab({ date }: { date: string }) {
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [c, setC] = useState({ status: 'idle' as StatusT, step: 0, total: 0, label: '', pct: 0, candidates: [] as any[], msg: null as MsgT | null })
  const [editModal, setEditModal] = useState(false)
  const [editItems, setEditItems] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)
  const [showCands, setShowCands] = useState(false)

  const loadRecs = async () => {
    setLoading(true)
    try {
      const res = await apiGet<any>(`/recommend/daily?date=${date}`)
      setRecs(res.data || [])
    } catch { setRecs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadRecs() }, [date])

  const busy = (s: StatusT) => s === 'pending' || s === 'running'

  const poll = (taskId: number) => {
    const iv = setInterval(async () => {
      try {
        const res = await apiGet<any>(`/generate/task/${taskId}`)
        if (!res.success) { clearInterval(iv); return }
        const d = res.data
        setC(p => ({ ...p, step: d.current_step, total: d.total_steps, label: d.step_label || '', pct: d.progress_pct, status: d.status, candidates: d.candidate_stocks?.length > 0 ? d.candidate_stocks : p.candidates }))
        if (d.status === 'completed') {
          clearInterval(iv)
          const cnt = d.result?.count
          if (cnt === 0 || cnt === undefined) setC(p => ({ ...p, msg: { type: 'warn' as const, text: `⚠️ ${d.target_date} 无候选主板股票` } }))
          else setC(p => ({ ...p, msg: { type: 'success' as const, text: `✅ ${d.target_date} 推荐完成，共 ${cnt} 只` } }))
          loadRecs()
        } else if (d.status === 'failed') { clearInterval(iv); setC(p => ({ ...p, msg: { type: 'error' as const, text: d.error_message || '失败' } })) }
      } catch {}
    }, 1000)
  }

  const startGen = async () => {
    setC(p => ({ ...p, status: 'pending', msg: null }))
    try {
      const res = await apiPost<any>(`/generate/recommend?date=${date}`)
      if (res.success && res.data?.task_id) {
        setC(p => ({ ...p, status: 'running' }))
        poll(res.data.task_id)
      } else if (res.data?.message) {
        setC(p => ({ ...p, status: 'completed', msg: { type: 'success', text: res.data.message } }))
        loadRecs()
      }
    } catch (e: any) {
      setC(p => ({ ...p, status: 'failed', msg: { type: 'error', text: `启动失败: ${e.message}` } }))
    }
  }

  const openEdit = () => {
    setEditItems(recs.map((r, i) => ({ id: i, ...r, delete: false })))
    setEditModal(true)
  }

  const saveEdit = async () => {
    try {
      await apiPut(`/recommend/day/${date}`, editItems)
      setEditModal(false)
      loadRecs()
      setMsg({ type: 'success', text: '✅ 已保存' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const deleteDay = async () => {
    try {
      await apiDelete(`/recommend/day/${date}`)
      setDeleteConfirm(false)
      setRecs([])
      setMsg({ type: 'success', text: '✅ 已删除' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  return (
    <Section icon="🎯" title="智能推荐管理">
      <div className="flex gap-2 flex-wrap">
        <button onClick={startGen} disabled={busy(c.status)}
          className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-md shadow-amber-200 disabled:cursor-not-allowed">
          {busy(c.status) ? (c.label || '生成中...') : '🤖 AI 一键生成'}
        </button>
        <button onClick={openEdit} disabled={recs.length === 0}
          className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
          ✏️ 编辑整组
        </button>
        <button onClick={() => setDeleteConfirm(true)} disabled={recs.length === 0}
          className="py-2 px-4 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-all">
          🗑️ 删除
        </button>
      </div>
      {busy(c.status) && <PBar pct={c.pct} label={c.label} cur={c.step} tot={c.total} />}
      {c.msg && <Msg msg={c.msg} />}
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : recs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-text-muted text-left">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">代码</th>
                <th className="py-2 px-2">名称</th>
                <th className="py-2 px-2 text-right">推荐价</th>
                <th className="py-2 px-2">理由</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r: any, i: number) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-2 text-text-muted">{i + 1}</td>
                  <td className="py-2 px-2 font-mono">{r.stock_code}</td>
                  <td className="py-2 px-2 font-medium">{r.stock_name}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.recommend_price}</td>
                  <td className="py-2 px-2 text-text-muted text-xs max-w-[200px] truncate">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无推荐数据</div>
      )}

      {c.candidates.length > 0 && (
        <div className="border-t border-border-default pt-2 mt-1">
          <button onClick={() => setShowCands(!showCands)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
            {showCands ? '▼' : '▶'} 候选池（{c.candidates.length} 只）
          </button>
          {showCands && (
            <div className="max-h-48 overflow-y-auto space-y-1 mt-2 pr-1">
              {c.candidates.map((s: any, i: number) => (
                <div key={s.code} className="flex items-center gap-2 px-2 py-1.5 rounded bg-blue-50/50 text-[11px] border border-blue-100/50">
                  <span className="text-text-muted font-mono w-4 text-right">{i + 1}</span>
                  <span className="font-semibold text-blue-800 w-14 truncate">{s.name}</span>
                  <span className="text-text-muted font-mono w-12">{s.code}</span>
                  <span className="text-text-muted font-mono w-10 text-right">{s.price}</span>
                  <span className={`font-mono w-10 text-right ${s.change_pct >= 0 ? 'text-red-500' : 'text-green-600'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">编辑 {date} 推荐</h3>
            {editItems.map((item, idx) => (
              <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border ${item.delete ? 'bg-red-50 border-red-200 opacity-50' : 'bg-gray-50 border-border-default'}`}>
                <span className="text-xs font-mono w-12">{item.stock_code}</span>
                <span className="text-xs font-medium w-16">{item.stock_name}</span>
                <input type="number" step="0.01" value={item.recommend_price}
                  onChange={e => { const next = [...editItems]; next[idx].recommend_price = parseFloat(e.target.value) || 0; setEditItems(next) }}
                  className="w-20 text-xs border rounded px-1 py-0.5 font-mono" />
                <input type="text" value={item.reason || ''} placeholder="理由"
                  onChange={e => { const next = [...editItems]; next[idx].reason = e.target.value; setEditItems(next) }}
                  className="flex-1 text-xs border rounded px-2 py-0.5" />
                <button onClick={() => { const next = [...editItems]; next[idx].delete = !next[idx].delete; setEditItems(next) }}
                  className={`text-xs px-2 py-0.5 rounded ${item.delete ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>
                  {item.delete ? '恢复' : '删除'}
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">保存</button>
              <button onClick={() => setEditModal(false)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">确认删除</h3>
            <p className="text-sm text-text-secondary">确定要删除 {date} 的全部推荐记录（共 {recs.length} 条）？此操作不可撤销。</p>
            <div className="flex gap-2">
              <button onClick={deleteDay} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600">确认删除</button>
              <button onClick={() => setDeleteConfirm(false)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
```

- [ ] **Step 3: Create ReportTab component**

```tsx
function ReportTab({ date }: { date: string }) {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editField, setEditField] = useState<'market_summary' | 'ai_report' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)
  const [genStatus, setGenStatus] = useState<StatusT>('idle')
  const [genLabel, setGenLabel] = useState('')
  const [genPct, setGenPct] = useState(0)

  const loadReport = async () => {
    setLoading(true)
    try {
      const res = await apiGet<any>(`/report/daily?date=${date}`)
      setReport(res.data)
    } catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [date])

  const busy = (s: StatusT) => s === 'pending' || s === 'running'

  const openEdit = (field: 'market_summary' | 'ai_report') => {
    setEditField(field)
    setEditValue(report?.[field] || '')
  }

  const saveEdit = async () => {
    if (!editField) return
    try {
      await apiPut(`/report/day/${date}`, { [editField]: editValue })
      setEditField(null)
      loadReport()
      setMsg({ type: 'success', text: '✅ 已保存' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const deleteDay = async () => {
    try {
      await apiDelete(`/report/day/${date}`)
      setDeleteConfirm(false)
      setReport(null)
      setMsg({ type: 'success', text: '✅ 已删除' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const genReport = async () => {
    setGenStatus('pending')
    try {
      const res = await apiPost<any>(`/generate/report?date=${date}`)
      if (res.success && res.data?.task_id) {
        setGenStatus('running')
        const iv = setInterval(async () => {
          try {
            const r = await apiGet<any>(`/generate/task/${res.data.task_id}`)
            if (r.success) {
              setGenLabel(r.data.step_label || '')
              setGenPct(r.data.progress_pct || 0)
              setGenStatus(r.data.status)
              if (r.data.status === 'completed' || r.data.status === 'failed') {
                clearInterval(iv)
                if (r.data.status === 'completed') { setMsg({ type: 'success', text: '✅ 报告生成完成' }); loadReport() }
              }
            }
          } catch {}
        }, 1000)
      } else if (res.data?.message) {
        setGenStatus('completed')
        setMsg({ type: 'success', text: res.data.message })
        loadReport()
      }
    } catch (e: any) {
      setGenStatus('failed')
      setMsg({ type: 'error', text: e.message })
    }
  }

  return (
    <Section icon="📊" title="市场报告管理">
      <div className="flex gap-2">
        <button onClick={genReport} disabled={busy(genStatus)}
          className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-md shadow-blue-200 disabled:cursor-not-allowed">
          {busy(genStatus) ? (genLabel || '生成中...') : '🤖 AI 一键生成'}
        </button>
        <button onClick={() => setDeleteConfirm(true)} disabled={!report}
          className="py-2 px-4 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-all">
          🗑️ 删除
        </button>
      </div>
      {busy(genStatus) && <PBar pct={genPct} label={genLabel} cur={0} tot={0} />}
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : report ? (
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-secondary">市场概况</span>
              <button onClick={() => openEdit('market_summary')} className="text-xs text-blue-600 hover:text-blue-800">✏️ 编辑</button>
            </div>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{report.market_summary || '暂无'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-secondary">AI 分析</span>
              <button onClick={() => openEdit('ai_report')} className="text-xs text-blue-600 hover:text-blue-800">✏️ 编辑</button>
            </div>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{report.ai_report || '暂无'}</p>
          </div>
          {report.index_data?.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-bold text-text-secondary block mb-2">指数数据</span>
              <div className="flex flex-wrap gap-2">
                {report.index_data.map((idx: any, i: number) => (
                  <span key={i} className="text-xs bg-white px-2 py-1 rounded-lg border border-border-default">
                    {idx.name} <span className={idx.change_pct >= 0 ? 'text-red-500' : 'text-green-600'}>{idx.change_pct >= 0 ? '+' : ''}{idx.change_pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.hot_sectors?.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-bold text-text-secondary block mb-2">热门板块</span>
              <div className="flex flex-wrap gap-2">
                {report.hot_sectors.slice(0, 8).map((s: any, i: number) => (
                  <span key={i} className="text-xs bg-white px-2 py-1 rounded-lg border border-border-default">
                    {s.name} <span className={s.change_pct >= 0 ? 'text-red-500' : 'text-green-600'}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无报告数据</div>
      )}

      {editField && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditField(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">编辑{editField === 'market_summary' ? '市场概况' : 'AI 分析'}</h3>
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={10}
              className="w-full border border-border-default rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400 resize-y" />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">保存</button>
              <button onClick={() => setEditField(null)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">确认删除</h3>
            <p className="text-sm text-text-secondary">确定要删除 {date} 的市场报告？此操作不可撤销。</p>
            <div className="flex gap-2">
              <button onClick={deleteDay} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600">确认删除</button>
              <button onClick={() => setDeleteConfirm(false)} className="py-2 px-4 bg-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300">取消</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
```

- [ ] **Step 4: Create TrackingTab component**

```tsx
function TrackingTab({ date }: { date: string }) {
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)

  const loadRecs = async () => {
    setLoading(true)
    try {
      const res = await apiGet<any>('/recommend/history')
      const all = res.data || []
      setRecs(all.filter((r: any) => r.recommend_date === date))
    } catch { setRecs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadRecs() }, [date])

  const triggerUpdate = async () => {
    setUpdating(true); setMsg(null)
    try {
      const r = await apiPost('/recommend/update-prices')
      setMsg({ type: 'success', text: `✅ 更新完成，共 ${r.data?.data?.updated || 0} 只` })
      loadRecs()
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
    finally { setUpdating(false) }
  }

  return (
    <Section icon="📈" title="收益跟踪">
      <div className="flex gap-2">
        <button onClick={triggerUpdate} disabled={updating}
          className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-green-200 disabled:cursor-not-allowed">
          {updating ? '更新中...' : '💰 触发更新'}
        </button>
      </div>
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : recs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-text-muted text-left">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">代码</th>
                <th className="py-2 px-2">名称</th>
                <th className="py-2 px-2 text-right">跟踪天</th>
                <th className="py-2 px-2 text-right">当前价</th>
                <th className="py-2 px-2 text-right">收益率</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r: any, i: number) => (
                <tr key={i} className="border-b border-border-default/50">
                  <td className="py-2 px-2 text-text-muted">{i + 1}</td>
                  <td className="py-2 px-2 font-mono">{r.stock_code}</td>
                  <td className="py-2 px-2 font-medium">{r.stock_name}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.tracking_days}/3</td>
                  <td className="py-2 px-2 text-right font-mono">{r.current_price || '-'}</td>
                  <td className={`py-2 px-2 text-right font-mono ${(r.return_rate || 0) >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {r.return_rate ? `${r.return_rate >= 0 ? '+' : ''}${r.return_rate.toFixed(2)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无跟踪数据</div>
      )}
    </Section>
  )
}
```

- [ ] **Step 5: Create PosterTab component**

```tsx
function PosterTab({ date }: { date: string }) {
  const [posterUrl, setPosterUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [msg, setMsg] = useState<MsgT | null>(null)

  const API_BASE = import.meta.env.VITE_API_URL || '/api'

  const loadPoster = async () => {
    setLoading(true); setPosterUrl('')
    try {
      const res = await apiGet<any>(`/report/poster/base64?date=${date}`)
      if (res.success && res.data?.base64) setPosterUrl(`data:image/png;base64,${res.data.base64}`)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadPoster() }, [date])

  const downloadPoster = async () => {
    try {
      const resp = await fetch(`${API_BASE}/report/poster?date=${date}`)
      if (!resp.ok) throw new Error('下载失败')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `QuantForge_市场日报_${date}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const genPoster = async () => {
    setGenLoading(true); setMsg(null)
    try {
      const resp = await fetch(`${API_BASE}/report/poster?date=${date}`)
      if (!resp.ok) { const err = await resp.json().catch(() => ({ detail: '生成失败' })); setMsg({ type: 'error', text: err.detail }); return }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `QuantForge_市场日报_${date}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: `✅ 海报已生成并下载（${date}）` })
      loadPoster()
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
    finally { setGenLoading(false) }
  }

  const deletePoster = async () => {
    try {
      await apiDelete(`/report/poster/${date}`)
      setPosterUrl('')
      setMsg({ type: 'success', text: '✅ 海报已删除' })
    } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  return (
    <Section icon="🖼️" title="海报管理">
      <div className="flex gap-2">
        <button onClick={genPoster} disabled={genLoading}
          className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 transition-all shadow-md shadow-purple-200 disabled:cursor-not-allowed">
          {genLoading ? '生成中...' : '🖼️ 生成海报'}
        </button>
        <button onClick={downloadPoster} disabled={!posterUrl}
          className="py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
          ⬇️ 下载
        </button>
        <button onClick={deletePoster} disabled={!posterUrl}
          className="py-2 px-4 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-all">
          🗑️ 删除
        </button>
      </div>
      {msg && <Msg msg={msg} />}

      {loading ? (
        <div className="text-center text-text-muted py-4 text-sm">加载中...</div>
      ) : posterUrl ? (
        <div className="flex justify-center">
          <img src={posterUrl} alt={`海报 ${date}`} className="max-w-full max-h-[600px] rounded-xl shadow-lg border border-border-default" />
        </div>
      ) : (
        <div className="text-center text-text-muted py-6 text-sm">该日期暂无海报</div>
      )}
    </Section>
  )
}
```

- [ ] **Step 6: Create SettingsTab component (move existing schedule code)**

```tsx
function SettingsTab() {
  const [sched, setSched] = useState<any>(null)
  const [sEn, setSEn] = useState(false)
  const [sTime, setSTime] = useState('16:00')
  const [sRpt, setSRpt] = useState(true)
  const [sRec, setSRec] = useState(true)
  const [sSaving, setSSaving] = useState(false)
  const [sMsg, setSMsg] = useState('')

  useEffect(() => {
    apiGet<any>('/schedule/config').then(d => {
      if (d.success) { setSched(d.data); setSEn(d.data.enabled); setSTime(d.data.run_time || '16:00'); setSRpt(d.data.run_report); setSRec(d.data.run_recommend) }
    }).catch(() => {})
  }, [])

  const saveSched = async () => {
    setSSaving(true); setSMsg('')
    try { const r = await apiPost(`/schedule/config?enabled=${sEn}&run_time=${sTime}&run_report=${sRpt}&run_recommend=${sRec}`); setSMsg(r.success ? '✅ 已保存' : '❌ 失败') }
    catch { setSMsg('❌ 失败') }
    finally { setSSaving(false); setTimeout(() => setSMsg(''), 3000) }
  }

  return (
    <Section icon="⏰" title="定时任务">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-text-secondary font-medium">每日自动生成</div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={sEn} onChange={e => setSEn(e.target.checked)} className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs text-text-muted block mb-1.5 font-medium">执行时间</label>
          <input type="time" value={sTime} onChange={e => setSTime(e.target.value)}
            className="w-full bg-white border border-border-default text-text-primary text-center px-2 py-1.5 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex items-end gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1.5 font-medium">自动报告</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={sRpt} onChange={e => setSRpt(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1.5 font-medium">自动推荐</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={sRec} onChange={e => setSRec(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
        </div>
        <div className="flex items-end justify-end">
          <button onClick={saveSched} disabled={sSaving}
            className="py-2 px-5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all">
            {sSaving ? '保存中...' : '保存配置'}
          </button>
          {sMsg && <span className="text-xs ml-2 font-medium text-green-600">{sMsg}</span>}
        </div>
      </div>
      {sched && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
          <div>
            <div className="text-text-muted mb-0.5 font-medium">上次执行</div>
            <div className="font-medium text-text-primary">{sched.last_run_at ? `${sched.last_run_at}（${sched.last_run_info || '未知'}）` : '从未执行'}</div>
            {sched.last_run_result && <div className="text-text-muted mt-0.5 text-[11px]">{sched.last_run_result}</div>}
          </div>
          <div>
            <div className="text-text-muted mb-0.5 font-medium">下次执行</div>
            <div className="font-medium text-text-primary">{sEn ? `每天 ${sTime}` : '已禁用'}</div>
          </div>
        </div>
      )}
    </Section>
  )
}
```

- [ ] **Step 7: Clean up the main SettingsPage component**

Remove all state variables that are now in sub-components: `r`, `setR`, `c`, `setC`, `a`, `setA`, `pLoading`, `setPLoading`, `pMsg`, `setPMsg`, `posterLoading`, `setPosterLoading`, `posterMsg`, `setPosterMsg`, `showCands`, `setShowCands`, `sched`, `setSched`, `sEn`, `setSEn`, `sTime`, `setSTime`, `sRpt`, `setSRpt`, `sRec`, `setSRec`, `sSaving`, `setSSaving`, `sMsg`, `setSMsg`.

Also remove the helper functions: `poll`, `start`, `updPrice`, `genPoster`, `saveSched`.

Keep only: `today`, `date`, `setDate`, `activeTab`, `setActiveTab`, `btnDisabled` (derived from nothing now — just `false` since sub-components manage their own busy states).

The `Section`, `Msg`, `PBar`, `StatusBadge` sub-components remain in the file.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npx tsc --noEmit`

Fix any TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat(console): refactor SettingsPage into tabbed ConsolePage"
```

---

### Task 8: Frontend — Update Router and Navbar

**Files:**
- Modify: `frontend/src/App.tsx:19` (route)
- Modify: `frontend/src/components/Navbar.tsx:10` (nav item)

- [ ] **Step 1: Update App.tsx route**

Change line 25 in `frontend/src/App.tsx`:

```tsx
// Before:
<Route path="/settings" element={<SettingsPage />} />

// After:
<Route path="/console" element={<SettingsPage />} />
```

- [ ] **Step 2: Update Navbar.tsx nav item**

Change line 10 in `frontend/src/components/Navbar.tsx`:

```tsx
// Before:
{ path: '/settings', label: '设置', icon: '⚙️' },

// After:
{ path: '/console', label: '控制台', icon: '⚙️' },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/libokai/IdeaProjects/QuantForge/frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Navbar.tsx
git commit -m "feat(console): update route and navbar to /console"
```

---

### Task 9: Full Integration Verification

- [ ] **Step 1: Start both backend and frontend**

```bash
cd /Users/libokai/IdeaProjects/QuantForge/backend && python3 -m uvicorn app.main:app --reload --port 8000 &
cd /Users/libokai/IdeaProjects/QuantForge/frontend && npm run dev
```

- [ ] **Step 2: Verify all 5 tabs render correctly**

Open `http://localhost:5173/console` and check:
1. Tab bar shows 5 tabs with icons (🎯📊📈🖼️⚙️)
2. Date picker works and persists across tab switches
3. 智能推荐 tab: loads data, edit modal opens, delete confirm works
4. 市场报告 tab: loads report, edit modal works, AI generation triggers
5. 收益跟踪 tab: loads tracking data, update button works
6. 海报管理 tab: preview loads (or shows empty), download/delete buttons work
7. 系统设置 tab: schedule config loads and saves

- [ ] **Step 3: Test CRUD operations end-to-end via curl**

```bash
# Test recommend delete
curl -s -X DELETE http://localhost:8000/api/recommend/day/2026-05-27 | python3 -m json.tool

# Test report edit
curl -s -X PUT http://localhost:8000/api/report/day/2026-05-27 \
  -H 'Content-Type: application/json' \
  -d '{"market_summary": "测试市场概况"}' | python3 -m json.tool

# Test poster delete
curl -s -X DELETE http://localhost:8000/api/report/poster/2026-05-27 | python3 -m json.tool
```

- [ ] **Step 4: Verify Navbar link works**

Click "控制台" in the navbar — should navigate to `/console` and render the ConsolePage.

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(console): integration fixes"
```

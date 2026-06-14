import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HistoryRec } from '../services/api'
import { reviewApi } from '../services/reviewApi'

type ReturnField = 'return_rate_day1' | 'return_rate_day3' | 'return_rate_day5' | 'return_rate_day7'
type PriceField = 'price_day1' | 'price_day3' | 'price_day5' | 'price_day7'

function fmt(n?: number, d = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '--'
}

function fmtRate(n?: number) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function ReturnCell({ day, rec }: { day: 1 | 3 | 5 | 7; rec: HistoryRec }) {
  const priceField = `price_day${day}` as PriceField
  const rateField = `return_rate_day${day}` as ReturnField
  const price = rec[priceField] || 0
  const rate = rec[rateField] || 0
  const has = price > 0
  const active = day === rec.tracking_days && rec.status !== 'completed'

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 14,
      background: active ? 'var(--accent-bg)' : has ? (rate >= 0 ? 'var(--up-bg)' : 'var(--down-bg)') : 'rgba(255,255,255,0.045)',
      border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border-default)'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 10 }}>
        <span>{day}日</span>
        <span>{has ? fmt(price) : '待更新'}</span>
      </div>
      <div className="mono" style={{ marginTop: 5, fontSize: 15, fontWeight: 900, color: has ? (rate >= 0 ? 'var(--up)' : 'var(--down)') : 'var(--text-dim)' }}>
        {has ? fmtRate(rate) : '--'}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const [recs, setRecs] = useState<HistoryRec[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())

  const loadData = useCallback(() => {
    setLoading(true)
    reviewApi.history()
      .then(d => { if (d.success) setRecs(d.data || []); else setError(d.error || '') })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const updateReturns = async () => {
    setUpdating(true)
    setError('')
    try {
      await reviewApi.updatePrices()
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUpdating(false)
    }
  }

  const handleReset = async (id: number) => {
    setBusyIds(p => new Set(p).add(id))
    try {
      await reviewApi.resetItem(id)
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyIds(p => { const n = new Set(p); n.delete(id); return n })
    }
  }

  const handleDelete = async (id: number) => {
    setBusyIds(p => new Set(p).add(id))
    try {
      await reviewApi.deleteItem(id)
      setConfirmDelete(null)
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyIds(p => { const n = new Set(p); n.delete(id); return n })
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    setBatchDeleting(true)
    try {
      await reviewApi.batchDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
      setBatchMode(false)
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBatchDeleting(false)
    }
  }

  const handleBatchReset = async () => {
    if (selectedIds.size === 0) return
    setBatchDeleting(true)
    try {
      await reviewApi.batchReset(Array.from(selectedIds))
      setSelectedIds(new Set())
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBatchDeleting(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(p => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toggleDateGroup = (ids: number[]) => {
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(p => {
      const n = new Set(p)
      ids.forEach(id => { if (allSelected) n.delete(id); else n.add(id) })
      return n
    })
  }

  const grouped = useMemo(() => recs.reduce<Record<string, HistoryRec[]>>((acc, r) => {
    (acc[r.recommend_date] ||= []).push(r)
    return acc
  }, {}), [recs])

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  const completed = recs.filter(r => r.status === 'completed')
  const tracking = recs.filter(r => r.status === 'tracking')
  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const avgByDay = (day: 1 | 3 | 5 | 7) => avg(recs.map(r => r[`return_rate_day${day}` as ReturnField]).filter(v => typeof v === 'number' && v !== 0))
  const finalAvg = avg(completed.map(r => r.final_return_rate))
  const winRate = completed.length ? completed.filter(r => r.final_return_rate > 0).length / completed.length * 100 : 0

  return (
    <div className="qf-page qf-page-wide">
      <div className="qf-page-header">
        <div>
          <div className="qf-eyebrow">Return Review</div>
          <h1 className="qf-title">收益复盘</h1>
          <p className="qf-subtitle">按推荐日期回看 3、5、7 个交易日表现。这里用来判断策略到底有没有持续赚钱，而不是只看单日好坏。</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()) }}
            className="qf-ghost-button"
            style={{
              width: 'auto', marginTop: 0, padding: '12px 16px',
              background: batchMode ? 'var(--accent-bg)' : undefined,
              borderColor: batchMode ? 'var(--border-accent)' : undefined,
              color: batchMode ? 'var(--accent-light)' : undefined,
            }}
          >
            {batchMode ? '退出批量' : '批量管理'}
          </button>
          <button onClick={updateReturns} disabled={updating} className="qf-action-button" style={{ width: 'auto' }}>
            {updating ? '更新中...' : '更新收益跟踪'}
          </button>
        </div>
      </div>

      {!loading && (
        <section className="card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="qf-stat-grid">
            <div className="qf-stat"><div className="qf-stat-label">总推荐</div><div className="qf-stat-value">{recs.length}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">跟踪中</div><div className="qf-stat-value" style={{ color: 'var(--accent-light)' }}>{tracking.length}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">1日均收</div><div className="qf-stat-value" style={{ color: avgByDay(1) >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(avgByDay(1))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">3日均收</div><div className="qf-stat-value" style={{ color: avgByDay(3) >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(avgByDay(3))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">5日均收</div><div className="qf-stat-value" style={{ color: avgByDay(5) >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(avgByDay(5))}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">最终均收</div><div className="qf-stat-value" style={{ color: finalAvg >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtRate(finalAvg)}</div></div>
            <div className="qf-stat"><div className="qf-stat-label">最终胜率</div><div className="qf-stat-value" style={{ color: 'var(--gold)' }}>{fmt(winRate, 1)}%</div></div>
          </div>
        </section>
      )}

      {batchMode && selectedIds.size > 0 && (
        <div style={{
          position: 'sticky', top: 14, zIndex: 50,
          marginBottom: 18,
          padding: '10px 18px',
          borderRadius: 16,
          background: 'rgba(15,15,20,0.85)',
          backdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            已选 <strong style={{ color: 'var(--accent-light)' }}>{selectedIds.size}</strong> 条
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleBatchReset}
            disabled={batchDeleting}
            className="qf-ghost-button"
            style={{ width: 'auto', marginTop: 0, padding: '8px 16px', color: 'var(--accent-light)' }}
          >
            {batchDeleting ? '执行中...' : '批量重置'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('确定删除选中的 ' + selectedIds.size + ' 条推荐记录？此操作不可恢复。')) {
                handleBatchDelete()
              }
            }}
            disabled={batchDeleting}
            className="qf-ghost-button"
            style={{
              width: 'auto', marginTop: 0, padding: '8px 16px',
              borderColor: 'rgba(239,68,68,0.3)', color: 'var(--up)',
            }}
          >
            {batchDeleting ? '删除中...' : '批量删除'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gap: 16 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 190, borderRadius: 22 }} />)}
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: 18, borderColor: 'rgba(255,90,107,.36)', color: 'var(--up)' }}>{error}</div>
      )}

      {!loading && dates.length === 0 && !error && (
        <section className="card" style={{ padding: '72px 34px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, color: 'var(--accent-light)', marginBottom: 12 }}>⌁</div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>暂无跟踪数据</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>生成推荐后，系统会自动跟踪 1/3/5/7 个交易日收益。</p>
        </section>
      )}

      {!loading && dates.length > 0 && (
        <div style={{ display: 'grid', gap: 18 }}>
          {dates.map(date => {
            const dayRecs = grouped[date].sort((a, b) => (a.rank || 99) - (b.rank || 99))
            const done = dayRecs.filter(r => r.status === 'completed')
            const dayAvg = avg(done.map(r => r.final_return_rate))
            const dateIds = dayRecs.map(r => r.id!)
            const allSelected = dateIds.every(id => selectedIds.has(id))

            return (
              <section key={date} className="card" style={{ overflow: 'hidden' }}>
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-default)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {batchMode && (
                      <label style={{
                        display: 'grid', placeItems: 'center', width: 22, height: 22,
                        borderRadius: 6, border: '2px solid var(--border-default)',
                        cursor: 'pointer', background: allSelected ? 'var(--accent)' : 'transparent',
                        borderColor: allSelected ? 'var(--accent)' : undefined,
                      }}>
                        <input type="checkbox" checked={allSelected} onChange={() => toggleDateGroup(dateIds)}
                          style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
                        {allSelected && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
                      </label>
                    )}
                    <div>
                      <div className="mono" style={{ fontSize: 18, color: 'var(--accent-light)', fontWeight: 900 }}>{date}</div>
                      <div style={{ marginTop: 3, color: 'var(--text-muted)', fontSize: 12 }}>{dayRecs.length} 只推荐 · {done.length} 只完结</div>
                    </div>
                  </div>
                  {done.length > 0 && <div className="mono" style={{ color: dayAvg >= 0 ? 'var(--up)' : 'var(--down)', fontSize: 18, fontWeight: 900 }}>均值 {fmtRate(dayAvg)}</div>}
                </div>

                <div style={{ display: 'grid' }}>
                  {dayRecs.map(rec => (
                    <div key={rec.id} style={{
                      display: 'grid',
                      gridTemplateColumns: batchMode ? '40px minmax(190px, 1fr) 320px 130px 48px' : 'minmax(220px, 1fr) 320px 130px 48px',
                      gap: 14, padding: '14px 20px',
                      borderBottom: '1px solid var(--border-default)',
                      alignItems: 'center',
                      opacity: busyIds.has(rec.id!) ? 0.5 : 1,
                      transition: 'opacity 0.2s ease',
                    }}>
                      {batchMode && (
                        <label style={{
                          display: 'grid', placeItems: 'center', width: 22, height: 22,
                          borderRadius: 6, border: '2px solid var(--border-default)',
                          cursor: 'pointer', background: selectedIds.has(rec.id!) ? 'var(--accent)' : 'transparent',
                          borderColor: selectedIds.has(rec.id!) ? 'var(--accent)' : undefined,
                        }}>
                          <input type="checkbox" checked={selectedIds.has(rec.id!)} onChange={() => toggleSelect(rec.id!)}
                            style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
                          {selectedIds.has(rec.id!) && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
                        </label>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span className="mono" style={{ color: 'var(--accent-light)', fontWeight: 900 }}>#{rec.rank || '-'}</span>
                          <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>{rec.stock_name}</strong>
                          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{rec.stock_code}</span>
                          <span className={`badge ${rec.status === 'completed' ? 'badge-down' : rec.status === 'tracking' ? 'badge-accent' : ''}`}>
                            {rec.status === 'completed' ? '已完结' : rec.status === 'tracking' ? `${rec.tracking_days}/7天` : '待更新'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                          <span>推荐价 <strong className="mono" style={{ color: 'var(--text-primary)' }}>{fmt(rec.recommend_price)}</strong></span>
                          <span>综合分 <strong className="mono" style={{ color: 'var(--gold)' }}>{fmt(rec.score, 1)}</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        <ReturnCell day={1} rec={rec} />
                        <ReturnCell day={3} rec={rec} />
                        <ReturnCell day={5} rec={rec} />
                        <ReturnCell day={7} rec={rec} />
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>最终收益</div>
                        <div className="mono" style={{ marginTop: 5, color: rec.final_return_rate >= 0 ? 'var(--up)' : 'var(--down)', fontSize: 23, fontWeight: 900 }}>
                          {fmtRate(rec.final_return_rate)}
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: 11 }}>
                          高点 +{fmt(rec.max_gain)}% / 回撤 {fmt(rec.max_drawdown)}%
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        <button
                          title="重置跟踪"
                          onClick={() => handleReset(rec.id!)}
                          disabled={busyIds.has(rec.id!)}
                          style={{
                            width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border-default)',
                            background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
                            color: 'var(--text-dim)', fontSize: 15, lineHeight: 1,
                            display: 'grid', placeItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget;
                            el.style.color = 'var(--accent-light)';
                            el.style.borderColor = 'var(--border-accent)';
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget;
                            el.style.color = 'var(--text-dim)';
                            el.style.borderColor = 'var(--border-default)';
                          }}
                        >↻</button>
                        <button
                          title="删除记录"
                          onClick={() => setConfirmDelete({ id: rec.id!, name: rec.stock_name })}
                          disabled={busyIds.has(rec.id!)}
                          style={{
                            width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border-default)',
                            background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
                            color: 'var(--text-dim)', fontSize: 15, lineHeight: 1,
                            display: 'grid', placeItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget;
                            el.style.color = 'var(--up)';
                            el.style.borderColor = 'rgba(239,68,68,0.3)';
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget;
                            el.style.color = 'var(--text-dim)';
                            el.style.borderColor = 'var(--border-default)';
                          }}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          display: 'grid', placeItems: 'center',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        }} onClick={() => setConfirmDelete(null)}>
          <div className="card" style={{ padding: 28, maxWidth: 400, width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>确认删除</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22, lineHeight: 1.5 }}>
              确定要删除推荐 #{confirmDelete.id} &ldquo;{confirmDelete.name}&rdquo; 的记录吗？此操作不可恢复。
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="qf-ghost-button"
                style={{ width: 'auto', padding: '8px 18px', marginTop: 0 }}
                onClick={() => setConfirmDelete(null)}>取消</button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="qf-action-button"
                style={{
                  width: 'auto', padding: '8px 18px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                }}
              >确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState, useRef } from 'react'
import { apiGet } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface PosterState {
  loading: boolean
  error: string
  hasReport: boolean
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className || 'h-36'}`} />
}

function EmptyState({ icon, text, action }: { icon: string; text: string; action?: string }) {
  return (
    <div className="text-center py-16 fade-in-up">
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <div className="text-sm text-text-muted">{text}</div>
      {action && <div className="text-xs text-text-muted mt-1.5">{action}</div>}
    </div>
  )
}

export default function PosterPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [tradeDates, setTradeDates] = useState<string[]>([])
  const [posterUrl, setPosterUrl] = useState<string>('')
  const [state, setState] = useState<PosterState>({ loading: false, error: '', hasReport: false })
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    apiGet<any>('/report/trade-dates?days=365')
      .then(d => { if (d.success) setTradeDates(d.data || []) })
      .catch(() => {})
  }, [])

  const loadPoster = async (d: string) => {
    setState({ loading: true, error: '', hasReport: false })
    setPosterUrl('')
    try {
      const url = `${API_BASE}/report/poster?date=${d}`
      const resp = await fetch(url)
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: '海报生成失败' }))
        setState({ loading: false, error: err.detail || '暂无该日期报告', hasReport: false })
        return
      }
      const blob = await resp.blob()
      const objUrl = URL.createObjectURL(blob)
      setPosterUrl(objUrl)
      setState({ loading: false, error: '', hasReport: true })
    } catch {
      setState({ loading: false, error: '网络错误，请稍后重试', hasReport: false })
    }
  }

  useEffect(() => {
    if (selectedDate) loadPoster(selectedDate)
    return () => { if (posterUrl) URL.revokeObjectURL(posterUrl) }
  }, [selectedDate])

  const dateIdx = tradeDates.indexOf(selectedDate)
  const canPrev = dateIdx > 0
  const canNext = dateIdx >= 0 && dateIdx < tradeDates.length - 1

  const handleDownload = () => {
    if (!posterUrl) return
    const a = document.createElement('a')
    a.href = posterUrl
    a.download = `QuantForge_市场日报_${selectedDate}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${API_BASE}/report/poster?date=${selectedDate}`
    try {
      await navigator.clipboard.writeText(url)
      alert('链接已复制到剪贴板')
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      alert('链接已复制')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero */}
      <div className="text-center mb-6 fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">
          市场<span className="text-amber-500">日报海报</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary">一键生成公众号推文海报 · 直接保存分享</p>
      </div>

      {/* Date selector + actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(tradeDates[dateIdx + 1])} disabled={!canNext}
            className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 disabled:opacity-25 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            max={today} min={tradeDates.length ? tradeDates[tradeDates.length - 1] : ''}
            className="appearance-none bg-white border border-border-default text-text-primary text-center px-3 py-1.5 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm w-36"/>
          <button onClick={() => setSelectedDate(tradeDates[dateIdx - 1])} disabled={!canPrev}
            className="p-1.5 rounded-lg bg-white border border-border-default text-text-secondary hover:text-blue-600 disabled:opacity-25 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        {state.hasReport && (
          <div className="flex items-center gap-2">
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-xl shadow-md shadow-blue-200 hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              下载海报
            </button>
            <button onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-border-default text-text-secondary text-sm font-medium rounded-xl shadow-sm hover:border-blue-400 hover:text-blue-600 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              复制链接
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {state.loading && (
        <div className="flex justify-center">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="aspect-[9/16]" />
            <p className="text-center text-sm text-text-muted">正在生成海报...</p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!state.loading && !state.hasReport && !state.error && (
        <EmptyState icon="🖼️" text="选择日期生成市场日报海报" action="请先在「市场报告」页面确认该日期有报告" />
      )}

      {/* Error */}
      {!state.loading && state.error && (
        <EmptyState icon="📋" text={state.error} action="请先在「设置」页面生成该日期的市场报告" />
      )}

      {/* Poster preview */}
      {!state.loading && state.hasReport && posterUrl && (
        <div className="flex justify-center fade-in-up">
          <div className="w-full max-w-md">
            <div className="stock-card p-3 sm:p-4">
              <img ref={imgRef} src={posterUrl} alt={`市场日报 ${selectedDate}`}
                className="w-full rounded-lg shadow-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
            <p className="text-center text-xs text-text-muted mt-3">
              长按图片保存 · 或点击「下载海报」按钮
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

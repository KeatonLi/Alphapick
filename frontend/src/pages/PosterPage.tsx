import { useEffect, useState, useRef } from 'react'
import { apiGet, generateApi } from '../services/api'
import { useTradeDates } from '../hooks/useTradeDates'
import TradeDatePicker from '../components/TradeDatePicker'

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
    <div className="text-center py-16 fade-in">
      <div className="text-5xl mb-4" style={{ opacity: 0.6 }}>{icon}</div>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{text}</div>
      {action && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{action}</div>}
    </div>
  )
}

export default function PosterPage() {
  const tradeDates = useTradeDates()
  const [selectedDate, setSelectedDate] = useState('')
  const [posterUrl, setPosterUrl] = useState<string>('')
  const [state, setState] = useState<PosterState>({ loading: false, error: '', hasReport: false })
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (tradeDates.length > 0 && !selectedDate) setSelectedDate(tradeDates[0])
  }, [tradeDates])

  const loadPoster = async (d: string) => {
    setState({ loading: true, error: '', hasReport: false })
    setPosterUrl('')
    try {
      const blob = await generateApi.downloadPoster(d)
      const objUrl = URL.createObjectURL(blob)
      setPosterUrl(objUrl)
      setState({ loading: false, error: '', hasReport: true })
    } catch (e: any) {
      setState({ loading: false, error: e.message || '海报生成失败', hasReport: false })
    }
  }

  useEffect(() => {
    if (selectedDate) loadPoster(selectedDate)
    return () => { if (posterUrl) URL.revokeObjectURL(posterUrl) }
  }, [selectedDate])

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
    const url = `${window.location.origin}/api/report/poster?date=${selectedDate}`
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
      <div className="text-center mb-6 fade-in">
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1 tracking-tight" style={{ color: 'var(--accent)' }}>
          市场<span style={{ color: 'var(--up)' }}>日报海报</span>
        </h1>
        <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>一键生成公众号推文海报 · 直接保存分享</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <TradeDatePicker value={selectedDate} onChange={setSelectedDate} tradeDates={tradeDates} />
      </div>

      {state.hasReport && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          <button onClick={handleDownload}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 500,
              borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all .2s'
            }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            下载海报
          </button>
          <button onClick={handleCopyLink}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500,
              borderRadius: 12, border: '1px solid var(--border-default)', cursor: 'pointer', transition: 'all .2s'
            }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            复制链接
          </button>
        </div>
      )}

      {state.loading && (
        <div className="flex justify-center">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="aspect-[9/16]" />
            <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>正在生成海报...</p>
          </div>
        </div>
      )}

      {!state.loading && !state.hasReport && !state.error && (
        <EmptyState icon="🖼️" text="选择日期生成市场日报海报" action="请先在「市场报告」页面确认该日期有报告" />
      )}

      {!state.loading && state.error && (
        <EmptyState icon="📋" text={state.error} action="请先在「设置」页面生成该日期的市场报告" />
      )}

      {!state.loading && state.hasReport && posterUrl && (
        <div className="flex justify-center fade-in">
          <div className="w-full max-w-md">
            <div className="card p-3 sm:p-4">
              <img ref={imgRef} src={posterUrl} alt={`市场日报 ${selectedDate}`}
                className="w-full rounded-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain', boxShadow: 'var(--card-shadow)' }} />
            </div>
            <p className="text-center text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              长按图片保存 · 或点击「下载海报」按钮
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

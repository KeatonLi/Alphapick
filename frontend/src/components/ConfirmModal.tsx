import { useEffect, type ReactNode } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open, title, message, confirmLabel = '确认', cancelLabel = '取消',
  variant = 'warning', loading = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const btnColor = variant === 'danger'
    ? 'bg-[#ef4444] hover:bg-[#dc2626]'
    : 'bg-[#f59e0b] hover:bg-[#d97706]'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ padding: 24, width: '100%', maxWidth: 360, margin: '0 16px' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</h3>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>{message}</div>
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: 'var(--bg-tag)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', transition: 'all .2s', opacity: loading ? 0.5 : 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-badge)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tag)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none disabled:opacity-50 ${btnColor}`}
            style={{ color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            {loading ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

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
    ? 'bg-red-500 hover:bg-red-600 focus:ring-red-200'
    : 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-200'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 transition-all"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-800 mb-2">{title}</h3>
        <div className="text-sm text-text-secondary mb-5 leading-relaxed">{message}</div>
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all focus:ring-2 focus:outline-none disabled:opacity-50 ${btnColor}`}
          >
            {loading ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

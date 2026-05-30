import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError('请输入用户名'); return }
    if (!password) { setError('请输入密码'); return }
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12 fade-in">

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 16px', display: 'block' }}>
            <rect x="2" y="2" width="44" height="44" rx="14" fill="var(--accent)" />
            <line x1="12" y1="14" x2="12" y2="32" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
            <rect x="8" y="24" width="8" height="7" rx="2" fill="rgba(255,255,255,0.6)" />
            <line x1="22" y1="18" x2="22" y2="30" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
            <rect x="18" y="24" width="8" height="5" rx="2" fill="rgba(255,255,255,0.45)" />
            <line x1="33" y1="8" x2="33" y2="32" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round"/>
            <rect x="28" y="13" width="10" height="18" rx="2.5" fill="rgba(255,255,255,0.9)" />
            <rect x="29" y="14" width="3" height="16" rx="1.5" fill="rgba(255,255,255,0.25)" />
          </svg>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>登录 QuantForge</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>AI 驱动的 A 股量化分析平台</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoFocus
                style={{ width: '100%', height: '44px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'all .2s' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                style={{ width: '100%', height: '44px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'all .2s' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <div className="py-2.5 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--up-bg)', border: '1px solid var(--up)', color: 'var(--up)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', height: '44px', borderRadius: '12px', background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all .2s' }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.transform = 'scale(1.01)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />
                  登录中...
                </span>
              ) : (
                '登 录'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--border-default)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>还没有账号？</span>{' '}
            <Link to="/register" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>立即注册</Link>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-dim)' }}>
          数据仅供参考，不构成投资建议
        </p>
      </div>
    </div>
  )
}

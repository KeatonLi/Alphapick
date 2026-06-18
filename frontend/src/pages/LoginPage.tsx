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
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '48px 18px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/assets/quantforge-icon.png" alt="" style={{ width: 76, height: 76, borderRadius: 24, objectFit: 'cover', boxShadow: '0 24px 60px rgba(109,116,255,.28)', margin: '0 auto 18px', display: 'block' }} />
          <div className="qf-eyebrow">QuantForge Terminal</div>
          <h1 style={{ margin: '8px 0 6px', fontSize: 30, color: 'var(--text-primary)', letterSpacing: '-.04em' }}>登录量化工作台</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>AI 驱动的 A 股量化选股与回测系统</p>
        </div>

        <div className="card" style={{ padding: 26 }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <label style={{ display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>
              用户名
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如 LBK"
                autoFocus
                style={{ height: 46, padding: '0 15px', borderRadius: 16, border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                style={{ height: 46, padding: '0 15px', borderRadius: 16, border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </label>

            {error && (
              <div style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--up-bg)', border: '1px solid rgba(255,90,107,.35)', color: 'var(--up)', fontSize: 13, fontWeight: 700 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="qf-action-button" style={{ height: 48 }}>
              {loading ? '登录中...' : '进入工作台'}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border-default)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            还没有账号？ <Link to="/register" style={{ color: 'var(--accent-light)', fontWeight: 800 }}>立即注册</Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, color: 'var(--text-dim)', fontSize: 12 }}>
          数据仅供参考，不构成投资建议
        </p>
      </div>
    </div>
  )
}

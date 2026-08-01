import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const { register, guestLogin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError('请输入用户名'); return }
    if (username.trim().length < 2) { setError('用户名至少 2 个字符'); return }
    if (!password) { setError('请输入密码'); return }
    if (password.length < 6) { setError('密码至少 6 位'); return }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return }
    setLoading(true)
    try {
      await register(username.trim(), password)
      navigate('/recommend', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleGuestLogin() {
    setError('')
    setGuestLoading(true)
    try {
      await guestLogin()
      navigate('/recommend', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '游客登录失败')
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <main className="qv4-auth">
      <nav className="qv4-auth-corner" aria-label="账号入口">
        <Link to="/login">登录</Link>
        <Link to="/register" className="active">注册</Link>
      </nav>
      <section className="qv4-auth-copy">
        <img src="/assets/alphapick-icon.png?v=20260620" alt="" />
        <div className="qv4-kicker">AlphaPick</div>
        <h1>创建工作台账号</h1>
        <p>保存你的推荐批次、收益跟踪和策略复盘结果，让每一次推荐都能被验证。</p>
        <div className="qv4-auth-points">
          <span>交易日推荐</span>
          <span>3/5/7日收益</span>
          <span>AI复盘</span>
        </div>
      </section>

      <section className="qv4-auth-card">
        <header>
          <span>Create account</span>
          <h2>注册</h2>
        </header>
        <form onSubmit={handleSubmit} className="qv4-form">
          <label>用户名<input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="2-50 个字符" autoComplete="username" autoFocus /></label>
          <label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" autoComplete="new-password" /></label>
          <label>确认密码<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入密码" autoComplete="new-password" /></label>
          {error && <div className="qv4-error">{error}</div>}
          <button className="primary" type="submit" disabled={loading || guestLoading}>{loading ? '注册中...' : '注册并进入'}</button>
          <button type="button" disabled={loading || guestLoading} onClick={handleGuestLogin}>{guestLoading ? '进入中...' : '先以游客身份体验'}</button>
        </form>
        <footer>已有账号？<Link to="/login">立即登录</Link></footer>
      </section>
    </main>
  )
}

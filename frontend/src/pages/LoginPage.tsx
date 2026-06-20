import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login, guestLogin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError('请输入用户名'); return }
    if (!password) { setError('请输入密码'); return }
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/recommend', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
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
        <Link to="/login" className="active">登录</Link>
        <Link to="/register">注册</Link>
      </nav>
      <section className="qv4-auth-copy">
        <img src="/assets/quantforge-icon.png" alt="" />
        <div className="qv4-kicker">QuantForge</div>
        <h1>进入推荐收益闭环</h1>
        <p>打开后先看今天推荐什么，再看之前推荐赚没赚，最后判断这套策略是否可信。</p>
        <div className="qv4-auth-points">
          <span>每日推荐</span>
          <span>收益跟踪</span>
          <span>策略复盘</span>
        </div>
      </section>

      <section className="qv4-auth-card">
        <header>
          <span>Welcome back</span>
          <h2>登录</h2>
        </header>
        <form onSubmit={handleSubmit} className="qv4-form">
          <label>用户名<input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoFocus /></label>
          <label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" /></label>
          {error && <div className="qv4-error">{error}</div>}
          <button className="primary" type="submit" disabled={loading || guestLoading}>{loading ? '登录中...' : '账号登录'}</button>
          <button type="button" disabled={loading || guestLoading} onClick={handleGuestLogin}>{guestLoading ? '进入中...' : '游客直接进入'}</button>
        </form>
        <footer>没有账号？<Link to="/register">立即注册</Link></footer>
      </section>
    </main>
  )
}

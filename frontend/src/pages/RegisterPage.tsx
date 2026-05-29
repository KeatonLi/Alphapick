import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12">
      {/* 背景装饰 */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-blue-500/8 to-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm animate-[fadeInUp_0.5s_ease_forwards]">
        {/* 品牌区 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-200 mb-4">
            <span className="text-white font-bold text-xl">QF</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">注册 QuantForge</h1>
          <p className="text-sm text-text-muted mt-1">创建账号，开启量化分析之旅</p>
        </div>

        {/* 注册卡片 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-border-default shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">用户名</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg leading-none">👤</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="2-50 个字符"
                  autoFocus
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-default bg-white/60 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-all duration-200 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/10"
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">密码</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg leading-none">🔑</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-default bg-white/60 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-all duration-200 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/10"
                />
              </div>
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">确认密码</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-lg leading-none">✓</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-default bg-white/60 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-all duration-200 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/10"
                />
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="py-2.5 px-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 font-medium animate-[fadeInUp_0.2s_ease_forwards]">
                {error}
              </div>
            )}

            {/* 注册按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-200 transition-all duration-200 hover:shadow-lg hover:shadow-blue-300 hover:from-blue-700 hover:to-blue-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  注册中...
                </span>
              ) : (
                '注 册'
              )}
            </button>
          </form>

          {/* 登录入口 */}
          <div className="mt-6 pt-5 border-t border-border-default text-center">
            <span className="text-sm text-text-muted">已有账号？</span>{' '}
            <Link to="/login" className="text-sm text-accent-blue font-medium hover:text-blue-700 transition-colors">
              立即登录
            </Link>
          </div>
        </div>

        {/* 底部提示 */}
        <p className="text-center text-xs text-text-muted/60 mt-6">
          注册即表示同意遵守相关法律法规
        </p>
      </div>
    </div>
  )
}

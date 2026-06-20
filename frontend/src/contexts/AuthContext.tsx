import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiPost, apiGet } from '../services/api'

interface UserInfo {
  id: number
  username: string
  role: string
  created_at: string
}

interface AuthContextType {
  user: UserInfo | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  guestLogin: () => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function getStoredToken(): string | null {
  return localStorage.getItem('auth_token')
}

function getStoredUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(getStoredUser)
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [isLoading, setIsLoading] = useState(true)

  // 页面加载时验证 token 是否仍然有效
  useEffect(() => {
    const storedToken = getStoredToken()
    if (storedToken) {
      apiGet('/auth/me')
        .then((res) => {
          const u = res.data
          setUser(u)
          localStorage.setItem('auth_user', JSON.stringify(u))
        })
        .catch(() => {
          // token 失效，清除本地数据
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          setUser(null)
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiPost<any>('/auth/login', { username, password })
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const guestLogin = useCallback(async () => {
    const res = await apiPost<any>('/auth/guest')
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiPost<any>('/auth/register', { username, password })
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, guestLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

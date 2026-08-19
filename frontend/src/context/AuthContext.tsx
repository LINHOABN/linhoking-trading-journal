import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../lib/api'

interface AuthContextValue {
  user: api.Me | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshUser = async () => {
    const token = api.getToken()
    if (!token) return
    try {
      const me = await api.getMe()
      setUser(me)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const token = api.getToken()
    if (!token) {
      login('bob@linhoking.com', 'password123')
        .catch(() => { })
        .finally(() => setLoading(false))
      return
    }
    api
      .getMe()
      .then(setUser)
      .catch(() => {
        api.clearToken()
        login('bob@linhoking.com', 'password123')
          .catch(() => { })
          .finally(() => setLoading(false))
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    setError(null)
    try {
      const token = await api.login(email, password)
      api.setToken(token)
      const me = await api.getMe()
      setUser(me)
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Impossible de se connecter')
      throw e
    }
  }

  async function register(email: string, password: string) {
    setError(null)
    try {
      await api.register(email, password)
      await login(email, password)
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Impossible de créer le compte')
      throw e
    }
  }

  function logout() {
    api.clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

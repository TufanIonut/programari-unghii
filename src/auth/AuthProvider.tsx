import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, onSessionChange, refreshSession, setSession, type AuthResponse, type User } from '../api/client'
import { AuthContext, type AuthState, type RegisterInput } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    onSessionChange((session) => setUser(session?.user ?? null))
    // La încărcarea paginii, cookie-ul de refresh ne spune dacă clienta e deja logată.
    refreshSession().finally(() => setLoading(false))
    return () => onSessionChange(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } })
    setSession(session)
    return session.user
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const session = await api<AuthResponse>('/api/auth/register', { method: 'POST', body: input })
    setSession(session)
    return session.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api<void>('/api/auth/logout', { method: 'POST' })
    } finally {
      setSession(null)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

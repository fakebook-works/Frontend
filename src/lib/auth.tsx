import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser, LoginBody, RegisterBody, RegistrationResult } from '../api/client'
import { api, clearAuth, getAuth, persistAuth, subscribeAuth } from '../api/client'

interface AuthContextValue {
  user: AuthUser | null
  ready: boolean
  login: (body: LoginBody) => Promise<void>
  register: (body: RegisterBody) => Promise<RegistrationResult>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  refreshUser: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getAuth()?.user ?? null)
  const [ready, setReady] = useState(false)

  // Keep React state in sync with token-store changes (refresh rotation, forced logout).
  useEffect(() => {
    const unsubscribe = subscribeAuth((auth) => setUser(auth?.user ?? null))
    let cancelled = false
    const readyFallback = window.setTimeout(() => {
      if (!cancelled) setReady(true)
    }, 5000)
    api.restoreSession().catch(() => null).finally(() => {
      window.clearTimeout(readyFallback)
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
      window.clearTimeout(readyFallback)
      unsubscribe()
    }
  }, [])

  const login = useCallback(async (body: LoginBody) => {
    persistAuth(await api.login(body))
  }, [])

  const register = useCallback(async (body: RegisterBody) => {
    return api.register(body)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* best-effort server-side revoke; always clear local access */
    }
    clearAuth()
  }, [])

  const logoutAll = useCallback(async () => {
    try {
      await api.logoutAll()
    } finally {
      clearAuth()
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const current = getAuth()
    if (!current) return null
    const refreshedUser = await api.authMe()
    persistAuth({
      accessToken: current.accessToken,
      refreshTokenExpiresAt: null,
      user: refreshedUser,
    })
    return refreshedUser
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, login, register, logout, logoutAll, refreshUser }),
    [user, ready, login, register, logout, logoutAll, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

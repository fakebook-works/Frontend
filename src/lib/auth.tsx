import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LoginBody, RegisterBody } from '../api/client'
import { api, clearAuth, getAuth, persistAuth, setStoredUser, subscribeAuth } from '../api/client'
import type { UserSummary } from '../api/types'

interface AuthContextValue {
  user: UserSummary | null
  login: (body: LoginBody) => Promise<void>
  register: (body: RegisterBody) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: UserSummary) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(() => getAuth()?.user ?? null)

  // Keep React state in sync with token-store changes (refresh rotation, forced logout).
  useEffect(() => subscribeAuth((auth) => setUser(auth?.user ?? null)), [])

  const login = useCallback(async (body: LoginBody) => {
    persistAuth(await api.login(body))
  }, [])

  const register = useCallback(async (body: RegisterBody) => {
    persistAuth(await api.register(body))
  }, [])

  const logout = useCallback(async () => {
    const current = getAuth()
    if (current?.refreshToken) {
      try {
        await api.logout(current.refreshToken)
      } catch {
        /* best-effort server-side revoke */
      }
    }
    clearAuth()
  }, [])

  const updateUser = useCallback((next: UserSummary) => {
    setStoredUser(next)
    setUser(next)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, register, logout, setUser: updateUser }),
    [user, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

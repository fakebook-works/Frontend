// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, clearAuth, getAuth, persistAuth, type AuthActionResult } from '../api/client'
import { AuthProvider, useAuth } from './auth'

function AuthProbe() {
  const { user, logout } = useAuth()
  return user
    ? <button type="button" onClick={() => void logout()}>logout-now</button>
    : <span>logged-out</span>
}

describe('AuthProvider logout', () => {
  beforeEach(() => {
    clearAuth()
    persistAuth({
      accessToken: 'access-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1', email: 'owner@example.com', validDate: null, status: 1 },
    })
    vi.spyOn(api, 'restoreSession').mockResolvedValue(getAuth())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    clearAuth()
  })

  it('clears the local session immediately while server revocation is still pending', async () => {
    let resolveLogout!: (value: AuthActionResult) => void
    const pendingLogout = new Promise<AuthActionResult>((resolve) => { resolveLogout = resolve })
    const logout = vi.spyOn(api, 'logout').mockReturnValue(pendingLogout)
    render(<AuthProvider><AuthProbe /></AuthProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'logout-now' }))

    expect(logout).toHaveBeenCalledOnce()
    expect(screen.getByText('logged-out')).toBeInTheDocument()
    expect(getAuth()).toBeNull()

    await act(async () => {
      resolveLogout({ success: true, message: null })
      await pendingLogout
    })
  })
})

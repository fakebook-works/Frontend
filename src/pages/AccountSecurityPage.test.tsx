// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSecurityPage } from './AccountSecurityPage'

const sessionMocks = vi.hoisted(() => ({
  mySessions: vi.fn(),
  mySessionHistory: vi.fn(),
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: sessionMocks,
  }
})

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '1', email: 'owner@example.com', validDate: null, status: 1 },
    logout: vi.fn(),
    logoutAll: vi.fn(),
  }),
}))

const labels: Record<string, string> = {
  sessionHistory: 'Session history',
  sessionHistoryHelp: 'Recently expired or revoked sessions.',
  unknownDevice: 'Unknown device',
  unknown: 'Unknown',
  expired: 'Expired',
  sessionEnded: 'Session ended',
  sessionEndedLogout: 'Signed out',
  sessionEndedPasswordReset: 'Signed out after password reset',
  sessionEndedPasswordChanged: 'Signed out after password change',
  sessionEndedEmailChanged: 'Signed out after email change',
  sessionEndedRevokedByUser: 'Revoked by you',
}

vi.mock('../i18n', () => ({
  languageOptions: [],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => labels[key] ?? key }),
}))

vi.mock('../theme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}))

describe('AccountSecurityPage session history', () => {
  beforeEach(() => {
    sessionMocks.mySessions.mockResolvedValue([])
    sessionMocks.mySessionHistory.mockResolvedValue([
      { sessionId: '1', deviceName: 'Desktop', os: null, browser: null, ipAddress: null, expiresAt: null, createdAt: null, lastSeenAt: null, revocationReason: 'PASSWORD_RESET', revokedAt: '2026-08-11T00:14:17Z', isCurrent: false },
      { sessionId: '2', deviceName: 'Mobile', os: null, browser: null, ipAddress: null, expiresAt: null, createdAt: null, lastSeenAt: null, revocationReason: 'SESSION_REVOKED_BY_USER', revokedAt: '2026-08-11T00:14:17Z', isCurrent: false },
      { sessionId: '3', deviceName: 'Desktop', os: null, browser: null, ipAddress: null, expiresAt: null, createdAt: null, lastSeenAt: null, revocationReason: 'NEW_BACKEND_REASON', revokedAt: '2026-08-11T00:14:17Z', isCurrent: false },
    ])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders friendly labels instead of internal session reason codes', async () => {
    render(<AccountSecurityPage section="sessions" />)

    expect(await screen.findByText('Signed out after password reset')).toBeInTheDocument()
    expect(screen.getByText('Revoked by you')).toBeInTheDocument()
    expect(screen.getByText('Session ended')).toBeInTheDocument()
    expect(screen.queryByText('PASSWORD_RESET')).not.toBeInTheDocument()
    expect(screen.queryByText('SESSION_REVOKED_BY_USER')).not.toBeInTheDocument()
    expect(screen.queryByText('NEW_BACKEND_REASON')).not.toBeInTheDocument()
  })
})

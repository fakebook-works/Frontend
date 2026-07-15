// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedApp } from './AuthenticatedApp'

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    logout: vi.fn(),
  }),
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    legacyApi: {
      ...actual.legacyApi,
      me: vi.fn().mockRejectedValue(new Error('unavailable')),
      user: vi.fn().mockRejectedValue(new Error('unavailable')),
      friends: vi.fn().mockResolvedValue([]),
    },
  }
})

vi.mock('../i18n', () => ({
  languageOptions: [{ locale: 'en', label: 'English', shortLabel: 'EN' }],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

vi.mock('./GatewayHomePage', () => ({ GatewayHomePage: () => <div>home-page</div> }))
vi.mock('./SettingsPage', () => ({ SettingsPage: ({ initialSection }: { initialSection: string }) => <div>settings-{initialSection}</div> }))

describe('AuthenticatedApp service availability', () => {
  afterEach(cleanup)

  it('shows unavailable service icons but prevents navigation', () => {
    render(<AuthenticatedApp />)

    expect(screen.getByRole('button', { name: 'messages' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'notifications — featureUnavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'reels — featureUnavailable' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'home' }).every((button) => !button.hasAttribute('disabled'))).toBe(true)
  })

  it('opens account destinations from the avatar menu', () => {
    render(<AuthenticatedApp />)
    fireEvent.click(screen.getByRole('button', { name: 'test' }))
    fireEvent.click(screen.getByRole('button', { name: /premium/i }))
    expect(screen.getByText('settings-premium')).toBeInTheDocument()
  })
})

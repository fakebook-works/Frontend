// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedApp } from './AuthenticatedApp'

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    logout: vi.fn(),
  }),
}))

vi.mock('../i18n', () => ({
  languageOptions: [{ locale: 'en', label: 'English', shortLabel: 'EN' }],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

vi.mock('../theme', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }))
vi.mock('./GatewayHomePage', () => ({ GatewayHomePage: () => <div>home-page</div> }))
vi.mock('./PremiumPage', () => ({ PremiumPage: () => <div>premium-page</div> }))
vi.mock('./AccountSecurityPage', () => ({ AccountSecurityPage: () => <div>security-page</div> }))

describe('AuthenticatedApp service availability', () => {
  afterEach(cleanup)

  it('shows unavailable service icons but prevents navigation', () => {
    render(<AuthenticatedApp />)

    expect(screen.getByRole('button', { name: 'search — featureUnavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'messages — featureUnavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'notifications — featureUnavailable' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'home' }).every((button) => !button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getByRole('button', { name: 'premium' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'security' })).toBeEnabled()
  })
})

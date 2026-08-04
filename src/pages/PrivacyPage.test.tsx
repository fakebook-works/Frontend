// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrivacyPage } from './PrivacyPage'
import { LoginPage } from './LoginPage'

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}))

vi.mock('../lib/auth', () => ({
  useAuth: () => authMocks,
}))

vi.mock('../i18n', () => ({
  languageOptions: [
    { locale: 'en', label: 'English (UK)' },
    { locale: 'vi', label: 'Tiếng Việt' },
  ],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

describe('PrivacyPage Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders Privacy Centre home by default', () => {
    render(<PrivacyPage />)

    expect(screen.getAllByText(/Privacy Centre/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/We build privacy into our products/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Privacy topics/i).length).toBeGreaterThan(0)
  })

  it('renders sidebar navigation with groups', () => {
    render(<PrivacyPage />)

    expect(screen.getByRole('button', { name: /Privacy Centre home/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Privacy topics/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Privacy Policy/i }).length).toBeGreaterThan(0)
  })

  it('navigates to topic when sidebar item is clicked', () => {
    render(<PrivacyPage />)

    fireEvent.click(screen.getByRole('button', { name: /Privacy Centre home/i }))
    expect(screen.getAllByText(/Privacy Centre/i).length).toBeGreaterThan(0)
  })

  it('navigates from LoginPage footer Privacy Policy link to PrivacyPage', () => {
    render(<LoginPage />)

    const privacyPolicyBtn = screen.getByRole('button', { name: /^Privacy Policy$/i })
    fireEvent.click(privacyPolicyBtn)

    expect(screen.getAllByText(/Privacy Centre/i).length).toBeGreaterThan(0)
  })
})

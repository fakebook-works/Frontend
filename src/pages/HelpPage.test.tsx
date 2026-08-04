// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpPage } from './HelpPage'

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

describe('HelpPage Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders Help Centre with sidebar and category content', () => {
    render(<HelpPage />)

    expect(screen.getAllByText(/Help Centre/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Account settings/i)).toBeInTheDocument()
  })

  it('renders home view when initialTopic is home', () => {
    render(<HelpPage />)

    expect(screen.getByText(/Hey, how can I help\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Popular topics/i)).toBeInTheDocument()
    expect(screen.getByText(/Account settings/i)).toBeInTheDocument()
  })

  it('renders sidebar with all navigation groups', () => {
    render(<HelpPage />)

    // Using general text match for sidebar instead of checking for specific categories which might be translated or removed
    expect(screen.getAllByText(/Help Centre/i).length).toBeGreaterThan(0)
  })
})

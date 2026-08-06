// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AboutPage } from './AboutPage'

vi.mock('../i18n', () => ({
  languageOptions: [
    { locale: 'en', label: 'English (UK)' },
    { locale: 'vi', label: 'Tiếng Việt' },
  ],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

describe('AboutPage Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders About header with Group 36 branding and sections', () => {
    render(<AboutPage />)

    expect(screen.getAllByText(/aboutGroupTitle/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/aboutHeroTitle/i)).toBeInTheDocument()
    expect(screen.getByText(/^aboutNews$/i)).toBeInTheDocument()
    expect(screen.getByText(/aboutNewsTitle/i)).toBeInTheDocument()
    expect(screen.getByText(/aboutLeadershipTitle/i)).toBeInTheDocument()
  })

  it('renders docs section and footer links', () => {
    render(<AboutPage />)

    expect(screen.getByText(/aboutDocsTitle/i)).toBeInTheDocument()
    expect(screen.getByText(/aboutProducts/i)).toBeInTheDocument()
    expect(screen.getByText(/aboutResources/i)).toBeInTheDocument()
  })

  it('renders footer with Group 36 branding', () => {
    render(<AboutPage />)

    expect(screen.getAllByText(/aboutGroupTitle/i).length).toBeGreaterThan(0)
  })
})

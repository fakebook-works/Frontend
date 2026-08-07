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

    expect(screen.getAllByText(/Group 36/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/We're building the future/i)).toBeInTheDocument()
    expect(screen.getByText(/Catch up on the latest news/i)).toBeInTheDocument()
    expect(screen.getAllByText(/What we build/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Play a role in building/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders team values and product cards', () => {
    render(<AboutPage />)

    expect(screen.getAllByText(/Culture at Group 36/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Careers in tech/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Internships/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders footer with Group 36 branding', () => {
    render(<AboutPage />)

    expect(screen.getAllByText(/Group 36/i).length).toBeGreaterThan(0)
  })
})

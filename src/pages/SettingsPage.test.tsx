// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const apiMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getOwnedMedia: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('../api/social', () => ({ socialApi: apiMocks }))
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { userId: '1', email: 'owner@example.com' } }),
}))
vi.mock('../i18n', () => ({
  languageOptions: [{ locale: 'en', label: 'English' }],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))
vi.mock('../theme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }))
vi.mock('./AccountSecurityPage', () => ({ AccountSecurityPage: () => null }))
vi.mock('./PremiumPage', () => ({ PremiumPage: () => null }))

describe('Profile birth-date validation', () => {
  beforeEach(() => {
    apiMocks.getProfile.mockResolvedValue({
      id: '1', displayName: 'Owner', bio: null, location: null, gender: null,
      birthDate: null, avatarUrl: null, backgroundUrl: null, privacy: 0, isVerified: false,
    })
    apiMocks.updateProfile.mockReset()
    apiMocks.getOwnedMedia.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('blocks an implausible year before calling the profile API', async () => {
    render(<SettingsPage initialSection="profile" />)
    const birthDate = await screen.findByLabelText('birthDateLabel')
    fireEvent.change(birthDate, { target: { value: '1111-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveChanges' }))

    expect(await screen.findByText('birthDateAgeError')).toBeInTheDocument()
    await waitFor(() => expect(apiMocks.updateProfile).not.toHaveBeenCalled())
  })
})

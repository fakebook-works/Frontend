// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const apiMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))
const authApiMocks = vi.hoisted(() => ({ changeEmail: vi.fn(), clearAuth: vi.fn() }))

vi.mock('../api/social', () => ({ socialApi: apiMocks }))
vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error { code?: string },
  api: { changeEmail: authApiMocks.changeEmail },
  clearAuth: authApiMocks.clearAuth,
}))
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

describe('Account identity settings', () => {
  beforeEach(() => {
    apiMocks.getProfile.mockResolvedValue({
      id: '1', displayName: 'Owner', bio: null, location: null, gender: null,
      birthDate: null, avatarUrl: null, backgroundUrl: null, privacy: 0, isVerified: false,
    })
    apiMocks.updateProfile.mockReset()
    apiMocks.updateProfile.mockResolvedValue({
      id: '1', displayName: 'Owner', bio: null, location: null, gender: null,
      birthDate: null, avatarUrl: null, backgroundUrl: null, privacy: 1, isVerified: false,
    })
    authApiMocks.changeEmail.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows only name, email and account privacy fields', async () => {
    render(<SettingsPage initialSection="profile" />)

    expect(await screen.findByLabelText('nameLabel')).toBeInTheDocument()
    expect(screen.getByLabelText('emailAddress')).toBeInTheDocument()
    expect(screen.getByLabelText(/accountPrivacy/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'accountModeNormal' })).toHaveValue('0')
    expect(screen.getByRole('option', { name: 'accountModeAdvanced' })).toHaveValue('1')
    expect(screen.queryByLabelText('birthDateLabel')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('bioLabel')).not.toBeInTheDocument()
  })

  it('saves the name and account privacy without touching email identity', async () => {
    render(<SettingsPage initialSection="profile" />)
    fireEvent.change(await screen.findByLabelText('nameLabel'), { target: { value: 'Owner Updated' } })
    fireEvent.change(screen.getByLabelText(/accountPrivacy/), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveChanges' }))

    await waitFor(() => expect(apiMocks.updateProfile).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Owner Updated', privacy: 1 })))
    expect(authApiMocks.changeEmail).not.toHaveBeenCalled()
  })

  it('requires the current password before changing email', async () => {
    render(<SettingsPage initialSection="profile" />)
    fireEvent.change(await screen.findByLabelText('emailAddress'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveChanges' }))

    expect(await screen.findByText('emailChangePasswordRequired')).toBeInTheDocument()
    expect(apiMocks.updateProfile).not.toHaveBeenCalled()
    expect(authApiMocks.changeEmail).not.toHaveBeenCalled()
  })

  it('rejects malformed email before either profile mutation runs', async () => {
    render(<SettingsPage initialSection="profile" />)
    fireEvent.change(await screen.findByLabelText('emailAddress'), { target: { value: 'invalid-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveChanges' }))

    expect(await screen.findByText('emailInvalid')).toBeInTheDocument()
    expect(apiMocks.updateProfile).not.toHaveBeenCalled()
    expect(authApiMocks.changeEmail).not.toHaveBeenCalled()
  })

  it('normalizes the display name and exposes the agreed field limits', async () => {
    render(<SettingsPage initialSection="profile" />)
    const name = await screen.findByLabelText('nameLabel')
    const email = screen.getByLabelText('emailAddress')
    expect(name).toHaveAttribute('maxlength', '50')
    expect(email).toHaveAttribute('maxlength', '254')

    fireEvent.change(name, { target: { value: '  Owner   Updated  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveChanges' }))

    await waitFor(() => expect(apiMocks.updateProfile).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Owner Updated' })))
  })
})

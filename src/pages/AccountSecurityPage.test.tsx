// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSecurityPage } from './AccountSecurityPage'

const apiMocks = vi.hoisted(() => ({
  mySessions: vi.fn(),
  mySessionHistory: vi.fn(),
  logoutSession: vi.fn(),
  changePassword: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: apiMocks,
  ApiError: class ApiError extends Error { code?: string },
}))
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '1', email: 'owner@example.com', status: 1, validDate: null },
    logout: vi.fn(),
    logoutAll: vi.fn(),
  }),
}))
vi.mock('../i18n', () => ({
  languageOptions: [{ locale: 'en', label: 'English' }],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))
vi.mock('../theme', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }))

describe('Account security password validation', () => {
  beforeEach(() => {
    apiMocks.mySessions.mockReset().mockResolvedValue([])
    apiMocks.mySessionHistory.mockReset().mockResolvedValue([])
    apiMocks.logoutSession.mockReset().mockResolvedValue(undefined)
    apiMocks.changePassword.mockReset().mockResolvedValue({ success: true, message: null })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('enforces the shared password range before changing the password', async () => {
    render(<AccountSecurityPage embedded section="security" />)
    const current = screen.getByLabelText('currentPassword')
    const next = screen.getByLabelText('newPasswordLabel')
    const confirm = screen.getByLabelText('confirmPassword')
    expect(current).toHaveAttribute('maxlength', '128')
    expect(next).toHaveAttribute('maxlength', '128')

    fireEvent.change(current, { target: { value: 'Current123!' } })
    fireEvent.change(next, { target: { value: 'x'.repeat(129) } })
    fireEvent.change(confirm, { target: { value: 'x'.repeat(129) } })
    fireEvent.click(screen.getByRole('button', { name: 'changePassword' }))

    expect(await screen.findByText('inputTooLong')).toBeInTheDocument()
    expect(apiMocks.changePassword).not.toHaveBeenCalled()

    fireEvent.change(next, { target: { value: 'NewPassword123!' } })
    fireEvent.change(confirm, { target: { value: 'NewPassword123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'changePassword' }))

    await waitFor(() => expect(apiMocks.changePassword).toHaveBeenCalledWith('Current123!', 'NewPassword123!'))
  })
})

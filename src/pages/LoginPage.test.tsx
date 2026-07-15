// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}))

vi.mock('../lib/auth', () => ({
  useAuth: () => authMocks,
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      verifyEmail: vi.fn(),
      resendEmailVerification: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  }
})

vi.mock('../i18n', () => ({
  languageOptions: [
    { locale: 'en', label: 'English (UK)' },
    { locale: 'vi', label: 'Tiếng Việt' },
  ],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

describe('Facebook-clone authentication UX', () => {
  beforeEach(() => {
    authMocks.login.mockReset().mockResolvedValue(undefined)
    authMocks.register.mockReset().mockResolvedValue({ success: true, message: null })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('toggles login password visibility without changing the submitted password', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('emailAddress'), { target: { value: 'owner@example.com' } })
    const password = screen.getByPlaceholderText('loginPassword')
    fireEvent.change(password, { target: { value: 'Secret123!' } })

    expect(password).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'showPassword' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('Secret123!')
    fireEvent.click(screen.getByRole('button', { name: 'hidePassword' }))
    fireEvent.click(screen.getByRole('button', { name: 'loginLogIn' }))

    await waitFor(() => expect(authMocks.login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'Secret123!',
    }))
  })

  it('shows password strength and blocks signup when confirmation does not match', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'createAccount' }))

    fireEvent.change(screen.getByPlaceholderText('fullName'), { target: { value: 'Nguyen An' } })
    fireEvent.change(screen.getByPlaceholderText('emailAddress'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('newPassword'), { target: { value: 'StrongPass123!' } })
    expect(screen.getByText('passwordStrengthStrong')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('confirmPassword'), { target: { value: 'different' } })
    fireEvent.change(screen.getByLabelText('birthDateLabel'), { target: { value: '2000-01-15' } })
    fireEvent.change(screen.getByLabelText('genderLabel'), { target: { value: 'male' } })
    fireEvent.change(screen.getByPlaceholderText('locationLabel'), { target: { value: 'Ho Chi Minh City' } })
    fireEvent.click(screen.getByRole('button', { name: 'signUp' }))

    expect(await screen.findByText('passwordMismatch')).toBeInTheDocument()
    expect(authMocks.register).not.toHaveBeenCalled()
  })

  it('rejects a signup birth date outside the 14 to 120 year range', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'createAccount' }))

    fireEvent.change(screen.getByPlaceholderText('fullName'), { target: { value: 'Nguyen An' } })
    fireEvent.change(screen.getByPlaceholderText('emailAddress'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('newPassword'), { target: { value: 'StrongPass123!' } })
    fireEvent.change(screen.getByPlaceholderText('confirmPassword'), { target: { value: 'StrongPass123!' } })
    fireEvent.change(screen.getByLabelText('birthDateLabel'), { target: { value: '1111-01-01' } })
    fireEvent.change(screen.getByLabelText('genderLabel'), { target: { value: 'male' } })
    fireEvent.change(screen.getByPlaceholderText('locationLabel'), { target: { value: 'Ho Chi Minh City' } })
    fireEvent.click(screen.getByRole('button', { name: 'signUp' }))

    expect(await screen.findByText('birthDateAgeError')).toBeInTheDocument()
    expect(authMocks.register).not.toHaveBeenCalled()
  })
})

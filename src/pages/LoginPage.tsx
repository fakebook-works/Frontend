import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../lib/auth'
import { useI18n } from '../i18n'

export function LoginPage() {
  const { login, register, verifyEmail, resendEmailVerification } = useAuth()
  const { t } = useI18n()

  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login({ usernameOrEmail: usernameOrEmail.trim(), password })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? t('loginIncorrect')
          : t('loginServerError'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-pitch">
          <img src="/brand/fakebook-full-cropped.png" alt="Fakebook" className="auth-logo" />
          <p>{t('loginPitch')}</p>
        </div>

        <div className="auth-card-wrap">
          <form className="card auth-card" onSubmit={onLogin}>
            <input
              type="text"
              placeholder={t('loginEmailOrUsername')}
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
            <input
              type="password"
              placeholder={t('loginPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-primary lg" disabled={busy || !usernameOrEmail || !password}>
              {busy ? t('loginLoggingIn') : t('loginLogIn')}
            </button>
            <a className="auth-forgot" href="#" onClick={(e) => e.preventDefault()}>
              {t('forgottenPassword')}
            </a>
            <div className="auth-divider" />
            <button type="button" className="btn-create" onClick={() => setRegisterOpen(true)}>
              {t('createAccount')}
            </button>
          </form>
          <p className="auth-hint">
            {t('demoAccount', { username: 'alice', password: 'Password123!' })}
          </p>
        </div>
      </div>

      {registerOpen && (
        <RegisterModal
          onClose={() => setRegisterOpen(false)}
          onRegister={register}
          onVerifyEmail={verifyEmail}
          onResendEmailVerification={resendEmailVerification}
        />
      )}
    </div>
  )
}

function RegisterModal({
  onClose,
  onRegister,
  onVerifyEmail,
  onResendEmailVerification,
}: {
  onClose: () => void
  onRegister: (b: { username: string; email: string; password: string; displayName: string; dob: string }) => Promise<void>
  onVerifyEmail: (b: { identifier: string; otp: string }) => Promise<void>
  onResendEmailVerification: (b: { identifier: string }) => Promise<void>
}) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [verificationIdentifier, setVerificationIdentifier] = useState('')
  const [mode, setMode] = useState<'register' | 'verify' | 'verified'>('register')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t('passwordTooShort'))
      return
    }
    setBusy(true)
    try {
      await onRegister({
        displayName: displayName.trim() || username.trim(),
        username: username.trim(),
        email: email.trim(),
        dob,
        password,
      })
      setVerificationIdentifier(email.trim() || username.trim())
      setMode('verify')
      setBusy(false)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t('usernameTaken')
          : t('createAccountError'),
      )
      setBusy(false)
    }
  }

  async function submitVerification(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onVerifyEmail({ identifier: verificationIdentifier, otp: otp.trim() })
      setMode('verified')
    } catch {
      setError(t('verifyEmailError'))
    } finally {
      setBusy(false)
    }
  }

  async function resendVerification() {
    setError(null)
    setBusy(true)
    try {
      await onResendEmailVerification({ identifier: verificationIdentifier })
    } catch {
      setError(t('resendVerificationError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="modal auth-register" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head register-head">
          <div>
            <h2>{mode === 'register' ? t('signUp') : mode === 'verify' ? t('verifyEmailTitle') : t('accountVerifiedTitle')}</h2>
            <p>{mode === 'register' ? t('signupQuickEasy') : mode === 'verify' ? t('verifyEmailHelp') : t('accountVerifiedHelp')}</p>
          </div>
          <button type="button" className="icon-circle subtle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {mode === 'register' && (
          <form className="modal-body register-form" onSubmit={submit}>
            <input placeholder={t('fullName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
            <input placeholder={t('username')} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            <input type="email" placeholder={t('emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} aria-label={t('birthDateLabel')} />
            <input
              type="password"
              placeholder={t('newPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-create lg" disabled={busy || !username || !email || !dob || !password}>
              {busy ? t('creating') : t('signUp')}
            </button>
          </form>
        )}
        {mode === 'verify' && (
          <form className="modal-body register-form" onSubmit={submitVerification}>
            <input value={verificationIdentifier} onChange={(e) => setVerificationIdentifier(e.target.value)} aria-label={t('emailAddress')} />
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder={t('verificationCode')}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-create lg" disabled={busy || otp.length !== 6 || !verificationIdentifier}>
              {busy ? t('verifying') : t('verifyEmailAction')}
            </button>
            <button type="button" className="btn-text" disabled={busy || !verificationIdentifier} onClick={resendVerification}>
              {t('resendVerificationCode')}
            </button>
          </form>
        )}
        {mode === 'verified' && (
          <div className="modal-body register-form">
            <button type="button" className="btn-primary lg" onClick={onClose}>
              {t('loginLogIn')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

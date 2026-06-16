import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../lib/auth'
import { useI18n } from '../i18n'

export function LoginPage() {
  const { login, register } = useAuth()
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

      {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onRegister={register} />}
    </div>
  )
}

function RegisterModal({
  onClose,
  onRegister,
}: {
  onClose: () => void
  onRegister: (b: { username: string; email: string; password: string; displayName: string }) => Promise<void>
}) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError(t('passwordTooShort'))
      return
    }
    setBusy(true)
    try {
      await onRegister({
        displayName: displayName.trim() || username.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t('usernameTaken')
          : t('createAccountError'),
      )
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="modal auth-register" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head register-head">
          <div>
            <h2>{t('signUp')}</h2>
            <p>{t('signupQuickEasy')}</p>
          </div>
          <button type="button" className="icon-circle subtle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <form className="modal-body register-form" onSubmit={submit}>
          <input placeholder={t('fullName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
          <input placeholder={t('username')} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <input type="email" placeholder={t('emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input
            type="password"
            placeholder={t('newPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-create lg" disabled={busy || !username || !email || !password}>
            {busy ? t('creating') : t('signUp')}
          </button>
        </form>
      </div>
    </div>
  )
}

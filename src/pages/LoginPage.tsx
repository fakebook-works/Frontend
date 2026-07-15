import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import { api } from '../api/client'
import type { RegisterBody } from '../api/client'
import { useAuth } from '../lib/auth'
import { languageOptions, useI18n } from '../i18n'

export function LoginPage() {
  const { login, register } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [screen, setScreen] = useState<'login' | 'signup'>('login')
  const [challenge, setChallenge] = useState<{ mode: 'email' | 'twoFactor'; email: string } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const normalizedEmail = email.trim().toLowerCase()
    try {
      await login({ email: normalizedEmail, password })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_UNVERIFIED') {
        setChallenge({ mode: 'email', email: normalizedEmail })
        setError(t('emailNeedsVerification'))
      } else if (err instanceof ApiError && err.code === 'TWO_FACTOR_REQUIRED') {
        setChallenge({ mode: 'twoFactor', email: normalizedEmail })
      } else {
        setError(
          err instanceof ApiError && ['INVALID_CREDENTIALS', 'ACCOUNT_NOT_FOUND'].includes(err.code ?? '')
            ? t('loginIncorrect')
            : t('loginServerError'),
        )
      }
    } finally {
      setBusy(false)
    }
  }

  if (challenge) {
    return (
      <AuthChallengePage
        mode={challenge.mode}
        email={challenge.email}
        onBack={() => setChallenge(null)}
      />
    )
  }

  if (screen === 'signup') {
    return <RegisterPage onBack={() => setScreen('login')} onRegister={register} onNeedsVerification={(registeredEmail) => {
      setEmail(registeredEmail)
      setScreen('login')
      setChallenge({ mode: 'email', email: registeredEmail })
    }} />
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-pitch">
          <img src="/brand/fakebook-full-cropped.png" alt="Fakebook" className="auth-logo" />
          <h1>{t('loginWelcome')}</h1>
          <p>{t('loginPitch')}</p>
          <div className="auth-photo-mosaic" aria-hidden="true"><span /><span /><span /><span /></div>
        </div>

        <div className="auth-card-wrap">
          <div className="auth-card-heading"><h2>{t('loginLogIn')}</h2><p>{t('loginAccountPrompt')}</p></div>
          <form className="card auth-card" onSubmit={onLogin}>
            <input type="email" placeholder={t('emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            <input type="password" placeholder={t('loginPassword')} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-primary lg" disabled={busy || !email.trim() || !password}>
              {busy ? t('loginLoggingIn') : t('loginLogIn')}
            </button>
            <button type="button" className="auth-forgot" onClick={() => setResetOpen(true)}>{t('forgottenPassword')}</button>
            <div className="auth-divider" />
            <button type="button" className="btn-create" onClick={() => setScreen('signup')}>{t('createAccount')}</button>
          </form>
        </div>
      </div>
      <footer className="auth-footer"><div className="auth-languages">{languageOptions.filter((option) => option.locale === 'en' || option.locale === 'vi').map((option) => <button type="button" className={locale === option.locale ? 'active' : ''} key={option.locale} onClick={() => setLocale(option.locale)}>{option.label}</button>)}</div><p>{t('footerLinks')}</p></footer>
      {resetOpen && <PasswordResetModal initialEmail={email} onClose={() => setResetOpen(false)} />}
    </div>
  )
}

function RegisterPage({
  onBack,
  onRegister,
  onNeedsVerification,
}: {
  onBack: () => void
  onRegister: (body: RegisterBody) => Promise<{ success: boolean; message: string | null }>
  onNeedsVerification: (email: string) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t('passwordMinimum'))
      return
    }
    if (!gender) {
      setError(t('genderRequired'))
      return
    }
    setBusy(true)
    const normalizedEmail = email.trim().toLowerCase()
    try {
      const result = await onRegister({
        name: name.trim(),
        gender: gender === 'male',
        birthdate,
        location: location.trim(),
        email: normalizedEmail,
        password,
      })
      if (!result.success) throw new ApiError(400, result.message ?? t('createAccountError'))
      onNeedsVerification(normalizedEmail)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'IDENTIFIER_EXISTS'
          ? t('emailTaken')
          : t('createAccountError'),
      )
      setBusy(false)
    }
  }

  return (
    <div className="signup-page">
      <header className="signup-topbar"><button type="button" onClick={onBack} aria-label={t('backToLogin')}><img src="/brand/fakebook-full-cropped.png" alt="Fakebook" /></button><button type="button" className="btn-soft" onClick={onBack}>{t('alreadyHaveAccount')}</button></header>
      <main className="signup-main">
        <section className="signup-card" aria-labelledby="register-title">
          <header className="register-head"><span className="signup-kicker">{t('joinFakebook')}</span><h1 id="register-title">{t('createAccount')}</h1><p>{t('signupProfileNote')}</p></header>
          <form className="register-form" onSubmit={submit}>
          <input placeholder={t('fullName')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus required />
          <input type="email" placeholder={t('emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input type="password" placeholder={t('newPassword')} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <div className="register-grid">
            <label><span>{t('birthDateLabel')}</span><input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} required /></label>
            <label><span>{t('genderLabel')}</span><select value={gender} onChange={(e) => setGender(e.target.value)} required><option value="">{t('selectGender')}</option><option value="female">{t('genderFemale')}</option><option value="male">{t('genderMale')}</option></select></label>
          </div>
          <input placeholder={t('locationLabel')} value={location} onChange={(e) => setLocation(e.target.value)} autoComplete="address-level2" required />
          <p className="field-note">{t('signupPrivacyNote')}</p>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-create lg" disabled={busy || !name.trim() || !email.trim() || !password || !gender || !birthdate || !location.trim()}>{busy ? t('creating') : t('signUp')}</button>
          <button type="button" className="signup-login-link" onClick={onBack}>{t('alreadyHaveAccount')}</button>
          </form>
        </section>
      </main>
    </div>
  )
}

function AuthChallengePage({
  mode,
  email,
  onBack,
}: {
  mode: 'email' | 'twoFactor'
  email: string
  onBack: () => void
}) {
  const { t } = useI18n()
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    if (mode === 'twoFactor') {
      setMessage(t('twoFactorBackendUnavailable'))
      setBusy(false)
      return
    }
    try {
      const result = await api.verifyEmail({ email, otp: otp.trim() })
      if (!result.success) throw new ApiError(400, result.message ?? t('verificationError'))
      setComplete(true)
      setMessage(t('emailVerified'))
    } catch {
      setMessage(t('verificationError'))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    if (mode === 'twoFactor') {
      setMessage(t('twoFactorAlternativeHelp'))
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await api.resendEmailVerification(email)
      setMessage(t('verificationCodeResent'))
    } catch {
      setMessage(t('resendError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="challenge-page">
      <header className="challenge-topbar">
        <span className="challenge-wordmark">fakebook</span>
        <button type="button" onClick={onBack}>{t('backToLogin')}</button>
      </header>
      <main className="challenge-main">
        <section className="challenge-card" aria-labelledby="challenge-title">
          <header>
            <p className="challenge-kicker">{mode === 'twoFactor' ? t('securityCheck') : t('emailConfirmation')}</p>
            <h1 id="challenge-title">{mode === 'twoFactor' ? t('confirmItsYou') : t('verifyYourEmail')}</h1>
          </header>
          <div className="challenge-copy">
            <p>{mode === 'twoFactor' ? t('twoFactorIntro') : t('verificationSentTo', { email })}</p>
          </div>
          {complete ? (
            <div className="challenge-complete">
              <span aria-hidden="true">✓</span>
              <p className="form-success">{message}</p>
              <button type="button" className="btn-primary" onClick={onBack}>{t('continueToLogin')}</button>
            </div>
          ) : (
            <form className="challenge-form" onSubmit={verify}>
              <label htmlFor="challenge-code">
                <strong>{mode === 'twoFactor' ? t('enterLoginCode') : t('enterEmailCode')}</strong>
                <span>{mode === 'twoFactor' ? t('twoFactorCodeHelp') : t('emailCodeHelp')}</span>
              </label>
              <input
                id="challenge-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder={t('verificationCode')}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
              />
              {message && <p className={message === t('verificationCodeResent') ? 'form-success' : 'form-error'}>{message}</p>}
              <footer>
                <button type="button" className="challenge-link" disabled={busy} onClick={() => void resend()}>
                  {mode === 'twoFactor' ? t('needAnotherWay') : t('resendCode')}
                </button>
                <button type="submit" className="btn-primary" disabled={busy || !otp}>
                  {busy ? t('verifying') : mode === 'twoFactor' ? t('submitCode') : t('verifyEmailNow')}
                </button>
              </footer>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}

function PasswordResetModal({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const { t } = useI18n()
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function requestCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api.requestPasswordReset(email.trim().toLowerCase())
      setEmail(email.trim().toLowerCase())
      setStep('reset')
    } catch {
      setMessage(t('passwordResetRequestError'))
    } finally {
      setBusy(false)
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (newPassword.length < 8) return setMessage(t('passwordMinimum'))
    if (newPassword !== confirmPassword) return setMessage(t('passwordMismatch'))
    setBusy(true)
    try {
      const result = await api.resetPassword({ email, otp, newPassword })
      if (!result.success) throw new ApiError(400, result.message ?? t('passwordResetError'))
      setStep('done')
    } catch {
      setMessage(t('passwordResetError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="modal auth-flow-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head"><h2>{t('resetPassword')}</h2><button type="button" className="icon-circle subtle" onClick={onClose} aria-label={t('close')}>✕</button></header>
        <div className="modal-body">
          {step === 'request' && <form className="security-form" onSubmit={requestCode}><p>{t('resetPasswordIntro')}</p><label><span>{t('emailAddress')}</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>{message && <p className="form-error">{message}</p>}<button type="submit" className="btn-primary block" disabled={busy || !email.trim()}>{busy ? t('sending') : t('sendResetCode')}</button></form>}
          {step === 'reset' && <form className="security-form" onSubmit={reset}><p>{t('resetCodeSentTo', { email })}</p><label><span>{t('verificationCode')}</span><input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required /></label><label><span>{t('newPasswordLabel')}</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label><label><span>{t('confirmPassword')}</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>{message && <p className="form-error">{message}</p>}<button type="submit" className="btn-primary block" disabled={busy || !otp || !newPassword || !confirmPassword}>{busy ? t('saving') : t('resetPassword')}</button></form>}
          {step === 'done' && <><p className="form-success">{t('passwordResetComplete')}</p><button type="button" className="btn-primary block" onClick={onClose}>{t('continueToLogin')}</button></>}
        </div>
      </div>
    </div>
  )
}

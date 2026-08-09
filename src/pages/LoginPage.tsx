import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api/client'
import { api } from '../api/client'
import type { RegisterBody } from '../api/client'
import { useAuth } from '../lib/auth'
import { useI18n } from '../i18n'
import type { Locale } from '../i18n'
import { PasswordField } from '../components/PasswordField'
import { INPUT_LIMITS } from '../lib/inputLimits'
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter'
import { birthDateBounds, isAllowedBirthDate } from './birthDate'

import { HelpPage } from './HelpPage'
import { PrivacyPage } from './PrivacyPage'
import { AboutPage } from './AboutPage'
import { PoliciesPage } from './PoliciesPage'

export function LoginPage() {
  const emailChangeVerification = new URLSearchParams(window.location.search).get('verifyEmail')?.trim().toLowerCase() ?? ''
  const { login, register } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState(emailChangeVerification)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [screen, setScreen] = useState<'login' | 'signup' | 'help' | 'privacy' | 'about' | 'policies'>('login')
  const [challenge, setChallenge] = useState<{ mode: 'email' | 'twoFactor'; email: string } | null>(() =>
    emailChangeVerification ? { mode: 'email', email: emailChangeVerification } : null,
  )
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

  if (screen === 'help') {
    return (
      <HelpPage
        onBack={() => setScreen('login')}
      />
    )
  }

  if (screen === 'privacy') {
    return (
      <PrivacyPage
        onBack={() => setScreen('login')}
      />
    )
  }

  if (screen === 'about') {
    return (
      <AboutPage
        onBack={() => setScreen('login')}
      />
    )
  }

  if (screen === 'policies') {
    return (
      <PoliciesPage
        onBack={() => setScreen('login')}
      />
    )
  }

  if (screen === 'signup') {
    return (
      <RegisterPage
        onBack={() => setScreen('login')}
        onRegister={register}
        onNeedsVerification={(registeredEmail) => {
          setEmail(registeredEmail)
          setScreen('login')
          setChallenge({ mode: 'email', email: registeredEmail })
        }}
        onNavigateHelp={() => {
          setScreen('help')
        }}
        onNavigatePrivacy={() => {
          setScreen('privacy')
        }}
      />
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-pitch">
          <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" className="auth-logo" />
          <div className="auth-photo-mosaic" aria-hidden="true">
            <span className="mosaic-reaction">☺</span>
            <span className="mosaic-card mosaic-card-back" />
            <span className="mosaic-card mosaic-card-main"><i /><i /><i /></span>
            <span className="mosaic-card mosaic-card-front"><i /><i /></span>
            <span className="mosaic-heart">♥</span>
            <span className="mosaic-avatar">fk</span>
          </div>
          <h1>{t('loginExplore')} <strong>{t('loginThings')}</strong> <em>{t('loginYouLove')}</em></h1>
        </div>

        <div className="auth-card-wrap">
          <div className="auth-card-heading"><h2>{t('loginToFakebook')}</h2></div>
          <form className="auth-card" onSubmit={onLogin}>
            <input type="email" maxLength={INPUT_LIMITS.email} placeholder={t('emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            <PasswordField
              placeholder={t('loginPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-primary lg" disabled={busy}>
              {busy ? t('loginLoggingIn') : t('loginLogIn')}
            </button>
            <button type="button" className="auth-forgot" onClick={() => setResetOpen(true)}>{t('forgottenPassword')}</button>
            <div className="auth-divider" />
            <button type="button" className="btn-create" onClick={() => setScreen('signup')}>{t('createAccount')}</button>
            <div className="auth-card-meta" aria-label="Group 36">
              <svg width="22" height="14" viewBox="0 0 24 14" fill="currentColor">
                <path d="M16.91 0C14.73 0 13.06 1.09 12 2.37C10.94 1.09 9.27 0 7.09 0C3.17 0 0 3.14 0 7C0 10.86 3.17 14 7.09 14C9.27 14 10.94 12.91 12 11.63C13.06 12.91 14.73 14 16.91 14C20.83 14 24 10.86 24 7C24 3.14 20.83 0 16.91 0ZM7.09 11.55C4.54 11.55 2.45 9.5 2.45 7C2.45 4.5 4.54 2.45 7.09 2.45C9.07 2.45 10.74 3.66 11.64 5.37C11.39 5.86 11.25 6.41 11.25 7C11.25 7.59 11.39 8.14 11.64 8.63C10.74 10.34 9.07 11.55 7.09 11.55ZM16.91 11.55C14.93 11.55 13.26 10.34 12.36 8.63C12.61 8.14 12.75 7.59 12.75 7C12.75 6.41 12.61 5.86 12.36 5.37C13.26 3.66 14.93 2.45 16.91 2.45C19.46 2.45 21.55 4.5 19.46 11.55 16.91 11.55Z" />
              </svg>
              <span>Group 36</span>
            </div>
          </form>
        </div>
      </div>
      <AuthFooter
        onNavigateSignup={() => setScreen('signup')}
        onNavigateHelp={() => {
          setScreen('help')
        }}
        onNavigatePrivacy={() => {
          setScreen('privacy')
        }}
        onNavigateAbout={() => setScreen('about')}
        onNavigatePolicies={() => setScreen('policies')}
      />
      {resetOpen && <PasswordResetModal initialEmail={email} onClose={() => setResetOpen(false)} />}
    </div>
  )
}

const SUPPORTED_FOOTER_LANGUAGES: { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'English (UK)' },
  { locale: 'vi', label: 'Tiếng Việt' },
]

export function AuthFooter({
  onNavigateLogin,
  onNavigateSignup,
  onNavigateHelp,
  onNavigatePrivacy,
  onNavigateAbout,
  onNavigatePolicies,
}: {
  onNavigateLogin?: () => void
  onNavigateSignup?: () => void
  onNavigateHelp?: (topic?: string) => void
  onNavigatePrivacy?: (topic?: string) => void
  onNavigateAbout?: () => void
  onNavigatePolicies?: () => void
} = {}) {
  const { locale, setLocale } = useI18n()

  return (
    <footer className="auth-footer">
      <div className="auth-footer-inner">
        <ul className="auth-languages" aria-label="Languages">
          {SUPPORTED_FOOTER_LANGUAGES.map((option) => (
            <li key={option.locale}>
              <button
                type="button"
                className={locale === option.locale ? 'active' : ''}
                onClick={() => setLocale(option.locale)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
        <ul className="auth-footer-links-list" aria-label="Facebook Links">
          <li>
            <button type="button" onClick={onNavigateSignup}>
              Sign up
            </button>
          </li>
          <li>
            <button type="button" onClick={onNavigateLogin}>
              Log in
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onNavigatePrivacy?.('policy-intro')}>
              Privacy Policy
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onNavigatePrivacy?.('overview')}>
              Privacy Centre
            </button>
          </li>
          <li>
            <button type="button" onClick={onNavigateAbout}>
              About
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onNavigatePrivacy?.('cookies')}>
              Cookies
            </button>
          </li>
          <li>
            <button type="button" onClick={onNavigatePolicies}>
              Terms
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onNavigateHelp?.('creating-account')}>
              Help
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onNavigateHelp?.('non-users')}>
              Contact uploading and non-users
            </button>
          </li>
        </ul>
        <div className="auth-copyright">Group 36 © 2026</div>
      </div>
    </footer>
  )
}

function RegisterPage({
  onBack,
  onRegister,
  onNeedsVerification,
  onNavigateHelp,
  onNavigatePrivacy,
  onNavigateAbout,
}: {
  onBack: () => void
  onRegister: (body: RegisterBody) => Promise<{ success: boolean; message: string | null }>
  onNeedsVerification: (email: string) => void
  onNavigateHelp?: (topic?: string) => void
  onNavigatePrivacy?: (topic?: string) => void
  onNavigateAbout?: () => void
}) {
  const { t, locale } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dateBounds = birthDateBounds()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError(locale === 'vi' ? 'Vui lòng nhập họ và tên.' : 'Please enter your full name.')
      return
    }
    if (!birthdate) {
      setError(locale === 'vi' ? 'Vui lòng chọn ngày sinh.' : 'Please select your date of birth.')
      return
    }
    if (!isAllowedBirthDate(birthdate)) {
      setError(t('birthDateAgeError'))
      return
    }
    if (!gender) {
      setError(t('genderRequired'))
      return
    }
    if (!email.trim()) {
      setError(locale === 'vi' ? 'Vui lòng nhập email.' : 'Please enter your email.')
      return
    }
    if (password.length < 8) {
      setError(t('passwordMinimum'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }
    if (!location.trim()) {
      setError(locale === 'vi' ? 'Vui lòng nhập vị trí.' : 'Please enter your location.')
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
      <main className="signup-main">
        <section className="signup-card" aria-labelledby="register-title">
          <button type="button" className="signup-back" onClick={onBack} aria-label={t('backToLogin')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="signup-brand"><img src="/brand/fakebook-minimal-cropped.png" alt="" /><span>Fakebook</span></div>
          <header className="register-head"><h1 id="register-title">{t('signupTitle')}</h1><p>{t('signupProfileNote')}</p></header>
          <form className="register-form" onSubmit={submit} noValidate>
          <label className="signup-field"><span>{t('fullName')}</span><input maxLength={INPUT_LIMITS.displayName} placeholder={t('fullName')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus required /></label>
          <div className="register-grid">
            <label><span>{t('birthDateLabel')}</span><input type="date" className={birthdate ? 'has-value' : 'is-empty'} min={dateBounds.min} max={dateBounds.max} value={birthdate} onChange={(e) => setBirthdate(e.target.value)} required /></label>
            <label><span>{t('genderLabel')}</span><select className={gender ? 'has-value' : 'is-empty'} value={gender} onChange={(e) => setGender(e.target.value)} required><option value="">{t('selectGender')}</option><option value="female">{t('genderFemale')}</option><option value="male">{t('genderMale')}</option></select></label>
          </div>
          <label className="signup-field"><span>{t('emailAddress')}</span><input type="email" maxLength={INPUT_LIMITS.email} placeholder={t('emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label className="signup-field"><span>{t('newPasswordLabel')}</span><PasswordField placeholder={t('newPassword')} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" showLabel={t('showPassword')} hideLabel={t('hidePassword')} required /></label>
          <PasswordStrengthMeter password={password} labels={{ weak: t('passwordStrengthWeak'), fair: t('passwordStrengthFair'), good: t('passwordStrengthGood'), strong: t('passwordStrengthStrong') }} />
          <label className="signup-field"><span>{t('confirmPassword')}</span><PasswordField placeholder={t('confirmPassword')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" showLabel={t('showPassword')} hideLabel={t('hidePassword')} required /></label>
          <label className="signup-field"><span>{t('locationLabel')}</span><input maxLength={INPUT_LIMITS.profileLocation} placeholder={t('locationLabel')} value={location} onChange={(e) => setLocation(e.target.value)} autoComplete="address-level2" required /></label>
          <div className="signup-legal-copy">
            <p>{t('signupContactNote')}</p>
            <p>{t('signupPrivacyNote')}</p>
            <p>
              {locale === 'vi' ? (
                <>
                  Khi tiếp tục, bạn đồng ý với{' '}
                  <button type="button" tabIndex={-1} className="auth-legal-link" onClick={() => onNavigatePrivacy?.('terms')}>
                    Điều khoản
                  </button>
                  ,{' '}
                  <button type="button" tabIndex={-1} className="auth-legal-link" onClick={() => onNavigatePrivacy?.('overview')}>
                    Chính sách quyền riêng tư
                  </button>{' '}
                  và{' '}
                  <button type="button" tabIndex={-1} className="auth-legal-link" onClick={() => onNavigatePrivacy?.('cookies')}>
                    Chính sách cookie
                  </button>
                  .
                </>
              ) : (
                <>
                  By continuing, you agree to the{' '}
                  <button type="button" tabIndex={-1} className="auth-legal-link" onClick={() => onNavigatePrivacy?.('terms')}>
                    Terms
                  </button>
                  ,{' '}
                  <button type="button" tabIndex={-1} className="auth-legal-link" onClick={() => onNavigatePrivacy?.('overview')}>
                    Privacy Policy
                  </button>{' '}
                  and{' '}
                  <button type="button" tabIndex={-1} className="auth-legal-link" onClick={() => onNavigatePrivacy?.('cookies')}>
                    Cookies Policy
                  </button>
                  .
                </>
              )}
            </p>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-create lg" disabled={busy}>{busy ? t('creating') : t('signUp')}</button>
          <button type="button" className="signup-login-link" onClick={onBack}>{t('alreadyHaveAccount')}</button>
          </form>
        </section>
      </main>
      <AuthFooter onNavigateLogin={onBack} onNavigateHelp={onNavigateHelp} onNavigatePrivacy={onNavigatePrivacy} onNavigateAbout={onNavigateAbout} />
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
                maxLength={INPUT_LIMITS.verificationCode}
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
      <div className="modal auth-flow-modal password-reset-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head"><h2>{t('resetPassword')}</h2><button type="button" className="icon-circle subtle" onClick={onClose} aria-label={t('close')}>✕</button></header>
        <div className="modal-body">
          {step === 'request' && <form className="security-form" onSubmit={requestCode}><p>{t('resetPasswordIntro')}</p><label><span>{t('emailAddress')}</span><input type="email" maxLength={INPUT_LIMITS.email} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>{message && <p className="form-error">{message}</p>}<button type="submit" className="btn-primary block" disabled={busy || !email.trim()}>{busy ? t('sending') : t('sendResetCode')}</button></form>}
          {step === 'reset' && <form className="security-form" onSubmit={reset}><p>{t('resetCodeSentTo', { email })}</p><label><span>{t('verificationCode')}</span><input inputMode="numeric" maxLength={INPUT_LIMITS.verificationCode} autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required /></label><label><span>{t('newPasswordLabel')}</span><input type="password" maxLength={INPUT_LIMITS.password} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label><label><span>{t('confirmPassword')}</span><input type="password" maxLength={INPUT_LIMITS.password} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>{message && <p className="form-error">{message}</p>}<button type="submit" className="btn-primary block" disabled={busy || !otp || !newPassword || !confirmPassword}>{busy ? t('saving') : t('resetPassword')}</button></form>}
          {step === 'done' && <><p className="form-success">{t('passwordResetComplete')}</p><button type="button" className="btn-primary block" onClick={onClose}>{t('continueToLogin')}</button></>}
        </div>
      </div>
    </div>
  )
}

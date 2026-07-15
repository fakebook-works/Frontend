import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { AuthSession } from '../api/client'
import { useAuth } from '../lib/auth'
import { languageOptions, useI18n } from '../i18n'
import { useTheme } from '../theme'

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString()
}

export function AccountSecurityPage() {
  const { user, logout, logoutAll } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const [sessions, setSessions] = useState<AuthSession[]>([])
  const [history, setHistory] = useState<AuthSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [active, previous] = await Promise.all([api.mySessions(), api.mySessionHistory()])
      setSessions(active)
      setHistory(previous)
    } catch {
      setError(t('sessionsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  async function revokeSession(session: AuthSession) {
    setError(null)
    try {
      await api.logoutSession(session.sessionId)
      if (session.isCurrent) {
        await logout()
        return
      }
      await loadSessions()
    } catch {
      setError(t('sessionRevokeError'))
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordMessage(null)
    if (newPassword.length < 8) {
      setPasswordMessage(t('passwordMinimum'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t('passwordMismatch'))
      return
    }
    setPasswordBusy(true)
    try {
      const result = await api.changePassword(currentPassword, newPassword)
      if (!result.success) throw new ApiError(400, result.message ?? t('passwordChangeError'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage(t('passwordChanged'))
      await loadSessions()
    } catch (err) {
      setPasswordMessage(
        err instanceof ApiError && err.code === 'INVALID_CREDENTIALS'
          ? t('currentPasswordIncorrect')
          : t('passwordChangeError'),
      )
    } finally {
      setPasswordBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="security-page">
      <header className="security-topbar">
        <img src="/brand/fakebook-full-cropped.png" alt="Fakebook" />
        <div className="security-controls">
          <label className="lang-select" aria-label={t('languageLabel')}>
            <span>{t('languageLabel')}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
              {languageOptions.map((option) => (
                <option key={option.locale} value={option.locale}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-soft" onClick={toggleTheme}>
            {theme === 'dark' ? t('themeLight') : t('themeDark')}
          </button>
          <button type="button" className="btn-soft" onClick={() => void logout()}>{t('logout')}</button>
        </div>
      </header>

      <main className="security-layout">
        <section className="security-hero card">
          <div>
            <p className="eyebrow">{t('accountSecurity')}</p>
            <h1>{t('welcomeEmail', { email: user.email })}</h1>
            <p>{t('authReadyMessage')}</p>
          </div>
          <dl className="identity-grid">
            <div><dt>{t('emailAddress')}</dt><dd>{user.email}</dd></div>
            <div><dt>{t('accountStatus')}</dt><dd>{user.status === 1 ? t('accountActive') : t('accountPending')}</dd></div>
            <div><dt>{t('userId')}</dt><dd>{user.userId}</dd></div>
            <div><dt>{t('premiumUntil')}</dt><dd>{formatDate(user.validDate, t('notActive'))}</dd></div>
          </dl>
        </section>

        <div className="security-columns">
          <section className="card security-panel">
            <div className="panel-heading">
              <div><h2>{t('activeSessions')}</h2><p>{t('activeSessionsHelp')}</p></div>
              <button type="button" className="btn-soft sm" onClick={() => void loadSessions()} disabled={loading}>{t('refresh')}</button>
            </div>
            {error && <p className="form-error">{error}</p>}
            {loading ? <span className="spinner" /> : sessions.length === 0 ? (
              <p className="muted">{t('noSessions')}</p>
            ) : (
              <div className="session-list">
                {sessions.map((session) => (
                  <article className="session-row" key={session.sessionId}>
                    <div>
                      <strong>{session.deviceName || session.browser || t('unknownDevice')}</strong>
                      <span>{[session.browser, session.os, session.ipAddress].filter(Boolean).join(' · ')}</span>
                      <small>{t('lastSeen')}: {formatDate(session.lastSeenAt ?? session.createdAt, t('unknown'))}</small>
                    </div>
                    <button type="button" className={session.isCurrent ? 'btn-soft sm' : 'btn-danger sm'} onClick={() => void revokeSession(session)}>
                      {session.isCurrent ? t('logoutThisDevice') : t('revoke')}
                    </button>
                  </article>
                ))}
              </div>
            )}
            <button type="button" className="btn-danger block" onClick={() => void logoutAll()}>{t('logoutAllDevices')}</button>
          </section>

          <section className="card security-panel">
            <div className="panel-heading"><div><h2>{t('changePassword')}</h2><p>{t('changePasswordHelp')}</p></div></div>
            <form className="security-form" onSubmit={changePassword}>
              <label><span>{t('currentPassword')}</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label>
              <label><span>{t('newPasswordLabel')}</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
              <label><span>{t('confirmPassword')}</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>
              {passwordMessage && <p className={passwordMessage === t('passwordChanged') ? 'form-success' : 'form-error'}>{passwordMessage}</p>}
              <button type="submit" className="btn-primary block" disabled={passwordBusy}>{passwordBusy ? t('saving') : t('changePassword')}</button>
            </form>
          </section>
        </div>

        <section className="card security-panel">
          <div className="panel-heading"><div><h2>{t('sessionHistory')}</h2><p>{t('sessionHistoryHelp')}</p></div></div>
          {history.length === 0 ? <p className="muted">{t('noSessionHistory')}</p> : (
            <div className="history-grid">
              {history.slice(0, 12).map((session) => (
                <article key={session.sessionId}>
                  <strong>{session.deviceName || session.browser || t('unknownDevice')}</strong>
                  <span>{session.revocationReason || t('expired')}</span>
                  <small>{formatDate(session.revokedAt ?? session.expiresAt, t('unknown'))}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

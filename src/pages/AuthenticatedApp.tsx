import { useState } from 'react'
import { languageOptions, useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { useTheme } from '../theme'
import { AccountSecurityPage } from './AccountSecurityPage'
import { GatewayHomePage } from './GatewayHomePage'
import { PremiumPage } from './PremiumPage'

type AppView = 'home' | 'premium' | 'security'

export function AuthenticatedApp() {
  const { user, logout } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<AppView>('home')

  if (!user) return null

  return (
    <div className="authenticated-app">
      <header className="app-shell-topbar">
        <button type="button" className="app-brand" onClick={() => setView('home')} aria-label={t('home')}>
          <img src="/brand/fakebook-full-cropped.png" alt="Fakebook" />
        </button>
        <nav className="app-shell-nav" aria-label={t('appNavigation')}>
          <button type="button" className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>{t('home')}</button>
          <button type="button" className={view === 'premium' ? 'active' : ''} onClick={() => setView('premium')}>{t('premium')}</button>
          <button type="button" className={view === 'security' ? 'active' : ''} onClick={() => setView('security')}>{t('security')}</button>
        </nav>
        <div className="app-shell-actions">
          <span className="signed-in-email" title={t('loggedInAs', { email: user.email })}>{user.email}</span>
          <label className="shell-language" aria-label={t('languageLabel')}>
            <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
              {languageOptions.map((option) => <option key={option.locale} value={option.locale}>{option.shortLabel}</option>)}
            </select>
          </label>
          <button type="button" className="icon-circle" onClick={toggleTheme} aria-label={theme === 'dark' ? t('themeLight') : t('themeDark')}>{theme === 'dark' ? '☀' : '◐'}</button>
          <button type="button" className="btn-soft shell-logout" onClick={() => void logout()}>{t('logout')}</button>
        </div>
      </header>

      {view === 'home' && <GatewayHomePage />}
      {view === 'premium' && <PremiumPage />}
      {view === 'security' && <AccountSecurityPage embedded />}
    </div>
  )
}

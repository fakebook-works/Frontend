import { useState } from 'react'
import { Icon } from '../components/Icon'
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
          <NavButton icon="home" label={t('home')} active={view === 'home'} onClick={() => setView('home')} />
          <NavButton icon="search" label={t('search')} enabled={false} unavailable={t('featureUnavailable')} />
          <NavButton icon="messenger" label={t('messages')} enabled={false} unavailable={t('featureUnavailable')} />
          <NavButton icon="bell" label={t('notifications')} enabled={false} unavailable={t('featureUnavailable')} />
          <NavButton icon="video" label={t('reels')} enabled={false} unavailable={t('featureUnavailable')} />
          <NavButton icon="gift" label={t('premium')} active={view === 'premium'} onClick={() => setView('premium')} />
          <NavButton icon="settings" label={t('security')} active={view === 'security'} onClick={() => setView('security')} />
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

function NavButton({ icon, label, active = false, enabled = true, unavailable, onClick }: {
  icon: 'home' | 'search' | 'messenger' | 'bell' | 'video' | 'gift' | 'settings'
  label: string
  active?: boolean
  enabled?: boolean
  unavailable?: string
  onClick?: () => void
}) {
  const description = enabled ? label : `${label} — ${unavailable}`
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick} disabled={!enabled} aria-label={description} title={description}>
      <Icon name={icon} size={21} />
      <span>{label}</span>
    </button>
  )
}

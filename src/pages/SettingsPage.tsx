import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, api, clearAuth } from '../api/client'
import { socialApi, type SocialProfile } from '../api/social'
import { Icon } from '../components/Icon'
import { languageOptions, useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { INPUT_LIMITS, inputValidationMessage, validateEmailInput, validateTextInput } from '../lib/inputValidation'
import { readDefaultPostPrivacy, writeDefaultPostPrivacy } from '../lib/privacy'
import { useTheme } from '../theme'
import { AccountSecurityPage } from './AccountSecurityPage'
import { PremiumPage } from './PremiumPage'

export type SettingsSection = 'overview' | 'profile' | 'security' | 'privacy' | 'sessions' | 'language' | 'appearance' | 'premium'

const SEARCH_QUERY_MAX_LENGTH = 200
const PASSWORD_MAX_LENGTH = 128

function isAccountPrivacy(value: number): value is 0 | 1 {
  return value === 0 || value === 1
}

function isPostPrivacy(value: number): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3
}

function existingPasswordValidationMessage(password: string, t: (key: string, values?: Record<string, string | number>) => string) {
  if (password.length === 0) return t('inputRequired')
  if (password.length > PASSWORD_MAX_LENGTH) return t('inputTooLong', { max: PASSWORD_MAX_LENGTH })
  return null
}

const sectionMeta: Array<{ id: SettingsSection; icon: 'settings' | 'lock' | 'globe' | 'clock' | 'gift' | 'friends'; title: string; description: string }> = [
  { id: 'profile', icon: 'settings', title: 'settingsProfile', description: 'settingsProfileDesc' },
  { id: 'security', icon: 'lock', title: 'settingsSecurity', description: 'settingsSecurityDesc' },
  { id: 'privacy', icon: 'friends', title: 'settingsPrivacyControl', description: 'settingsPrivacyDesc' },
  { id: 'sessions', icon: 'clock', title: 'settingsSessions', description: 'settingsSessionsDesc' },
  { id: 'language', icon: 'globe', title: 'languageLabel', description: 'settingsLanguageDesc' },
  { id: 'appearance', icon: 'settings', title: 'settingsAppearance', description: 'settingsAppearanceDesc' },
  { id: 'premium', icon: 'gift', title: 'premium', description: 'settingsPremiumDesc' },
]

export function SettingsPage({ initialSection = 'overview' }: { initialSection?: SettingsSection }) {
  const { t } = useI18n()
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const [query, setQuery] = useState('')

  useEffect(() => setSection(initialSection), [initialSection])

  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return sectionMeta
    return sectionMeta.filter((item) => `${t(item.title)} ${t(item.description)}`.toLocaleLowerCase().includes(normalized))
  }, [query, t])

  return (
    <main className="settings-page">
      <aside className="settings-sidebar">
        <h1>{t('settingsPrivacy')}</h1>
        <label className="settings-search">
          <Icon name="search" size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={SEARCH_QUERY_MAX_LENGTH} placeholder={t('searchSettings')} />
        </label>
        <nav aria-label={t('settingsPrivacy')}>
          {visibleSections.map((item) => (
            <button key={item.id} type="button" className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>
              <span className="settings-nav-icon"><Icon name={item.icon} size={20} /></span>
              <span><strong>{t(item.title)}</strong><small>{t(item.description)}</small></span>
              <span className="settings-chevron">›</span>
            </button>
          ))}
          {visibleSections.length === 0 && <p className="settings-empty">{t('noSettingsFound')}</p>}
        </nav>
      </aside>

      <section className="settings-content">
        {section === 'overview' && <SettingsOverview query={query} onQueryChange={setQuery} onOpen={setSection} />}
        {section === 'profile' && <ProfileSettings />}
        {section === 'security' && <AccountSecurityPage embedded section="security" />}
        {section === 'sessions' && <AccountSecurityPage embedded section="sessions" />}
        {section === 'privacy' && <PrivacySettings />}
        {section === 'language' && <LanguageSettings />}
        {section === 'appearance' && <AppearanceSettings />}
        {section === 'premium' && <PremiumPage />}
      </section>
    </main>
  )
}

function SettingsOverview({ query, onQueryChange, onOpen }: { query: string; onQueryChange: (value: string) => void; onOpen: (section: SettingsSection) => void }) {
  const { t } = useI18n()
  const shortcuts: Array<{ id: SettingsSection; icon: 'friends' | 'clock' | 'settings'; title: string; description: string }> = [
    { id: 'privacy', icon: 'friends', title: 'privacyCheckup', description: 'settingsPrivacyDesc' },
    { id: 'sessions', icon: 'clock', title: 'activityLog', description: 'settingsSessionsDesc' },
    { id: 'appearance', icon: 'settings', title: 'themeDark', description: 'settingsAppearanceDesc' },
  ]
  return <div className="settings-overview">
    <section className="settings-overview-search">
      <h2>{t('findSettingsYouNeed')}</h2>
      <label className="settings-main-search"><Icon name="search" size={22} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} maxLength={SEARCH_QUERY_MAX_LENGTH} placeholder={t('searchSettings')} /></label>
    </section>
    <section className="settings-overview-panel">
      <h2>{t('frequentSettings')}</h2>
      <div className="settings-shortcuts">
        {shortcuts.map((item) => <button type="button" key={item.id} onClick={() => onOpen(item.id)}><span className="settings-shortcut-icon"><Icon name={item.icon} size={36} /></span><span><strong>{t(item.title)}</strong><small>{t(item.description)}</small></span></button>)}
      </div>
      <h2 className="settings-more-heading">{t('lookingForSomethingElse')}</h2>
      <button type="button" className="settings-resource-row" onClick={() => onOpen('privacy')}><span className="settings-shortcut-icon"><Icon name="lock" size={30} /></span><span><strong>{t('privacyCenter')}</strong><small>{t('settingsPrivacyDesc')}</small></span><b>›</b></button>
      <button type="button" className="settings-resource-row" onClick={() => onOpen('profile')}><span className="settings-shortcut-icon"><Icon name="settings" size={30} /></span><span><strong>{t('settingsProfile')}</strong><small>{t('settingsProfileDesc')}</small></span><b>›</b></button>
    </section>
  </div>
}

function SettingsHeading({ title, description }: { title: string; description: string }) {
  return <header className="settings-content-heading"><h2>{title}</h2><p>{description}</p></header>
}

function ProfileSettings() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [profile, setProfile] = useState<SocialProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [privacy, setPrivacy] = useState<0 | 1>(0)
  const [currentPassword, setCurrentPassword] = useState('')

  useEffect(() => {
    let active = true
    if (!user) return
    socialApi.getProfile(user.userId, user.email).then((value) => {
      if (!value) throw new Error('Profile not found')
      if (!active) return
      setProfile(value)
      setDisplayName(value.displayName)
      setEmail(user.email)
      setPrivacy(value.privacy === 1 ? 1 : 0)
    }).catch(() => setMessage(t('profileLoadError'))).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [t, user])

  async function save(event: FormEvent) {
    event.preventDefault()
    let normalizedName: string
    let normalizedEmail: string
    try {
      normalizedName = validateTextInput(displayName, {
        field: 'displayName',
        max: INPUT_LIMITS.displayName,
        required: true,
        multiline: false,
      }).value
      normalizedEmail = validateEmailInput(email)
    } catch (validationError) {
      setMessage(inputValidationMessage(validationError, t))
      return
    }
    if (!isAccountPrivacy(privacy)) return setMessage(t('invalidInput'))
    const emailChanged = normalizedEmail !== user?.email.trim().toLowerCase()
    if (emailChanged) {
      if (!currentPassword) return setMessage(t('emailChangePasswordRequired'))
      const passwordError = existingPasswordValidationMessage(currentPassword, t)
      if (passwordError) return setMessage(passwordError)
    }
    setSaving(true)
    setMessage(null)
    try {
      if (!user) return
      const updated = await socialApi.updateProfile(user.userId, {
        name: normalizedName,
        bio: profile?.bio ?? null,
        location: profile?.location ?? null,
        gender: profile?.gender === 'male' ? true : profile?.gender === 'female' ? false : null,
        birthdate: profile?.birthDate?.slice(0, 10) ?? null,
        privacy,
      })
      if (!updated) throw new Error('Profile not found')
      setProfile(updated)
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      if (emailChanged) {
        await api.changeEmail(currentPassword, normalizedEmail)
        clearAuth()
        window.location.assign(`/?verifyEmail=${encodeURIComponent(normalizedEmail)}`)
        return
      }
      setMessage(t('profileSaved'))
    } catch (error) {
      setMessage(error instanceof ApiError && error.code === 'IDENTIFIER_EXISTS'
        ? t('emailTaken')
        : error instanceof ApiError && error.code === 'INVALID_CREDENTIALS'
          ? t('currentPasswordIncorrect')
          : t('saveProfileError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section profile-settings">
      <SettingsHeading title={t('settingsProfile')} description={t('settingsProfileDesc')} />
      {loading ? <div className="settings-loading"><span className="spinner" /></div> : (
        <form className="settings-card profile-settings-form account-identity-settings" onSubmit={save} noValidate>
          <div className="account-identity-intro"><span><Icon name="settings" size={22} /></span><div><strong>{t('accountInformation')}</strong><small>{t('accountInformationHelp')}</small></div></div>
          <div className="settings-form-grid account-identity-grid">
            <label><span>{t('nameLabel')}</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" maxLength={INPUT_LIMITS.displayName} /></label>
            <label><span>{t('emailAddress')}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={INPUT_LIMITS.email} /></label>
            <label><span>{t('accountPrivacy')}</span><select value={privacy} onChange={(e) => { const value = e.target.value; if (value === '0' || value === '1') setPrivacy(Number(value) as 0 | 1) }}><option value={0}>{t('accountModeNormal')}</option><option value={1}>{t('accountModeAdvanced')}</option></select><small>{t('accountPrivacyHelp')}</small></label>
            {email.trim().toLowerCase() !== user?.email.trim().toLowerCase() && <label><span>{t('currentPassword')}</span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} /><small>{t('emailChangeVerificationHelp')}</small></label>}
          </div>
          {message && <p className={message === t('profileSaved') ? 'form-success' : 'form-error'}>{message}</p>}
          <div className="settings-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? t('saving') : t('saveChanges')}</button></div>
        </form>
      )}
    </div>
  )
}

function PrivacySettings() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [postPrivacy, setPostPrivacy] = useState(() => {
    const value = user ? readDefaultPostPrivacy(user.userId) : 0
    return String(isPostPrivacy(value) ? value : 0)
  })
  function update(value: string) {
    if (value !== '0' && value !== '1' && value !== '2' && value !== '3') return
    const parsed = Number(value)
    setPostPrivacy(String(parsed))
    if (user) writeDefaultPostPrivacy(user.userId, parsed)
  }
  return <div className="settings-section"><SettingsHeading title={t('settingsPrivacyControl')} description={t('settingsPrivacyDesc')} /><div className="settings-card setting-choice"><div><strong>{t('defaultPostAudience')}</strong><span>{t('defaultPostAudienceDesc')}</span></div><select value={postPrivacy} onChange={(e) => update(e.target.value)}><option value="0">{t('privacyPublic')}</option><option value="1">{t('privacyFriendsFollowers')}</option><option value="2">{t('privacyFriends')}</option><option value="3">{t('privacyOnlyMe')}</option></select></div></div>
}

function LanguageSettings() {
  const { t, locale, setLocale } = useI18n()
  return <div className="settings-section"><SettingsHeading title={t('languageLabel')} description={t('settingsLanguageDesc')} /><div className="settings-card setting-choice"><div><strong>{t('fakebookLanguage')}</strong><span>{t('fakebookLanguageDesc')}</span></div><select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>{languageOptions.filter((option) => option.locale === 'en' || option.locale === 'vi').map((option) => <option key={option.locale} value={option.locale}>{option.label}</option>)}</select></div></div>
}

function AppearanceSettings() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  return <div className="settings-section"><SettingsHeading title={t('settingsAppearance')} description={t('settingsAppearanceDesc')} /><div className="theme-options" role="radiogroup" aria-label={t('themeLabel')}><button type="button" role="radio" aria-checked={theme === 'light'} className={theme === 'light' ? 'settings-card active' : 'settings-card'} onClick={() => setTheme('light')}><span className="theme-preview light"><i /><i /><i /></span><span><strong>{t('themeLight')}</strong><small>{t('themeLightDesc')}</small></span></button><button type="button" role="radio" aria-checked={theme === 'dark'} className={theme === 'dark' ? 'settings-card active' : 'settings-card'} onClick={() => setTheme('dark')}><span className="theme-preview dark"><i /><i /><i /></span><span><strong>{t('themeDark')}</strong><small>{t('themeDarkDesc')}</small></span></button></div></div>
}

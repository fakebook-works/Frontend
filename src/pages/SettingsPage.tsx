import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { legacyApi } from '../api/client'
import type { UserProfile } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { languageOptions, useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { useTheme } from '../theme'
import { AccountSecurityPage } from './AccountSecurityPage'
import { PremiumPage } from './PremiumPage'

export type SettingsSection = 'profile' | 'security' | 'privacy' | 'sessions' | 'language' | 'appearance' | 'premium'

const sectionMeta: Array<{ id: SettingsSection; icon: 'settings' | 'lock' | 'globe' | 'clock' | 'gift' | 'friends'; title: string; description: string }> = [
  { id: 'profile', icon: 'settings', title: 'settingsProfile', description: 'settingsProfileDesc' },
  { id: 'security', icon: 'lock', title: 'settingsSecurity', description: 'settingsSecurityDesc' },
  { id: 'privacy', icon: 'friends', title: 'settingsPrivacyControl', description: 'settingsPrivacyDesc' },
  { id: 'sessions', icon: 'clock', title: 'settingsSessions', description: 'settingsSessionsDesc' },
  { id: 'language', icon: 'globe', title: 'languageLabel', description: 'settingsLanguageDesc' },
  { id: 'appearance', icon: 'settings', title: 'settingsAppearance', description: 'settingsAppearanceDesc' },
  { id: 'premium', icon: 'gift', title: 'premium', description: 'settingsPremiumDesc' },
]

export function SettingsPage({ initialSection = 'profile' }: { initialSection?: SettingsSection }) {
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchSettings')} />
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
        <div className="settings-overview-tools">
          <label className="settings-main-search"><Icon name="search" size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchSettings')} /></label>
          <div className="settings-shortcuts" aria-label={t('frequentSettings')}>
            {sectionMeta.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => setSection(item.id)}><span className="settings-nav-icon"><Icon name={item.icon} size={19} /></span><strong>{t(item.title)}</strong></button>)}
          </div>
        </div>
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

function SettingsHeading({ title, description }: { title: string; description: string }) {
  return <header className="settings-content-heading"><h2>{title}</h2><p>{description}</p></header>
}

function ProfileSettings() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [gender, setGender] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    let active = true
    legacyApi.me().then((value) => {
      if (!active) return
      setProfile(value)
      setDisplayName(value.displayName)
      setBio(value.bio ?? '')
      setLocation(value.location ?? '')
      setGender(value.gender ?? '')
      setBirthDate(value.birthDate?.slice(0, 10) ?? '')
      setAvatarUrl(value.avatarUrl ?? '')
    }).catch(() => setMessage(t('profileLoadError'))).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [t])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!displayName.trim()) return setMessage(t('nameRequired'))
    setSaving(true)
    setMessage(null)
    try {
      let updated = await legacyApi.updateProfile({ displayName: displayName.trim(), bio: bio.trim(), location: location.trim(), gender, birthDate: birthDate || null })
      if ((avatarUrl.trim() || null) !== (profile?.avatarUrl ?? null)) {
        try {
          updated = await legacyApi.updateAvatar(avatarUrl.trim())
        } catch {
          setProfile(updated)
          setMessage(t('profileSavedAvatarError'))
          return
        }
      }
      setProfile(updated)
      setMessage(t('profileSaved'))
    } catch {
      setMessage(t('saveProfileError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section profile-settings">
      <SettingsHeading title={t('settingsProfile')} description={t('settingsProfileDesc')} />
      {loading ? <div className="settings-loading"><span className="spinner" /></div> : (
        <form className="settings-card profile-settings-form" onSubmit={save}>
          <div className="settings-profile-summary">
            <Avatar name={displayName || user?.email || 'Fakebook'} src={avatarUrl || null} size={76} />
            <div><strong>{displayName || user?.email}<VerifiedBadge verified={profile?.isVerified} /></strong><span>{user?.email}</span></div>
          </div>
          <div className="settings-form-grid">
            <label><span>{t('nameLabel')}</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
            <label><span>{t('avatarUrlLabel')}</span><input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" /></label>
            <label className="wide"><span>{t('bioLabel')}</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} /></label>
            <label><span>{t('locationLabel')}</span><input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
            <label><span>{t('birthDateLabel')}</span><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label>
            <label><span>{t('genderLabel')}</span><select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">{t('genderPreferNot')}</option><option value="female">{t('genderFemale')}</option><option value="male">{t('genderMale')}</option><option value="custom">{t('genderCustom')}</option></select></label>
          </div>
          {message && <p className={message === t('profileSaved') ? 'form-success' : 'form-error'}>{message}</p>}
          <div className="settings-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? t('saving') : t('saveChanges')}</button></div>
        </form>
      )}
    </div>
  )
}

function PrivacySettings() {
  const { t } = useI18n()
  const [postPrivacy, setPostPrivacy] = useState(() => {
    const saved = localStorage.getItem('fb.defaultPostPrivacy')
    return saved === '1' || saved === '2' ? saved : '0'
  })
  function update(value: string) {
    setPostPrivacy(value)
    localStorage.setItem('fb.defaultPostPrivacy', value)
  }
  return <div className="settings-section"><SettingsHeading title={t('settingsPrivacyControl')} description={t('settingsPrivacyDesc')} /><div className="settings-card setting-choice"><div><strong>{t('defaultPostAudience')}</strong><span>{t('defaultPostAudienceDesc')}</span></div><select value={postPrivacy} onChange={(e) => update(e.target.value)}><option value="0">{t('privacyPublic')}</option><option value="1">{t('privacyFriends')}</option><option value="2">{t('privacyOnlyMe')}</option></select></div></div>
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

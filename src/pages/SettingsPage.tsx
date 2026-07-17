import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { MediaUpload } from '../api/types'
import { socialApi, type SocialPhoto, type SocialProfile } from '../api/social'
import { Avatar } from '../components/Avatar'
import { ImageCropModal } from '../components/ImageCropModal'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { languageOptions, useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { readDefaultPostPrivacy, writeDefaultPostPrivacy } from '../lib/privacy'
import { useTheme } from '../theme'
import { AccountSecurityPage } from './AccountSecurityPage'
import { PremiumPage } from './PremiumPage'
import { birthDateBounds, isAllowedBirthDate } from './birthDate'

export type SettingsSection = 'overview' | 'profile' | 'security' | 'privacy' | 'sessions' | 'language' | 'appearance' | 'premium'

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
      <label className="settings-main-search"><Icon name="search" size={22} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t('searchSettings')} /></label>
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
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [gender, setGender] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [cropTarget, setCropTarget] = useState<{ file: File; kind: 'avatar' | 'background'; fromExisting: boolean } | null>(null)
  const [removingImage, setRemovingImage] = useState<'avatar' | 'background' | null>(null)
  const [existingImages, setExistingImages] = useState<SocialPhoto[]>([])
  const [existingPicker, setExistingPicker] = useState<'avatar' | 'background' | null>(null)
  const [imagePostPrivacy, setImagePostPrivacy] = useState(() => user ? readDefaultPostPrivacy(user.userId) : 0)
  const dateBounds = useMemo(() => birthDateBounds(), [])

  useEffect(() => {
    let active = true
    if (!user) return
    socialApi.getProfile(user.userId, user.email).then((value) => {
      if (!value) throw new Error('Profile not found')
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
  }, [t, user])

  useEffect(() => {
    let active = true
    if (!user) return
    socialApi.getMyFeedPhotoCandidates(40).then((page) => active && setExistingImages(page.items)).catch(() => active && setExistingImages([]))
    return () => { active = false }
  }, [user])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!displayName.trim()) return setMessage(t('nameRequired'))
    if (birthDate && !isAllowedBirthDate(birthDate)) return setMessage(t('birthDateAgeError'))
    setSaving(true)
    setMessage(null)
    try {
      if (!user) return
      const updated = await socialApi.updateProfile(user.userId, {
        name: displayName.trim(),
        avatar: avatarUrl.trim() || null,
        background: profile?.backgroundUrl ?? null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        gender: gender === 'male' ? true : gender === 'female' ? false : null,
        birthdate: birthDate || null,
        privacy: profile?.privacy ?? null,
      })
      if (!updated) throw new Error('Profile not found')
      setProfile(updated)
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      setMessage(t('profileSaved'))
    } catch {
      setMessage(t('saveProfileError'))
    } finally {
      setSaving(false)
    }
  }

  async function saveCroppedImage(original: File, cropped: File) {
    if (!user || !cropTarget) return
    setMessage(null)
    let uploads: MediaUpload[] = []
    let persisted = false
    try {
      uploads = await api.uploadMediaFiles(cropTarget.fromExisting ? [cropped] : [original, cropped])
      const originalUpload = cropTarget.fromExisting ? null : uploads[0]
      const croppedUpload = uploads[uploads.length - 1]
      const updated = cropTarget.kind === 'avatar'
        ? await socialApi.changeUserAvatar(user.userId, croppedUpload.url, originalUpload?.url ?? null, imagePostPrivacy)
        : await socialApi.changeUserBackground(user.userId, croppedUpload.url, originalUpload?.url ?? null, imagePostPrivacy)
      if (!updated) throw new Error('Profile image update failed')
      persisted = true
      setProfile(updated)
      setAvatarUrl(updated.avatarUrl ?? '')
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      setCropTarget(null)
      setMessage(t('profileImageSaved'))
      void socialApi.getMyFeedPhotoCandidates(40).then((page) => setExistingImages(page.items)).catch(() => undefined)
    } catch (error) {
      if (!persisted) await Promise.allSettled(uploads.map((item) => api.cancelPendingMedia(item)))
      throw error
    }
  }

  async function removeProfileImage(kind: 'avatar' | 'background') {
    if (!user) return
    setRemovingImage(kind)
    setMessage(null)
    try {
      const updated = kind === 'avatar'
        ? await socialApi.removeUserAvatar(user.userId)
        : await socialApi.removeUserBackground(user.userId)
      if (!updated) throw new Error('Profile image removal failed')
      setProfile(updated)
      setAvatarUrl(updated.avatarUrl ?? '')
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      setMessage(t('profileImageRemoved'))
    } catch {
      setMessage(t('profileImageRemoveError'))
    } finally {
      setRemovingImage(null)
    }
  }

  async function chooseExistingImage(photo: SocialPhoto, kind: 'avatar' | 'background') {
    setMessage(null)
    try {
      const response = await fetch(photo.media.url, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not fetch media')
      const blob = await response.blob()
      const extension = blob.type.split('/')[1] || 'jpg'
      setCropTarget({ file: new File([blob], `fakebook-photo.${extension}`, { type: blob.type || 'image/jpeg' }), kind, fromExisting: true })
      setExistingPicker(null)
    } catch {
      setMessage(t('existingPhotoLoadError'))
    }
  }

  return (
    <div className="settings-section profile-settings">
      <SettingsHeading title={t('settingsProfile')} description={t('settingsProfileDesc')} />
      {loading ? <div className="settings-loading"><span className="spinner" /></div> : (
        <form className="settings-card profile-settings-form" onSubmit={save} noValidate>
          <div className="settings-profile-cover" style={profile?.backgroundUrl ? { backgroundImage: `url(${profile.backgroundUrl})` } : undefined}><div className="settings-image-actions">{profile?.backgroundUrl && <button type="button" className="btn-soft danger-text" disabled={removingImage != null} onClick={() => void removeProfileImage('background')}><Icon name="trash" size={17} />{t('removeBackground')}</button>}{existingImages.length > 0 && <button type="button" className="btn-soft" onClick={() => setExistingPicker('background')}><Icon name="photo" size={17} />{t('chooseExistingPhoto')}</button>}<label className="btn-soft"><Icon name="camera" size={17} />{t('changeBackground')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCropTarget({ file, kind: 'background', fromExisting: false }); event.currentTarget.value = '' }} /></label></div></div>
          <div className="settings-profile-summary">
            <div className="settings-avatar-editor"><Avatar name={displayName || user?.email || 'Fakebook'} src={avatarUrl || null} size={76} /><label className="camera-badge" aria-label={t('changeAvatar')}><Icon name="camera" size={16} /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCropTarget({ file, kind: 'avatar', fromExisting: false }); event.currentTarget.value = '' }} /></label></div>
            <div><strong>{displayName || user?.email}<VerifiedBadge verified={profile?.isVerified} /></strong><span>{user?.email}</span><div className="profile-image-inline-actions">{existingImages.length > 0 && <button type="button" onClick={() => setExistingPicker('avatar')}>{t('chooseExistingPhoto')}</button>}{avatarUrl && <button type="button" className="danger-text" disabled={removingImage != null} onClick={() => void removeProfileImage('avatar')}>{t('removeAvatar')}</button>}</div></div>
          </div>
          <div className="settings-form-grid">
            <label><span>{t('nameLabel')}</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
            <label className="wide"><span>{t('bioLabel')}</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} /></label>
            <label><span>{t('locationLabel')}</span><input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
            <label><span>{t('birthDateLabel')}</span><input type="date" min={dateBounds.min} max={dateBounds.max} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label>
            <label><span>{t('genderLabel')}</span><select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">{t('genderPreferNot')}</option><option value="female">{t('genderFemale')}</option><option value="male">{t('genderMale')}</option><option value="custom">{t('genderCustom')}</option></select></label>
            <label><span>{t('profilePhotoPostPrivacy')}</span><select value={imagePostPrivacy} onChange={(event) => { const value = writeDefaultPostPrivacy(user?.userId ?? '', Number(event.target.value)); setImagePostPrivacy(value) }}><option value={0}>{t('privacyPublic')}</option><option value={1}>{t('privacyFriendsFollowers')}</option><option value={2}>{t('privacyFriends')}</option><option value={3}>{t('privacyOnlyMe')}</option></select></label>
          </div>
          {message && <p className={message === t('profileSaved') || message === t('profileImageSaved') || message === t('profileImageRemoved') ? 'form-success' : 'form-error'}>{message}</p>}
          <div className="settings-actions"><button type="submit" className="btn-primary" disabled={saving}>{saving ? t('saving') : t('saveChanges')}</button></div>
        </form>
      )}
      {cropTarget && <ImageCropModal file={cropTarget.file} kind={cropTarget.kind} onClose={() => setCropTarget(null)} onConfirm={saveCroppedImage} />}
      {existingPicker && <ExistingPhotoPicker images={existingImages} kind={existingPicker} onClose={() => setExistingPicker(null)} onSelect={(photo) => void chooseExistingImage(photo, existingPicker)} />}
    </div>
  )
}

function ExistingPhotoPicker({ images, kind, onClose, onSelect }: { images: SocialPhoto[]; kind: 'avatar' | 'background'; onClose: () => void; onSelect: (photo: SocialPhoto) => void }) {
  const { t } = useI18n()
  return <div className="modal-backdrop existing-photo-backdrop" role="presentation" onClick={onClose}><section className="modal existing-photo-modal" role="dialog" aria-modal="true" aria-label={t('chooseExistingPhoto')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{t('chooseExistingPhoto')}</h2><p>{kind === 'avatar' ? t('chooseAvatarPhotoDesc') : t('chooseBackgroundPhotoDesc')}</p></div><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="existing-photo-grid">{images.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onSelect(photo)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div></section></div>
}

function PrivacySettings() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [postPrivacy, setPostPrivacy] = useState(() => String(user ? readDefaultPostPrivacy(user.userId) : 0))
  function update(value: string) {
    setPostPrivacy(value)
    if (user) writeDefaultPostPrivacy(user.userId, Number(value))
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

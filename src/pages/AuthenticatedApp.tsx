import { useEffect, useRef, useState } from 'react'
import { legacyApi } from '../api/client'
import type { UserProfile, UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { GatewayHomePage } from './GatewayHomePage'
import { MessengerPage } from './messenger'
import { ProfilePage } from './ProfilePage'
import { SettingsPage } from './SettingsPage'
import type { SettingsSection } from './SettingsPage'

type AppView = 'home' | 'profile' | 'messenger' | 'settings'

export function AuthenticatedApp() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [view, setView] = useState<AppView>('home')
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile')
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [friends, setFriends] = useState<UserSummary[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        window.setTimeout(() => menuTriggerRef.current?.focus(), 0)
      }
    }
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [menuOpen])

  useEffect(() => {
    let active = true
    legacyApi.me().then((value) => {
      if (!active) return
      setCurrentProfile(value)
      setViewedProfile(value)
    }).catch(() => active && setProfileError(t('profileLoadError'))).finally(() => active && setProfileLoading(false))
    return () => { active = false }
  }, [t])

  useEffect(() => {
    if (view !== 'messenger' || friends.length > 0) return
    legacyApi.friends().then((items) => setFriends(items.map((item) => item.user))).catch(() => setFriends([]))
  }, [friends.length, view])

  if (!user) return null

  function openSettings(section: SettingsSection) {
    setSettingsSection(section)
    setView('settings')
    setMenuOpen(false)
  }

  async function openProfile(userId?: string) {
    const targetUserId = userId ?? user!.userId
    setMenuOpen(false)
    setView('profile')
    if (targetUserId === user!.userId && currentProfile) {
      setViewedProfile(currentProfile)
      return
    }
    if (viewedProfile?.id === targetUserId) return
    setProfileLoading(true)
    setProfileError(null)
    try {
      setViewedProfile(await legacyApi.user(targetUserId))
    } catch {
      setProfileError(t('profileLoadError'))
    } finally {
      setProfileLoading(false)
    }
  }

  const displayName = currentProfile?.displayName || user.email.split('@')[0]
  const avatarUrl = currentProfile?.avatarUrl ?? null

  return (
    <div className="authenticated-app">
      <header className="app-shell-topbar">
        <div className="shell-brand-search">
          <button type="button" className="app-brand" onClick={() => setView('home')} aria-label={t('home')}>
            <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" />
          </button>
          <label className="shell-search"><Icon name="search" size={18} /><input placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} disabled title={t('featureUnavailable')} /></label>
        </div>

        <nav className="app-shell-nav" aria-label={t('appNavigation')}>
          <NavButton icon="home" label={t('home')} active={view === 'home'} onClick={() => setView('home')} />
          <NavButton icon="friends" label={t('friends')} enabled={false} unavailable={t('featureUnavailable')} />
          <NavButton icon="video" label={t('reels')} enabled={false} unavailable={t('featureUnavailable')} />
          <NavButton icon="groups" label={t('groups')} enabled={false} unavailable={t('featureUnavailable')} />
        </nav>

        <div className="app-shell-actions">
          <button type="button" className={view === 'messenger' ? 'icon-circle active' : 'icon-circle'} aria-label={t('messages')} onClick={() => setView('messenger')}><Icon name="messenger" size={20} /></button>
          <button type="button" className="icon-circle" disabled aria-label={`${t('notifications')} — ${t('featureUnavailable')}`} title={t('featureUnavailable')}><Icon name="bell" size={20} /></button>
          <div className="account-menu-wrap" ref={menuRef}>
            <button ref={menuTriggerRef} type="button" className="shell-avatar-button" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <Avatar name={displayName} src={avatarUrl} size={40} />
            </button>
            {menuOpen && (
              <div className="account-dropdown" role="dialog" aria-label={t('accountMenu')}>
                <div className="account-profile-card">
                  <button type="button" onClick={() => void openProfile()}>
                    <Avatar name={displayName} src={avatarUrl} size={58} />
                    <span><strong>{displayName}<VerifiedBadge verified={currentProfile?.isVerified} /></strong><small>{user.email}</small></span>
                  </button>
                  <button type="button" className="view-profile-link" onClick={() => void openProfile()}>{t('seeYourProfile')}</button>
                </div>
                <MenuItem icon="gift" label={t('premium')} detail={t('premiumMenuDesc')} onClick={() => openSettings('premium')} />
                <MenuItem icon="settings" label={t('settingsPrivacy')} detail={t('settingsMenuDesc')} onClick={() => openSettings('profile')} />
                <MenuItem icon="globe" label={t('languageLabel')} onClick={() => openSettings('language')} />
                <MenuItem icon="settings" label={t('settingsAppearance')} onClick={() => openSettings('appearance')} />
                <MenuItem icon="logout" label={t('logout')} onClick={() => void logout()} />
                <p className="account-menu-footer">{t('footerLinks')}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {view === 'home' && <GatewayHomePage profile={currentProfile} />}
      {view === 'profile' && <ProfilePage profile={viewedProfile} loading={profileLoading} error={profileError} canEdit={viewedProfile?.id === user.userId} onEdit={() => openSettings('profile')} />}
      {view === 'messenger' && <div className="shell-messenger"><MessengerPage me={{ id: user.userId, username: user.email.split('@')[0], displayName, avatarUrl, isVerified: currentProfile?.isVerified }} friends={friends} onOpenProfile={(id) => void openProfile(id)} /></div>}
      {view === 'settings' && <SettingsPage initialSection={settingsSection} />}
    </div>
  )
}

function MenuItem({ icon, label, detail, onClick }: { icon: 'gift' | 'settings' | 'globe' | 'logout'; label: string; detail?: string; onClick: () => void }) {
  return <button type="button" className="account-menu-item" onClick={onClick}><span className="account-menu-icon"><Icon name={icon} size={21} /></span><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>{icon !== 'logout' && <span className="account-menu-chevron">›</span>}</button>
}

function NavButton({ icon, label, active = false, enabled = true, unavailable, onClick }: {
  icon: 'home' | 'friends' | 'video' | 'groups'
  label: string
  active?: boolean
  enabled?: boolean
  unavailable?: string
  onClick?: () => void
}) {
  const description = enabled ? label : `${label} — ${unavailable}`
  return <button type="button" className={active ? 'active' : ''} onClick={onClick} disabled={!enabled} aria-label={description} title={description}><Icon name={icon} size={25} /><span>{label}</span></button>
}

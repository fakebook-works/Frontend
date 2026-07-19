import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import { notificationApi, type AppNotification } from '../api/notifications'
import { messengerApi } from '../api/messenger'
import { searchApi, type QuickSearchItem, type SearchTab } from '../api/search'
import { socialApi, type SocialProfile } from '../api/social'
import type { GatewayPost } from '../api/gatewayTypes'
import type { UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Icon, type IconName } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { groupMemberRoute, pathSegment, useAppLocation } from '../lib/router'
import { timeAgo } from '../lib/format'
import { notificationTarget, notificationText } from '../lib/notifications'
import { unlockSoundEffects } from '../lib/sounds'
import { FriendsPage } from './FriendsPage'
import { GatewayHomePage, GatewayPostCard } from './GatewayHomePage'
import { GroupProfilePage, GroupsPage } from './GroupsPage'
import { ProfilePage } from './ProfilePage'
import { ReelsPage } from './ReelsPage'
import { SavedPage } from './SavedPage'
import { SearchPage } from './SearchPage'
import { SettingsPage } from './SettingsPage'
import type { SettingsSection } from './SettingsPage'
import { UserInGroupProfilePage } from './UserInGroupProfilePage'
import { MessengerDock, MessengerPage, type MessengerDockHandle } from './messenger'

const SETTINGS = new Set<SettingsSection>(['overview', 'profile', 'security', 'privacy', 'sessions', 'language', 'appearance', 'premium'])

export function AuthenticatedApp() {
  const { user, logout } = useAuth()
  const authenticatedUserId = user?.userId
  const { t } = useI18n()
  const [location, navigate] = useAppLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [appsMenuOpen, setAppsMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState<'root' | 'settings'>('root')
  const [currentProfile, setCurrentProfile] = useState<SocialProfile | null>(null)
  const [viewedProfile, setViewedProfile] = useState<SocialProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [friends, setFriends] = useState<UserSummary[]>([])
  const [messengerPanelOpen, setMessengerPanelOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationItems, setNotificationItems] = useState<AppNotification[]>([])
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [searchText, setSearchText] = useState(() => location.params.get('q') ?? '')
  const [quickResults, setQuickResults] = useState<QuickSearchItem[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const appsMenuRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLFormElement>(null)
  const messengerDockRef = useRef<MessengerDockHandle>(null)
  const seenNotificationIds = useRef(new Set<string>())

  useEffect(() => {
    if (location.pathname === '/search') setSearchText(new URLSearchParams(location.search).get('q') ?? '')
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!menuOpen) return
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setMenuView('root')
      }
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (menuView === 'settings') setMenuView('root')
      else {
        setMenuOpen(false)
        window.setTimeout(() => menuTriggerRef.current?.focus(), 0)
      }
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [menuOpen, menuView])

  useEffect(() => {
    if (!appsMenuOpen) return
    const close = (event: MouseEvent) => {
      if (!appsMenuRef.current?.contains(event.target as Node)) setAppsMenuOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAppsMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [appsMenuOpen])

  const profileId = location.pathname.startsWith('/profile/') ? pathSegment(location.pathname, 1) : null

  useEffect(() => {
    if (!user) return
    let active = true
    setProfileLoading(true)
    socialApi.getProfile(user.userId, user.email).then((profile) => {
      if (!active) return
      setCurrentProfile(profile)
    }).catch(() => active && setProfileError(t('profileLoadError'))).finally(() => active && setProfileLoading(false))
    return () => { active = false }
  }, [t, user])

  useEffect(() => {
    const update = (event: Event) => {
      const profile = (event as CustomEvent<SocialProfile>).detail
      if (!profile) return
      setCurrentProfile(profile)
      if (profileId === profile.id) setViewedProfile(profile)
    }
    window.addEventListener('fakebook:profile-updated', update)
    return () => window.removeEventListener('fakebook:profile-updated', update)
  }, [profileId])

  useEffect(() => {
    if (!profileId || !user) return
    if (profileId === user.userId && currentProfile) {
      setViewedProfile(currentProfile)
      setProfileLoading(false)
      return
    }
    let active = true
    setProfileLoading(true)
    setProfileError(null)
    socialApi.getProfile(profileId).then((profile) => active && setViewedProfile(profile)).catch(() => active && setProfileError(t('profileLoadError'))).finally(() => active && setProfileLoading(false))
    return () => { active = false }
  }, [currentProfile, profileId, t, user])

  useEffect(() => {
    if (!user || (!messengerPanelOpen && location.pathname !== '/messenger')) return
    socialApi.getRelationProfiles(user.userId, 0).then((profiles) => setFriends(profiles.map(toSummary))).catch(() => setFriends([]))
  }, [location.pathname, messengerPanelOpen, user])

  useEffect(() => {
    const unlock = () => {
      unlockSoundEffects()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!authenticatedUserId) return
    const heartbeat = () => void messengerApi.heartbeatPresence().catch(() => undefined)
    heartbeat()
    const intervalId = window.setInterval(heartbeat, 30_000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') heartbeat()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', heartbeat)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', heartbeat)
    }
  }, [authenticatedUserId])

  useEffect(() => {
    notificationApi.notifications(12).then((page) => {
      page.items.forEach((item) => seenNotificationIds.current.add(item.id))
      setNotificationItems(page.items)
      setUnreadNotifications(page.unreadCount)
    }).catch(() => setUnreadNotifications(0)).finally(() => setNotificationsLoading(false))
    return notificationApi.subscribeNotifications((notification) => {
      if (seenNotificationIds.current.has(notification.id)) return
      seenNotificationIds.current.add(notification.id)
      setNotificationItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 12))
      if (!notification.isRead) setUnreadNotifications((count) => count + 1)
    })
  }, [])

  useEffect(() => {
    const query = searchText.trim()
    if (!quickOpen || query.length < 1) {
      setQuickResults([])
      setQuickLoading(false)
      return
    }
    let active = true
    setQuickLoading(true)
    const timer = window.setTimeout(() => {
      searchApi.fastSearch(query).then((items) => active && setQuickResults(items)).catch(() => active && setQuickResults([])).finally(() => active && setQuickLoading(false))
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [quickOpen, searchText])

  if (!user) return null

  const displayName = currentProfile?.displayName || user.email.split('@')[0]
  const avatarUrl = currentProfile?.avatarUrl ?? null
  const searchTab = normalizeSearchTab(location.params.get('tab'))
  const settingsSection = settingsSectionFor(location.pathname)
  const memberRoute = groupMemberRoute(location.pathname)
  const groupRouteId = memberRoute?.groupId ?? (location.pathname.startsWith('/groups/') ? pathSegment(location.pathname, 1) : null)
  const groupMemberProfileId = memberRoute?.profileId ?? null
  const groupId = groupMemberProfileId ? null : groupRouteId

  function go(path: string) {
    setMenuOpen(false)
    setAppsMenuOpen(false)
    setMessengerPanelOpen(false)
    setNotificationPanelOpen(false)
    setMenuView('root')
    setQuickOpen(false)
    navigate(path)
  }

  function runSearch() {
    const query = searchText.trim()
    if (query.length < 1) return
    go(`/search?q=${encodeURIComponent(query)}&tab=posts`)
  }

  async function openDirectMessage(profileId: string) {
    if (!user) throw new Error('Authentication required')
    if (messengerDockRef.current) {
      await messengerDockRef.current.openDirect(profileId)
      return
    }
    const conversation = await messengerApi.createDirectConversation(profileId, user.userId)
    go(`/messenger?conversation=${encodeURIComponent(conversation.id)}`)
  }

  async function openNotification(item: AppNotification) {
    if (!item.isRead) {
      try {
        await notificationApi.markRead(item.id)
        setNotificationItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry))
        setUnreadNotifications((count) => Math.max(0, count - 1))
      } catch {
        // A notification deep-link should remain usable if the read receipt is temporarily unavailable.
      }
    }
    go(notificationTarget(item))
  }

  async function markAllNotificationsRead() {
    await notificationApi.markAllRead()
    setNotificationItems((current) => current.map((item) => ({ ...item, isRead: true })))
    setUnreadNotifications(0)
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    runSearch()
  }

  function openQuickResult(item: QuickSearchItem) {
    void searchApi.recordSearchResultView(item.referenceId).catch(() => undefined)
    go(item.kind === 'user' ? `/profile/${item.id}` : `/groups/${item.id}`)
  }

  return <div className="authenticated-app">
    <header className="app-shell-topbar">
      <div className="shell-brand-search">
        <button type="button" className="app-brand" onClick={() => go('/home')} aria-label={t('home')}><img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" /></button>
        <form ref={searchRef} className="shell-search-wrap" onSubmit={submitSearch} onFocus={() => setQuickOpen(true)} onBlur={() => window.setTimeout(() => { if (!searchRef.current?.contains(document.activeElement)) setQuickOpen(false) }, 0)}>
          <label className="shell-search"><Icon name="search" size={18} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} /></label>
          {quickOpen && searchText.trim().length >= 1 && <QuickSearchDropdown items={quickResults} loading={quickLoading} onOpen={openQuickResult} onSeeAll={runSearch} />}
        </form>
      </div>

      <nav className="app-shell-nav" aria-label={t('appNavigation')}>
        <NavButton icon="home" label={t('home')} active={location.pathname === '/' || location.pathname === '/home'} onClick={() => go('/home')} />
        <NavButton icon="friends" label={t('friends')} active={location.pathname.startsWith('/friends')} onClick={() => go('/friends')} />
        <NavButton icon="video" label={t('reels')} active={location.pathname.startsWith('/reels')} onClick={() => go('/reels')} />
        <NavButton icon="groups" label={t('groups')} active={location.pathname.startsWith('/groups')} onClick={() => go('/groups')} />
      </nav>

      <div className="app-shell-actions">
        <div className="apps-menu-wrap" ref={appsMenuRef}><button type="button" className="icon-circle shell-menu-button" aria-label={t('menu')} title={t('menu')} aria-expanded={appsMenuOpen} onClick={() => setAppsMenuOpen((open) => !open)}><Icon name="menu" size={20} /></button>{appsMenuOpen && <AppsMenu onNavigate={go} />}</div>
        <button type="button" className={location.pathname === '/messenger' || messengerPanelOpen ? 'icon-circle shell-messenger-button active' : 'icon-circle shell-messenger-button'} aria-label={t('messages')} aria-expanded={messengerPanelOpen} onClick={() => { setMessengerPanelOpen((open) => !open); setMenuOpen(false); setAppsMenuOpen(false) }}><Icon name="messenger" size={20} /></button>
        <button type="button" className={notificationPanelOpen ? 'icon-circle shell-notification-button active badge-button' : 'icon-circle shell-notification-button badge-button'} aria-label={t('notifications')} aria-expanded={notificationPanelOpen} onClick={() => { setNotificationPanelOpen((open) => !open); setMessengerPanelOpen(false); setMenuOpen(false); setAppsMenuOpen(false) }}><Icon name="bell" size={20} />{unreadNotifications > 0 && <span>{Math.min(99, unreadNotifications)}</span>}</button>
        <div className="account-menu-wrap" ref={menuRef}>
          <button ref={menuTriggerRef} type="button" className="shell-avatar-button" aria-haspopup="dialog" aria-expanded={menuOpen} aria-label={displayName} onClick={() => { setMenuOpen((open) => !open); setMenuView('root') }}><Avatar name={displayName} src={avatarUrl} size={36} /></button>
          {menuOpen && <div className={`account-dropdown account-dropdown-${menuView}`} role="dialog" aria-label={t('accountMenu')}>
            {menuView === 'root' ? <>
              <div className="account-profile-card"><button type="button" onClick={() => go(`/profile/${user.userId}`)}><Avatar name={displayName} src={avatarUrl} size={58} /><span><strong>{displayName}<VerifiedBadge verified={currentProfile?.isVerified} /></strong><small>{user.email}</small></span></button><button type="button" className="view-profile-link" onClick={() => go(`/profile/${user.userId}`)}>{t('seeYourProfile')}</button></div>
              <MenuItem icon="gift" label={t('premium')} detail={t('premiumMenuDesc')} onClick={() => go('/settings/premium')} />
              <MenuItem icon="settings" label={t('settingsPrivacy')} detail={t('settingsMenuDesc')} onClick={() => setMenuView('settings')} />
              <MenuItem icon="settings" label={t('settingsAppearance')} onClick={() => go('/settings/appearance')} />
              <MenuItem icon="logout" label={t('logout')} onClick={() => void logout()} />
              <p className="account-menu-footer">{t('footerLinks')}</p>
            </> : <SettingsSubmenu onBack={() => setMenuView('root')} onOpen={(section) => go(`/settings/${section}`)} />}
          </div>}
        </div>
      </div>
    </header>

    {notificationPanelOpen && <NotificationPopover items={notificationItems} unreadCount={unreadNotifications} loading={notificationsLoading} onOpen={(item) => void openNotification(item)} onMarkAll={() => void markAllNotificationsRead()} onClose={() => setNotificationPanelOpen(false)} />}

    {(location.pathname === '/' || location.pathname === '/home') && <GatewayHomePage profile={currentProfile} onNavigate={go} onMessage={openDirectMessage} />}
    {location.pathname === '/search' && <SearchPage query={location.params.get('q') ?? ''} tab={searchTab} userId={user.userId} onNavigate={go} />}
    {location.pathname.startsWith('/friends') && <FriendsPage userId={user.userId} section={normalizeFriendSection(pathSegment(location.pathname, 1))} onNavigate={go} onMessage={openDirectMessage} />}
    {location.pathname.startsWith('/reels') && <ReelsPage userId={user.userId} mode={normalizeReelMode(pathSegment(location.pathname, 1))} onNavigate={go} />}
    {location.pathname === '/groups' && <GroupsPage userId={user.userId} onNavigate={go} />}
    {groupId && <GroupProfilePage groupId={groupId} userId={user.userId} onBack={() => go('/groups')} onNavigate={go} />}
    {groupRouteId && groupMemberProfileId && <UserInGroupProfilePage groupId={groupRouteId} profileId={groupMemberProfileId} viewerId={user.userId} onBack={() => go(`/groups/${groupRouteId}`)} onNavigate={go} />}
    {profileId && <ProfilePage profile={viewedProfile} loading={profileLoading} error={profileError} canEdit={profileId === user.userId} viewerId={user.userId} onEdit={() => go('/settings/profile')} onNavigate={go} onMessage={openDirectMessage} />}
    {location.pathname === '/messenger' && <div className="shell-messenger"><MessengerPage me={{ id: user.userId, username: user.email.split('@')[0], displayName, avatarUrl, isVerified: currentProfile?.isVerified }} friends={friends} initialConversationId={location.params.get('conversation')} onOpenProfile={(id) => go(`/profile/${id}`)} /></div>}
    {location.pathname === '/saved' && <SavedPage userId={user.userId} onNavigate={go} />}
    {location.pathname.startsWith('/settings') && <SettingsPage initialSection={settingsSection} />}
    {location.pathname === '/premium' && <SettingsPage initialSection="premium" />}
    {location.pathname === '/premium/payment' && <SettingsPage initialSection="premium" />}
    {location.pathname.startsWith('/content/') && <ContentPage contentId={pathSegment(location.pathname, 1)!} viewerId={user.userId} onNavigate={go} onBack={() => go('/home')} />}
    {!isKnownPath(location.pathname) && <main className="unknown-page"><div className="card state-card"><h1>{t('pageNotFound')}</h1><p>{t('pageNotFoundDesc')}</p><button className="btn-primary" onClick={() => go('/home')}>{t('backToHome')}</button></div></main>}
    <MessengerDock ref={messengerDockRef} me={{ id: user.userId, username: user.email.split('@')[0], displayName, avatarUrl, isVerified: currentProfile?.isVerified }} friends={friends} panelOpen={messengerPanelOpen} hidden={location.pathname === '/messenger'} onPanelClose={() => setMessengerPanelOpen(false)} onOpenAll={(conversationId) => go(conversationId ? `/messenger?conversation=${encodeURIComponent(conversationId)}` : '/messenger')} onOpenProfile={(id) => go(`/profile/${id}`)} />
  </div>
}

function NotificationPopover({ items, unreadCount, loading, onOpen, onMarkAll, onClose }: { items: AppNotification[]; unreadCount: number; loading: boolean; onOpen: (item: AppNotification) => void; onMarkAll: () => void; onClose: () => void }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [unreadItems, setUnreadItems] = useState<AppNotification[] | null>(null)
  const [unreadLoading, setUnreadLoading] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const popoverRef = useRef<HTMLElement>(null)
  useEffect(() => {
    setUnreadItems((current) => {
      if (current === null) return null
      const loaded = current ?? []
      const incoming = items.filter((item) => !item.isRead && !loaded.some((entry) => entry.id === item.id))
      return [...incoming, ...loaded.filter((item) => !item.isRead)]
    })
  }, [items])
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.shell-notification-button')) return
      onClose()
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (optionsOpen) setOptionsOpen(false)
      else onClose()
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [onClose, optionsOpen])
  async function selectFilter(next: 'all' | 'unread') {
    setFilter(next)
    if (next !== 'unread' || unreadItems !== null || unreadLoading) return
    setUnreadLoading(true)
    try {
      const page = await notificationApi.notifications(12, null, true)
      setUnreadItems(page.items)
    } catch {
      setUnreadItems(items.filter((item) => !item.isRead))
    } finally {
      setUnreadLoading(false)
    }
  }
  const visible = filter === 'unread' ? unreadItems ?? items.filter((item) => !item.isRead) : items
  function openItem(item: AppNotification) {
    setUnreadItems((current) => current?.filter((entry) => entry.id !== item.id) ?? null)
    onOpen(item)
  }
  function markAll() {
    setUnreadItems([])
    setOptionsOpen(false)
    onMarkAll()
  }
  return <aside ref={popoverRef} className="notification-popover notification-popover-redesign" role="dialog" aria-label={t('notifications')}>
    <header className="notification-popover-head">
      <h2>{t('notifications')}</h2>
      <div className="notification-options-wrap">
        <button type="button" className="notification-options-trigger" aria-label={t('notificationOptions')} aria-expanded={unreadCount > 0 && optionsOpen} onClick={() => { if (unreadCount > 0) setOptionsOpen((open) => !open) }}><Icon name="more" size={19} /></button>
        {optionsOpen && unreadCount > 0 && <div className="notification-options-menu"><button type="button" onClick={markAll}>{t('markAllRead')}</button></div>}
      </div>
    </header>
    <div className="notification-popover-actions" role="tablist" aria-label={t('notifications')}>
      <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => void selectFilter('all')}>{t('allNotifications')}</button>
      <button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => void selectFilter('unread')}>{t('unreadOnly')}</button>
    </div>
    <div className="notification-section-head"><strong>{t('earlierNotifications')}</strong></div>
    <div className="notification-popover-list">{loading || (filter === 'unread' && unreadLoading) ? <div className="state-card"><span className="spinner" /></div> : visible.length === 0 ? <p className="muted">{t('noNotifications')}</p> : visible.map((item) => {
      const actorName = item.actor?.displayName ?? t('fakebookUser')
      return <button type="button" key={item.id} className={item.isRead ? '' : 'unread'} onClick={() => openItem(item)}>
        <span className="notification-avatar-wrap"><Avatar name={actorName} src={item.actor?.avatarUrl} size={56} /><NotificationKindIcon actionType={item.actionType} /></span>
        <span className="notification-popover-copy"><span><strong>{actorName}<VerifiedBadge verified={item.actor?.isVerified} size={12} /></strong> {notificationText(item.actionType, t)}</span><small>{timeAgo(item.createdAt)}</small></span>
        {!item.isRead && <i />}
      </button>
    })}</div>
  </aside>
}

function NotificationKindIcon({ actionType }: { actionType: string }) {
  let icon: IconName = 'bell'
  let tone = 'activity'
  if (actionType === 'LIKE') { icon = 'like'; tone = 'like' }
  else if (actionType === 'COMMENT') { icon = 'comment'; tone = 'comment' }
  else if (actionType === 'FRIEND_REQUEST' || actionType === 'FRIEND_ACCEPT') { icon = 'friends'; tone = 'friend' }
  else if (actionType.startsWith('GROUP_')) { icon = 'groups'; tone = 'group' }
  else if (actionType === 'SHARE') { icon = 'share'; tone = 'share' }
  else if (actionType === 'TAG' || actionType === 'MENTION') { icon = 'tag'; tone = 'tag' }
  return <span className={`notification-kind-icon ${tone}`} aria-hidden="true"><Icon name={icon} size={14} /></span>
}

function AppsMenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const destinations: Array<{ path: string; label: string; icon: 'search' | 'friends' | 'video' | 'groups' | 'bookmark' | 'gift' | 'settings' }> = [
    { path: '/search', label: t('searchResults'), icon: 'search' },
    { path: '/friends', label: t('friends'), icon: 'friends' },
    { path: '/reels', label: t('reels'), icon: 'video' },
    { path: '/groups', label: t('groups'), icon: 'groups' },
    { path: '/saved', label: t('saved'), icon: 'bookmark' },
    { path: '/settings/premium', label: t('premium'), icon: 'gift' },
    { path: '/settings/overview', label: t('settingsPrivacy'), icon: 'settings' },
  ]
  return <div className="apps-menu-panel" role="dialog" aria-label={t('menu')}><h2>{t('menu')}</h2><div>{destinations.map((item) => <button type="button" key={item.path} onClick={() => onNavigate(item.path)}><span><Icon name={item.icon} size={22} /></span><strong>{item.label}</strong></button>)}</div></div>
}

function toSummary(profile: SocialProfile): UserSummary {
  return { id: profile.id, username: profile.username, displayName: profile.displayName, avatarUrl: profile.avatarUrl, isVerified: profile.isVerified }
}

function QuickSearchDropdown({ items, loading, onOpen, onSeeAll }: { items: QuickSearchItem[]; loading: boolean; onOpen: (item: QuickSearchItem) => void; onSeeAll: () => void }) {
  const { t } = useI18n()
  return <div className="quick-search-results">{loading ? <div className="quick-search-state"><span className="spinner" /></div> : items.length === 0 ? <p className="muted">{t('noSearchResults')}</p> : items.map((item) => <button type="button" key={`${item.kind}-${item.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => onOpen(item)}><Avatar name={item.kind === 'user' ? item.profile.displayName : item.group.name} src={item.kind === 'user' ? item.profile.avatarUrl : item.group.avatarUrl} size={44} /><span><strong>{item.kind === 'user' ? item.profile.displayName : item.group.name}{item.kind === 'user' && <VerifiedBadge verified={item.profile.isVerified} />}</strong><small>{item.kind === 'user' ? item.profile.followerCount > 0 ? t('followersCount', { count: item.profile.followerCount }) : t('personResult') : item.group.memberCount == null ? t('groupResult') : t('membersCount', { count: item.group.memberCount })}</small></span></button>)}<button type="button" className="quick-search-all" onMouseDown={(event) => event.preventDefault()} onClick={onSeeAll}><Icon name="search" size={18} />{t('seeAllResults')}</button></div>
}

function ContentPage({ contentId, viewerId, onNavigate, onBack }: { contentId: string; viewerId: string; onNavigate: (path: string) => void; onBack: () => void }) {
  const { t, locale } = useI18n()
  const [post, setPost] = useState<GatewayPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => { let active = true; api.postDetail(contentId).then((value) => active && setPost(value)).catch(() => active && setError(true)).finally(() => active && setLoading(false)); return () => { active = false } }, [contentId])
  return <main className="single-content-page">{loading ? <div className="card state-card"><span className="spinner" /></div> : post ? <><button className="btn-soft content-back" onClick={onBack}>{t('back')}</button><GatewayPostCard post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} /></> : <div className="card state-card"><h2>{t('contentUnavailable')}</h2><p>{error ? t('genericError') : t('contentUnavailableDesc')}</p><button className="btn-primary" onClick={onBack}>{t('backToHome')}</button></div>}</main>
}

function settingsSectionFor(pathname: string): SettingsSection {
  const value = pathSegment(pathname, 1) as SettingsSection | null
  return value && SETTINGS.has(value) ? value : 'overview'
}

function normalizeSearchTab(value: string | null): SearchTab {
  return value === 'people' || value === 'reels' || value === 'groups' ? value : 'posts'
}

function normalizeFriendSection(value: string | null): 'home' | 'friends' | 'incoming' | 'outgoing' | 'blocked' {
  return value === 'friends' || value === 'incoming' || value === 'outgoing' || value === 'blocked' ? value : 'home'
}

function normalizeReelMode(value: string | null): 'for-you' | 'following' | 'mine' | 'saved' | 'liked' | 'shared' | 'watched' {
  return value === 'following' || value === 'mine' || value === 'saved' || value === 'liked' || value === 'shared' || value === 'watched' ? value : 'for-you'
}

function isKnownPath(pathname: string) {
  return pathname === '/' || pathname === '/home' || pathname === '/search' || pathname === '/groups' || pathname === '/messenger' || pathname === '/saved' || pathname === '/premium' || pathname === '/premium/payment' || ['/friends', '/reels', '/groups/', '/profile/', '/settings', '/content/'].some((prefix) => pathname.startsWith(prefix))
}

function SettingsSubmenu({ onBack, onOpen }: { onBack: () => void; onOpen: (section: SettingsSection) => void }) {
  const { t } = useI18n()
  return <div className="account-submenu"><header><button type="button" className="account-submenu-back" onClick={onBack} aria-label={t('back')}>‹</button><h2>{t('settingsPrivacy')}</h2></header><SettingsMenuItem icon="settings" label={t('settingsGeneral')} onClick={() => onOpen('overview')} /><SettingsMenuItem icon="globe" label={t('languageLabel')} onClick={() => onOpen('language')} /><SettingsMenuItem icon="friends" label={t('privacyCheckup')} onClick={() => onOpen('privacy')} /><SettingsMenuItem icon="lock" label={t('privacyCenter')} onClick={() => onOpen('security')} /><SettingsMenuItem icon="clock" label={t('activityLog')} onClick={() => onOpen('sessions')} /><SettingsMenuItem icon="settings" label={t('contentPreferences')} onClick={() => onOpen('appearance')} /></div>
}

function SettingsMenuItem({ icon, label, onClick }: { icon: 'settings' | 'globe' | 'friends' | 'lock' | 'clock'; label: string; onClick: () => void }) {
  return <button type="button" className="account-menu-item account-submenu-item" onClick={onClick}><span className="account-menu-icon"><Icon name={icon} size={21} /></span><strong>{label}</strong>{icon === 'globe' && <span className="account-menu-chevron">›</span>}</button>
}

function MenuItem({ icon, label, detail, onClick }: { icon: 'gift' | 'settings' | 'logout'; label: string; detail?: string; onClick: () => void }) {
  return <button type="button" className="account-menu-item" onClick={onClick}><span className="account-menu-icon"><Icon name={icon} size={21} /></span><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>{icon !== 'logout' && <span className="account-menu-chevron">›</span>}</button>
}

type ShellNavIcon = 'home' | 'friends' | 'video' | 'groups'

function ShellNavGlyph({ icon, active }: { icon: ShellNavIcon; active: boolean }) {
  if (active) {
    if (icon === 'home') return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M11.18 2.7a1.25 1.25 0 0 1 1.64 0l8.25 7.15c.28.24.43.59.43.95v9.45c0 .69-.56 1.25-1.25 1.25h-5.7v-6.45h-5.1v6.45h-5.7c-.69 0-1.25-.56-1.25-1.25V10.8c0-.36.16-.71.43-.95l8.25-7.15Z" /></svg>
    if (icon === 'friends') return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="8.7" cy="7.7" r="4" /><circle cx="17.2" cy="7.4" r="3" /><path d="M1.8 20.7v-1.3c0-3.6 3.1-6 6.9-6s6.9 2.4 6.9 6v1.3H1.8Zm14.8 0v-1.3c0-2.1-.75-3.9-2.1-5.25.84-.42 1.8-.65 2.8-.65 3 0 5.2 1.9 5.2 4.8v2.4h-5.9Z" /></svg>
    if (icon === 'video') return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="2.5" y="2.5" width="19" height="19" rx="3.4" /><path d="M2.9 8.7h18.2M7.4 2.9l3.3 5.8m2.8-5.8 3.3 5.8" fill="none" stroke="var(--card)" strokeWidth="1.8" /><path d="m10 11.8 5.4 3.2-5.4 3.2v-6.4Z" fill="var(--card)" /></svg>
    return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="12" cy="7.6" r="3.3" /><circle cx="5.2" cy="9" r="2.45" /><circle cx="18.8" cy="9" r="2.45" /><path d="M5.3 20.8v-1.6c0-3.45 2.95-5.7 6.7-5.7s6.7 2.25 6.7 5.7v1.6H5.3ZM.7 19.2v-1c0-2.65 2.05-4.45 4.9-4.65a7.4 7.4 0 0 0-1.7 4.75v.9H.7Zm22.6 0h-3.2v-.9a7.4 7.4 0 0 0-1.7-4.75c2.85.2 4.9 2 4.9 4.65v1Z" /></svg>
  }

  if (icon === 'home') return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m3.5 10.5 8.5-7.4 8.5 7.4v9.25c0 .7-.55 1.25-1.25 1.25h-4.9v-6.15h-4.7V21h-4.9c-.7 0-1.25-.55-1.25-1.25V10.5Z" /></svg>
  if (icon === 'friends') return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="8.7" cy="7.7" r="3.7" /><circle cx="17.2" cy="7.4" r="2.7" /><path d="M2.2 20v-1.1c0-3.25 2.9-5.4 6.5-5.4s6.5 2.15 6.5 5.4V20h-13Zm14.65-6.4c2.75.35 4.65 2.05 4.65 4.55V20h-3.9" /></svg>
  if (icon === 'video') return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="2.8" y="2.8" width="18.4" height="18.4" rx="3.2" /><path d="M3.2 8.7h17.6M7.5 3.2l3.15 5.5m2.8-5.5 3.15 5.5" /><path d="m10.1 11.9 5.2 3.1-5.2 3.1v-6.2Z" fill="currentColor" stroke="none" /></svg>
  return <svg className="shell-nav-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="7.7" r="3.1" /><circle cx="5.4" cy="9.1" r="2.25" /><circle cx="18.6" cy="9.1" r="2.25" /><path d="M5.8 20v-1.35c0-3.1 2.7-5.15 6.2-5.15s6.2 2.05 6.2 5.15V20H5.8ZM1.2 18.8v-.7c0-2.35 1.75-3.95 4.25-4.2M22.8 18.8v-.7c0-2.35-1.75-3.95-4.25-4.2" /></svg>
}

function NavButton({ icon, label, active, onClick }: { icon: ShellNavIcon; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? 'active' : ''} onClick={onClick} aria-label={label} title={label}><ShellNavGlyph icon={icon} active={active} /><span>{label}</span></button>
}

import { Activity, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { notificationApi, type AppNotification } from '../api/notifications'
import type { GatewayMedia, GatewayPost } from '../api/gatewayTypes'
import { messengerApi } from '../api/messenger'
import { searchApi, type QuickSearchItem, type SearchTab } from '../api/search'
import { socialApi, type SocialContent, type SocialProfile } from '../api/social'
import type { MessengerConversationDto, UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { CONTENT_DETAIL_SHELL_CLOSE_TARGET_ID } from '../components/ContentDetailShellClose'
import type { PostPhotoViewerMediaEntry } from '../components/PostPhotoViewer'
import { FriendPeopleGlyph, FriendPersonActionGlyph, type FriendPersonAction } from '../components/FriendPeopleGlyph'
import { GroupMembersIcon } from '../components/GroupMembersIcon'
import { Icon, ReelIcon, type IconName } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { groupMemberRoute, pathSegment, useAppLocation } from '../lib/router'
import { INPUT_LIMITS } from '../lib/inputLimits'
import {
  appHref,
  fallbackBackgroundHref,
  locationFromHref,
  mediaOverlayHref,
  normalizeLegacyOverlayHref,
  overlayBackgroundHref,
  overlayReturnsWithBack,
  parseOverlayRoute,
  reelOverlayHref,
  type FakebookOverlayHistoryState,
} from '../lib/overlayRoutes'
import { relativeTime } from '../lib/format'
import { notificationTarget, notificationText } from '../lib/notifications'
import { takeOverlayContent } from '../lib/overlayContentCache'
import { gatewayReelToSocialContent, type GatewayReelPost } from '../lib/reelEntry'
import { unlockSoundEffects } from '../lib/sounds'
import { ActivityVisibilityProvider } from '../lib/activityVisibility'
import { FriendsPage } from './FriendsPage'
import { GatewayHomePage, HOME_REFRESH_EVENT } from './GatewayHomePage'
import { GroupProfilePage, GroupsPage } from './GroupsPage'
import type { GroupMediaViewerState } from './GroupProfilePage'
import { ProfilePage } from './ProfilePage'
import type { ProfileMediaViewerOpenOptions, ProfileMediaViewerState } from './ProfilePage'
import { ReelsPage, type ReelMode } from './ReelsPage'
import { SavedPage, type SavedSection } from './SavedPage'
import { SearchPage } from './SearchPage'
import { SettingsPage } from './SettingsPage'
import type { SettingsSection } from './SettingsPage'
import { UserInGroupProfilePage } from './UserInGroupProfilePage'
import { HelpPage } from './HelpPage'
import { PrivacyPage } from './PrivacyPage'
import { AboutPage } from './AboutPage'
import { PoliciesPage } from './PoliciesPage'
import { MessengerDock, MessengerPage, type MessengerDockHandle } from './messenger'

const SETTINGS = new Set<SettingsSection>(['overview', 'profile', 'security', 'privacy', 'sessions', 'language', 'appearance', 'premium'])
type PrimaryDestination = 'home' | 'friends' | 'reels' | 'groups'
const REEL_MODES: readonly ReelMode[] = ['for-you', 'following', 'mine', 'saved', 'liked', 'shared', 'watched']
const DIRECT_OVERLAY_BACKGROUND_HREF = '/__overlay-background'
type PhotoOverlayState = {
  contentId: string
  mediaId: string
  mediaUrl?: string
  initialPlaybackTime?: number
  initialPost?: GatewayPost
  mediaEntries?: PostPhotoViewerMediaEntry[]
  unavailableAuthor?: GatewayPost['author']
}
const ContentDetailOverlay = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentDetailOverlay })))
const PostPhotoViewer = lazy(() => import('../components/PostPhotoViewer').then((module) => ({ default: module.PostPhotoViewer })))

export function AuthenticatedApp() {
  const { user, logout } = useAuth()
  const authenticatedUserId = user?.userId
  const { t, locale } = useI18n()
  const [browserLocation, navigate] = useAppLocation()
  const overlayRoute = parseOverlayRoute(browserLocation)
  const overlayBackground = overlayRoute ? overlayBackgroundHref(browserLocation.state) : null
  const location = overlayRoute
    ? locationFromHref(overlayBackground ?? (overlayRoute.kind === 'content' ? fallbackBackgroundHref(overlayRoute) : DIRECT_OVERLAY_BACKGROUND_HREF))
    : browserLocation
  const isHomeRoute = location.pathname === '/' || location.pathname === '/home'
  const isFriendsRoute = location.pathname.startsWith('/friends')
  const isReelsRoute = location.pathname.startsWith('/reels')
  const isGroupsRoute = location.pathname === '/groups'
  const isSearchRoute = location.pathname === '/search'
  const isGroupsPath = location.pathname.startsWith('/groups')
  const activePrimaryDestination = primaryDestinationForPath(location.pathname)
  const secondaryDestinationRoute = activePrimaryDestination ? null : appHref(location)
  const reelEntrySource = isReelsRoute && (location.params.get('source') === 'for-you' || location.params.get('source') === 'profile')
    ? location.params.get('source') as 'for-you' | 'profile'
    : null
  const reelEntryId = isReelsRoute ? location.params.get('reel') : null
  const reelEntryOwnerId = isReelsRoute ? location.params.get('owner') : null
  const [reelsRefreshToken, setReelsRefreshToken] = useState(0)
  const [groupsRefreshToken, setGroupsRefreshToken] = useState(0)
  const [reelSeed, setReelSeed] = useState<SocialContent | null>(null)
  const [photoSeed, setPhotoSeed] = useState<PhotoOverlayState | null>(null)
  const [mountedDestinations, setMountedDestinations] = useState<Set<PrimaryDestination>>(() => activePrimaryDestination ? new Set([activePrimaryDestination]) : new Set())
  const [mountedReelModes, setMountedReelModes] = useState<Set<ReelMode>>(() => isReelsRoute
    ? new Set([normalizeReelMode(pathSegment(location.pathname, 1))])
    : new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  const [appsMenuOpen, setAppsMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState<'root' | 'settings'>('root')
  const [currentProfile, setCurrentProfile] = useState<SocialProfile | null>(null)
  const [viewedProfile, setViewedProfile] = useState<SocialProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [friends, setFriends] = useState<UserSummary[]>([])
  const friendsLoadedForUserRef = useRef<string | null>(null)
  const [messengerPanelOpen, setMessengerPanelOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationItems, setNotificationItems] = useState<AppNotification[]>([])
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [searchText, setSearchText] = useState(() => location.params.get('q') ?? '')
  const [quickResults, setQuickResults] = useState<QuickSearchItem[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickClosing, setQuickClosing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const appsMenuRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLFormElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const quickCloseTimerRef = useRef<number | null>(null)
  const messengerDockRef = useRef<MessengerDockHandle>(null)
  const navigationHandlerRef = useRef<(path: string) => void>(() => undefined)
  const homeReelHandlerRef = useRef<(reel: Extract<GatewayPost, { __typename: 'ReelDetail' }>) => void>(() => undefined)
  const directMessageHandlerRef = useRef<(profileId: string) => Promise<void>>(() => Promise.resolve())
  const newConversationHandlerRef = useRef<() => void>(() => undefined)
  const conversationHandlerRef = useRef<(conversation: MessengerConversationDto) => void>(() => undefined)
  const stableNavigation = useCallback((path: string) => navigationHandlerRef.current(path), [])
  const stableHomeReel = useCallback((reel: Extract<GatewayPost, { __typename: 'ReelDetail' }>) => homeReelHandlerRef.current(reel), [])
  const stableDirectMessage = useCallback((profileId: string) => directMessageHandlerRef.current(profileId), [])
  const stableNewConversation = useCallback(() => newConversationHandlerRef.current(), [])
  const stableConversation = useCallback((conversation: MessengerConversationDto) => conversationHandlerRef.current(conversation), [])
  const seenNotificationIds = useRef(new Set<string>())
  const destinationScrollPositionsRef = useRef<Partial<Record<PrimaryDestination, number>>>({})
  const destinationViewportRef = useRef<HTMLDivElement>(null)
  const overlayContentSeedRef = useRef<{ viewerId: string; contentId: string; post: GatewayPost } | null>(null)
  const overlayClosePendingRef = useRef(false)
  const closeOverlayRef = useRef<() => void>(() => undefined)
  const lastFriendsSectionRef = useRef(normalizeFriendSection(isFriendsRoute ? pathSegment(location.pathname, 1) : null))
  const lastReelModeRef = useRef(normalizeReelMode(isReelsRoute ? pathSegment(location.pathname, 1) : null))

  useEffect(() => {
    if (!activePrimaryDestination) return
    setMountedDestinations((current) => {
      if (current.has(activePrimaryDestination)) return current
      const next = new Set(current)
      next.add(activePrimaryDestination)
      return next
    })
  }, [activePrimaryDestination])

  useEffect(() => {
    const canonicalHref = normalizeLegacyOverlayHref(browserLocation)
    if (!canonicalHref || overlayRoute) return
    const canonicalRoute = parseOverlayRoute(locationFromHref(canonicalHref))
    if (!canonicalRoute) return
    const state: FakebookOverlayHistoryState = {
      fakebookOverlay: { backgroundHref: fallbackBackgroundHref(canonicalRoute), returnWithBack: false },
    }
    navigate(canonicalHref, { replace: true, state })
  }, [browserLocation, navigate, overlayRoute])

  useEffect(() => {
    overlayClosePendingRef.current = false
  }, [browserLocation.pathname, browserLocation.search])

  useEffect(() => {
    if (overlayRoute?.kind !== 'content') return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      closeOverlayRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [overlayRoute?.kind])

  useEffect(() => {
    if (overlayRoute) return
    setReelSeed(null)
    setPhotoSeed(null)
  }, [overlayRoute])

  useEffect(() => {
    if (!isReelsRoute) return
    const nextMode = normalizeReelMode(pathSegment(location.pathname, 1))
    setMountedReelModes((current) => {
      if (current.has(nextMode)) return current
      const next = new Set(current)
      next.add(nextMode)
      return next
    })
  }, [isReelsRoute, location.pathname])

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('authenticated-shell-scroll')
    document.body.classList.add('authenticated-shell-scroll')
    return () => {
      root.classList.remove('authenticated-shell-scroll')
      document.body.classList.remove('authenticated-shell-scroll')
    }
  }, [])

  useLayoutEffect(() => {
    if (!activePrimaryDestination) return
    setDestinationScrollTop(destinationViewportRef.current, destinationScrollPositionsRef.current[activePrimaryDestination] ?? 0)
  }, [activePrimaryDestination])

  useLayoutEffect(() => {
    if (!secondaryDestinationRoute) return
    // Secondary destinations do not share the preserved Home/Friends/Reels/
    // Groups position. Their derived route stays unchanged while a media or
    // post overlay is open, so closing that overlay still preserves the page.
    setDestinationScrollTop(destinationViewportRef.current, 0)
  }, [secondaryDestinationRoute])

  useEffect(() => {
    if (!activePrimaryDestination) return
    const viewport = destinationViewportRef.current
    if (!viewport) return
    const capture = () => { destinationScrollPositionsRef.current[activePrimaryDestination] = viewport.scrollTop }
    viewport.addEventListener('scroll', capture, { passive: true })
    return () => viewport.removeEventListener('scroll', capture)
  }, [activePrimaryDestination])

  useEffect(() => {
    if (location.pathname === '/search') setSearchText(new URLSearchParams(location.search).get('q') ?? '')
  }, [location.pathname, location.search])

  useEffect(() => () => {
    if (quickCloseTimerRef.current !== null) window.clearTimeout(quickCloseTimerRef.current)
  }, [])

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
    if (!user || (!messengerPanelOpen && location.pathname !== '/messenger' && !isHomeRoute)) return
    if (friendsLoadedForUserRef.current === user.userId) return
    setFriends([])
    friendsLoadedForUserRef.current = user.userId
    socialApi.getRelationProfiles(user.userId, 0, 100)
      .then((profiles) => setFriends(profiles.map(toSummary)))
      .catch(() => {
        friendsLoadedForUserRef.current = null
        setFriends([])
      })
  }, [isHomeRoute, location.pathname, messengerPanelOpen, user])

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
  if (isFriendsRoute) lastFriendsSectionRef.current = normalizeFriendSection(pathSegment(location.pathname, 1))
  if (isReelsRoute) lastReelModeRef.current = normalizeReelMode(pathSegment(location.pathname, 1))
  const currentReelMode = lastReelModeRef.current
  const quickShellOpen = quickOpen || quickClosing
  const overlayContentId = overlayRoute?.kind === 'reel' ? overlayRoute.reelId : overlayRoute?.contentId
  if (!overlayContentId) {
    overlayContentSeedRef.current = null
  } else if (overlayContentSeedRef.current?.viewerId !== user.userId || overlayContentSeedRef.current.contentId !== overlayContentId) {
    const stagedPost = takeOverlayContent(user.userId, overlayContentId)
    overlayContentSeedRef.current = stagedPost ? { viewerId: user.userId, contentId: overlayContentId, post: stagedPost } : null
  }
  const cachedOverlayPost = overlayContentSeedRef.current?.post ?? null
  const cachedOverlayReel = cachedOverlayPost?.__typename === 'ReelDetail'
    ? gatewayReelToSocialContent(cachedOverlayPost)
    : null

  function resetQuickSearch() {
    if (quickCloseTimerRef.current !== null) window.clearTimeout(quickCloseTimerRef.current)
    quickCloseTimerRef.current = null
    setQuickClosing(false)
    setQuickOpen(false)
  }

  function openQuickSearch() {
    if (quickCloseTimerRef.current !== null) window.clearTimeout(quickCloseTimerRef.current)
    quickCloseTimerRef.current = null
    setQuickClosing(false)
    setQuickOpen(true)
  }

  function beginQuickSearchClose() {
    if (isGroupsRoute || isFriendsRoute) {
      resetQuickSearch()
      return
    }
    setQuickOpen(false)
    if (quickCloseTimerRef.current !== null) return
    setQuickClosing(true)
    quickCloseTimerRef.current = window.setTimeout(() => {
      quickCloseTimerRef.current = null
      setQuickClosing(false)
    }, 220)
  }

  function openOverlay(path: string) {
    const requestedLocation = locationFromHref(path)
    const canonicalHref = normalizeLegacyOverlayHref(requestedLocation) ?? path
    const requestedOverlay = parseOverlayRoute(locationFromHref(canonicalHref))
    if (!requestedOverlay) return false
    const backgroundHref = overlayBackgroundHref(browserLocation.state) ?? appHref(location)
    const state: FakebookOverlayHistoryState = {
      fakebookOverlay: {
        backgroundHref,
        returnWithBack: overlayRoute ? overlayReturnsWithBack(browserLocation.state) : true,
      },
    }
    navigate(canonicalHref, { replace: Boolean(overlayRoute), state })
    return true
  }

  function closeOverlay() {
    if (!overlayRoute || overlayClosePendingRef.current) return
    overlayClosePendingRef.current = true
    setReelSeed(null)
    setPhotoSeed(null)
    const backgroundHref = overlayBackgroundHref(browserLocation.state)
    if (backgroundHref && overlayReturnsWithBack(browserLocation.state)) {
      window.history.back()
      return
    }
    navigate(backgroundHref ?? fallbackBackgroundHref(overlayRoute), { replace: true, state: {} })
  }
  closeOverlayRef.current = closeOverlay

  function replaceMediaOverlay(contentId: string, mediaId: string) {
    if (overlayRoute?.kind !== 'media') return
    if (overlayRoute.contentId === contentId && overlayRoute.mediaId === mediaId) return
    navigate(mediaOverlayHref(contentId, mediaId), { replace: true, state: browserLocation.state })
  }

  function replaceReelOverlayAddress(reelId: string) {
    if (overlayClosePendingRef.current) return
    const currentOverlay = parseOverlayRoute(locationFromHref(`${window.location.pathname}${window.location.search}`))
    if (currentOverlay?.kind !== 'reel') return
    const nextHref = reelOverlayHref(reelId, currentOverlay.source, currentOverlay.ownerId)
    if (`${window.location.pathname}${window.location.search}` === nextHref) return
    window.history.replaceState(window.history.state, '', nextHref)
  }

  function closeNavigationSurfaces() {
    setMenuOpen(false)
    setAppsMenuOpen(false)
    setMessengerPanelOpen(false)
    setNotificationPanelOpen(false)
    setMenuView('root')
    resetQuickSearch()
  }

  function go(path: string) {
    if (activePrimaryDestination) destinationScrollPositionsRef.current[activePrimaryDestination] = destinationViewportRef.current?.scrollTop ?? 0
    closeNavigationSurfaces()
    const requestedLocation = locationFromHref(path)
    const requestedOverlay = parseOverlayRoute(locationFromHref(normalizeLegacyOverlayHref(requestedLocation) ?? path))
    if (requestedOverlay) {
      if (requestedOverlay.kind === 'media') setPhotoSeed(null)
      if (requestedOverlay.kind === 'reel') setReelSeed(null)
      openOverlay(path)
      return
    }
    setReelSeed(null)
    setPhotoSeed(null)
    navigate(path, overlayRoute ? { replace: true, state: {} } : undefined)
  }

  function openHomeReel(reel: GatewayReelPost) {
    setReelSeed(gatewayReelToSocialContent(reel))
    openOverlay(reelOverlayHref(reel.id))
  }

  function openSocialReel(reel: SocialContent) {
    setReelSeed(reel)
    openOverlay(reelOverlayHref(reel.id))
  }

  function openProfileReel(ownerId: string, reelId: string, reel?: SocialContent) {
    setReelSeed(reel ?? null)
    openOverlay(reelOverlayHref(reelId, 'profile', ownerId))
  }

  function openPhotoOverlay(post: GatewayPost, media: GatewayMedia, _index: number, initialPlaybackTime?: number) {
    setPhotoSeed({
      contentId: post.id,
      mediaId: media.id,
      mediaUrl: media.url,
      initialPost: post,
      initialPlaybackTime,
    })
    openOverlay(mediaOverlayHref(post.id, media.id))
  }

  function openProfilePhoto(viewer: ProfileMediaViewerState, options?: ProfileMediaViewerOpenOptions) {
    if (options?.update) {
      setPhotoSeed((current) => current && current.contentId === viewer.contentId
        ? { ...current, mediaEntries: viewer.entries }
        : current)
      return
    }
    setPhotoSeed({
      contentId: viewer.contentId,
      mediaId: viewer.mediaId,
      mediaUrl: viewer.mediaUrl,
      initialPlaybackTime: viewer.initialPlaybackTime,
      initialPost: viewer.initialPost,
      mediaEntries: viewer.entries,
      unavailableAuthor: viewer.unavailableAuthor,
    })
    openOverlay(mediaOverlayHref(viewer.contentId, viewer.mediaId))
  }

  function openGroupPhoto(viewer: GroupMediaViewerState) {
    setPhotoSeed({
      contentId: viewer.contentId,
      mediaId: viewer.media.id,
      mediaUrl: viewer.media.url,
      initialPlaybackTime: viewer.initialPlaybackTime,
      initialPost: viewer.initialPost,
    })
    openOverlay(mediaOverlayHref(viewer.contentId, viewer.media.id))
  }

  function goHome() {
    if (overlayRoute) {
      go('/home')
      return
    }
    const refreshCurrentHome = isHomeRoute
    if (refreshCurrentHome) {
      destinationScrollPositionsRef.current.home = 0
      setDestinationScrollTop(destinationViewportRef.current, 0)
      closeNavigationSurfaces()
      setReelSeed(null)
      setPhotoSeed(null)
      window.dispatchEvent(new Event(HOME_REFRESH_EVENT))
      return
    }
    go('/home')
  }

  function goReels() {
    if (isReelsRoute) {
      destinationScrollPositionsRef.current.reels = 0
      setDestinationScrollTop(destinationViewportRef.current, 0)
      setReelsRefreshToken((value) => value + 1)
    }
    go('/reels')
  }

  function goGroups() {
    if (location.pathname === '/groups') {
      destinationScrollPositionsRef.current.groups = 0
      setDestinationScrollTop(destinationViewportRef.current, 0)
      setGroupsRefreshToken((value) => value + 1)
    }
    go('/groups')
  }

  function runSearch() {
    const query = searchText.trim()
    if (query.length < 1) return
    go(`/search?q=${encodeURIComponent(query)}&tab=posts`)
  }

  function closeQuickSearch() {
    beginQuickSearchClose()
    searchInputRef.current?.blur()
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

  navigationHandlerRef.current = go
  homeReelHandlerRef.current = openHomeReel
  directMessageHandlerRef.current = openDirectMessage
  newConversationHandlerRef.current = () => { messengerDockRef.current?.openComposer() }
  conversationHandlerRef.current = (conversation) => { messengerDockRef.current?.openConversation(conversation) }

  return <div className={isGroupsRoute ? 'authenticated-app groups-route' : isFriendsRoute ? 'authenticated-app friends-route' : isSearchRoute ? 'authenticated-app search-results-route' : 'authenticated-app'}>
    <header className={overlayRoute?.kind === 'content' ? 'app-shell-topbar is-content-detail' : overlayRoute ? 'app-shell-topbar is-media-overlay' : 'app-shell-topbar'}>
      <div className="shell-brand-search-anchor">
        <div id={CONTENT_DETAIL_SHELL_CLOSE_TARGET_ID} className="content-detail-shell-left-controls">
          {overlayRoute?.kind === 'content' && <button type="button" className="content-detail-shell-close" aria-label={t('close')} onClick={closeOverlay}><Icon name="close" size={24} /></button>}
          {overlayRoute?.kind === 'media' && <button type="button" className="content-detail-shell-close post-photo-viewer-close" aria-label={t('close')} onClick={closeOverlay}><Icon name="close" size={24} /></button>}
        </div>
        <div className={quickShellOpen ? `shell-brand-search is-searching${quickClosing ? ' is-closing' : ''}${quickOpen && searchText.trim().length === 0 ? ' has-recent-empty' : ''}` : 'shell-brand-search'}>
        <span className={quickOpen ? 'shell-search-leading-slot is-searching' : 'shell-search-leading-slot'}>
          <button type="button" className="app-brand" onClick={goHome} aria-label={t('home')} aria-hidden={quickOpen} tabIndex={quickOpen ? -1 : 0}><img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" /></button>
          <button type="button" className="shell-search-back" onMouseDown={(event) => event.preventDefault()} onClick={closeQuickSearch} aria-label={t('back')} aria-hidden={!quickOpen} tabIndex={quickOpen ? 0 : -1}><svg className="shell-search-back-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H7M11.5 7.5 7 12l4.5 4.5" /></svg></button>
        </span>
        <form ref={searchRef} className={quickOpen ? 'shell-search-wrap is-active' : quickClosing ? 'shell-search-wrap is-closing' : 'shell-search-wrap'} onSubmit={submitSearch} onFocus={openQuickSearch} onKeyDown={(event) => { if (event.key === 'Escape') closeQuickSearch() }} onBlur={() => window.setTimeout(() => { if (!searchRef.current?.contains(document.activeElement)) beginQuickSearchClose() }, 0)}>
          <label className="shell-search"><svg className={`shell-search-glyph${quickOpen ? ' is-hidden' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10.25" cy="10.25" r="6.15" /><path d="m14.85 14.85 4.85 4.85" /></svg><span className="shell-search-responsive-placeholder" aria-hidden="true">{t('searchPlaceholder')}</span><input ref={searchInputRef} maxLength={INPUT_LIMITS.search} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} /></label>
          {quickOpen && <QuickSearchDropdown query={searchText.trim()} items={quickResults} loading={quickLoading} onOpen={openQuickResult} onSearchQuery={runSearch} />}
        </form>
        </div>
      </div>

      <nav className="app-shell-nav" aria-label={t('appNavigation')}>
        <NavButton icon="home" label={t('home')} active={isHomeRoute} onClick={goHome} />
        <NavButton icon="friends" label={t('friends')} active={location.pathname.startsWith('/friends')} onClick={() => go('/friends')} />
        <NavButton icon="video" label={t('reels')} active={isReelsRoute} onClick={goReels} />
        <NavButton icon="groups" label={t('groups')} active={isGroupsRoute} onClick={goGroups} />
      </nav>

      <div className="app-shell-actions">
        <div className="apps-menu-wrap" ref={appsMenuRef}><button type="button" className="icon-circle shell-menu-button" aria-label={t('menu')} title={t('menu')} aria-expanded={appsMenuOpen} onClick={() => setAppsMenuOpen((open) => !open)}><Icon name="menu" size={20} /></button>{appsMenuOpen && <AppsMenu onNavigate={go} />}</div>
        <button type="button" className={location.pathname === '/messenger' || messengerPanelOpen ? 'icon-circle shell-messenger-button active' : 'icon-circle shell-messenger-button'} aria-label={t('messages')} aria-expanded={messengerPanelOpen} onClick={() => { setMessengerPanelOpen((open) => !open); setMenuOpen(false); setAppsMenuOpen(false) }}><Icon name="messenger" size={20} /></button>
        <button type="button" className={notificationPanelOpen ? 'icon-circle shell-notification-button active badge-button' : 'icon-circle shell-notification-button badge-button'} aria-label={t('notifications')} aria-expanded={notificationPanelOpen} onClick={() => { setNotificationPanelOpen((open) => !open); setMessengerPanelOpen(false); setMenuOpen(false); setAppsMenuOpen(false) }}><Icon name="bell" size={20} />{unreadNotifications > 0 && <span>{Math.min(99, unreadNotifications)}</span>}</button>
        <div className="account-menu-wrap" ref={menuRef}>
          <button ref={menuTriggerRef} type="button" className="shell-avatar-button" aria-haspopup="dialog" aria-expanded={menuOpen} aria-label={displayName} onClick={() => { setMenuOpen((open) => !open); setMenuView('root') }}><Avatar name={displayName} src={avatarUrl} size={36} /></button>
          {menuOpen && <div className={`account-dropdown account-dropdown-${menuView}`} role="dialog" aria-label={t('accountMenu')}>
            {menuView === 'root' ? <>
              <div className="account-profile-card"><button type="button" onClick={() => go(`/profile/${user.userId}`)}><Avatar name={displayName} src={avatarUrl} size={58} /><span><strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span><VerifiedBadge verified={currentProfile?.isVerified} /></strong><small>{user.email}</small></span></button><button type="button" className="view-profile-link" onClick={() => go(`/profile/${user.userId}`)}>{t('seeYourProfile')}</button></div>
              <MenuItem icon="gift" label={t('premium')} detail={t('premiumMenuDesc')} onClick={() => go('/settings/premium')} />
              <MenuItem icon="settings" label={t('settingsPrivacy')} detail={t('settingsMenuDesc')} onClick={() => setMenuView('settings')} />
              <MenuItem icon="settings" label={t('settingsAppearance')} onClick={() => go('/settings/appearance')} />
              <MenuItem icon="logout" label={t('logout')} onClick={() => void logout()} />
              <p className="account-menu-footer">
                <a href="/privacy" onClick={(e) => { e.preventDefault(); go('/privacy') }} style={{ color: 'inherit', textDecoration: 'none' }}>{t('footerPrivacy') || (locale === 'vi' ? 'Quyền riêng tư' : 'Privacy')}</a> ·{' '}
                <a href="/policies/terms" onClick={(e) => { e.preventDefault(); go('/policies/terms') }} style={{ color: 'inherit', textDecoration: 'none' }}>{t('footerTerms') || (locale === 'vi' ? 'Điều khoản' : 'Terms')}</a> ·{' '}
                <a href="/policies/cookies" onClick={(e) => { e.preventDefault(); go('/policies/cookies') }} style={{ color: 'inherit', textDecoration: 'none' }}>{t('footerCookies') || (locale === 'vi' ? 'Cookie' : 'Cookies')}</a> ·{' '}
                Fakebook © 2026
              </p>
            </> : <SettingsSubmenu onBack={() => setMenuView('root')} onOpen={(section) => go(`/settings/${section}`)} />}
          </div>}
        </div>
      </div>
    </header>

    {notificationPanelOpen && <NotificationPopover items={notificationItems} unreadCount={unreadNotifications} loading={notificationsLoading} onOpen={(item) => void openNotification(item)} onMarkAll={() => void markAllNotificationsRead()} onClose={() => setNotificationPanelOpen(false)} />}

    <div ref={destinationViewportRef} className={`authenticated-destination-scroll${isReelsRoute ? ' is-reels' : location.pathname === '/messenger' ? ' is-messenger' : ''}`} data-testid="destination-scroll-root">
      <div className="authenticated-destination-content">
    {(activePrimaryDestination === 'home' || mountedDestinations.has('home')) && <ActivityVisibilityProvider active={activePrimaryDestination === 'home'}><Activity name="home-destination" mode={activePrimaryDestination === 'home' ? 'visible' : 'hidden'}><GatewayHomePage profile={currentProfile} friends={friends} onNavigate={stableNavigation} onOpenReel={stableHomeReel} onMessage={stableDirectMessage} onNewConversation={stableNewConversation} onConversation={stableConversation} /></Activity></ActivityVisibilityProvider>}
    {location.pathname === '/search' && <SearchPage query={location.params.get('q') ?? ''} tab={searchTab} userId={user.userId} onNavigate={go} onMessage={openDirectMessage} />}
    {(activePrimaryDestination === 'friends' || mountedDestinations.has('friends')) && <ActivityVisibilityProvider active={activePrimaryDestination === 'friends'}><Activity name="friends-destination" mode={activePrimaryDestination === 'friends' ? 'visible' : 'hidden'}><FriendsPage userId={user.userId} section={lastFriendsSectionRef.current} onNavigate={go} onOpenReel={openProfileReel} onOpenPhoto={openProfilePhoto} onMessage={openDirectMessage} /></Activity></ActivityVisibilityProvider>}
    {(activePrimaryDestination === 'reels' || mountedDestinations.has('reels')) && REEL_MODES.map((reelMode) => {
      if (!mountedReelModes.has(reelMode) && !(activePrimaryDestination === 'reels' && currentReelMode === reelMode)) return null
      const reelModeActive = activePrimaryDestination === 'reels' && currentReelMode === reelMode && overlayRoute?.kind !== 'reel'
      return <ActivityVisibilityProvider key={reelMode} active={reelModeActive}><Activity name={`reels-${reelMode}-destination`} mode={reelModeActive ? 'visible' : 'hidden'}><ReelsPage
        key={`reels-${reelMode}-${reelsRefreshToken}`}
        userId={user.userId}
        mode={reelMode}
        active={reelModeActive}
        entrySource={reelModeActive ? reelEntrySource : null}
        entryReelId={reelModeActive ? reelEntryId : null}
        entryOwnerId={reelModeActive ? reelEntryOwnerId : null}
        routeOverlays
        onOpenReelOverlay={openSocialReel}
        onEntryClose={() => reelEntrySource === 'profile' && reelEntryOwnerId ? go(`/profile/${reelEntryOwnerId}?tab=reels`) : go('/home')}
        onNavigate={go}
      /></Activity></ActivityVisibilityProvider>
    })}
    {(activePrimaryDestination === 'groups' || mountedDestinations.has('groups')) && <ActivityVisibilityProvider active={activePrimaryDestination === 'groups'}><Activity name="groups-destination" mode={activePrimaryDestination === 'groups' ? 'visible' : 'hidden'}><GroupsPage key={`groups-${groupsRefreshToken}`} userId={user.userId} profile={currentProfile} onNavigate={go} /></Activity></ActivityVisibilityProvider>}
    {groupId && <GroupProfilePage groupId={groupId} userId={user.userId} onBack={() => go('/groups')} onNavigate={go} onOpenReel={openHomeReel} onOpenPhoto={openGroupPhoto} />}
    {groupRouteId && groupMemberProfileId && <UserInGroupProfilePage groupId={groupRouteId} profileId={groupMemberProfileId} viewerId={user.userId} onBack={() => go(`/groups/${groupRouteId}`)} onNavigate={go} />}
    {profileId && <ProfilePage profile={viewedProfile} loading={profileLoading} error={profileError} canEdit={profileId === user.userId} viewerId={user.userId} initialTab={location.params.get('tab') === 'reels' ? 'reels' : undefined} onEdit={() => go('/settings/profile')} onNavigate={go} onOpenReel={openProfileReel} onOpenPhoto={openProfilePhoto} onMessage={openDirectMessage} />}
    {location.pathname === '/messenger' && <div className="shell-messenger"><MessengerPage me={{ id: user.userId, username: user.email.split('@')[0], displayName, avatarUrl, isVerified: currentProfile?.isVerified }} friends={friends} initialConversationId={location.params.get('conversation')} onOpenProfile={(id) => go(`/profile/${id}`)} onNavigate={go} /></div>}
    {location.pathname.startsWith('/saved') && <SavedPage userId={user.userId} section={normalizeSavedSection(pathSegment(location.pathname, 1))} onNavigate={go} />}
    {location.pathname.startsWith('/settings') && <SettingsPage initialSection={settingsSection} />}
    {location.pathname === '/premium' && <SettingsPage initialSection="premium" />}
    {location.pathname === '/premium/payment' && <SettingsPage initialSection="premium" />}
    {location.pathname.startsWith('/help') && <HelpPage onBack={() => go('/home')} />}
    {location.pathname.startsWith('/privacy') && <PrivacyPage onBack={() => go('/home')} />}
    {location.pathname === '/about' && <AboutPage onBack={() => go('/home')} />}
    {location.pathname.startsWith('/policies') && <PoliciesPage onBack={() => go('/home')} />}
    {!isKnownPath(location.pathname) && <main className="unknown-page"><div className="card state-card"><h1>{t('pageNotFound')}</h1><p>{t('pageNotFoundDesc')}</p><button className="btn-primary" onClick={() => go('/home')}>{t('backToHome')}</button></div></main>}
      </div>
    </div>
    {overlayRoute?.kind === 'content' && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><ContentDetailOverlay
      key={`overlay-content-${overlayRoute.contentId}`}
      viewerId={user.userId}
      contentId={overlayRoute.contentId}
      initialPost={cachedOverlayPost?.id === overlayRoute.contentId ? cachedOverlayPost : undefined}
      routeOwned
      onClose={closeOverlay}
      onNavigate={go}
      onMessage={openDirectMessage}
      onOpenImage={openPhotoOverlay}
      onOpenReel={openHomeReel}
    /></Suspense>}
    {overlayRoute?.kind === 'reel' && <ReelsPage
      key={`overlay-reel-${overlayRoute.source}-${overlayRoute.ownerId ?? ''}-${overlayBackground ?? fallbackBackgroundHref(overlayRoute)}`}
      userId={user.userId}
      mode="for-you"
      active
      entrySource={overlayRoute.source}
      entryReelId={overlayRoute.reelId}
      entryOwnerId={overlayRoute.ownerId}
      entryReel={reelSeed?.id === overlayRoute.reelId ? reelSeed : cachedOverlayReel?.id === overlayRoute.reelId ? cachedOverlayReel : null}
      routeOverlays
      onEntryClose={closeOverlay}
      onActiveReelAddressChange={replaceReelOverlayAddress}
      onNavigate={go}
    />}
    {overlayRoute?.kind === 'media' && <Suspense fallback={<div className="post-photo-viewer"><span className="spinner" /></div>}><PostPhotoViewer
      viewerId={user.userId}
      contentId={overlayRoute.contentId}
      initialMediaId={overlayRoute.mediaId}
      initialMediaUrl={photoSeed?.contentId === overlayRoute.contentId && photoSeed.mediaId === overlayRoute.mediaId ? photoSeed.mediaUrl : undefined}
      initialPlaybackTime={photoSeed?.contentId === overlayRoute.contentId && photoSeed.mediaId === overlayRoute.mediaId ? photoSeed.initialPlaybackTime : undefined}
      initialPost={photoSeed?.contentId === overlayRoute.contentId ? photoSeed.initialPost : cachedOverlayPost?.id === overlayRoute.contentId ? cachedOverlayPost : undefined}
      mediaEntries={photoSeed?.mediaEntries}
      unavailableAuthor={photoSeed?.unavailableAuthor}
      routeOwned
      onActiveMediaChange={replaceMediaOverlay}
      onClose={closeOverlay}
      onNavigate={go}
      onMessage={openDirectMessage}
    /></Suspense>}
    <MessengerDock ref={messengerDockRef} me={{ id: user.userId, username: user.email.split('@')[0], displayName, avatarUrl, isVerified: currentProfile?.isVerified }} friends={friends} panelOpen={messengerPanelOpen} hidden={location.pathname === '/messenger'} showComposeRail={isHomeRoute || isSearchRoute || location.pathname.startsWith('/friends') || isGroupsPath || Boolean(profileId)} layout={isReelsRoute || Boolean(overlayRoute) ? 'media-viewer' : 'default'} onPanelClose={() => setMessengerPanelOpen(false)} onOpenAll={(conversationId) => go(conversationId ? `/messenger?conversation=${encodeURIComponent(conversationId)}` : '/messenger')} onOpenProfile={(id) => go(`/profile/${id}`)} onNavigate={go} />
  </div>
}

function NotificationPopover({ items, unreadCount, loading, onOpen, onMarkAll, onClose }: { items: AppNotification[]; unreadCount: number; loading: boolean; onOpen: (item: AppNotification) => void; onMarkAll: () => void; onClose: () => void }) {
  const { t, locale } = useI18n()
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
        <span className="notification-avatar-wrap"><Avatar name={actorName} src={item.actor?.avatarUrl} size={50} /><NotificationKindIcon actionType={item.actionType} /></span>
        <span className="notification-popover-copy"><span><strong>{actorName}<VerifiedBadge verified={item.actor?.isVerified} size={12} /></strong> {notificationText(item.actionType, t)}</span><small>{relativeTime(item.createdAt, locale)}</small></span>
        {!item.isRead && <i />}
      </button>
    })}</div>
  </aside>
}

function NotificationKindIcon({ actionType }: { actionType: string }) {
  let icon: IconName = 'bell'
  let friendAction: FriendPersonAction | null = null
  let tone = 'activity'
  if (actionType === 'LIKE') { icon = 'like'; tone = 'like' }
  else if (actionType === 'COMMENT') { icon = 'comment'; tone = 'comment' }
  else if (actionType === 'FRIEND_REQUEST') { friendAction = 'add'; tone = 'friend' }
  else if (actionType === 'FRIEND_ACCEPT') { friendAction = 'check'; tone = 'friend' }
  else if (actionType.startsWith('GROUP_')) { tone = 'group' }
  else if (actionType === 'SHARE') { icon = 'share'; tone = 'share' }
  else if (actionType === 'TAG' || actionType === 'MENTION') { icon = 'tag'; tone = 'tag' }
  return <span className={`notification-kind-icon ${tone}`} aria-hidden="true">
    <span className="notification-kind-glyph">
      {friendAction
        ? <FriendPersonActionGlyph action={friendAction} size={16} />
        : tone === 'group'
          ? <GroupMembersIcon size={16} contentOffsetY={0} cutout="var(--notification-kind-bg, #2d88ff)" />
          : <Icon name={icon} size={16} />}
    </span>
  </span>
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

function QuickSearchDropdown({ query, items, loading, onOpen, onSearchQuery }: { query: string; items: QuickSearchItem[]; loading: boolean; onOpen: (item: QuickSearchItem) => void; onSearchQuery: () => void }) {
  const { t } = useI18n()
  return <div className={query.length === 0 ? 'quick-search-results is-recent-empty' : 'quick-search-results'}>{query.length === 0 ? <p className="quick-search-recent-empty">{t('noRecentSearches')}</p> : loading ? <div className="quick-search-state"><span className="spinner" /></div> : <>{items.map((item) => {
    const isUser = item.kind === 'user'
    const name = isUser ? item.profile.displayName : item.group.name
    const avatar = isUser ? item.profile.avatarUrl : item.group.avatarUrl
    const related = isUser ? item.viewerIsSelf || item.viewerIsFriend || item.viewerIsFollowing : item.viewerIsMember
    const detailParts = isUser
      ? [item.viewerIsSelf ? t('searchSelf') : item.viewerIsFriend ? t('friends') : item.viewerIsFollowing ? t('following') : t('searchPeople'), ...(!related && item.profile.followerCount > 0 ? [t('followersCount', { count: item.profile.followerCount })] : [])]
      : [item.viewerIsMember ? t('searchYourGroup') : item.group.privacy === 0 ? t('publicGroup') : t('privateGroup'), ...(item.group.memberCount == null ? [] : [t('membersCount', { count: item.group.memberCount })])]
    return <button type="button" className={related ? 'quick-search-result is-related' : 'quick-search-result is-discovery'} key={`${item.kind}-${item.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => onOpen(item)}>
      {related ? <Avatar className={isUser ? undefined : 'quick-search-group-avatar'} name={name} src={avatar} size={36} fallback={isUser ? 'avatar' : 'initials'} /> : <QuickSearchMarker />}
      <span className="quick-search-result-copy"><strong>{name}{isUser && <VerifiedBadge verified={item.profile.isVerified} />}</strong><small>{detailParts.join(' · ')}</small></span>
      {!related && <Avatar className={isUser ? undefined : 'quick-search-group-avatar'} name={name} src={avatar} size={36} fallback={isUser ? 'avatar' : 'initials'} />}
    </button>
  })}{items.length < 8 && <button type="button" className="quick-search-query-result" onMouseDown={(event) => event.preventDefault()} onClick={onSearchQuery}><QuickSearchMarker /><strong>{query}</strong></button>}</>}</div>
}

function QuickSearchMarker() {
  return <span className="quick-search-marker" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="5.8" /><path d="m14.8 14.8 3.4 3.4" /></svg></span>
}

function settingsSectionFor(pathname: string): SettingsSection {
  const value = pathSegment(pathname, 1) as SettingsSection | null
  return value && SETTINGS.has(value) ? value : 'overview'
}

function normalizeSearchTab(value: string | null): SearchTab {
  return value === 'people' || value === 'reels' || value === 'groups' ? value : 'posts'
}

function normalizeFriendSection(value: string | null): 'home' | 'friends' | 'incoming' | 'outgoing' | 'suggestions' | 'blocked' {
  return value === 'friends' || value === 'incoming' || value === 'outgoing' || value === 'suggestions' || value === 'blocked' ? value : 'home'
}

function normalizeReelMode(value: string | null): ReelMode {
  return value === 'following' || value === 'mine' || value === 'saved' || value === 'liked' || value === 'shared' || value === 'watched' ? value : 'for-you'
}

function normalizeSavedSection(value: string | null): SavedSection {
  return value === 'posts' || value === 'reels' ? value : 'all'
}

function primaryDestinationForPath(pathname: string): PrimaryDestination | null {
  if (pathname === '/' || pathname === '/home') return 'home'
  if (pathname.startsWith('/friends')) return 'friends'
  if (pathname.startsWith('/reels')) return 'reels'
  if (pathname === '/groups') return 'groups'
  return null
}

function setDestinationScrollTop(viewport: HTMLElement | null, value: number) {
  const top = Math.max(0, Number.isFinite(value) ? value : 0)
  if (viewport) viewport.scrollTop = top
}

function isKnownPath(pathname: string) {
  return pathname === DIRECT_OVERLAY_BACKGROUND_HREF || pathname === '/' || pathname === '/home' || pathname === '/search' || pathname === '/groups' || pathname === '/messenger' || pathname === '/saved' || pathname.startsWith('/saved/') || pathname === '/premium' || pathname === '/premium/payment' || ['/friends', '/reels', '/groups/', '/profile/', '/settings', '/content/', '/photo/', '/reel/', '/help', '/privacy', '/about', '/policies'].some((prefix) => pathname.startsWith(prefix))
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
    if (icon === 'home') return <HomeShellNavGlyph active />
    if (icon === 'friends') return <FriendPeopleGlyph className="shell-nav-glyph shell-nav-friend-glyph" filled />
    if (icon === 'video') return <ReelIcon className="shell-nav-glyph" size={24} filled dividerColor="var(--card)" />
    return <GroupShellNavGlyph active />
  }

  if (icon === 'home') return <HomeShellNavGlyph active={false} />
  if (icon === 'friends') return <FriendPeopleGlyph className="shell-nav-glyph shell-nav-friend-glyph" filled={false} />
  if (icon === 'video') return <ReelIcon className="shell-nav-glyph" size={24} />
  return <GroupShellNavGlyph active={false} />
}

function HomeShellNavGlyph({ active }: { active: boolean }) {
  return <svg className="shell-nav-glyph shell-nav-home-glyph" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke={active ? 'none' : 'currentColor'} strokeWidth={active ? undefined : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3.45 11.45q0-.9.7-1.5l6.8-5.9Q12 3.05 13.05 4.05l6.8 5.9q.7.6.7 1.5v8Q20.55 21.05 18.95 21.05H14.4V15.7q0-.75-.75-.75h-3.3q-.75 0-.75.75v5.35H5.05q-1.6 0-1.6-1.6v-8Z" />
  </svg>
}

function GroupShellNavGlyph({ active }: { active: boolean }) {
  return <svg className="shell-nav-glyph shell-nav-group-glyph" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <defs><clipPath id="shell-group-nav-clip"><circle cx="12" cy="12" r="10" /></clipPath></defs>
    {active
      ? <g clipPath="url(#shell-group-nav-clip)"><circle cx="12" cy="8.2" r="2.35" /><circle cx="3.15" cy="10.3" r="2.75" /><circle cx="20.85" cy="10.3" r="2.75" /><path d="M5.6 20.25c.42-4.45 2.76-7.08 6.4-7.08s5.98 2.63 6.4 7.08V24H5.6Z" /></g>
      : <g clipPath="url(#shell-group-nav-clip)"><circle cx="12" cy="8.2" r="2.35" /><circle cx="3.15" cy="10.3" r="2.75" /><circle cx="20.85" cy="10.3" r="2.75" /><path d="M5.6 20.25c.42-4.45 2.76-7.08 6.4-7.08s5.98 2.63 6.4 7.08" /></g>}
    <circle cx="12" cy="12" r="10" fill="none" />
  </svg>
}

function NavButton({ icon, label, active, onClick }: { icon: ShellNavIcon; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? 'active' : ''} onClick={onClick} aria-label={label} title={label}><ShellNavGlyph icon={icon} active={active} /><span>{label}</span></button>
}

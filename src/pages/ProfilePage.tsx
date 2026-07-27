import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { GatewayPost, GatewayStory, StoryBucket } from '../api/gatewayTypes'
import type { MediaUpload } from '../api/types'
import { socialApi, type ProfileRelationshipState, type SocialContent, type SocialGroup, type SocialPhoto, type SocialProfile } from '../api/social'
import { searchApi } from '../api/search'
import { Avatar } from '../components/Avatar'
import { ImageCropModal } from '../components/ImageCropModal'
import { Icon } from '../components/Icon'
import { SharedStoryMiniPreview } from '../components/SharedStoryMiniPreview'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { readDefaultPostPrivacy } from '../lib/privacy'
import { decodeStoryContent } from '../lib/storyContent'
import { GatewayPostCard, PostComposer } from './GatewayHomePage'

const StoryViewerPage = lazy(() => import('../components/StoryViewerPage').then((module) => ({ default: module.StoryViewerPage })))
const StoryCreatorModal = lazy(() => import('../components/StoryCreatorModal').then((module) => ({ default: module.StoryCreatorModal })))

const EMPTY_RELATIONSHIP: ProfileRelationshipState = {
  friendship: 'none',
  isFollowing: false,
  followsViewer: false,
  isBlocked: false,
  isBlockedBy: false,
}

type ProfileTab = 'posts' | 'about' | 'friends' | 'photos' | 'reels' | 'groups'
type ProfilePostFilter = 'all' | 'media' | 'text'
type ProfilePostView = 'list' | 'grid'

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : story.sharedSource.media
}

function formatProfileBirthDate(value: string | null, locale: string) {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

type ProfileZodiac = {
  id: 'capricorn' | 'aquarius' | 'pisces' | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo' | 'libra' | 'scorpio' | 'sagittarius'
  symbol: string
}

function getProfileZodiac(value: string | null): ProfileZodiac | null {
  if (!value) return null
  const [, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null

  const signs: Record<ProfileZodiac['id'], ProfileZodiac> = {
    capricorn: { id: 'capricorn', symbol: '♑' },
    aquarius: { id: 'aquarius', symbol: '♒' },
    pisces: { id: 'pisces', symbol: '♓' },
    aries: { id: 'aries', symbol: '♈' },
    taurus: { id: 'taurus', symbol: '♉' },
    gemini: { id: 'gemini', symbol: '♊' },
    cancer: { id: 'cancer', symbol: '♋' },
    leo: { id: 'leo', symbol: '♌' },
    virgo: { id: 'virgo', symbol: '♍' },
    libra: { id: 'libra', symbol: '♎' },
    scorpio: { id: 'scorpio', symbol: '♏' },
    sagittarius: { id: 'sagittarius', symbol: '♐' },
  }
  const monthSigns: Array<[number, ProfileZodiac['id'], ProfileZodiac['id']]> = [
    [19, 'capricorn', 'aquarius'],
    [18, 'aquarius', 'pisces'],
    [20, 'pisces', 'aries'],
    [19, 'aries', 'taurus'],
    [20, 'taurus', 'gemini'],
    [20, 'gemini', 'cancer'],
    [22, 'cancer', 'leo'],
    [22, 'leo', 'virgo'],
    [22, 'virgo', 'libra'],
    [22, 'libra', 'scorpio'],
    [21, 'scorpio', 'sagittarius'],
    [21, 'sagittarius', 'capricorn'],
  ]
  const [lastDay, before, after] = monthSigns[month - 1]
  return signs[day <= lastDay ? before : after]
}

export function ProfilePage({ profile, loading, error, canEdit, viewerId, onEdit, onNavigate, onMessage }: { profile: SocialProfile | null; loading: boolean; error: string | null; canEdit: boolean; viewerId: string; onEdit: () => void; onNavigate: (path: string) => void; onMessage: (profileId: string) => Promise<void> }) {
  const { t, locale } = useI18n()
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsUnavailable, setPostsUnavailable] = useState(false)
  const [tab, setTab] = useState<ProfileTab>('posts')
  const [profileFriends, setProfileFriends] = useState<SocialProfile[]>([])
  const [profileFriendMutualCounts, setProfileFriendMutualCounts] = useState<Record<string, number>>({})
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [photos, setPhotos] = useState<SocialPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosHaveMore, setPhotosHaveMore] = useState(false)
  const [profileGroups, setProfileGroups] = useState<SocialGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [groupsUnavailable, setGroupsUnavailable] = useState(false)
  const [myStories, setMyStories] = useState<StoryBucket | null>(null)
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false)
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)
  const [postFilter, setPostFilter] = useState<ProfilePostFilter>('all')
  const [postView, setPostView] = useState<ProfilePostView>('list')
  const [manageMode, setManageMode] = useState(false)
  const [relationship, setRelationship] = useState<ProfileRelationshipState>(EMPTY_RELATIONSHIP)
  const [relationshipLoading, setRelationshipLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [coverMenuOpen, setCoverMenuOpen] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [coverCandidates, setCoverCandidates] = useState<SocialPhoto[]>([])
  const [coverCandidatesLoading, setCoverCandidatesLoading] = useState(false)
  const [coverPickerError, setCoverPickerError] = useState<string | null>(null)
  const [coverCropTarget, setCoverCropTarget] = useState<{ file: File; fromExisting: boolean } | null>(null)
  const coverActionRef = useRef<HTMLDivElement>(null)
  const coverUploadInputRef = useRef<HTMLInputElement>(null)
  const profilePageRef = useRef<HTMLElement>(null)
  const profileTabsRef = useRef<HTMLElement>(null)
  const profileFirstTabRef = useRef<HTMLButtonElement>(null)
  const profileGroupsTabRef = useRef<HTMLButtonElement>(null)
  const profileContentGridRef = useRef<HTMLDivElement>(null)
  const profileInfoColumnRef = useRef<HTMLElement>(null)
  const profilePostColumnRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!canEdit) return
    document.documentElement.classList.add('profile-page-scroll')
    document.body.classList.add('profile-page-scroll')
    return () => {
      document.documentElement.classList.remove('profile-page-scroll')
      document.body.classList.remove('profile-page-scroll')
    }
  }, [canEdit])

  useLayoutEffect(() => {
    if (!canEdit || loading || !profile) return
    const tabs = profileTabsRef.current
    const firstTab = profileFirstTabRef.current
    const groupsTab = profileGroupsTabRef.current
    const grid = profileContentGridRef.current
    if (!tabs || !firstTab || !groupsTab || !grid) return

    let disposed = false
    const alignColumnsToTabs = () => {
      if (disposed) return
      if (window.innerWidth <= 980) {
        grid.style.removeProperty('--self-profile-left-column-width')
        return
      }
      const firstRect = firstTab.getBoundingClientRect()
      const groupsRect = groupsTab.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      const measuredWidth = groupsRect.right - gridRect.left
      const tabSpan = groupsRect.right - firstRect.left
      if (measuredWidth <= 0 || tabSpan <= 0 || gridRect.width <= 0) return
      const columnGap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0
      const maxWidth = Math.max(0, gridRect.width - columnGap - 280)
      const alignedWidth = Math.min(measuredWidth, maxWidth)
      grid.style.setProperty('--self-profile-left-column-width', `${Math.round(alignedWidth * 100) / 100}px`)
    }

    alignColumnsToTabs()
    window.addEventListener('resize', alignColumnsToTabs)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(alignColumnsToTabs)
    observer?.observe(tabs)
    observer?.observe(firstTab)
    observer?.observe(groupsTab)
    observer?.observe(grid)
    void document.fonts?.ready.then(alignColumnsToTabs)
    return () => {
      disposed = true
      window.removeEventListener('resize', alignColumnsToTabs)
      observer?.disconnect()
      grid.style.removeProperty('--self-profile-left-column-width')
    }
  }, [canEdit, loading, locale, profile])

  useEffect(() => {
    if (!canEdit || tab !== 'posts') return
    const page = profilePageRef.current
    const grid = profileContentGridRef.current
    const infoColumn = profileInfoColumnRef.current
    const postColumn = profilePostColumnRef.current
    if (!page || !grid || !infoColumn || !postColumn) return
    const columns = [infoColumn, postColumn]
    columns.forEach((column) => { column.scrollTop = 0 })

    const pageScrollTop = () => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    const pageScrollLimit = () => Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight)
    const scrollPageTo = (top: number) => window.scrollTo({ top: Math.max(0, top), left: window.scrollX, behavior: 'auto' })
    const columnLimit = (column: HTMLElement) => Math.max(0, column.scrollHeight - column.clientHeight)
    const scrollColumnsBy = (delta: number) => {
      columns.forEach((column) => {
        column.scrollTop = Math.min(columnLimit(column), Math.max(0, column.scrollTop + delta))
      })
    }
    const nestedScrollableCanMove = (target: EventTarget | null, delta: number) => {
      let node = target instanceof HTMLElement ? target : null
      while (node && node !== page && !columns.includes(node)) {
        const overflowY = window.getComputedStyle(node).overflowY
        const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight)
        if ((overflowY === 'auto' || overflowY === 'scroll') && maxScroll > 0) {
          if ((delta > 0 && node.scrollTop < maxScroll) || (delta < 0 && node.scrollTop > 0)) return true
        }
        node = node.parentElement
      }
      return false
    }
    const clampColumns = () => columns.forEach((column) => {
      column.scrollTop = Math.min(columnLimit(column), Math.max(0, column.scrollTop))
    })

    let pendingDelta = 0
    let animationFrame: number | null = null
    let lastFrameTime = 0
    const routeAnimatedStep = (delta: number) => {
      if (delta > 0) {
        let remaining = delta
        let consumed = 0
        const pageTop = pageScrollTop()
        const pageStep = Math.min(remaining, Math.max(0, pageScrollLimit() - pageTop))
        if (pageStep > 0) {
          scrollPageTo(pageTop + pageStep)
          remaining -= pageStep
          consumed += pageStep
        }
        const columnStep = Math.min(remaining, Math.max(...columns.map((column) => columnLimit(column) - column.scrollTop)))
        if (columnStep > 0) {
          scrollColumnsBy(columnStep)
          consumed += columnStep
        }
        return consumed
      }

      let remaining = -delta
      let consumed = 0
      const columnStep = Math.min(remaining, Math.max(...columns.map((column) => column.scrollTop)))
      if (columnStep > 0) {
        scrollColumnsBy(-columnStep)
        remaining -= columnStep
        consumed += columnStep
      }
      const pageTop = pageScrollTop()
      const pageStep = Math.min(remaining, pageTop)
      if (pageStep > 0) {
        scrollPageTo(pageTop - pageStep)
        consumed += pageStep
      }
      return -consumed
    }
    const stopAnimation = () => {
      pendingDelta = 0
      if (animationFrame != null) window.cancelAnimationFrame(animationFrame)
      animationFrame = null
      lastFrameTime = 0
    }
    const animateColumns = (timestamp: number) => {
      animationFrame = null
      const magnitude = Math.abs(pendingDelta)
      if (magnitude < .35) {
        if (magnitude > .01) routeAnimatedStep(pendingDelta)
        pendingDelta = 0
        lastFrameTime = 0
        return
      }
      const elapsed = lastFrameTime === 0 ? 16.67 : Math.min(32, Math.max(1, timestamp - lastFrameTime))
      lastFrameTime = timestamp
      const easing = 1 - Math.exp(-elapsed / 22)
      const frameLimit = 96 * elapsed / 16.67
      const stepMagnitude = Math.min(frameLimit, Math.max(.35, magnitude * easing))
      const step = Math.sign(pendingDelta) * stepMagnitude
      const consumed = routeAnimatedStep(step)
      if (Math.abs(consumed) < .01 || Math.abs(consumed) + .01 < Math.abs(step)) {
        pendingDelta = 0
        lastFrameTime = 0
        return
      }
      pendingDelta -= consumed
      animationFrame = window.requestAnimationFrame(animateColumns)
    }
    const queueColumnDelta = (delta: number) => {
      if (pendingDelta !== 0 && Math.sign(pendingDelta) !== Math.sign(delta)) pendingDelta = 0
      pendingDelta = Math.max(-720, Math.min(720, pendingDelta + delta))
      if (animationFrame == null) animationFrame = window.requestAnimationFrame(animateColumns)
    }

    const routeWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * window.innerHeight
          : event.deltaY
      if (Math.abs(delta) < .01) return
      if (nestedScrollableCanMove(event.target, delta)) {
        stopAnimation()
        return
      }

      event.preventDefault()
      queueColumnDelta(delta)
    }

    page.addEventListener('wheel', routeWheel, { passive: false })
    const handleResize = () => {
      stopAnimation()
      clampColumns()
    }
    window.addEventListener('resize', handleResize)
    return () => {
      stopAnimation()
      page.removeEventListener('wheel', routeWheel)
      window.removeEventListener('resize', handleResize)
    }
  }, [canEdit, profile?.id, tab])

  useEffect(() => {
    setTab('posts')
    setPostFilter('all')
    setPostView('list')
    setManageMode(false)
    setProfileFriends([])
    setPhotos([])
    setProfileGroups([])
    setGroupsLoading(false)
    setGroupsLoaded(false)
    setGroupsUnavailable(false)
    setMyStories(null)
    setCoverMenuOpen(false)
    setCoverPickerOpen(false)
    setCoverCandidates([])
    setCoverPickerError(null)
    setCoverCropTarget(null)
  }, [profile?.id])

  useEffect(() => {
    if (!coverMenuOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!coverActionRef.current?.contains(event.target as Node)) setCoverMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCoverMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [coverMenuOpen])

  useEffect(() => {
    if (!profile?.id) return
    let active = true
    setPostsLoading(true)
    setPostsUnavailable(false)
    socialApi.getProfilePosts(profile.id, 20).then((page) => active && setPosts(page.items)).catch(() => active && setPostsUnavailable(true)).finally(() => active && setPostsLoading(false))
    return () => { active = false }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id || canEdit) {
      setRelationship(EMPTY_RELATIONSHIP)
      return
    }
    let active = true
    setRelationshipLoading(true)
    setActionError(null)
    socialApi.getProfileRelationshipState(viewerId, profile.id).then((state) => active && setRelationship(state)).catch(() => active && setActionError(t('relationshipLoadError'))).finally(() => active && setRelationshipLoading(false))
    return () => { active = false }
  }, [canEdit, profile?.id, t, viewerId])

  useEffect(() => {
    if (!profile?.id || !canEdit) return
    let active = true
    setFriendsLoading(true)
    void (async () => {
      try {
        const items = await socialApi.getFriendProfilesWithMutualCounts(profile.id, 100)
        if (!active) return
        setProfileFriends(items.map((item) => item.profile))
        setProfileFriendMutualCounts(Object.fromEntries(items.map((item) => [item.profile.id, item.mutualFriendCount])))
      } catch {
        try {
          const fallbackProfiles = await socialApi.getRelationProfiles(profile.id, 0, 100)
          if (!active) return
          setProfileFriends(fallbackProfiles)
          setProfileFriendMutualCounts({})
        } catch {
          if (!active) return
          setProfileFriends([])
          setProfileFriendMutualCounts({})
          setActionError(t('friendsLoadError'))
        }
      } finally {
        if (active) setFriendsLoading(false)
      }
    })()
    return () => { active = false }
  }, [canEdit, profile?.id, t])

  const loadPhotos = useCallback(async (cursor: string | null = null, append = false, limit = 60) => {
    if (!profile?.id) return
    setPhotosLoading(true)
    try {
      const page = await socialApi.getUserPhotos(profile.id, limit, cursor)
      setPhotos((current) => append ? [...current, ...page.items] : page.items)
      setPhotosHaveMore(page.hasNextPage)
    } catch {
      if (!append) setPhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (!canEdit || photos.length > 0) return
    void loadPhotos(null, false, 9)
  }, [canEdit, loadPhotos, photos.length])

  useEffect(() => {
    if (tab !== 'groups' || !profile?.id || groupsLoaded) return
    let active = true
    setGroupsLoading(true)
    setGroupsUnavailable(false)
    socialApi.getMemberGroups(profile.id, 60).then((page) => {
      if (!active) return
      setProfileGroups(page.items)
      setGroupsLoaded(true)
    }).catch(() => {
      if (!active) return
      setProfileGroups([])
      setGroupsUnavailable(true)
      setGroupsLoaded(true)
    }).finally(() => active && setGroupsLoading(false))
    return () => { active = false }
  }, [groupsLoaded, profile?.id, tab])

  useEffect(() => {
    if (!canEdit || !profile?.id) {
      setMyStories(null)
      return
    }
    let active = true
    api.myStories(profile.id).then((bucket) => active && setMyStories(bucket)).catch(() => active && setMyStories(null))
    return () => { active = false }
  }, [canEdit, profile?.id])

  const filteredPosts = useMemo(() => posts.filter((post) => {
    const sharedMedia = post.__typename === 'FeedPostDetail' ? post.sharedSource?.media ?? [] : []
    const hasMedia = post.media.length > 0 || sharedMedia.length > 0
    return postFilter === 'all' || (postFilter === 'media' ? hasMedia : !hasMedia)
  }), [postFilter, posts])

  async function friendAction(action: 'send' | 'cancel' | 'accept' | 'reject' | 'unfriend') {
    if (!profile) return
    setBusyAction(action)
    setActionError(null)
    try {
      const success = action === 'send'
        ? await socialApi.sendFriendRequest(viewerId, profile.id)
        : action === 'cancel'
          ? await socialApi.cancelFriendRequest(viewerId, profile.id)
          : action === 'accept'
            ? await socialApi.acceptFriendRequest(profile.id, viewerId)
            : action === 'reject'
              ? await socialApi.rejectFriendRequest(profile.id, viewerId)
              : await socialApi.unfriend(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({
        ...current,
        friendship: action === 'send' ? 'outgoing' : action === 'accept' ? 'friend' : 'none',
        isFollowing: action === 'accept' ? false : current.isFollowing,
      }))
    } catch {
      setActionError(t('friendActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function followAction() {
    if (!profile) return
    const next = !relationship.isFollowing
    setBusyAction('follow')
    setActionError(null)
    try {
      const success = next
        ? await socialApi.followUser(viewerId, profile.id)
        : await socialApi.unfollowUser(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({ ...current, isFollowing: next }))
    } catch {
      setActionError(t('followActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function messageAction() {
    if (!profile) return
    setBusyAction('message')
    setActionError(null)
    try {
      await onMessage(profile.id)
    } catch {
      setActionError(t('messageActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function blockAction() {
    if (!profile) return
    const next = !relationship.isBlocked
    setBusyAction('block')
    setActionError(null)
    try {
      const success = next
        ? await socialApi.blockUser(viewerId, profile.id)
        : await socialApi.unblockUser(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({
        ...current,
        isBlocked: next,
        friendship: next ? 'none' : current.friendship,
        isFollowing: next ? false : current.isFollowing,
      }))
    } catch {
      setActionError(t('blockActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function openCoverPicker() {
    if (!profile) return
    setCoverMenuOpen(false)
    setCoverPickerOpen(true)
    setCoverCandidatesLoading(true)
    setCoverPickerError(null)
    try {
      const page = await socialApi.getMyFeedPhotoCandidates(60)
      setCoverCandidates(page.items)
    } catch {
      setCoverCandidates([])
      setCoverPickerError(t('profileMediaLoadError'))
    } finally {
      setCoverCandidatesLoading(false)
    }
  }

  async function chooseExistingCover(photo: SocialPhoto) {
    setCoverPickerError(null)
    try {
      const response = await fetch(photo.media.url, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not fetch media')
      const blob = await response.blob()
      const extension = blob.type.split('/')[1] || 'jpg'
      setCoverCropTarget({ file: new File([blob], `fakebook-cover.${extension}`, { type: blob.type || 'image/jpeg' }), fromExisting: true })
      setCoverPickerOpen(false)
    } catch {
      setCoverPickerError(t('existingPhotoLoadError'))
    }
  }

  async function saveCroppedCover(original: File, cropped: File) {
    if (!profile || !coverCropTarget) return
    let uploads: MediaUpload[] = []
    let persisted = false
    try {
      uploads = await api.uploadMediaFiles(coverCropTarget.fromExisting ? [cropped] : [original, cropped])
      const originalUpload = coverCropTarget.fromExisting ? null : uploads[0]
      const croppedUpload = uploads[uploads.length - 1]
      const updated = await socialApi.changeUserBackground(profile.id, croppedUpload.url, originalUpload?.url ?? null, readDefaultPostPrivacy(profile.id))
      if (!updated) throw new Error('Profile cover update failed')
      persisted = true
      setCoverCropTarget(null)
      setActionError(null)
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
    } catch (error) {
      if (!persisted) await Promise.allSettled(uploads.map((item) => api.cancelPendingMedia(item)))
      throw error
    }
  }

  if (loading) return <main className="profile-destination"><div className="card state-card"><span className="spinner" /></div></main>
  if (!profile) return <main className="profile-destination"><div className="card state-card"><h2>{t('profileUnavailable')}</h2><p>{error || t('profileLoadError')}</p></div></main>

  const coverStyle = profile.backgroundUrl ? { backgroundImage: `url(${profile.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
  const selfProfileStats = canEdit ? [
    { id: 'friends', count: profile.friendCount, label: t('profileFriendStat', { count: profile.friendCount }) },
    { id: 'followers', count: profile.followerCount, label: t('profileFollowerStat', { count: profile.followerCount }) },
    { id: 'following', count: profile.followingCount, label: t('profileFollowingStat', { count: profile.followingCount }) },
  ].filter((item) => item.count > 0) : []
  const profileBirthDate = formatProfileBirthDate(profile.birthDate, locale)
  const profileZodiac = getProfileZodiac(profile.birthDate)
  const profileGender = profile.gender === 'male'
    ? t('genderMale')
    : profile.gender === 'female'
      ? t('genderFemale')
      : profile.gender === 'custom'
        ? t('genderCustom')
        : t('genderPreferNot')

  return <>
    <main ref={profilePageRef} className={canEdit ? 'profile-destination self-profile-page' : 'profile-destination'}>
      <section className={canEdit ? 'profile-cover-card self-profile-cover-card' : 'profile-cover-card'}>
        {canEdit && <div className="self-profile-cover-ambient" style={coverStyle} aria-hidden="true" />}
        <div className={canEdit ? 'self-profile-header-shell' : undefined}>
          <div className="profile-cover" style={coverStyle}>
            {canEdit && <div className="self-profile-cover-action" ref={coverActionRef}>
              <button type="button" className="self-profile-edit-cover" aria-haspopup="menu" aria-expanded={coverMenuOpen} onClick={() => setCoverMenuOpen((open) => !open)}><ProfileCoverCameraIcon />{t(profile.backgroundUrl ? 'profileEditCover' : 'profileAddCover')}</button>
              {coverMenuOpen && <div className="self-profile-cover-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => void openCoverPicker()}><ProfileCoverPhotoIcon />{t('profileChooseCover')}</button>
                <button type="button" role="menuitem" onClick={() => { setCoverMenuOpen(false); coverUploadInputRef.current?.click() }}><ProfileCoverUploadIcon />{t('profileUploadCover')}</button>
              </div>}
              <input ref={coverUploadInputRef} className="self-profile-cover-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  setCoverMenuOpen(false)
                  setCoverCropTarget({ file, fromExisting: false })
                }
                event.currentTarget.value = ''
              }} />
            </div>}
          </div>
          <div className="profile-destination-header">
            {canEdit ? <div className={myStories?.stories.length ? 'self-profile-avatar-wrap has-story' : 'self-profile-avatar-wrap no-story'}><Avatar name={profile.displayName} src={profile.avatarUrl} size={138} /><button type="button" aria-label={t('profileEditAvatar')} onClick={onEdit}><ProfileCoverCameraIcon /></button></div> : <Avatar name={profile.displayName} src={profile.avatarUrl} size={164} />}
            <div className="profile-destination-title">
              <h1>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={canEdit ? 17 : 20} /></h1>
              {canEdit ? <div className="self-profile-summary-copy">
                {selfProfileStats.length > 0 && <div className="self-profile-summary-line self-profile-stats">{selfProfileStats.map((item) => <span key={item.id}>{item.label}</span>)}</div>}
                {profile.bio && <p className="self-profile-summary-line self-profile-detail-line"><ProfileBioIcon /><span>{profile.bio}</span></p>}
                {profile.location && <p className="self-profile-summary-line self-profile-detail-line"><Icon className="self-profile-summary-icon" name="location" size={15} /><span>{profile.location}</span></p>}
              </div> : <><p>{profile.friendCount} {t('friends')} · {profile.followerCount} {t('followers')}</p>{relationship.followsViewer && <small>{t('followsYou')}</small>}</>}
            </div>
            {canEdit ? <div className="self-profile-header-actions">
              <button type="button" className="btn-primary" onClick={() => setStoryCreatorOpen(true)}><ProfileAddStoryIcon />{t('profileAddStory')}</button>
              <button type="button" className="btn-soft" onClick={onEdit}><Icon name="edit" size={17} />{t('profileEditPage')}</button>
              <button type="button" className="btn-soft self-profile-header-chevron" aria-label={t('more')} onClick={() => undefined}><ProfileHeaderChevronIcon /></button>
            </div> : <ProfileActions profile={profile} relationship={relationship} loading={relationshipLoading} busyAction={busyAction} onFriend={friendAction} onFollow={followAction} onBlock={blockAction} onMessage={messageAction} />}
          </div>
          {actionError && <p className="inline-alert profile-action-error">{actionError}</p>}
          <nav ref={profileTabsRef} className={canEdit ? 'profile-tabs self-profile-tabs' : 'profile-tabs'}>
            {canEdit ? <>
              <button ref={profileFirstTabRef} type="button" className={`self-profile-tab-option${tab === 'posts' ? ' active' : ''}`} onClick={() => setTab('posts')}>{t('profileTabAll')}</button>
              <button type="button" className={`self-profile-tab-option${tab === 'about' ? ' active' : ''}`} onClick={() => setTab('about')}>{t('profileTabAbout')}</button>
              <button type="button" className={`self-profile-tab-option${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')}>{t('profileTabPhotos')}</button>
              <button type="button" className={`self-profile-tab-option${tab === 'friends' ? ' active' : ''}`} onClick={() => setTab('friends')}>{t('profileTabFriends')}</button>
              <button type="button" className={`self-profile-tab-option${tab === 'reels' ? ' active' : ''}`} onClick={() => setTab('reels')}>{t('profileTabReels')}</button>
              <button ref={profileGroupsTabRef} type="button" className={`self-profile-tab-option${tab === 'groups' ? ' active' : ''}`} onClick={() => setTab('groups')}>{t('profileTabGroups')}</button>
              <button type="button" className="self-profile-tab-more" aria-label={t('more')} onClick={() => undefined}><Icon name="more" size={20} /></button>
            </> : <>
              <button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>{t('postsLabel')}</button>
              <button type="button" className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>{t('about')}</button>
              <button type="button" className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>{t('friends')}</button>
              <button type="button" className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>{t('photos')}</button>
            </>}
          </nav>
        </div>
      </section>

      <div ref={profileContentGridRef} className={`profile-destination-grid${canEdit ? ` self-profile-destination-grid tab-${tab}` : ''}`}>
        {canEdit && tab === 'posts' ? <aside ref={profileInfoColumnRef} className="self-profile-left-column">
          <section className="card self-profile-side-card self-profile-intro-card">
            <div className="self-profile-info-section">
              <header><h2>{t('profilePersonalInfo')}</h2><button type="button" aria-label={t('editDetails')} onClick={onEdit}><ProfileInfoEditIcon /></button></header>
              <div className="self-profile-info-rows">
                {profile.location && <p className="prominent"><ProfileLocationIcon /><span>{t('livesIn', { location: profile.location })}</span></p>}
                {profileBirthDate && <p className="prominent"><ProfileZodiacIcon zodiac={profileZodiac} /><span>{t('profileBornLabel')} <time dateTime={profile.birthDate ?? undefined}>{profileBirthDate}</time></span></p>}
                <p className="prominent"><ProfileGenderIcon gender={profile.gender} /><span>{profileGender}</span></p>
              </div>
            </div>
            <div className="self-profile-info-section">
              <header><h2>{t('profileContactInfo')}</h2><button type="button" aria-label={t('editDetails')} onClick={onEdit}><ProfileInfoEditIcon /></button></header>
              <div className="self-profile-info-rows"><p><ProfileEmailIcon /><a href={`mailto:${profile.email}`}>{profile.email}</a></p></div>
            </div>
          </section>

          <section className="card self-profile-side-card self-profile-featured-card">
            <header><h2>{t('profileFeatured')}</h2></header>
            {myStories?.stories.length ? <div className="self-profile-featured-list">{myStories.stories.slice(0, 3).map((story) => <ProfileStoryTile key={story.id} story={story} onOpen={() => setStoryViewerOpen(true)} />)}</div> : <button type="button" className="self-profile-featured-empty" onClick={() => setStoryCreatorOpen(true)}>{t('profileAddFeatured')}</button>}
          </section>

          <section className="card self-profile-side-card self-profile-friends-card">
            <header><div><h2>{t('friends')}</h2><small>{t('profileFriendStat', { count: profile.friendCount })}</small></div><button type="button" onClick={() => setTab('friends')}>{t('profileViewAllFriends')}</button></header>
            {friendsLoading ? <div className="self-profile-side-loading"><span className="spinner" /></div> : <div className="self-profile-friend-preview">{profileFriends.slice(0, 9).map((friend) => <button type="button" key={friend.id} onClick={() => onNavigate(`/profile/${friend.id}`)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={96} /><strong>{friend.displayName}</strong>{(profileFriendMutualCounts[friend.id] ?? 0) > 0 && <small>{t('mutualFriendsCount', { count: profileFriendMutualCounts[friend.id] })}</small>}</button>)}</div>}
          </section>

          <section className="card self-profile-side-card self-profile-photos-card">
            <header><div><h2>{t('photos')}</h2><small>{t(photosHaveMore ? 'profilePhotoStatMore' : 'profilePhotoStat', { count: photos.length })}</small></div><button type="button" onClick={() => setTab('photos')}>{t('profileSeeAllPhotos')}</button></header>
            {photosLoading && photos.length === 0 ? <div className="self-profile-side-loading"><span className="spinner" /></div> : <div className="self-profile-photo-preview">{photos.slice(0, 9).map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onNavigate(`/content/${photo.contentId}`)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div>}
          </section>
        </aside> : !canEdit && <aside className="card profile-intro"><h2>{t('intro')}</h2>{profile.bio && <p>{profile.bio}</p>}{profile.location && <p><Icon name="location" size={18} />{t('livesIn', { location: profile.location })}</p>}<p><Icon name="friends" size={18} />{t('followingCount', { count: profile.followingCount })}</p></aside>}

        <section ref={profilePostColumnRef} className="profile-post-list">
          {tab === 'posts' && canEdit && <PostComposer variant="profile" userId={profile.id} displayName={profile.displayName} avatarUrl={profile.avatarUrl} isVerified={profile.isVerified} friends={profileFriends} onReel={() => onNavigate('/reels')} onCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
          {tab === 'posts' && canEdit && <section className="card self-profile-post-tools">
            <header><h2>{t('profilePostsTitle')}</h2><div><details><summary><ProfilePostFilterIcon />{t('profilePostFilters')}</summary><div>{(['all', 'media', 'text'] as ProfilePostFilter[]).map((filter) => <button type="button" key={filter} className={postFilter === filter ? 'active' : ''} onClick={() => setPostFilter(filter)}>{t(filter === 'all' ? 'profileAllPosts' : filter === 'media' ? 'profileMediaPosts' : 'profileTextPosts')}</button>)}</div></details><button type="button" className={manageMode ? 'active' : ''} onClick={() => setManageMode((value) => !value)}><ProfilePostManageIcon />{t(manageMode ? 'done' : 'profileManagePosts')}</button></div></header>
            {manageMode && <p>{t('profileManagePostsHint')}</p>}
            <div className="self-profile-post-view-tabs"><button type="button" className={postView === 'list' ? 'active' : ''} onClick={() => setPostView('list')}><ProfilePostListIcon /><span>{t('profileListView')}</span></button><button type="button" className={postView === 'grid' ? 'active' : ''} onClick={() => setPostView('grid')}><ProfilePostGridIcon /><span>{t('profileGridView')}</span></button></div>
          </section>}

          {tab === 'posts' && (postsLoading ? <div className="card state-card"><span className="spinner" /></div> : filteredPosts.length > 0 ? postView === 'grid' && canEdit ? <div className="self-profile-post-grid">{filteredPosts.map((post) => <ProfilePostGridCard key={post.id} post={post} onOpen={() => onNavigate(`/content/${post.id}`)} />)}</div> : filteredPosts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} />) : <div className="card state-card"><h2>{postsUnavailable ? t('unableToLoad') : t('profileNoPosts')}</h2><p>{postsUnavailable ? t('profilePostsLoadError') : canEdit ? t('yourPostsEmpty') : t('userPostsEmpty', { name: profile.displayName.split(' ')[0] })}</p></div>)}
          {tab === 'about' && <div className="card profile-tab-card"><h2>{t('about')}</h2><dl><div><dt>{t('bio')}</dt><dd>{profile.bio || t('notAvailable')}</dd></div><div><dt>{t('location')}</dt><dd>{profile.location || t('notAvailable')}</dd></div><div><dt>{t('birthDate')}</dt><dd>{profile.birthDate || t('notAvailable')}</dd></div><div><dt>{t('createdAt')}</dt><dd>{profile.createdAt || t('notAvailable')}</dd></div></dl></div>}
          {tab === 'friends' && (canEdit ? <ProfileConnectionsTab profile={profile} viewerId={viewerId} onNavigate={onNavigate} /> : <div className="card profile-tab-card"><h2>{t('friends')}</h2><p className="muted">{t('friendListPrivate')}</p></div>)}
          {tab === 'photos' && <ProfileMediaTab profile={profile} canEdit={canEdit} friends={profileFriends} onNavigate={onNavigate} onPostCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
          {tab === 'reels' && <ProfileReelsTab profile={profile} canEdit={canEdit} onNavigate={onNavigate} />}
          {tab === 'groups' && <div className="card profile-tab-card"><h2>{t('groups')}</h2>{groupsLoading ? <div className="state-card"><span className="spinner" /></div> : profileGroups.length === 0 ? <p className="muted">{groupsUnavailable ? t('groupsLoadError') : t('joinedGroupsEmpty')}</p> : <div className="group-grid self-profile-group-grid">{profileGroups.map((group) => <button type="button" className="card group-card" key={group.id} onClick={() => onNavigate(`/groups/${group.id}`)}><div className="group-card-cover" style={group.backgroundUrl ? { backgroundImage: `url(${group.backgroundUrl})` } : undefined} /><Avatar name={group.name} src={group.avatarUrl} size={64} /><strong>{group.name}</strong><small>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</small></button>)}</div>}</div>}
        </section>
      </div>
    </main>

    {canEdit && storyCreatorOpen && <Suspense fallback={<div className="modal-backdrop"><span className="spinner" /></div>}><StoryCreatorModal open authorId={profile.id} onClose={() => setStoryCreatorOpen(false)} onCreated={(story) => {
      setMyStories((current) => ({
        author: { id: profile.id, name: profile.displayName, avatar: profile.avatarUrl ?? '', isVerified: Boolean(profile.isVerified) },
        latestCreate: story.create,
        hasUnseen: true,
        unseenCount: Math.max(1, (current?.unseenCount ?? 0) + 1),
        stories: [story, ...(current?.stories ?? []).filter((item) => item.id !== story.id)],
      }))
    }} /></Suspense>}
    {canEdit && storyViewerOpen && myStories && <Suspense fallback={<div className="story-viewer-backdrop"><span className="spinner" /></div>}><StoryViewerPage buckets={[myStories]} initialBucketId={profile.id} viewerId={viewerId} onClose={() => setStoryViewerOpen(false)} onNavigate={onNavigate} onCreateStory={() => { setStoryViewerOpen(false); setStoryCreatorOpen(true) }} onStoryDeleted={(storyId) => setMyStories((current) => {
      if (!current) return null
      const stories = current.stories.filter((story) => story.id !== storyId)
      return stories.length ? { ...current, stories, latestCreate: stories[0].create } : null
    })} /></Suspense>}
    {canEdit && coverPickerOpen && <ProfileCoverPhotoPicker images={coverCandidates} loading={coverCandidatesLoading} error={coverPickerError} onClose={() => setCoverPickerOpen(false)} onSelect={(photo) => void chooseExistingCover(photo)} />}
    {canEdit && coverCropTarget && <ImageCropModal file={coverCropTarget.file} kind="background" onClose={() => setCoverCropTarget(null)} onConfirm={saveCroppedCover} />}
  </>
}

type ProfileMediaFilter = 'all' | 'photos' | 'videos'
type ProfileConnectionSection = 'friends' | 'following' | 'followers'

interface ProfileMediaItem {
  id: string
  contentId: string
  type: number
  url: string
  createdAt: string
}

async function loadProfileMediaItems(userId: string): Promise<ProfileMediaItem[]> {
  const photoItems: ProfileMediaItem[] = []
  const videoItems: ProfileMediaItem[] = []
  const collectPhotos = async () => {
    let cursor: string | null = null
    for (let pageIndex = 0; pageIndex < 6; pageIndex++) {
      const page = await socialApi.getUserPhotos(userId, 60, cursor)
      photoItems.push(...page.items.map((item) => ({
        id: `${item.contentId}:${item.media.id}`,
        contentId: item.contentId,
        type: 0,
        url: item.media.url,
        createdAt: item.createdAt,
      })))
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    }
  }
  const collectPostVideos = async () => {
    let cursor: string | null = null
    for (let pageIndex = 0; pageIndex < 8; pageIndex++) {
      const page = await socialApi.getProfilePosts(userId, 25, cursor)
      for (const post of page.items) {
        for (const media of post.media.filter((item) => item.type === 1)) {
          videoItems.push({ id: `${post.id}:${media.id}`, contentId: post.id, type: 1, url: media.url, createdAt: post.create })
        }
      }
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    }
  }
  const collectReelVideos = async () => {
    let cursor: string | null = null
    for (let pageIndex = 0; pageIndex < 8; pageIndex++) {
      const page = await socialApi.getProfileReels(userId, 25, cursor)
      for (const reel of page.items) {
        for (const media of reel.media.filter((item) => item.type === 1)) {
          videoItems.push({ id: `${reel.id}:${media.id}`, contentId: reel.id, type: 1, url: media.url, createdAt: reel.createdAt })
        }
      }
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    }
  }

  await Promise.all([collectPhotos(), collectPostVideos(), collectReelVideos()])
  const unique = new Map<string, ProfileMediaItem>()
  for (const item of [...photoItems, ...videoItems]) unique.set(item.id, item)
  return [...unique.values()].sort((left, right) => {
    const timeDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    return Number.isFinite(timeDifference) && timeDifference !== 0 ? timeDifference : right.id.localeCompare(left.id)
  })
}

function ProfileMediaTab({ profile, canEdit, friends, onNavigate, onPostCreated }: { profile: SocialProfile; canEdit: boolean; friends: SocialProfile[]; onNavigate: (path: string) => void; onPostCreated: (post: GatewayPost) => void }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<ProfileMediaFilter>('all')
  const [items, setItems] = useState<ProfileMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [composerRequest, setComposerRequest] = useState(0)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setItems(await loadProfileMediaItems(profile.id))
    } catch {
      setItems([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => { void reload() }, [reload])
  useEffect(() => {
    if (!menuId) return
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`[data-profile-media-menu="${menuId}"]`)) setMenuId(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuId])

  const filteredItems = items.filter((item) => filter === 'all' || (filter === 'photos' ? item.type === 0 : item.type === 1))

  async function setAsProfileImage(item: ProfileMediaItem, kind: 'avatar' | 'cover') {
    setBusyId(item.id)
    try {
      const updated = kind === 'avatar'
        ? await socialApi.changeUserAvatar(profile.id, item.url, null, readDefaultPostPrivacy(profile.id))
        : await socialApi.changeUserBackground(profile.id, item.url, null, readDefaultPostPrivacy(profile.id))
      if (updated) window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      setMenuId(null)
    } finally {
      setBusyId(null)
    }
  }

  function handleCreated(post: GatewayPost) {
    onPostCreated(post)
    const additions = post.media.map((media) => ({
      id: `${post.id}:${media.id}`,
      contentId: post.id,
      type: media.type,
      url: media.url,
      createdAt: post.create,
    }))
    setItems((current) => [...additions, ...current.filter((item) => !additions.some((addition) => addition.id === item.id))])
  }

  return <section className="card self-profile-collection-card self-profile-media-tab">
    <header className="self-profile-collection-head"><h2>{t('photos')}</h2>{canEdit && <button type="button" onClick={() => setComposerRequest((value) => value + 1)}>{t('profileAddPhotoVideo')}</button>}</header>
    <nav className="self-profile-collection-tabs" aria-label={t('photos')}>
      {(['all', 'photos', 'videos'] as ProfileMediaFilter[]).map((value) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{t(value === 'all' ? 'profileMediaAll' : value === 'photos' ? 'photos' : 'videos')}</button>)}
    </nav>
    {loading ? <div className="self-profile-collection-state"><span className="spinner" /></div> : error ? <div className="self-profile-collection-state muted">{t('profileMediaLoadError')}</div> : filteredItems.length === 0 ? <div className="self-profile-collection-state muted">{t('photosEmpty')}</div> : <div className="self-profile-media-grid">{filteredItems.map((item) => <article key={item.id}>
      <button type="button" className="self-profile-media-open" onClick={() => onNavigate(`/content/${item.contentId}`)}>{item.type === 1 ? <><video src={item.url} muted playsInline preload="metadata" /><span className="self-profile-media-play"><Icon name="play" size={20} /></span></> : <img src={item.url} alt="" loading="lazy" />}</button>
      {canEdit && item.type === 0 && <div className="self-profile-media-edit" data-profile-media-menu={item.id}><button type="button" aria-label={t('edit')} onClick={() => setMenuId((current) => current === item.id ? null : item.id)}><Icon name="edit" size={16} /></button>{menuId === item.id && <div role="menu"><button type="button" role="menuitem" disabled={busyId === item.id} onClick={() => void setAsProfileImage(item, 'avatar')}><Icon name="user" size={18} />{t('profileSetAsAvatar')}</button><button type="button" role="menuitem" disabled={busyId === item.id} onClick={() => void setAsProfileImage(item, 'cover')}><Icon name="photo" size={18} />{t('profileSetAsCover')}</button></div>}</div>}
    </article>)}</div>}
    {canEdit && <PostComposer triggerOnly externalOpenRequest={composerRequest} variant="profile" userId={profile.id} displayName={profile.displayName} avatarUrl={profile.avatarUrl} isVerified={profile.isVerified} friends={friends} onReel={() => onNavigate('/reels')} onCreated={handleCreated} />}
  </section>
}

function ProfileConnectionsTab({ profile, viewerId, onNavigate }: { profile: SocialProfile; viewerId: string; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [section, setSection] = useState<ProfileConnectionSection>('friends')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Array<{ profile: SocialProfile; mutualFriendCount: number }>>([])
  const [loading, setLoading] = useState(true)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [unfollowedIds, setUnfollowedIds] = useState<Set<string>>(() => new Set())
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set())
  const mutualCountsRef = useRef(new Map<string, number>())
  const sections: Array<{ id: ProfileConnectionSection; label: string }> = [
    { id: 'friends', label: t('profileAllFriends') },
    ...(profile.followingCount > 0 ? [{ id: 'following' as const, label: t('following') }] : []),
    ...(profile.followerCount > 0 ? [{ id: 'followers' as const, label: t('profileFollowers') }] : []),
  ]

  useEffect(() => {
    setQuery('')
    setMenuId(null)
  }, [section])
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      const request = query
        ? searchApi.searchProfileConnections(section, query, 1, 100).then((profiles) => profiles.map((connectionProfile) => ({
          profile: connectionProfile,
          mutualFriendCount: mutualCountsRef.current.get(connectionProfile.id) ?? 0,
        })))
        : socialApi.getProfileConnections(profile.id, section, 200).then((connections) => {
          if (section === 'friends') mutualCountsRef.current = new Map(connections.map((item) => [item.profile.id, item.mutualFriendCount]))
          return connections
        })
      request.then((value) => {
        if (active) setItems(value)
      }).catch(() => {
        if (active) setItems([])
      }).finally(() => {
        if (active) setLoading(false)
      })
    }, query ? 220 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [profile.id, query, section])
  useEffect(() => {
    if (!menuId) return
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`[data-profile-connection-menu="${menuId}"]`)) setMenuId(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuId])

  async function removeFriend(targetId: string) {
    setBusyId(targetId)
    try {
      if (await socialApi.unfriend(viewerId, targetId)) setItems((current) => current.filter((item) => item.profile.id !== targetId))
      setMenuId(null)
    } finally { setBusyId(null) }
  }
  async function block(targetId: string) {
    setBusyId(targetId)
    try {
      if (await socialApi.blockUser(viewerId, targetId)) setItems((current) => current.filter((item) => item.profile.id !== targetId))
      setMenuId(null)
    } finally { setBusyId(null) }
  }
  async function toggleFollowing(targetId: string) {
    setBusyId(targetId)
    try {
      const currentlyFollowing = !unfollowedIds.has(targetId)
      const success = currentlyFollowing ? await socialApi.unfollowUser(viewerId, targetId) : await socialApi.followUser(viewerId, targetId)
      if (success) setUnfollowedIds((current) => {
        const next = new Set(current)
        if (currentlyFollowing) next.add(targetId)
        else next.delete(targetId)
        return next
      })
    } finally { setBusyId(null) }
  }
  async function addFriend(targetId: string) {
    setBusyId(targetId)
    try {
      if (await socialApi.sendFriendRequest(viewerId, targetId)) setRequestedIds((current) => new Set(current).add(targetId))
      setMenuId(null)
    } finally { setBusyId(null) }
  }

  return <section className="card self-profile-collection-card self-profile-connections-tab">
    <header className="self-profile-collection-head"><h2>{t('friends')}</h2><label className="self-profile-connections-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} /></label></header>
    <nav className="self-profile-collection-tabs" aria-label={t('friends')}>{sections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
    {loading ? <div className="self-profile-collection-state"><span className="spinner" /></div> : items.length === 0 ? <div className="self-profile-collection-state muted">{query ? t('noSearchResults') : t('friendListEmpty')}</div> : <div className="self-profile-connections-grid">{items.map((item) => {
      const person = item.profile
      const isUnfollowed = unfollowedIds.has(person.id)
      return <article key={person.id}>
        <button type="button" className="self-profile-connection-person" onClick={() => onNavigate(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={90} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} size={13} /></strong>{section === 'friends' && item.mutualFriendCount > 0 && <small>{t('mutualFriendsCount', { count: item.mutualFriendCount })}</small>}</span></button>
        {section === 'following' ? <button type="button" className={isUnfollowed ? 'self-profile-follow-toggle follow' : 'self-profile-follow-toggle'} disabled={busyId === person.id} onClick={() => void toggleFollowing(person.id)}>{t(isUnfollowed ? 'follow' : 'following')}</button> : <div className="self-profile-connection-menu" data-profile-connection-menu={person.id}><button type="button" aria-label={t('more')} onClick={() => setMenuId((current) => current === person.id ? null : person.id)}><Icon name="more" size={18} /></button>{menuId === person.id && <div role="menu">{section === 'friends' ? <button type="button" role="menuitem" disabled={busyId === person.id} onClick={() => void removeFriend(person.id)}><Icon name="userMinus" size={18} />{t('removeFriend')}</button> : <button type="button" role="menuitem" disabled={busyId === person.id || requestedIds.has(person.id)} onClick={() => void addFriend(person.id)}><Icon name="userPlus" size={18} />{t(requestedIds.has(person.id) ? 'requestSent' : 'addFriend')}</button>}<button type="button" role="menuitem" disabled={busyId === person.id} onClick={() => void block(person.id)}><Icon name="block" size={18} />{t('block')}</button></div>}</div>}
      </article>
    })}</div>}
  </section>
}

async function loadProfileReelItems(userId: string, mode: 'own' | 'saved'): Promise<SocialContent[]> {
  const reels: SocialContent[] = []
  let cursor: string | null = null
  for (let pageIndex = 0; pageIndex < 8; pageIndex++) {
    if (mode === 'own') {
      const page = await socialApi.getProfileReels(userId, 25, cursor)
      reels.push(...page.items)
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    } else {
      const page = await socialApi.getSavedContent(30, cursor)
      reels.push(...page.items.flatMap((item) => item.kind === 'reel' ? [item.reel] : []))
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    }
  }
  return [...new Map(reels.map((reel) => [reel.id, reel])).values()]
}

function ProfileReelsTab({ profile, canEdit, onNavigate }: { profile: SocialProfile; canEdit: boolean; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'own' | 'saved'>('own')
  const [items, setItems] = useState<SocialContent[]>([])
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canEdit && mode === 'saved') setMode('own')
  }, [canEdit, mode])

  useEffect(() => {
    let active = true
    setLoading(true)
    loadProfileReelItems(profile.id, mode).then(async (reels) => {
      if (!active) return
      setItems(reels)
      try {
        const counts = await socialApi.getContentViewCounts(reels.map((reel) => reel.id))
        if (active) setViewCounts(counts)
      } catch {
        if (active) setViewCounts({})
      }
    }).catch(() => {
      if (active) setItems([])
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [mode, profile.id])

  return <section className="card self-profile-collection-card self-profile-reels-tab">
    <header className="self-profile-collection-head"><h2>{t('profileTabReels')}</h2>{canEdit && <button type="button" onClick={() => onNavigate('/reels')}>{t('profileCreateReel')}</button>}</header>
    <nav className="self-profile-collection-tabs" aria-label={t('profileTabReels')}><button type="button" className={mode === 'own' ? 'active' : ''} onClick={() => setMode('own')}>{t('profileYourReels')}</button>{canEdit && <button type="button" className={mode === 'saved' ? 'active' : ''} onClick={() => setMode('saved')}>{t('profileSavedReels')}</button>}</nav>
    {loading ? <div className="self-profile-collection-state"><span className="spinner" /></div> : items.length === 0 ? <div className="self-profile-collection-state muted">{t('profileNoReels')}</div> : <div className="self-profile-reels-grid">{items.map((reel) => {
      const media = reel.media[0]
      return <button type="button" key={reel.id} onClick={() => onNavigate(`/content/${reel.id}`)}>{media ? media.type === 1 ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" /> : <span>{decodePostContent(reel.content).text}</span>}<small><Icon name="eye" size={17} />{viewCounts[reel.id] ?? 0}</small></button>
    })}</div>}
  </section>
}

function ProfileCoverCameraIcon() {
  return <svg className="self-profile-cover-camera-icon" width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8.25 4.1h7.5l1.65 2H20a2.4 2.4 0 0 1 2.4 2.4v9.1A2.4 2.4 0 0 1 20 20H4a2.4 2.4 0 0 1-2.4-2.4V8.5A2.4 2.4 0 0 1 4 6.1h2.6l1.65-2Z" fill="currentColor" />
    <circle cx="12" cy="13" r="4.7" fill="var(--profile-camera-lens, #fff)" />
    <circle cx="12" cy="13" r="2.65" fill="currentColor" />
  </svg>
}

function ProfileInfoEditIcon() {
  return <svg className="self-profile-info-edit-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m4.2 19.8 1.05-4.15L15.7 5.2a2.05 2.05 0 0 1 2.9 0l.2.2a2.05 2.05 0 0 1 0 2.9L8.35 18.75 4.2 19.8Z" /><path d="m13.85 7.05 3.1 3.1" /></svg>
}

function ProfileBioIcon() {
  return <svg className="self-profile-summary-icon self-profile-bio-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.25" y="4.5" width="17.5" height="15" rx="2.75" /><circle cx="8.5" cy="9.75" r="2.05" /><path d="M5.7 15.6c.4-2.05 1.35-3.05 2.8-3.05s2.4 1 2.8 3.05M14 9h3.2M14 13h3.2" /></svg>
}

function ProfileLocationIcon() {
  return <svg className="self-profile-info-icon" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s7-6.55 7-12a7 7 0 1 0-14 0c0 5.45 7 12 7 12Z" /><circle cx="12" cy="9" r="2.35" /></svg>
}

function ProfileZodiacIcon({ zodiac }: { zodiac: ProfileZodiac | null }) {
  return <svg className="self-profile-info-icon self-profile-zodiac-icon" data-zodiac={zodiac?.id ?? 'unknown'} width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><text x="12" y="12.5" fill="currentColor" fontFamily="'Segoe UI Symbol', 'Apple Symbols', sans-serif" fontSize="19" fontWeight="600" textAnchor="middle" dominantBaseline="middle">{zodiac?.symbol ?? '✦'}</text></svg>
}

function ProfileGenderIcon({ gender }: { gender: SocialProfile['gender'] }) {
  const variant = gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'neutral'
  if (variant === 'female') return <svg className="self-profile-info-icon self-profile-gender-icon female" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4.5" /><path d="M12 12.5V21M8.5 17h7" /></svg>
  if (variant === 'male') return <svg className="self-profile-info-icon self-profile-gender-icon male" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="8.8" cy="14.2" r="4.55" /><path d="m12.05 10.95 6.7-6.7M14.5 4.25h4.25V8.5" /></svg>
  return <svg className="self-profile-info-icon self-profile-gender-icon neutral" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="7.5" r="3.4" /><path d="M5.5 20c.45-4.35 2.85-6.6 6.5-6.6s6.05 2.25 6.5 6.6" /></svg>
}

function ProfileEmailIcon() {
  return <svg className="self-profile-info-icon" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.25" /><path d="m4.5 7.25 7.5 5.65 7.5-5.65" /></svg>
}

function ProfilePostFilterIcon() {
  return <svg className="profile-post-filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 7h7.9M16.6 7h3.9M3.5 17h3.9M12.6 17h7.9" /><circle cx="14" cy="7" r="2.3" /><circle cx="10" cy="17" r="2.3" /></svg>
}

function ProfilePostManageIcon() {
  return <svg className="profile-post-manage-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" clipRule="evenodd" d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a9.2 9.2 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65a9.2 9.2 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.2 7.2 0 0 0 0 1.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65a9.2 9.2 0 0 0 1.69-.98l2.49 1c.23.09.48 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" /></svg>
}

function ProfilePostListIcon() {
  return <svg className="profile-post-list-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.45" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M5 6h14M5 12h14M5 18h14" /></svg>
}

function ProfilePostGridIcon() {
  return <svg className="profile-post-grid-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>
}

function ProfileCoverPhotoIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.25" y="2.75" width="17.5" height="18.5" rx="2.4" /><circle cx="8.25" cy="8" r="1.35" /><path d="m5.6 18 4.2-4.55 2.7 2.55 2.45-2.75 3.45 4.75" /></svg>
}

function ProfileCoverUploadIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3m0 0L7.8 7.25M12 3l4.2 4.25" /><path d="M4 14.5v4.25A2.25 2.25 0 0 0 6.25 21h11.5A2.25 2.25 0 0 0 20 18.75V14.5" /></svg>
}

function ProfileAddStoryIcon() {
  return <svg className="self-profile-add-story-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
}

function ProfileHeaderChevronIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m7 9.5 5 5 5-5" /></svg>
}

function ProfileCoverPhotoPicker({ images, loading, error, onClose, onSelect }: { images: SocialPhoto[]; loading: boolean; error: string | null; onClose: () => void; onSelect: (photo: SocialPhoto) => void }) {
  const { t } = useI18n()
  return <div className="modal-backdrop existing-photo-backdrop" role="presentation" onClick={onClose}><section className="modal existing-photo-modal" role="dialog" aria-modal="true" aria-label={t('profileChooseCover')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{t('profileChooseCover')}</h2><p>{t('chooseBackgroundPhotoDesc')}</p></div><button type="button" className="icon-circle subtle" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></header>{loading ? <div className="settings-loading"><span className="spinner" /></div> : error ? <p className="form-error existing-photo-state">{error}</p> : images.length > 0 ? <div className="existing-photo-grid">{images.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onSelect(photo)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div> : <p className="muted existing-photo-state">{t('photosEmpty')}</p>}</section></div>
}

function ProfileStoryTile({ story, onOpen }: { story: GatewayStory; onOpen: () => void }) {
  const media = storyMedia(story)
  const decoded = story.__typename === 'NormalStory' ? decodeStoryContent(story.content) : null
  return <button type="button" onClick={onOpen}>
    {story.__typename !== 'NormalStory'
      ? <SharedStoryMiniPreview source={story.sharedSource} />
      : media
        ? media.type === 1 ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" />
        : <span style={{ backgroundColor: decoded?.backgroundColor }}>{decoded?.text}</span>}
  </button>
}

function ProfilePostGridCard({ post, onOpen }: { post: GatewayPost; onOpen: () => void }) {
  const decoded = decodePostContent(post.content)
  const background = post.media.length === 0 ? getPostBackgroundPreset(decoded.backgroundId) : null
  const sharedMedia = post.__typename === 'FeedPostDetail' ? post.sharedSource?.media[0] ?? null : null
  const media = post.media[0] ?? sharedMedia
  return <button type="button" onClick={onOpen}>
    {media ? media.type === 1 ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" /> : <span style={background ? { background: background.background } : undefined}>{decoded.text}</span>}
    <small>{post.create}</small>
  </button>
}

function ProfileActions({ profile, relationship, loading, busyAction, onFriend, onFollow, onBlock, onMessage }: { profile: SocialProfile; relationship: ProfileRelationshipState; loading: boolean; busyAction: string | null; onFriend: (action: 'send' | 'cancel' | 'accept' | 'reject' | 'unfriend') => void; onFollow: () => void; onBlock: () => void; onMessage: () => void }) {
  const { t } = useI18n()
  if (loading) return <div className="profile-relationship-actions"><span className="spinner" /></div>
  if (relationship.isBlockedBy) return <div className="profile-relationship-actions"><span className="role-pill muted-pill">{t('profileRestricted')}</span></div>
  const busy = busyAction != null
  return <div className="profile-relationship-actions">
    {!relationship.isBlocked && profile.privacy === 0 && relationship.friendship === 'none' && <button type="button" className="btn-primary" disabled={busy} onClick={() => onFriend('send')}><Icon name="userPlus" size={17} />{t('addFriend')}</button>}
    {!relationship.isBlocked && relationship.friendship === 'outgoing' && <button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('cancel')}><Icon name="clock" size={17} />{t('cancelRequest')}</button>}
    {!relationship.isBlocked && relationship.friendship === 'incoming' && <><button type="button" className="btn-primary" disabled={busy} onClick={() => onFriend('accept')}><Icon name="friends" size={17} />{t('confirm')}</button><button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('reject')}>{t('decline')}</button></>}
    {!relationship.isBlocked && relationship.friendship === 'friend' && <button type="button" className="btn-primary" disabled={busy} onClick={onMessage}><Icon name="messenger" size={17} />{t('messageUser')}</button>}
    {!relationship.isBlocked && relationship.friendship === 'friend' && <button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('unfriend')}><Icon name="friends" size={17} />{t('removeFriend')}</button>}
    {!relationship.isBlocked && relationship.friendship !== 'friend' && (profile.privacy !== 0 || relationship.isFollowing) && <button type="button" className={relationship.isFollowing ? 'btn-soft' : 'btn-primary'} disabled={busy} onClick={onFollow}><Icon name="friends" size={17} />{relationship.isFollowing ? t('unfollow') : t('follow')}</button>}
    <button type="button" className="btn-soft danger-text" disabled={busy} onClick={onBlock}><Icon name="lock" size={17} />{relationship.isBlocked ? t('unblock') : t('block')}</button>
  </div>
}

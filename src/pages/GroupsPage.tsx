import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, visibleRecommendationPosts } from '../api/client'
import type { GatewayPost } from '../api/gatewayTypes'
import { notificationApi, type AppNotification } from '../api/notifications'
import { searchApi, type QuickGroupSearchItem } from '../api/search'
import { socialApi, type GroupSuggestion, type SocialGroup, type SocialProfile } from '../api/social'
import { AnchoredMenuPortal } from '../components/AnchoredMenuPortal'
import { Avatar } from '../components/Avatar'
import { GroupMembersIcon } from '../components/GroupMembersIcon'
import { Icon } from '../components/Icon'
import { PostPrivacyIcon } from '../components/PostPrivacyIcon'
import { SidebarSettingsIcon } from '../components/SidebarSettingsIcon'
import { useI18n } from '../i18n'
import { groupVisitRelativeTime, relativeTime } from '../lib/format'
import { INPUT_LIMITS } from '../lib/inputLimits'
import { createRecommendationSessionKey } from '../lib/useRecommendationImpression'
import { GatewayPostCard } from './GatewayHomePage'

export { GroupProfilePage } from './GroupProfilePage'

type GroupSection = 'feed' | 'discover' | 'your' | 'invited' | 'requested'
type YourGroupsSection = 'managed' | 'joined'

interface GroupListItem extends SocialGroup {
  lastVisitedAt?: string
}

interface GroupCollections {
  joined: GroupListItem[]
  managed: GroupListItem[]
  pending: GroupListItem[]
  recent: GroupListItem[]
}

interface GroupInvitationItem {
  group: GroupListItem
  inviter: AppNotification['actor']
  invitedAt: string
}

type GroupDirectoryEvent =
  | { kind: 'invited'; actor: AppNotification['actor']; occurredAt: string }
  | { kind: 'requested'; occurredAt: string }

const GROUP_FEED_BATCH = 60
const GROUP_QUICK_SEARCH_LIMIT = 8
const GROUP_SCOPE_SEARCH_LIMIT = 24
const EMPTY_GROUPS: GroupCollections = { joined: [], managed: [], pending: [], recent: [] }

export function GroupsPage({ userId, profile, onNavigate }: { userId: string; profile?: SocialProfile | null; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [collections, setCollections] = useState<GroupCollections>(EMPTY_GROUPS)
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitationItem[]>([])
  const [pendingRequestedAt, setPendingRequestedAt] = useState<Record<string, string>>({})
  const [section, setSection] = useState<GroupSection>('feed')
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [partialError, setPartialError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [groupPosts, setGroupPosts] = useState<GatewayPost[]>([])
  const [suggestedGroups, setSuggestedGroups] = useState<GroupSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [yourGroupsTarget, setYourGroupsTarget] = useState<YourGroupsSection | null>(null)
  const [feedOffset, setFeedOffset] = useState(0)
  const [feedHasMore, setFeedHasMore] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedMoreLoading, setFeedMoreLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null)
  const [membershipActionGroupId, setMembershipActionGroupId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickGroups, setQuickGroups] = useState<QuickGroupSearchItem[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [searchGroups, setSearchGroups] = useState<SocialGroup[]>([])
  const [searchPosts, setSearchPosts] = useState<GatewayPost[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const feedSentinelRef = useRef<HTMLDivElement>(null)
  const searchShellRef = useRef<HTMLFormElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const initialLoadUserRef = useRef<string | null>(null)
  const recommendationSessionKeyRef = useRef<string | null>(null)
  const recommendationPostIdsRef = useRef(new Set<string>())
  const suggestionsRequestRef = useRef(0)
  const managedGroupsSectionRef = useRef<HTMLElement>(null)
  const joinedGroupsSectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.documentElement.classList.add('groups-page-scroll')
    document.body.classList.add('groups-page-scroll')
    return () => {
      document.documentElement.classList.remove('groups-page-scroll')
      document.body.classList.remove('groups-page-scroll')
    }
  }, [])

  useEffect(() => {
    if (section !== 'your' || !yourGroupsTarget) return
    const timer = window.setTimeout(() => {
      const target = yourGroupsTarget === 'managed' ? managedGroupsSectionRef.current : joinedGroupsSectionRef.current
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      setYourGroupsTarget(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [section, yourGroupsTarget])

  const loadCollections = useCallback(async () => {
    setGroupsLoading(true)
    setGroupsError(null)
    setPartialError(false)
    const [joinedResult, managedResult, pendingResult, recentResult, notificationResult] = await Promise.allSettled([
      socialApi.getMemberGroups(userId, 50),
      socialApi.getAdminGroups(userId, 50),
      socialApi.getPendingGroupJoins(userId, 50),
      api.visitedGroups(userId, 50),
      notificationApi.notifications(50),
    ])
    try {
      const coreResults = [joinedResult, managedResult, pendingResult, recentResult]
      const results = [...coreResults, notificationResult]
      if (coreResults.every((result) => result.status === 'rejected')) {
        setCollections(EMPTY_GROUPS)
        setGroupInvitations([])
        setGroupsError(t('groupsLoadError'))
        return
      }

      const recentVisits = recentResult.status === 'fulfilled' ? recentResult.value.items : []
      const invitationNotifications = notificationResult.status === 'fulfilled'
        ? [...notificationResult.value.items
          .filter((item) => item.actionType === 'GROUP_INVITE')
          .reduce((latestByGroup, item) => {
            const current = latestByGroup.get(item.objectId)
            if (!current || new Date(item.createdAt).getTime() > new Date(current.createdAt).getTime()) {
              latestByGroup.set(item.objectId, item)
            }
            return latestByGroup
          }, new Map<string, AppNotification>())
          .values()]
        : []
      const detailIds = [...new Set([
        ...recentVisits.map((group) => group.id),
        ...invitationNotifications.map((item) => item.objectId),
      ])]
      const details = detailIds.length > 0
        ? await socialApi.getGroups(detailIds).catch(() => [])
        : []
      const detailsById = new Map(details.map((group) => [group.id, group]))
      const visitById = new Map(recentVisits.map((group) => [group.id, group.visitedAt]))
      const recent: GroupListItem[] = recentVisits.map((group) => ({
        ...(detailsById.get(group.id) ?? {
          id: group.id,
          avatarUrl: group.avatar || null,
          backgroundUrl: null,
          name: group.name,
          bio: null,
          privacy: 0,
          createdAt: '',
          memberCount: null,
          adminCount: 0,
        }),
        lastVisitedAt: group.visitedAt,
      }))
      const withVisit = (group: SocialGroup): GroupListItem => ({ ...group, lastVisitedAt: visitById.get(group.id) })
      const pendingRequests = pendingResult.status === 'fulfilled' ? pendingResult.value.items : []
      const pending = pendingRequests.map((request) => withVisit(request.group))
      setCollections({
        joined: joinedResult.status === 'fulfilled' ? joinedResult.value.items.map(withVisit) : [],
        managed: managedResult.status === 'fulfilled' ? managedResult.value.items.map(withVisit) : [],
        pending,
        recent,
      })
      setGroupInvitations(invitationNotifications.flatMap((notification) => {
        const group = detailsById.get(notification.objectId)
        return group ? [{ group: withVisit(group), inviter: notification.actor, invitedAt: notification.createdAt }] : []
      }))
      setPendingRequestedAt(Object.fromEntries(
        pendingRequests.map((request) => [request.group.id, request.requestedAt]),
      ))
      setPartialError(results.some((result) => result.status === 'rejected'))
    } finally {
      setGroupsLoading(false)
    }
  }, [t, userId])

  const requestRecommendations = useCallback(async (offset: number, append: boolean) => {
    if (append) setFeedMoreLoading(true)
    else setFeedLoading(true)
    setFeedError(null)
    try {
      if (!append || !recommendationSessionKeyRef.current) {
        recommendationSessionKeyRef.current = createRecommendationSessionKey()
        if (!append) recommendationPostIdsRef.current.clear()
      }
      const items = await api.recommendedFeed(userId, offset, GROUP_FEED_BATCH, recommendationSessionKeyRef.current)
      const nextPosts = visibleRecommendationPosts(items).filter((post) => post.__typename === 'GroupPostDetail')
      nextPosts.forEach((post) => recommendationPostIdsRef.current.add(post.id))
      setGroupPosts((current) => {
        const combined = append ? [...current, ...nextPosts] : nextPosts
        return [...new Map(combined.map((post) => [post.id, post])).values()]
      })
      setFeedOffset(offset + items.length)
      setFeedHasMore(items.length === GROUP_FEED_BATCH)
    } catch {
      setFeedError(t('groupFeedRecommendationError'))
    } finally {
      setFeedLoading(false)
      setFeedMoreLoading(false)
    }
  }, [t, userId])

  const loadGroupSuggestions = useCallback(async () => {
    const requestId = ++suggestionsRequestRef.current
    const requestUserId = userId
    setSuggestionsLoading(true)
    setSuggestionsError(null)
    try {
      const groups = await socialApi.getGroupSuggestions(24)
      if (suggestionsRequestRef.current !== requestId || initialLoadUserRef.current !== requestUserId) return
      setSuggestedGroups(groups)
    } catch {
      if (suggestionsRequestRef.current !== requestId || initialLoadUserRef.current !== requestUserId) return
      setSuggestedGroups([])
      setSuggestionsError(t('groupsLoadError'))
    } finally {
      if (suggestionsRequestRef.current === requestId && initialLoadUserRef.current === requestUserId) setSuggestionsLoading(false)
    }
  }, [t, userId])

  useEffect(() => {
    if (initialLoadUserRef.current === userId) return
    initialLoadUserRef.current = userId
    void loadCollections()
    void requestRecommendations(0, false)
    void loadGroupSuggestions()
  }, [loadCollections, loadGroupSuggestions, requestRecommendations, userId])

  const loadMoreRecommendations = useCallback(() => {
    if (!feedHasMore || feedLoading || feedMoreLoading) return
    void requestRecommendations(feedOffset, true)
  }, [feedHasMore, feedLoading, feedMoreLoading, feedOffset, requestRecommendations])

  useEffect(() => {
    if (section !== 'feed' || !feedHasMore || feedLoading || feedMoreLoading) return
    const target = feedSentinelRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreRecommendations()
    }, { rootMargin: '320px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [feedHasMore, feedLoading, feedMoreLoading, loadMoreRecommendations, section])

  useEffect(() => {
    const normalized = searchText.trim()
    if (!searchOpen || normalized.length < 1) {
      setQuickGroups([])
      setQuickLoading(false)
      setQuickError(null)
      return
    }
    let active = true
    setQuickLoading(true)
    setQuickError(null)
    const timer = window.setTimeout(() => {
      searchApi.fastSearchGroups(normalized, GROUP_QUICK_SEARCH_LIMIT).then((items) => {
        if (active) setQuickGroups(items)
      }).catch(() => {
        if (active) {
          setQuickGroups([])
          setQuickError(t('searchLoadError'))
        }
      }).finally(() => {
        if (active) setQuickLoading(false)
      })
    }, 220)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchOpen, searchText, t])

  useEffect(() => {
    const normalized = submittedQuery.trim()
    if (normalized.length < 1) {
      setSearchGroups([])
      setSearchPosts([])
      setSearchLoading(false)
      setSearchError(null)
      return
    }
    let active = true
    setSearchLoading(true)
    setSearchError(null)
    searchApi.searchGroupScope(normalized, 1, GROUP_SCOPE_SEARCH_LIMIT).then((result) => {
      if (!active) return
      setSearchGroups(result.groups)
      setSearchPosts(result.posts)
    }).catch(() => {
      if (!active) return
      setSearchGroups([])
      setSearchPosts([])
      setSearchError(t('searchLoadError'))
    }).finally(() => {
      if (active) setSearchLoading(false)
    })
    return () => { active = false }
  }, [submittedQuery, t])

  const allJoinedGroups = useMemo(() => [...new Map(
    [...collections.managed, ...collections.joined].map((group) => [group.id, group]),
  ).values()], [collections.joined, collections.managed])
  const managedIds = useMemo(() => new Set(collections.managed.map((group) => group.id)), [collections.managed])
  const sidebarJoined = useMemo(() => collections.joined.filter((group) => !managedIds.has(group.id)), [collections.joined, managedIds])
  const membershipIds = useMemo(() => new Set(allJoinedGroups.map((group) => group.id)), [allJoinedGroups])
  const pendingIds = useMemo(() => new Set(collections.pending.map((group) => group.id)), [collections.pending])
  const visibleInvitations = useMemo(() => groupInvitations.filter((item) => !membershipIds.has(item.group.id) && !pendingIds.has(item.group.id)), [groupInvitations, membershipIds, pendingIds])
  const invitationEvents = useMemo(() => Object.fromEntries(visibleInvitations.map((item) => [item.group.id, {
    kind: 'invited', actor: item.inviter, occurredAt: item.invitedAt,
  } satisfies GroupDirectoryEvent])), [visibleInvitations])
  const requestEvents = useMemo(() => Object.fromEntries(collections.pending.map((group) => [group.id, {
    kind: 'requested', occurredAt: pendingRequestedAt[group.id] || '',
  } satisfies GroupDirectoryEvent])), [collections.pending, pendingRequestedAt])
  const discoverSuggestions = useMemo(() => {
    const suggestionsById = new Map(suggestedGroups.map((suggestion) => [suggestion.group.id, suggestion]))
    // The recommendation query intentionally excludes pending requests. Keep those groups in
    // Discover locally so the user can see and cancel the request after a reload as well.
    for (const group of collections.pending) {
      if (!suggestionsById.has(group.id)) {
        suggestionsById.set(group.id, {
          group,
          friendMemberCount: 0,
          friendMembers: [],
          yesterdayPostCount: 0,
        })
      }
    }
    return [...suggestionsById.values()]
  }, [collections.pending, suggestedGroups])
  const visibleSuggestions = discoverSuggestions.filter((suggestion) => !dismissedSuggestions.has(suggestion.group.id) && !membershipIds.has(suggestion.group.id))
  const searching = submittedQuery.length > 0

  const runGroupSearch = useCallback(() => {
    const normalized = searchText.trim()
    if (normalized.length < 1) return
    setSubmittedQuery(normalized)
    setSearchOpen(false)
    searchInputRef.current?.blur()
  }, [searchText])

  const openQuickGroup = useCallback((item: QuickGroupSearchItem) => {
    void searchApi.recordSearchResultView(item.referenceId).catch(() => undefined)
    setSearchOpen(false)
    onNavigate(`/groups/${item.id}`)
  }, [onNavigate])

  const selectSection = useCallback((nextSection: GroupSection) => {
    setSearchText('')
    setSubmittedQuery('')
    setSearchOpen(false)
    setSection(nextSection)
  }, [])

  const openYourGroupsSection = useCallback((target: YourGroupsSection) => {
    setYourGroupsTarget(target)
    setSearchText('')
    setSubmittedQuery('')
    setSearchOpen(false)
    setSection('your')
  }, [])

  async function joinSuggestedGroup(group: SocialGroup) {
    const isPending = pendingIds.has(group.id)
    setJoiningGroupId(group.id)
    setGroupsError(null)
    try {
      if (isPending) {
        if (!await socialApi.cancelJoinGroupRequest(userId, group.id)) throw new Error('Cancel rejected')
        setCollections((current) => ({
          ...current,
          pending: current.pending.filter((item) => item.id !== group.id),
        }))
        setPendingRequestedAt((current) => {
          const next = { ...current }
          delete next[group.id]
          return next
        })
        setSuggestedGroups((current) => current.some((item) => item.group.id === group.id)
          ? current
          : [{ group, friendMemberCount: 0, friendMembers: [], yesterdayPostCount: 0 }, ...current])
      } else {
        if (!await socialApi.requestJoinGroup(userId, group.id)) throw new Error('Join rejected')
        const requestedAt = new Date(Date.now()).toISOString()
        setCollections((current) => ({
          ...current,
          pending: [group, ...current.pending.filter((item) => item.id !== group.id)],
        }))
        setPendingRequestedAt((current) => {
          return { ...current, [group.id]: requestedAt }
        })
      }
    } catch {
      setGroupsError(t(isPending ? 'groupRequestActionError' : 'joinGroupError'))
    } finally {
      setJoiningGroupId(null)
    }
  }

  async function leaveMembershipGroup(group: SocialGroup) {
    setMembershipActionGroupId(group.id)
    setGroupsError(null)
    try {
      if (!await socialApi.leaveGroup(userId, group.id)) throw new Error('Leave rejected')
      setCollections((current) => ({
        ...current,
        joined: current.joined.filter((item) => item.id !== group.id),
        managed: current.managed.filter((item) => item.id !== group.id),
        recent: current.recent.filter((item) => item.id !== group.id),
      }))
    } catch {
      setGroupsError(t('leaveGroupError'))
    } finally {
      setMembershipActionGroupId(null)
    }
  }

  async function cancelPendingGroup(group: SocialGroup) {
    setMembershipActionGroupId(group.id)
    setGroupsError(null)
    try {
      if (!await socialApi.cancelJoinGroupRequest(userId, group.id)) throw new Error('Cancel rejected')
      setCollections((current) => ({
        ...current,
        pending: current.pending.filter((item) => item.id !== group.id),
      }))
      setPendingRequestedAt((current) => {
        const next = { ...current }
        delete next[group.id]
        return next
      })
    } catch {
      setGroupsError(t('groupRequestActionError'))
    } finally {
      setMembershipActionGroupId(null)
    }
  }

  async function acceptGroupInvitation(group: SocialGroup) {
    setMembershipActionGroupId(group.id)
    setGroupsError(null)
    try {
      if (!await socialApi.requestJoinGroup(userId, group.id)) throw new Error('Join rejected')
      const requestedAt = new Date(Date.now()).toISOString()
      setCollections((current) => ({
        ...current,
        pending: [group, ...current.pending.filter((item) => item.id !== group.id)],
      }))
      setPendingRequestedAt((current) => ({ ...current, [group.id]: requestedAt }))
    } catch {
      setGroupsError(t('joinGroupError'))
    } finally {
      setMembershipActionGroupId(null)
    }
  }

  if (creating) {
    return <CreateGroupExperience userId={userId} profile={profile} onClose={() => setCreating(false)} onCreated={(group) => {
      setCreating(false)
      setCollections((current) => ({
        ...current,
        managed: [group, ...current.managed.filter((item) => item.id !== group.id)],
        joined: [group, ...current.joined.filter((item) => item.id !== group.id)],
      }))
      onNavigate(`/groups/${group.id}`)
    }} />
  }

  return <main className="groups-page">
    <aside className="groups-sidebar">
      <header><h1 className="groups-hub-heading-text">{t('groups')}</h1><button type="button" className="groups-settings-button" aria-label={t('settingsPrivacy')}><SidebarSettingsIcon /></button></header>
      <div className="groups-search-row">
        <form ref={searchShellRef} className={searchOpen ? 'groups-search-shell is-open' : 'groups-search-shell'} onSubmit={(event) => { event.preventDefault(); runGroupSearch() }} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => { if (!searchShellRef.current?.contains(document.activeElement)) setSearchOpen(false) }, 0)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchOpen(false); searchInputRef.current?.blur() } }}>
          <label className="groups-search"><svg className="groups-search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10.25" cy="10.25" r="6.15" /><path d="m14.85 14.85 4.85 4.85" /></svg><input ref={searchInputRef} maxLength={INPUT_LIMITS.search} value={searchText} onChange={(event) => { const value = event.target.value; setSearchText(value); if (value.trim().length === 0) setSubmittedQuery('') }} placeholder={t('groupSearchPlaceholder')} aria-label={t('groupSearchPlaceholder')} aria-expanded={searchOpen} aria-controls="groups-sidebar-search-results" autoComplete="off" /></label>
          {searchOpen && <GroupQuickSearchDropdown query={searchText.trim()} items={quickGroups} loading={quickLoading} error={quickError} onOpen={openQuickGroup} onSearchQuery={runGroupSearch} />}
        </form>
      </div>
      <nav className="groups-primary-nav" aria-label={t('groups')}>
        <button type="button" className={section === 'feed' && !searching ? 'active' : ''} onClick={() => selectSection('feed')}><span><GroupSidebarNavIcon kind="feed" /></span><strong>{t('groupFeedNav')}</strong></button>
        <button type="button" className={section === 'discover' && !searching ? 'active' : ''} onClick={() => selectSection('discover')}><span><GroupSidebarNavIcon kind="discover" /></span><strong>{t('groupDiscover')}</strong></button>
        <button type="button" className={section === 'your' && !searching ? 'active' : ''} onClick={() => selectSection('your')}><span><GroupSidebarNavIcon kind="your" /></span><strong>{t('yourGroups')}</strong></button>
        <button type="button" className={section === 'invited' && !searching ? 'active' : ''} onClick={() => selectSection('invited')}><span><GroupSidebarNavIcon kind="invited" /></span><strong>{t('groupInvitedNav')}</strong></button>
        <button type="button" className={section === 'requested' && !searching ? 'active' : ''} onClick={() => selectSection('requested')}><span><GroupSidebarNavIcon kind="requested" /></span><strong>{t('groupRequestedNav')}</strong></button>
      </nav>
      <div className="groups-create-row"><button type="button" className="groups-create-button" onClick={() => setCreating(true)}>{t('createNewGroup')}</button></div>

      <div className="groups-sidebar-divider" />
      {groupsLoading ? <GroupsSidebarCollectionsSkeleton /> : <>
        <GroupSidebarCollection title={t('managedGroups')} groups={collections.managed.slice(0, 3)} locale={locale} onOpen={(group) => onNavigate(`/groups/${group.id}`)} action={collections.managed.length > 0 ? t('seeAll') : undefined} onAction={() => openYourGroupsSection('managed')} />
        <GroupSidebarCollection title={t('joinedGroups')} groups={sidebarJoined.slice(0, 6)} locale={locale} onOpen={(group) => onNavigate(`/groups/${group.id}`)} action={sidebarJoined.length > 0 ? t('seeAll') : undefined} onAction={() => openYourGroupsSection('joined')} />
      </>}
    </aside>

    <section className={`groups-main groups-main-${searching ? 'search' : section}`}>
      {(partialError || groupsError) && !groupsLoading && <p className="inline-alert groups-inline-alert">{groupsError || t('groupsPartialError')}</p>}
      {searching ? <>
        <header className="groups-section-heading"><h2>{t('groupSearchResults', { query: submittedQuery })}</h2></header>
        {searchLoading ? <GroupsContentSkeleton cards /> : searchError ? <GroupEmptyState title={t('unableToLoad')} detail={searchError} /> : searchGroups.length === 0 && searchPosts.length === 0 ? <GroupEmptyState title={t('noSearchResults')} detail={t('noSearchResultsDesc')} /> : <div className="groups-scope-search-results">
          {searchGroups.length > 0 && <section><h3>{t('groups')}</h3><GroupMembershipGrid groups={searchGroups} locale={locale} onNavigate={onNavigate} /></section>}
          {searchPosts.length > 0 && <section><h3>{t('searchPosts')}</h3><div className="groups-feed-column">{searchPosts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} />)}</div></section>}
        </div>}
      </> : section === 'feed' ? <>
        <div className="groups-feed-column">
          <header className="groups-feed-heading"><h2>{t('recentActivity')}</h2></header>
          {feedLoading && groupPosts.length === 0 ? <GroupsContentSkeleton /> : feedError && groupPosts.length === 0 ? <GroupEmptyState title={t('unableToLoad')} detail={feedError} action={t('tryAgain')} onAction={() => void requestRecommendations(0, false)} /> : groupPosts.length === 0 ? <GroupEmptyState title={t('groupFeedEmpty')} detail={t('groupFeedRecommendationEmpty')} /> : groupPosts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={userId} recommendationSessionKey={recommendationPostIdsRef.current.has(post.id) ? recommendationSessionKeyRef.current ?? undefined : undefined} onNavigate={onNavigate} />)}
          <div ref={feedSentinelRef} className="groups-feed-sentinel" aria-live="polite">{feedMoreLoading && <span className="spinner" aria-label={t('loadingMore')} />}{!feedHasMore && groupPosts.length > 0 && <span className="muted">{t('endOfFeed')}</span>}</div>
        </div>
      </> : section === 'discover' ? <>
        <header className="groups-section-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('moreGroupSuggestions')}</h1></header>
        {suggestionsLoading && visibleSuggestions.length === 0 ? <GroupsContentSkeleton cards /> : suggestionsError && visibleSuggestions.length === 0 ? <GroupEmptyState title={t('unableToLoad')} detail={suggestionsError} action={t('tryAgain')} onAction={() => void loadGroupSuggestions()} /> : visibleSuggestions.length === 0 ? <GroupEmptyState title={t('noGroupSuggestions')} detail={t('noGroupSuggestionsDesc')} /> : <GroupSuggestionGrid groups={visibleSuggestions} pendingIds={pendingIds} busyId={joiningGroupId} onNavigate={onNavigate} onJoin={(group) => void joinSuggestedGroup(group)} onDismiss={(groupId) => setDismissedSuggestions((current) => new Set(current).add(groupId))} />}
      </> : section === 'invited' ? <div className="groups-your-directory groups-event-directory">
        <section className="groups-directory-section" data-section="invited">
          <header className="groups-section-heading groups-directory-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('groupInvitationsCount', { count: visibleInvitations.length })}</h1></header>
          {groupsLoading ? <GroupsContentSkeleton cards /> : visibleInvitations.length > 0
            ? <GroupMembershipGrid groups={visibleInvitations.map((item) => item.group)} locale={locale} onNavigate={onNavigate} directory events={invitationEvents} busyId={membershipActionGroupId} onAcceptInvitation={(group) => void acceptGroupInvitation(group)} onActionError={setGroupsError} />
            : <GroupEmptyState title={t('groupInvitationsEmpty')} detail={t('groupInvitationsEmptyDesc')} />}
        </section>
      </div> : section === 'requested' ? <div className="groups-your-directory groups-event-directory">
        <section className="groups-directory-section" data-section="requested">
          <header className="groups-section-heading groups-directory-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('groupRequestsCount', { count: collections.pending.length })}</h1></header>
          {groupsLoading ? <GroupsContentSkeleton cards /> : collections.pending.length > 0
            ? <GroupMembershipGrid groups={collections.pending} locale={locale} onNavigate={onNavigate} directory events={requestEvents} busyId={membershipActionGroupId} onCancelRequest={(group) => void cancelPendingGroup(group)} onActionError={setGroupsError} />
            : <GroupEmptyState title={t('groupRequestsEmpty')} detail={t('groupRequestsEmptyDesc')} />}
        </section>
      </div> : <div className="groups-your-directory">
        {(groupsLoading || collections.managed.length > 0) && <section ref={managedGroupsSectionRef} className="groups-directory-section" data-section="managed">
          <header className="groups-section-heading groups-directory-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('managedGroupsCount', { count: collections.managed.length })}</h1></header>
          {groupsLoading ? <GroupsContentSkeleton cards /> : <GroupMembershipGrid groups={collections.managed} locale={locale} onNavigate={onNavigate} directory busyId={membershipActionGroupId} onLeave={(group) => void leaveMembershipGroup(group)} onActionError={setGroupsError} />}
        </section>}
        <section ref={joinedGroupsSectionRef} className="groups-directory-section" data-section="joined">
          <header className="groups-section-heading groups-directory-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('joinedGroupsCount', { count: sidebarJoined.length })}</h1></header>
          {groupsLoading ? <GroupsContentSkeleton cards /> : sidebarJoined.length > 0
            ? <GroupMembershipGrid groups={sidebarJoined} locale={locale} onNavigate={onNavigate} directory busyId={membershipActionGroupId} onLeave={(group) => void leaveMembershipGroup(group)} onActionError={setGroupsError} />
            : null}
        </section>
      </div>}
    </section>
  </main>
}

function GroupSidebarCollection({ title, groups, locale, onOpen, action, onAction }: { title: string; groups: GroupListItem[]; locale: string; onOpen: (group: GroupListItem) => void; action?: string; onAction?: () => void }) {
  const { t } = useI18n()
  if (groups.length === 0) return null
  return <section className="groups-sidebar-collection"><header><h2>{title}</h2>{action && <button type="button" onClick={onAction}>{action}</button>}</header><div>{groups.map((group) => {
    const activity = relativeTime(group.lastVisitedAt || '', locale)
    return <button type="button" key={group.id} onClick={() => onOpen(group)}><Avatar name={group.name} src={group.avatarUrl} size={40} className="group-square-avatar" fallback="initials" /><span><strong>{group.name}</strong><small>{activity ? t('groupLastVisited', { time: activity }) : t('groupActivityUnavailable')}</small></span></button>
  })}</div></section>
}

function GroupQuickSearchDropdown({ query, items, loading, error, onOpen, onSearchQuery }: { query: string; items: QuickGroupSearchItem[]; loading: boolean; error: string | null; onOpen: (item: QuickGroupSearchItem) => void; onSearchQuery: () => void }) {
  const { t } = useI18n()
  return <div id="groups-sidebar-search-results" className={query.length === 0 ? 'groups-quick-search-results is-recent-empty' : 'groups-quick-search-results'} aria-live="polite">
    {query.length === 0 ? <p className="groups-quick-search-empty">{t('noRecentSearches')}</p> : loading ? <div className="groups-quick-search-state"><span className="spinner" /></div> : error ? <p className="groups-quick-search-error">{error}</p> : <>
      {items.map((item) => <button type="button" className="groups-quick-search-result" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onOpen(item)}>
        <Avatar className="groups-quick-search-avatar" name={item.group.name} src={item.group.avatarUrl} size={36} fallback="initials" />
        <span><strong>{item.group.name}</strong><small>{[item.viewerIsMember ? t('searchYourGroup') : item.group.privacy === 0 ? t('publicGroup') : t('privateGroup'), ...(item.group.memberCount == null ? [] : [t('membersCount', { count: item.group.memberCount })])].join(' · ')}</small></span>
      </button>)}
      {items.length < GROUP_QUICK_SEARCH_LIMIT && <button type="button" className="groups-quick-search-query" onMouseDown={(event) => event.preventDefault()} onClick={onSearchQuery}><GroupQuickSearchMarker /><strong>{query}</strong></button>}
    </>}
  </div>
}

function GroupQuickSearchMarker() {
  return <span className="groups-quick-search-marker" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.25" cy="10.25" r="6.15" /><path d="m14.85 14.85 4.85 4.85" /></svg></span>
}

function GroupSidebarNavIcon({ kind }: { kind: 'feed' | 'discover' | 'your' | 'invited' | 'requested' }) {
  if (kind === 'feed') return <svg className="group-sidebar-nav-glyph group-sidebar-feed-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="1.5" y="2.25" width="21" height="19.5" rx="1.9" fill="currentColor" />
    <path d="M3.4 4.25c0-.38.3-.68.68-.68h15.84c.38 0 .68.3.68.68v7.55H3.4V4.25Z" fill="var(--group-nav-icon-bg)" />
    <rect x="4.8" y="5.45" width="3.4" height="3.15" rx=".48" fill="currentColor" />
    <path d="M10.2 5.75h7.4M10.2 8.2h5.75" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
  if (kind === 'discover') return <svg className="group-sidebar-nav-glyph group-sidebar-discover-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9.35" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <g transform="translate(12 12) scale(1.06) translate(-12 -12)">
      <g fill="currentColor" stroke="var(--group-nav-icon-bg)" strokeWidth="1.7" strokeLinejoin="round" paintOrder="stroke fill">
        <path d="M9.55 9.75 12-.35l2.45 10.1Z" />
        <path d="m14.25 9.55 10.1 2.45-10.1 2.45Z" />
        <path d="M14.45 14.25 12 24.35l-2.45-10.1Z" />
        <path d="M9.75 14.45-.35 12l10.1-2.45Z" />
      </g>
      <g fill="currentColor">
        <path d="m13.1 9.35 4.7-3.15-3.15 4.7Z" />
        <path d="m14.65 13.1 3.15 4.7-4.7-3.15Z" />
        <path d="m10.9 14.65-4.7 3.15 3.15-4.7Z" />
        <path d="M9.35 10.9 6.2 6.2l4.7 3.15Z" />
      </g>
    </g>
    <circle cx="12" cy="12" r="2.05" fill="var(--group-nav-icon-bg)" />
  </svg>
  if (kind === 'your') return <GroupMembersIcon className="group-sidebar-nav-glyph group-sidebar-people-glyph" />
  return <Icon name={kind === 'invited' ? 'gift' : 'clock'} size={22} className={`group-sidebar-nav-glyph group-sidebar-${kind}-glyph`} />
}

function GroupMembershipGrid({ groups, locale, onNavigate, directory = false, events, busyId = null, onLeave, onAcceptInvitation, onCancelRequest, onActionError }: {
  groups: SocialGroup[]
  locale: string
  onNavigate: (path: string) => void
  directory?: boolean
  events?: Record<string, GroupDirectoryEvent>
  busyId?: string | null
  onLeave?: (group: SocialGroup) => void
  onAcceptInvitation?: (group: SocialGroup) => void
  onCancelRequest?: (group: SocialGroup) => void
  onActionError?: (message: string) => void
}) {
  const { t } = useI18n()
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  function closeMenu() {
    setMenuGroupId(null)
    setMenuAnchor(null)
  }

  async function copyGroupLink(group: SocialGroup) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(`${window.location.origin}/groups/${encodeURIComponent(group.id)}`)
      closeMenu()
    } catch {
      onActionError?.(t('copyLinkError'))
    }
  }

  return <div className={directory ? 'groups-membership-grid groups-membership-grid-directory' : 'groups-membership-grid'}>{groups.map((group) => {
    const visitedAt = 'lastVisitedAt' in group ? String(group.lastVisitedAt ?? '') : ''
    const time = directory ? groupVisitRelativeTime(visitedAt, locale) : relativeTime(visitedAt, locale)
    const event = events?.[group.id]
    const eventTime = event ? relativeTime(event.occurredAt, locale) : ''
    const menuOpen = menuGroupId === group.id
    const primaryLabel = event?.kind === 'invited' && onAcceptInvitation
      ? t('acceptGroupInvitation')
      : event?.kind === 'requested' && onCancelRequest
        ? t('cancel')
        : t('viewGroup')
    const runPrimaryAction = () => {
      if (event?.kind === 'invited' && onAcceptInvitation) onAcceptInvitation(group)
      else if (event?.kind === 'requested' && onCancelRequest) onCancelRequest(group)
      else onNavigate(`/groups/${group.id}`)
    }
    const moreMenu = <div className="groups-more-menu-host"><button type="button" className="groups-more-button" aria-label={t('more')} aria-haspopup="menu" aria-expanded={menuOpen} disabled={busyId === group.id} onClick={(clickEvent) => {
      const open = !menuOpen
      setMenuGroupId(open ? group.id : null)
      setMenuAnchor(open ? clickEvent.currentTarget : null)
    }}><Icon name="more" size={18} /></button>{menuOpen && <AnchoredMenuPortal anchor={menuAnchor} className="groups-membership-menu" onRequestClose={closeMenu}>
      <button type="button" role="menuitem" onClick={() => { closeMenu(); onNavigate(`/groups/${group.id}`) }}><Icon name="groups" size={18} />{t('viewGroup')}</button>
      <button type="button" role="menuitem" onClick={() => void copyGroupLink(group)}><Icon name="link" size={18} />{t('copyLink')}</button>
      {onCancelRequest && <button type="button" role="menuitem" disabled={busyId === group.id} onClick={() => { closeMenu(); onCancelRequest(group) }}><Icon name="close" size={18} />{t('cancelJoinRequest')}</button>}
      {onLeave && <button type="button" role="menuitem" className="danger-text" disabled={busyId === group.id} onClick={() => { closeMenu(); onLeave(group) }}><Icon name="logout" size={18} />{t('leaveGroup')}</button>}
    </AnchoredMenuPortal>}</div>
    if (directory) {
      return <article className="groups-membership-card groups-membership-card-directory" key={group.id}>
        <button type="button" className="groups-membership-summary groups-directory-group-summary" onClick={() => onNavigate(`/groups/${group.id}`)}>
          <Avatar name={group.name} src={group.avatarUrl} size={72} className="group-square-avatar" fallback="initials" />
          <span className="groups-directory-group-copy">
            <strong>{group.name}</strong>
            <span className="groups-directory-group-meta groups-directory-muted-copy">
              <span className="groups-directory-group-privacy"><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 1} group={group.privacy !== 0} size={15} />{group.privacy === 0 ? t('groupPublicVisibility') : t('groupPrivateVisibility')}</span>
              <b className="groups-meta-separator" aria-hidden="true">·</b>
              <span>{t('membersCount', { count: group.memberCount ?? 0 })}</span>
            </span>
            {event?.kind === 'invited' ? <span className="groups-directory-event groups-directory-invitation-event"><Avatar name={event.actor?.displayName || t('fakebookUser')} src={event.actor?.avatarUrl} size={22} /><small>{t('groupInvitedByAgo', { name: event.actor?.displayName || t('fakebookUser'), time: eventTime || t('groupRecentlyActive') })}</small></span> : event?.kind === 'requested' ? <small className="groups-directory-muted-copy groups-directory-request-event">{t('groupRequestedAgo', { time: eventTime || t('groupRecentlyActive') })}</small> : <><small className="groups-directory-muted-copy">{t('groupLastVisitedLabel')}</small><small className="groups-directory-muted-copy">{time || t('groupActivityUnavailable')}</small></>}
          </span>
        </button>
        <div className="groups-directory-group-actions"><button type="button" className="groups-view-button" disabled={busyId === group.id} onClick={runPrimaryAction}>{busyId === group.id ? t('working') : primaryLabel}</button>{moreMenu}</div>
      </article>
    }
    return <article className="groups-membership-card" key={group.id}>
      <button type="button" className="groups-membership-summary" onClick={() => onNavigate(`/groups/${group.id}`)}><Avatar name={group.name} src={group.avatarUrl} size={88} className="group-square-avatar" fallback="initials" /><span><strong>{group.name}</strong><small>{time ? t('groupLastVisited', { time }) : group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</small></span></button>
      <div><button type="button" className="groups-view-button" onClick={() => onNavigate(`/groups/${group.id}`)}>{t('viewGroup')}</button>{moreMenu}</div>
    </article>
  })}</div>
}

function GroupSuggestionGrid({ groups, pendingIds, busyId, onNavigate, onJoin, onDismiss }: { groups: GroupSuggestion[]; pendingIds: ReadonlySet<string>; busyId: string | null; onNavigate: (path: string) => void; onJoin: (group: SocialGroup) => void; onDismiss: (groupId: string) => void }) {
  const { t } = useI18n()
  return <div className="groups-suggestion-grid">{groups.map((suggestion) => {
    const group = suggestion.group
    const firstFriend = suggestion.friendMembers[0]
    const remainingFriends = Math.max(0, suggestion.friendMemberCount - 1)
    const isPending = pendingIds.has(group.id)
    return <article className="groups-suggestion-card" key={group.id}>
      <button type="button" className="groups-suggestion-cover" aria-label={group.name} onClick={() => onNavigate(`/groups/${group.id}`)} style={group.backgroundUrl || group.avatarUrl ? { backgroundImage: `url(${group.backgroundUrl || group.avatarUrl})` } : undefined} />
      <button type="button" className="groups-suggestion-dismiss" aria-label={t('dismiss')} onClick={() => onDismiss(group.id)}><Icon name="close" size={17} /></button>
      <div className="groups-suggestion-copy">
        <button type="button" className="groups-suggestion-name" onClick={() => onNavigate(`/groups/${group.id}`)}><strong>{group.name}</strong></button>
        <div className="groups-suggestion-meta">
          <span className="groups-suggestion-privacy"><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 1} group={group.privacy !== 0} size={15} />{group.privacy === 0 ? t('groupPublicVisibility') : t('groupPrivateVisibility')}</span>
          <b className="groups-meta-separator" aria-hidden="true">·</b>
          <span>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</span>
          <b className="groups-meta-separator" aria-hidden="true">·</b>
          <span>{t('groupPostsPerDay', { count: suggestion.yesterdayPostCount })}</span>
        </div>
        {firstFriend && <div className="groups-suggestion-friends">
          <span className="groups-suggestion-friend-avatars" aria-hidden="true">{suggestion.friendMembers.slice(0, 3).map((friend) => <Avatar key={friend.id} name={friend.displayName} src={friend.avatarUrl} size={24} />)}</span>
          <span>{remainingFriends > 0
            ? t('groupFriendMembers', { name: firstFriend.displayName, count: remainingFriends })
            : t('groupFriendMemberSingle', { name: firstFriend.displayName })}</span>
        </div>}
        <button type="button" className={isPending ? 'groups-join-button is-pending' : 'groups-join-button'} title={isPending ? t('cancelJoinRequest') : undefined} disabled={busyId === group.id} onClick={() => onJoin(group)}>{busyId === group.id ? t('working') : isPending ? t('joinRequested') : t('joinGroupLong')}</button>
      </div>
    </article>
  })}</div>
}

function GroupEmptyState({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="groups-empty-state"><span><Icon name="groups" size={34} /></span><h2>{title}</h2><p>{detail}</p>{action && <button type="button" className="btn-primary" onClick={onAction}>{action}</button>}</div>
}

function GroupsContentSkeleton({ cards = false }: { cards?: boolean }) {
  const { t } = useI18n()
  if (cards) return <div className="groups-card-skeleton-grid" role="status" aria-label={t('loadingMore')}>{Array.from({ length: 6 }, (_, index) => <article className="groups-card-skeleton" aria-hidden="true" key={index}><span className="cover" /><div><span className="title" /><span className="meta" /><span className="action" /></div></article>)}</div>
  return <div className="groups-feed-skeleton" role="status" aria-label={t('loadingMore')}>{Array.from({ length: 2 }, (_, index) => <article className="card gateway-post home-feed-skeleton" aria-hidden="true" key={index}>
    <header className="feed-post-head"><span className="home-feed-skeleton-avatar" /><div className="home-feed-skeleton-heading"><span /><span /></div></header>
    <div className="home-feed-skeleton-copy"><span /><span /><span /></div>
    <div className="home-feed-skeleton-media" />
    <div className="home-feed-skeleton-actions"><span /><span /><span /></div>
  </article>)}</div>
}

function GroupsSidebarCollectionsSkeleton() {
  return <div className="groups-sidebar-collections-skeleton" aria-hidden="true">{[2, 3].map((rows, collectionIndex) => <section className="groups-sidebar-collection groups-sidebar-collection-skeleton" key={collectionIndex}>
    <header><span className="groups-sidebar-skeleton-title" /><span className="groups-sidebar-skeleton-action" /></header>
    <div>{Array.from({ length: rows }, (_, rowIndex) => <div className="groups-sidebar-skeleton-row" key={rowIndex}><span className="groups-sidebar-skeleton-avatar" /><span className="groups-sidebar-skeleton-copy"><i /><i /></span></div>)}</div>
  </section>)}</div>
}

function CreateGroupExperience({ userId, profile, onClose, onCreated }: { userId: string; profile?: SocialProfile | null; onClose: () => void; onCreated: (group: SocialGroup) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [privacy, setPrivacy] = useState<number | ''>('')
  const [friends, setFriends] = useState<SocialProfile[]>([])
  const [inviteQuery, setInviteQuery] = useState('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    socialApi.getRelationProfiles(userId, 0, 100).then((items) => {
      if (active) setFriends(items.filter((person) => person.id !== userId))
    }).catch(() => undefined)
    return () => { active = false }
  }, [userId])

  const normalizedInviteQuery = inviteQuery.trim().toLocaleLowerCase()
  const visibleFriends = friends.filter((friend) => !normalizedInviteQuery || friend.displayName.toLocaleLowerCase().includes(normalizedInviteQuery)).slice(0, 6)
  const selectedFriends = friends.filter((friend) => selectedFriendIds.has(friend.id))

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((current) => {
      const next = new Set(current)
      if (next.has(friendId)) next.delete(friendId)
      else next.add(friendId)
      return next
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || privacy === '') return
    setBusy(true)
    setError(null)
    try {
      const group = await socialApi.createGroup(userId, { name: name.trim(), bio: '', privacy })
      await Promise.allSettled([...selectedFriendIds].map((friendId) => socialApi.inviteGroupUser(group.id, friendId)))
      onCreated(group)
    } catch {
      setError(t('createGroupError'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="group-create-page">
    <form className="group-create-panel" onSubmit={submit}>
      <header className="group-create-panel-head"><button type="button" className="group-create-close" onClick={onClose} aria-label={t('close')}><Icon name="close" size={24} /></button><img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" /></header>
      <p className="group-create-breadcrumb">{t('groups')} › {t('createGroup')}</p>
      <h1>{t('createGroup')}</h1>
      <div className="group-create-owner"><Avatar name={profile?.displayName || t('fakebookUser')} src={profile?.avatarUrl} size={42} /><span><strong>{profile?.displayName || t('fakebookUser')}</strong><small>{t('groupAdmin')}</small></span></div>
      <label className="group-create-field"><span>{t('groupName')}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={INPUT_LIMITS.groupName} /></label>
      <label className="group-create-field"><span>{t('groupPrivacyPlaceholder')}</span><select value={privacy} onChange={(event) => setPrivacy(event.target.value === '' ? '' : Number(event.target.value))}><option value="">{t('groupPrivacyPlaceholder')}</option><option value={0}>{t('publicGroup')}</option><option value={1}>{t('privateGroup')}</option></select></label>
      <div className="group-create-invites">
        <label className="group-create-field"><span>{t('inviteFriendsOptional')}</span><input value={inviteQuery} maxLength={INPUT_LIMITS.search} onChange={(event) => setInviteQuery(event.target.value)} placeholder={t('searchFriends')} /></label>
        {selectedFriends.length > 0 && <div className="group-create-selected-friends">{selectedFriends.map((friend) => <button type="button" key={friend.id} onClick={() => toggleFriend(friend.id)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={24} /><span>{friend.displayName}</span><Icon name="close" size={13} /></button>)}</div>}
        {inviteQuery.trim() && visibleFriends.length > 0 && <div className="group-create-friend-results">{visibleFriends.map((friend) => <button type="button" className={selectedFriendIds.has(friend.id) ? 'selected' : ''} key={friend.id} onClick={() => toggleFriend(friend.id)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={34} /><span>{friend.displayName}</span>{selectedFriendIds.has(friend.id) && <Icon name="check" size={17} />}</button>)}</div>}
        {!inviteQuery.trim() && friends.length > 0 && <small>{t('inviteSuggestions', { names: friends.slice(0, 3).map((friend) => friend.displayName).join(', ') })}</small>}
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="group-create-submit" disabled={busy || !name.trim() || privacy === ''}>{busy ? t('creating') : t('createGroup')}</button>
    </form>

    <section className="group-create-preview-stage">
      <article className="group-create-preview-card">
        <header><strong>{t('desktopPreview')}</strong><span><Icon name="watch" size={21} /><Icon name="phone" size={18} /></span></header>
        <div className="group-create-preview-cover"><Icon name="groups" size={86} /></div>
        <div className="group-create-preview-copy"><h2>{name.trim() || t('groupName')}</h2><p>{privacy === '' ? t('groupPrivacyPlaceholder') : privacy === 0 ? t('publicGroup') : t('privateGroup')} · {t('singleMember')}</p><nav><span>{t('about')}</span><span>{t('postsLabel')}</span><span>{t('members')}</span><span>{t('events')}</span></nav></div>
        <div className="group-create-preview-body"><div className="group-create-preview-composer"><div><Avatar name={profile?.displayName || t('fakebookUser')} src={profile?.avatarUrl} size={36} /><span>{t('groupPostPrompt')}</span></div><footer><span><Icon name="photo" size={19} />{t('photoVideo')}</span><span><Icon name="tag" size={19} />{t('tagPeople')}</span><span><Icon name="feeling" size={19} />{t('feelingActivity')}</span></footer></div><aside><strong>{t('about')}</strong></aside></div>
      </article>
    </section>
  </main>
}

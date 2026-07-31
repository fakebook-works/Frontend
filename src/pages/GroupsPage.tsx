import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, visibleRecommendationPosts } from '../api/client'
import type { GatewayPost } from '../api/gatewayTypes'
import { searchApi, type QuickGroupSearchItem } from '../api/search'
import { socialApi, type GroupMembershipState, type GroupSuggestion, type SocialGroup, type SocialPhoto, type SocialProfile } from '../api/social'
import type { MediaUpload, UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { ImageCropModal } from '../components/ImageCropModal'
import { Icon } from '../components/Icon'
import { MentionSuggestions } from '../components/MentionSuggestions'
import { MentionDraftOverlay } from '../components/MentionDraftOverlay'
import { PostPrivacyIcon } from '../components/PostPrivacyIcon'
import { SidebarSettingsIcon } from '../components/SidebarSettingsIcon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { groupVisitRelativeTime, relativeTime } from '../lib/format'
import { applyMentionSelection, reconcileMentionEntities, serializeMentionContent, type MentionEntity } from '../lib/mentions'
import { GatewayPostCard } from './GatewayHomePage'

type GroupSection = 'feed' | 'discover' | 'your'
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

const GROUP_FEED_BATCH = 60
const GROUP_QUICK_SEARCH_LIMIT = 8
const GROUP_SCOPE_SEARCH_LIMIT = 24
const EMPTY_GROUPS: GroupCollections = { joined: [], managed: [], pending: [], recent: [] }

export function GroupsPage({ userId, profile, onNavigate }: { userId: string; profile?: SocialProfile | null; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [collections, setCollections] = useState<GroupCollections>(EMPTY_GROUPS)
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
    const [joinedResult, managedResult, pendingResult, recentResult] = await Promise.allSettled([
      socialApi.getMemberGroups(userId, 50),
      socialApi.getAdminGroups(userId, 50),
      socialApi.getPendingGroupJoins(userId, 50),
      api.visitedGroups(userId, 50),
    ])
    try {
      const results = [joinedResult, managedResult, pendingResult, recentResult]
      if (results.every((result) => result.status === 'rejected')) {
        setCollections(EMPTY_GROUPS)
        setGroupsError(t('groupsLoadError'))
        return
      }

      const recentVisits = recentResult.status === 'fulfilled' ? recentResult.value.items : []
      const details = recentVisits.length > 0
        ? await socialApi.getGroups(recentVisits.map((group) => group.id)).catch(() => [])
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
      setCollections({
        joined: joinedResult.status === 'fulfilled' ? joinedResult.value.items.map(withVisit) : [],
        managed: managedResult.status === 'fulfilled' ? managedResult.value.items.map(withVisit) : [],
        pending: pendingResult.status === 'fulfilled' ? pendingResult.value.items.map(withVisit) : [],
        recent,
      })
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
      const items = await api.recommendedFeed(userId, offset, GROUP_FEED_BATCH)
      const nextPosts = visibleRecommendationPosts(items).filter((post) => post.__typename === 'GroupPostDetail')
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
  const membershipIds = useMemo(() => new Set([...allJoinedGroups, ...collections.pending].map((group) => group.id)), [allJoinedGroups, collections.pending])
  const visibleSuggestions = suggestedGroups.filter((suggestion) => !dismissedSuggestions.has(suggestion.group.id) && !membershipIds.has(suggestion.group.id))
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
    setJoiningGroupId(group.id)
    setGroupsError(null)
    try {
      if (!await socialApi.requestJoinGroup(userId, group.id)) throw new Error('Join rejected')
      if (group.privacy === 0) {
        setCollections((current) => ({
          ...current,
          joined: [group, ...current.joined.filter((item) => item.id !== group.id)],
        }))
        setSuggestedGroups((current) => current.filter((item) => item.group.id !== group.id))
      } else {
        setCollections((current) => ({
          ...current,
          pending: [group, ...current.pending.filter((item) => item.id !== group.id)],
        }))
      }
    } catch {
      setGroupsError(t('joinGroupError'))
    } finally {
      setJoiningGroupId(null)
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
          <label className="groups-search"><svg className="groups-search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10.25" cy="10.25" r="6.15" /><path d="m14.85 14.85 4.85 4.85" /></svg><input ref={searchInputRef} value={searchText} onChange={(event) => { const value = event.target.value; setSearchText(value); if (value.trim().length === 0) setSubmittedQuery('') }} placeholder={t('groupSearchPlaceholder')} aria-label={t('groupSearchPlaceholder')} aria-expanded={searchOpen} aria-controls="groups-sidebar-search-results" autoComplete="off" /></label>
          {searchOpen && <GroupQuickSearchDropdown query={searchText.trim()} items={quickGroups} loading={quickLoading} error={quickError} onOpen={openQuickGroup} onSearchQuery={runGroupSearch} />}
        </form>
      </div>
      <nav className="groups-primary-nav" aria-label={t('groups')}>
        <button type="button" className={section === 'feed' && !searching ? 'active' : ''} onClick={() => selectSection('feed')}><span><GroupSidebarNavIcon kind="feed" /></span><strong>{t('groupFeedNav')}</strong></button>
        <button type="button" className={section === 'discover' && !searching ? 'active' : ''} onClick={() => selectSection('discover')}><span><GroupSidebarNavIcon kind="discover" /></span><strong>{t('groupDiscover')}</strong></button>
        <button type="button" className={section === 'your' && !searching ? 'active' : ''} onClick={() => selectSection('your')}><span><GroupSidebarNavIcon kind="your" /></span><strong>{t('yourGroups')}</strong></button>
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
          {feedLoading && groupPosts.length === 0 ? <GroupsContentSkeleton /> : feedError && groupPosts.length === 0 ? <GroupEmptyState title={t('unableToLoad')} detail={feedError} action={t('tryAgain')} onAction={() => void requestRecommendations(0, false)} /> : groupPosts.length === 0 ? <GroupEmptyState title={t('groupFeedEmpty')} detail={t('groupFeedRecommendationEmpty')} /> : groupPosts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} />)}
          <div ref={feedSentinelRef} className="groups-feed-sentinel" aria-live="polite">{feedMoreLoading && <span className="spinner" aria-label={t('loadingMore')} />}{!feedHasMore && groupPosts.length > 0 && <span className="muted">{t('endOfFeed')}</span>}</div>
        </div>
      </> : section === 'discover' ? <>
        <header className="groups-section-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('moreGroupSuggestions')}</h1></header>
        {suggestionsLoading && visibleSuggestions.length === 0 ? <GroupsContentSkeleton cards /> : suggestionsError && visibleSuggestions.length === 0 ? <GroupEmptyState title={t('unableToLoad')} detail={suggestionsError} action={t('tryAgain')} onAction={() => void loadGroupSuggestions()} /> : visibleSuggestions.length === 0 ? <GroupEmptyState title={t('noGroupSuggestions')} detail={t('noGroupSuggestionsDesc')} /> : <GroupSuggestionGrid groups={visibleSuggestions} busyId={joiningGroupId} onNavigate={onNavigate} onJoin={(group) => void joinSuggestedGroup(group)} onDismiss={(groupId) => setDismissedSuggestions((current) => new Set(current).add(groupId))} />}
      </> : <div className="groups-your-directory">
        {(groupsLoading || collections.managed.length > 0) && <section ref={managedGroupsSectionRef} className="groups-directory-section" data-section="managed">
          <header className="groups-section-heading groups-directory-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('managedGroupsCount', { count: collections.managed.length })}</h1></header>
          {groupsLoading ? <GroupsContentSkeleton cards /> : <GroupMembershipGrid groups={collections.managed} locale={locale} onNavigate={onNavigate} directory />}
        </section>}
        <section ref={joinedGroupsSectionRef} className="groups-directory-section" data-section="joined">
          <header className="groups-section-heading groups-directory-heading groups-hub-title-row"><h1 className="groups-hub-heading-text">{t('joinedGroupsCount', { count: sidebarJoined.length })}</h1></header>
          {groupsLoading ? <GroupsContentSkeleton cards /> : sidebarJoined.length > 0
            ? <GroupMembershipGrid groups={sidebarJoined} locale={locale} onNavigate={onNavigate} directory />
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
    return <button type="button" key={group.id} onClick={() => onOpen(group)}><Avatar name={group.name} src={group.avatarUrl} size={40} className="group-square-avatar" /><span><strong>{group.name}</strong><small>{activity ? t('groupLastVisited', { time: activity }) : t('groupActivityUnavailable')}</small></span></button>
  })}</div></section>
}

function GroupQuickSearchDropdown({ query, items, loading, error, onOpen, onSearchQuery }: { query: string; items: QuickGroupSearchItem[]; loading: boolean; error: string | null; onOpen: (item: QuickGroupSearchItem) => void; onSearchQuery: () => void }) {
  const { t } = useI18n()
  return <div id="groups-sidebar-search-results" className={query.length === 0 ? 'groups-quick-search-results is-recent-empty' : 'groups-quick-search-results'} aria-live="polite">
    {query.length === 0 ? <p className="groups-quick-search-empty">{t('noRecentSearches')}</p> : loading ? <div className="groups-quick-search-state"><span className="spinner" /></div> : error ? <p className="groups-quick-search-error">{error}</p> : <>
      {items.map((item) => <button type="button" className="groups-quick-search-result" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onOpen(item)}>
        <Avatar className="groups-quick-search-avatar" name={item.group.name} src={item.group.avatarUrl} size={36} />
        <span><strong>{item.group.name}</strong><small>{[item.viewerIsMember ? t('searchYourGroup') : item.group.privacy === 0 ? t('publicGroup') : t('privateGroup'), ...(item.group.memberCount == null ? [] : [t('membersCount', { count: item.group.memberCount })])].join(' · ')}</small></span>
      </button>)}
      {items.length < GROUP_QUICK_SEARCH_LIMIT && <button type="button" className="groups-quick-search-query" onMouseDown={(event) => event.preventDefault()} onClick={onSearchQuery}><GroupQuickSearchMarker /><strong>{query}</strong></button>}
    </>}
  </div>
}

function GroupQuickSearchMarker() {
  return <span className="groups-quick-search-marker" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.25" cy="10.25" r="6.15" /><path d="m14.85 14.85 4.85 4.85" /></svg></span>
}

function GroupSidebarNavIcon({ kind }: { kind: 'feed' | 'discover' | 'your' }) {
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
  return <svg className="group-sidebar-nav-glyph group-sidebar-people-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g transform="translate(0 -1.05)" fill="currentColor" stroke="var(--group-nav-icon-bg)" strokeWidth="1.15" strokeLinejoin="round">
      <path d="M0-1.8c-4.2 0-7 2.5-7 6.2 0 1.2 1.25 2.17 2.8 2.17h8.4C5.75 6.57 7 5.6 7 4.4 7 .7 4.2-1.8 0-1.8Z" transform="translate(6.15 13.85) scale(.78)" vectorEffect="non-scaling-stroke" />
      <path d="M0-1.8c-4.2 0-7 2.5-7 6.2 0 1.2 1.25 2.17 2.8 2.17h8.4C5.75 6.57 7 5.6 7 4.4 7 .7 4.2-1.8 0-1.8Z" transform="translate(17.85 13.85) scale(.78)" vectorEffect="non-scaling-stroke" />
      <path d="M0-1.8c-4.2 0-7 2.5-7 6.2 0 1.2 1.25 2.17 2.8 2.17h8.4C5.75 6.57 7 5.6 7 4.4 7 .7 4.2-1.8 0-1.8Z" transform="translate(12 14.9) scale(.97)" vectorEffect="non-scaling-stroke" />
      <circle cx="6.15" cy="8.7" r="3" />
      <circle cx="17.85" cy="8.7" r="3" />
      <circle cx="12" cy="8.75" r="3.4" strokeWidth="1.2" />
    </g>
  </svg>
}

function GroupMembershipGrid({ groups, locale, onNavigate, directory = false }: { groups: SocialGroup[]; locale: string; onNavigate: (path: string) => void; directory?: boolean }) {
  const { t } = useI18n()
  return <div className={directory ? 'groups-membership-grid groups-membership-grid-directory' : 'groups-membership-grid'}>{groups.map((group) => {
    const visitedAt = 'lastVisitedAt' in group ? String(group.lastVisitedAt ?? '') : ''
    const time = directory ? groupVisitRelativeTime(visitedAt, locale) : relativeTime(visitedAt, locale)
    if (directory) {
      return <article className="groups-membership-card groups-membership-card-directory" key={group.id}>
        <button type="button" className="groups-membership-summary groups-directory-group-summary" onClick={() => onNavigate(`/groups/${group.id}`)}>
          <Avatar name={group.name} src={group.avatarUrl} size={72} className="group-square-avatar" />
          <span className="groups-directory-group-copy">
            <strong>{group.name}</strong>
            <span className="groups-directory-group-meta groups-directory-muted-copy">
              <span>{t('membersCount', { count: group.memberCount ?? 0 })}</span>
              <b aria-hidden="true">·</b>
              <span><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 1} group={group.privacy !== 0} size={15} />{group.privacy === 0 ? t('groupPublicVisibility') : t('groupPrivateVisibility')}</span>
            </span>
            <small className="groups-directory-muted-copy">{t('groupLastVisitedLabel')}</small>
            <small className="groups-directory-muted-copy">{time || t('groupActivityUnavailable')}</small>
          </span>
        </button>
        <div className="groups-directory-group-actions"><button type="button" className="groups-view-button" onClick={() => onNavigate(`/groups/${group.id}`)}>{t('viewGroup')}</button><button type="button" className="groups-more-button" aria-label={t('more')}><Icon name="more" size={18} /></button></div>
      </article>
    }
    return <article className="groups-membership-card" key={group.id}>
      <button type="button" className="groups-membership-summary" onClick={() => onNavigate(`/groups/${group.id}`)}><Avatar name={group.name} src={group.avatarUrl} size={88} className="group-square-avatar" /><span><strong>{group.name}</strong><small>{time ? t('groupLastVisited', { time }) : group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</small></span></button>
      <div><button type="button" className="groups-view-button" onClick={() => onNavigate(`/groups/${group.id}`)}>{t('viewGroup')}</button><button type="button" className="groups-more-button" aria-label={t('more')}><Icon name="more" size={18} /></button></div>
    </article>
  })}</div>
}

function GroupSuggestionGrid({ groups, busyId, onNavigate, onJoin, onDismiss }: { groups: GroupSuggestion[]; busyId: string | null; onNavigate: (path: string) => void; onJoin: (group: SocialGroup) => void; onDismiss: (groupId: string) => void }) {
  const { t } = useI18n()
  return <div className="groups-suggestion-grid">{groups.map((suggestion) => {
    const group = suggestion.group
    const firstFriend = suggestion.friendMembers[0]
    const remainingFriends = Math.max(0, suggestion.friendMemberCount - 1)
    return <article className="groups-suggestion-card" key={group.id}>
      <button type="button" className="groups-suggestion-cover" aria-label={group.name} onClick={() => onNavigate(`/groups/${group.id}`)} style={group.backgroundUrl || group.avatarUrl ? { backgroundImage: `url(${group.backgroundUrl || group.avatarUrl})` } : undefined} />
      <button type="button" className="groups-suggestion-dismiss" aria-label={t('dismiss')} onClick={() => onDismiss(group.id)}><Icon name="close" size={17} /></button>
      <div className="groups-suggestion-copy">
        <button type="button" className="groups-suggestion-name" onClick={() => onNavigate(`/groups/${group.id}`)}><strong>{group.name}</strong></button>
        <div className="groups-suggestion-meta">
          <span>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</span>
          <b aria-hidden="true">·</b>
          <span>{t('groupPostsPerDay', { count: suggestion.yesterdayPostCount })}</span>
          <b aria-hidden="true">·</b>
          <span className="groups-suggestion-privacy"><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 1} group={group.privacy !== 0} size={15} />{group.privacy === 0 ? t('groupPublicVisibility') : t('groupPrivateVisibility')}</span>
        </div>
        {firstFriend && <div className="groups-suggestion-friends">
          <span className="groups-suggestion-friend-avatars" aria-hidden="true">{suggestion.friendMembers.slice(0, 3).map((friend) => <Avatar key={friend.id} name={friend.displayName} src={friend.avatarUrl} size={24} />)}</span>
          <span>{remainingFriends > 0
            ? t('groupFriendMembers', { name: firstFriend.displayName, count: remainingFriends })
            : t('groupFriendMemberSingle', { name: firstFriend.displayName })}</span>
        </div>}
        <button type="button" className="groups-join-button" disabled={busyId === group.id} onClick={() => onJoin(group)}>{busyId === group.id ? t('working') : t('joinGroupLong')}</button>
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
      <label className="group-create-field"><span>{t('groupName')}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></label>
      <label className="group-create-field"><span>{t('groupPrivacyPlaceholder')}</span><select value={privacy} onChange={(event) => setPrivacy(event.target.value === '' ? '' : Number(event.target.value))}><option value="">{t('groupPrivacyPlaceholder')}</option><option value={0}>{t('publicGroup')}</option><option value={1}>{t('privateGroup')}</option></select></label>
      <div className="group-create-invites">
        <label className="group-create-field"><span>{t('inviteFriendsOptional')}</span><input value={inviteQuery} onChange={(event) => setInviteQuery(event.target.value)} placeholder={t('searchFriends')} /></label>
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

type GroupTab = 'posts' | 'photos' | 'about' | 'members' | 'requests'

export function GroupProfilePage({ groupId, userId, onBack, onNavigate }: { groupId: string; userId: string; onBack: () => void; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [group, setGroup] = useState<SocialGroup | null>(null)
  const [membership, setMembership] = useState<GroupMembershipState>({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: false })
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [photos, setPhotos] = useState<SocialPhoto[]>([])
  const [postCursor, setPostCursor] = useState<string | null>(null)
  const [postsHaveMore, setPostsHaveMore] = useState(false)
  const [photoCursor, setPhotoCursor] = useState<string | null>(null)
  const [photosHaveMore, setPhotosHaveMore] = useState(false)
  const [members, setMembers] = useState<UserSummary[]>([])
  const [admins, setAdmins] = useState<UserSummary[]>([])
  const [requests, setRequests] = useState<SocialProfile[]>([])
  const [tab, setTab] = useState<GroupTab>('posts')
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [groupValue, membershipValue] = await Promise.all([
        socialApi.getGroup(groupId),
        socialApi.getGroupMembershipState(userId, groupId),
      ])
      setGroup(groupValue)
      setMembership(membershipValue)
      if (groupValue) void socialApi.recordGroupVisit(userId, groupId).catch(() => undefined)
    } catch {
      setError(t('groupsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [groupId, t, userId])

  useEffect(() => { void load() }, [load])

  const loadPosts = useCallback(async (cursor: string | null = null, append = false) => {
    if (!membership.canViewPosts) {
      setPosts([])
      setPostCursor(null)
      setPostsHaveMore(false)
      return
    }
    setPostsLoading(true)
    try {
      const page = await socialApi.getGroupPosts(groupId, 20, cursor)
      setPosts((current) => append ? [...current, ...page.items] : page.items)
      setPostCursor(page.endCursor)
      setPostsHaveMore(page.hasNextPage)
    } catch {
      setError(t('groupPostsLoadError'))
    } finally {
      setPostsLoading(false)
    }
  }, [groupId, membership.canViewPosts, t])

  useEffect(() => { void loadPosts() }, [loadPosts])

  const loadPhotos = useCallback(async (cursor: string | null = null, append = false) => {
    if (!membership.canViewPosts) {
      setPhotos([])
      setPhotoCursor(null)
      setPhotosHaveMore(false)
      return
    }
    setPhotosLoading(true)
    try {
      const page = await socialApi.getGroupPhotos(groupId, 60, cursor)
      setPhotos((current) => append ? [...current, ...page.items] : page.items)
      setPhotoCursor(page.endCursor)
      setPhotosHaveMore(page.hasNextPage)
    } catch {
      if (!append) setPhotos([])
      setError(t('profileMediaLoadError'))
    } finally {
      setPhotosLoading(false)
    }
  }, [groupId, membership.canViewPosts, t])

  useEffect(() => {
    if (tab === 'photos') void loadPhotos()
  }, [loadPhotos, tab])

  const loadPeople = useCallback(async () => {
    setPeopleLoading(true)
    try {
      const [memberPage, adminPage] = await Promise.all([
        socialApi.getGroupMembers(groupId, 50),
        socialApi.getGroupAdmins(groupId, 50),
      ])
      setMembers(memberPage.items)
      setAdmins(adminPage.items)
    } catch {
      setError(t('groupMembersLoadError'))
    } finally {
      setPeopleLoading(false)
    }
  }, [groupId, t])

  useEffect(() => { void loadPeople() }, [loadPeople])

  const loadRequests = useCallback(async () => {
    if (!membership.isAdmin) {
      setRequests([])
      return
    }
    setRequestsLoading(true)
    try { setRequests(await socialApi.getGroupJoinRequests(groupId)) } catch { setError(t('groupRequestsLoadError')) } finally { setRequestsLoading(false) }
  }, [groupId, membership.isAdmin, t])

  useEffect(() => { void loadRequests() }, [loadRequests])

  const tabs = useMemo(() => {
    const values: Array<{ id: GroupTab; label: string }> = [
      { id: 'posts', label: t('postsLabel') },
      { id: 'photos', label: t('photos') },
      { id: 'about', label: t('about') },
      { id: 'members', label: t('members') },
    ]
    if (membership.isAdmin) values.push({ id: 'requests', label: t('joinRequests') })
    return values
  }, [membership.isAdmin, t])
  const excludedInviteIds = useMemo(() => new Set([...members, ...admins].map((person) => person.id)), [admins, members])
  const adminIds = useMemo(() => new Set(admins.map((person) => person.id)), [admins])
  const nonAdminMembers = useMemo(() => members.filter((person) => !adminIds.has(person.id)), [adminIds, members])

  async function membershipAction(action: 'join' | 'cancel' | 'leave') {
    if (!group) return
    setBusy(true)
    setError(null)
    try {
      const success = action === 'join'
        ? await socialApi.requestJoinGroup(userId, groupId)
        : action === 'cancel'
          ? await socialApi.cancelJoinGroupRequest(userId, groupId)
          : await socialApi.leaveGroup(userId, groupId)
      if (!success) throw new Error('Action rejected')
      if (action === 'join' && group.privacy === 0) {
        setMembership({ isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true })
        setGroup((current) => current ? { ...current, memberCount: current.memberCount == null ? null : current.memberCount + 1 } : current)
      } else if (action === 'join') {
        setMembership((current) => ({ ...current, joinRequestPending: true }))
      } else if (action === 'cancel') {
        setMembership((current) => ({ ...current, joinRequestPending: false }))
      } else {
        setMembership({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: group.privacy === 0 })
        setGroup((current) => current ? { ...current, memberCount: current.memberCount == null ? null : Math.max(0, current.memberCount - 1) } : current)
      }
      await loadPeople()
    } catch {
      setError(action === 'leave' ? t('leaveGroupError') : t('joinGroupError'))
    } finally {
      setBusy(false)
    }
  }

  async function reviewRequest(profileId: string, approve: boolean) {
    setBusyUserId(profileId)
    setError(null)
    try {
      const success = approve
        ? await socialApi.approveGroupJoinRequest(groupId, profileId)
        : await socialApi.rejectGroupJoinRequest(groupId, profileId)
      if (!success) throw new Error('Action rejected')
      setRequests((current) => current.filter((profile) => profile.id !== profileId))
      if (approve) {
        setGroup((current) => current ? { ...current, memberCount: current.memberCount == null ? null : current.memberCount + 1 } : current)
        await loadPeople()
      }
    } catch {
      setError(t('groupRequestActionError'))
    } finally {
      setBusyUserId(null)
    }
  }

  async function managePerson(person: UserSummary, action: 'promote' | 'remove' | 'demote') {
    setBusyUserId(person.id)
    setError(null)
    try {
      if (action === 'promote') {
        if (!await socialApi.addGroupAdmin(groupId, person.id)) throw new Error('Action rejected')
        setAdmins((current) => [person, ...current.filter((item) => item.id !== person.id)])
      } else if (action === 'remove') {
        if (!await socialApi.removeGroupMember(groupId, person.id)) throw new Error('Action rejected')
        setMembers((current) => current.filter((item) => item.id !== person.id))
      } else {
        if (!await socialApi.removeGroupAdmin(groupId, person.id)) throw new Error('Action rejected')
        setAdmins((current) => current.filter((item) => item.id !== person.id))
      }
      const latest = await socialApi.getGroup(groupId)
      if (latest) setGroup(latest)
    } catch {
      setError(t('groupMemberActionError'))
    } finally {
      setBusyUserId(null)
    }
  }

  if (loading) return <main className="profile-destination"><div className="card state-card"><span className="spinner" /></div></main>
  if (!group) return <main className="profile-destination"><div className="card state-card"><h2>{t('groupUnavailable')}</h2><p>{error}</p><button className="btn-soft" onClick={onBack}>{t('back')}</button></div></main>

  return <main className="profile-destination">
    <section className="profile-cover-card">
      <div className="profile-cover" style={group.backgroundUrl ? { backgroundImage: `url(${group.backgroundUrl})`, backgroundSize: 'cover' } : undefined} />
      <div className="profile-destination-header">
        <Avatar name={group.name} src={group.avatarUrl} size={164} />
        <div className="profile-destination-title"><h1>{group.name}</h1><p>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })} · {group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</p></div>
        <div className="group-membership-actions">
          {membership.isAdmin && <span className="role-pill">{t('groupAdmin')}</span>}
          {membership.isAdmin && <button type="button" className="btn-soft" onClick={() => setEditing(true)}><Icon name="edit" size={17} />{t('editGroup')}</button>}
          {(membership.isMember || membership.isAdmin) ? <button type="button" className="btn-soft" disabled={busy} onClick={() => void membershipAction('leave')}><Icon name="logout" size={17} />{busy ? t('working') : t('leaveGroup')}</button> : membership.joinRequestPending ? <button type="button" className="btn-soft" disabled={busy} onClick={() => void membershipAction('cancel')}><Icon name="clock" size={17} />{busy ? t('working') : t('cancelJoinRequest')}</button> : <button type="button" className="btn-primary" disabled={busy} onClick={() => void membershipAction('join')}><Icon name="plus" size={17} />{busy ? t('working') : group.privacy === 0 ? t('joinGroup') : t('requestToJoin')}</button>}
          {membership.isAdmin && <button type="button" className="btn-soft danger-text" onClick={() => setConfirmingDelete(true)}><Icon name="trash" size={17} />{t('deleteGroup')}</button>}
        </div>
      </div>
      <nav className="profile-tabs">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}{item.id === 'requests' && requests.length > 0 ? ` (${requests.length})` : ''}</button>)}</nav>
    </section>
    {error && <p className="inline-alert profile-inline-alert">{error}</p>}
    <div className="profile-destination-grid">
      <aside className="card profile-intro"><h2>{t('about')}</h2><p>{group.bio || t('noGroupDescription')}</p><p><Icon name="groups" size={18} />{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</p><p><Icon name="settings" size={18} />{t('adminsCount', { count: group.adminCount })}</p></aside>
      <section className="profile-post-list">
        {tab === 'posts' && <>
          {(membership.isMember || membership.isAdmin) && <GroupPostComposer userId={userId} groupId={groupId} people={[...new Map([...admins, ...members].map((person) => [person.id, person])).values()]} onCreated={() => void loadPosts()} />}
          {!membership.canViewPosts ? <div className="card state-card"><h2>{t('privateGroup')}</h2><p>{t('joinToSeePosts')}</p></div> : postsLoading && posts.length === 0 ? <div className="card state-card"><span className="spinner" /></div> : posts.length === 0 ? <div className="card state-card"><h2>{t('groupFeedEmpty')}</h2><p>{t('groupFeedEmptyDesc')}</p></div> : <>{posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} authorPath={(authorId) => `/groups/${groupId}/members/${authorId}`} />)}{postsHaveMore && <button type="button" className="btn-soft load-more-result" disabled={postsLoading || !postCursor} onClick={() => void loadPosts(postCursor, true)}>{postsLoading ? t('loadingMore') : t('seeMore')}</button>}</>}
        </>}
        {tab === 'photos' && <div className="card profile-tab-card"><h2>{t('photos')}</h2>{!membership.canViewPosts ? <p className="muted">{t('joinToSeePosts')}</p> : photosLoading && photos.length === 0 ? <div className="state-card"><span className="spinner" /></div> : photos.length === 0 ? <p className="muted">{t('photosEmpty')}</p> : <><div className="profile-photo-grid">{photos.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onNavigate(`/content/${photo.contentId}`)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div>{photosHaveMore && <button type="button" className="btn-soft load-more-result" disabled={photosLoading || !photoCursor} onClick={() => void loadPhotos(photoCursor, true)}>{photosLoading ? t('loadingMore') : t('seeMore')}</button>}</>}</div>}
        {tab === 'about' && <div className="card group-detail-card"><h2>{t('aboutThisGroup')}</h2><p>{group.bio || t('noGroupDescription')}</p><dl><div><dt>{t('privacy')}</dt><dd>{group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</dd></div><div><dt>{t('createdAt')}</dt><dd>{group.createdAt || t('notAvailable')}</dd></div></dl></div>}
        {tab === 'members' && <div className="card group-detail-card"><div className="service-heading"><div><h2>{t('members')}</h2><p>{t('groupMemberSummary', { members: group.memberCount ?? 0, admins: group.adminCount })}</p></div><div className="split-actions">{membership.isAdmin && <button type="button" className="btn-primary sm" onClick={() => setInviting(true)}><Icon name="userPlus" size={16} />{t('invitePeople')}</button>}<button type="button" className="btn-soft sm" onClick={() => void loadPeople()}>{t('refresh')}</button></div></div>{peopleLoading ? <div className="state-card"><span className="spinner" /></div> : <><GroupPeopleList groupId={groupId} title={t('groupAdmins')} people={admins} currentUserId={userId} adminView={membership.isAdmin} busyUserId={busyUserId} onNavigate={onNavigate} onAction={(person) => void managePerson(person, 'demote')} actionLabel={t('removeAdmin')} /><GroupPeopleList groupId={groupId} title={t('groupMembers')} people={nonAdminMembers} currentUserId={userId} adminView={membership.isAdmin} busyUserId={busyUserId} onNavigate={onNavigate} onAction={(person, secondary) => void managePerson(person, secondary ? 'remove' : 'promote')} actionLabel={t('makeAdmin')} secondaryActionLabel={t('removeMember')} /></>}</div>}
        {tab === 'requests' && membership.isAdmin && <div className="card group-admin-panel"><div className="service-heading"><div><h2>{t('joinRequests')}</h2><p>{t('joinRequestsDesc')}</p></div><button type="button" className="btn-soft sm" onClick={() => void loadRequests()}>{t('refresh')}</button></div>{requestsLoading ? <div className="state-card"><span className="spinner" /></div> : requests.length === 0 ? <div className="state-card"><h3>{t('noJoinRequests')}</h3><p>{t('noJoinRequestsDesc')}</p></div> : <div className="group-request-list">{requests.map((profile) => <article key={profile.id}><button type="button" className="request-profile" onClick={() => onNavigate(`/profile/${profile.id}`)}><Avatar name={profile.displayName} src={profile.avatarUrl} size={52} /><span><strong>{profile.displayName}<VerifiedBadge verified={profile.isVerified} /></strong><small>{t('friendsCount', { count: profile.friendCount })}</small></span></button><div><button type="button" className="btn-primary sm" disabled={busyUserId === profile.id} onClick={() => void reviewRequest(profile.id, true)}>{t('approve')}</button><button type="button" className="btn-soft sm" disabled={busyUserId === profile.id} onClick={() => void reviewRequest(profile.id, false)}>{t('decline')}</button></div></article>)}</div>}</div>}
      </section>
    </div>
    {editing && <EditGroupModal group={group} onClose={() => setEditing(false)} onUpdated={(updated) => { setGroup(updated); setEditing(false) }} />}
    {confirmingDelete && <DeleteGroupModal group={group} onClose={() => setConfirmingDelete(false)} onDeleted={onBack} />}
    {inviting && <InviteGroupUsersModal groupId={groupId} viewerId={userId} excludedIds={excludedInviteIds} onClose={() => setInviting(false)} />}
  </main>
}

function EditGroupModal({ group, onClose, onUpdated }: { group: SocialGroup; onClose: () => void; onUpdated: (group: SocialGroup) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(group.name)
  const [bio, setBio] = useState(group.bio ?? '')
  const [privacy, setPrivacy] = useState(group.privacy)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<{ file: File; kind: 'avatar' | 'background'; fromExisting: boolean } | null>(null)
  const [candidatePhotos, setCandidatePhotos] = useState<SocialPhoto[]>([])
  const [existingPicker, setExistingPicker] = useState<'avatar' | 'background' | null>(null)

  useEffect(() => {
    let active = true
    socialApi.getGroupPhotoCandidates(group.id, 60).then((page) => active && setCandidatePhotos(page.items)).catch(() => active && setCandidatePhotos([]))
    return () => { active = false }
  }, [group.id])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const updated = await socialApi.updateGroup(group.id, { name: name.trim(), bio: bio.trim(), privacy })
      if (!updated) throw new Error('Missing update result')
      onUpdated(updated)
    } catch {
      setError(t('updateGroupError'))
    } finally {
      setBusy(false)
    }
  }

  async function saveCroppedImage(original: File, cropped: File) {
    if (!cropTarget) return
    setBusy(true)
    setError(null)
    let uploads: MediaUpload[] = []
    let persisted = false
    try {
      uploads = await api.uploadMediaFiles(cropTarget.fromExisting ? [cropped] : [original, cropped])
      const originalUpload = cropTarget.fromExisting ? null : uploads[0]
      const croppedUpload = uploads[uploads.length - 1]
      const updated = cropTarget.kind === 'avatar'
        ? await socialApi.changeGroupAvatar(group.id, croppedUpload.url, originalUpload?.url ?? null)
        : await socialApi.changeGroupBackground(group.id, croppedUpload.url, originalUpload?.url ?? null)
      if (!updated) throw new Error('Missing group image update')
      persisted = true
      onUpdated(updated)
    } catch {
      if (!persisted) await Promise.allSettled(uploads.map((item) => api.cancelPendingMedia(item)))
      setError(t('groupImageUpdateError'))
      throw new Error('Group image update failed')
    } finally {
      setBusy(false)
    }
  }

  async function chooseExistingPhoto(photo: SocialPhoto, kind: 'avatar' | 'background') {
    setError(null)
    try {
      const response = await fetch(photo.media.url, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not fetch group media')
      const blob = await response.blob()
      const extension = blob.type.split('/')[1] || 'jpg'
      setCropTarget({ file: new File([blob], `fakebook-group-photo.${extension}`, { type: blob.type || 'image/jpeg' }), kind, fromExisting: true })
      setExistingPicker(null)
    } catch {
      setError(t('existingPhotoLoadError'))
    }
  }

  async function removeImage(kind: 'avatar' | 'background') {
    setBusy(true)
    setError(null)
    try {
      const updated = kind === 'avatar'
        ? await socialApi.removeGroupAvatar(group.id)
        : await socialApi.removeGroupBackground(group.id)
      if (!updated) throw new Error('Missing group image update')
      onUpdated(updated)
    } catch {
      setError(t('groupImageRemoveError'))
    } finally {
      setBusy(false)
    }
  }

  return <><div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><form className="modal compact-form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('editGroup')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body settings-form-grid"><div className="wide group-image-editor"><div className="group-edit-cover" style={group.backgroundUrl ? { backgroundImage: `url(${group.backgroundUrl})` } : undefined}><div>{group.backgroundUrl && <button type="button" className="btn-soft danger-text" disabled={busy} onClick={() => void removeImage('background')}><Icon name="trash" size={16} />{t('removeGroupBackground')}</button>}{candidatePhotos.length > 0 && <button type="button" className="btn-soft" disabled={busy} onClick={() => setExistingPicker('background')}><Icon name="photo" size={16} />{t('chooseExistingPhoto')}</button>}<label className="btn-soft"><Icon name="camera" size={16} />{t('changeGroupBackground')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCropTarget({ file, kind: 'background', fromExisting: false }); event.currentTarget.value = '' }} /></label></div></div><div className="group-edit-avatar"><Avatar name={group.name} src={group.avatarUrl} size={76} /><div>{group.avatarUrl && <button type="button" className="btn-soft danger-text" disabled={busy} onClick={() => void removeImage('avatar')}>{t('removeGroupAvatar')}</button>}{candidatePhotos.length > 0 && <button type="button" className="btn-soft" disabled={busy} onClick={() => setExistingPicker('avatar')}><Icon name="photo" size={16} />{t('chooseExistingPhoto')}</button>}<label className="btn-soft"><Icon name="camera" size={16} />{t('changeGroupAvatar')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCropTarget({ file, kind: 'avatar', fromExisting: false }); event.currentTarget.value = '' }} /></label></div></div></div><label className="wide"><span>{t('groupName')}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="wide"><span>{t('groupDescription')}</span><textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} /></label><label className="wide"><span>{t('privacy')}</span><select value={privacy} onChange={(event) => setPrivacy(Number(event.target.value))}><option value={0}>{t('publicGroup')}</option><option value={1}>{t('privateGroup')}</option></select></label>{error && <p className="form-error wide">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="submit" className="btn-primary" disabled={busy || !name.trim()}>{busy ? t('saving') : t('save')}</button></footer></form></div>{cropTarget && <ImageCropModal file={cropTarget.file} kind={cropTarget.kind} onClose={() => setCropTarget(null)} onConfirm={saveCroppedImage} />}{existingPicker && <GroupExistingPhotoPicker images={candidatePhotos} kind={existingPicker} onClose={() => setExistingPicker(null)} onSelect={(photo) => void chooseExistingPhoto(photo, existingPicker)} />}</>
}

function GroupExistingPhotoPicker({ images, kind, onClose, onSelect }: { images: SocialPhoto[]; kind: 'avatar' | 'background'; onClose: () => void; onSelect: (photo: SocialPhoto) => void }) {
  const { t } = useI18n()
  return <div className="modal-backdrop existing-photo-backdrop" role="presentation" onClick={onClose}><section className="modal existing-photo-modal" role="dialog" aria-modal="true" aria-label={t('chooseExistingPhoto')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{t('chooseExistingPhoto')}</h2><p>{kind === 'avatar' ? t('chooseAvatarPhotoDesc') : t('chooseBackgroundPhotoDesc')}</p></div><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="existing-photo-grid">{images.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onSelect(photo)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div></section></div>
}

function DeleteGroupModal({ group, onClose, onDeleted }: { group: SocialGroup; onClose: () => void; onDeleted: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function remove() {
    setBusy(true)
    setError(null)
    try {
      if (!await socialApi.deleteGroup(group.id)) throw new Error('Delete rejected')
      onDeleted()
    } catch {
      setError(t('deleteGroupError'))
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><section className="modal compact-form-modal" role="dialog" aria-modal="true" aria-label={t('deleteGroup')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('deleteGroup')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body destructive-confirm"><Icon name="trash" size={38} /><p>{t('deleteGroupConfirm', { name: group.name })}</p>{error && <p className="form-error">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>{busy ? t('working') : t('deleteGroup')}</button></footer></section></div>
}

function GroupPostComposer({ userId, groupId, people, onCreated }: { userId: string; groupId: string; people: UserSummary[]; onCreated: () => void }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentionEntities, setMentionEntities] = useState<MentionEntity[]>([])
  const [mentionCaret, setMentionCaret] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function changeContent(nextContent: string, caret: number) {
    setMentionEntities((current) => reconcileMentionEntities(content, nextContent, current))
    setContent(nextContent)
    setMentionCaret(caret)
  }

  function selectMention(person: UserSummary, mention: Parameters<typeof applyMentionSelection>[1]) {
    const selected = applyMentionSelection(content, mention, person)
    setMentionEntities((current) => [...reconcileMentionEntities(content, selected.text, current), selected.entity])
    setContent(selected.text)
    setMentionCaret(selected.caret)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(selected.caret, selected.caret)
    }, 0)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim() && files.length === 0) return
    setBusy(true)
    setError(null)
    let uploaded: MediaUpload[] = []
    let persisted = false
    try {
      uploaded = await api.uploadMediaFiles(files)
      await socialApi.createGroupPost(userId, groupId, {
        content: serializeMentionContent(content, mentionEntities).trim(),
        media: uploaded.map((item) => ({ type: item.type === 'video' ? 1 : 0, url: item.url })),
      })
      persisted = true
      setContent('')
      setFiles([])
      setFileKey((value) => value + 1)
      setMentionEntities([])
      setMentionCaret(0)
      onCreated()
    } catch {
      if (!persisted) await Promise.allSettled(uploaded.map((item) => api.cancelPendingMedia(item)))
      setError(t('publishPostError'))
    } finally {
      setBusy(false)
    }
  }

  return <form className="card gateway-composer group-post-composer" onSubmit={submit}><div className="mention-compose-field"><MentionDraftOverlay text={content} entities={mentionEntities} textareaRef={textareaRef} /><textarea ref={textareaRef} value={content} onChange={(event) => changeContent(event.target.value, event.target.selectionStart ?? event.target.value.length)} onSelect={(event) => setMentionCaret(event.currentTarget.selectionStart ?? content.length)} placeholder={t('groupPostPrompt')} rows={3} /><MentionSuggestions text={content} people={people} textareaRef={textareaRef} caretIndex={mentionCaret} onSelected={selectMention} /></div><div className="composer-controls"><label className="file-control"><span>{files.length > 0 ? t('selectedFilesCount', { count: files.length }) : t('photoVideo')}</span><input key={fileKey} type="file" multiple accept="image/*,video/*" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 10))} /></label><button type="submit" className="btn-primary" disabled={busy || (!content.trim() && files.length === 0)}>{busy ? t('posting') : t('post')}</button></div>{files.length > 0 && <div className="composer-selected-files">{files.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}</div>}{error && <p className="form-error">{error}</p>}</form>
}

function GroupPeopleList({ groupId, title, people, currentUserId, adminView, busyUserId, onNavigate, onAction, actionLabel, secondaryActionLabel }: { groupId: string; title: string; people: UserSummary[]; currentUserId: string; adminView: boolean; busyUserId: string | null; onNavigate: (path: string) => void; onAction: (person: UserSummary, secondary?: boolean) => void; actionLabel: string; secondaryActionLabel?: string }) {
  const { t } = useI18n()
  return <section className="group-people-section"><h3>{title}</h3>{people.length === 0 ? <p className="muted">{t('noPeopleToShow')}</p> : <div className="group-request-list">{people.map((person) => <article key={person.id}><button type="button" className="request-profile" onClick={() => onNavigate(`/groups/${groupId}/members/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={48} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{person.id === currentUserId ? t('you') : t('fakebookUser')}</small></span></button>{adminView && person.id !== currentUserId && <div><button type="button" className="btn-soft sm" disabled={busyUserId === person.id} onClick={() => onAction(person)}>{actionLabel}</button>{secondaryActionLabel && <button type="button" className="btn-soft sm danger-text" disabled={busyUserId === person.id} onClick={() => onAction(person, true)}>{secondaryActionLabel}</button>}</div>}</article>)}</div>}</section>
}

function InviteGroupUsersModal({ groupId, viewerId, excludedIds, onClose }: { groupId: string; viewerId: string; excludedIds: Set<string>; onClose: () => void }) {
  const { t } = useI18n()
  const [people, setPeople] = useState<SocialProfile[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    socialApi.getRelationProfiles(viewerId, 0, 100).then((items) => {
      if (active) setPeople(items.filter((person) => person.id !== viewerId && !excludedIds.has(person.id)))
    }).catch(() => active && setError(t('friendsLoadError'))).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [excludedIds, t, viewerId])

  const visible = people.filter((person) => person.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  async function invite(personId: string) {
    setBusyId(personId)
    setError(null)
    try {
      if (!await socialApi.inviteGroupUser(groupId, personId)) throw new Error('Invite rejected')
      setInvitedIds((current) => new Set(current).add(personId))
    } catch {
      setError(t('groupInviteError'))
    } finally {
      setBusyId(null)
    }
  }

  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal compact-form-modal" role="dialog" aria-modal="true" aria-label={t('invitePeople')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{t('invitePeople')}</h2><p>{t('invitePeopleDesc')}</p></div><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body invite-group-body"><label className="settings-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchFriends')} /></label>{loading ? <div className="state-card"><span className="spinner" /></div> : visible.length === 0 ? <p className="muted">{t('noFriendsToInvite')}</p> : <div className="group-request-list">{visible.map((person) => <article key={person.id}><button type="button" className="request-profile"><Avatar name={person.displayName} src={person.avatarUrl} size={46} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{t('friendsCount', { count: person.friendCount })}</small></span></button><button type="button" className={invitedIds.has(person.id) ? 'btn-soft sm' : 'btn-primary sm'} disabled={busyId === person.id || invitedIds.has(person.id)} onClick={() => void invite(person.id)}>{invitedIds.has(person.id) ? t('invited') : busyId === person.id ? t('working') : t('invite')}</button></article>)}</div>}{error && <p className="form-error">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-primary" onClick={onClose}>{t('done')}</button></footer></section></div>
}

import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import type { GatewayPost } from '../api/gatewayTypes'
import { searchApi, type SearchPageResult, type SearchProfile, type SearchTab } from '../api/search'
import {
  socialApi,
  type GroupMembershipState,
  type ProfileRelationshipState,
} from '../api/social'
import type { UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { GroupMembersIcon } from '../components/GroupMembersIcon'
import { Icon, ReelIcon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { GatewayPostCard } from './GatewayHomePage'

const TABS: Array<{ id: SearchTab; label: string }> = [
  { id: 'posts', label: 'searchPosts' },
  { id: 'people', label: 'searchPeople' },
  { id: 'reels', label: 'reels' },
  { id: 'groups', label: 'groups' },
]

const EMPTY: SearchPageResult = { tab: 'posts', page: 1, hasNextPage: false, users: [], groups: [], posts: [], reels: [] }
const EMPTY_RELATIONSHIP: ProfileRelationshipState = {
  friendship: 'none',
  isFollowing: false,
  followsViewer: false,
  isBlocked: false,
  isBlockedBy: false,
}
const EMPTY_MEMBERSHIP: GroupMembershipState = { isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: false }

interface PersonMetadata {
  relationship: ProfileRelationshipState
  mutualFriendCount: number
}

interface HydratedSearchPage {
  result: SearchPageResult
  people: Record<string, PersonMetadata>
  groupMemberships: Record<string, GroupMembershipState>
  groupFriends: Record<string, UserSummary[]>
}

export function SearchPage({
  query,
  tab,
  userId,
  onNavigate,
  onMessage,
}: {
  query: string
  tab: SearchTab
  userId: string
  onNavigate: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
}) {
  const { t, locale } = useI18n()
  const [result, setResult] = useState<SearchPageResult>({ ...EMPTY, tab })
  const [people, setPeople] = useState<Record<string, PersonMetadata>>({})
  const [groupMemberships, setGroupMemberships] = useState<Record<string, GroupMembershipState>>({})
  const [groupFriends, setGroupFriends] = useState<Record<string, UserSummary[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setResult({ ...EMPTY, tab })
    setPeople({})
    setGroupMemberships({})
    setGroupFriends({})
    setError(null)
    setActionError(null)
    Promise.resolve()
      .then(() => searchApi.search(query, tab, 1))
      .then((value) => hydrateSearchPage(value, userId))
      .then((value) => {
        if (!active) return
        setResult(value.result)
        setPeople(value.people)
        setGroupMemberships(value.groupMemberships)
        setGroupFriends(value.groupFriends)
      })
      .catch(() => {
        if (active) setError('searchLoadError')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [query, reloadKey, tab, userId])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const next = await hydrateSearchPage(await searchApi.search(query, tab, result.page + 1), userId)
      setResult((current) => ({
        ...next.result,
        users: [...current.users, ...next.result.users],
        groups: [...current.groups, ...next.result.groups],
        posts: [...current.posts, ...next.result.posts],
        reels: [...current.reels, ...next.result.reels],
      }))
      setPeople((current) => ({ ...current, ...next.people }))
      setGroupMemberships((current) => ({ ...current, ...next.groupMemberships }))
      setGroupFriends((current) => ({ ...current, ...next.groupFriends }))
    } catch {
      setError('searchLoadError')
    } finally {
      setLoadingMore(false)
    }
  }

  function openResult(referenceId: string, path: string) {
    void searchApi.recordSearchResultView(referenceId).catch(() => undefined)
    onNavigate(path)
  }

  async function runPersonAction(profile: SearchProfile, action: 'add' | 'accept' | 'follow' | 'message') {
    if (actionBusy) return
    setActionBusy(`person-${profile.id}`)
    setActionError(null)
    try {
      if (action === 'message') {
        if (!onMessage) throw new Error('Messaging unavailable')
        await onMessage(profile.id)
        return
      }
      const succeeded = action === 'add'
        ? await socialApi.sendFriendRequest(userId, profile.id)
        : action === 'accept'
          ? await socialApi.acceptFriendRequest(profile.id, userId)
          : await socialApi.followUser(userId, profile.id)
      if (!succeeded) throw new Error('Relationship action rejected')
      setPeople((current) => {
        const metadata = current[profile.id] ?? { relationship: EMPTY_RELATIONSHIP, mutualFriendCount: 0 }
        return {
          ...current,
          [profile.id]: {
            ...metadata,
            relationship: action === 'follow'
              ? { ...metadata.relationship, isFollowing: true }
              : { ...metadata.relationship, friendship: action === 'accept' ? 'friend' : 'outgoing' },
          },
        }
      })
    } catch {
      setActionError(t(action === 'message' ? 'messageActionError' : action === 'follow' ? 'followActionError' : 'friendActionError'))
    } finally {
      setActionBusy(null)
    }
  }

  async function joinGroup(groupId: string) {
    if (actionBusy) return
    setActionBusy(`group-${groupId}`)
    setActionError(null)
    try {
      if (!await socialApi.requestJoinGroup(userId, groupId)) throw new Error('Join request rejected')
      setGroupMemberships((current) => ({
        ...current,
        [groupId]: { ...(current[groupId] ?? EMPTY_MEMBERSHIP), joinRequestPending: true },
      }))
    } catch {
      setActionError(t('joinGroupError'))
    } finally {
      setActionBusy(null)
    }
  }

  const count = result.users.length + result.groups.length + result.posts.length + result.reels.length
  return (
    <main className="discovery-layout">
      <aside className="discovery-sidebar">
        <header><h1>{t('searchResults')}</h1></header>
        <nav aria-label={t('searchFilters')}>
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => onNavigate(`/search?q=${encodeURIComponent(query)}&tab=${item.id}`)}>
              <span><SearchFilterIcon tab={item.id} active={tab === item.id} /></span><strong>{t(item.label)}</strong>
            </button>
          ))}
        </nav>
      </aside>
      <section className="discovery-content">
        {loading ? <SearchResultsSkeleton tab={tab} /> : error && count === 0 ? (
          <StateCard title={t('unableToLoad')} detail={t(error)} action={t('tryAgain')} onAction={() => setReloadKey((value) => value + 1)} />
        ) : count === 0 ? (
          <StateCard title={t('noSearchResults')} detail={t('noSearchResultsDesc')} />
        ) : (
          <div className="result-stack search-result-column">
            {actionError && <p className="inline-alert search-action-error">{actionError}</p>}
            {result.users.map((profile) => (
              <PersonResult
                key={profile.id}
                profile={profile}
                viewerId={userId}
                metadata={people[profile.id]}
                busy={actionBusy === `person-${profile.id}`}
                onOpen={() => openResult(profile.searchReferenceId, `/profile/${profile.id}`)}
                onAction={(action) => void runPersonAction(profile, action)}
              />
            ))}
            {result.groups.map((group) => (
              <GroupResult
                key={group.id}
                group={group}
                membership={groupMemberships[group.id]}
                friends={groupFriends[group.id] ?? []}
                busy={actionBusy === `group-${group.id}`}
                onOpen={() => openResult(group.searchReferenceId, `/groups/${group.id}`)}
                onJoin={() => void joinGroup(group.id)}
              />
            ))}
            {result.posts.map((post) => <div className="search-post-result" key={post.id} onClickCapture={() => void searchApi.recordSearchResultView(post.searchReferenceId).catch(() => undefined)}><GatewayPostCard post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} onMessage={onMessage} /></div>)}
            {result.reels.map((reel) => {
              const post = reelAsGatewayPost(reel, t('fakebookUser'))
              return <div className="search-post-result" key={reel.id} onClickCapture={() => void searchApi.recordSearchResultView(reel.searchReferenceId).catch(() => undefined)}><GatewayPostCard post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} onMessage={onMessage} /></div>
            })}
            {error && <p className="inline-alert search-action-error">{t(error)}</p>}
            {result.hasNextPage && <button type="button" className="btn-soft load-more-result" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? t('loadingMore') : t('seeMore')}</button>}
          </div>
        )}
      </section>
    </main>
  )
}

async function hydrateSearchPage(result: SearchPageResult, userId: string): Promise<HydratedSearchPage> {
  if (result.tab === 'people' && result.users.length > 0) {
    const ids = result.users.map((profile) => profile.id)
    const [profiles, relationships, friends, suggestions] = await Promise.all([
      socialApi.getProfiles(ids),
      socialApi.getProfileRelationshipStates(userId, ids),
      socialApi.getFriendProfilesWithMutualCounts(userId, 100),
      socialApi.getFriendSuggestions(userId, 100),
    ])
    const fullProfiles = new Map(profiles.map((profile) => [profile.id, profile]))
    const mutualCounts = new Map<string, number>()
    for (const item of [...friends, ...suggestions]) mutualCounts.set(item.profile.id, item.mutualFriendCount)
    return {
      result: {
        ...result,
        users: result.users.map((profile) => ({
          ...profile,
          ...(fullProfiles.get(profile.id) ?? {}),
          searchReferenceId: profile.searchReferenceId,
        })),
      },
      people: Object.fromEntries(ids.map((id) => [id, {
        relationship: relationships[id] ?? EMPTY_RELATIONSHIP,
        mutualFriendCount: mutualCounts.get(id) ?? 0,
      }])),
      groupMemberships: {},
      groupFriends: {},
    }
  }
  if (result.tab === 'groups' && result.groups.length > 0) {
    const ids = result.groups.map((group) => group.id)
    const [groupMemberships, groupFriends] = await Promise.all([
      socialApi.getGroupMembershipStates(userId, ids),
      // Friend avatars are decorative metadata. A stale optional field or a temporary
      // preview failure must not erase group hits that Search already returned.
      socialApi.getGroupFriendMemberPreviews(ids, 3).catch((error: unknown) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.code === 'UNAUTHENTICATED' || error.code === 'FORBIDDEN')) {
          throw error
        }
        return {}
      }),
    ])
    return { result, people: {}, groupMemberships, groupFriends }
  }
  return { result, people: {}, groupMemberships: {}, groupFriends: {} }
}

function SearchFilterIcon({ tab, active }: { tab: SearchTab; active: boolean }) {
  if (tab === 'posts') return <SearchPostsIcon />
  if (tab === 'people') return <Icon name="friends" size={22} />
  if (tab === 'reels') return <ReelIcon size={22} filled={active} dividerColor="var(--discovery-nav-icon-bg)" />
  return <GroupMembersIcon size={23} className="discovery-groups-glyph" />
}

function SearchPostsIcon() {
  return <svg className="discovery-posts-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path className="discovery-posts-back" d="M2 14V6.6a2.1 2.1 0 0 1 2.1-2.1h12.6" />
    <path className="discovery-posts-back" d="M4.8 16.8V9.4a2.1 2.1 0 0 1 2.1-2.1h12.6" />
    <rect className="discovery-posts-front" x="7.55" y="9.65" width="14.45" height="10.45" rx="2" />
    <path className="discovery-posts-dash" d="M10.75 13.85h8" />
  </svg>
}

function SearchResultsSkeleton({ tab }: { tab: SearchTab }) {
  const { t } = useI18n()
  if (tab === 'posts' || tab === 'reels') {
    return <div className="search-result-column search-results-skeleton search-feed-results-skeleton" role="status" aria-label={t('loadingSearch')}>
      {Array.from({ length: 2 }, (_, index) => <article className="card gateway-post home-feed-skeleton" aria-hidden="true" key={index}>
        <header className="feed-post-head"><span className="home-feed-skeleton-avatar" /><div className="home-feed-skeleton-heading"><span /><span /></div></header>
        <div className="home-feed-skeleton-copy"><span /><span /><span /></div>
        <div className="home-feed-skeleton-media" />
        <div className="home-feed-skeleton-actions"><span /><span /><span /></div>
      </article>)}
    </div>
  }

  return <div className="search-result-column search-results-skeleton search-entity-results-skeleton" role="status" aria-label={t('loadingSearch')}>
    {Array.from({ length: 6 }, (_, index) => <article className="card search-entity-result search-entity-skeleton" aria-hidden="true" key={index}>
      <span className={tab === 'groups' ? 'search-skeleton-avatar is-group' : 'search-skeleton-avatar'} />
      <span className="search-skeleton-copy"><i /><i /><i /></span>
      <span className="search-skeleton-action" />
    </article>)}
  </div>
}

function PersonResult({
  profile,
  viewerId,
  metadata,
  busy,
  onOpen,
  onAction,
}: {
  profile: SearchProfile
  viewerId: string
  metadata?: PersonMetadata
  busy: boolean
  onOpen: () => void
  onAction: (action: 'add' | 'accept' | 'follow' | 'message') => void
}) {
  const { t } = useI18n()
  const relationship = metadata?.relationship ?? EMPTY_RELATIONSHIP
  const isSelf = profile.id === viewerId
  const inaccessible = relationship.isBlocked || relationship.isBlockedBy
  const relationLabel = isSelf ? t('searchSelf') : relationship.friendship === 'friend' ? t('friends') : relationship.isFollowing ? t('following') : t('searchPeople')
  const firstLine = [relationLabel, profile.location ? t('livesIn', { location: profile.location }) : ''].filter(Boolean)
  const secondLine = [
    metadata?.mutualFriendCount ? t('mutualFriendsCount', { count: metadata.mutualFriendCount }) : '',
    profile.followerCount > 0 ? t('followersCount', { count: profile.followerCount }) : '',
  ].filter(Boolean)
  let action: 'add' | 'accept' | 'follow' | 'message' | null = null
  let actionLabel = ''
  let disabled = false
  if (!isSelf && !inaccessible) {
    if (relationship.friendship === 'friend') {
      action = 'message'; actionLabel = t('messageUser')
    } else if (relationship.friendship === 'incoming') {
      action = 'accept'; actionLabel = t('confirm')
    } else if (relationship.friendship === 'outgoing') {
      actionLabel = t('requestSent'); disabled = true
    } else if (profile.privacy === 1 && !relationship.isFollowing) {
      action = 'follow'; actionLabel = t('follow')
    } else {
      action = 'add'; actionLabel = t('addFriend')
    }
  }
  return <article className="card search-entity-result search-person-result">
    <button type="button" className="search-entity-avatar" onClick={onOpen}><Avatar name={profile.displayName} src={profile.avatarUrl} size={54} /></button>
    <button type="button" className="search-entity-copy" onClick={onOpen}>
      <strong><span>{profile.displayName}</span><VerifiedBadge verified={profile.isVerified} /></strong>
      <small>{firstLine.map((item, index) => <span key={item}>{index > 0 && <b aria-hidden="true">·</b>}{item}</span>)}</small>
      {secondLine.length > 0 && <small>{secondLine.map((item, index) => <span key={item}>{index > 0 && <b aria-hidden="true">·</b>}{item}</span>)}</small>}
    </button>
    {actionLabel && <button type="button" className="search-result-action" disabled={busy || disabled} onClick={() => action && onAction(action)}>{actionLabel}</button>}
  </article>
}

function GroupResult({
  group,
  membership = EMPTY_MEMBERSHIP,
  friends,
  busy,
  onOpen,
  onJoin,
}: {
  group: SearchPageResult['groups'][number]
  membership?: GroupMembershipState
  friends: UserSummary[]
  busy: boolean
  onOpen: () => void
  onJoin: () => void
}) {
  const { t } = useI18n()
  const shownFriends = friends.slice(0, 3)
  const friendLabel = friends.length === 1
    ? t('groupFriendMemberSingle', { name: friends[0].displayName })
    : friends.length > 1 ? t('groupFriendMembers', { name: friends[0].displayName, count: friends.length - 1 }) : ''
  const actionLabel = membership.isMember ? t('searchVisitGroup') : membership.joinRequestPending ? t('joinRequested') : t('joinGroup')
  return <article className="card search-entity-result search-group-result">
    <button type="button" className="search-entity-avatar search-group-avatar" onClick={onOpen}><Avatar name={group.name} src={group.avatarUrl} size={54} className="group-square-avatar" /></button>
    <button type="button" className="search-entity-copy" onClick={onOpen}>
      <strong><span>{group.name}</span></strong>
      <small><span>{group.privacy === 0 ? t('groupPublicVisibility') : t('groupPrivateVisibility')}</span><span><b aria-hidden="true">·</b>{t('membersCount', { count: group.memberCount ?? 0 })}</span></small>
      {shownFriends.length > 0 && <span className="search-group-friends"><span className="search-group-friend-avatars">{shownFriends.map((friend) => <Avatar key={friend.id} name={friend.displayName} src={friend.avatarUrl} size={22} />)}</span><small>{friendLabel}</small></span>}
    </button>
    <button type="button" className={membership.isMember || membership.joinRequestPending ? 'search-result-action is-secondary' : 'search-result-action'} disabled={busy || membership.joinRequestPending} onClick={membership.isMember ? onOpen : onJoin}>{actionLabel}</button>
  </article>
}

function reelAsGatewayPost(reel: SearchPageResult['reels'][number], fallbackAuthor: string): GatewayPost {
  return {
    __typename: 'ReelDetail',
    id: reel.id,
    type: reel.type,
    content: reel.content,
    privacy: reel.privacy,
    create: reel.createdAt,
    author: {
      id: reel.author?.id ?? reel.authorId,
      name: reel.author?.displayName ?? fallbackAuthor,
      avatar: reel.author?.avatarUrl ?? '',
      isVerified: reel.author?.isVerified ?? false,
    },
    media: reel.media,
    mentions: reel.mentions ?? [],
    taggedUsers: [],
    sharedSource: null,
    aspectRatio: reel.aspectRatio ?? null,
    focalPointX: reel.focalPointX ?? null,
    focalPointY: reel.focalPointY ?? null,
  }
}

function StateCard({ loading, title, detail, action, onAction }: { loading?: boolean; title: string; detail?: string; action?: string; onAction?: () => void }) {
  return <div className="card state-card discovery-state">{loading && <span className="spinner" />}<h2>{title}</h2>{detail && <p>{detail}</p>}{action && <button type="button" className="btn-primary" onClick={onAction}>{action}</button>}</div>
}

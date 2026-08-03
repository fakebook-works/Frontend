import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, visibleRecommendationPosts } from '../api/client'
import type { GatewayPost, GatewayStory, GatewayTaggedUser, SharedStory, StoryBucket, VisitedGroup } from '../api/gatewayTypes'
import { messengerApi, type MessengerPresenceDto } from '../api/messenger'
import { searchApi } from '../api/search'
import { socialApi, type ContentEngagement, type SocialProfile } from '../api/social'
import type { MediaUpload, MessengerConversationDto, UserProfile, UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { GroupPostAvatar } from '../components/GroupPostAvatar'
import { HoverTooltip } from '../components/HoverTooltip'
import { MentionSuggestions } from '../components/MentionSuggestions'
import { MentionContent } from '../components/MentionContent'
import { MentionDraftOverlay } from '../components/MentionDraftOverlay'
import { FriendsShortcutIcon, GroupsShortcutIcon, Icon, LiveVideoIcon, ReelIcon, SavedShortcutIcon } from '../components/Icon'
import { PostMediaGallery } from '../components/PostMediaGallery'
import { PostOptionsMenu } from '../components/PostOptionsMenu'
import { PostPrivacyIcon, type PostPrivacy } from '../components/PostPrivacyIcon'
import { PostPrivacyControl } from '../components/PostPrivacyControl'
import { SharedPostSourceCard } from '../components/SharedPostSourceCard'
import { SharedStoryMiniPreview } from '../components/SharedStoryMiniPreview'
import { StoryMediaPreview } from '../components/StoryMediaPreview'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { clipboardImageFiles } from '../lib/clipboardMedia'
import { groupVisitRelativeTime } from '../lib/format'
import { GROUP_MEMBERSHIP_CHANGED_EVENT, leftGroupIdFromEvent } from '../lib/groupMembershipEvents'
import {
  POST_BACKGROUND_PRESETS,
  decodePostContent,
  encodePostContent,
  getPostBackgroundPreset,
  type PostBackgroundId,
} from '../lib/postContent'
import { readDefaultPostPrivacy } from '../lib/privacy'
import { sharedPostSourceToGatewayReel } from '../lib/reelEntry'
import { formatPostTimestamp } from '../lib/postTime'
import { decodeStoryContent } from '../lib/storyContent'
import { forgetOwnUnseenStory, reconcileOwnUnseenStories, rememberOwnUnseenStory } from '../lib/ownStoryUnseen'
import { applyMentionSelection, extractMentionUserIds, reconcileMentionEntities, serializeMentionContent, type MentionEntity } from '../lib/mentions'
import { formatPresence, groupPresenceSummary } from './messenger/helpers'

const FEED_PAGE_SIZE = 12
const MAX_POST_STANDARD_MEDIA_BYTES = 25 * 1024 * 1024
const MAX_POST_VIDEO_BYTES = 500 * 1024 * 1024
const loadTagPeoplePicker = () => import('../components/TagPeoplePicker')
const TagPeoplePicker = lazy(loadTagPeoplePicker)
const loadComposerMediaPreview = () => import('../components/ComposerMediaPreview')
const ComposerMediaPreview = lazy(loadComposerMediaPreview)
const loadStoryCreatorModal = () => import('../components/StoryCreatorModal')
const StoryCreatorModal = lazy(loadStoryCreatorModal)
const loadCreateReelModal = () => import('../components/CreateReelModal')
const CreateReelModal = lazy(loadCreateReelModal)
const loadStoryViewerPage = () => import('../components/StoryViewerPage')
const StoryViewerPage = lazy(() => loadStoryViewerPage().then((module) => ({ default: module.StoryViewerPage })))
const ContentActions = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentActions })))
const ContentDetailOverlay = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentDetailOverlay })))
const loadPostPhotoViewer = () => import('../components/PostPhotoViewer')
const PostPhotoViewer = lazy(() => loadPostPhotoViewer().then((module) => ({ default: module.PostPhotoViewer })))

function mediaType(type: MediaUpload['type']) {
  if (type === 'audio') throw new Error('Audio is not supported in feed posts.')
  return type === 'video' ? 1 : 0
}

function removeStoryFromBucket(bucket: StoryBucket, storyId: string): StoryBucket | null {
  const stories = bucket.stories.filter((story) => story.id !== storyId)
  return stories.length > 0 ? { ...bucket, latestCreate: stories[0].create, stories } : null
}

export function GatewayHomePage({ profile = null, refreshToken = 0, detailPostId = null, onDetailClose, onNavigate, onOpenReel, onMessage, onNewConversation, onConversation }: {
  profile?: UserProfile | null
  refreshToken?: number
  detailPostId?: string | null
  onDetailClose?: () => void
  onNavigate?: (path: string) => void
  onOpenReel?: (reel: Extract<GatewayPost, { __typename: 'ReelDetail' }>) => void
  onMessage?: (profileId: string) => Promise<void>
  onNewConversation?: () => void
  onConversation?: (conversation: MessengerConversationDto) => void
}) {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [feedOffset, setFeedOffset] = useState(0)
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedMoreBusy, setFeedMoreBusy] = useState(false)
  const [feedHasMore, setFeedHasMore] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [storyBuckets, setStoryBuckets] = useState<StoryBucket[]>([])
  const [myStories, setMyStories] = useState<StoryBucket | null>(null)
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [storiesError, setStoriesError] = useState<string | null>(null)
  const [groups, setGroups] = useState<VisitedGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [friends, setFriends] = useState<SocialProfile[]>([])
  const [contacts, setContacts] = useState<UserSummary[]>([])
  const [contactResults, setContactResults] = useState<UserSummary[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactsSearching, setContactsSearching] = useState(false)
  const [contactMode, setContactMode] = useState<'contacts' | 'contactSearch'>('contacts')
  const [contactQuery, setContactQuery] = useState('')
  const [groupConversations, setGroupConversations] = useState<MessengerConversationDto[]>([])
  const [groupConversationsLoading, setGroupConversationsLoading] = useState(true)
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, MessengerPresenceDto>>({})
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  const [detailPhotoViewer, setDetailPhotoViewer] = useState<{ contentId: string; mediaId: string; mediaUrl: string; initialPost?: GatewayPost; initialPlaybackTime?: number } | null>(null)
  const contactSearchSequence = useRef(0)
  const locallyCreatedPostIds = useRef(new Set<string>())
  const feedMoreRequestRef = useRef(false)
  const feedSentinelRef = useRef<HTMLDivElement>(null)
  const leftRailRef = useRef<HTMLElement>(null)
  const rightRailRef = useRef<HTMLElement>(null)
  const initialLoadKeyRef = useRef<string | null>(null)
  const groupsRequestRef = useRef(0)

  useEffect(() => {
    const preloadInteractionChunks = () => {
      void loadStoryCreatorModal()
      void loadStoryViewerPage()
      void loadPostPhotoViewer()
    }
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preloadInteractionChunks, { timeout: 1200 })
      return () => window.cancelIdleCallback(idleId)
    }
    const timeoutId = window.setTimeout(preloadInteractionChunks, 700)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const loadFeed = useCallback(async (reset = false) => {
    if (!user) return
    if (!reset && feedMoreRequestRef.current) return
    if (!reset) feedMoreRequestRef.current = true
    if (reset) setFeedLoading(true)
    else setFeedMoreBusy(true)
    setFeedError(null)
    try {
      const offset = reset ? 0 : feedOffset
      const items = await api.recommendedFeed(user.userId, offset, FEED_PAGE_SIZE)
      const nextPosts = visibleRecommendationPosts(items)
      setPosts((current) => {
        const localPosts = reset ? current.filter((post) => locallyCreatedPostIds.current.has(post.id)) : current
        const combined = reset ? [...localPosts, ...nextPosts] : [...current, ...nextPosts]
        return [...new Map(combined.map((post) => [post.id, post])).values()]
      })
      setFeedOffset(offset + items.length)
      setFeedHasMore(items.length === FEED_PAGE_SIZE)
    } catch {
      setFeedError(t('feedLoadError'))
    } finally {
      setFeedLoading(false)
      setFeedMoreBusy(false)
      if (!reset) feedMoreRequestRef.current = false
    }
  }, [feedOffset, t, user])

  const loadStories = useCallback(async () => {
    if (!user) return
    setStoriesLoading(true)
    setStoriesError(null)
    try {
      const [home, mine] = await Promise.all([
        api.homeStories(user.userId, 16),
        api.myStories(user.userId),
      ])
      setStoryBuckets(home.items)
      if (!mine) {
        reconcileOwnUnseenStories(user.userId, [])
        setMyStories(null)
      } else {
        const locallyUnseenIds = reconcileOwnUnseenStories(user.userId, mine.stories.map((story) => story.id))
        const backendUnseenCount = Math.max(0, Number(mine.unseenCount ?? 0))
        const unseenCount = Math.max(backendUnseenCount, locallyUnseenIds.size)
        setMyStories({ ...mine, hasUnseen: mine.hasUnseen || unseenCount > 0, unseenCount })
      }
    } catch {
      setStoriesError(t('storiesLoadError'))
    } finally {
      setStoriesLoading(false)
    }
  }, [t, user])

  const loadGroups = useCallback(async () => {
    if (!user) return
    const requestId = ++groupsRequestRef.current
    setGroupsLoading(true)
    setGroupsError(null)
    try {
      const page = await api.visitedGroups(user.userId, 8)
      if (groupsRequestRef.current === requestId) setGroups(page.items)
    } catch {
      if (groupsRequestRef.current === requestId) setGroupsError(t('genericError'))
    } finally {
      if (groupsRequestRef.current === requestId) setGroupsLoading(false)
    }
  }, [t, user])

  useEffect(() => {
    const removeLeftGroup = (event: Event) => {
      const groupId = leftGroupIdFromEvent(event)
      if (!groupId) return
      setGroups((current) => current.filter((group) => group.id !== groupId))
      void loadGroups()
    }
    window.addEventListener(GROUP_MEMBERSHIP_CHANGED_EVENT, removeLeftGroup)
    return () => window.removeEventListener(GROUP_MEMBERSHIP_CHANGED_EVENT, removeLeftGroup)
  }, [loadGroups])

  const applyCreatedStory = useCallback((story: GatewayStory) => {
    if (!user) return
    rememberOwnUnseenStory(user.userId, story.id)
    setMyStories((current) => {
      const alreadyPresent = Boolean(current?.stories.some((item) => item.id === story.id))
      return {
        author: current?.author ?? {
          id: user.userId,
          name: profile?.displayName || user.email.split('@')[0],
          avatar: profile?.avatarUrl || '',
          isVerified: Boolean(profile?.isVerified),
        },
        latestCreate: story.create,
        hasUnseen: true,
        unseenCount: alreadyPresent ? Math.max(1, current?.unseenCount ?? 0) : (current?.unseenCount ?? 0) + 1,
        stories: [story, ...(current?.stories ?? []).filter((item) => item.id !== story.id)],
      }
    })
    setStoryBuckets((current) => current.filter((bucket) => bucket.author.id !== user.userId))
  }, [profile?.avatarUrl, profile?.displayName, profile?.isVerified, user])

  const markOwnStoryViewed = useCallback((storyId: string) => {
    if (!user || !forgetOwnUnseenStory(user.userId, storyId)) return
    setMyStories((current) => {
      if (!current?.stories.some((story) => story.id === storyId)) return current
      const unseenCount = Math.max(0, (current.unseenCount ?? 0) - 1)
      return { ...current, hasUnseen: unseenCount > 0, unseenCount }
    })
  }, [user])

  const loadContacts = useCallback(async () => {
    if (!user) return
    setContactsLoading(true)
    try {
      const conversations = await messengerApi.directConversations(user.userId, 40)
      const unique = new Map<string, UserSummary>()
      for (const conversation of conversations) {
        if (conversation.type !== 'DIRECT') continue
        const contact = conversation.participants.find((participant) => participant.id !== user.userId && !participant.leftAt)
        if (contact && !unique.has(contact.id)) unique.set(contact.id, contact)
      }
      setContacts([...unique.values()])
    } catch {
      setContacts([])
    } finally {
      setContactsLoading(false)
    }
  }, [user])

  const loadGroupConversations = useCallback(async () => {
    if (!user) return
    setGroupConversationsLoading(true)
    try {
      const conversations = await messengerApi.conversations(user.userId, 100)
      setGroupConversations(conversations.filter((conversation) => conversation.type === 'GROUP' && conversation.participants.some((participant) => participant.id === user.userId && !participant.leftAt)))
    } catch {
      setGroupConversations([])
    } finally {
      setGroupConversationsLoading(false)
    }
  }, [user])

  const loadFriends = useCallback(async () => {
    if (!user) return
    try { setFriends(await socialApi.getRelationProfiles(user.userId, 0, 100)) } catch { setFriends([]) }
  }, [user])

  useEffect(() => {
    const loadKey = user?.userId ? `${user.userId}:${refreshToken}` : null
    if (!loadKey || initialLoadKeyRef.current === loadKey) return
    initialLoadKeyRef.current = loadKey
    if (refreshToken > 0) {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      if (leftRailRef.current) leftRailRef.current.scrollTop = 0
      if (rightRailRef.current) rightRailRef.current.scrollTop = 0
      setContactMode('contacts')
      setContactQuery('')
    }
    void loadFeed(true)
    void loadStories()
    void loadGroups()
    void loadContacts()
    void loadGroupConversations()
    void loadFriends()
    // Initial load is tied to the authenticated identity; clicking active Home increments refreshToken.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, user?.userId])

  useEffect(() => {
    const upsertConversation = (event: Event) => {
      const conversation = (event as CustomEvent<MessengerConversationDto>).detail
      if (!conversation || conversation.type !== 'GROUP') return
      setGroupConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)])
    }
    window.addEventListener('fakebook:conversation-upserted', upsertConversation)
    return () => window.removeEventListener('fakebook:conversation-upserted', upsertConversation)
  }, [])

  useEffect(() => {
    const sentinel = feedSentinelRef.current
    if (!sentinel || feedLoading || feedMoreBusy || feedError || !feedHasMore || posts.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void loadFeed(false)
    }, { rootMargin: '520px 0px', threshold: 0.01 })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [feedError, feedHasMore, feedLoading, feedMoreBusy, loadFeed, posts.length])

  useEffect(() => {
    const query = contactQuery.trim()
    const requestId = ++contactSearchSequence.current
    if (contactMode !== 'contactSearch' || !query) {
      setContactResults([])
      setContactsSearching(false)
      return
    }

    const localQuery = query.toLocaleLowerCase()
    setContactResults(contacts.filter((contact) => contact.displayName.toLocaleLowerCase().includes(localQuery)))
    setContactsSearching(true)
    const timeoutId = window.setTimeout(() => {
      void searchApi.searchDirectContacts(query, 1, 20)
        .then((results) => {
          if (contactSearchSequence.current === requestId) setContactResults(results)
        })
        .catch(() => {
          if (contactSearchSequence.current === requestId) setContactResults([])
        })
        .finally(() => {
          if (contactSearchSequence.current === requestId) setContactsSearching(false)
        })
    }, 200)
    return () => window.clearTimeout(timeoutId)
  }, [contactMode, contactQuery, contacts])

  const visibleContacts = contactQuery.trim() ? contactResults : contacts
  const visibleContactPeople = visibleContacts
  const contactListPending = visibleContactPeople.length === 0 && (contactsLoading || (contactMode === 'contactSearch' && contactQuery.trim().length > 0 && contactsSearching))
  const presenceIds = useMemo(
    () => [...new Set([
      ...visibleContactPeople.map((person) => person.id),
      ...groupConversations.flatMap((conversation) => conversation.participants
        .filter((participant) => participant.id !== user?.userId && !participant.leftAt)
        .map((participant) => participant.id)),
    ])].slice(0, 250),
    [groupConversations, user?.userId, visibleContactPeople],
  )
  const presenceKey = presenceIds.join(',')

  useEffect(() => {
    if (presenceIds.length === 0) {
      setPresenceByUserId({})
      return
    }
    let active = true
    const refresh = () => {
      void messengerApi.presence(presenceIds)
        .then((statuses) => {
          if (active) setPresenceByUserId(Object.fromEntries(statuses.map((item) => [item.userId, item])))
        })
        .catch(() => undefined)
    }
    refresh()
    const intervalId = window.setInterval(refresh, 30_000)
    const unsubscribe = messengerApi.subscribePresence(presenceIds, (event) => {
      if (!active || event.kind !== 'PRESENCE_CHANGED' || !event.userId) return
      const isOnline = Boolean(event.expiresAt && new Date(event.expiresAt).getTime() > Date.now())
      const occurredAt = event.occurredAt || new Date().toISOString()
      setPresenceByUserId((current) => ({
        ...current,
        [event.userId!]: {
          userId: event.userId!,
          isOnline,
          expiresAt: isOnline ? event.expiresAt : null,
          updatedAt: isOnline ? occurredAt : current[event.userId!]?.updatedAt ?? occurredAt,
        },
      }))
    })
    return () => {
      active = false
      window.clearInterval(intervalId)
      unsubscribe()
    }
    // A stable string prevents a new polling loop when only the array identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceKey])

  useEffect(() => {
    const intervalId = window.setInterval(() => setPresenceNow(Date.now()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('home-page-scroll')
    document.body.classList.add('home-page-scroll')
    return () => {
      document.documentElement.classList.remove('home-page-scroll')
      document.body.classList.remove('home-page-scroll')
    }
  }, [])

  useEffect(() => {
    const rails = [leftRailRef.current, rightRailRef.current].filter((rail): rail is HTMLElement => rail !== null)
    const keepWheelInsideRail = (event: WheelEvent) => {
      if (window.innerWidth <= 860 || event.ctrlKey) return
      const rail = event.currentTarget as HTMLElement
      const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientHeight : 1
      event.preventDefault()
      event.stopPropagation()
      rail.scrollTop += event.deltaY * deltaScale
    }

    rails.forEach((rail) => rail.addEventListener('wheel', keepWheelInsideRail, { passive: false }))
    return () => rails.forEach((rail) => rail.removeEventListener('wheel', keepWheelInsideRail))
  }, [user?.userId])

  if (!user) return null

  async function openGroup(group: VisitedGroup) {
    if (!user) return
    try {
      await api.recordGroupVisit(user.userId, group.id)
      onNavigate?.(`/groups/${group.id}`)
    } catch {
      setGroupsError(t('genericError'))
    }
  }

  return <>
    <main className="gateway-home">
      <aside ref={leftRailRef} className="gateway-left-rail" aria-label={t('visitedGroups')}>
        <nav className="home-shortcuts" aria-label={t('primaryNavLabel')}>
          <button type="button" onClick={() => onNavigate?.(`/profile/${user.userId}`)}><Avatar name={profile?.displayName || user.email} src={profile?.avatarUrl} size={36} /><strong>{profile?.displayName || user.email.split('@')[0]}<VerifiedBadge verified={profile?.isVerified} size={13} /></strong></button>
          <button type="button" onClick={() => onNavigate?.('/saved')}><span className="shortcut-icon saved"><SavedShortcutIcon size={27} /></span><strong>{t('saved')}</strong></button>
          <button type="button" onClick={() => onNavigate?.('/friends')}><span className="shortcut-icon friends"><FriendsShortcutIcon size={27} /></span><strong>{t('friends')}</strong></button>
          <button type="button" onClick={() => onNavigate?.('/reels')}><span className="shortcut-icon reels"><ReelIcon size={27} filled gradient /></span><strong>{t('reels')}</strong></button>
          <button type="button" onClick={() => onNavigate?.('/groups')}><span className="shortcut-icon groups"><GroupsShortcutIcon size={27} /></span><strong>{t('groups')}</strong></button>
        </nav>
        <section className="card service-panel">
          <div className="service-heading">
            <div><h2>{t('visitedGroups')}</h2><p>{t('visitedGroupsSubtitle')}</p></div>
            <button type="button" className="btn-soft sm" onClick={() => void loadGroups()} disabled={groupsLoading}>{t('refresh')}</button>
          </div>
          {groupsError && <p className="form-error">{groupsError}</p>}
          {groups.length === 0 ? (!groupsLoading && <p className="muted">{t('noVisitedGroups')}</p>) : (
            <div className="group-shortcuts">
              {groups.map((group) => (
                <button type="button" key={group.id} onClick={() => void openGroup(group)}>
                  <Avatar name={group.name} src={group.avatar || null} size={36} />
                  <span className="home-visited-group-copy"><strong>{group.name}</strong>{group.visitedAt && <small>{t('visitedTime', { time: groupVisitRelativeTime(group.visitedAt, locale) })}</small>}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>

      <div className="gateway-feed-column">
        <PostComposer
          userId={user.userId}
          displayName={profile?.displayName || user.email.split('@')[0]}
          avatarUrl={profile?.avatarUrl || null}
          isVerified={profile?.isVerified}
          friends={friends}
          onNavigate={onNavigate}
          onCreated={(post) => {
            locallyCreatedPostIds.current.add(post.id)
            setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
          }}
        />
        <StorySection
          buckets={storyBuckets}
          myStories={myStories}
          loading={storiesLoading}
          error={storiesError}
          userId={user.userId}
          profile={profile}
          onReload={loadStories}
          onStoryCreated={applyCreatedStory}
          onStoryViewed={markOwnStoryViewed}
          onStoryDeleted={(storyId) => {
            const wasLocallyUnseen = forgetOwnUnseenStory(user.userId, storyId)
            setMyStories((current) => {
              if (!current) return null
              const next = removeStoryFromBucket(current, storyId)
              if (!next || !wasLocallyUnseen) return next
              const unseenCount = Math.max(0, (current.unseenCount ?? 0) - 1)
              return { ...next, hasUnseen: unseenCount > 0, unseenCount }
            })
            setStoryBuckets((current) => current.flatMap((bucket) => {
              const next = removeStoryFromBucket(bucket, storyId)
              return next ? [next] : []
            }))
          }}
          onNavigate={onNavigate}
        />

        <section className="feed-section" aria-labelledby="recommended-feed-title">
          <div className="feed-heading">
            <div>
              <h1 id="recommended-feed-title">{t('recommendedFeed')}</h1>
              <p>{t('recommendedFeedSubtitle')}</p>
            </div>
            <button type="button" className="btn-soft sm" onClick={() => void loadFeed(true)} disabled={feedLoading}>{t('refresh')}</button>
          </div>
          {feedError && <div className="card state-card"><p className="form-error">{feedError}</p><button type="button" className="btn-primary" onClick={() => void loadFeed(true)}>{t('tryAgain')}</button></div>}
          {feedLoading ? <HomeFeedSkeleton label={t('loadingMore')} /> : !feedError && posts.length === 0 ? (
            <div className="card state-card"><h2>{t('noRecommendedPosts')}</h2><p>{t('noRecommendedPostsDesc')}</p></div>
          ) : (
          posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={user.userId} onNavigate={onNavigate} onOpenReel={(reel) => onOpenReel ? onOpenReel(reel) : onNavigate?.(`/reels?source=for-you&reel=${encodeURIComponent(reel.id)}`)} onMessage={onMessage} onStoryCreated={applyCreatedStory} />)
          )}
            {!feedLoading && !feedError && posts.length > 0 && (
              <div ref={feedSentinelRef} className="feed-more feed-auto-loader" aria-live="polite">
                {feedMoreBusy && <span className="spinner" aria-label={t('loadingMore')} />}
                {!feedHasMore && <p className="muted">{t('endOfFeed')}</p>}
              </div>
            )}
        </section>
      </div>

      <aside ref={rightRailRef} className="gateway-right-rail" aria-label={t('contacts')}>
        <section className="right-rail-module contacts-module">
          <header><h2>{t('contacts')}</h2><div><button type="button" aria-label={t('newMessage')} onClick={() => { setContactMode('contacts'); setContactQuery(''); onNewConversation?.() }}><Icon name="plus" size={18} /></button><button type="button" className={contactMode === 'contactSearch' ? 'active' : ''} aria-label={t('search')} aria-pressed={contactMode === 'contactSearch'} onClick={() => { setContactMode((mode) => mode === 'contactSearch' ? 'contacts' : 'contactSearch'); setContactQuery('') }}><ContactSearchIcon /></button><button type="button" aria-label={t('more')} onClick={() => onNavigate?.('/messenger')}><Icon name="more" size={17} /></button></div></header>
          {contactMode === 'contactSearch' && <label className="contact-search-wrap"><ContactSearchIcon /><input className="contact-search" autoFocus value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder={t('searchContacts')} /></label>}
          {!contactListPending && (visibleContactPeople.length === 0
              ? <p>{contactQuery ? t('noContactsFound') : t('noContactsYet')}</p>
              : <div className="contact-list">{visibleContactPeople.map((person) => {
                const presence = presenceByUserId[person.id]
                const online = Boolean(presence?.isOnline)
                const statusLabel = presence ? formatPresence(presence, t, presenceNow) : null
                return <button type="button" key={person.id} onClick={() => onMessage ? void onMessage(person.id) : onNavigate?.(`/profile/${person.id}`)}><span className="contact-avatar"><Avatar name={person.displayName} src={person.avatarUrl} size={36} online={online} /></span><span className="contact-copy"><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} size={12} /></strong>{statusLabel && <small>{statusLabel}</small>}</span></button>
              })}</div>)}
        </section>
        <section className="right-rail-module group-conversations-module" aria-labelledby="group-conversations-title">
          <h2 id="group-conversations-title">{t('groupChats')}</h2>
          {groupConversations.length === 0 ? (!groupConversationsLoading && <p>{t('noGroupChatsYet')}</p>) : <div className="contact-list group-conversation-list">{groupConversations.map((conversation) => {
            const name = conversation.title?.trim() || t('groupConversation')
            const avatar = conversation.avatarUrl || conversation.participants.find((participant) => participant.id !== user.userId)?.avatarUrl || null
            const groupPresence = groupPresenceSummary(conversation, user.userId, presenceByUserId, t, presenceNow)
            return <button type="button" key={conversation.id} onClick={() => onConversation ? onConversation(conversation) : onNavigate?.(`/messenger?conversation=${encodeURIComponent(conversation.id)}`)}><span className="contact-avatar"><Avatar name={name} src={avatar} size={36} online={groupPresence.onlineCount > 0} /></span><span className="contact-copy"><strong>{name}</strong><small>{groupPresence.label}</small></span></button>
          })}</div>}
        </section>
      </aside>
    </main>
    {detailPostId && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><ContentDetailOverlay
      viewerId={user.userId}
      contentId={detailPostId}
      onClose={() => { if (onDetailClose) onDetailClose(); else onNavigate?.('/home') }}
      onNavigate={onNavigate}
      onMessage={onMessage}
      onStoryCreated={applyCreatedStory}
      onOpenImage={(detailPost, media, _index, initialPlaybackTime) => setDetailPhotoViewer({ contentId: detailPost.id, mediaId: media.id, mediaUrl: media.url, initialPost: detailPost, initialPlaybackTime })}
      onOpenReel={onOpenReel ?? ((reel) => onNavigate?.(`/reels?source=for-you&reel=${encodeURIComponent(reel.id)}`))}
    /></Suspense>}
    {user && detailPhotoViewer && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><PostPhotoViewer viewerId={user.userId} contentId={detailPhotoViewer.contentId} initialMediaId={detailPhotoViewer.mediaId} initialMediaUrl={detailPhotoViewer.mediaUrl} initialPlaybackTime={detailPhotoViewer.initialPlaybackTime} initialPost={detailPhotoViewer.initialPost} onClose={() => setDetailPhotoViewer(null)} onNavigate={onNavigate} onMessage={onMessage} onStoryCreated={applyCreatedStory} /></Suspense>}
  </>
}

function ContactSearchIcon() {
  return <svg className="contact-search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10.25" cy="10.25" r="6.3" /><path d="m14.95 14.95 4.75 4.75" /></svg>
}

function HomeFeedSkeleton({ label }: { label: string }) {
  return <article className="card gateway-post home-feed-skeleton" role="status" aria-label={label}>
    <header className="feed-post-head" aria-hidden="true">
      <span className="home-feed-skeleton-avatar" />
      <div className="home-feed-skeleton-heading"><span /><span /></div>
    </header>
    <div className="home-feed-skeleton-copy" aria-hidden="true"><span /><span /><span /></div>
    <div className="home-feed-skeleton-media" aria-hidden="true" />
    <div className="home-feed-skeleton-actions" aria-hidden="true"><span /><span /><span /></div>
  </article>
}

interface ComposerMediaFile {
  file: File
  previewUrl: string
}

function fileIdentity(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`
}

function createFilePreview(file: File) {
  try {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
  } catch {
    return ''
  }
}

function revokeFilePreviews(items: ComposerMediaFile[]) {
  if (typeof URL.revokeObjectURL !== 'function') return
  items.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

const POST_COMPOSER_EMOJIS = [
  '😀', '😍', '😂', '🥰', '😎', '🤔', '😢', '😡',
  '👍', '🎉', '❤️', '🔥', '🙏', '💯', '✨', '👏',
]
const POST_BACKGROUND_EDITOR_HEIGHT = 260

function PrivacyCaretIcon() {
  return <svg className="home-post-privacy-caret" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7.2 9.2h9.6c.75 0 1.15.88.64 1.44l-4.72 5.18c-.38.42-1.06.42-1.44 0l-4.72-5.18C6.05 10.08 6.45 9.2 7.2 9.2Z" />
  </svg>
}

function PollComposerIcon({ size = 27 }: { size?: number }) {
  return <svg className="group-poll-composer-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" />
    <path d="M7.8 13.2h2.05v4H7.8v-4Zm3.18-6.4h2.05v10.4h-2.05V6.8Zm3.18 3.15h2.05v7.25h-2.05V9.95Z" fill="var(--card)" />
  </svg>
}

export function PostComposer({ variant = 'home', userId, displayName, avatarUrl, isVerified, friends, groupId = null, groupName = '', groupAvatarUrl = null, groupPrivacy = 0, onNavigate, onReel, onCreated, triggerOnly = false, externalOpenRequest = 0, externalReelOpenRequest = 0 }: { variant?: 'home' | 'profile' | 'group'; userId: string; displayName: string; avatarUrl: string | null; isVerified?: boolean; friends: UserSummary[]; groupId?: string | null; groupName?: string; groupAvatarUrl?: string | null; groupPrivacy?: number; onNavigate?: (path: string) => void; onReel?: () => void; onCreated: (post: GatewayPost) => void; triggerOnly?: boolean; externalOpenRequest?: number; externalReelOpenRequest?: number }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [reelOpen, setReelOpen] = useState(false)
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState<PostPrivacy>(() => readDefaultPostPrivacy(userId))
  const [backgroundId, setBackgroundId] = useState<PostBackgroundId | null>(null)
  const [activePicker, setActivePicker] = useState<'privacy' | 'background' | 'emoji' | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<ComposerMediaFile[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [taggedPeople, setTaggedPeople] = useState<UserSummary[]>([])
  const [mentionEntities, setMentionEntities] = useState<MentionEntity[]>([])
  const [mentionCaret, setMentionCaret] = useState(0)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const selectedFilesRef = useRef<ComposerMediaFile[]>([])
  const privacyPickerRef = useRef<HTMLDivElement>(null)
  const backgroundPickerRef = useRef<HTMLDivElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const files = selectedFiles.map((item) => item.file)
  const groupMode = variant === 'group' && Boolean(groupId)

  useEffect(() => {
    selectedFilesRef.current = selectedFiles
  }, [selectedFiles])

  useEffect(() => () => revokeFilePreviews(selectedFilesRef.current), [])

  useEffect(() => {
    if (externalOpenRequest <= 0) return
    setMessage(null)
    setOpen(true)
  }, [externalOpenRequest])

  useEffect(() => {
    if (externalReelOpenRequest <= 0 || groupMode || onReel) return
    void loadCreateReelModal()
    setReelOpen(true)
  }, [externalReelOpenRequest, groupMode, onReel])

  useEffect(() => {
    if (variant === 'home' && !onReel) void loadCreateReelModal()
  }, [onReel, variant])

  useEffect(() => {
    if (!activePicker) return
    function closePickerFromOutside(event: PointerEvent) {
      const target = event.target as Node
      const activeRef = activePicker === 'privacy'
        ? privacyPickerRef
        : activePicker === 'background'
          ? backgroundPickerRef
          : emojiPickerRef
      if (!activeRef.current?.contains(target)) setActivePicker(null)
    }
    function closePickerFromEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setActivePicker(null)
    }
    document.addEventListener('pointerdown', closePickerFromOutside)
    document.addEventListener('keydown', closePickerFromEscape)
    return () => {
      document.removeEventListener('pointerdown', closePickerFromOutside)
      document.removeEventListener('keydown', closePickerFromEscape)
    }
  }, [activePicker])

  const taggedSummary = taggedPeople.length === 0
    ? null
    : taggedPeople.length <= 3
      ? t('withTaggedPeople', { people: taggedPeople.map((person) => person.displayName).join(', ') })
      : t('withTaggedPeopleAndOthers', {
          people: taggedPeople.slice(0, 3).map((person) => person.displayName).join(', '),
          count: taggedPeople.length - 3,
        })
  const privacyOptions: Array<{ value: PostPrivacy; label: string }> = [
    { value: 0, label: t('privacyPublic') },
    { value: 1, label: t('privacyFriendsFollowers') },
    { value: 2, label: t('privacyFriends') },
    { value: 3, label: t('privacyOnlyMe') },
  ]
  const privacyLabel = privacyOptions.find((option) => option.value === privacy)?.label ?? t('privacyPublic')
  const effectivePrivacy: PostPrivacy = groupMode ? groupPrivacy === 0 ? 0 : 2 : privacy
  const effectivePrivacyLabel = groupMode ? groupPrivacy === 0 ? t('publicGroup') : t('privateGroup') : privacyLabel
  const selectedBackground = selectedFiles.length === 0 ? getPostBackgroundPreset(backgroundId) : null
  const composerPlaceholder = t('postComposerPersonalPlaceholder', { name: displayName })
  const postEditorClass = selectedBackground
    ? 'mention-compose-field home-post-editor has-background'
    : selectedFiles.length > 0
      ? 'mention-compose-field home-post-editor has-media'
      : 'mention-compose-field home-post-editor'

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const textareaElement: HTMLTextAreaElement = textarea
    if (!selectedBackground) {
      textareaElement.style.removeProperty('--home-post-background-padding')
      return
    }

    function centerBackgroundText() {
      const editorHeight = textareaElement.clientHeight || POST_BACKGROUND_EDITOR_HEIGHT
      const computedStyle = window.getComputedStyle(textareaElement)
      const fontSize = Number.parseFloat(computedStyle.fontSize) || 27.2
      const rawLineHeight = Number.parseFloat(computedStyle.lineHeight)
      const lineHeight = Number.isFinite(rawLineHeight)
        ? rawLineHeight <= 4 ? rawLineHeight * fontSize : rawLineHeight
        : fontSize * 1.28
      const previousHeight = textareaElement.style.height
      const previousMinHeight = textareaElement.style.minHeight
      const previousPaddingTop = textareaElement.style.paddingTop
      const previousPaddingBottom = textareaElement.style.paddingBottom
      textareaElement.style.height = '0px'
      textareaElement.style.minHeight = '0px'
      textareaElement.style.paddingTop = '0px'
      textareaElement.style.paddingBottom = '0px'
      const contentHeight = Math.max(lineHeight, textareaElement.scrollHeight)
      textareaElement.style.height = previousHeight
      textareaElement.style.minHeight = previousMinHeight
      textareaElement.style.paddingTop = previousPaddingTop
      textareaElement.style.paddingBottom = previousPaddingBottom
      const verticalPadding = Math.max(16, Math.floor((editorHeight - Math.min(contentHeight, editorHeight - 32)) / 2))
      textareaElement.style.setProperty('--home-post-background-padding', `${verticalPadding}px`)
    }

    centerBackgroundText()
    window.addEventListener('resize', centerBackgroundText)
    return () => window.removeEventListener('resize', centerBackgroundText)
  }, [content, selectedBackground])

  function showComposer() {
    void loadComposerMediaPreview()
    void loadTagPeoplePicker()
    setMessage(null)
    setOpen(true)
  }

  function showReelComposer() {
    if (onReel) {
      onReel()
      return
    }
    void loadCreateReelModal()
    setReelOpen(true)
  }

  function clearFiles() {
    revokeFilePreviews(selectedFiles)
    setSelectedFiles([])
    setFileKey((value) => value + 1)
  }

  function closeComposer() {
    if (busy) return
    setOpen(false)
    setTagPickerOpen(false)
    setActivePicker(null)
    setContent('')
    setBackgroundId(null)
    clearFiles()
    setTaggedPeople([])
    setMentionEntities([])
    setMentionCaret(0)
    setMessage(null)
  }

  function selectFiles(fileList: FileList | readonly File[] | null, mode: 'append' | 'replace' = 'replace') {
    const incoming = Array.from(fileList ?? [])
    if (incoming.length === 0) return
    const isVideo = (file: File) => file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name)
    const rejected = incoming.find((file) => file.size > (isVideo(file) ? MAX_POST_VIDEO_BYTES : MAX_POST_STANDARD_MEDIA_BYTES))
    const accepted = incoming.filter((file) => file.size <= (isVideo(file) ? MAX_POST_VIDEO_BYTES : MAX_POST_STANDARD_MEDIA_BYTES))
    const sizeError = rejected
      ? isVideo(rejected) ? t('postVideoTooLarge') : t('postMediaTooLarge')
      : null
    setBackgroundId(null)
    setActivePicker(null)
    if (accepted.length === 0) {
      setFileKey((value) => value + 1)
      setMessage(sizeError)
      setOpen(true)
      return
    }
    if (mode === 'replace') {
      const seen = new Set<string>()
      const nextFiles = accepted
        .filter((file) => {
          const key = fileIdentity(file)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, 10)
        .map((file) => ({ file, previewUrl: createFilePreview(file) }))
      revokeFilePreviews(selectedFiles)
      setSelectedFiles(nextFiles)
    } else {
      const seen = new Set(selectedFiles.map((item) => fileIdentity(item.file)))
      const additions = accepted
        .filter((file) => {
          const key = fileIdentity(file)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, Math.max(0, 10 - selectedFiles.length))
        .map((file) => ({ file, previewUrl: createFilePreview(file) }))
      setSelectedFiles([...selectedFiles, ...additions])
    }
    setFileKey((value) => value + 1)
    setMessage(sizeError)
    setOpen(true)
  }

  function toggleTaggedPerson(person: UserSummary) {
    setTaggedPeople((current) => current.some((item) => item.id === person.id)
      ? current.filter((item) => item.id !== person.id)
      : [...current, person])
  }

  function choosePrivacy(value: PostPrivacy) {
    setPrivacy(value)
    setActivePicker(null)
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const end = textarea?.selectionEnd ?? start
    const nextContent = `${content.slice(0, start)}${emoji}${content.slice(end)}`
    const nextCursor = start + emoji.length
    setMentionEntities((current) => reconcileMentionEntities(content, nextContent, current))
    setContent(nextContent)
    setMentionCaret(nextCursor)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
    }, 0)
  }

  function changeMentionContent(nextContent: string, caret: number) {
    setMentionEntities((current) => reconcileMentionEntities(content, nextContent, current))
    setContent(nextContent)
    setMentionCaret(caret)
  }

  function selectMention(person: UserSummary, mention: Parameters<typeof applyMentionSelection>[1]) {
    const selected = applyMentionSelection(content, mention, person)
    setMentionEntities((current) => [
      ...reconcileMentionEntities(content, selected.text, current).filter((entity) => entity.userId !== person.id || entity.start !== selected.entity.start),
      selected.entity,
    ])
    setContent(selected.text)
    setMentionCaret(selected.caret)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(selected.caret, selected.caret)
    }, 0)
  }

  function renderEmojiPicker(inline = false) {
    return <div className={inline ? 'home-post-emoji-picker inline' : 'home-post-emoji-picker'} ref={emojiPickerRef}><button type="button" disabled={busy} aria-label={t('insertEmoji')} title={t('insertEmoji')} aria-expanded={activePicker === 'emoji'} onClick={() => setActivePicker((current) => current === 'emoji' ? null : 'emoji')}><Icon name="feeling" size={25} /></button>{activePicker === 'emoji' && <div className="home-post-emoji-menu" role="menu" aria-label={t('insertEmoji')}>{POST_COMPOSER_EMOJIS.map((emoji) => <button key={emoji} type="button" role="menuitem" aria-label={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}</div>
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim() && files.length === 0) return setMessage(t('composeNeedContent'))
    setBusy(true)
    setMessage(null)
    let uploaded: MediaUpload[] = []
    let persisted = false
    try {
      uploaded = files.length > 0 ? await api.uploadMediaFiles(files) : []
      const serializedContent = serializeMentionContent(content, mentionEntities)
      const persistedContent = encodePostContent(serializedContent, files.length === 0 ? backgroundId : null)
      const mentionById = new Map(mentionEntities.map((mention) => [mention.userId, mention]))
      const optimisticMentions = extractMentionUserIds(serializedContent).flatMap((userId) => {
        const mention = mentionById.get(userId)
        return mention ? [{ userId, name: mention.displayName, available: true }] : []
      })
      const optimisticTaggedUsers: GatewayTaggedUser[] = taggedPeople.map((person) => ({
        id: person.id,
        name: person.displayName,
        avatar: person.avatarUrl ?? '',
        isVerified: Boolean(person.isVerified),
      }))
      const media = uploaded.map((item) => ({ type: mediaType(item.type), url: item.url }))
      const taggedUserIds = taggedPeople.map((person) => person.id)
      const created = groupMode && groupId
        ? await socialApi.createGroupPost(userId, groupId, {
            content: persistedContent,
            media,
            ...(taggedUserIds.length > 0 ? { taggedUserIds } : {}),
          })
        : await api.createFeedPost({
            authorId: userId,
            content: persistedContent,
            privacy,
            media,
            ...(taggedUserIds.length > 0 ? { taggedUserIds } : {}),
          })
      persisted = true
      const optimisticBase = {
        id: created.id,
        type: created.type ?? 1,
        content: created.content ?? persistedContent,
        privacy: created.privacy ?? effectivePrivacy,
        create: ('create' in created ? created.create : created.createdAt) ?? new Date().toISOString(),
        author: {
          id: userId,
          name: displayName,
          avatar: avatarUrl ?? '',
          isVerified: Boolean(isVerified),
          canFollow: false,
        },
        media: created.media ?? uploaded.map((item, index) => ({
          id: item.assetId ?? `${created.id}-media-${index}`,
          type: mediaType(item.type),
          url: item.url,
        })),
        mentions: optimisticMentions,
        taggedUsers: optimisticTaggedUsers,
      }
      const optimisticPost: GatewayPost = groupMode && groupId
        ? {
            ...optimisticBase,
            __typename: 'GroupPostDetail',
            group: { id: groupId, name: groupName, avatar: groupAvatarUrl ?? '', canJoin: false },
          }
        : { ...optimisticBase, __typename: 'FeedPostDetail', sharedSource: null }
      let hydrated: GatewayPost | null = null
      try {
        hydrated = await api.postDetail(created.id)
      } catch {
        // The write already succeeded. A slow read replica or detail projection must not
        // turn a published post into a false failure (and invite duplicate retries).
      }
      if (hydrated) {
        const hydratedMentionIds = new Set((hydrated.mentions ?? []).map((mention) => mention.userId))
        const hydratedTaggedIds = new Set((hydrated.taggedUsers ?? []).map((person) => person.id))
        onCreated({
          ...hydrated,
          mentions: [
            ...(hydrated.mentions ?? []),
            ...optimisticMentions.filter((mention) => !hydratedMentionIds.has(mention.userId)),
          ],
          taggedUsers: [
            ...(hydrated.taggedUsers ?? []),
            ...optimisticTaggedUsers.filter((person) => !hydratedTaggedIds.has(person.id)),
          ],
        })
      } else {
        onCreated(optimisticPost)
      }
      setContent('')
      setBackgroundId(null)
      clearFiles()
      setTaggedPeople([])
      setMentionEntities([])
      setMentionCaret(0)
      setTagPickerOpen(false)
      setActivePicker(null)
      setOpen(false)
      setMessage(null)
    } catch {
      if (!persisted) await Promise.allSettled(uploaded.map((item) => api.cancelPendingMedia(item)))
      setMessage(t('publishPostError'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    {!triggerOnly && <section className={variant === 'home' ? 'card gateway-composer home-composer-card' : variant === 'group' ? 'card gateway-composer home-composer-card profile-composer-card group-profile-composer-card' : 'card gateway-composer home-composer-card profile-composer-card'} aria-label={t('createPost')}>
      <div className="home-composer-row">
        <button type="button" className="home-composer-avatar" aria-label={displayName} onClick={(event) => { event.stopPropagation(); onNavigate?.(`/profile/${userId}`) }}><Avatar name={displayName} src={avatarUrl} size={40} /></button>
        <button type="button" className="home-composer-prompt" onClick={showComposer}>{t(variant === 'group' ? 'groupPostPrompt' : variant === 'profile' ? 'profilePostPrompt' : 'postComposerPlaceholder')}</button>
        {variant === 'home' && <div className="home-composer-quick-actions">
          <button type="button" className="home-composer-quick-action live" aria-label={t('liveVideo')} title={t('liveVideo')} onClick={() => undefined}><LiveVideoIcon size={29} /></button>
          <label className="home-composer-media" aria-label={t('photoVideo')} title={t('photoVideo')}>
            <Icon name="photo" size={26} />
            <span>{t('photoVideo')}</span>
            <input key={`quick-${fileKey}`} type="file" multiple accept="image/*,video/*" onChange={(event) => selectFiles(event.target.files)} />
          </label>
          <button type="button" className="home-composer-quick-action reel" aria-label={t('createReel')} title={t('createReel')} onPointerEnter={() => void loadCreateReelModal()} onFocus={() => void loadCreateReelModal()} onClick={showReelComposer}><ReelIcon size={26} filled /></button>
        </div>}
      </div>
      {variant === 'profile' && <div className="profile-composer-actions"><button type="button" className="live" onClick={showComposer}><LiveVideoIcon size={29} /><span className="profile-composer-action-label">{t('profileLiveVideo')}</span></button><label className="media"><Icon name="photo" size={26} /><span className="profile-composer-action-label">{t('photoVideo')}</span><input key={`profile-quick-${fileKey}`} type="file" multiple accept="image/*,video/*" onChange={(event) => selectFiles(event.target.files)} /></label><button type="button" className="reel" onClick={showReelComposer}><ReelIcon size={26} filled /><span className="profile-composer-action-label">{t('profileTabReels')}</span></button></div>}
      {variant === 'group' && <div className="profile-composer-actions group-profile-composer-actions"><button type="button" className="live" onClick={showComposer}><LiveVideoIcon size={29} /><span className="profile-composer-action-label">{t('profileLiveVideo')}</span></button><label className="media"><Icon name="photo" size={26} /><span className="profile-composer-action-label">{t('photoVideo')}</span><input key={`group-quick-${fileKey}`} type="file" multiple accept="image/*,video/*" onChange={(event) => selectFiles(event.target.files)} /></label><button type="button" className="poll" onClick={showComposer}><PollComposerIcon size={27} /><span className="profile-composer-action-label">{t('groupPoll')}</span></button></div>}
      {message && !open && <p className="form-error home-composer-message">{message}</p>}
    </section>}

    {open && <div className="modal-backdrop home-composer-backdrop" role="presentation" onClick={closeComposer}>
      <form className={selectedFiles.length > 0 ? 'modal home-post-modal has-media' : 'modal home-post-modal'} role="dialog" aria-modal="true" aria-label={t('createPost')} onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <header className="modal-head home-post-modal-head"><h2>{t('createPost')}</h2><button type="button" className="icon-circle" aria-label={t('close')} onClick={closeComposer}><Icon name="close" /></button></header>
        <div className={selectedFiles.length > 0 ? 'home-post-modal-body has-media' : 'home-post-modal-body'}>
          <div className="home-post-author">
            <Avatar name={displayName} src={avatarUrl} size={36} />
            <div><div className="home-post-author-name"><strong>{displayName}<VerifiedBadge verified={isVerified} size={13} /></strong>{taggedSummary && <span className="home-tagged-summary"> {taggedSummary}</span>}</div>{groupMode ? <div className="home-post-privacy-picker group-post-fixed-privacy"><span className="home-post-privacy-control" aria-label={effectivePrivacyLabel}><PostPrivacyIcon privacy={effectivePrivacy} size={14} group /><span>{effectivePrivacyLabel}</span></span></div> : <div className="home-post-privacy-picker" ref={privacyPickerRef}><button type="button" className="home-post-privacy-control" aria-label={t('privacy')} aria-haspopup="listbox" aria-expanded={activePicker === 'privacy'} onClick={() => setActivePicker((current) => current === 'privacy' ? null : 'privacy')}><PostPrivacyIcon privacy={privacy} size={14} /><span>{privacyLabel}</span><PrivacyCaretIcon /></button>{activePicker === 'privacy' && <div className="home-post-privacy-menu" role="listbox" aria-label={t('privacy')}>{privacyOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={privacy === option.value} onClick={() => choosePrivacy(option.value)}><PostPrivacyIcon privacy={option.value} size={18} /><span>{option.label}</span></button>)}</div>}</div>}</div>
          </div>
          <div className={postEditorClass} data-replicated-value={selectedFiles.length > 0 ? content || composerPlaceholder : undefined} style={selectedBackground ? { background: selectedBackground.background } : undefined}><MentionDraftOverlay text={content} entities={mentionEntities} textareaRef={textareaRef} /><textarea ref={textareaRef} autoFocus value={content} onChange={(event) => changeMentionContent(event.target.value, event.target.selectionStart ?? event.target.value.length)} onPaste={(event) => {
            if (busy) return
            const pastedImages = clipboardImageFiles(event.clipboardData)
            if (pastedImages.length === 0) return
            event.preventDefault()
            selectFiles(pastedImages, 'append')
          }} onSelect={(event) => setMentionCaret(event.currentTarget.selectionStart ?? content.length)} placeholder={composerPlaceholder} rows={selectedFiles.length > 0 ? 1 : 6} /><MentionSuggestions text={content} people={friends} textareaRef={textareaRef} caretIndex={mentionCaret} onSelected={selectMention} />{selectedFiles.length > 0 && renderEmojiPicker(true)}</div>
          {selectedFiles.length > 0 && <div className="home-media-preview-viewport" key={`media-scroll-${fileKey}`}><div className="home-media-preview-scroll"><Suspense fallback={<div className="home-media-preview home-media-preview-loading"><span className="spinner" /></div>}><ComposerMediaPreview items={selectedFiles} fileKey={fileKey} busy={busy} onReplace={(fileList) => selectFiles(fileList, 'replace')} onClear={clearFiles} showClear={false} /></Suspense></div><button type="button" className="home-media-preview-fixed-clear" disabled={busy} aria-label={t('removeMedia')} title={t('removeMedia')} onClick={clearFiles}><Icon name="close" size={18} /></button></div>}
          {selectedFiles.length === 0 && <div className="home-post-style-row">
            <div className="home-post-background-picker" ref={backgroundPickerRef}><button type="button" className={selectedBackground ? 'home-post-background-toggle selected' : 'home-post-background-toggle'} style={selectedBackground ? { background: selectedBackground.background } : undefined} disabled={busy || selectedFiles.length > 0} aria-label={t('postBackground')} aria-expanded={activePicker === 'background'} onClick={() => setActivePicker((current) => current === 'background' ? null : 'background')}>{activePicker === 'background' ? <svg className="home-post-background-back-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg> : <span>Aa</span>}</button>{activePicker === 'background' && <div className="home-post-background-options"><button type="button" className={backgroundId === null ? 'none selected' : 'none'} aria-label={t('removePostBackground')} onClick={() => setBackgroundId(null)}><span aria-hidden="true">×</span></button>{POST_BACKGROUND_PRESETS.map((preset, index) => <button key={preset.id} type="button" className={backgroundId === preset.id ? 'selected' : ''} style={{ background: preset.background }} aria-label={`${t('postBackground')} ${index + 1}`} onClick={() => setBackgroundId(preset.id)} />)}</div>}</div>
            {renderEmojiPicker()}
          </div>}
          <div className="home-add-to-post"><strong>{t('addToPost')}</strong><div className="home-add-to-post-actions"><label aria-label={t('photoVideo')} title={t('photoVideo')}><Icon name="photo" size={25} /><input key={`modal-${fileKey}`} disabled={busy} type="file" multiple accept="image/*,video/*" onChange={(event) => selectFiles(event.target.files, 'append')} /></label><button type="button" disabled={busy} aria-label={t('tagPeople')} title={t('tagPeople')} onClick={() => { setActivePicker(null); setTagPickerOpen(true) }}><Icon name="friends" size={25} /></button></div></div>
          {message && <p className="form-error">{message}</p>}
          <button type="submit" className="btn-primary home-post-submit" disabled={busy || (!content.trim() && files.length === 0)}>{busy ? t('posting') : t('post')}</button>
        </div>
      </form>
    </div>}
    {open && tagPickerOpen && <Suspense fallback={<div className="modal-backdrop home-tag-picker-backdrop"><span className="spinner" /></div>}><TagPeoplePicker people={friends} selected={taggedPeople} onToggle={toggleTaggedPerson} onDone={() => setTagPickerOpen(false)} onCancel={() => setTagPickerOpen(false)} /></Suspense>}
    {reelOpen && <Suspense fallback={<div className="modal-backdrop reel-composer-backdrop" role="presentation"><span className="spinner" /></div>}><CreateReelModal
      userId={userId}
      displayName={displayName}
      avatarUrl={avatarUrl}
      isVerified={isVerified}
      onClose={() => setReelOpen(false)}
      onCreated={(post) => {
        onCreated(post)
        setReelOpen(false)
      }}
    /></Suspense>}
  </>
}

function StorySection({ buckets, myStories, loading, error, userId, profile, onReload, onStoryCreated, onStoryViewed, onStoryDeleted, onNavigate }: { buckets: StoryBucket[]; myStories: StoryBucket | null; loading: boolean; error: string | null; userId: string; profile: UserProfile | null; onReload: () => Promise<void>; onStoryCreated: (story: GatewayStory) => void; onStoryViewed: (storyId: string) => void; onStoryDeleted: (storyId: string) => void; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<StoryBucket | null>(null)
  const [locallyWatchedStoryIds, setLocallyWatchedStoryIds] = useState<Set<string>>(() => new Set())
  const locallyWatchedStoryIdsRef = useRef<Set<string>>(new Set())
  const friendBuckets = buckets.filter((bucket) => bucket.author.id !== userId)
  const orderedBuckets = myStories ? [myStories, ...friendBuckets] : friendBuckets
  useEffect(() => {
    if (!loading && orderedBuckets.length > 0) void loadStoryViewerPage()
  }, [loading, orderedBuckets.length])
  const markStoryWatched = useCallback((storyId: string) => {
    if (locallyWatchedStoryIdsRef.current.has(storyId)) return
    const next = new Set(locallyWatchedStoryIdsRef.current).add(storyId)
    locallyWatchedStoryIdsRef.current = next
    setLocallyWatchedStoryIds(next)
    onStoryViewed(storyId)
  }, [onStoryViewed])

  function openBucket(bucket: StoryBucket) {
    setSelectedBucket(bucket)
  }

  function handleViewerStoryDeleted(storyId: string) {
    onStoryDeleted(storyId)
  }

  async function handleViewerRelationshipRemoved() {
    setSelectedBucket(null)
    await onReload()
  }

  return <section className="card gateway-stories home-story-section" aria-label={t('stories')}>
    <div className="story-strip">
      <article className="story-tile create-story-tile">
        <button type="button" className="story-open create-story-button" onClick={() => setCreatorOpen(true)}>
          <span className="create-story-preview" style={profile?.avatarUrl ? { backgroundImage: `url(${JSON.stringify(profile.avatarUrl)})` } : undefined}>{!profile?.avatarUrl && <Avatar name={profile?.displayName || t('fakebookUser')} size={58} />}</span>
          <span className="create-story-plus"><Icon name="plus" size={22} /></span>
          <strong>{t('storyCreate')}</strong>
        </button>
      </article>

      {loading && <><article className="story-tile story-skeleton" /><article className="story-tile story-skeleton" /><article className="story-tile story-skeleton" /></>}
      {!loading && orderedBuckets.map((bucket) => {
        const latest = bucket.stories[0]
        const sharedStory = latest && latest.__typename !== 'NormalStory' ? latest : null
        const preview = latest?.__typename === 'NormalStory' ? latest.media[0] : null
        const decodedContent = latest?.__typename === 'NormalStory'
          ? decodeStoryContent(latest.content)
          : decodePostContent(sharedStory?.sharedSource.content)
        const sharedBackground = 'backgroundId' in decodedContent
          ? getPostBackgroundPreset(decodedContent.backgroundId)
          : null
        const own = bucket.author.id === userId
        const unseen = Boolean(latest) && bucket.hasUnseen && !locallyWatchedStoryIds.has(latest.id)
        return <article className={`story-tile ${unseen ? 'story-unseen' : 'story-seen'}${own ? ' own-story-tile' : ''}`} key={bucket.author.id}>
          <button type="button" className="story-open" onClick={() => openBucket(bucket)}>
            {sharedStory
              ? <SharedStoryMiniPreview source={sharedStory.sharedSource} className="home-shared-story-preview" />
              : preview
              ? <StoryMediaPreview key={preview.url} type={preview.type} url={preview.url} />
              : <span className="story-text-preview" style={{ background: sharedBackground?.background ?? ('backgroundColor' in decodedContent ? decodedContent.backgroundColor : undefined) }}>{decodedContent.text || t('stories')}</span>}
            {!sharedStory && preview && decodedContent.text && <p className="home-story-caption-preview">{decodedContent.text}</p>}
            <span className={`story-avatar-ring${unseen ? ' unseen' : ''}`}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={32} /></span>
            <strong>{own ? t('yourStory') : bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} size={12} /></strong>
          </button>
        </article>
      })}
      {!loading && orderedBuckets.length === 0 && <article className="story-tile story-empty-tile"><Icon name="clock" size={28} /><span>{t('noStories')}</span></article>}
    </div>
    {error && !creatorOpen && <p className="form-error story-section-message">{error}</p>}

    {creatorOpen && <Suspense fallback={<div className="modal-backdrop story-creator-loading-backdrop" role="presentation"><span className="spinner" /></div>}><StoryCreatorModal
      open
      authorId={userId}
      onClose={() => setCreatorOpen(false)}
      onCreated={(story) => onStoryCreated(story)}
    /></Suspense>}
    {selectedBucket && <Suspense fallback={<div className="story-viewer-backdrop"><span className="spinner" /></div>}><StoryViewerPage
      buckets={orderedBuckets}
      initialBucketId={selectedBucket.author.id}
      viewerId={userId}
      onClose={() => setSelectedBucket(null)}
      onNavigate={onNavigate}
      onViewed={markStoryWatched}
      onCreateStory={() => { setSelectedBucket(null); setCreatorOpen(true) }}
      onStoryDeleted={handleViewerStoryDeleted}
      onRelationshipRemoved={handleViewerRelationshipRemoved}
    /></Suspense>}
  </section>
}

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : story.sharedSource.media
}

export function LegacyStoryViewerModal({ bucket, viewerId, onClose, onNavigate, onViewed }: { bucket: StoryBucket; viewerId: string; onClose: () => void; onNavigate?: (path: string) => void; onViewed?: (storyId: string) => void }) {
  const { t, locale } = useI18n()
  const [index, setIndex] = useState(0)
  const [engagement, setEngagement] = useState<ContentEngagement | null>(null)
  const [viewers, setViewers] = useState<UserSummary[]>([])
  const [likedUsers, setLikedUsers] = useState<UserSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const story = bucket.stories[index]
  const isOwner = bucket.author.id === viewerId

  useEffect(() => {
    if (!story) return
    let active = true
    socialApi.getContentEngagement(story.id).then((value) => active && setEngagement(value)).catch(() => active && setEngagement(null))
    if (isOwner) onViewed?.(story.id)
    else void socialApi.watchContent(viewerId, story.id).then((watched) => { if (watched) onViewed?.(story.id) }).catch(() => undefined)
    if (isOwner) {
      Promise.all([socialApi.getStoryViewers(story.id, 100), socialApi.getLikedUsers(story.id, 100)]).then(([viewerPage, likedPage]) => {
        if (!active) return
        setViewers(viewerPage.items)
        setLikedUsers(likedPage.items)
      }).catch(() => active && setViewers([]))
    }
    return () => { active = false }
  }, [isOwner, onViewed, story, viewerId])

  if (!story) return null
  const media = storyMedia(story)
  const created = new Date(story.create)
  const time = Number.isNaN(created.getTime()) ? story.create : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)

  async function toggleLike() {
    const next = !engagement?.viewerHasLiked
    setBusy(true)
    try {
      const success = next ? await socialApi.likeContent(viewerId, story.id) : await socialApi.unlikeContent(viewerId, story.id)
      if (!success) throw new Error('Reaction rejected')
      setEngagement((current) => ({ ...(current ?? { targetId: story.id, likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, viewerHasSaved: false, viewerHasWatched: true }), viewerHasLiked: next, likeCount: Math.max(0, (current?.likeCount ?? 0) + (next ? 1 : -1)) }))
    } finally {
      setBusy(false)
    }
  }

  return <div className="story-viewer-backdrop" role="presentation" onClick={onClose}><section className="story-viewer" role="dialog" aria-modal="true" aria-label={t('stories')} onClick={(event) => event.stopPropagation()}><header><button type="button" className="story-owner" onClick={() => onNavigate?.(`/profile/${bucket.author.id}`)}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={42} /><span><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} /></strong><small>{time}</small></span></button><button type="button" className="icon-circle" onClick={onClose}><Icon name="close" /></button></header><div className="story-progress">{bucket.stories.map((item, itemIndex) => <button type="button" key={item.id} className={itemIndex === index ? 'active' : itemIndex < index ? 'seen' : ''} onClick={() => setIndex(itemIndex)} aria-label={`${t('stories')} ${itemIndex + 1}`} />)}</div><div className="story-stage">{media ? media.type === 1 ? <video src={media.url} controls autoPlay preload="metadata" /> : <img src={media.url} alt="" /> : <div className="story-text-only"><p>{story.content}</p></div>}{story.content && media && <p className="story-caption">{story.content}</p>}{index > 0 && <button type="button" className="story-nav previous" onClick={() => setIndex((value) => value - 1)}>‹</button>}{index < bucket.stories.length - 1 && <button type="button" className="story-nav next" onClick={() => setIndex((value) => value + 1)}>›</button>}</div><footer>{isOwner ? <button type="button" className="btn-soft" onClick={() => setPanelOpen((open) => !open)}><Icon name="friends" size={17} />{t('storyViewersCount', { count: viewers.length })}</button> : <button type="button" className={engagement?.viewerHasLiked ? 'story-like active' : 'story-like'} disabled={busy} onClick={() => void toggleLike()}><Icon name="like" />{engagement?.viewerHasLiked ? t('liked') : t('like')} {engagement?.likeCount ? engagement.likeCount : ''}</button>}</footer>{isOwner && panelOpen && <aside className="story-viewer-panel"><h3>{t('storyViewers')}</h3>{viewers.length === 0 ? <p>{t('storyNoViewers')}</p> : viewers.map((person) => <button type="button" key={person.id} onClick={() => onNavigate?.(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={36} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{likedUsers.some((liked) => liked.id === person.id) ? t('likedStory') : t('viewedStory')}</small></span></button>)}</aside>}</section></div>
}

function TaggedUsersInline({ users, onNavigate }: { users: GatewayTaggedUser[]; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  if (users.length === 0) return null

  const shown = users.slice(0, 2)
  const remaining = users.length - shown.length
  return <span className="post-tagged-users">
    <span>{t('taggedWithPrefix')} </span>
    {shown.map((user, index) => <span key={user.id}>
      {index > 0 && (users.length === 2 ? ` ${t('taggedAnd')} ` : ', ')}
      <button type="button" onClick={() => onNavigate?.(`/profile/${user.id}`)}>{user.name}<VerifiedBadge verified={user.isVerified} size={12} /></button>
    </span>)}
    {remaining > 0 && <span> {t('taggedAnd')} {t('taggedOthers', { count: remaining })}</span>}
  </span>
}

export function GatewayPostCard({ post, locale, viewerId, onNavigate, onOpenReel, onMessage, onStoryCreated, authorPath, groupContextId, viewerCanModerateGroupPosts = false }: { post: GatewayPost; locale: string; viewerId?: string; onNavigate?: (path: string) => void; onOpenReel?: (reel: Extract<GatewayPost, { __typename: 'ReelDetail' }>) => void; onMessage?: (profileId: string) => Promise<void>; onStoryCreated?: (story: SharedStory) => void; authorPath?: (authorId: string) => string; groupContextId?: string; viewerCanModerateGroupPosts?: boolean }) {
  const { t } = useI18n()
  const [current, setCurrent] = useState(post)
  const [deleting, setDeleting] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [relationshipBusy, setRelationshipBusy] = useState(false)
  const [relationshipError, setRelationshipError] = useState<string | null>(null)
  const [followingFromCard, setFollowingFromCard] = useState(false)
  const [joinRequestedFromCard, setJoinRequestedFromCard] = useState(
    post.__typename === 'GroupPostDetail' && Boolean(post.group.joinRequestPending),
  )
  const [privacyBusy, setPrivacyBusy] = useState(false)
  const [privacyError, setPrivacyError] = useState<string | null>(null)
  const [sharedDetailId, setSharedDetailId] = useState<string | null>(null)
  const [photoViewer, setPhotoViewer] = useState<{ contentId: string; mediaId: string; mediaUrl: string; initialPost?: GatewayPost; initialPlaybackTime?: number } | null>(null)
  useEffect(() => {
    setCurrent(post)
    setFollowingFromCard(false)
    setJoinRequestedFromCard(post.__typename === 'GroupPostDetail' && Boolean(post.group.joinRequestPending))
    setSharedDetailId(null)
    setPhotoViewer(null)
  }, [post])
  if (removed) return null
  const timestamp = formatPostTimestamp(current.create, locale)
  const owned = viewerId != null && viewerId === current.author.id
  const inOwningGroupContext = current.__typename === 'GroupPostDetail' && current.group.id === groupContextId
  const isFeedLike = current.__typename !== 'GroupPostDetail'
  const openAuthor = () => onNavigate?.(authorPath?.(current.author.id) ?? `/profile/${current.author.id}`)
  const openReelViewer = (reel: Extract<GatewayPost, { __typename: 'ReelDetail' }>) => {
    if (onOpenReel) onOpenReel(reel)
    else onNavigate?.(`/reels?source=for-you&reel=${encodeURIComponent(reel.id)}`)
  }
  const canFollow = isFeedLike && !owned && (Boolean(current.author.canFollow) || followingFromCard)
  const canJoin = current.__typename === 'GroupPostDetail' && !inOwningGroupContext && (Boolean(current.group.canJoin) || joinRequestedFromCard)
  const postPrivacy: PostPrivacy = current.privacy === 1 || current.privacy === 2 || current.privacy === 3 ? current.privacy : 0
  const privacyLabel = current.__typename === 'GroupPostDetail'
    ? current.privacy === 0 ? t('publicGroup') : t('privateGroup')
    : postPrivacy === 0 ? t('privacyPublic') : postPrivacy === 1 ? t('privacyFriendsFollowers') : postPrivacy === 2 ? t('privacyFriends') : t('privacyOnlyMe')
  const privacyOptions: Array<{ value: PostPrivacy; label: string }> = [
    { value: 0, label: t('privacyPublic') },
    { value: 1, label: t('privacyFriendsFollowers') },
    { value: 2, label: t('privacyFriends') },
    { value: 3, label: t('privacyOnlyMe') },
  ]
  const taggedUsers = (current.taggedUsers ?? []).filter((person) => person.id !== current.author.id)
  const decodedContent = decodePostContent(current.content)
  const postBackground = current.media.length === 0 ? getPostBackgroundPreset(decodedContent.backgroundId) : null
  const hasSharedSource = Boolean(current.sharedSource)
  const canReshare = !current.sharedSource || current.sharedSource.isAvailable

  async function followAuthor() {
    if (!viewerId || current.__typename === 'GroupPostDetail') return
    setRelationshipBusy(true)
    setRelationshipError(null)
    try {
      const success = followingFromCard
        ? await socialApi.unfollowUser(viewerId, current.author.id)
        : await socialApi.followUser(viewerId, current.author.id)
      if (!success) throw new Error('Follow action rejected')
      setFollowingFromCard((currentValue) => !currentValue)
      setCurrent((value) => ({ ...value, author: { ...value.author, canFollow: followingFromCard } }))
    } catch {
      setRelationshipError(t('genericError'))
    } finally {
      setRelationshipBusy(false)
    }
  }

  async function joinGroup() {
    if (!viewerId || current.__typename !== 'GroupPostDetail') return
    const cancelling = joinRequestedFromCard
    setRelationshipBusy(true)
    setRelationshipError(null)
    try {
      const success = cancelling
        ? await socialApi.cancelJoinGroupRequest(viewerId, current.group.id)
        : await socialApi.requestJoinGroup(viewerId, current.group.id)
      if (!success) throw new Error('Join action rejected')
      const nextPending = !cancelling
      setJoinRequestedFromCard(nextPending)
      setCurrent((value) => value.__typename === 'GroupPostDetail'
        ? { ...value, group: { ...value.group, canJoin: true, joinRequestPending: nextPending } }
        : value)
    } catch {
      setRelationshipError(t('joinGroupError'))
    } finally {
      setRelationshipBusy(false)
    }
  }

  async function changePostPrivacy(nextPrivacy: PostPrivacy) {
    if (!owned || current.__typename === 'GroupPostDetail' || nextPrivacy === postPrivacy) return
    const previousPrivacy = postPrivacy
    setPrivacyBusy(true)
    setPrivacyError(null)
    setCurrent((value) => ({ ...value, privacy: nextPrivacy }))
    try {
      const updated = await socialApi.updatePost(current.id, { privacy: nextPrivacy })
      if (!updated) throw new Error('Privacy update rejected')
      const savedPrivacy: PostPrivacy = updated.privacy === 1 || updated.privacy === 2 || updated.privacy === 3 ? updated.privacy : 0
      setCurrent((value) => ({ ...value, privacy: savedPrivacy }))
    } catch {
      setCurrent((value) => ({ ...value, privacy: previousPrivacy }))
      setPrivacyError(t('postPrivacyUpdateError'))
    } finally {
      setPrivacyBusy(false)
    }
  }

  return <>
    <article className={`card gateway-post${hasSharedSource ? ' has-shared-source' : ''}`}>
      <header className={current.__typename === 'GroupPostDetail' ? `group-feed-post-head${inOwningGroupContext ? ' group-profile-owning-context' : ''}` : 'feed-post-head'}>
        {current.__typename === 'GroupPostDetail' && !inOwningGroupContext ? <button type="button" className="post-author-avatar" onClick={() => onNavigate?.(`/groups/${current.group.id}`)}><GroupPostAvatar groupName={current.group.name} groupAvatar={current.group.avatar || null} userName={current.author.name} userAvatar={current.author.avatar || null} size={40} /></button> : <button type="button" className="post-author-avatar" onClick={openAuthor}><Avatar name={current.author.name} src={current.author.avatar || null} size={40} /></button>}
        <div className="post-head-copy">
          <div className="post-head-primary">
            {current.__typename === 'GroupPostDetail' && !inOwningGroupContext ? <button type="button" className="post-group-link" onClick={() => onNavigate?.(`/groups/${current.group.id}`)}><strong>{current.group.name}</strong></button> : <button type="button" className="post-author-name" onClick={openAuthor}><strong>{current.author.name}<VerifiedBadge verified={current.author.isVerified} /></strong></button>}
            <TaggedUsersInline users={taggedUsers} onNavigate={onNavigate} />
            {canFollow && <button type="button" className={followingFromCard ? 'post-inline-action is-settled' : 'post-inline-action'} disabled={relationshipBusy} onClick={() => void followAuthor()}><span>{t(followingFromCard ? 'following' : 'follow')}</span></button>}
            {canJoin && <button type="button" className={joinRequestedFromCard ? 'post-inline-action is-settled' : 'post-inline-action'} disabled={relationshipBusy} onClick={() => void joinGroup()}><span>{t(joinRequestedFromCard ? 'joinRequested' : 'joinGroup')}</span></button>}
          </div>
          <span className="post-head-meta">
            {current.__typename === 'GroupPostDetail' && !inOwningGroupContext && <><button type="button" className="post-meta-author" onClick={openAuthor}>{current.author.name}<VerifiedBadge verified={current.author.isVerified} size={12} /></button><i>·</i></>}
            <HoverTooltip label={timestamp.detail} className="post-meta-hover post-time-hover"><time dateTime={current.create}>{timestamp.display}</time></HoverTooltip>
            <i>·</i>
            {owned && isFeedLike
              ? <PostPrivacyControl privacy={postPrivacy} label={privacyLabel} options={privacyOptions} busy={privacyBusy} onSelect={(value) => void changePostPrivacy(value)} />
              : <HoverTooltip label={privacyLabel} className="post-meta-hover post-privacy-hover"><span aria-label={privacyLabel}><PostPrivacyIcon privacy={postPrivacy} size={13} group={current.__typename === 'GroupPostDetail'} /></span></HoverTooltip>}
          </span>
        </div>
        <div className="post-header-actions">
          {(viewerId || owned) && <PostOptionsMenu post={current} viewerId={viewerId} owned={owned} canDelete={owned || (inOwningGroupContext && viewerCanModerateGroupPosts)} onDelete={() => setDeleting(true)} onPostHidden={() => setRemoved(true)} />}
          <button type="button" className="post-header-icon" aria-label={t('hidePost')} title={t('hidePost')} onClick={() => setRemoved(true)}><Icon name="close" size={20} /></button>
        </div>
      </header>
      {(relationshipError || privacyError) && <p className="form-error post-relationship-error">{relationshipError || privacyError}</p>}
      {decodedContent.text && <p className={postBackground ? 'gateway-post-content has-background' : 'gateway-post-content'} style={postBackground ? { background: postBackground.background } : undefined}><MentionContent content={decodedContent.text} mentions={current.mentions} onNavigate={onNavigate} /></p>}
      <PostMediaGallery media={current.media} preferredAspectRatio={current.__typename === 'ReelDetail' ? current.aspectRatio : null} focalPointX={current.__typename === 'ReelDetail' ? current.focalPointX : null} focalPointY={current.__typename === 'ReelDetail' ? current.focalPointY : null} onOpenImage={viewerId && current.__typename === 'ReelDetail' ? () => openReelViewer(current) : viewerId && current.__typename !== 'ReelDetail' ? (media, _index, initialPlaybackTime) => setPhotoViewer({ contentId: current.id, mediaId: media.id, mediaUrl: media.url, initialPost: current, initialPlaybackTime }) : undefined} />
      {current.sharedSource && <SharedPostSourceCard source={current.sharedSource} locale={locale} onNavigate={onNavigate} onOpenSource={current.sharedSource.type === 1 && current.sharedSource.group ? undefined : (sourceId) => setSharedDetailId(sourceId)} onOpenImage={viewerId && current.sharedSource.type !== 4 ? (source, media, _index, initialPlaybackTime) => setPhotoViewer({ contentId: source.id, mediaId: media.id, mediaUrl: media.url, initialPlaybackTime }) : undefined} onOpenReel={viewerId && current.sharedSource.type === 4 ? (source) => {
        const reel = sharedPostSourceToGatewayReel(source)
        if (reel) openReelViewer(reel)
        else onNavigate?.(`/reels?source=for-you&reel=${encodeURIComponent(source.id)}`)
      } : undefined} />}
      {viewerId && <Suspense fallback={<div className="content-actions-skeleton" />}><ContentActions viewerId={viewerId} contentId={current.id} post={current} canShare canReshare={canReshare} onNavigate={onNavigate} onMessage={onMessage} onStoryCreated={onStoryCreated} onOpenImage={(detailPost, media, _index, initialPlaybackTime) => setPhotoViewer({ contentId: detailPost.id, mediaId: media.id, mediaUrl: media.url, initialPost: detailPost, initialPlaybackTime })} onOpenReel={openReelViewer} /></Suspense>}
      {deleting && <DeletePostModal postId={current.id} onClose={() => setDeleting(false)} onDeleted={() => setRemoved(true)} />}
    </article>
    {viewerId && sharedDetailId && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><ContentDetailOverlay viewerId={viewerId} contentId={sharedDetailId} onClose={() => setSharedDetailId(null)} onNavigate={onNavigate} onMessage={onMessage} onStoryCreated={onStoryCreated} onOpenImage={(detailPost, media, _index, initialPlaybackTime) => setPhotoViewer({ contentId: detailPost.id, mediaId: media.id, mediaUrl: media.url, initialPost: detailPost, initialPlaybackTime })} onOpenReel={openReelViewer} /></Suspense>}
    {viewerId && photoViewer && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><PostPhotoViewer viewerId={viewerId} contentId={photoViewer.contentId} initialMediaId={photoViewer.mediaId} initialMediaUrl={photoViewer.mediaUrl} initialPlaybackTime={photoViewer.initialPlaybackTime} initialPost={photoViewer.initialPost} onClose={() => setPhotoViewer(null)} onNavigate={onNavigate} onMessage={onMessage} onStoryCreated={onStoryCreated} /></Suspense>}
  </>
}

function DeletePostModal({ postId, onClose, onDeleted }: { postId: string; onClose: () => void; onDeleted: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function remove() {
    setBusy(true)
    setError(null)
    try {
      if (!await socialApi.deleteContent(postId)) throw new Error('Delete rejected')
      onDeleted()
    } catch {
      setError(t('deletePostError'))
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><section className="modal compact-form-modal" role="dialog" aria-modal="true" aria-label={t('deletePost')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('deletePost')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body destructive-confirm"><Icon name="trash" size={38} /><p>{t('deletePostConfirm')}</p>{error && <p className="form-error">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>{busy ? t('working') : t('deletePost')}</button></footer></section></div>
}

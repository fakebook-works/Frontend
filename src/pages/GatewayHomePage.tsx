import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, visibleRecommendationPosts } from '../api/client'
import type { GatewayPost, GatewayStory, StoryBucket, VisitedGroup } from '../api/gatewayTypes'
import { socialApi, type ContentEngagement, type SocialContent, type SocialProfile } from '../api/social'
import type { UserProfile, UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { ContentActions } from '../components/ContentActions'
import { MentionSuggestions } from '../components/MentionSuggestions'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'

const FEED_PAGE_SIZE = 12

function mediaType(type: 'image' | 'video') {
  return type === 'video' ? 1 : 0
}

export function GatewayHomePage({ profile = null, onNavigate }: { profile?: UserProfile | null; onNavigate?: (path: string) => void }) {
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
  const [contacts, setContacts] = useState<SocialProfile[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactSearchOpen, setContactSearchOpen] = useState(false)
  const [contactQuery, setContactQuery] = useState('')

  const loadFeed = useCallback(async (reset = false) => {
    if (!user) return
    if (reset) setFeedLoading(true)
    else setFeedMoreBusy(true)
    setFeedError(null)
    try {
      const offset = reset ? 0 : feedOffset
      const items = await api.recommendedFeed(user.userId, offset, FEED_PAGE_SIZE)
      const nextPosts = visibleRecommendationPosts(items)
      setPosts((current) => {
        const combined = reset ? nextPosts : [...current, ...nextPosts]
        return [...new Map(combined.map((post) => [post.id, post])).values()]
      })
      setFeedOffset(offset + items.length)
      setFeedHasMore(items.length === FEED_PAGE_SIZE)
    } catch {
      setFeedError(t('feedLoadError'))
    } finally {
      setFeedLoading(false)
      setFeedMoreBusy(false)
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
      setMyStories(mine)
    } catch {
      setStoriesError(t('storiesLoadError'))
    } finally {
      setStoriesLoading(false)
    }
  }, [t, user])

  const loadGroups = useCallback(async () => {
    if (!user) return
    setGroupsLoading(true)
    setGroupsError(null)
    try {
      setGroups((await api.visitedGroups(user.userId, 8)).items)
    } catch {
      setGroupsError(t('genericError'))
    } finally {
      setGroupsLoading(false)
    }
  }, [t, user])

  const loadContacts = useCallback(async () => {
    if (!user) return
    setContactsLoading(true)
    try { setContacts(await socialApi.getRelationProfiles(user.userId, 0, 40)) } catch { setContacts([]) } finally { setContactsLoading(false) }
  }, [user])

  useEffect(() => {
    void loadFeed(true)
    void loadStories()
    void loadGroups()
    void loadContacts()
    // Initial load is tied to the authenticated identity; pagination invokes loadFeed directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId])

  const visibleStoryBuckets = useMemo(() => {
    if (!myStories) return storyBuckets
    return [myStories, ...storyBuckets.filter((bucket) => bucket.author.id !== myStories.author.id)]
  }, [myStories, storyBuckets])
  const visibleContacts = useMemo(() => {
    const query = contactQuery.trim().toLocaleLowerCase()
    return query ? contacts.filter((contact) => contact.displayName.toLocaleLowerCase().includes(query)) : contacts
  }, [contactQuery, contacts])

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

  return (
    <main className="gateway-home">
      <aside className="gateway-left-rail" aria-label={t('visitedGroups')}>
        <nav className="home-shortcuts" aria-label={t('primaryNavLabel')}>
          <button type="button" onClick={() => onNavigate?.(`/profile/${user.userId}`)}><Avatar name={profile?.displayName || user.email} src={profile?.avatarUrl} size={36} /><strong>{profile?.displayName || user.email.split('@')[0]}<VerifiedBadge verified={profile?.isVerified} size={13} /></strong></button>
          <button type="button" onClick={() => onNavigate?.('/friends')}><span className="shortcut-icon friends"><Icon name="friends" size={20} /></span><strong>{t('friends')}</strong></button>
          <button type="button" onClick={() => onNavigate?.('/saved')}><span className="shortcut-icon saved"><Icon name="bookmark" size={20} /></span><strong>{t('saved')}</strong></button>
        </nav>
        <section className="card service-panel">
          <div className="service-heading">
            <div><h2>{t('visitedGroups')}</h2><p>{t('visitedGroupsSubtitle')}</p></div>
            <button type="button" className="btn-soft sm" onClick={() => void loadGroups()} disabled={groupsLoading}>{t('refresh')}</button>
          </div>
          {groupsError && <p className="form-error">{groupsError}</p>}
          {groupsLoading ? <span className="spinner" aria-label={t('loadingMore')} /> : groups.length === 0 ? (
            <p className="muted">{t('noVisitedGroups')}</p>
          ) : (
            <div className="group-shortcuts">
              {groups.map((group) => (
                <button type="button" key={group.id} onClick={() => void openGroup(group)}>
                  <Avatar name={group.name} src={group.avatar || null} size={38} />
                  <span>{group.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>

      <div className="gateway-feed-column">
        <StorySection
          buckets={visibleStoryBuckets}
          loading={storiesLoading}
          error={storiesError}
          userId={user.userId}
          onReload={loadStories}
          onNavigate={onNavigate}
        />
        <PostComposer
          userId={user.userId}
          email={profile?.displayName || user.email}
          friends={contacts}
          onCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])}
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
          {feedLoading ? <div className="card state-card"><span className="spinner" /><p>{t('loadingMore')}</p></div> : !feedError && posts.length === 0 ? (
            <div className="card state-card"><h2>{t('noRecommendedPosts')}</h2><p>{t('noRecommendedPostsDesc')}</p></div>
          ) : (
            posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={user.userId} onNavigate={onNavigate} />)
          )}
          {!feedLoading && !feedError && posts.length > 0 && (
            <div className="feed-more">
              {feedHasMore ? (
                <button type="button" className="btn-soft" onClick={() => void loadFeed(false)} disabled={feedMoreBusy}>
                  {feedMoreBusy ? t('loadingMore') : t('loadMorePosts')}
                </button>
              ) : <p className="muted">{t('endOfFeed')}</p>}
            </div>
          )}
        </section>
      </div>

      <aside className="gateway-right-rail" aria-label={t('contacts')}>
        <section className="right-rail-module">
          <h2>{t('birthdays')}</h2>
          <div className="birthday-row"><span aria-hidden="true">🎁</span><p>{t('birthdayEmpty')}</p></div>
        </section>
        <section className="right-rail-module contacts-module">
          <header><h2>{t('contacts')}</h2><div><button type="button" aria-label={t('search')} onClick={() => setContactSearchOpen((open) => !open)}><Icon name="search" size={17} /></button><button type="button" aria-label={t('more')} onClick={() => onNavigate?.('/friends')}><Icon name="more" size={17} /></button></div></header>
          {contactSearchOpen && <input className="contact-search" autoFocus value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder={t('searchFriends')} />}
          {contactsLoading ? <span className="spinner" /> : visibleContacts.length === 0 ? <p>{contactQuery ? t('noFriendsFound') : t('noContactsYet')}</p> : <div className="contact-list">{visibleContacts.map((contact) => <button type="button" key={contact.id} onClick={() => onNavigate?.(`/profile/${contact.id}`)}><Avatar name={contact.displayName} src={contact.avatarUrl} size={34} /><strong>{contact.displayName}<VerifiedBadge verified={contact.isVerified} size={12} /></strong></button>)}</div>}
        </section>
        <p className="right-rail-footer">{t('footerLinks')}</p>
      </aside>
    </main>
  )
}

function PostComposer({ userId, email, friends, onCreated }: { userId: string; email: string; friends: UserSummary[]; onCreated: (post: GatewayPost) => void }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState(() => {
    const saved = Number(localStorage.getItem('fb.defaultPostPrivacy'))
    return saved === 1 || saved === 2 ? saved : 0
  })
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [taggedPeople, setTaggedPeople] = useState<UserSummary[]>([])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim() && !file) return setMessage(t('composeNeedContent'))
    setBusy(true)
    setMessage(null)
    try {
      const uploaded = file ? await api.uploadMedia(file) : null
      const created = await api.createFeedPost({
        authorId: userId,
        content: content.trim(),
        privacy,
        media: uploaded ? [{ type: mediaType(uploaded.type), url: uploaded.url }] : [],
      })
      const activeTags = taggedPeople.filter((person) => content.includes(`@${person.displayName}`))
      await Promise.all(activeTags.map((person) => socialApi.tagUser(created.id, person.id)))
      const hydrated = await api.postDetail(created.id)
      if (hydrated) onCreated(hydrated)
      setContent('')
      setFile(null)
      setFileKey((value) => value + 1)
      setTaggedPeople([])
      setMessage(t('publishPostSuccess'))
    } catch {
      setMessage(t('publishPostError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card gateway-composer" onSubmit={submit}>
      <div className="composer-identity"><Avatar name={email} size={42} /><div className="mention-compose-field"><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('postComposerPlaceholder')} rows={3} /><MentionSuggestions text={content} people={friends} onTextChange={setContent} onSelected={(person) => setTaggedPeople((current) => current.some((item) => item.id === person.id) ? current : [...current, person])} /></div></div>
      {taggedPeople.length > 0 && <div className="tagged-people-row">{taggedPeople.map((person) => <span key={person.id}><Icon name="tag" size={13} />{person.displayName}</span>)}</div>}
      <div className="composer-controls">
        <label className="file-control"><span>{t('photoVideo')}</span><input key={fileKey} type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <select value={privacy} onChange={(e) => setPrivacy(Number(e.target.value))} aria-label={t('postOptions')}>
          <option value={0}>{t('privacyPublic')}</option>
          <option value={1}>{t('privacyFriends')}</option>
          <option value={2}>{t('privacyOnlyMe')}</option>
        </select>
        <button type="submit" className="btn-primary" disabled={busy || (!content.trim() && !file)}>{busy ? t('posting') : t('post')}</button>
      </div>
      {file && <p className="field-note">{file.name}</p>}
      {message && <p className={message === t('publishPostSuccess') ? 'form-success' : 'form-error'}>{message}</p>}
    </form>
  )
}

function StorySection({ buckets, loading, error, userId, onReload, onNavigate }: { buckets: StoryBucket[]; loading: boolean; error: string | null; userId: string; onReload: () => Promise<void>; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<StoryBucket | null>(null)

  async function createStory(e: FormEvent) {
    e.preventDefault()
    if (!content.trim() && !file) return
    setBusy(true)
    setMessage(null)
    try {
      const uploaded = file ? await api.uploadMedia(file) : null
      await api.createNormalStory({
        authorId: userId,
        content: content.trim(),
        media: uploaded ? { type: mediaType(uploaded.type), url: uploaded.url } : null,
      })
      setContent('')
      setFile(null)
      setFileKey((value) => value + 1)
      setMessage(t('storyPublished'))
      await onReload()
    } catch {
      setMessage(t('storyPublishError'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteLatest(bucket: StoryBucket) {
    const story = bucket.stories[0]
    if (!story) return
    setMessage(null)
    try {
      await api.deleteStory(userId, story.id)
      setMessage(t('storyDeleted'))
      await onReload()
    } catch {
      setMessage(t('genericError'))
    }
  }

  return (
    <section className="card gateway-stories" aria-labelledby="stories-title">
      <div className="service-heading"><div><h2 id="stories-title">{t('stories')}</h2><p>{t('storiesSubtitle')}</p></div><button type="button" className="btn-soft sm" onClick={() => void onReload()} disabled={loading}>{t('refresh')}</button></div>
      <form className="story-create-row" onSubmit={createStory}>
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('storyPrompt')} />
        <label className="file-control compact"><span>{t('photoVideo')}</span><input key={fileKey} type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <button type="submit" className="btn-primary" disabled={busy || (!content.trim() && !file)}>{busy ? t('posting') : t('storyCreate')}</button>
      </form>
      {file && <p className="field-note">{file.name}</p>}
      {(message || error) && <p className={message === t('storyPublished') || message === t('storyDeleted') ? 'form-success' : 'form-error'}>{message || error}</p>}
      {loading ? <span className="spinner" aria-label={t('loadingMore')} /> : buckets.length === 0 ? <p className="muted">{t('noStories')}</p> : (
        <div className="story-strip">
          {buckets.map((bucket) => {
            const latest = bucket.stories[0]
            const preview = latest?.__typename === 'NormalStory' ? latest.media[0]?.url : latest?.sharedSource.media?.url
            return (
              <article className="story-tile" key={bucket.author.id}>
                <button type="button" className="story-open" onClick={() => setSelectedBucket(bucket)}>{preview && <img className="story-cover" src={preview} alt="" loading="lazy" />}<Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={38} /><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} size={13} /></strong><span>{latest?.content || t('stories')}</span></button>
                {bucket.author.id === userId && latest && <button type="button" onClick={() => void deleteLatest(bucket)}>{t('deleteStory')}</button>}
              </article>
            )
          })}
        </div>
      )}
      {selectedBucket && <StoryViewerModal bucket={selectedBucket} viewerId={userId} onClose={() => setSelectedBucket(null)} onNavigate={onNavigate} />}
    </section>
  )
}

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : story.sharedSource.media
}

function StoryViewerModal({ bucket, viewerId, onClose, onNavigate }: { bucket: StoryBucket; viewerId: string; onClose: () => void; onNavigate?: (path: string) => void }) {
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
    if (!isOwner) void socialApi.watchContent(viewerId, story.id).catch(() => undefined)
    if (isOwner) {
      Promise.all([socialApi.getStoryViewers(story.id, 100), socialApi.getLikedUsers(story.id, 100)]).then(([viewerPage, likedPage]) => {
        if (!active) return
        setViewers(viewerPage.items)
        setLikedUsers(likedPage.items)
      }).catch(() => active && setViewers([]))
    }
    return () => { active = false }
  }, [isOwner, story, viewerId])

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
      setEngagement((current) => ({ ...(current ?? { targetId: story.id, likeCount: 0, commentCount: 0, shareCount: 0, viewerHasSaved: false, viewerHasWatched: true }), viewerHasLiked: next, likeCount: Math.max(0, (current?.likeCount ?? 0) + (next ? 1 : -1)) }))
    } finally {
      setBusy(false)
    }
  }

  return <div className="story-viewer-backdrop" role="presentation" onClick={onClose}><section className="story-viewer" role="dialog" aria-modal="true" aria-label={t('stories')} onClick={(event) => event.stopPropagation()}><header><button type="button" className="story-owner" onClick={() => onNavigate?.(`/profile/${bucket.author.id}`)}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={42} /><span><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} /></strong><small>{time}</small></span></button><button type="button" className="icon-circle" onClick={onClose}><Icon name="close" /></button></header><div className="story-progress">{bucket.stories.map((item, itemIndex) => <button type="button" key={item.id} className={itemIndex === index ? 'active' : itemIndex < index ? 'seen' : ''} onClick={() => setIndex(itemIndex)} aria-label={`${t('stories')} ${itemIndex + 1}`} />)}</div><div className="story-stage">{media ? media.type === 1 ? <video src={media.url} controls autoPlay preload="metadata" /> : <img src={media.url} alt="" /> : <div className="story-text-only"><p>{story.content}</p></div>}{story.content && media && <p className="story-caption">{story.content}</p>}{index > 0 && <button type="button" className="story-nav previous" onClick={() => setIndex((value) => value - 1)}>‹</button>}{index < bucket.stories.length - 1 && <button type="button" className="story-nav next" onClick={() => setIndex((value) => value + 1)}>›</button>}</div><footer>{isOwner ? <button type="button" className="btn-soft" onClick={() => setPanelOpen((open) => !open)}><Icon name="friends" size={17} />{t('storyViewersCount', { count: viewers.length })}</button> : <button type="button" className={engagement?.viewerHasLiked ? 'story-like active' : 'story-like'} disabled={busy} onClick={() => void toggleLike()}><Icon name="like" />{engagement?.viewerHasLiked ? t('liked') : t('like')} {engagement?.likeCount ? engagement.likeCount : ''}</button>}</footer>{isOwner && panelOpen && <aside className="story-viewer-panel"><h3>{t('storyViewers')}</h3>{viewers.length === 0 ? <p>{t('storyNoViewers')}</p> : viewers.map((person) => <button type="button" key={person.id} onClick={() => onNavigate?.(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={36} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{likedUsers.some((liked) => liked.id === person.id) ? t('likedStory') : t('viewedStory')}</small></span></button>)}</aside>}</section></div>
}

export function GatewayPostCard({ post, locale, viewerId, onNavigate, authorPath }: { post: GatewayPost; locale: string; viewerId?: string; onNavigate?: (path: string) => void; authorPath?: (authorId: string) => string }) {
  const { t } = useI18n()
  const [current, setCurrent] = useState(post)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removed, setRemoved] = useState(false)
  useEffect(() => setCurrent(post), [post])
  if (removed) return null
  const created = new Date(current.create)
  const time = Number.isNaN(created.getTime()) ? current.create : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)
  const owned = viewerId != null && viewerId === current.author.id
  const openAuthor = () => onNavigate?.(authorPath?.(current.author.id) ?? `/profile/${current.author.id}`)
  return (
    <article className="card gateway-post">
      <header>
        <button type="button" className="post-author-avatar" onClick={openAuthor}><Avatar name={current.author.name} src={current.author.avatar || null} size={44} /></button>
        <div>
          <button type="button" className="post-author-name" onClick={openAuthor}><strong>{current.author.name}<VerifiedBadge verified={current.author.isVerified} /></strong></button>
          <span>{current.__typename === 'GroupPostDetail' ? <button type="button" className="post-group-link" onClick={() => onNavigate?.(`/groups/${current.group.id}`)}>{t('groupPostLabel', { group: current.group.name })}</button> : time}</span>
          {current.__typename === 'GroupPostDetail' && <small>{time}</small>}
        </div>
        {owned && <div className="post-owner-menu"><button type="button" className="icon-circle subtle" aria-label={t('postOptions')} onClick={() => setOptionsOpen((open) => !open)}><Icon name="more" size={18} /></button>{optionsOpen && <div><button type="button" onClick={() => { setOptionsOpen(false); setEditing(true) }}><Icon name="edit" size={17} />{t('editPost')}</button><button type="button" className="danger-text" onClick={() => { setOptionsOpen(false); setDeleting(true) }}><Icon name="trash" size={17} />{t('deletePost')}</button></div>}</div>}
      </header>
      {current.content && <p className="gateway-post-content">{current.content}</p>}
      {current.media.length > 0 && <div className={current.media.length > 1 ? 'gateway-media media-grid' : 'gateway-media'}>{current.media.map((media) => media.type === 1 ? <video key={media.id} src={media.url} controls preload="metadata" /> : <img key={media.id} src={media.url} alt="" loading="lazy" />)}</div>}
      {viewerId && <ContentActions viewerId={viewerId} contentId={current.id} onNavigate={onNavigate} />}
      {editing && <EditPostModal post={current} onClose={() => setEditing(false)} onUpdated={(updated) => { setCurrent((value) => ({ ...value, content: updated.content, privacy: updated.privacy, media: updated.media })); setEditing(false) }} />}
      {deleting && <DeletePostModal postId={current.id} onClose={() => setDeleting(false)} onDeleted={() => setRemoved(true)} />}
    </article>
  )
}

function EditPostModal({ post, onClose, onUpdated }: { post: GatewayPost; onClose: () => void; onUpdated: (post: SocialContent) => void }) {
  const { t } = useI18n()
  const [privacy, setPrivacy] = useState(post.privacy)
  const [content, setContent] = useState(post.content)
  const [replacementFiles, setReplacementFiles] = useState<File[]>([])
  const [removeExistingMedia, setRemoveExistingMedia] = useState(false)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const uploads = replacementFiles.length > 0 ? await Promise.all(replacementFiles.map((file) => api.uploadMedia(file))) : []
      const updated = await socialApi.updatePost(post.id, {
        privacy,
        content: content.trim(),
        media: uploads.length > 0
          ? uploads.map((upload) => ({ type: mediaType(upload.type), url: upload.url }))
          : removeExistingMedia ? [] : undefined,
      })
      if (!updated) throw new Error('Missing update result')
      onUpdated(updated)
    } catch {
      setError(t('updatePostError'))
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><form className="modal compact-form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('editPost')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body settings-form-grid"><label className="wide"><span>{t('postContent')}</span><textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} /></label>{post.media.length > 0 && replacementFiles.length === 0 && !removeExistingMedia && <div className="wide edit-post-media"><span>{t('currentMedia')}</span><div>{post.media.map((media) => media.type === 1 ? <video key={media.id} src={media.url} controls preload="metadata" /> : <img key={media.id} src={media.url} alt="" />)}</div><button type="button" className="btn-soft danger-text" onClick={() => { setRemoveExistingMedia(true); setFileKey((value) => value + 1) }}><Icon name="trash" size={16} />{t('removeMedia')}</button></div>}<label className="wide file-drop"><Icon name="photo" size={26} /><span>{replacementFiles.length > 0 ? t('selectedFilesCount', { count: replacementFiles.length }) : t('replaceMedia')}</span><input key={fileKey} type="file" multiple accept="image/*,video/*" onChange={(event) => { setReplacementFiles(Array.from(event.target.files ?? [])); setRemoveExistingMedia(false) }} /></label>{(replacementFiles.length > 0 || removeExistingMedia) && <button type="button" className="btn-soft wide" onClick={() => { setReplacementFiles([]); setRemoveExistingMedia(false); setFileKey((value) => value + 1) }}>{t('keepCurrentMedia')}</button>}<label className="wide"><span>{t('privacy')}</span><select value={privacy} onChange={(event) => setPrivacy(Number(event.target.value))}><option value={0}>{t('privacyPublic')}</option><option value={1}>{t('privacyFriends')}</option><option value={2}>{t('privacyOnlyMe')}</option></select></label>{error && <p className="form-error wide">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="submit" className="btn-primary" disabled={busy || (!content.trim() && replacementFiles.length === 0 && (removeExistingMedia || post.media.length === 0))}>{busy ? t('saving') : t('save')}</button></footer></form></div>
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, visibleRecommendationPosts } from '../api/client'
import type { GatewayPost, StoryBucket, VisitedGroup } from '../api/gatewayTypes'
import { Avatar } from '../components/Avatar'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'

const FEED_PAGE_SIZE = 12

function mediaType(type: 'image' | 'video') {
  return type === 'video' ? 1 : 0
}

export function GatewayHomePage() {
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
  const [groupMessage, setGroupMessage] = useState<string | null>(null)

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

  useEffect(() => {
    void loadFeed(true)
    void loadStories()
    void loadGroups()
    // Initial load is tied to the authenticated identity; pagination invokes loadFeed directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId])

  const visibleStoryBuckets = useMemo(() => {
    if (!myStories) return storyBuckets
    return [myStories, ...storyBuckets.filter((bucket) => bucket.author.id !== myStories.author.id)]
  }, [myStories, storyBuckets])

  if (!user) return null

  async function openGroup(group: VisitedGroup) {
    if (!user) return
    setGroupMessage(null)
    try {
      await api.recordGroupVisit(user.userId, group.id)
      setGroupMessage(t('groupVisitRecorded', { group: group.name }))
      await loadGroups()
    } catch {
      setGroupsError(t('genericError'))
    }
  }

  return (
    <main className="gateway-home">
      <aside className="gateway-left-rail" aria-label={t('visitedGroups')}>
        <section className="card service-panel">
          <div className="service-heading">
            <div><h2>{t('visitedGroups')}</h2><p>{t('visitedGroupsSubtitle')}</p></div>
            <button type="button" className="btn-soft sm" onClick={() => void loadGroups()} disabled={groupsLoading}>{t('refresh')}</button>
          </div>
          {groupsError && <p className="form-error">{groupsError}</p>}
          {groupMessage && <p className="form-success">{groupMessage}</p>}
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
        <p className="service-contract-note">{t('serviceDataNote')}</p>
      </aside>

      <div className="gateway-feed-column">
        <StorySection
          buckets={visibleStoryBuckets}
          loading={storiesLoading}
          error={storiesError}
          userId={user.userId}
          onReload={loadStories}
        />
        <PostComposer
          userId={user.userId}
          email={user.email}
          onCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])}
        />

        <section className="feed-section" aria-labelledby="recommended-feed-title">
          <div className="feed-heading">
            <div>
              <p className="eyebrow">Recommendation</p>
              <h1 id="recommended-feed-title">{t('recommendedFeed')}</h1>
              <p>{t('recommendedFeedSubtitle')}</p>
            </div>
            <button type="button" className="btn-soft sm" onClick={() => void loadFeed(true)} disabled={feedLoading}>{t('refresh')}</button>
          </div>
          {feedError && <div className="card state-card"><p className="form-error">{feedError}</p><button type="button" className="btn-primary" onClick={() => void loadFeed(true)}>{t('tryAgain')}</button></div>}
          {feedLoading ? <div className="card state-card"><span className="spinner" /><p>{t('loadingMore')}</p></div> : !feedError && posts.length === 0 ? (
            <div className="card state-card"><h2>{t('noRecommendedPosts')}</h2><p>{t('noRecommendedPostsDesc')}</p></div>
          ) : (
            posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} />)
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
    </main>
  )
}

function PostComposer({ userId, email, onCreated }: { userId: string; email: string; onCreated: (post: GatewayPost) => void }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
      const hydrated = await api.postDetail(created.id)
      if (hydrated) onCreated(hydrated)
      setContent('')
      setFile(null)
      setFileKey((value) => value + 1)
      setMessage(t('publishPostSuccess'))
    } catch {
      setMessage(t('publishPostError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card gateway-composer" onSubmit={submit}>
      <div className="composer-identity"><Avatar name={email} size={42} /><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('postComposerPlaceholder')} rows={3} /></div>
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

function StorySection({ buckets, loading, error, userId, onReload }: { buckets: StoryBucket[]; loading: boolean; error: string | null; userId: string; onReload: () => Promise<void> }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
                {preview && <img className="story-cover" src={preview} alt="" loading="lazy" />}
                <Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={38} />
                <strong>{bucket.author.name}</strong>
                <span>{latest?.content || t('stories')}</span>
                {bucket.author.id === userId && latest && <button type="button" onClick={() => void deleteLatest(bucket)}>{t('deleteStory')}</button>}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function GatewayPostCard({ post, locale }: { post: GatewayPost; locale: string }) {
  const { t } = useI18n()
  const created = new Date(post.create)
  const time = Number.isNaN(created.getTime()) ? post.create : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)
  return (
    <article className="card gateway-post">
      <header>
        <Avatar name={post.author.name} src={post.author.avatar || null} size={44} />
        <div>
          <strong>{post.author.name}{post.author.isVerified && <span className="verified-mark" title={t('verifiedAccount')}>✓</span>}</strong>
          <span>{post.__typename === 'GroupPostDetail' ? t('groupPostLabel', { group: post.group.name }) : time}</span>
          {post.__typename === 'GroupPostDetail' && <small>{time}</small>}
        </div>
      </header>
      {post.content && <p className="gateway-post-content">{post.content}</p>}
      {post.media.length > 0 && <div className={post.media.length > 1 ? 'gateway-media media-grid' : 'gateway-media'}>{post.media.map((media) => media.type === 1 ? <video key={media.id} src={media.url} controls preload="metadata" /> : <img key={media.id} src={media.url} alt="" loading="lazy" />)}</div>}
    </article>
  )
}

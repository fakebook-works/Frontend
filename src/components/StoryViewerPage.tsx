import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { GatewayStory, StoryBucket } from '../api/gatewayTypes'
import { socialApi, type ContentEngagement, type ProfileRelationshipState } from '../api/social'
import type { UserSummary } from '../api/types'
import { useI18n } from '../i18n'
import { decodeStoryContent } from '../lib/storyContent'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { VerifiedBadge } from './VerifiedBadge'

export const STORY_IMAGE_DURATION_MS = 5_000
export const STORY_VIDEO_MAX_DURATION_MS = 60_000

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : story.sharedSource.media
}

function storyTimeLabel(value: string, locale: string) {
  const created = new Date(value)
  if (Number.isNaN(created.getTime())) return value
  const minutes = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60_000))
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (minutes < 1) return formatter.format(0, 'minute')
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return formatter.format(-hours, 'hour')
  return formatter.format(-Math.floor(hours / 24), 'day')
}

export function StoryViewerPage({
  buckets,
  initialBucketId,
  viewerId,
  onClose,
  onNavigate,
  onViewed,
  onStoryDeleted,
  onRelationshipRemoved,
}: {
  buckets: StoryBucket[]
  initialBucketId: string
  viewerId: string
  onClose: () => void
  onNavigate?: (path: string) => void
  onViewed?: (storyId: string) => void
  onStoryDeleted?: (storyId: string) => void | Promise<void>
  onRelationshipRemoved?: (authorId: string) => void | Promise<void>
}) {
  const { t, locale } = useI18n()
  const initialBucketIndex = Math.max(0, buckets.findIndex((item) => item.author.id === initialBucketId))
  const [bucketIndex, setBucketIndex] = useState(initialBucketIndex)
  const [index, setIndex] = useState(0)
  const [engagement, setEngagement] = useState<ContentEngagement | null>(null)
  const [viewers, setViewers] = useState<UserSummary[]>([])
  const [likedUsers, setLikedUsers] = useState<UserSummary[]>([])
  const [relationship, setRelationship] = useState<ProfileRelationshipState | null>(null)
  const [likeBusy, setLikeBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [durationMs, setDurationMs] = useState(STORY_IMAGE_DURATION_MS)
  const [mediaReady, setMediaReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const imageElapsedRef = useRef(0)
  const advancingRef = useRef(false)

  const bucket = buckets[bucketIndex] ?? buckets[0]
  const story = bucket?.stories[index] ?? bucket?.stories[0]
  const media = story ? storyMedia(story) : null
  const decodedContent = decodeStoryContent(story?.content)
  const isVideo = media?.type === 1
  const isOwner = bucket?.author.id === viewerId
  const audience = isOwner
    ? 'owner'
    : relationship?.friendship === 'friend'
      ? 'friend'
      : relationship?.isFollowing
        ? 'follow'
        : 'other'
  const effectivePaused = paused || panelOpen || menuOpen

  const advanceStory = useCallback(() => {
    if (advancingRef.current || !bucket) return
    advancingRef.current = true
    if (index < bucket.stories.length - 1) {
      setIndex((value) => value + 1)
      return
    }
    if (bucketIndex < buckets.length - 1) {
      setBucketIndex((value) => value + 1)
      setIndex(0)
      return
    }
    onClose()
  }, [bucket, bucketIndex, buckets.length, index, onClose])

  const previousStory = useCallback(() => {
    if (!bucket) return
    if (index > 0) {
      setIndex((value) => value - 1)
      return
    }
    if (bucketIndex > 0) {
      const previousBucketIndex = bucketIndex - 1
      setBucketIndex(previousBucketIndex)
      setIndex(Math.max(0, buckets[previousBucketIndex].stories.length - 1))
    }
  }, [bucket, bucketIndex, buckets, index])

  useEffect(() => {
    if (!story) return
    imageElapsedRef.current = 0
    advancingRef.current = false
    setProgress(0)
    setDurationMs(isVideo ? STORY_VIDEO_MAX_DURATION_MS : STORY_IMAGE_DURATION_MS)
    setMediaReady(!media)
    setPaused(false)
    setMenuOpen(false)
    setActionError(null)
  }, [isVideo, media, story])

  useEffect(() => {
    if (!bucket || isOwner) {
      setRelationship(null)
      return
    }
    let active = true
    setRelationship(null)
    socialApi.getProfileRelationshipState(viewerId, bucket.author.id)
      .then((value) => { if (active) setRelationship(value) })
      .catch(() => { if (active) setRelationship(null) })
    return () => { active = false }
  }, [bucket, isOwner, viewerId])

  useEffect(() => {
    if (!story) return
    let active = true
    setEngagement(null)
    setViewers([])
    setLikedUsers([])
    socialApi.getContentEngagement(story.id)
      .then((value) => { if (active) setEngagement(value) })
      .catch(() => { if (active) setEngagement(null) })
    if (isOwner) {
      onViewed?.(story.id)
      Promise.all([socialApi.getStoryViewers(story.id, 100), socialApi.getLikedUsers(story.id, 100)])
        .then(([viewerPage, likedPage]) => {
          if (!active) return
          setViewers(viewerPage.items)
          setLikedUsers(likedPage.items)
        })
        .catch(() => { if (active) setViewers([]) })
    } else {
      void socialApi.watchContent(viewerId, story.id)
        .then((watched) => { if (watched) onViewed?.(story.id) })
        .catch(() => undefined)
    }
    return () => { active = false }
  }, [isOwner, onViewed, story, viewerId])

  useEffect(() => {
    if (!story || isVideo || !mediaReady || effectivePaused) return
    const baseElapsed = imageElapsedRef.current
    const startedAt = performance.now()
    const remaining = Math.max(0, STORY_IMAGE_DURATION_MS - baseElapsed)
    const update = () => {
      const elapsed = Math.min(STORY_IMAGE_DURATION_MS, baseElapsed + performance.now() - startedAt)
      imageElapsedRef.current = elapsed
      setProgress(elapsed / STORY_IMAGE_DURATION_MS)
    }
    const interval = window.setInterval(update, 50)
    const timeout = window.setTimeout(() => {
      imageElapsedRef.current = STORY_IMAGE_DURATION_MS
      setProgress(1)
      advanceStory()
    }, remaining)
    return () => {
      update()
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [advanceStory, effectivePaused, isVideo, mediaReady, story])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isVideo || !mediaReady) return
    if (effectivePaused) {
      video.pause()
      return
    }
    void video.play().catch(() => setPaused(true))
  }, [effectivePaused, isVideo, mediaReady, story])

  if (!bucket || !story) return null

  const hasPrevious = index > 0 || bucketIndex > 0
  const hasNext = index < bucket.stories.length - 1 || bucketIndex < buckets.length - 1
  const time = storyTimeLabel(story.create, locale)
  const likedIds = new Set(likedUsers.map((person) => person.id))
  const relationshipAction = isOwner
    ? { label: t('deleteStory'), icon: 'trash' as const }
    : audience === 'friend'
      ? { label: t('removeFriend'), icon: 'userMinus' as const }
      : audience === 'follow'
        ? { label: t('unfollow'), icon: 'userMinus' as const }
        : null

  function chooseBucket(nextBucketIndex: number) {
    if (nextBucketIndex === bucketIndex) return
    setBucketIndex(nextBucketIndex)
    setIndex(0)
    setPanelOpen(false)
  }

  function chooseStory(nextIndex: number) {
    if (nextIndex !== index) setIndex(nextIndex)
  }

  function handleVideoMetadata() {
    const video = videoRef.current
    if (!video) return
    const sourceDurationMs = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration * 1_000
      : STORY_VIDEO_MAX_DURATION_MS
    setDurationMs(Math.min(sourceDurationMs, STORY_VIDEO_MAX_DURATION_MS))
    setMediaReady(true)
  }

  function handleVideoProgress() {
    const video = videoRef.current
    if (!video || durationMs <= 0) return
    const elapsed = Math.min(durationMs, video.currentTime * 1_000)
    setProgress(Math.min(1, elapsed / durationMs))
    if (elapsed >= durationMs) advanceStory()
  }

  async function toggleLike() {
    const next = !engagement?.viewerHasLiked
    setLikeBusy(true)
    setActionError(null)
    try {
      const success = next
        ? await socialApi.likeContent(viewerId, story.id)
        : await socialApi.unlikeContent(viewerId, story.id)
      if (!success) throw new Error('Reaction rejected')
      setEngagement((current) => ({
        ...(current ?? {
          targetId: story.id,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          viewerHasSaved: false,
          viewerHasWatched: true,
        }),
        viewerHasLiked: next,
        likeCount: Math.max(0, (current?.likeCount ?? 0) + (next ? 1 : -1)),
      }))
    } catch {
      setActionError(t('storyActionError'))
    } finally {
      setLikeBusy(false)
    }
  }

  async function runRelationshipAction() {
    if (!relationshipAction) return
    setActionBusy(true)
    setActionError(null)
    try {
      if (isOwner) {
        const result = await api.deleteStory(viewerId, story.id)
        if (!result.success) throw new Error(result.message ?? 'Delete rejected')
        setMenuOpen(false)
        if (onStoryDeleted) await onStoryDeleted(story.id)
        else onClose()
        return
      }
      const success = audience === 'friend'
        ? await socialApi.unfriend(viewerId, bucket.author.id)
        : await socialApi.unfollowUser(viewerId, bucket.author.id)
      if (!success) throw new Error('Relationship action rejected')
      setMenuOpen(false)
      if (onRelationshipRemoved) await onRelationshipRemoved(bucket.author.id)
      else onClose()
    } catch {
      setActionError(t('storyActionError'))
    } finally {
      setActionBusy(false)
    }
  }

  const ownerBucketIndex = buckets.findIndex((item) => item.author.id === viewerId)
  const otherBuckets = buckets.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => item.author.id !== viewerId)

  return <div className="story-viewer-backdrop" role="presentation" onClick={onClose}>
    <aside className="story-viewer-sidebar" onClick={(event) => event.stopPropagation()}>
      <header><button type="button" className="story-sidebar-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={26} /></button><h2>{t('stories')}</h2></header>
      {ownerBucketIndex >= 0 && <section><h3>{t('yourStories')}</h3><StorySidebarBucket bucket={buckets[ownerBucketIndex]} active={ownerBucketIndex === bucketIndex} onClick={() => chooseBucket(ownerBucketIndex)} /></section>}
      {otherBuckets.length > 0 && <section><h3>{t('allStories')}</h3>{otherBuckets.map(({ item, itemIndex }) => <StorySidebarBucket key={item.author.id} bucket={item} active={itemIndex === bucketIndex} onClick={() => chooseBucket(itemIndex)} />)}</section>}
    </aside>

    <main className="story-viewer-canvas">
      <button type="button" className="story-viewer-floating-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={24} /></button>
      <section className={`story-viewer story-viewer-${audience}`} role="dialog" aria-modal="true" aria-label={t('stories')} onClick={(event) => event.stopPropagation()}>
        <div className="story-frame">
          <div className="story-progress">{bucket.stories.map((item, itemIndex) => {
            const fill = itemIndex < index ? 1 : itemIndex > index ? 0 : progress
            return <button type="button" key={item.id} onClick={() => chooseStory(itemIndex)} aria-label={`${t('stories')} ${itemIndex + 1}`}><span style={{ transform: `scaleX(${fill})` }} /></button>
          })}</div>
          <header className="story-viewer-header">
            <button type="button" className="story-owner" onClick={() => onNavigate?.(`/profile/${bucket.author.id}`)}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={40} /><span><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} /></strong><small>{time}</small></span></button>
            <div className="story-viewer-controls">
              {isVideo && <button type="button" aria-label={muted ? t('storyUnmute') : t('storyMute')} title={muted ? t('storyUnmute') : t('storyMute')} onClick={() => setMuted((value) => !value)}><Icon name={muted ? 'volumeOff' : 'volume'} size={22} /></button>}
              <button type="button" aria-label={paused ? t('storyPlay') : t('storyPause')} title={paused ? t('storyPlay') : t('storyPause')} onClick={() => setPaused((value) => !value)}><Icon name={paused ? 'play' : 'pause'} size={21} /></button>
              {relationshipAction && <div className="story-viewer-menu-wrap"><button type="button" aria-label={t('storyOptions')} title={t('storyOptions')} onClick={() => setMenuOpen((value) => !value)}><Icon name="more" size={22} /></button>{menuOpen && <div className="story-viewer-menu" role="menu"><button type="button" role="menuitem" disabled={actionBusy} onClick={() => void runRelationshipAction()}><Icon name={relationshipAction.icon} size={20} /><span>{relationshipAction.label}</span></button></div>}</div>}
            </div>
          </header>

          <div className="story-stage">
            {media && media.type !== 1 && <span className="story-stage-backdrop" style={{ backgroundImage: `url(${JSON.stringify(media.url)})` }} />}
            {media
              ? isVideo
                ? <video ref={videoRef} src={media.url} autoPlay muted={muted} playsInline preload="metadata" onLoadedMetadata={handleVideoMetadata} onTimeUpdate={handleVideoProgress} onEnded={advanceStory} />
                : <img src={media.url} alt="" onLoad={() => setMediaReady(true)} onError={() => setMediaReady(true)} />
              : <div className="story-text-only" style={{ backgroundColor: decodedContent.backgroundColor }}><p>{decodedContent.text}</p></div>}
            {decodedContent.text && media && <p className="story-caption">{decodedContent.text}</p>}
          </div>
        </div>

        {hasPrevious && <button type="button" className="story-nav previous" aria-label={`${t('stories')} previous`} onClick={previousStory}><Icon name="back" size={25} /></button>}
        {hasNext && <button type="button" className="story-nav next" aria-label={`${t('stories')} next`} onClick={advanceStory}><Icon name="back" size={25} /></button>}

        {isOwner
          ? <footer className="story-viewer-footer owner-footer"><button type="button" className="story-viewer-insights" aria-expanded={panelOpen} onClick={() => setPanelOpen((value) => !value)}><Icon name="caret" size={18} className={panelOpen ? 'open' : ''} /><span><strong>{t('storyViewersCount', { count: viewers.length })}</strong><span className="story-viewer-avatar-stack">{viewers.slice(0, 4).map((person) => <Avatar key={person.id} name={person.displayName} src={person.avatarUrl} size={28} />)}</span></span></button><span className="story-owner-like-count"><i><Icon name="like" size={15} /></i><strong>{engagement?.likeCount ?? 0}</strong></span></footer>
          : <footer className="story-viewer-footer audience-footer"><button type="button" className={engagement?.viewerHasLiked ? 'story-like active' : 'story-like'} disabled={likeBusy} onClick={() => void toggleLike()}><i><Icon name="like" size={21} /></i><span>{engagement?.viewerHasLiked ? t('liked') : t('like')}</span>{Boolean(engagement?.likeCount) && <strong>{engagement?.likeCount}</strong>}</button></footer>}

        {actionError && <p className="story-viewer-error">{actionError}</p>}
        {isOwner && panelOpen && <aside className="story-viewer-panel">
          <header><h3>{t('storyDetails')}</h3><button type="button" aria-label={t('close')} onClick={() => setPanelOpen(false)}><Icon name="close" size={22} /></button></header>
          <div className="story-detail-thumbnails">{bucket.stories.map((item, itemIndex) => {
            const preview = storyMedia(item)
            const decodedItemContent = decodeStoryContent(item.content)
            return <button type="button" key={item.id} className={itemIndex === index ? 'active' : ''} onClick={() => chooseStory(itemIndex)}>{preview ? preview.type === 1 ? <video src={preview.url} muted preload="metadata" /> : <img src={preview.url} alt="" /> : <span style={{ backgroundColor: decodedItemContent.backgroundColor }}>{decodedItemContent.text}</span>}</button>
          })}</div>
          <div className="story-viewer-panel-summary"><Icon name="eye" size={20} /><strong>{t('storyViewersCount', { count: viewers.length })}</strong></div>
          <div className="story-viewer-list">{viewers.length === 0 ? <p>{t('storyNoViewers')}</p> : viewers.map((person) => <button type="button" key={person.id} onClick={() => onNavigate?.(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={44} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{likedIds.has(person.id) ? t('likedStory') : t('viewedStory')}</small></span>{likedIds.has(person.id) && <i><Icon name="like" size={13} /></i>}</button>)}</div>
        </aside>}
      </section>
    </main>
  </div>
}

function StorySidebarBucket({ bucket, active, onClick }: { bucket: StoryBucket; active: boolean; onClick: () => void }) {
  const { locale } = useI18n()
  return <button type="button" className={active ? 'story-sidebar-bucket active' : 'story-sidebar-bucket'} onClick={onClick}><span className={bucket.hasUnseen ? 'story-sidebar-avatar unseen' : 'story-sidebar-avatar'}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={50} /></span><span><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} size={12} /></strong><small>{storyTimeLabel(bucket.latestCreate, locale)}</small></span></button>
}

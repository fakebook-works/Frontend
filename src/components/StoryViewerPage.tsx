import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import type { GatewayPost, GatewayStory, SharedPostSource, SharedStorySource, StoryBucket } from '../api/gatewayTypes'
import { socialApi, type ContentEngagement, type ProfileRelationshipState } from '../api/social'
import type { UserSummary } from '../api/types'
import { useI18n } from '../i18n'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { decodeStoryContent } from '../lib/storyContent'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { StoryControlIcon } from './StoryControlIcon'
import { StoryImageMedia } from './StoryImageMedia'
import { SharedPostSourceCard } from './SharedPostSourceCard'
import { SharedStoryMiniPreview } from './SharedStoryMiniPreview'
import { VerifiedBadge } from './VerifiedBadge'
import { detectVideoHasAudio } from '../lib/videoAudio'

export const STORY_IMAGE_DURATION_MS = 5_000
export const STORY_VIDEO_MAX_DURATION_MS = 60_000

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : null
}

function sharedPostSourceFromDetail(source: SharedStorySource, detail: GatewayPost | null): SharedPostSource {
  if (detail?.__typename === 'FeedPostDetail' && detail.sharedSource?.isAvailable) return detail.sharedSource
  if (detail) {
    return {
      id: detail.id,
      isAvailable: true,
      type: detail.type,
      content: detail.content,
      privacy: detail.privacy,
      create: detail.create,
      author: {
        id: detail.author.id,
        name: detail.author.name,
        avatar: detail.author.avatar,
        isVerified: detail.author.isVerified,
      },
      media: detail.media,
      mentions: detail.mentions,
    }
  }
  return {
    id: source.id,
    isAvailable: true,
    type: source.media?.type ?? null,
    content: source.content,
    author: source.author,
    media: source.media ? [source.media] : [],
  }
}

function SharedStoryAmbient({ source }: { source: SharedPostSource }) {
  const decoded = decodePostContent(source.content)
  const background = getPostBackgroundPreset(decoded.backgroundId)
  const image = source.media.find((item) => item.type === 0)
  return <div className="shared-story-ambient" aria-hidden="true">
    {image && <img src={image.url} alt="" />}
    {background && <span className="shared-story-ambient-accent" style={{ background: background.background }} />}
    <span className="shared-story-ambient-wash" />
  </div>
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

function StoryNavigationChevron({ direction }: { direction: 'previous' | 'next' }) {
  return <svg className="story-navigation-chevron" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={direction === 'previous' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} /></svg>
}

export function StoryViewerPage({
  buckets,
  initialBucketId,
  viewerId,
  onClose,
  onNavigate,
  onViewed,
  onCreateStory,
  onStoryDeleted,
  onRelationshipRemoved,
}: {
  buckets: StoryBucket[]
  initialBucketId: string
  viewerId: string
  onClose: () => void
  onNavigate?: (path: string) => void
  onViewed?: (storyId: string) => void
  onCreateStory?: () => void
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
  const [ownerInsightsLoadedKey, setOwnerInsightsLoadedKey] = useState<string | null>(null)
  const [deletedStoryIds, setDeletedStoryIds] = useState<Set<string>>(() => new Set())
  const [relationship, setRelationship] = useState<ProfileRelationshipState | null>(null)
  const [likeBusy, setLikeBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [storyScrubPosition, setStoryScrubPosition] = useState(0)
  const [readyPlaybackKey, setReadyPlaybackKey] = useState<string | null>(null)
  const [failedPlaybackKey, setFailedPlaybackKey] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<{ key: string; milliseconds: number } | null>(null)
  const [videoAspectRatio, setVideoAspectRatio] = useState<{ key: string; ratio: number } | null>(null)
  const [videoAudio, setVideoAudio] = useState<{ key: string; hasAudio: boolean } | null>(null)
  const sharedPostDetailCacheRef = useRef(new Map<string, GatewayPost | null>())
  const sharedPostDetailRequestsRef = useRef(new Set<string>())
  const sharedPostDetailAliveRef = useRef(true)
  const [sharedPostDetails, setSharedPostDetails] = useState<Map<string, GatewayPost | null>>(() => new Map())
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const backdropCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null)
  const imageElapsedRef = useRef(0)
  const advancingRef = useRef(false)
  const storyScrubbingRef = useRef(false)

  const visibleBuckets = useMemo<StoryBucket[]>(() => buckets.flatMap((item) => {
    const stories = item.stories.filter((candidate) => !deletedStoryIds.has(candidate.id))
    return stories.length > 0 ? [{ ...item, latestCreate: stories[0].create, stories }] : []
  }), [buckets, deletedStoryIds])
  const bucket = visibleBuckets[bucketIndex] ?? visibleBuckets[0]
  const story = bucket?.stories[index] ?? bucket?.stories[0]
  const media = story ? storyMedia(story) : null
  const decodedContent = decodeStoryContent(story?.content)
  const sharedSource = story && story.__typename !== 'NormalStory' ? story.sharedSource : null
  const sharedSourceId = sharedSource?.id ?? null
  const sharedPostDetail = sharedSourceId && sharedPostDetails.has(sharedSourceId)
    ? sharedPostDetails.get(sharedSourceId) ?? null
    : undefined
  const sharedDetailReady = !sharedSource || sharedPostDetail !== undefined
  const sharedAmbientSource = sharedSource
    ? sharedPostSourceFromDetail(sharedSource, sharedPostDetail ?? null)
    : null
  const resolvedSharedSource = sharedSource && sharedDetailReady
    ? sharedPostSourceFromDetail(sharedSource, sharedPostDetail ?? null)
    : null
  const isVideo = media?.type === 1
  const playbackKey = story ? `${story.id}:${media?.url ?? sharedSource?.id ?? 'text'}` : ''
  const videoFailed = Boolean(playbackKey && failedPlaybackKey === playbackKey)
  const playsAsVideo = isVideo && !videoFailed
  const mediaReady = sharedSource ? sharedDetailReady : !media || readyPlaybackKey === playbackKey
  const durationMs = playsAsVideo
    ? videoDuration?.key === playbackKey ? videoDuration.milliseconds : STORY_VIDEO_MAX_DURATION_MS
    : STORY_IMAGE_DURATION_MS
  const currentVideoAspectRatio = videoAspectRatio?.key === playbackKey ? videoAspectRatio.ratio : 9 / 16
  const audioAvailability = playsAsVideo
    ? videoAudio?.key === playbackKey ? videoAudio.hasAudio : null
    : false
  const audioControlEnabled = audioAvailability === true
  const audioControlLabel = audioControlEnabled
    ? muted ? t('storyUnmute') : t('storyMute')
    : t('storyNoAudio')
  const videoForegroundStyle = currentVideoAspectRatio >= 9 / 16
    ? { width: '100%', height: 'auto', aspectRatio: `${currentVideoAspectRatio}` }
    : { width: 'auto', height: '100%', aspectRatio: `${currentVideoAspectRatio}` }
  const isOwner = bucket?.author.id === viewerId
  const audience = isOwner
    ? 'owner'
    : relationship?.friendship === 'friend'
      ? 'friend'
      : relationship?.isFollowing
        ? 'follow'
        : 'other'
  const effectivePaused = paused || panelOpen || menuOpen

  const loadSharedPostDetail = useCallback((sourceId: string) => {
    if (sharedPostDetailCacheRef.current.has(sourceId) || sharedPostDetailRequestsRef.current.has(sourceId)) return
    sharedPostDetailRequestsRef.current.add(sourceId)
    Promise.resolve()
      .then(() => api.postDetail(sourceId))
      .then((post) => sharedPostDetailCacheRef.current.set(sourceId, post))
      .catch(() => sharedPostDetailCacheRef.current.set(sourceId, null))
      .finally(() => {
        sharedPostDetailRequestsRef.current.delete(sourceId)
        if (sharedPostDetailAliveRef.current) setSharedPostDetails(new Map(sharedPostDetailCacheRef.current))
      })
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('content-detail-open', 'story-viewer-open')
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('content-detail-open', 'story-viewer-open')
    }
  }, [])

  useEffect(() => {
    sharedPostDetailAliveRef.current = true
    return () => { sharedPostDetailAliveRef.current = false }
  }, [])

  useEffect(() => {
    if (!bucket) return
    const sourceIds = new Set<string>()
    bucket.stories.forEach((item) => {
      if (item.__typename !== 'NormalStory') sourceIds.add(item.sharedSource.id)
    })
    const nextBucket = visibleBuckets[bucketIndex + 1]
    const nextSharedStory = nextBucket?.stories.find((item) => item.__typename !== 'NormalStory')
    if (nextSharedStory) sourceIds.add(nextSharedStory.sharedSource.id)
    sourceIds.forEach(loadSharedPostDetail)
  }, [bucket, bucketIndex, loadSharedPostDetail, visibleBuckets])

  const openSharedPost = useCallback((sourceId: string) => {
    onClose()
    onNavigate?.(`/home?post=${encodeURIComponent(sourceId)}`)
  }, [onClose, onNavigate])

  const advanceStory = useCallback(() => {
    if (advancingRef.current || !bucket) return
    advancingRef.current = true
    if (index < bucket.stories.length - 1) {
      setIndex((value) => value + 1)
      return
    }
    if (bucketIndex < visibleBuckets.length - 1) {
      setBucketIndex((value) => value + 1)
      setIndex(0)
      return
    }
    onClose()
  }, [bucket, bucketIndex, index, onClose, visibleBuckets.length])

  const previousStory = useCallback(() => {
    if (!bucket) return
    if (index > 0) {
      setIndex((value) => value - 1)
      return
    }
    if (bucketIndex > 0) {
      const previousBucketIndex = bucketIndex - 1
      setBucketIndex(previousBucketIndex)
      setIndex(Math.max(0, visibleBuckets[previousBucketIndex].stories.length - 1))
    }
  }, [bucket, bucketIndex, index, visibleBuckets])

  useEffect(() => {
    if (!playbackKey) return
    imageElapsedRef.current = 0
    advancingRef.current = false
    setProgress(0)
    setPaused(false)
    setMenuOpen(false)
    setActionError(null)
  }, [playbackKey])

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
    setOwnerInsightsLoadedKey(null)
    if (isOwner) {
      onViewed?.(story.id)
      void socialApi.getLikedUsers(story.id, 100)
        .then((likedPage) => { if (active) setLikedUsers(likedPage.items) })
        .catch(() => { if (active) setLikedUsers([]) })
      Promise.allSettled([
        socialApi.getContentEngagement(story.id),
        socialApi.getStoryViewers(story.id, 100),
      ])
        .then(([engagementResult, viewerResult]) => {
          if (!active) return
          setEngagement(engagementResult.status === 'fulfilled' ? engagementResult.value : null)
          setViewers(viewerResult.status === 'fulfilled' ? viewerResult.value.items : [])
          setOwnerInsightsLoadedKey(playbackKey)
        })
    } else {
      socialApi.getContentEngagement(story.id)
        .then((value) => { if (active) setEngagement(value) })
        .catch(() => { if (active) setEngagement(null) })
      void socialApi.watchContent(viewerId, story.id)
        .then((watched) => { if (watched) onViewed?.(story.id) })
        .catch(() => undefined)
    }
    return () => { active = false }
  }, [isOwner, onViewed, playbackKey, story, viewerId])

  useEffect(() => {
    if (!story || playsAsVideo || !mediaReady || effectivePaused) return
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
  }, [advanceStory, effectivePaused, mediaReady, playsAsVideo, story])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playsAsVideo || !mediaReady) return
    let cancelled = false
    if (effectivePaused) {
      video.pause()
      return
    }
    const startPlayback = async () => {
      try {
        await video.play()
      } catch {
        if (cancelled || videoRef.current !== video) return
        if (!video.muted) {
          video.muted = true
          setMuted(true)
          try {
            await video.play()
            return
          } catch {
            // A second failure is surfaced as a paused story so the play control can retry.
          }
        }
        if (!cancelled && videoRef.current === video) setPaused(true)
      }
    }
    void startPlayback()
    return () => { cancelled = true }
  }, [effectivePaused, mediaReady, playbackKey, playsAsVideo])

  useEffect(() => {
    if (!playsAsVideo || !mediaReady) return
    const video = videoRef.current
    const backdropCanvas = backdropCanvasRef.current
    if (!video || !backdropCanvas) return
    let backdropContext: CanvasRenderingContext2D | null = null
    try {
      backdropContext = backdropCanvas.getContext('2d')
    } catch { return }
    if (!backdropContext) return
    let cancelled = false
    let videoFrameRequest: number | null = null
    let animationFrameRequest: number | null = null
    let lastBackdropDraw = Number.NEGATIVE_INFINITY
    let lastProgressUpdate = Number.NEGATIVE_INFINITY

    const schedule = () => {
      if (cancelled) return
      if (typeof video.requestVideoFrameCallback === 'function') videoFrameRequest = video.requestVideoFrameCallback(draw)
      else animationFrameRequest = window.requestAnimationFrame(draw)
    }
    const draw = (now = performance.now()) => {
      if (cancelled) return
      const sourceWidth = video.videoWidth
      const sourceHeight = video.videoHeight
      const cssWidth = backdropCanvas.clientWidth
      const cssHeight = backdropCanvas.clientHeight
      if (sourceWidth > 0 && sourceHeight > 0 && cssWidth > 0 && cssHeight > 0 && now - lastBackdropDraw >= 100) {
        const backdropScale = Math.min(1, 320 / cssWidth)
        const targetWidth = Math.max(1, Math.round(cssWidth * backdropScale))
        const targetHeight = Math.max(1, Math.round(cssHeight * backdropScale))
        if (backdropCanvas.width !== targetWidth) backdropCanvas.width = targetWidth
        if (backdropCanvas.height !== targetHeight) backdropCanvas.height = targetHeight
        const sourceRatio = sourceWidth / sourceHeight
        const targetRatio = targetWidth / targetHeight
        let cropX = 0
        let cropY = 0
        let cropWidth = sourceWidth
        let cropHeight = sourceHeight
        if (sourceRatio > targetRatio) {
          cropWidth = sourceHeight * targetRatio
          cropX = (sourceWidth - cropWidth) / 2
        } else {
          cropHeight = sourceWidth / targetRatio
          cropY = (sourceHeight - cropHeight) / 2
        }
        backdropContext.clearRect(0, 0, targetWidth, targetHeight)
        try {
          backdropContext.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight)
        } catch {
          // The first metadata event can arrive before a drawable frame; the next frame callback retries.
        }
        lastBackdropDraw = now
      }
      const elapsed = Math.min(durationMs, Math.max(0, video.currentTime * 1_000))
      if (now - lastProgressUpdate >= 50 || elapsed >= durationMs) {
        setProgress(Math.min(1, elapsed / durationMs))
        lastProgressUpdate = now
        if (elapsed >= durationMs) advanceStory()
      }
      schedule()
    }

    draw()
    return () => {
      cancelled = true
      if (videoFrameRequest != null && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(videoFrameRequest)
      if (animationFrameRequest != null) window.cancelAnimationFrame(animationFrameRequest)
    }
  }, [advanceStory, durationMs, mediaReady, playbackKey, playsAsVideo])

  useEffect(() => {
    if (!panelOpen) return
    const selected = thumbnailStripRef.current?.querySelector<HTMLElement>(`[data-story-index="${index}"]`)
    selected?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [index, panelOpen])

  useEffect(() => {
    if (!storyScrubbingRef.current) setStoryScrubPosition(index)
  }, [bucket?.author.id, bucket?.stories.length, index])

  if (!bucket || !story) return null

  const hasPrevious = index > 0 || bucketIndex > 0
  const hasNext = index < bucket.stories.length - 1 || bucketIndex < visibleBuckets.length - 1
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
    if (!storyScrubbingRef.current) setStoryScrubPosition(nextIndex)
  }

  function updateStoryScrub(nextValue: number) {
    const maximum = Math.max(0, bucket.stories.length - 1)
    const value = Math.min(maximum, Math.max(0, nextValue))
    setStoryScrubPosition(value)
    const nextIndex = Math.round(value)
    if (nextIndex !== index) setIndex(nextIndex)
  }

  function finishStoryScrub() {
    storyScrubbingRef.current = false
    const nextIndex = Math.round(storyScrubPosition)
    setStoryScrubPosition(nextIndex)
    if (nextIndex !== index) setIndex(nextIndex)
  }

  function handleVideoMetadata() {
    const video = videoRef.current
    if (!video) return
    const sourceDurationMs = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration * 1_000
      : STORY_VIDEO_MAX_DURATION_MS
    setVideoDuration({ key: playbackKey, milliseconds: Math.min(sourceDurationMs, STORY_VIDEO_MAX_DURATION_MS) })
    if (video.videoWidth > 0 && video.videoHeight > 0) setVideoAspectRatio({ key: playbackKey, ratio: video.videoWidth / video.videoHeight })
    updateVideoAudioAvailability(video)
    setReadyPlaybackKey(playbackKey)
  }

  function updateVideoAudioAvailability(video: HTMLVideoElement, assumeAudioWhenUnknown = false) {
    const detected = detectVideoHasAudio(video)
    if (detected != null || assumeAudioWhenUnknown) setVideoAudio({ key: playbackKey, hasAudio: detected ?? true })
  }

  function handleVideoReady(video: HTMLVideoElement, assumeAudioWhenUnknown = false) {
    setReadyPlaybackKey(playbackKey)
    updateVideoAudioAvailability(video, assumeAudioWhenUnknown)
  }

  function handleVideoProgress() {
    const video = videoRef.current
    if (!video || !playsAsVideo || durationMs <= 0) return
    const elapsed = Math.min(durationMs, video.currentTime * 1_000)
    setProgress(Math.min(1, elapsed / durationMs))
    if (elapsed >= durationMs) advanceStory()
  }

  function handleVideoError() {
    setFailedPlaybackKey(playbackKey)
    setReadyPlaybackKey(playbackKey)
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
          viewCount: 0,
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
        const nextStoryCount = bucket.stories.length - 1
        const nextBucketCount = visibleBuckets.length - (nextStoryCount === 0 ? 1 : 0)
        setDeletedStoryIds((current) => new Set(current).add(story.id))
        if (nextStoryCount > 0) setIndex(Math.min(index, nextStoryCount - 1))
        else if (nextBucketCount > 0) {
          setBucketIndex(Math.min(bucketIndex, nextBucketCount - 1))
          setIndex(0)
          setPanelOpen(false)
        } else onClose()
        if (onStoryDeleted) await onStoryDeleted(story.id)
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

  const ownerBucketIndex = visibleBuckets.findIndex((item) => item.author.id === viewerId)
  const otherBuckets = visibleBuckets.map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => item.author.id !== viewerId)
  const viewerCount = Math.max(engagement?.viewCount ?? 0, viewers.length)
  const likeCount = Math.max(engagement?.likeCount ?? 0, likedUsers.length)
  const hasViewers = viewerCount > 0
  const ownerInsightsReady = !isOwner || ownerInsightsLoadedKey === playbackKey
  const ownerViewerState = !ownerInsightsReady ? 'loading-viewers' : hasViewers ? 'has-viewers' : 'no-viewers'
  const ownerStoryState = !ownerInsightsReady ? 'loading-story-viewers' : hasViewers ? 'has-story-viewers' : 'no-story-viewers'
  const ownerViewerLabel = !ownerInsightsReady
    ? t('storyViewersLabel')
    : hasViewers
      ? t('storyViewersCount', { count: viewerCount })
      : t('storyNoViewersShort')

  return <>
    {createPortal(<button type="button" className="content-detail-shell-close story-viewer-shell-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={24} /></button>, document.body)}
    <div className="story-viewer-backdrop" role="presentation" onClick={onClose}>
    <aside className="story-viewer-sidebar" onClick={(event) => event.stopPropagation()}>
      <header className="story-sidebar-heading"><h2>{t('stories')}</h2></header>
      {ownerBucketIndex >= 0 && <section className="story-sidebar-owner-section"><h3>{t('yourStories')}</h3><StorySidebarBucket bucket={visibleBuckets[ownerBucketIndex]} active={ownerBucketIndex === bucketIndex} onClick={() => chooseBucket(ownerBucketIndex)} />{onCreateStory && <button type="button" className="story-sidebar-create" aria-label={t('storyCreate')} onClick={onCreateStory}><Icon name="plus" size={22} /></button>}</section>}
      {otherBuckets.length > 0 && <section><h3>{t('allStories')}</h3>{otherBuckets.map(({ item, itemIndex }) => <StorySidebarBucket key={item.author.id} bucket={item} active={itemIndex === bucketIndex} onClick={() => chooseBucket(itemIndex)} />)}</section>}
    </aside>

    <main className={`story-viewer-canvas${isOwner ? ' story-viewer-canvas-owner' : ''}`}>
      <section className={`story-viewer story-viewer-${audience}${isOwner ? ` ${ownerStoryState}` : ''}`} role="dialog" aria-modal="true" aria-label={t('stories')} onClick={(event) => event.stopPropagation()}>
        <div className="story-frame">
          <div className="story-progress">{bucket.stories.map((item, itemIndex) => {
            const fill = itemIndex < index ? 1 : itemIndex > index ? 0 : progress
            return <button type="button" key={item.id} onClick={() => chooseStory(itemIndex)} aria-label={`${t('stories')} ${itemIndex + 1}`}><span style={{ transform: `scaleX(${fill})` }} /></button>
          })}</div>
          <header className="story-viewer-header">
            <button type="button" className="story-owner" onClick={() => onNavigate?.(`/profile/${bucket.author.id}`)}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={42} /><span className="story-owner-copy"><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} /></strong><small>{time}</small></span></button>
            <div className="story-viewer-controls">
              <button type="button" className="story-audio-control" aria-label={audioControlLabel} title={audioControlLabel} aria-disabled={!audioControlEnabled} onClick={() => { if (audioControlEnabled) setMuted((value) => !value) }}><StoryControlIcon name={audioControlEnabled && !muted ? 'volume' : 'volumeOff'} size={24} /></button>
              <button type="button" aria-label={paused ? t('storyPlay') : t('storyPause')} title={paused ? t('storyPlay') : t('storyPause')} onClick={() => setPaused((value) => !value)}><StoryControlIcon name={paused ? 'play' : 'pause'} size={24} /></button>
              {relationshipAction && <div className="story-viewer-menu-wrap"><button type="button" aria-label={t('storyOptions')} title={t('storyOptions')} onClick={() => setMenuOpen((value) => !value)}><StoryControlIcon name="more" size={24} /></button>{menuOpen && <div className="story-viewer-menu" role="menu"><button type="button" role="menuitem" disabled={actionBusy} onClick={() => void runRelationshipAction()}><Icon name={relationshipAction.icon} size={20} /><span>{relationshipAction.label}</span></button></div>}</div>}
            </div>
          </header>

          <div className="story-stage">
            {sharedAmbientSource
              ? <SharedStoryAmbient source={sharedAmbientSource} />
              : media
              ? isVideo
                ? <><span className="story-stage-backdrop" aria-hidden="true"><canvas ref={backdropCanvasRef} /></span><video key={playbackKey} className="story-viewer-video-source" ref={videoRef} src={media.url} style={videoForegroundStyle} muted={muted} playsInline preload="auto" onLoadedMetadata={handleVideoMetadata} onLoadedData={(event) => handleVideoReady(event.currentTarget)} onCanPlay={(event) => handleVideoReady(event.currentTarget, true)} onTimeUpdate={handleVideoProgress} onEnded={advanceStory} onError={handleVideoError} /></>
                : <StoryImageMedia key={playbackKey} src={media.url} eager onReady={() => setReadyPlaybackKey(playbackKey)} />
              : <div className="story-text-only" style={{ background: decodedContent.backgroundColor }}><p>{decodedContent.text}</p></div>}
            {decodedContent.text && (media || sharedSource) && <p className={sharedSource ? 'story-caption shared-story-caption' : 'story-caption'}>{decodedContent.text}</p>}
            {sharedSource && !sharedDetailReady && <div className="story-shared-post-card story-shared-post-loading" aria-busy="true"><span className="spinner" /></div>}
            {sharedSource && resolvedSharedSource && <div className="story-shared-post-card"><SharedPostSourceCard source={resolvedSharedSource} locale={locale} onNavigate={onNavigate} onOpenSource={openSharedPost} /></div>}
          </div>
        </div>

        {hasPrevious && <button type="button" className="story-nav previous" aria-label={`${t('stories')} previous`} onClick={previousStory}><StoryNavigationChevron direction="previous" /></button>}
        {hasNext && <button type="button" className="story-nav next" aria-label={`${t('stories')} next`} onClick={advanceStory}><StoryNavigationChevron direction="next" /></button>}

        {isOwner
          ? <footer className={`story-viewer-footer owner-footer ${ownerViewerState}`}><button type="button" className="story-viewer-insights" aria-expanded={panelOpen} onClick={() => setPanelOpen((value) => !value)}><span className="story-viewer-insights-label"><StoryControlIcon name="caret" size={20} className={panelOpen ? 'open' : ''} /><strong>{ownerViewerLabel}</strong></span>{ownerInsightsReady && hasViewers && viewers.length > 0 && <span className="story-viewer-avatar-stack">{viewers.slice(0, 4).map((person) => <Avatar key={person.id} name={person.displayName} src={person.avatarUrl} size={28} />)}</span>}</button>{ownerInsightsReady && likeCount > 0 && <span className="story-owner-like-count"><i><Icon name="like" size={15} /></i><strong>{likeCount}</strong></span>}</footer>
          : <footer className="story-viewer-footer audience-footer"><button type="button" className={engagement?.viewerHasLiked ? 'story-like active' : 'story-like'} aria-pressed={Boolean(engagement?.viewerHasLiked)} disabled={likeBusy} onClick={() => void toggleLike()}><i><Icon name={engagement?.viewerHasLiked ? 'like' : 'likeOutline'} size={24} /></i><span>{engagement?.viewerHasLiked ? t('liked') : t('like')}</span></button></footer>}

        {actionError && <p className="story-viewer-error">{actionError}</p>}
        {isOwner && panelOpen && <aside className="story-viewer-panel">
          <header><h3>{t('storyDetails')}</h3><button type="button" aria-label={t('close')} onClick={() => setPanelOpen(false)}><Icon name="close" size={22} /></button></header>
          <div className="story-detail-picker"><div ref={thumbnailStripRef} className="story-detail-thumbnails">{bucket.stories.map((item, itemIndex) => {
            const preview = storyMedia(item)
            const decodedItemContent = item.__typename === 'NormalStory' ? decodeStoryContent(item.content) : null
            return <button type="button" key={item.id} data-story-index={itemIndex} className={itemIndex === index ? 'active' : ''} onClick={() => chooseStory(itemIndex)}>{item.__typename !== 'NormalStory' ? <SharedStoryMiniPreview source={item.sharedSource} className="detail-shared-story-preview" /> : preview ? preview.type === 1 ? <video src={preview.url} muted preload="metadata" /> : <img src={preview.url} alt="" /> : <span style={{ background: decodedItemContent?.backgroundColor }}>{decodedItemContent?.text}</span>}</button>
          })}</div>{bucket.stories.length > 1 ? <span className="story-detail-scrubber-shell"><span className="story-detail-scrubber-track" aria-hidden="true" /><input className="story-detail-scrubber" type="range" min="0" max={bucket.stories.length - 1} step="any" value={Math.min(storyScrubPosition, bucket.stories.length - 1)} aria-label={t('storySelect')} onPointerDown={() => { storyScrubbingRef.current = true }} onChange={(event) => updateStoryScrub(Number(event.currentTarget.value))} onPointerUp={finishStoryScrub} onPointerCancel={finishStoryScrub} onBlur={() => { if (storyScrubbingRef.current) finishStoryScrub() }} /></span> : <span className="story-detail-scrubber-static" aria-hidden="true" />}</div>
          <div className="story-viewer-panel-summary"><Icon name="eye" size={20} /><strong>{ownerViewerLabel}</strong></div>
          <div className="story-viewer-list">{!ownerInsightsReady ? null : viewers.length === 0 ? <p>{t('storyNoViewers')}</p> : viewers.map((person) => <button type="button" key={person.id} onClick={() => onNavigate?.(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={52} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{likedIds.has(person.id) ? t('likedStory') : t('viewedStory')}</small></span>{likedIds.has(person.id) && <i><Icon name="like" size={12} /></i>}</button>)}</div>
        </aside>}
      </section>
    </main>
    </div>
  </>
}

function StorySidebarBucket({ bucket, active, onClick }: { bucket: StoryBucket; active: boolean; onClick: () => void }) {
  const { locale, t } = useI18n()
  const unseenCount = Math.max(0, bucket.unseenCount ?? (bucket.hasUnseen ? bucket.stories.length : 0))
  return <button type="button" className={active ? 'story-sidebar-bucket active' : 'story-sidebar-bucket'} onClick={onClick}><span className={bucket.hasUnseen ? 'story-sidebar-avatar unseen' : 'story-sidebar-avatar'}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={44} /></span><span><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} size={12} /></strong><small>{unseenCount > 0 && <b>{t('newStoryCardsCount', { count: unseenCount })}</b>}<span>{storyTimeLabel(bucket.latestCreate, locale)}</span></small></span></button>
}

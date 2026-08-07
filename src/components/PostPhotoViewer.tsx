import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { api } from '../api/client'
import type { GatewayMedia, GatewayPost, SharedStory } from '../api/gatewayTypes'
import { socialApi, type ContentEngagement } from '../api/social'
import { useI18n } from '../i18n'
import { useBodyInteractionLock } from '../lib/bodyInteractionLock'
import { Avatar } from './Avatar'
import { HoverTooltip } from './HoverTooltip'
import { Icon } from './Icon'
import { PostDetailCommentsModal } from './PostDetailCommentsModal'
import { PostVideoPlayer } from './PostVideoPlayer'
import { ShareModal } from './ContentActions'
import { VerifiedBadge } from './VerifiedBadge'

const EMPTY_ENGAGEMENT: ContentEngagement = {
  targetId: '',
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  viewCount: 0,
  viewerHasLiked: false,
  viewerHasSaved: false,
  viewerHasWatched: false,
}

export interface PostPhotoViewerProps {
  viewerId: string
  contentId: string
  initialMediaId?: string
  initialMediaUrl?: string
  initialPlaybackTime?: number
  initialPost?: GatewayPost
  mediaEntries?: PostPhotoViewerMediaEntry[]
  unavailableAuthor?: GatewayPost['author']
  onClose: () => void
  routeOwned?: boolean
  onActiveMediaChange?: (contentId: string, mediaId: string) => void
  onNavigate?: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
  onStoryCreated?: (story: SharedStory) => void
}

export interface PostPhotoViewerMediaEntry {
  post: GatewayPost | null
  media: GatewayMedia
}

function PhotoNavigationIcon({ direction }: { direction: 'previous' | 'next' }) {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction === 'previous' ? 'm14.5 5.5-6.5 6.5 6.5 6.5' : 'm9.5 5.5 6.5 6.5-6.5 6.5'} /></svg>
}

function PhotoViewerToolIcon({ name }: { name: 'zoom-in' | 'zoom-out' | 'fullscreen' | 'fullscreen-exit' }) {
  if (name === 'fullscreen' || name === 'fullscreen-exit') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.05" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={name === 'fullscreen' ? 'M14.5 9.5 20 4m0 0h-4.25M20 4v4.25M9.5 14.5 4 20m0 0h4.25M4 20v-4.25' : 'M20 4l-5.5 5.5m0 0V5.75m0 3.75h3.75M4 20l5.5-5.5m0 0v3.75m0-3.75H5.75'} /></svg>
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15.1 15.1A6.5 6.5 0 1 1 5.9 5.9a6.5 6.5 0 0 1 9.2 9.2l5.15 5.15M7.5 10.5h6" />{name === 'zoom-in' && <path d="M10.5 7.5v6" />}</svg>
}

function CommentUnavailableIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" /></svg>
}

const MIN_PHOTO_SCALE = 1
const MAX_PHOTO_SCALE = 4
const PHOTO_SCALE_STEP = 0.5

function UnavailablePhotoDiscussion({ viewerId, author, onNavigate }: { viewerId: string; author?: GatewayPost['author']; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  const [viewer, setViewer] = useState<{ displayName: string; avatarUrl: string | null } | null>(null)
  const authorName = author?.name || t('fakebookUser')
  const openAuthor = () => {
    if (author?.id) onNavigate?.(`/profile/${author.id}`)
  }

  useEffect(() => {
    let active = true
    socialApi.getProfile(viewerId)
      .then((profile) => {
        if (active && profile) setViewer({ displayName: profile.displayName, avatarUrl: profile.avatarUrl })
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [viewerId])

  return <section className="photo-detail-discussion content-thread-modal unavailable-photo-discussion" aria-label={t('comments')} data-post-unavailable="true">
    <div className="content-thread-scroll unavailable-photo-thread">
      <article className="gateway-post thread-post-preview unavailable-post-preview">
        <header className="feed-post-head">
          <button type="button" className="post-author-avatar" disabled={!author?.id || !onNavigate} onClick={openAuthor}><Avatar name={authorName} src={author?.avatar || null} size={40} /></button>
          <div className="post-head-copy thread-post-head-copy">
            <div className="post-head-primary">
              <button type="button" className="post-author-name" disabled={!author?.id || !onNavigate} onClick={openAuthor}><strong><span className="thread-post-primary-name">{authorName}</span><VerifiedBadge verified={Boolean(author?.isVerified)} /></strong></button>
            </div>
            <span className="post-head-meta unavailable-post-meta">
              <span>{t('unknown')}</span>
              <i>·</i>
              <HoverTooltip label={t('unknown')} className="post-meta-hover post-privacy-hover">
                <span className="unavailable-post-privacy" aria-label={t('unknown')}><Icon name="info" size={13} /></span>
              </HoverTooltip>
            </span>
          </div>
        </header>
        <p className="gateway-post-content unavailable-post-content">{t('unavailablePostPlaceholder')}</p>
      </article>
      <div className="content-thread-comments empty unavailable-photo-comments">
        <div className="content-thread-list">
          <div className="no-comments-state">
            <span className="no-comments-document" aria-hidden="true"><i /></span>
            <h3>{t('cannotComment')}</h3>
            <p>{t('postCannotBeCommented')}</p>
          </div>
        </div>
      </div>
    </div>
    <form className="comment-compose unavailable-comment-compose" aria-disabled="true" onSubmit={(event) => event.preventDefault()}>
      <div className="comment-compose-row">
        <div className="comment-compose-avatar-stack">
          <Avatar name={viewer?.displayName || t('fakebookUser')} src={viewer?.avatarUrl || null} size={32} />
        </div>
        <div className="comment-compose-box unavailable-comment-compose-box">
          <div className="mention-compose-field"><textarea rows={1} value="" readOnly disabled aria-label={t('commentFeatureUnavailable')} placeholder={t('commentFeatureUnavailable')} /></div>
          <div className="comment-compose-tools">
            <div className="comment-compose-tool-list">
              <button type="button" disabled aria-label={t('feeling')}><Icon name="feeling" size={18} /></button>
              <button type="button" disabled aria-label={t('attachPhoto')}><Icon name="photo" size={18} /></button>
              <button type="button" disabled aria-label={t('stickers')}><Icon name="sticker" size={18} /></button>
            </div>
            <button type="button" disabled aria-label={t('commentFeatureUnavailable')}><CommentUnavailableIcon /></button>
          </div>
        </div>
      </div>
    </form>
  </section>
}

export function PostPhotoViewer({ viewerId, contentId, initialMediaId, initialMediaUrl, initialPlaybackTime = 0, initialPost, mediaEntries, unavailableAuthor, routeOwned = false, onClose, onActiveMediaChange, onNavigate, onMessage, onStoryCreated }: PostPhotoViewerProps) {
  useBodyInteractionLock(true, ['post-photo-viewer-open'])
  const { t } = useI18n()
  const usableInitialPost = initialPost?.__typename === 'ReelDetail' ? null : initialPost ?? null
  const suppliedContentPost = mediaEntries?.find((entry) => entry.post?.id === contentId && entry.post.__typename !== 'ReelDetail')?.post ?? null
  const [post, setPost] = useState<GatewayPost | null>(usableInitialPost)
  const [postOverrides, setPostOverrides] = useState<Record<string, GatewayPost>>({})
  const hasSuppliedEntries = Boolean(mediaEntries?.length)
  const [loading, setLoading] = useState(!usableInitialPost && !hasSuppliedEntries)
  const [loadError, setLoadError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [engagement, setEngagement] = useState<ContentEngagement>({ ...EMPTY_ENGAGEMENT, targetId: contentId })
  const [likeBusy, setLikeBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [scale, setScale] = useState(MIN_PHOTO_SCALE)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const stageRef = useRef<HTMLElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const playbackTimesRef = useRef<Record<string, number>>({})
  const reportedMediaKeyRef = useRef('')
  const selectionRequestKeyRef = useRef('')
  const viewerEntries = useMemo<PostPhotoViewerMediaEntry[]>(() => {
    if (mediaEntries?.length) return mediaEntries.filter((entry) => entry.post?.__typename !== 'ReelDetail' && (entry.media.type === 0 || entry.media.type === 1))
    if (!post || post.__typename === 'ReelDetail') return []
    return post.media.filter((media) => media.type === 0 || media.type === 1).map((media) => ({ post, media }))
  }, [mediaEntries, post])
  const requestedIndex = viewerEntries.findIndex((entry) =>
    (initialMediaId && entry.media.id === initialMediaId) ||
    (initialMediaUrl && entry.media.url === initialMediaUrl))
  const selectionRequestKey = `${contentId}:${initialMediaId ?? ''}:${initialMediaUrl ?? ''}:${viewerEntries.map((entry) => `${entry.post?.id ?? contentId}:${entry.media.id}`).join('|')}`
  const displayedActiveIndex = selectionRequestKeyRef.current === selectionRequestKey
    ? activeIndex
    : requestedIndex >= 0 ? requestedIndex : 0
  const activeEntry = viewerEntries[displayedActiveIndex] ?? null
  const activeMedia = activeEntry?.media ?? null
  const activePostBase = activeEntry ? activeEntry.post : post
  const activePost = activePostBase ? postOverrides[activePostBase.id] ?? activePostBase : null
  const activePhoto = activeMedia?.type === 0 ? activeMedia : null
  // A media URL may remain valid after its source post is deleted, hidden by
  // privacy, or absent for legacy avatars. Derive the protected sidebar from
  // the resolved entry itself so a missing flag from a parent cannot hide it.
  const showUnavailableSource = Boolean(activeMedia) && !activePost

  const clampOffset = useCallback((next: { x: number; y: number }, nextScale = scale) => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image || nextScale <= MIN_PHOTO_SCALE) return { x: 0, y: 0 }
    const maxX = Math.max(0, (image.clientWidth * nextScale - stage.clientWidth) / 2)
    const maxY = Math.max(0, (image.clientHeight * nextScale - stage.clientHeight) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    }
  }, [scale])

  const movePhoto = useCallback((delta: number) => {
    if (viewerEntries.length === 0) return
    setScale(MIN_PHOTO_SCALE)
    setOffset({ x: 0, y: 0 })
    setActiveIndex((index) => (index + delta + viewerEntries.length) % viewerEntries.length)
  }, [viewerEntries.length])

  const changeScale = useCallback((delta: number) => {
    setScale((current) => {
      const next = Math.max(MIN_PHOTO_SCALE, Math.min(MAX_PHOTO_SCALE, current + delta))
      window.requestAnimationFrame(() => setOffset((currentOffset) => clampOffset(currentOffset, next)))
      return next
    })
  }, [clampOffset])

  function startPan(event: ReactPointerEvent<HTMLImageElement>) {
    if (scale <= MIN_PHOTO_SCALE || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }
    setDragging(true)
  }

  function panPhoto(event: ReactPointerEvent<HTMLImageElement>) {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    setOffset(clampOffset({ x: start.offsetX + event.clientX - start.x, y: start.offsetY + event.clientY - start.y }))
  }

  function stopPan(event: ReactPointerEvent<HTMLImageElement>) {
    if (dragStartRef.current?.pointerId !== event.pointerId) return
    dragStartRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  useEffect(() => {
    document.body.classList.toggle('post-photo-viewer-fullscreen', fullscreen)
    return () => document.body.classList.remove('post-photo-viewer-fullscreen')
  }, [fullscreen])

  useEffect(() => {
    let active = true
    setPost(usableInitialPost)
    if (hasSuppliedEntries && !usableInitialPost && !suppliedContentPost) {
      setLoading(false)
      setLoadError(false)
      return () => { active = false }
    }
    setLoading(!usableInitialPost)
    setLoadError(false)
    api.postDetail(contentId).then((detail) => {
      if (!active) return
      if (detail?.__typename === 'ReelDetail') {
        setLoadError(true)
      } else if (detail) {
        setPost(detail)
        setPostOverrides((current) => ({ ...current, [detail.id]: detail }))
      } else {
        setPost(null)
        setLoadError(true)
      }
    }).catch(() => {
      if (active && !usableInitialPost && !suppliedContentPost) setLoadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [contentId, hasSuppliedEntries, suppliedContentPost, usableInitialPost])

  useEffect(() => {
    if (!activePost) {
      setEngagement({ ...EMPTY_ENGAGEMENT, targetId: contentId })
      return
    }
    let active = true
    setEngagement({ ...EMPTY_ENGAGEMENT, targetId: activePost.id })
    socialApi.getContentEngagement(activePost.id)
      .then((value) => { if (active && value) setEngagement(value) })
      .catch(() => undefined)
    return () => { active = false }
  }, [activePost, contentId])

  useEffect(() => {
    selectionRequestKeyRef.current = selectionRequestKey
    if (viewerEntries.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex(requestedIndex >= 0 ? requestedIndex : 0)
  }, [requestedIndex, selectionRequestKey, viewerEntries.length])

  useEffect(() => {
    setScale(MIN_PHOTO_SCALE)
    setOffset({ x: 0, y: 0 })
    setDragging(false)
    dragStartRef.current = null
  }, [activeIndex])

  useEffect(() => {
    const media = activeEntry?.media
    if (!media || !onActiveMediaChange) return
    const nextContentId = activeEntry.post?.id ?? contentId
    const key = `${nextContentId}:${media.id}`
    if (reportedMediaKeyRef.current === key) return
    reportedMediaKeyRef.current = key
    onActiveMediaChange(nextContentId, media.id)
  }, [activeEntry, contentId, onActiveMediaChange])

  useEffect(() => {
    if (viewerEntries.length < 2) return
    const adjacentIndexes = new Set([
      (displayedActiveIndex - 1 + viewerEntries.length) % viewerEntries.length,
      (displayedActiveIndex + 1) % viewerEntries.length,
    ])
    for (const index of adjacentIndexes) {
      const photo = viewerEntries[index]?.media
      if (!photo || photo.type !== 0) continue
      const preload = new Image()
      preload.src = photo.url
    }
  }, [displayedActiveIndex, viewerEntries])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
      if (event.key === 'Escape') {
        if (shareOpen) setShareOpen(false)
        else if (fullscreen) setFullscreen(false)
        else onClose()
        return
      }
      if (isEditing) return
      if (event.key === 'ArrowLeft') movePhoto(-1)
      if (event.key === 'ArrowRight') movePhoto(1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreen, movePhoto, onClose, shareOpen])

  useEffect(() => {
    const keepPhotoInBounds = () => setOffset((current) => clampOffset(current))
    window.addEventListener('resize', keepPhotoInBounds)
    return () => window.removeEventListener('resize', keepPhotoInBounds)
  }, [clampOffset])

  async function toggleLike() {
    if (!activePost) return
    const next = !engagement.viewerHasLiked
    setLikeBusy(true)
    try {
      const success = next
        ? await socialApi.likeContent(viewerId, activePost.id)
        : await socialApi.unlikeContent(viewerId, activePost.id)
      if (!success) return
      setEngagement((current) => ({ ...current, viewerHasLiked: next, likeCount: Math.max(0, current.likeCount + (next ? 1 : -1)) }))
    } finally {
      setLikeBusy(false)
    }
  }

  const canShare = Boolean(activePost)
  const canReshare = Boolean(activePost && (!activePost.sharedSource || activePost.sharedSource.isAvailable))
  const shareSourceId = activePost?.sharedSource?.isAvailable
    ? activePost.sharedSource.id
    : activePost?.id ?? contentId

  function navigateFromViewer(path: string) {
    setShareOpen(false)
    if (routeOwned && onNavigate) {
      // The route owner performs a single replace/push operation. Calling
      // onClose first would send Back to the background and race this link.
      onNavigate(path)
      return
    }
    flushSync(onClose)
  }

  return createPortal(<>
    <button type="button" className="content-detail-shell-close post-photo-viewer-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={24} /></button>
    <div className={`post-photo-viewer${fullscreen ? ' is-fullscreen' : ''}${activePost || showUnavailableSource ? '' : ' no-sidebar'}`} role="dialog" aria-modal="true" aria-label={t('photoViewer')}>
      <section ref={stageRef} className="post-photo-viewer-stage">
        {loading && !activeMedia ? <span className="spinner" /> : loadError || !activeMedia ? <div className="post-photo-viewer-error"><Icon name="photo" size={30} /><strong>{t('contentUnavailable')}</strong></div> : activeMedia.type === 1
          ? <div className="post-photo-viewer-video"><PostVideoPlayer
              key={activeMedia.id || activeMedia.url}
              src={activeMedia.url}
              controls
              autoPlay
              initialTime={playbackTimesRef.current[activeMedia.id || activeMedia.url] ?? (((initialMediaId && activeMedia.id === initialMediaId) || (initialMediaUrl && activeMedia.url === initialMediaUrl)) ? initialPlaybackTime : 0)}
              onPlaybackTimeChange={(currentTime) => { playbackTimesRef.current[activeMedia.id || activeMedia.url] = currentTime }}
            /></div>
          : <img
              ref={imageRef}
              className={`post-photo-viewer-image${scale > MIN_PHOTO_SCALE ? ' is-zoomed' : ''}${dragging ? ' is-dragging' : ''}`}
              src={activeMedia.url}
              alt=""
              loading="eager"
              draggable={false}
              style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
              onPointerDown={startPan}
              onPointerMove={panPhoto}
              onPointerUp={stopPan}
              onPointerCancel={stopPan}
            />}
        {activePhoto && <div className="post-photo-viewer-tools" aria-label={t('zoom')}>
          <button type="button" aria-label={t('storyZoomIn')} disabled={scale >= MAX_PHOTO_SCALE} onClick={() => changeScale(PHOTO_SCALE_STEP)}><PhotoViewerToolIcon name="zoom-in" /></button>
          <button type="button" aria-label={t('storyZoomOut')} disabled={scale <= MIN_PHOTO_SCALE} onClick={() => changeScale(-PHOTO_SCALE_STEP)}><PhotoViewerToolIcon name="zoom-out" /></button>
          <button type="button" className={fullscreen ? 'active' : ''} aria-label={t('videoFullscreen')} aria-pressed={fullscreen} onClick={() => setFullscreen((current) => !current)}><PhotoViewerToolIcon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} /></button>
        </div>}
        {activeMedia && <button type="button" className="post-photo-viewer-nav previous" aria-label={t('previousPhoto')} onClick={() => movePhoto(-1)}><PhotoNavigationIcon direction="previous" /></button>}
        {activeMedia && <button type="button" className="post-photo-viewer-nav next" aria-label={t('nextPhoto')} onClick={() => movePhoto(1)}><PhotoNavigationIcon direction="next" /></button>}
      </section>
      <aside className="post-photo-viewer-sidebar">
        {activePost && <PostDetailCommentsModal
          key={activePost.id}
          variant="photo-sidebar"
          viewerId={viewerId}
          targetId={activePost.id}
          post={activePost}
          engagement={engagement}
          likeBusy={likeBusy}
          canShare={canShare}
          shareDisabled={!canReshare}
          onToggleLike={toggleLike}
          onShare={() => setShareOpen(true)}
          onClose={onClose}
          onNavigate={navigateFromViewer}
          onPostChanged={(updatedPost) => {
            setPostOverrides((current) => ({ ...current, [updatedPost.id]: updatedPost }))
            setPost((current) => current?.id === updatedPost.id ? updatedPost : current)
          }}
          onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))}
        />}
        {showUnavailableSource && <UnavailablePhotoDiscussion viewerId={viewerId} author={unavailableAuthor} onNavigate={navigateFromViewer} />}
      </aside>
    </div>
    {shareOpen && activePost && canReshare && <ShareModal viewerId={viewerId} sourceId={shareSourceId} canReshare initialPreview={activePost.sharedSource?.isAvailable ? activePost.sharedSource : null} allowStory={activePost.__typename !== 'GroupPostDetail' && activePost.sharedSource?.type !== 1 && activePost.sharedSource?.type !== 3} onClose={() => setShareOpen(false)} onNavigate={navigateFromViewer} onMessage={onMessage} onStoryCreated={onStoryCreated} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />}
  </>, document.body)
}

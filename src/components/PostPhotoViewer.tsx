import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import type { GatewayPost, SharedStory } from '../api/gatewayTypes'
import { socialApi, type ContentEngagement } from '../api/social'
import { useI18n } from '../i18n'
import { Icon } from './Icon'
import { PostDetailCommentsModal } from './PostDetailCommentsModal'
import { ShareModal } from './ContentActions'

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
  initialPost?: GatewayPost
  onClose: () => void
  onNavigate?: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
  onStoryCreated?: (story: SharedStory) => void
}

function PhotoNavigationIcon({ direction }: { direction: 'previous' | 'next' }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction === 'previous' ? 'm14.5 5.5-6.5 6.5 6.5 6.5' : 'm9.5 5.5 6.5 6.5-6.5 6.5'} /></svg>
}

export function PostPhotoViewer({ viewerId, contentId, initialMediaId, initialMediaUrl, initialPost, onClose, onNavigate, onMessage, onStoryCreated }: PostPhotoViewerProps) {
  const { t } = useI18n()
  const usableInitialPost = initialPost?.__typename === 'ReelDetail' ? null : initialPost ?? null
  const [post, setPost] = useState<GatewayPost | null>(usableInitialPost)
  const [loading, setLoading] = useState(!usableInitialPost)
  const [loadError, setLoadError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [engagement, setEngagement] = useState<ContentEngagement>({ ...EMPTY_ENGAGEMENT, targetId: contentId })
  const [likeBusy, setLikeBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const photos = useMemo(() => post?.media.filter((media) => media.type === 0) ?? [], [post])
  const activePhoto = photos[activeIndex] ?? null

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('content-detail-open', 'post-photo-viewer-open')
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('content-detail-open', 'post-photo-viewer-open')
    }
  }, [])

  useEffect(() => {
    let active = true
    setPost(usableInitialPost)
    setLoading(!usableInitialPost)
    setLoadError(false)
    Promise.all([
      api.postDetail(contentId),
      socialApi.getContentEngagement(contentId).catch(() => null),
    ]).then(([detail, nextEngagement]) => {
      if (!active) return
      if (detail?.__typename === 'ReelDetail') {
        setLoadError(true)
      } else if (detail) {
        setPost(detail)
      } else if (!usableInitialPost) {
        setLoadError(true)
      }
      if (nextEngagement) setEngagement(nextEngagement)
    }).catch(() => {
      if (active && !usableInitialPost) setLoadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [contentId, usableInitialPost])

  useEffect(() => {
    if (photos.length === 0) {
      setActiveIndex(0)
      return
    }
    const requestedIndex = photos.findIndex((media) =>
      (initialMediaId && media.id === initialMediaId) ||
      (initialMediaUrl && media.url === initialMediaUrl))
    setActiveIndex(requestedIndex >= 0 ? requestedIndex : 0)
  }, [initialMediaId, initialMediaUrl, photos])

  useEffect(() => {
    for (const index of [activeIndex - 1, activeIndex + 1]) {
      const photo = photos[index]
      if (!photo) continue
      const preload = new Image()
      preload.src = photo.url
    }
  }, [activeIndex, photos])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
      if (event.key === 'Escape') {
        if (shareOpen) setShareOpen(false)
        else onClose()
        return
      }
      if (isEditing) return
      if (event.key === 'ArrowLeft' && activeIndex > 0) setActiveIndex((index) => index - 1)
      if (event.key === 'ArrowRight' && activeIndex < photos.length - 1) setActiveIndex((index) => index + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, onClose, photos.length, shareOpen])

  async function toggleLike() {
    if (!post) return
    const next = !engagement.viewerHasLiked
    setLikeBusy(true)
    try {
      const success = next
        ? await socialApi.likeContent(viewerId, post.id)
        : await socialApi.unlikeContent(viewerId, post.id)
      if (!success) return
      setEngagement((current) => ({ ...current, viewerHasLiked: next, likeCount: Math.max(0, current.likeCount + (next ? 1 : -1)) }))
    } finally {
      setLikeBusy(false)
    }
  }

  const canShare = Boolean(post && (post.__typename === 'GroupPostDetail' || post.privacy === 0))
  const canReshare = Boolean(post && post.__typename !== 'GroupPostDetail' && post.privacy === 0 && (
    post.__typename !== 'FeedPostDetail' || !post.sharedSource || post.sharedSource.isAvailable
  ))
  const shareSourceId = post?.__typename === 'FeedPostDetail' && post.sharedSource?.isAvailable
    ? post.sharedSource.id
    : post?.id ?? contentId

  return createPortal(<>
    <button type="button" className="content-detail-shell-close post-photo-viewer-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={24} /></button>
    <div className="post-photo-viewer" role="dialog" aria-modal="true" aria-label={t('photoViewer')}>
      <section className="post-photo-viewer-stage">
        {loading && !activePhoto ? <span className="spinner" /> : loadError || !post || !activePhoto ? <div className="post-photo-viewer-error"><Icon name="photo" size={30} /><strong>{t('contentUnavailable')}</strong></div> : <img className="post-photo-viewer-image" src={activePhoto.url} alt="" loading="eager" />}
        {activeIndex > 0 && <button type="button" className="post-photo-viewer-nav previous" aria-label={t('previousPhoto')} onClick={() => setActiveIndex((index) => index - 1)}><PhotoNavigationIcon direction="previous" /></button>}
        {activeIndex < photos.length - 1 && <button type="button" className="post-photo-viewer-nav next" aria-label={t('nextPhoto')} onClick={() => setActiveIndex((index) => index + 1)}><PhotoNavigationIcon direction="next" /></button>}
      </section>
      <aside className="post-photo-viewer-sidebar">
        {post && <PostDetailCommentsModal
          variant="photo-sidebar"
          viewerId={viewerId}
          targetId={post.id}
          post={post}
          engagement={engagement}
          likeBusy={likeBusy}
          canShare={canShare}
          onToggleLike={toggleLike}
          onShare={() => setShareOpen(true)}
          onClose={onClose}
          onNavigate={onNavigate}
          onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))}
        />}
      </aside>
    </div>
    {shareOpen && post && <ShareModal viewerId={viewerId} sourceId={shareSourceId} canReshare={canReshare} onClose={() => setShareOpen(false)} onNavigate={onNavigate} onMessage={onMessage} onStoryCreated={onStoryCreated} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />}
  </>, document.body)
}

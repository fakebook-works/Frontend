import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from '../api/client'
import { messengerApi } from '../api/messenger'
import { socialApi, type ContentEngagement, type SocialGroup } from '../api/social'
import type { GatewayMedia, GatewayPost, SharedPostSource, SharedStory } from '../api/gatewayTypes'
import type { MessengerConversationDto, UserSummary } from '../api/types'
import { Avatar } from './Avatar'
import { BodyPortal } from './BodyPortal'
import { ContentDetailShellClose } from './ContentDetailShellClose'
import { Icon } from './Icon'
import { GroupMembersIcon } from './GroupMembersIcon'
import { HoverTooltip } from './HoverTooltip'
import { PostDetailCommentsModal } from './PostDetailCommentsModal'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'
import { SharedPostSourceCard } from './SharedPostSourceCard'
import { VerifiedBadge } from './VerifiedBadge'
import { useI18n } from '../i18n'
import { useBodyInteractionLock } from '../lib/bodyInteractionLock'
import { INPUT_LIMITS } from '../lib/inputLimits'
import { publishMessengerMessageSent } from '../lib/messengerLocalEvents'
import { rememberOwnUnseenStory } from '../lib/ownStoryUnseen'
import { contentOverlayHref, reelOverlayHref } from '../lib/overlayRoutes'

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

type GatewayReelPost = Extract<GatewayPost, { __typename: 'ReelDetail' }>

const SHARE_EMOJIS = ['😀', '😍', '😂', '🥰', '😎', '🤔', '😢', '😡', '👍', '🎉', '❤️', '🔥']

function compactReelMetric(value: number, locale: string) {
  if (value < 1_000) return String(value)
  const units = value >= 1_000_000_000
    ? { divisor: 1_000_000_000, suffix: 'B' }
    : value >= 1_000_000
      ? { divisor: 1_000_000, suffix: 'M' }
      : { divisor: 1_000, suffix: 'K' }
  const compact = value / units.divisor
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: compact < 10 ? 1 : 0 }).format(compact)}${units.suffix}`
}

function ReelPreferenceIcon({ kind }: { kind: 'plus' | 'minus' }) {
  return <svg className="reel-option-preference-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="8.7" />
    <path d="M8.25 12h7.5" />
    {kind === 'plus' && <path d="M12 8.25v7.5" />}
  </svg>
}

function ReelPlaybackSpeedIcon() {
  return <svg className="reel-option-speed-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="14.4" cy="4.7" r="2" />
    <path d="m12.8 8.1 2.6 2.2 3.1.2M14.9 10.1l-2.7 3.2-3.2 1.4M12.2 13.3l2.9 2.6 1 3.7M10.8 13.9l-2 4.4-3.7 1.2M12.9 8.2 9.6 9.5 7.7 12" />
  </svg>
}

function ReelMenuChevron({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <svg className={`reel-option-chevron ${direction}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m6 3.5 4.2 4.5L6 12.5" /></svg>
}

interface ContentActionsProps {
  viewerId: string
  contentId: string
  post?: GatewayPost
  variant?: 'post' | 'reel'
  canShare?: boolean
  canReshare?: boolean
  commentsPresentation?: 'modal' | 'sidebar'
  commentsOpen?: boolean
  routeComments?: boolean
  /** Hide the action rail while keeping this instance available for a persistent comments surface. */
  renderActions?: boolean
  /** Render the comments surface from this instance (the Reel page owns one persistent instance). */
  renderComments?: boolean
  engagementEnabled?: boolean
  reelPlaybackRate?: number
  onReelPlaybackRateChange?: (rate: number) => void
  onCommentsOpenChange?: (open: boolean) => void
  onNavigate?: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
  onStoryCreated?: (story: SharedStory) => void
  onOpenImage?: (post: GatewayPost, media: GatewayMedia, index: number, initialPlaybackTime?: number) => void
  onOpenReel?: (post: GatewayReelPost) => void
  onContentDeleted?: (contentId: string) => void
}

export function ContentActions({ viewerId, contentId, post, variant = 'post', canShare = true, canReshare = canShare, commentsPresentation = 'modal', commentsOpen: controlledCommentsOpen, routeComments = false, renderActions = true, renderComments = true, engagementEnabled = true, reelPlaybackRate, onReelPlaybackRateChange, onCommentsOpenChange, onNavigate, onMessage, onStoryCreated, onOpenImage, onOpenReel, onContentDeleted }: ContentActionsProps) {
  const { t, locale } = useI18n()
  const [engagement, setEngagement] = useState<ContentEngagement>({ ...EMPTY_ENGAGEMENT, targetId: contentId })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localCommentsOpen, setLocalCommentsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [reelOptionsOpen, setReelOptionsOpen] = useState(false)
  const [reelSpeedOpen, setReelSpeedOpen] = useState(false)
  const [reelPreference, setReelPreference] = useState<'interested' | 'not-interested' | null>(null)
  const [localPlaybackRate, setLocalPlaybackRate] = useState(1)
  const engagementRequestRef = useRef<string | null>(null)
  const engagementLoadSequenceRef = useRef(0)
  const reelOptionsRef = useRef<HTMLElement>(null)
  const commentsOpen = controlledCommentsOpen ?? localCommentsOpen
  const setCommentsOpen = (open: boolean) => {
    if (onCommentsOpenChange) onCommentsOpenChange(open)
    else setLocalCommentsOpen(open)
  }

  useEffect(() => {
    if (!engagementEnabled) {
      setLoading(false)
      return
    }
    if (engagementRequestRef.current === contentId) return
    engagementRequestRef.current = contentId
    const sequence = ++engagementLoadSequenceRef.current
    setEngagement({ ...EMPTY_ENGAGEMENT, targetId: contentId })
    setError(null)
    setLoading(true)
    void socialApi.getContentEngagement(contentId)
      .then((value) => {
        if (sequence === engagementLoadSequenceRef.current && value) setEngagement(value)
      })
      .catch(() => {
        if (sequence === engagementLoadSequenceRef.current) setError(t('engagementLoadError'))
      })
      .finally(() => {
        if (sequence === engagementLoadSequenceRef.current) setLoading(false)
      })
  }, [contentId, engagementEnabled, t])

  useEffect(() => {
    setReelOptionsOpen(false)
    setReelSpeedOpen(false)
    setReelPreference(null)
    setLocalPlaybackRate(1)
  }, [contentId])

  useEffect(() => {
    if (!reelOptionsOpen) return
    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!reelOptionsRef.current?.contains(event.target as Node)) {
        setReelOptionsOpen(false)
        setReelSpeedOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setReelOptionsOpen(false)
      setReelSpeedOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [reelOptionsOpen])

  async function toggleLike() {
    setBusy('like')
    setError(null)
    try {
      const next = !engagement.viewerHasLiked
      const success = next
        ? await socialApi.likeContent(viewerId, contentId)
        : await socialApi.unlikeContent(viewerId, contentId)
      if (!success) throw new Error('Action rejected')
      setEngagement((current) => ({ ...current, viewerHasLiked: next, likeCount: Math.max(0, current.likeCount + (next ? 1 : -1)) }))
    } catch {
      setError(t('reactionActionError'))
    } finally {
      setBusy(null)
    }
  }

  async function toggleSave() {
    setBusy('save')
    setError(null)
    try {
      const next = !engagement.viewerHasSaved
      const success = next
        ? await socialApi.saveContent(viewerId, contentId)
        : await socialApi.unsaveContent(viewerId, contentId)
      if (!success) throw new Error('Action rejected')
      setEngagement((current) => ({ ...current, viewerHasSaved: next }))
    } catch {
      setError(t('saveActionError'))
    } finally {
      setBusy(null)
    }
  }

  const counts = {
    likes: loading
      ? '…'
      : engagement.viewerHasLiked
        ? engagement.likeCount > 1 ? t('youAndOthersReacted', { count: engagement.likeCount - 1 }) : t('you')
        : engagement.likeCount,
    comments: loading ? '…' : engagement.commentCount,
    shares: loading ? '…' : engagement.shareCount,
    views: engagement.viewCount,
  }
  const showLikeCount = loading || engagement.likeCount > 0
  const showCommentCount = loading || engagement.commentCount > 0
  const showShareCount = loading || engagement.shareCount > 0
  const showViewCount = post?.__typename === 'ReelDetail' && !loading && engagement.viewCount > 0
  const showEngagementSummary = showLikeCount || showCommentCount || showShareCount || showViewCount
  const reelCounts = {
    likes: loading && engagementEnabled ? '…' : compactReelMetric(engagement.likeCount, locale),
    comments: loading && engagementEnabled ? '…' : compactReelMetric(engagement.commentCount, locale),
    shares: loading && engagementEnabled ? '…' : compactReelMetric(engagement.shareCount, locale),
  }
  const sharingAllowed = canShare && canReshare && (!post?.sharedSource || post.sharedSource.isAvailable)
  const shareSourceId = post?.sharedSource?.isAvailable
    ? post.sharedSource.id
    : contentId
  const effectivePlaybackRate = reelPlaybackRate ?? localPlaybackRate
  const ownedReel = variant === 'reel' && post?.__typename === 'ReelDetail' && post.author.id === viewerId

  function selectPlaybackRate(rate: number) {
    setLocalPlaybackRate(rate)
    onReelPlaybackRateChange?.(rate)
    setReelSpeedOpen(false)
    setReelOptionsOpen(false)
  }

  function navigateFromContentAction(path: string) {
    // Primary destinations are preserved with React Activity. A portal owned by a
    // destination that is about to become hidden does not inherit Activity's hidden
    // wrapper, so commit its close before changing route or its modal/X can linger.
    flushSync(() => {
      setCommentsOpen(false)
      setShareOpen(false)
      setReelOptionsOpen(false)
      setReelSpeedOpen(false)
    })
    onNavigate?.(path)
  }

  function openComments() {
    if (routeComments && onNavigate && commentsPresentation === 'modal' && controlledCommentsOpen === undefined) {
      navigateFromContentAction(contentOverlayHref(contentId))
      return
    }
    setCommentsOpen(true)
  }

  async function copyReelLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(`${window.location.origin}${reelOverlayHref(contentId)}`)
      setReelOptionsOpen(false)
      setReelSpeedOpen(false)
    } catch {
      setError(t('copyLinkError'))
    }
  }

  async function deleteOwnedReel() {
    if (!ownedReel || busy) return
    if (!window.confirm(t('deleteReelConfirm'))) return
    setBusy('delete-reel')
    setError(null)
    try {
      if (!await socialApi.deleteContent(contentId)) throw new Error('Delete rejected')
      setReelOptionsOpen(false)
      setReelSpeedOpen(false)
      onContentDeleted?.(contentId)
    } catch {
      setError(t('deleteReelError'))
    } finally {
      setBusy(null)
    }
  }

  return <>
    {renderActions && (variant === 'post' ? <div className={`content-actions-wrap${showEngagementSummary ? '' : ' no-summary'}`}>
      {showEngagementSummary && <div className="content-engagement-summary">
        {showLikeCount && <span className="content-like-summary"><Icon name="like" size={15} />{counts.likes}</span>}
        {showCommentCount && <span className="content-comment-summary">{counts.comments} {t('comments')}</span>}
        {showShareCount && <span className="content-share-summary">{counts.shares} {t('shares')}</span>}
        {showViewCount && <span className="content-view-summary">{counts.views} {t('views')}</span>}
      </div>}
      <footer className={`gateway-post-actions${canShare ? '' : ' no-share'}`}>
        <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} size={21} />{t('like')}</button>
        <button type="button" onClick={openComments}><Icon name="commentOutline" size={21} />{t('commentAction')}</button>
        {canShare && <button type="button" disabled={!sharingAllowed} aria-disabled={!sharingAllowed} onClick={() => setShareOpen(true)}><Icon name="shareOutline" size={22} />{t('shareAction')}</button>}
      </footer>
      {error && <p className="content-action-error">{error}</p>}
    </div> : <aside ref={reelOptionsRef} className="reel-actions" aria-label={t('reels')}>
      <button type="button" aria-label={t('like')} className={engagement.viewerHasLiked ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} /><span aria-hidden={!loading && engagement.likeCount === 0} className={!loading && engagement.likeCount === 0 ? 'reel-action-count is-empty' : 'reel-action-count'}>{reelCounts.likes}</span></button>
      <button type="button" className={commentsOpen ? 'active' : ''} aria-label={t('commentAction')} aria-expanded={commentsOpen} onClick={() => setCommentsOpen(commentsPresentation === 'sidebar' ? !commentsOpen : true)}><Icon name="commentOutline" /><span aria-hidden={!loading && engagement.commentCount === 0} className={!loading && engagement.commentCount === 0 ? 'reel-action-count is-empty' : 'reel-action-count'}>{reelCounts.comments}</span></button>
      {canShare && <button type="button" className={shareOpen ? 'active' : ''} aria-label={t('shareAction')} disabled={!sharingAllowed} aria-disabled={!sharingAllowed} onClick={() => setShareOpen(true)}><Icon name="shareOutline" /><span aria-hidden={!loading && engagement.shareCount === 0} className={!loading && engagement.shareCount === 0 ? 'reel-action-count is-empty' : 'reel-action-count'}>{reelCounts.shares}</span></button>}
      <button type="button" aria-label={engagement.viewerHasSaved ? t('saved') : t('save')} className={`reel-save-action${engagement.viewerHasSaved ? ' active' : ''}`} disabled={loading || busy != null} onClick={() => void toggleSave()}><Icon name="bookmark" /></button>
      <button type="button" className={`reel-more-action${reelOptionsOpen ? ' active' : ''}`} aria-label={t('more')} aria-expanded={reelOptionsOpen} onClick={() => { setReelOptionsOpen((open) => !open); setReelSpeedOpen(false) }}><Icon name="more" /></button>
      {reelOptionsOpen && !reelSpeedOpen && <div className="reel-options-menu" role="menu" aria-label={t('more')}>
        <button type="button" role="menuitem" className={reelPreference === 'interested' ? 'selected' : ''} onClick={() => { setReelPreference('interested'); setReelOptionsOpen(false) }}><ReelPreferenceIcon kind="plus" /><span>{t('interested')}</span></button>
        <button type="button" role="menuitem" className={reelPreference === 'not-interested' ? 'selected' : ''} onClick={() => { setReelPreference('not-interested'); setReelOptionsOpen(false) }}><ReelPreferenceIcon kind="minus" /><span>{t('notInterested')}</span></button>
        <button type="button" role="menuitem" onClick={() => void copyReelLink()}><Icon name="link" size={21} /><span>{t('copyLink')}</span></button>
        <button type="button" role="menuitem" aria-expanded="false" onClick={() => setReelSpeedOpen(true)}><ReelPlaybackSpeedIcon /><span>{t('videoPlaybackSpeed')}</span><strong>{effectivePlaybackRate}x</strong><ReelMenuChevron /></button>
        {ownedReel && <button type="button" role="menuitem" className="reel-delete-option" disabled={busy === 'delete-reel'} onClick={() => void deleteOwnedReel()}><Icon name="trash" size={21} /><span>{t('deleteReel')}</span></button>}
      </div>}
      {reelOptionsOpen && reelSpeedOpen && <div className="reel-options-menu reel-speed-panel" role="menu" aria-label={t('videoPlaybackSpeed')}>
        <button type="button" className="reel-speed-back" aria-label={t('back')} onClick={() => setReelSpeedOpen(false)}><ReelMenuChevron direction="left" /><span>{t('videoPlaybackSpeed')}</span><strong>{effectivePlaybackRate}x</strong></button>
        <div className="reel-speed-menu">
          {[.5, .75, 1, 1.25, 1.5, 2].map((rate) => <button type="button" role="menuitemradio" aria-checked={effectivePlaybackRate === rate} className={effectivePlaybackRate === rate ? 'selected' : ''} key={rate} onClick={() => selectPlaybackRate(rate)}><span>{rate}x</span>{effectivePlaybackRate === rate && <Icon name="check" size={16} />}</button>)}
        </div>
      </div>}
    </aside>)}
    {renderComments && commentsOpen && (commentsPresentation === 'sidebar' ? <aside className="reels-comments-sidebar" aria-label={t('comments')}><PostDetailCommentsModal key={`${viewerId}:${contentId}`} variant="photo-sidebar" viewerId={viewerId} targetId={contentId} post={post} engagement={engagement} likeBusy={busy === 'like'} canShare={canShare} shareDisabled={!sharingAllowed} onToggleLike={toggleLike} onShare={() => { setCommentsOpen(false); setShareOpen(true) }} onClose={() => setCommentsOpen(false)} onNavigate={navigateFromContentAction} onOpenImage={onOpenImage ? (detailPost, media, index, initialPlaybackTime) => { setCommentsOpen(false); onOpenImage(detailPost, media, index, initialPlaybackTime) } : undefined} onOpenReel={onOpenReel ? (detailPost) => { setCommentsOpen(false); onOpenReel(detailPost) } : undefined} onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))} /></aside> : <PostDetailCommentsModal key={`${viewerId}:${contentId}`} viewerId={viewerId} targetId={contentId} post={post} engagement={engagement} likeBusy={busy === 'like'} canShare={canShare} shareDisabled={!sharingAllowed} onToggleLike={toggleLike} onShare={() => { setCommentsOpen(false); setShareOpen(true) }} onClose={() => setCommentsOpen(false)} onNavigate={navigateFromContentAction} onOpenImage={onOpenImage ? (detailPost, media, index, initialPlaybackTime) => { setCommentsOpen(false); onOpenImage(detailPost, media, index, initialPlaybackTime) } : undefined} onOpenReel={onOpenReel ? (detailPost) => { setCommentsOpen(false); onOpenReel(detailPost) } : undefined} onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))} />)}
    {sharingAllowed && shareOpen && <ShareModal viewerId={viewerId} sourceId={shareSourceId} canReshare initialPreview={post?.sharedSource?.isAvailable ? post.sharedSource : null} allowStory={post?.__typename !== 'GroupPostDetail' && post?.sharedSource?.type !== 1 && post?.sharedSource?.type !== 3} onClose={() => setShareOpen(false)} onNavigate={navigateFromContentAction} onMessage={onMessage} onStoryCreated={onStoryCreated} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />}
  </>
}

export function ContentDetailOverlay({ viewerId, contentId, initialPost, routeOwned = false, onClose, onNavigate, onMessage, onStoryCreated, onOpenImage, onOpenReel }: {
  viewerId: string
  contentId: string
  initialPost?: GatewayPost
  routeOwned?: boolean
  onClose: () => void
  onNavigate?: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
  onStoryCreated?: (story: SharedStory) => void
  onOpenImage?: (post: GatewayPost, media: GatewayMedia, index: number, initialPlaybackTime?: number) => void
  onOpenReel?: (post: GatewayReelPost) => void
}) {
  useBodyInteractionLock(true, ['content-detail-open'])
  const usableInitialPost = initialPost?.id === contentId ? initialPost : null
  const [post, setPost] = useState<GatewayPost | null>(usableInitialPost)
  const [engagement, setEngagement] = useState<ContentEngagement>({ ...EMPTY_ENGAGEMENT, targetId: contentId })
  const [loading, setLoading] = useState(!usableInitialPost)
  const [loadError, setLoadError] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  function navigateFromDetail(path: string) {
    // The parent route owns this overlay. Navigating in one history operation
    // avoids a close-then-open race that briefly reveals a different page.
    if (routeOwned && onNavigate) onNavigate(path)
    else {
      flushSync(onClose)
      onNavigate?.(path)
    }
  }

  useEffect(() => {
    let active = true
    setPost(usableInitialPost)
    setLoading(!usableInitialPost)
    setLoadError(false)
    void socialApi.getContentEngagement(contentId).then((nextEngagement) => {
      if (active && nextEngagement) setEngagement(nextEngagement)
    }).catch(() => undefined)
    api.postDetail(contentId).then((detail) => {
      if (!active) return
      setPost(detail)
      setLoadError(!detail)
    }).catch(() => {
      if (active && !usableInitialPost) setLoadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [contentId, usableInitialPost])

  async function toggleLike() {
    const next = !engagement.viewerHasLiked
    setLikeBusy(true)
    try {
      const success = next
        ? await socialApi.likeContent(viewerId, contentId)
        : await socialApi.unlikeContent(viewerId, contentId)
      if (!success) throw new Error('Action rejected')
      setEngagement((current) => ({ ...current, viewerHasLiked: next, likeCount: Math.max(0, current.likeCount + (next ? 1 : -1)) }))
    } catch {
      // Keep the current engagement state when the source post rejects the action.
    } finally {
      setLikeBusy(false)
    }
  }

  if (loading) {
    return <>
      {!routeOwned && <ContentDetailShellClose onClose={onClose} />}
      <div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation" onClick={onClose}><span className="spinner" /></div>
    </>
  }
  if (loadError || !post) {
    return <UnavailableContentDetail viewerId={viewerId} renderShellClose={!routeOwned} onClose={onClose} />
  }

  const canShare = true
  const canReshare = !post.sharedSource || post.sharedSource.isAvailable
  const shareSourceId = post.sharedSource?.isAvailable
    ? post.sharedSource.id
    : post.id

  if (shareOpen && canReshare) {
    return <ShareModal viewerId={viewerId} sourceId={shareSourceId} canReshare initialPreview={post.sharedSource?.isAvailable ? post.sharedSource : null} allowStory={post.__typename !== 'GroupPostDetail' && post.sharedSource?.type !== 1 && post.sharedSource?.type !== 3} onClose={() => setShareOpen(false)} onNavigate={navigateFromDetail} onMessage={onMessage} onStoryCreated={onStoryCreated} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />
  }

  return <PostDetailCommentsModal
    viewerId={viewerId}
    targetId={post.id}
    post={post}
    engagement={engagement}
    likeBusy={likeBusy}
    canShare={canShare}
    shareDisabled={!canReshare}
    onToggleLike={toggleLike}
    onShare={() => setShareOpen(true)}
    onClose={onClose}
    onNavigate={navigateFromDetail}
    onPostChanged={setPost}
    onOpenImage={onOpenImage ? (detailPost, media, index, initialPlaybackTime) => {
      if (!routeOwned) onClose()
      onOpenImage(detailPost, media, index, initialPlaybackTime)
    } : undefined}
    onOpenReel={(detailPost) => {
      if (!routeOwned) onClose()
      if (onOpenReel) onOpenReel(detailPost)
      else if (onNavigate) onNavigate(reelOverlayHref(detailPost.id))
      else onClose()
    }}
    onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))}
    renderShellClose={!routeOwned}
  />
}

function UnavailableContentDetail({ viewerId, renderShellClose, onClose }: { viewerId: string; renderShellClose: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const [viewer, setViewer] = useState<UserSummary | null>(null)

  useEffect(() => {
    let active = true
    socialApi.getProfile(viewerId).then((profile) => {
      if (active && profile) setViewer(profile)
    }).catch(() => undefined)
    return () => { active = false }
  }, [viewerId])

  return <>
    {renderShellClose && <ContentDetailShellClose onClose={onClose} />}
    <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal content-thread-modal unavailable-photo-discussion unavailable-detail-discussion" role="dialog" aria-modal="true" aria-label={t('contentUnavailable')} data-post-unavailable="true" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head content-thread-head"><h2>{t('unavailablePostPlaceholder')}</h2><button type="button" className="icon-circle subtle" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></header>
        <div className="content-thread-scroll unavailable-photo-thread">
          <article className="gateway-post thread-post-preview unavailable-post-preview">
            <header className="feed-post-head">
              <span className="post-author-avatar"><Avatar name={t('fakebookUser')} src={null} size={40} /></span>
              <div className="post-head-copy thread-post-head-copy"><div className="post-head-primary"><span className="post-author-name"><strong><span className="thread-post-primary-name">{t('fakebookUser')}</span></strong></span></div><span className="post-head-meta unavailable-post-meta"><span>{t('unknown')}</span><i>·</i><HoverTooltip label={t('unknown')} className="post-meta-hover post-privacy-hover"><span className="unavailable-post-privacy" aria-label={t('unknown')}><Icon name="info" size={13} /></span></HoverTooltip></span></div>
            </header>
            <p className="gateway-post-content unavailable-post-content">{t('unavailablePostPlaceholder')}</p>
          </article>
          <div className="content-thread-comments empty unavailable-photo-comments"><div className="content-thread-list"><div className="no-comments-state"><span className="no-comments-document" aria-hidden="true"><i /></span><h3>{t('cannotComment')}</h3><p>{t('postCannotBeCommented')}</p></div></div></div>
        </div>
        <form className="comment-compose unavailable-comment-compose" aria-disabled="true" onSubmit={(event) => event.preventDefault()}><div className="comment-compose-row"><div className="comment-compose-avatar-stack"><Avatar name={viewer?.displayName || t('fakebookUser')} src={viewer?.avatarUrl || null} size={32} /></div><div className="comment-compose-box unavailable-comment-compose-box"><div className="mention-compose-field"><textarea rows={1} value="" readOnly disabled aria-label={t('commentFeatureUnavailable')} placeholder={t('commentFeatureUnavailable')} /></div><div className="comment-compose-tools"><div className="comment-compose-tool-list"><button type="button" disabled aria-label={t('feeling')}><Icon name="feeling" size={18} /></button><button type="button" disabled aria-label={t('attachPhoto')}><Icon name="photo" size={18} /></button><button type="button" disabled aria-label={t('stickers')}><Icon name="sticker" size={18} /></button></div><button type="button" disabled aria-label={t('commentFeatureUnavailable')}><span className="unavailable-comment-block-icon"><Icon name="block" size={18} /></span></button></div></div></div></form>
      </section>
    </div>
  </>
}

function SharePrivacyCaret() {
  return <svg className="home-post-privacy-caret" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.2 9.2h9.6c.75 0 1.15.88.64 1.44l-4.72 5.18c-.38.42-1.06.42-1.44 0l-4.72-5.18C6.05 10.08 6.45 9.2 7.2 9.2Z" /></svg>
}

function sharePreviewFromPost(post: GatewayPost | null): SharedPostSource | null {
  if (!post) return null
  if (post.sharedSource?.isAvailable) return post.sharedSource
  return {
    id: post.id,
    isAvailable: true,
    type: post.type,
    content: post.content,
    privacy: post.privacy,
    create: post.create,
    author: {
      id: post.author.id,
      name: post.author.name,
      avatar: post.author.avatar,
      isVerified: post.author.isVerified,
    },
    media: post.media,
    mentions: post.mentions,
    group: post.__typename === 'GroupPostDetail' ? {
      id: post.group.id,
      name: post.group.name,
      avatar: post.group.avatar,
      background: '',
      privacy: post.privacy,
      memberCount: 0,
      viewerIsMember: !post.group.canJoin,
      joinRequestPending: false,
    } : null,
  }
}

export function ShareModal({ viewerId, sourceId, canReshare, allowStory = true, initialPreview = null, onClose, onShared, onNavigate, onMessage, onStoryCreated }: { viewerId: string; sourceId: string; canReshare: boolean; allowStory?: boolean; initialPreview?: SharedPostSource | null; onClose: () => void; onShared: () => void; onNavigate?: (path: string) => void; onMessage?: (profileId: string) => Promise<void>; onStoryCreated?: (story: SharedStory) => void }) {
  const { t, locale } = useI18n()
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState<PostPrivacy>(0)
  const [busy, setBusy] = useState<'feed' | 'story' | 'copy' | 'messenger' | 'group' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<UserSummary | null>(null)
  const [sourcePreview, setSourcePreview] = useState<SharedPostSource | null>(initialPreview)
  const [previewLoading, setPreviewLoading] = useState(!initialPreview)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [messengerOpen, setMessengerOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [conversations, setConversations] = useState<MessengerConversationDto[]>([])
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<SocialGroup[]>([])
  const [destinationGroup, setDestinationGroup] = useState<SocialGroup | null>(null)
  const privacyPickerRef = useRef<HTMLDivElement>(null)
  const privacyOptions: Array<{ value: PostPrivacy; label: string }> = [
    { value: 0, label: t('privacyPublic') },
    { value: 1, label: t('privacyFriendsFollowers') },
    { value: 2, label: t('privacyFriends') },
    { value: 3, label: t('privacyOnlyMe') },
  ]
  const privacyLabel = privacyOptions.find((option) => option.value === privacy)?.label ?? privacyOptions[0].label

  useEffect(() => {
    let active = true
    setPreviewLoading(!initialPreview)
    Promise.all([
      socialApi.getProfile(viewerId).catch(() => null),
      initialPreview ? Promise.resolve(null) : Promise.resolve().then(() => api.postDetail(sourceId)).catch(() => null),
      messengerApi.conversations(viewerId, 50).catch(() => []),
      Promise.all([socialApi.getMemberGroups(viewerId, 50), socialApi.getAdminGroups(viewerId, 50)]).catch(() => []),
    ]).then(([profile, detail, nextConversations, groupPages]) => {
      if (!active) return
      setViewer(profile)
      if (!initialPreview) setSourcePreview(sharePreviewFromPost(detail))
      setConversations(nextConversations)
      const allGroups = Array.isArray(groupPages) ? groupPages.flatMap((page) => page.items) : []
      setGroups([...new Map(allGroups.map((group) => [group.id, group])).values()])
      setPreviewLoading(false)
    })
    return () => { active = false }
  }, [initialPreview, sourceId, viewerId])

  useEffect(() => {
    if (!privacyOpen) return
    const close = (event: PointerEvent) => {
      if (!privacyPickerRef.current?.contains(event.target as Node)) setPrivacyOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [privacyOpen])

  async function share(destination: 'feed' | 'story') {
    setBusy(destination)
    setError(null)
    try {
      if (destination === 'feed') await socialApi.sharePost(viewerId, sourceId, content.trim(), privacy, destinationGroup?.id ?? null)
      else {
        const story = await api.createShareStory(viewerId, sourceId, content.trim())
        rememberOwnUnseenStory(viewerId, story.id)
        onStoryCreated?.(story)
      }
      onShared()
      onClose()
    } catch {
      setError(t('shareActionError'))
    } finally {
      setBusy(null)
    }
  }

  async function copyLink() {
    setBusy('copy')
    setError(null)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(contentUrl)
      onClose()
    } catch {
      setError(t('copyLinkError'))
    } finally {
      setBusy(null)
    }
  }

  async function sendInMessenger() {
    if (selectedConversationIds.size === 0) return
    setBusy('messenger')
    setError(null)
    try {
      const sender = viewer ?? { id: viewerId, username: viewerId, displayName: t('you'), avatarUrl: null }
      const requestedIds = [...selectedConversationIds]
      const settled = await Promise.allSettled(requestedIds.map((conversationId) => messengerApi.sendMessage(conversationId, sender, { body: contentUrl })))
      const failedIds = requestedIds.filter((_, index) => settled[index].status === 'rejected')
      settled.forEach((result) => {
        if (result.status === 'fulfilled') publishMessengerMessageSent(result.value)
      })
      if (failedIds.length > 0) {
        // Keep only failed targets selected. Retrying cannot duplicate links that were
        // already accepted by the other conversations.
        setSelectedConversationIds(new Set(failedIds))
        setError(t('sendInMessengerError'))
        return
      }
      if (requestedIds.length === 1 && onMessage) {
        const selected = conversations.find((conversation) => conversation.id === requestedIds[0])
        const directPerson = selected?.type !== 'GROUP' ? selected?.participants.find((person) => person.id !== viewerId) : null
        if (directPerson) await onMessage(directPerson.id)
      }
      onClose()
    } catch {
      setError(t('sendInMessengerError'))
    } finally {
      setBusy(null)
    }
  }

  const canShareToStory = canReshare && allowStory
  const contentUrl = sourcePreview?.type === 1
    ? `${window.location.origin}/groups/${encodeURIComponent(sourcePreview.group?.id ?? sourceId)}`
    : sourcePreview?.type === 4
      ? `${window.location.origin}${reelOverlayHref(sourceId)}`
      : `${window.location.origin}/content/${encodeURIComponent(sourceId)}`

  function conversationPresentation(conversation: MessengerConversationDto) {
    const other = conversation.participants.find((person) => person.id !== viewerId)
    return conversation.type === 'GROUP'
      ? { name: conversation.title || t('groupConversation'), avatar: conversation.avatarUrl }
      : { name: other?.displayName || t('fakebookUser'), avatar: other?.avatarUrl || null }
  }

  function toggleConversation(conversationId: string) {
    setSelectedConversationIds((current) => {
      const next = new Set(current)
      if (next.has(conversationId)) next.delete(conversationId)
      else next.add(conversationId)
      return next
    })
  }

  return <BodyPortal><div className="modal-backdrop share-post-backdrop" role="presentation" onClick={() => !busy && onClose()}>
    <section className="modal share-post-modal" role="dialog" aria-modal="true" aria-label={t('sharePost')} onClick={(event) => event.stopPropagation()}>
      <header className="modal-head home-post-modal-head share-post-head"><h2>{destinationGroup ? t('shareToGroup') : t('sharePost')}</h2><button type="button" className="icon-circle" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></header>
      <div className="share-post-body">
        <div className="share-post-composer">
          <div className="home-post-author share-post-author">
            <Avatar name={viewer?.displayName || t('fakebookUser')} src={viewer?.avatarUrl || null} size={36} />
            <div><div className="home-post-author-name"><strong>{viewer?.displayName || t('fakebookUser')}<VerifiedBadge verified={viewer?.isVerified} size={13} /></strong>{destinationGroup && <span className="share-destination-name"> → {destinationGroup.name}</span>}</div>{canReshare && !destinationGroup && <div className="home-post-privacy-picker" ref={privacyPickerRef}><button type="button" className="home-post-privacy-control" aria-label={t('privacy')} aria-haspopup="listbox" aria-expanded={privacyOpen} onClick={() => setPrivacyOpen((open) => !open)}><PostPrivacyIcon privacy={privacy} size={14} /><span>{privacyLabel}</span><SharePrivacyCaret /></button>{privacyOpen && <div className="home-post-privacy-menu share-post-privacy-menu" role="listbox" aria-label={t('privacy')}>{privacyOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={privacy === option.value} onClick={() => { setPrivacy(option.value); setPrivacyOpen(false) }}><PostPrivacyIcon privacy={option.value} size={18} /><span>{option.label}</span></button>)}</div>}</div>}{destinationGroup && <span className="share-group-privacy"><PostPrivacyIcon privacy={destinationGroup.privacy === 0 ? 0 : 1} size={14} group />{destinationGroup.privacy === 0 ? t('publicGroup') : t('privateGroup')}</span>}</div>
          </div>
          {canReshare && <div className="share-post-text-field"><textarea className="share-post-textarea" aria-label={t('saySomething')} rows={2} maxLength={INPUT_LIMITS.post} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('saySomething')} /><button type="button" className="share-post-emoji-button" aria-label={t('insertEmoji')} aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}><Icon name="feeling" size={19} /></button>{emojiOpen && <div className="share-post-emoji-menu" role="menu">{SHARE_EMOJIS.map((emoji) => <button type="button" role="menuitem" key={emoji} onClick={() => { setContent((current) => current + emoji); setEmojiOpen(false) }}>{emoji}</button>)}</div>}</div>}
        </div>
        <div className="share-post-preview" aria-busy={previewLoading}>{previewLoading ? <span className="spinner" /> : sourcePreview ? <SharedPostSourceCard source={sourcePreview} locale={locale} onNavigate={onNavigate} /> : <div className="share-post-preview-unavailable"><Icon name="lock" size={22} /><span>{t('contentUnavailable')}</span></div>}</div>
        {messengerOpen && <section className="share-target-picker share-messenger-picker" aria-label={t('sendInMessenger')}><header><strong>{t('sendInMessenger')}</strong><span>{selectedConversationIds.size || ''}</span></header><div className="share-target-list">{conversations.length > 0 ? conversations.map((conversation) => { const presentation = conversationPresentation(conversation); const selected = selectedConversationIds.has(conversation.id); return <button type="button" className={selected ? 'selected' : ''} key={conversation.id} aria-pressed={selected} onClick={() => toggleConversation(conversation.id)}><span className="share-target-avatar"><Avatar name={presentation.name} src={presentation.avatar} size={38} fallback={conversation.type === 'GROUP' ? 'initials' : 'avatar'} /><i><Icon name={selected ? 'check' : 'plus'} size={11} /></i></span><span><strong>{presentation.name}</strong><small>{conversation.type === 'GROUP' ? t('groupConversation') : t('messages')}</small></span></button> }) : <p className="muted">{t('noConversations')}</p>}</div><button type="button" className="btn-primary share-target-send" disabled={busy != null || selectedConversationIds.size === 0} onClick={() => void sendInMessenger()}><Icon name="send" size={17} />{busy === 'messenger' ? t('sending') : t('send')}</button></section>}
        {groupOpen && <section className="share-target-picker share-group-picker" aria-label={t('shareToGroup')}><header><strong>{t('shareToGroup')}</strong></header><div className="share-target-list">{groups.length > 0 ? groups.map((group) => <button type="button" key={group.id} onClick={() => { setDestinationGroup(group); setGroupOpen(false) }}><Avatar name={group.name} src={group.avatarUrl} size={40} fallback="initials" /><span><strong>{group.name}</strong><small>{group.privacy === 0 ? t('publicGroup') : t('privateGroup')} · {t('membersCount', { count: group.memberCount ?? 0 })}</small></span></button>) : <p className="muted">{t('noGroupsYet')}</p>}</div></section>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <footer className="share-post-footer"><div className="share-post-quick-actions"><button type="button" className={messengerOpen ? 'messenger active' : 'messenger'} aria-label={t('sendInMessenger')} title={t('sendInMessenger')} aria-expanded={messengerOpen} disabled={busy != null} onClick={() => { setMessengerOpen((open) => !open); setGroupOpen(false) }}><Icon name="messenger" size={20} /></button>{canShareToStory && <button type="button" className="story" aria-label={t('shareToStory')} title={t('shareToStory')} disabled={busy != null} onClick={() => void share('story')}><Icon name="bookOpen" size={21} /></button>}<button type="button" className="copy" aria-label={t('copyLink')} title={t('copyLink')} disabled={busy != null} onClick={() => void copyLink()}><Icon name="link" size={20} /></button>{canReshare && <button type="button" className={groupOpen || destinationGroup ? 'group active' : 'group'} aria-label={t('shareToGroup')} title={t('shareToGroup')} disabled={busy != null} onClick={() => { setDestinationGroup(null); setGroupOpen((open) => !open); setMessengerOpen(false) }}><GroupMembersIcon size={21} /></button>}</div>{canReshare && <button type="button" className="btn-primary share-now-button" disabled={busy != null} onClick={() => void share('feed')}>{busy === 'feed' ? t('sharing') : destinationGroup ? t('shareToGroup') : t('shareNow')}</button>}</footer>
    </section>
  </div></BodyPortal>
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { messengerApi } from '../api/messenger'
import { socialApi, type ContentEngagement } from '../api/social'
import type { GatewayPost, SharedPostSource, SharedStory } from '../api/gatewayTypes'
import type { UserSummary } from '../api/types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PostDetailCommentsModal } from './PostDetailCommentsModal'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'
import { SharedPostSourceCard } from './SharedPostSourceCard'
import { VerifiedBadge } from './VerifiedBadge'
import { useI18n } from '../i18n'
import { rememberOwnUnseenStory } from '../lib/ownStoryUnseen'

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

export function ContentActions({ viewerId, contentId, post, variant = 'post', canShare = true, canReshare = canShare, onNavigate, onMessage, onStoryCreated }: { viewerId: string; contentId: string; post?: GatewayPost; variant?: 'post' | 'reel'; canShare?: boolean; canReshare?: boolean; onNavigate?: (path: string) => void; onMessage?: (profileId: string) => Promise<void>; onStoryCreated?: (story: SharedStory) => void }) {
  const { t } = useI18n()
  const [engagement, setEngagement] = useState<ContentEngagement>({ ...EMPTY_ENGAGEMENT, targetId: contentId })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const value = await socialApi.getContentEngagement(contentId)
      if (value) setEngagement(value)
    } catch {
      setError(t('engagementLoadError'))
    } finally {
      setLoading(false)
    }
  }, [contentId, t])

  useEffect(() => { void load() }, [load])

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
  const shareSourceId = post?.__typename === 'FeedPostDetail' && post.sharedSource?.isAvailable
    ? post.sharedSource.id
    : contentId

  return <>
    {variant === 'post' ? <div className={`content-actions-wrap${showEngagementSummary ? '' : ' no-summary'}`}>
      {showEngagementSummary && <div className="content-engagement-summary">
        {showLikeCount && <span className="content-like-summary"><Icon name="like" size={15} />{counts.likes}</span>}
        {showCommentCount && <span className="content-comment-summary">{counts.comments} {t('comments')}</span>}
        {showShareCount && <span className="content-share-summary">{counts.shares} {t('shares')}</span>}
        {showViewCount && <span className="content-view-summary">{counts.views} {t('views')}</span>}
      </div>}
      <footer className={`gateway-post-actions${canShare ? '' : ' no-share'}`}>
        <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} size={21} />{t('like')}</button>
        <button type="button" onClick={() => setCommentsOpen(true)}><Icon name="commentOutline" size={21} />{t('commentAction')}</button>
        {canShare && <button type="button" onClick={() => setShareOpen(true)}><Icon name="shareOutline" size={22} />{t('shareAction')}</button>}
      </footer>
      {error && <p className="content-action-error">{error}</p>}
    </div> : <aside className="reel-actions">
      <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} />{showLikeCount && <span>{counts.likes}</span>}</button>
      <button type="button" onClick={() => setCommentsOpen(true)}><Icon name="commentOutline" />{showCommentCount && <span>{counts.comments}</span>}</button>
      {canShare && <button type="button" onClick={() => setShareOpen(true)}><Icon name="shareOutline" />{showShareCount && <span>{counts.shares}</span>}</button>}
      <button type="button" className={engagement.viewerHasSaved ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleSave()}><Icon name="bookmark" /><span>{engagement.viewerHasSaved ? t('saved') : t('save')}</span></button>
    </aside>}
    {commentsOpen && <PostDetailCommentsModal viewerId={viewerId} targetId={contentId} post={post} engagement={engagement} likeBusy={busy === 'like'} canShare={canShare} onToggleLike={toggleLike} onShare={() => { setCommentsOpen(false); setShareOpen(true) }} onClose={() => setCommentsOpen(false)} onNavigate={onNavigate} onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))} />}
    {canShare && shareOpen && <ShareModal viewerId={viewerId} sourceId={shareSourceId} canReshare={canReshare} onClose={() => setShareOpen(false)} onNavigate={onNavigate} onMessage={onMessage} onStoryCreated={onStoryCreated} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />}
  </>
}

export function ContentDetailOverlay({ viewerId, contentId, onClose, onNavigate, onMessage, onStoryCreated }: {
  viewerId: string
  contentId: string
  onClose: () => void
  onNavigate?: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
  onStoryCreated?: (story: SharedStory) => void
}) {
  const { t } = useI18n()
  const [post, setPost] = useState<GatewayPost | null>(null)
  const [engagement, setEngagement] = useState<ContentEngagement>({ ...EMPTY_ENGAGEMENT, targetId: contentId })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    Promise.all([
      api.postDetail(contentId),
      socialApi.getContentEngagement(contentId).catch(() => null),
    ]).then(([detail, nextEngagement]) => {
      if (!active) return
      setPost(detail)
      if (nextEngagement) setEngagement(nextEngagement)
      setLoadError(!detail)
    }).catch(() => {
      if (active) setLoadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [contentId])

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
    return <div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation" onClick={onClose}><span className="spinner" /></div>
  }
  if (loadError || !post) {
    return <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={onClose}><section className="modal shared-detail-error" role="dialog" aria-modal="true" aria-label={t('contentUnavailable')} onClick={(event) => event.stopPropagation()}><button type="button" className="icon-circle subtle" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button><Icon name="lock" size={28} /><strong>{t('contentUnavailable')}</strong></section></div>
  }

  const canShare = post.__typename === 'GroupPostDetail' || post.privacy === 0
  const canReshare = post.__typename !== 'GroupPostDetail' && post.privacy === 0 && (
    post.__typename !== 'FeedPostDetail' || !post.sharedSource || post.sharedSource.isAvailable
  )
  const shareSourceId = post.__typename === 'FeedPostDetail' && post.sharedSource?.isAvailable
    ? post.sharedSource.id
    : post.id

  if (shareOpen) {
    return <ShareModal viewerId={viewerId} sourceId={shareSourceId} canReshare={canReshare} onClose={() => setShareOpen(false)} onNavigate={onNavigate} onMessage={onMessage} onStoryCreated={onStoryCreated} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />
  }

  return <PostDetailCommentsModal
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
  />
}

function SharePrivacyCaret() {
  return <svg className="home-post-privacy-caret" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.2 9.2h9.6c.75 0 1.15.88.64 1.44l-4.72 5.18c-.38.42-1.06.42-1.44 0l-4.72-5.18C6.05 10.08 6.45 9.2 7.2 9.2Z" /></svg>
}

function sharePreviewFromPost(post: GatewayPost | null): SharedPostSource | null {
  if (!post) return null
  if (post.__typename === 'FeedPostDetail' && post.sharedSource?.isAvailable) return post.sharedSource
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
  }
}

export function ShareModal({ viewerId, sourceId, canReshare, onClose, onShared, onNavigate, onMessage, onStoryCreated }: { viewerId: string; sourceId: string; canReshare: boolean; onClose: () => void; onShared: () => void; onNavigate?: (path: string) => void; onMessage?: (profileId: string) => Promise<void>; onStoryCreated?: (story: SharedStory) => void }) {
  const { t, locale } = useI18n()
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState<PostPrivacy>(0)
  const [busy, setBusy] = useState<'feed' | 'story' | 'copy' | null>(null)
  const [messengerBusyId, setMessengerBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [viewer, setViewer] = useState<UserSummary | null>(null)
  const [friends, setFriends] = useState<UserSummary[]>([])
  const [sourcePreview, setSourcePreview] = useState<SharedPostSource | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [messengerOpen, setMessengerOpen] = useState(false)
  const privacyPickerRef = useRef<HTMLDivElement>(null)
  const contentUrl = `${window.location.origin}/content/${encodeURIComponent(sourceId)}`
  const privacyOptions: Array<{ value: PostPrivacy; label: string }> = [
    { value: 0, label: t('privacyPublic') },
    { value: 1, label: t('privacyFriendsFollowers') },
    { value: 2, label: t('privacyFriends') },
    { value: 3, label: t('privacyOnlyMe') },
  ]
  const privacyLabel = privacyOptions.find((option) => option.value === privacy)?.label ?? privacyOptions[0].label

  useEffect(() => {
    let active = true
    setPreviewLoading(true)
    Promise.all([
      socialApi.getProfile(viewerId).catch(() => null),
      socialApi.getRelationProfiles(viewerId, 0, 8).catch(() => []),
      Promise.resolve().then(() => api.postDetail(sourceId)).catch(() => null),
    ]).then(([profile, people, detail]) => {
      if (!active) return
      setViewer(profile)
      setFriends(people)
      setSourcePreview(sharePreviewFromPost(detail))
      setPreviewLoading(false)
    })
    return () => { active = false }
  }, [sourceId, viewerId])

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
    setSuccess(null)
    try {
      if (destination === 'feed') await socialApi.sharePost(viewerId, sourceId, content.trim(), privacy)
      else {
        const story = await api.createShareStory(viewerId, sourceId, content.trim())
        rememberOwnUnseenStory(viewerId, story.id)
        onStoryCreated?.(story)
      }
      onShared()
      setSuccess(destination === 'feed' ? t('sharedToFeed') : t('sharedToStory'))
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
      setSuccess(t('linkCopied'))
    } catch {
      setError(t('copyLinkError'))
    } finally {
      setBusy(null)
    }
  }

  async function sendInMessenger(person: UserSummary) {
    setMessengerBusyId(person.id)
    setError(null)
    setSuccess(null)
    try {
      const conversation = await messengerApi.createDirectConversation(person.id, viewerId)
      await messengerApi.sendMessage(conversation.id, viewer ?? {
        id: viewerId,
        username: viewerId,
        displayName: t('you'),
        avatarUrl: null,
      }, { body: contentUrl })
      setSuccess(t('sentInMessenger', { name: person.displayName }))
      if (onMessage) await onMessage(person.id)
    } catch {
      setError(t('sendInMessengerError'))
    } finally {
      setMessengerBusyId(null)
    }
  }

  return <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={() => !busy && !messengerBusyId && onClose()}>
    <section className="modal share-post-modal" role="dialog" aria-modal="true" aria-label={t('sharePost')} onClick={(event) => event.stopPropagation()}>
      <header className="modal-head home-post-modal-head share-post-head"><h2>{t('sharePost')}</h2><button type="button" className="icon-circle" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></header>
      <div className="share-post-body">
        <div className="share-post-composer">
          <div className="home-post-author share-post-author">
            <Avatar name={viewer?.displayName || t('fakebookUser')} src={viewer?.avatarUrl || null} size={36} />
            <div><div className="home-post-author-name"><strong>{viewer?.displayName || t('fakebookUser')}<VerifiedBadge verified={viewer?.isVerified} size={13} /></strong></div>{canReshare && <div className="home-post-privacy-picker" ref={privacyPickerRef}><button type="button" className="home-post-privacy-control" aria-label={t('privacy')} aria-haspopup="listbox" aria-expanded={privacyOpen} onClick={() => setPrivacyOpen((open) => !open)}><PostPrivacyIcon privacy={privacy} size={14} /><span>{privacyLabel}</span><SharePrivacyCaret /></button>{privacyOpen && <div className="home-post-privacy-menu share-post-privacy-menu" role="listbox" aria-label={t('privacy')}>{privacyOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={privacy === option.value} onClick={() => { setPrivacy(option.value); setPrivacyOpen(false) }}><PostPrivacyIcon privacy={option.value} size={18} /><span>{option.label}</span>{privacy === option.value && <b aria-hidden="true">✓</b>}</button>)}</div>}</div>}</div>
          </div>
          {canReshare && <textarea className="share-post-textarea" aria-label={t('saySomething')} rows={3} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('saySomething')} />}
        </div>
        <div className="share-post-preview" aria-busy={previewLoading}>{previewLoading ? <span className="spinner" /> : sourcePreview ? <SharedPostSourceCard source={sourcePreview} locale={locale} onNavigate={onNavigate} /> : <div className="share-post-preview-unavailable"><Icon name="lock" size={22} /><span>{t('contentUnavailable')}</span></div>}</div>
        {messengerOpen && <section className="share-messenger-picker" aria-label={t('sendInMessenger')}>{friends.length > 0 ? friends.map((person) => <button type="button" key={person.id} aria-label={person.displayName} disabled={messengerBusyId != null || busy != null} onClick={() => void sendInMessenger(person)}><span><Avatar name={person.displayName} src={person.avatarUrl} size={38} />{messengerBusyId === person.id && <i className="spinner" />}</span><small>{person.displayName}</small></button>) : <p className="muted">{t('noFriendsFound')}</p>}</section>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="form-success">{success}</p>}
      </div>
      <footer className="share-post-footer">
        <div className="share-post-quick-actions">
          <button type="button" className={messengerOpen ? 'messenger active' : 'messenger'} aria-label={t('sendInMessenger')} title={t('sendInMessenger')} aria-expanded={messengerOpen} disabled={busy != null || messengerBusyId != null} onClick={() => setMessengerOpen((open) => !open)}><Icon name="messenger" size={20} /></button>
          {canReshare && <button type="button" className="story" aria-label={t('shareToStory')} title={t('shareToStory')} disabled={busy != null || messengerBusyId != null} onClick={() => void share('story')}><Icon name="plus" size={22} /></button>}
          <button type="button" className="copy" aria-label={t('copyLink')} title={t('copyLink')} disabled={busy != null || messengerBusyId != null} onClick={() => void copyLink()}><Icon name="link" size={20} /></button>
          <button type="button" className="group" aria-label={t('shareToGroup')} title={t('shareToGroup')} disabled={busy != null || messengerBusyId != null} onClick={() => { onClose(); onNavigate?.('/groups') }}><Icon name="groups" size={20} /></button>
        </div>
        {canReshare && <button type="button" className="btn-primary share-now-button" disabled={busy != null || messengerBusyId != null} onClick={() => void share('feed')}>{busy === 'feed' ? t('sharing') : t('shareNow')}</button>}
      </footer>
    </section>
  </div>
}

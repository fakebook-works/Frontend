import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import { messengerApi } from '../api/messenger'
import { socialApi, type ContentEngagement, type SocialComment } from '../api/social'
import type { GatewayPost } from '../api/gatewayTypes'
import { Avatar } from './Avatar'
import { GroupPostAvatar } from './GroupPostAvatar'
import { Icon } from './Icon'
import { PostMediaGallery } from './PostMediaGallery'
import { PostOptionsMenu } from './PostOptionsMenu'
import { VerifiedBadge } from './VerifiedBadge'
import { MentionSuggestions } from './MentionSuggestions'
import { useI18n } from '../i18n'
import type { UserSummary } from '../api/types'

const EMPTY_ENGAGEMENT: ContentEngagement = {
  targetId: '',
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  viewerHasLiked: false,
  viewerHasSaved: false,
  viewerHasWatched: false,
}

export function ContentActions({ viewerId, contentId, post, variant = 'post', canShare = true, canReshare = canShare, onNavigate, onMessage }: { viewerId: string; contentId: string; post?: GatewayPost; variant?: 'post' | 'reel'; canShare?: boolean; canReshare?: boolean; onNavigate?: (path: string) => void; onMessage?: (profileId: string) => Promise<void> }) {
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
  }

  return <>
    {variant === 'post' ? <div className="content-actions-wrap">
      <div className="content-engagement-summary"><span><Icon name="like" size={15} />{counts.likes}</span><span>{counts.comments} {t('comments')}</span><span>{counts.shares} {t('shares')}</span></div>
      <footer className={`gateway-post-actions${canShare ? '' : ' no-share'}`}>
        <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} size={21} />{t('like')}</button>
        <button type="button" onClick={() => setCommentsOpen(true)}><Icon name="commentOutline" size={21} />{t('commentAction')}</button>
        {canShare && <button type="button" onClick={() => setShareOpen(true)}><Icon name="shareOutline" size={22} />{t('shareAction')}</button>}
      </footer>
      {error && <p className="content-action-error">{error}</p>}
    </div> : <aside className="reel-actions">
      <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} /><span>{counts.likes}</span></button>
      <button type="button" onClick={() => setCommentsOpen(true)}><Icon name="commentOutline" /><span>{counts.comments}</span></button>
      {canShare && <button type="button" onClick={() => setShareOpen(true)}><Icon name="shareOutline" /><span>{counts.shares}</span></button>}
      <button type="button" className={engagement.viewerHasSaved ? 'active' : ''} disabled={loading || busy != null} onClick={() => void toggleSave()}><Icon name="bookmark" /><span>{engagement.viewerHasSaved ? t('saved') : t('save')}</span></button>
    </aside>}
    {commentsOpen && <CommentsModal viewerId={viewerId} targetId={contentId} post={post} engagement={engagement} likeBusy={busy === 'like'} canShare={canShare} onToggleLike={toggleLike} onShare={() => { setCommentsOpen(false); setShareOpen(true) }} onClose={() => setCommentsOpen(false)} onNavigate={onNavigate} onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))} />}
    {canShare && shareOpen && <ShareModal viewerId={viewerId} sourceId={contentId} canReshare={canReshare} onClose={() => setShareOpen(false)} onNavigate={onNavigate} onMessage={onMessage} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />}
  </>
}

function CommentsModal({ viewerId, targetId, post, engagement, likeBusy, canShare, onToggleLike, onShare, onClose, onNavigate, onCommentCreated }: { viewerId: string; targetId: string; post?: GatewayPost; engagement: ContentEngagement; likeBusy: boolean; canShare: boolean; onToggleLike: () => Promise<void>; onShare: () => void; onClose: () => void; onNavigate?: (path: string) => void; onCommentCreated: () => void }) {
  const { t, locale } = useI18n()
  const [comments, setComments] = useState<SocialComment[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [content, setContent] = useState('')
  const [replyTarget, setReplyTarget] = useState<SocialComment | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [friends, setFriends] = useState<UserSummary[]>([])
  const [viewer, setViewer] = useState<UserSummary | null>(null)
  const [mentions, setMentions] = useState<UserSummary[]>([])

  const load = useCallback(async (nextCursor: string | null = null, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const page = await socialApi.getComments(targetId, 30, nextCursor)
      setComments((current) => append ? [...current, ...page.items] : page.items)
      setCursor(page.endCursor)
      setHasMore(page.hasNextPage)
    } catch {
      setError(t('commentsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t, targetId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    let active = true
    Promise.all([
      socialApi.getRelationProfiles(viewerId, 0, 100).catch(() => []),
      socialApi.getProfile(viewerId).catch(() => null),
    ]).then(([people, profile]) => {
      if (!active) return
      setFriends(people)
      setViewer(profile)
    })
    return () => { active = false }
  }, [viewerId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await socialApi.createComment(viewerId, replyTarget?.id ?? targetId, content.trim())
      const activeMentions = mentions.filter((person) => content.includes(`@${person.displayName}`))
      await Promise.all(activeMentions.map((person) => socialApi.mentionUser(created.id, person.id)))
      if (replyTarget) {
        setComments((current) => current.map((comment) => comment.id === replyTarget.id ? { ...comment, replyCount: comment.replyCount + 1 } : comment))
      } else {
        await load()
        onCommentCreated()
      }
      setContent('')
      setMentions([])
      setReplyTarget(null)
    } catch {
      setError(t('commentCreateError'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleCommentLike(comment: SocialComment) {
    setBusyCommentId(comment.id)
    try {
      const next = !comment.viewerHasLiked
      const success = next
        ? await socialApi.likeContent(viewerId, comment.id)
        : await socialApi.unlikeContent(viewerId, comment.id)
      if (!success) throw new Error('Action rejected')
      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, viewerHasLiked: next, likeCount: Math.max(0, item.likeCount + (next ? 1 : -1)) } : item))
    } catch {
      setError(t('reactionActionError'))
    } finally {
      setBusyCommentId(null)
    }
  }

  return <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="modal content-thread-modal" role="dialog" aria-modal="true" aria-label={t('comments')} onClick={(event) => event.stopPropagation()}>
      <header className="modal-head content-thread-head">
        <h2>{post ? t('postBy', { name: post.author.name }) : t('comments')}</h2>
        <button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="content-thread-scroll">
        {post && <ThreadPostPreview post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} onHidden={onClose} />}
        {post && <div className="thread-post-engagement">
          <div><span><Icon name="like" size={14} />{engagement.likeCount}</span><span>{engagement.commentCount} {t('comments')}</span><span>{engagement.shareCount} {t('shares')}</span></div>
          <nav className={canShare ? 'can-share' : undefined}>
            <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={likeBusy} onClick={() => void onToggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} size={20} />{t('like')}</button>
            <button type="button" onClick={() => document.querySelector<HTMLTextAreaElement>('.content-thread-modal .comment-compose textarea')?.focus()}><Icon name="commentOutline" size={20} />{t('commentAction')}</button>
            {canShare && <button type="button" onClick={onShare}><Icon name="shareOutline" size={21} />{t('shareAction')}</button>}
          </nav>
        </div>}
        <div className="content-thread-comments">
          <div className="content-thread-list">{loading && comments.length === 0 ? <div className="state-card"><span className="spinner" /></div> : comments.length === 0 ? <div className="state-card"><h3>{t('noCommentsYet')}</h3></div> : comments.map((comment) => {
            const created = new Date(comment.createdAt)
            const time = Number.isNaN(created.getTime()) ? comment.createdAt : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)
            return <article className="thread-comment" key={comment.id}><button type="button" className="comment-author" onClick={() => onNavigate?.(`/profile/${comment.author.id}`)}><Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size={40} /></button><div><div className="comment-bubble"><strong>{comment.author.displayName}<VerifiedBadge verified={comment.author.isVerified} /></strong><p>{comment.content}</p></div><div className="comment-meta"><span>{time}</span><button type="button" className={comment.viewerHasLiked ? 'active' : ''} disabled={busyCommentId === comment.id} onClick={() => void toggleCommentLike(comment)}>{t('like')} {comment.likeCount > 0 ? comment.likeCount : ''}</button><button type="button" onClick={() => setReplyTarget(comment)}>{t('reply')}</button>{comment.replyCount > 0 && <span>{t('repliesCount', { count: comment.replyCount })}</span>}</div></div></article>
          })}{hasMore && <button type="button" className="btn-soft load-more-result" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>{loading ? t('loadingMore') : t('seeMore')}</button>}</div>
        </div>
      </div>
      {error && <p className="form-error content-modal-error">{error}</p>}
      <form className="comment-compose" onSubmit={submit}>{replyTarget && <div className="replying-to"><span>{t('replyingTo', { name: replyTarget.author.displayName })}</span><button type="button" onClick={() => setReplyTarget(null)}>{t('cancel')}</button></div>}<div className="comment-compose-row"><Avatar name={viewer?.displayName || t('fakebookUser')} src={viewer?.avatarUrl || null} size={36} /><div className="comment-compose-box"><div className="mention-compose-field"><textarea rows={2} value={content} onChange={(event) => setContent(event.target.value)} placeholder={replyTarget ? t('writeReply') : t('commentAs', { name: viewer?.displayName || t('fakebookUser') })} /><MentionSuggestions text={content} people={friends} onTextChange={setContent} onSelected={(person) => setMentions((current) => current.some((item) => item.id === person.id) ? current : [...current, person])} /></div><div className="comment-compose-tools"><span aria-hidden="true"><Icon name="feeling" size={18} /><Icon name="camera" size={18} /><b>GIF</b><Icon name="gift" size={18} /></span><button type="submit" disabled={busy || !content.trim()} aria-label={t('sendComment')}><Icon name="send" size={19} /></button></div></div></div></form>
    </section>
  </div>
}

function ThreadPostPreview({ post, locale, viewerId, onNavigate, onHidden }: { post: GatewayPost; locale: string; viewerId: string; onNavigate?: (path: string) => void; onHidden: () => void }) {
  const { t } = useI18n()
  const created = new Date(post.create)
  const time = Number.isNaN(created.getTime()) ? post.create : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)
  const isGroup = post.__typename === 'GroupPostDetail'
  return <article className="thread-post-preview">
    <header>
      <button type="button" onClick={() => onNavigate?.(isGroup ? `/groups/${post.group.id}` : `/profile/${post.author.id}`)}>{isGroup ? <GroupPostAvatar groupName={post.group.name} groupAvatar={post.group.avatar || null} userName={post.author.name} userAvatar={post.author.avatar || null} size={42} /> : <Avatar name={post.author.name} src={post.author.avatar || null} size={42} />}</button>
      <div className="thread-post-head-copy">
        <button type="button" onClick={() => onNavigate?.(isGroup ? `/groups/${post.group.id}` : `/profile/${post.author.id}`)}><strong>{isGroup ? post.group.name : post.author.name}{!isGroup && <VerifiedBadge verified={post.author.isVerified} />}</strong></button>
        <span>{isGroup && <><button type="button" onClick={() => onNavigate?.(`/profile/${post.author.id}`)}>{post.author.name}</button><i>·</i></>}{time}</span>
      </div>
      <PostOptionsMenu post={post} viewerId={viewerId} owned={viewerId === post.author.id} onPostHidden={onHidden} />
    </header>
    {post.content && <p>{post.content}</p>}
    <PostMediaGallery media={post.media} />
    {post.__typename === 'FeedPostDetail' && post.sharedSource && <section className="thread-shared-source">
      {post.sharedSource.isAvailable ? <><PostMediaGallery media={post.sharedSource.media} compact controls={false} /><div><strong>{post.sharedSource.author?.name || t('fakebookUser')}</strong>{post.sharedSource.content && <p>{post.sharedSource.content}</p>}</div></> : <p>{t('contentUnavailable')}</p>}
    </section>}
  </article>
}

function ShareModal({ viewerId, sourceId, canReshare, onClose, onShared, onNavigate, onMessage }: { viewerId: string; sourceId: string; canReshare: boolean; onClose: () => void; onShared: () => void; onNavigate?: (path: string) => void; onMessage?: (profileId: string) => Promise<void> }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState(0)
  const [busy, setBusy] = useState<'feed' | 'story' | 'copy' | null>(null)
  const [messengerBusyId, setMessengerBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [viewer, setViewer] = useState<UserSummary | null>(null)
  const [friends, setFriends] = useState<UserSummary[]>([])
  const contentUrl = `${window.location.origin}/content/${encodeURIComponent(sourceId)}`

  useEffect(() => {
    let active = true
    Promise.all([
      socialApi.getProfile(viewerId).catch(() => null),
      socialApi.getRelationProfiles(viewerId, 0, 8).catch(() => []),
    ]).then(([profile, people]) => {
      if (!active) return
      setViewer(profile)
      setFriends(people)
    })
    return () => { active = false }
  }, [viewerId])

  async function share(destination: 'feed' | 'story') {
    setBusy(destination)
    setError(null)
    setSuccess(null)
    try {
      if (destination === 'feed') await socialApi.sharePost(viewerId, sourceId, content.trim(), privacy)
      else await api.createShareStory(viewerId, sourceId, content.trim())
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
      await messengerApi.sendMessage(conversation.id, viewerId, { body: contentUrl })
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
      <header className="modal-head"><h2>{t('sharePost')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header>
      <div className="share-post-body">
        <div className="share-post-identity">
          <Avatar name={viewer?.displayName || t('fakebookUser')} src={viewer?.avatarUrl || null} size={44} />
          <div><strong>{viewer?.displayName || t('fakebookUser')}<VerifiedBadge verified={viewer?.isVerified} size={13} /></strong><span><b>{canReshare ? t('shareToFeed') : t('shareOptions')}</b>{canReshare && <select aria-label={t('privacy')} value={privacy} onChange={(event) => setPrivacy(Number(event.target.value))}><option value={0}>{t('privacyPublic')}</option><option value={1}>{t('privacyFriendsFollowers')}</option><option value={2}>{t('privacyFriends')}</option><option value={3}>{t('privacyOnlyMe')}</option></select>}</span></div>
        </div>
        {canReshare && <><textarea aria-label={t('saySomething')} rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('saySomething')} />
        <button type="button" className="btn-primary share-now-button" disabled={busy != null || messengerBusyId != null} onClick={() => void share('feed')}>{busy === 'feed' ? t('sharing') : t('shareNow')}</button></>}

        {friends.length > 0 && <section className="share-messenger-section">
          <h3>{t('sendInMessenger')}</h3>
          <div>{friends.map((person) => <button type="button" key={person.id} aria-label={person.displayName} disabled={messengerBusyId != null || busy != null} onClick={() => void sendInMessenger(person)}><span><Avatar name={person.displayName} src={person.avatarUrl} size={56} />{messengerBusyId === person.id && <i className="spinner" />}</span><small>{person.displayName}</small></button>)}</div>
        </section>}

        <section className="share-destination-section">
          <h3>{t('shareOptions')}</h3>
          <div>
            {canReshare && <button type="button" disabled={busy != null || messengerBusyId != null} onClick={() => void share('story')}><span><Icon name="plus" /></span><small>{busy === 'story' ? t('sharing') : t('shareToStory')}</small></button>}
            <button type="button" disabled={busy != null || messengerBusyId != null} onClick={() => void copyLink()}><span><Icon name="share" /></span><small>{busy === 'copy' ? t('working') : t('copyLink')}</small></button>
            <button type="button" disabled={busy != null || messengerBusyId != null} onClick={() => { onClose(); onNavigate?.('/groups') }}><span><Icon name="groups" /></span><small>{t('shareToGroup')}</small></button>
          </div>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="form-success">{success}</p>}
      </div>
    </section>
  </div>
}

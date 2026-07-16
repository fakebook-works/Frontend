import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import { socialApi, type ContentEngagement, type SocialComment } from '../api/social'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
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

export function ContentActions({ viewerId, contentId, variant = 'post', onNavigate }: { viewerId: string; contentId: string; variant?: 'post' | 'reel'; onNavigate?: (path: string) => void }) {
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
    likes: loading ? '…' : engagement.likeCount,
    comments: loading ? '…' : engagement.commentCount,
    shares: loading ? '…' : engagement.shareCount,
  }

  return <>
    {variant === 'post' ? <div className="content-actions-wrap">
      <div className="content-engagement-summary"><span><Icon name="like" size={15} />{counts.likes}</span><span>{counts.comments} {t('comments')}</span><span>{counts.shares} {t('shares')}</span></div>
      <footer className="gateway-post-actions">
        <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={busy != null} onClick={() => void toggleLike()}><Icon name="like" size={18} />{engagement.viewerHasLiked ? t('liked') : t('like')}</button>
        <button type="button" onClick={() => setCommentsOpen(true)}><Icon name="comment" size={18} />{t('commentAction')}</button>
        <button type="button" onClick={() => setShareOpen(true)}><Icon name="share" size={18} />{t('shareAction')}</button>
        <button type="button" className={engagement.viewerHasSaved ? 'active' : ''} disabled={busy != null} onClick={() => void toggleSave()} aria-label={engagement.viewerHasSaved ? t('unsave') : t('save')} title={engagement.viewerHasSaved ? t('unsave') : t('save')}><Icon name="bookmark" size={18} /></button>
      </footer>
      {error && <p className="content-action-error">{error}</p>}
    </div> : <aside className="reel-actions">
      <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={busy != null} onClick={() => void toggleLike()}><Icon name="like" /><span>{counts.likes}</span></button>
      <button type="button" onClick={() => setCommentsOpen(true)}><Icon name="comment" /><span>{counts.comments}</span></button>
      <button type="button" onClick={() => setShareOpen(true)}><Icon name="share" /><span>{counts.shares}</span></button>
      <button type="button" className={engagement.viewerHasSaved ? 'active' : ''} disabled={busy != null} onClick={() => void toggleSave()}><Icon name="bookmark" /><span>{engagement.viewerHasSaved ? t('saved') : t('save')}</span></button>
    </aside>}
    {commentsOpen && <CommentsModal viewerId={viewerId} targetId={contentId} onClose={() => setCommentsOpen(false)} onNavigate={onNavigate} onCommentCreated={() => setEngagement((current) => ({ ...current, commentCount: current.commentCount + 1 }))} />}
    {shareOpen && <ShareModal viewerId={viewerId} sourceId={contentId} onClose={() => setShareOpen(false)} onShared={() => setEngagement((current) => ({ ...current, shareCount: current.shareCount + 1 }))} />}
  </>
}

function CommentsModal({ viewerId, targetId, onClose, onNavigate, onCommentCreated }: { viewerId: string; targetId: string; onClose: () => void; onNavigate?: (path: string) => void; onCommentCreated: () => void }) {
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
  useEffect(() => { socialApi.getRelationProfiles(viewerId, 0, 100).then(setFriends).catch(() => setFriends([])) }, [viewerId])

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

  return <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={onClose}><section className="modal content-thread-modal" role="dialog" aria-modal="true" aria-label={t('comments')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('comments')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="content-thread-list">{loading && comments.length === 0 ? <div className="state-card"><span className="spinner" /></div> : comments.length === 0 ? <div className="state-card"><h3>{t('noCommentsYet')}</h3></div> : comments.map((comment) => {
    const created = new Date(comment.createdAt)
    const time = Number.isNaN(created.getTime()) ? comment.createdAt : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)
    return <article className="thread-comment" key={comment.id}><button type="button" className="comment-author" onClick={() => onNavigate?.(`/profile/${comment.author.id}`)}><Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size={40} /></button><div><div className="comment-bubble"><strong>{comment.author.displayName}<VerifiedBadge verified={comment.author.isVerified} /></strong><p>{comment.content}</p></div><div className="comment-meta"><span>{time}</span><button type="button" className={comment.viewerHasLiked ? 'active' : ''} disabled={busyCommentId === comment.id} onClick={() => void toggleCommentLike(comment)}>{t('like')} {comment.likeCount > 0 ? comment.likeCount : ''}</button><button type="button" onClick={() => setReplyTarget(comment)}>{t('reply')}</button>{comment.replyCount > 0 && <span>{t('repliesCount', { count: comment.replyCount })}</span>}</div></div></article>
  })}{hasMore && <button type="button" className="btn-soft load-more-result" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>{loading ? t('loadingMore') : t('seeMore')}</button>}</div>{error && <p className="form-error content-modal-error">{error}</p>}<form className="comment-compose" onSubmit={submit}>{replyTarget && <div className="replying-to"><span>{t('replyingTo', { name: replyTarget.author.displayName })}</span><button type="button" onClick={() => setReplyTarget(null)}>{t('cancel')}</button></div>}<div><div className="mention-compose-field"><input value={content} onChange={(event) => setContent(event.target.value)} placeholder={replyTarget ? t('writeReply') : t('writeComment')} /><MentionSuggestions text={content} people={friends} onTextChange={setContent} onSelected={(person) => setMentions((current) => current.some((item) => item.id === person.id) ? current : [...current, person])} /></div><button type="submit" className="icon-circle" disabled={busy || !content.trim()} aria-label={t('sendComment')}><Icon name="send" /></button></div></form></section></div>
}

function ShareModal({ viewerId, sourceId, onClose, onShared }: { viewerId: string; sourceId: string; onClose: () => void; onShared: () => void }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState(0)
  const [busy, setBusy] = useState<'feed' | 'story' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  return <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><section className="modal compact-form-modal" role="dialog" aria-modal="true" aria-label={t('sharePost')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('sharePost')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body settings-form-grid"><label className="wide"><span>{t('saySomething')}</span><textarea rows={4} value={content} onChange={(event) => setContent(event.target.value)} /></label><label className="wide"><span>{t('privacy')}</span><select value={privacy} onChange={(event) => setPrivacy(Number(event.target.value))}><option value={0}>{t('privacyPublic')}</option><option value={1}>{t('privacyFriends')}</option><option value={2}>{t('privacyOnlyMe')}</option></select></label>{error && <p className="form-error wide">{error}</p>}{success && <p className="form-success wide">{success}</p>}</div><footer className="modal-foot split-actions"><button type="button" className="btn-soft" disabled={busy != null} onClick={() => void share('story')}><Icon name="plus" size={17} />{busy === 'story' ? t('sharing') : t('shareToStory')}</button><button type="button" className="btn-primary" disabled={busy != null} onClick={() => void share('feed')}><Icon name="share" size={17} />{busy === 'feed' ? t('sharing') : t('shareNow')}</button></footer></section></div>
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import type { ContentEngagement, SocialComment } from '../api/social'
import { socialApi } from '../api/social'
import type { GatewayPost, GatewayTaggedUser } from '../api/gatewayTypes'
import type { MediaUpload, UserSummary } from '../api/types'
import { useI18n } from '../i18n'
import { relativeTime } from '../lib/format'
import { applyMentionSelection, reconcileMentionEntities, serializeMentionContent, type MentionEntity } from '../lib/mentions'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { formatPostTimestamp } from '../lib/postTime'
import { Avatar } from './Avatar'
import { GroupPostAvatar } from './GroupPostAvatar'
import { HoverTooltip } from './HoverTooltip'
import { Icon } from './Icon'
import { MentionContent } from './MentionContent'
import { MentionDraftOverlay } from './MentionDraftOverlay'
import { MentionSuggestions } from './MentionSuggestions'
import { PostMediaGallery } from './PostMediaGallery'
import { PostOptionsMenu } from './PostOptionsMenu'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'
import { SharedPostSourceCard } from './SharedPostSourceCard'
import { VerifiedBadge } from './VerifiedBadge'

const COMMENT_EMOJIS = ['😀', '😍', '😂', '🥰', '😎', '🤔', '😢', '😡', '👍', '🎉', '❤️', '🔥']
const COMMENT_VISIBLE_LINES = 8

function resizeCommentTextarea(textarea: HTMLTextAreaElement) {
  const style = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(style.lineHeight) || 20
  const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)
  const maxHeight = lineHeight * COMMENT_VISIBLE_LINES + padding
  textarea.style.height = 'auto'
  const contentHeight = textarea.scrollHeight
  textarea.style.height = `${Math.ceil(Math.min(contentHeight, maxHeight))}px`
  textarea.style.overflowY = contentHeight > maxHeight + 1 ? 'auto' : 'hidden'
}

function ExpandableCommentContent({ content, mentions, onNavigate }: {
  content: string
  mentions?: SocialComment['mentions']
  onNavigate?: (path: string) => void
}) {
  const { t } = useI18n()
  const contentRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  const measure = useCallback(() => {
    const element = contentRef.current
    if (!element || expanded) return
    const next = element.scrollHeight > element.clientHeight + 1
    setOverflowing((current) => current === next ? current : next)
  }, [expanded])

  useLayoutEffect(() => {
    if (expanded) return
    measure()
    const element = contentRef.current
    const observer = element && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (element) observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [content, expanded, measure])

  return <div className={`comment-content-wrap${expanded ? ' expanded' : ''}`}>
    <p ref={contentRef} className={expanded ? '' : 'is-collapsed'}><MentionContent content={content} mentions={mentions} onNavigate={onNavigate} /></p>
    {!expanded && overflowing && <button type="button" className="comment-content-more" aria-expanded="false" onClick={() => setExpanded(true)}>{t('seeMore')}</button>}
    {expanded && <button type="button" className="comment-content-less" aria-expanded="true" onClick={() => setExpanded(false)}>{t('seeLess')}</button>}
  </div>
}

interface ReplyPageState {
  items: SocialComment[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
  loaded: boolean
}

interface CommentLikerState {
  items: UserSummary[]
  loaded: boolean
  loading: boolean
}

export interface PostDetailCommentsModalProps {
  viewerId: string
  targetId: string
  post?: GatewayPost
  engagement: ContentEngagement
  likeBusy: boolean
  canShare: boolean
  onToggleLike: () => Promise<void>
  onShare: () => void
  onClose: () => void
  onNavigate?: (path: string) => void
  onCommentCreated: () => void
}

export function PostDetailCommentsModal({ viewerId, targetId, post, engagement, likeBusy, canShare, onToggleLike, onShare, onClose, onNavigate, onCommentCreated }: PostDetailCommentsModalProps) {
  const { t, locale } = useI18n()
  const [comments, setComments] = useState<SocialComment[]>([])
  const [replyPages, setReplyPages] = useState<Record<string, ReplyPageState>>({})
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [content, setContent] = useState('')
  const [replyTarget, setReplyTarget] = useState<SocialComment | null>(null)
  const [commentImage, setCommentImage] = useState<{ file: File; previewUrl: string } | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)
  const [busyFollowAuthorId, setBusyFollowAuthorId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [friends, setFriends] = useState<UserSummary[]>([])
  const [viewer, setViewer] = useState<UserSummary | null>(null)
  const [commentLikers, setCommentLikers] = useState<Record<string, CommentLikerState>>({})
  const [visibleLikersCommentId, setVisibleLikersCommentId] = useState<string | null>(null)
  const [mentionEntities, setMentionEntities] = useState<MentionEntity[]>([])
  const [mentionCaret, setMentionCaret] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const loadingLikerIdsRef = useRef(new Set<string>())
  const loadedLikerIdsRef = useRef(new Set<string>())

  useLayoutEffect(() => {
    if (textareaRef.current) resizeCommentTextarea(textareaRef.current)
  }, [content])

  useEffect(() => {
    const resize = () => {
      if (textareaRef.current) resizeCommentTextarea(textareaRef.current)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function changeContent(nextContent: string, caret: number) {
    setMentionEntities((current) => reconcileMentionEntities(content, nextContent, current))
    setContent(nextContent)
    setMentionCaret(caret)
  }

  function selectMention(person: UserSummary, mention: Parameters<typeof applyMentionSelection>[1]) {
    const selected = applyMentionSelection(content, mention, person)
    setMentionEntities((current) => [...reconcileMentionEntities(content, selected.text, current), selected.entity])
    setContent(selected.text)
    setMentionCaret(selected.caret)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(selected.caret, selected.caret)
    }, 0)
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const end = textarea?.selectionEnd ?? start
    const next = `${content.slice(0, start)}${emoji}${content.slice(end)}`
    const caret = start + emoji.length
    changeContent(next, caret)
    setEmojiOpen(false)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(caret, caret)
    }, 0)
  }

  function selectCommentImage(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    setCommentImage({ file, previewUrl: URL.createObjectURL(file) })
  }

  function patchComment(commentId: string, update: (comment: SocialComment) => SocialComment) {
    setComments((current) => current.map((comment) => comment.id === commentId ? update(comment) : comment))
    setReplyPages((current) => {
      let changed = false
      const next = { ...current }
      for (const [parentId, page] of Object.entries(current)) {
        let pageChanged = false
        const items = page.items.map((comment) => {
          if (comment.id !== commentId) return comment
          changed = true
          pageChanged = true
          return update(comment)
        })
        if (pageChanged) next[parentId] = { ...page, items }
      }
      return changed ? next : current
    })
  }

  function patchCommentsByAuthor(authorId: string, update: (comment: SocialComment) => SocialComment) {
    setComments((current) => current.map((comment) => comment.author.id === authorId ? update(comment) : comment))
    setReplyPages((current) => {
      let changed = false
      const next = { ...current }
      for (const [parentId, page] of Object.entries(current)) {
        let pageChanged = false
        const items = page.items.map((comment) => {
          if (comment.author.id !== authorId) return comment
          changed = true
          pageChanged = true
          return update(comment)
        })
        if (pageChanged) next[parentId] = { ...page, items }
      }
      return changed ? next : current
    })
  }

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

  async function loadReplies(parentId: string, append = false) {
    const existing = replyPages[parentId]
    if (existing?.loading) return
    const nextCursor = append ? existing?.cursor ?? null : null
    setReplyPages((current) => ({
      ...current,
      [parentId]: {
        items: current[parentId]?.items ?? [],
        cursor: current[parentId]?.cursor ?? null,
        hasMore: current[parentId]?.hasMore ?? false,
        loaded: current[parentId]?.loaded ?? false,
        loading: true,
      },
    }))
    try {
      const page = await socialApi.getComments(parentId, 20, nextCursor)
      setReplyPages((current) => {
        const previousItems = append ? current[parentId]?.items ?? [] : []
        const itemById = new Map(previousItems.map((item) => [item.id, item]))
        page.items.forEach((item) => itemById.set(item.id, item))
        return {
          ...current,
          [parentId]: {
            items: [...itemById.values()],
            cursor: page.endCursor,
            hasMore: page.hasNextPage,
            loaded: true,
            loading: false,
          },
        }
      })
    } catch {
      setReplyPages((current) => ({
        ...current,
        [parentId]: {
          items: current[parentId]?.items ?? [],
          cursor: current[parentId]?.cursor ?? null,
          hasMore: current[parentId]?.hasMore ?? false,
          loaded: current[parentId]?.loaded ?? false,
          loading: false,
        },
      }))
      setError(t('commentsLoadError'))
    }
  }

  function startReply(comment: SocialComment) {
    const name = comment.author.displayName || t('fakebookUser')
    const nextContent = `${name} `
    setReplyTarget(comment)
    setContent(nextContent)
    setMentionEntities([{ userId: comment.author.id, displayName: name, start: 0, end: name.length }])
    setMentionCaret(nextContent.length)
    setEmojiOpen(false)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextContent.length, nextContent.length)
    }, 0)
  }

  function cancelReply() {
    setReplyTarget(null)
    setContent('')
    setMentionEntities([])
    setMentionCaret(0)
  }

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('content-detail-open')
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('content-detail-open')
    }
  }, [])
  useEffect(() => () => {
    if (commentImage) URL.revokeObjectURL(commentImage.previewUrl)
  }, [commentImage])
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
    if (!content.trim() && !commentImage) return
    setBusy(true)
    setError(null)
    let uploaded: MediaUpload | null = null
    let persisted = false
    try {
      if (commentImage) [uploaded] = await api.uploadMediaFiles([commentImage.file])
      await socialApi.createComment(
        viewerId,
        replyTarget?.id ?? targetId,
        serializeMentionContent(content, mentionEntities).trim(),
        uploaded ? { type: 0, url: uploaded.url } : null,
      )
      persisted = true
      onCommentCreated()
      if (replyTarget) {
        patchComment(replyTarget.id, (comment) => ({ ...comment, replyCount: comment.replyCount + 1 }))
        await loadReplies(replyTarget.id)
      } else {
        await load()
      }
      setContent('')
      setMentionEntities([])
      setMentionCaret(0)
      setReplyTarget(null)
      setCommentImage(null)
      setEmojiOpen(false)
    } catch {
      if (uploaded && !persisted) await api.cancelPendingMedia(uploaded).catch(() => undefined)
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
      patchComment(comment.id, (item) => ({ ...item, viewerHasLiked: next, likeCount: Math.max(0, item.likeCount + (next ? 1 : -1)) }))
      loadingLikerIdsRef.current.delete(comment.id)
      loadedLikerIdsRef.current.delete(comment.id)
      setCommentLikers((current) => {
        if (!(comment.id in current)) return current
        const nextState = { ...current }
        delete nextState[comment.id]
        return nextState
      })
      setVisibleLikersCommentId((current) => current === comment.id ? null : current)
    } catch {
      setError(t('reactionActionError'))
    } finally {
      setBusyCommentId(null)
    }
  }

  async function showCommentLikers(comment: SocialComment) {
    if (comment.likeCount <= 0) return
    setVisibleLikersCommentId(comment.id)
    if (loadedLikerIdsRef.current.has(comment.id) || loadingLikerIdsRef.current.has(comment.id)) return

    loadingLikerIdsRef.current.add(comment.id)
    setCommentLikers((current) => ({
      ...current,
      [comment.id]: { items: current[comment.id]?.items ?? [], loaded: false, loading: true },
    }))
    try {
      const page = await socialApi.getLikedUsers(comment.id, 5)
      loadedLikerIdsRef.current.add(comment.id)
      setCommentLikers((current) => ({
        ...current,
        [comment.id]: { items: page.items.slice(0, 5), loaded: true, loading: false },
      }))
    } catch {
      loadedLikerIdsRef.current.add(comment.id)
      setCommentLikers((current) => ({
        ...current,
        [comment.id]: { items: [], loaded: true, loading: false },
      }))
    } finally {
      loadingLikerIdsRef.current.delete(comment.id)
    }
  }

  async function followCommentAuthor(comment: SocialComment) {
    const authorId = comment.author.id
    if (!comment.canFollowAuthor || authorId === viewerId || busyFollowAuthorId === authorId) return
    setBusyFollowAuthorId(authorId)
    setError(null)
    try {
      const success = await socialApi.followUser(viewerId, authorId)
      if (!success) throw new Error('Follow action rejected')
      patchCommentsByAuthor(authorId, (item) => ({ ...item, canFollowAuthor: false, isFollowingAuthor: true }))
    } catch {
      setError(t('followActionError'))
    } finally {
      setBusyFollowAuthorId(null)
    }
  }

  function renderComment(comment: SocialComment, depth = 0): ReactNode {
    const replies = replyPages[comment.id]
    const showReplyLoader = comment.replyCount > 0 && !replies?.loaded
    const hasLoadedReplies = Boolean(replies?.loaded && replies.items.length > 0)
    const likerState = commentLikers[comment.id]
    const remainingLikerCount = Math.max(0, comment.likeCount - (likerState?.items.length ?? 0))
    const likerTooltipId = `comment-likers-${comment.id}`
    const showLikerTooltip = visibleLikersCommentId === comment.id && comment.likeCount > 0 && (!likerState?.loaded || likerState.items.length > 0)
    const commentTimestamp = formatPostTimestamp(comment.createdAt, locale)
    return <div className={`thread-comment-node${depth > 0 ? ' is-reply' : ''}${hasLoadedReplies ? ' has-children' : ''}`} key={comment.id} data-depth={depth}>
      <article className="thread-comment">
        <button type="button" className="comment-author" onClick={() => onNavigate?.(`/profile/${comment.author.id}`)}><Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size={depth === 0 ? 34 : 30} /></button>
        <div className="thread-comment-copy">
          <div className="comment-bubble">
            <div className="comment-heading">
              <strong>{comment.author.displayName}<VerifiedBadge verified={comment.author.isVerified} size={12} /></strong>
              {comment.canFollowAuthor && comment.author.id !== viewerId && <button type="button" className="comment-follow-action" disabled={busyFollowAuthorId === comment.author.id} onClick={() => void followCommentAuthor(comment)}>{t('follow')}</button>}
              <HoverTooltip label={commentTimestamp.detail} className="comment-time-hover"><time dateTime={comment.createdAt}>{relativeTime(comment.createdAt, locale)}</time></HoverTooltip>
            </div>
            {comment.content && <ExpandableCommentContent content={comment.content} mentions={comment.mentions} onNavigate={onNavigate} />}
          </div>
          {comment.media && <div className="comment-media"><img src={comment.media.url} alt="" /></div>}
          <div className="comment-meta">
            <button type="button" className={`comment-like-action${comment.viewerHasLiked ? ' active' : ''}`} aria-label={t('like')} aria-pressed={comment.viewerHasLiked} disabled={busyCommentId === comment.id} onClick={() => void toggleCommentLike(comment)}><Icon name={comment.viewerHasLiked ? 'like' : 'likeOutline'} size={15} /></button>
            <button type="button" className="comment-reply-action" onClick={() => startReply(comment)}>{t('reply')}</button>
            {comment.likeCount > 0 && <div
              className="comment-like-summary"
              role="group"
              tabIndex={0}
              aria-label={`${comment.likeCount} ${t('like')}`}
              aria-describedby={showLikerTooltip ? likerTooltipId : undefined}
              onMouseEnter={() => void showCommentLikers(comment)}
              onMouseLeave={() => setVisibleLikersCommentId((current) => current === comment.id ? null : current)}
              onFocusCapture={() => void showCommentLikers(comment)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setVisibleLikersCommentId((current) => current === comment.id ? null : current)
                }
              }}
            >
              <span className="comment-like-count"><Icon name="like" size={14} />{comment.likeCount}</span>
              {showLikerTooltip && <div id={likerTooltipId} className="comment-likers-tooltip" role="tooltip">
                {!likerState || likerState.loading
                  ? <span className="comment-likers-loading">...</span>
                  : <>{likerState.items.map((person) => <button type="button" key={person.id} onClick={() => onNavigate?.(`/profile/${person.id}`)}>{person.displayName}</button>)}{remainingLikerCount > 0 && <span>{t('taggedAnd')} {t('taggedOthers', { count: remainingLikerCount })}</span>}</>}
              </div>}
            </div>}
          </div>
          {showReplyLoader && <button type="button" className="thread-replies-toggle" disabled={replies?.loading} onClick={() => void loadReplies(comment.id)}><svg className="thread-replies-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" /></svg>{replies?.loading ? t('loadingComments') : t('viewReplies', { count: comment.replyCount })}</button>}
        </div>
      </article>
      {hasLoadedReplies && <div className="thread-comment-children">
        {replies.items.map((reply, index) => <div className={`thread-comment-child${index === replies.items.length - 1 ? ' is-last' : ''}`} key={reply.id}><span className="thread-comment-branch" aria-hidden="true" />{renderComment(reply, depth + 1)}</div>)}
        {replies.hasMore && <button type="button" className="thread-replies-toggle more" disabled={replies.loading || !replies.cursor} onClick={() => void loadReplies(comment.id, true)}>{replies.loading ? t('loadingMore') : t('seeMoreReplies')}</button>}
      </div>}
    </div>
  }

  const showLikeCount = engagement.likeCount > 0
  const showCommentCount = engagement.commentCount > 0
  const showShareCount = engagement.shareCount > 0
  const showViewCount = post?.__typename === 'ReelDetail' && engagement.viewCount > 0
  const showEngagementSummary = showLikeCount || showCommentCount || showShareCount || showViewCount
  const showEmptyComments = !loading && comments.length === 0

  return <>
    {createPortal(<button type="button" className="content-detail-shell-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={24} /></button>, document.body)}
    <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal content-thread-modal" role="dialog" aria-modal="true" aria-label={t('comments')} onClick={(event) => event.stopPropagation()}>
        <header className="modal-head content-thread-head">
          <h2>{post ? t('postBy', { name: post.author.name }) : t('comments')}</h2>
          <button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="content-thread-scroll">
          {post && <ThreadPostPreview post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} onHidden={onClose} />}
          {post && <div className={`content-actions-wrap thread-post-engagement${showEngagementSummary ? '' : ' no-summary'}${post.__typename === 'FeedPostDetail' && post.sharedSource ? ' has-shared-source' : ''}`}>
            {showEngagementSummary && <div className="content-engagement-summary">
              {showLikeCount && <span className="content-like-summary"><Icon name="like" size={15} />{engagement.likeCount}</span>}
              {showCommentCount && <span className="content-comment-summary">{engagement.commentCount} {t('comments')}</span>}
              {showShareCount && <span className="content-share-summary">{engagement.shareCount} {t('shares')}</span>}
              {showViewCount && <span className="content-view-summary">{engagement.viewCount} {t('views')}</span>}
            </div>}
            <nav className={`gateway-post-actions${canShare ? '' : ' no-share'}`}>
              <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={likeBusy} onClick={() => void onToggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} size={21} />{t('like')}</button>
              <button type="button" onClick={() => textareaRef.current?.focus()}><Icon name="commentOutline" size={21} />{t('commentAction')}</button>
              {canShare && <button type="button" onClick={onShare}><Icon name="shareOutline" size={22} />{t('shareAction')}</button>}
            </nav>
          </div>}
          <div className={`content-thread-comments${showEmptyComments ? ' empty' : ''}`}>
            <div className="content-thread-list">{loading && comments.length === 0 ? <div className="state-card"><span className="spinner" /></div> : comments.length === 0 ? <div className="no-comments-state">
              <span className="no-comments-document" aria-hidden="true"><i /></span>
              <h3>{t('noCommentsYet')}</h3>
              <p>{t('beFirstToComment')}</p>
            </div> : comments.map((comment) => renderComment(comment))}{hasMore && <button type="button" className="btn-soft load-more-result" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>{loading ? t('loadingMore') : t('seeMore')}</button>}</div>
          </div>
        </div>
        {error && <p className="form-error content-modal-error">{error}</p>}
        <form className="comment-compose" onSubmit={submit}>
          {replyTarget && <div className="replying-to"><span>{t('replyingTo', { name: replyTarget.author.displayName })}</span><button type="button" onClick={cancelReply}>{t('cancel')}</button></div>}
          <div className="comment-compose-row">
            <Avatar name={viewer?.displayName || t('fakebookUser')} src={viewer?.avatarUrl || null} size={32} />
            <div className="comment-compose-box">
              <div className="mention-compose-field"><MentionDraftOverlay text={content} entities={mentionEntities} textareaRef={textareaRef} /><textarea ref={textareaRef} rows={1} value={content} onChange={(event) => changeContent(event.target.value, event.target.selectionStart ?? event.target.value.length)} onSelect={(event) => setMentionCaret(event.currentTarget.selectionStart ?? content.length)} placeholder={replyTarget ? t('writeReply') : t('commentAs', { name: viewer?.displayName || t('fakebookUser') })} /><MentionSuggestions text={content} people={friends} textareaRef={textareaRef} caretIndex={mentionCaret} onSelected={selectMention} /></div>
              {commentImage && <div className="comment-image-preview"><img src={commentImage.previewUrl} alt="" /><button type="button" aria-label={t('removeMedia')} onClick={() => setCommentImage(null)}><Icon name="close" size={14} /></button></div>}
              <div className="comment-compose-tools">
                <div className="comment-compose-tool-list">
                  <div className="comment-emoji-wrap"><button type="button" aria-label={t('feeling')} title={t('feeling')} aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}><Icon name="feeling" size={18} /></button>{emojiOpen && <div className="comment-emoji-menu" role="menu">{COMMENT_EMOJIS.map((emoji) => <button key={emoji} type="button" role="menuitem" aria-label={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}</div>
                  <label aria-label={t('attachPhoto')} title={t('attachPhoto')}><Icon name="photo" size={18} /><input type="file" accept="image/*" onChange={(event) => { selectCommentImage(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>
                  <button type="button" aria-label={t('stickers')} title={t('stickers')}><Icon name="sticker" size={18} /></button>
                </div>
                <button type="submit" disabled={busy || (!content.trim() && !commentImage)} aria-label={t('sendComment')}><Icon name="send" size={19} /></button>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  </>
}

function ThreadPostPreview({ post, locale, viewerId, onNavigate, onHidden }: { post: GatewayPost; locale: string; viewerId: string; onNavigate?: (path: string) => void; onHidden: () => void }) {
  const { t } = useI18n()
  const timestamp = formatPostTimestamp(post.create, locale)
  const isGroup = post.__typename === 'GroupPostDetail'
  const privacy: PostPrivacy = post.privacy === 1 || post.privacy === 2 || post.privacy === 3 ? post.privacy : 0
  const privacyLabel = privacy === 0 ? t('privacyPublic') : privacy === 1 ? t('privacyFriendsFollowers') : privacy === 2 ? t('privacyFriends') : t('privacyOnlyMe')
  const taggedUsers = post.__typename === 'FeedPostDetail' ? (post.taggedUsers ?? []).filter((person) => person.id !== post.author.id) : []
  const decodedContent = decodePostContent(post.content)
  const postBackground = post.media.length === 0 ? getPostBackgroundPreset(decodedContent.backgroundId) : null
  const hasSharedSource = post.__typename === 'FeedPostDetail' && Boolean(post.sharedSource)
  const openPrimary = () => onNavigate?.(isGroup ? `/groups/${post.group.id}` : `/profile/${post.author.id}`)
  return <article className={`gateway-post thread-post-preview${hasSharedSource ? ' has-shared-source' : ''}`}>
    <header className={isGroup ? 'group-feed-post-head' : 'feed-post-head'}>
      <button type="button" className="post-author-avatar" onClick={openPrimary}>{isGroup ? <GroupPostAvatar groupName={post.group.name} groupAvatar={post.group.avatar || null} userName={post.author.name} userAvatar={post.author.avatar || null} size={42} /> : <Avatar name={post.author.name} src={post.author.avatar || null} size={42} />}</button>
      <div className="post-head-copy thread-post-head-copy">
        <div className="post-head-primary">
          {isGroup ? <button type="button" className="post-group-link" onClick={openPrimary}><strong>{post.group.name}</strong></button> : <button type="button" className="post-author-name" onClick={openPrimary}><strong>{post.author.name}<VerifiedBadge verified={post.author.isVerified} /></strong></button>}
          <ThreadTaggedUsers users={taggedUsers} onNavigate={onNavigate} />
        </div>
        <span className="post-head-meta">
          {isGroup && <><button type="button" className="post-meta-author" onClick={() => onNavigate?.(`/profile/${post.author.id}`)}>{post.author.name}<VerifiedBadge verified={post.author.isVerified} size={12} /></button><i>·</i></>}
          <HoverTooltip label={timestamp.detail} className="post-meta-hover post-time-hover"><time dateTime={post.create}>{timestamp.display}</time></HoverTooltip>
          <i>·</i>
          <HoverTooltip label={privacyLabel} className="post-meta-hover post-privacy-hover"><span aria-label={privacyLabel}><PostPrivacyIcon privacy={privacy} size={13} /></span></HoverTooltip>
        </span>
      </div>
      <PostOptionsMenu post={post} viewerId={viewerId} owned={viewerId === post.author.id} onPostHidden={onHidden} />
    </header>
    {decodedContent.text && <p className={`gateway-post-content${postBackground ? ' has-background' : ''}`} style={postBackground ? { background: postBackground.background } : undefined}><MentionContent content={decodedContent.text} mentions={post.mentions} onNavigate={onNavigate} /></p>}
    <PostMediaGallery media={post.media} />
    {post.__typename === 'FeedPostDetail' && post.sharedSource && <SharedPostSourceCard source={post.sharedSource} locale={locale} onNavigate={onNavigate} />}
  </article>
}

function ThreadTaggedUsers({ users, onNavigate }: { users: GatewayTaggedUser[]; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  if (users.length === 0) return null
  const shown = users.slice(0, 2)
  const remaining = users.length - shown.length
  return <span className="post-tagged-users">
    <span>{t('taggedWithPrefix')} </span>
    {shown.map((user, index) => <span key={user.id}>{index > 0 && (users.length === 2 ? ` ${t('taggedAnd')} ` : ', ')}<button type="button" onClick={() => onNavigate?.(`/profile/${user.id}`)}>{user.name}<VerifiedBadge verified={user.isVerified} size={12} /></button></span>)}
    {remaining > 0 && <span> {t('taggedAnd')} {t('taggedOthers', { count: remaining })}</span>}
  </span>
}

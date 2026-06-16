import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { CommentDto, PostDto } from '../api/types'
import { PRIVACY, firstName, privacyMeta, reactionMeta, REACTIONS, timeAgo } from '../lib/format'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { useI18n } from '../i18n'

interface PostCardProps {
  post: PostDto
  currentUserId: string
  onChange: (post: PostDto) => void
  onDelete: (id: string) => void
  onShared: (post: PostDto) => void
  onOpenProfile: (userId: string) => void
}

/** Content longer than this is clamped behind a "See more" toggle. */
const LONG_CONTENT = 320
/** Short text-only posts render with larger type, like Facebook. */
const SHORT_TEXT = 80
const REACTION_LABEL_KEYS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const

export function PostCard({ post, currentUserId, onChange, onDelete, onShared, onOpenProfile }: PostCardProps) {
  const { t } = useI18n()
  const mine = post.author.id === currentUserId
  const my = reactionMeta(post.myReaction)
  const privacy = privacyMeta(post.privacy)

  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.content)
  const [editPrivacy, setEditPrivacy] = useState(post.privacy)
  const [savingEdit, setSavingEdit] = useState(false)

  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<CommentDto[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  const [expanded, setExpanded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const pickerTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (pickerTimer.current) window.clearTimeout(pickerTimer.current)
    },
    [],
  )

  async function applyReaction(target: number | null) {
    setPickerOpen(false)
    const prev = post.myReaction
    if (prev === target) return

    const delta = (target === null ? 0 : 1) - (prev === null ? 0 : 1)
    onChange({ ...post, myReaction: target, reactionCount: Math.max(0, post.reactionCount + delta) })

    try {
      if (target === null) await api.unreact(post.id)
      else await api.react(post.id, target)
    } catch {
      onChange(post) // revert on failure
    }
  }

  function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && !commentsLoaded && !loadingComments) {
      setLoadingComments(true)
      api
        .comments(post.id)
        .then((list) => {
          setComments(list)
          setCommentsLoaded(true)
        })
        .catch(() => undefined)
        .finally(() => setLoadingComments(false))
    }
  }

  async function submitComment() {
    const text = commentText.trim()
    if (!text) return
    setCommentText('')
    try {
      const created = await api.addComment(post.id, text)
      setComments((prev) => [...prev, created])
      setCommentsLoaded(true)
      onChange({ ...post, commentCount: post.commentCount + 1 })
    } catch {
      setCommentText(text)
    }
  }

  async function saveEdit() {
    const content = editText.trim()
    if (!content && !post.imageUrl) return
    setSavingEdit(true)
    try {
      const updated = await api.updatePost(post.id, {
        content,
        imageUrl: post.imageUrl,
        mediaType: post.mediaType,
        privacy: editPrivacy,
      })
      onChange(updated)
      setEditing(false)
    } catch {
      /* keep editor open on failure */
    } finally {
      setSavingEdit(false)
    }
  }

  async function remove() {
    setMenuOpen(false)
    if (!window.confirm(t('deletePostConfirm'))) return
    try {
      await api.deletePost(post.id)
      onDelete(post.id)
    } catch {
      /* ignore */
    }
  }

  async function submitShare() {
    setShareBusy(true)
    try {
      const created = await api.sharePost(post.id, shareMessage.trim() || null)
      onShared(created)
      onChange({ ...post, shareCount: post.shareCount + 1 })
      setSharing(false)
      setShareMessage('')
    } catch {
      /* ignore */
    } finally {
      setShareBusy(false)
    }
  }

  const truncated = !expanded && post.content.length > LONG_CONTENT
  const displayContent = truncated ? post.content.slice(0, LONG_CONTENT).trimEnd() : post.content
  const shortText =
    post.content.length > 0 &&
    post.content.length <= SHORT_TEXT &&
    !post.content.includes('\n') &&
    !post.imageUrl &&
    !post.originalPost
  const reactionLabel = (type: number) => t(REACTION_LABEL_KEYS[type] ?? 'like')

  function openPicker() {
    if (pickerTimer.current) window.clearTimeout(pickerTimer.current)
    setPickerOpen(true)
  }
  function closePickerSoon() {
    if (pickerTimer.current) window.clearTimeout(pickerTimer.current)
    pickerTimer.current = window.setTimeout(() => setPickerOpen(false), 220)
  }

  return (
    <article className="card post">
      <header className="post-head">
        <Avatar
          name={post.author.displayName}
          src={post.author.avatarUrl}
          size={40}
          onClick={() => onOpenProfile(post.author.id)}
        />
        <div className="post-head-meta">
          <button type="button" className="post-author" onClick={() => onOpenProfile(post.author.id)}>
            {post.author.displayName}
          </button>
          <div className="post-sub">
            <span>{timeAgo(post.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <Icon name={privacy.icon} size={12} />
            {post.updatedAt && post.updatedAt !== post.createdAt && <span className="edited">· {t('edited')}</span>}
          </div>
        </div>
        <div className="post-menu-wrap">
          {mine && (
            <button
              type="button"
              className="icon-circle subtle"
              aria-label={t('postOptions')}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name="more" size={20} />
            </button>
          )}
          {menuOpen && mine && (
            <>
              <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
              <div className="dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true)
                    setEditText(post.content)
                    setEditPrivacy(post.privacy)
                    setMenuOpen(false)
                  }}
                >
                  <Icon name="edit" size={18} /> {t('editPost')}
                </button>
                <button type="button" className="danger" onClick={remove}>
                  <Icon name="trash" size={18} /> {t('deletePost')}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {editing ? (
        <div className="post-edit">
          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
          <div className="post-edit-actions">
            <select value={editPrivacy} onChange={(e) => setEditPrivacy(Number(e.target.value))}>
              {PRIVACY.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="grow" />
            <button type="button" className="btn-text" onClick={() => setEditing(false)}>
              {t('cancel')}
            </button>
            <button type="button" className="btn-primary sm" onClick={saveEdit} disabled={savingEdit}>
              {t('save')}
            </button>
          </div>
        </div>
      ) : (
        post.content && (
          <p className={`post-body${shortText ? ' large' : ''}`}>
            {displayContent}
            {truncated && (
              <>
                {'… '}
                <button type="button" className="see-more" onClick={() => setExpanded(true)}>
                  {t('seeMore')}
                </button>
              </>
            )}
          </p>
        )
      )}

      {post.imageUrl && (
        <div className="post-media">
          {post.mediaType === 'video' ? (
            <video src={post.imageUrl} controls preload="metadata" />
          ) : (
            <img src={post.imageUrl} alt="" loading="lazy" />
          )}
        </div>
      )}

      {post.originalPost && (
        <div className="shared-original">
          <header>
            <Avatar name={post.originalPost.author.displayName} src={post.originalPost.author.avatarUrl} size={32} />
            <div>
              <strong>{post.originalPost.author.displayName}</strong>
              <span>{timeAgo(post.originalPost.createdAt)}</span>
            </div>
          </header>
          {post.originalPost.content && <p>{post.originalPost.content}</p>}
          {post.originalPost.imageUrl && (
            <div className="post-media">
              {post.originalPost.mediaType === 'video' ? (
                <video src={post.originalPost.imageUrl} controls preload="metadata" />
              ) : (
                <img src={post.originalPost.imageUrl} alt="" loading="lazy" />
              )}
            </div>
          )}
        </div>
      )}

      {(post.reactionCount > 0 || post.commentCount > 0 || post.shareCount > 0) && (
        <div className="post-stats">
          <div className="stat-reactions">
            {post.reactionCount > 0 && (
              <>
                <span className="reaction-bubble" style={{ background: (my ?? REACTIONS[0]).color }}>
                  {(my ?? REACTIONS[0]).emoji}
                </span>
                <span>{post.reactionCount}</span>
              </>
            )}
          </div>
          <div className="stat-right">
            {post.commentCount > 0 && (
              <button type="button" onClick={toggleComments}>
                {post.commentCount} {post.commentCount === 1 ? t('comment') : t('comments')}
              </button>
            )}
            {post.shareCount > 0 && (
              <span>
                {post.shareCount} {post.shareCount === 1 ? t('share') : t('shares')}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="post-actions">
        <div className="action-cell" onMouseEnter={openPicker} onMouseLeave={closePickerSoon}>
          <button
            type="button"
            className={`action-btn${my ? ' reacted' : ''}`}
            style={my ? { color: my.color } : undefined}
            aria-pressed={my !== null}
            onClick={() => applyReaction(my ? null : 0)}
          >
            {my ? <span className="action-emoji">{my.emoji}</span> : <Icon name="like" size={20} />}
            <span>{my ? reactionLabel(my.type) : t('like')}</span>
          </button>
          {pickerOpen && (
            <div className="reaction-picker" onMouseEnter={openPicker} onMouseLeave={closePickerSoon}>
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  title={reactionLabel(r.type)}
                  className="reaction-option"
                  onClick={() => applyReaction(r.type)}
                >
                  <span>{r.emoji}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="action-btn" onClick={toggleComments}>
          <Icon name="comment" size={20} />
          <span>{t('commentAction')}</span>
        </button>
        <button type="button" className="action-btn" onClick={() => setSharing(true)}>
          <Icon name="share" size={20} />
          <span>{t('shareAction')}</span>
        </button>
      </div>

      {showComments && (
        <div className="comments">
          {loadingComments && <p className="muted small">{t('loadingComments')}</p>}
          {commentsLoaded && comments.length === 0 && !loadingComments && (
            <p className="muted small">{t('noCommentsYet')}</p>
          )}
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar name={c.author.displayName} src={c.author.avatarUrl} size={32} onClick={() => onOpenProfile(c.author.id)} />
              <div className="comment-bubble">
                <button type="button" className="comment-author" onClick={() => onOpenProfile(c.author.id)}>
                  {c.author.displayName}
                </button>
                <p>{c.content}</p>
                <span className="comment-time">{timeAgo(c.createdAt)}</span>
              </div>
            </div>
          ))}
          <div className="comment-compose">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitComment()
                }
              }}
              placeholder={t('writeComment')}
            />
            <button type="button" onClick={submitComment} disabled={!commentText.trim()} aria-label={t('sendComment')}>
              <Icon name="messenger" size={18} />
            </button>
          </div>
        </div>
      )}

      {sharing && (
        <div className="modal-backdrop" role="presentation" onClick={() => !shareBusy && setSharing(false)}>
          <div className="modal share-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h2>{t('sharePost')}</h2>
              <button type="button" className="icon-circle subtle" onClick={() => setSharing(false)} aria-label={t('cancel')}>
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="modal-body">
              <textarea
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                placeholder={t('saySomethingAboutPost', { name: firstName(post.author.displayName) })}
                rows={3}
                autoFocus
              />
              <div className="shared-original compact">
                <header>
                  <Avatar name={post.author.displayName} src={post.author.avatarUrl} size={32} />
                  <strong>{post.author.displayName}</strong>
                </header>
                {post.content && <p>{post.content}</p>}
              </div>
            </div>
            <footer className="modal-foot">
              <button type="button" className="btn-primary block" onClick={submitShare} disabled={shareBusy}>
                {shareBusy ? t('sharing') : t('shareNow')}
              </button>
            </footer>
          </div>
        </div>
      )}
    </article>
  )
}

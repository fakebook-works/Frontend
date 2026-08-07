import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import type { ContentEngagement, SocialComment, SocialCommentEditRevision } from '../api/social'
import { socialApi } from '../api/social'
import type { GatewayMedia, GatewayPost, GatewayTaggedUser, SharedPostSource } from '../api/gatewayTypes'
import type { MediaUpload, UserSummary } from '../api/types'
import { useI18n } from '../i18n'
import { relativeTime } from '../lib/format'
import { clipboardImageFiles } from '../lib/clipboardMedia'
import { applyMentionSelection, deleteMentionAtSelection, parseMentionContent, reconcileMentionEntities, serializeMentionContent, type MentionEntity } from '../lib/mentions'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { formatPostTimestamp } from '../lib/postTime'
import { sharedPostSourceToGatewayReel } from '../lib/reelEntry'
import { clearPrefetchedCommentPage, loadCommentPage, readCachedCommentPage } from '../lib/commentPagePrefetch'
import { useBodyInteractionLock } from '../lib/bodyInteractionLock'
import { reelOverlayHref } from '../lib/overlayRoutes'
import { Avatar } from './Avatar'
import { GroupPostAvatar } from './GroupPostAvatar'
import { HoverTooltip } from './HoverTooltip'
import { PostContent } from './PostContent'
import { Icon } from './Icon'
import { MentionContent } from './MentionContent'
import { LinkPreview } from './LinkPreview'
import { isDirectImageUrl, remoteImageFileFromUrl } from '../lib/urlMedia'
import { MentionDraftOverlay } from './MentionDraftOverlay'
import { MentionSuggestions } from './MentionSuggestions'
import { PostMediaGallery } from './PostMediaGallery'
import { PostOptionsMenu } from './PostOptionsMenu'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'
import { PostPrivacyControl } from './PostPrivacyControl'
import { SharedPostSourceCard } from './SharedPostSourceCard'
import { VerifiedBadge } from './VerifiedBadge'

const COMMENT_EMOJIS = ['😀', '😍', '😂', '🥰', '😎', '🤔', '😢', '😡', '👍', '🎉', '❤️', '🔥']
const COMMENT_VISIBLE_LINES = 8
type GatewayReelPost = Extract<GatewayPost, { __typename: 'ReelDetail' }>

function editableCommentDraft(comment: SocialComment, unavailableName: string): Omit<CommentEditState, 'commentId'> {
  const mentionById = new Map((comment.mentions ?? []).map((mention) => [mention.userId, mention]))
  const entities: MentionEntity[] = []
  let content = ''
  for (const segment of parseMentionContent(comment.content)) {
    if (segment.type === 'text') {
      content += segment.value
      continue
    }
    const mention = mentionById.get(segment.userId)
    const displayName = mention?.available && mention.name ? mention.name : unavailableName
    const start = content.length
    content += displayName
    entities.push({ userId: segment.userId, displayName, start, end: content.length })
  }
  return { content, entities, caret: content.length }
}

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

interface CommentEditState {
  commentId: string
  content: string
  entities: MentionEntity[]
  caret: number
}

interface CommentHistoryState {
  items: SocialCommentEditRevision[]
  loading: boolean
  loaded: boolean
}

const COMMENT_PAGE_LIMIT = 30

export interface PostDetailCommentsModalProps {
  viewerId: string
  targetId: string
  post?: GatewayPost
  engagement: ContentEngagement
  likeBusy: boolean
  canShare: boolean
  shareDisabled?: boolean
  onToggleLike: () => Promise<void>
  onShare: () => void
  onClose: () => void
  onNavigate?: (path: string) => void
  onOpenImage?: (post: GatewayPost, media: GatewayMedia, index: number, initialPlaybackTime?: number) => void
  onOpenReel?: (post: GatewayReelPost) => void
  onCommentCreated: () => void
  onPostChanged?: (post: GatewayPost) => void
  variant?: 'modal' | 'photo-sidebar'
}

export function PostDetailCommentsModal({ viewerId, targetId, post, engagement, likeBusy, canShare, shareDisabled = false, onToggleLike, onShare, onClose, onNavigate, onOpenImage, onOpenReel, onCommentCreated, onPostChanged, variant = 'modal' }: PostDetailCommentsModalProps) {
  const { t, locale } = useI18n()
  useBodyInteractionLock(variant !== 'photo-sidebar', ['content-detail-open'])
  const initialCommentPageRef = useRef(readCachedCommentPage(viewerId, targetId, COMMENT_PAGE_LIMIT))
  const [comments, setComments] = useState<SocialComment[]>(() => initialCommentPageRef.current?.items ?? [])
  const [replyPages, setReplyPages] = useState<Record<string, ReplyPageState>>({})
  const [cursor, setCursor] = useState<string | null>(() => initialCommentPageRef.current?.endCursor ?? null)
  const [hasMore, setHasMore] = useState(() => initialCommentPageRef.current?.hasNextPage ?? false)
  const [content, setContent] = useState('')
  const [replyTarget, setReplyTarget] = useState<SocialComment | null>(null)
  const [commentImage, setCommentImage] = useState<{ file: File; previewUrl: string } | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [loading, setLoading] = useState(() => initialCommentPageRef.current === null)
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
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null)
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<CommentEditState | null>(null)
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null)
  const [commentHistory, setCommentHistory] = useState<Record<string, CommentHistoryState>>({})
  const [expandedCommentHistoryId, setExpandedCommentHistoryId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const commentLoadSequenceRef = useRef(0)
  const loadingLikerIdsRef = useRef(new Set<string>())
  const loadedLikerIdsRef = useRef(new Set<string>())
  const viewerDisplayName = viewer?.displayName || t('you')

  useLayoutEffect(() => {
    if (textareaRef.current) resizeCommentTextarea(textareaRef.current)
  }, [content, editingComment?.content])

  useEffect(() => {
    const resize = () => {
      if (textareaRef.current) resizeCommentTextarea(textareaRef.current)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (!commentMenuId) return
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement | null)?.closest('[data-comment-options-root]')) {
        setCommentMenuId(null)
        setDeleteConfirmCommentId(null)
      }
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCommentMenuId(null)
        setDeleteConfirmCommentId(null)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [commentMenuId])

  function changeContent(nextContent: string, caret: number) {
    if (editingComment) {
      setEditingComment((current) => current ? {
        ...current,
        content: nextContent,
        entities: reconcileMentionEntities(current.content, nextContent, current.entities),
        caret,
      } : current)
      return
    }
    setMentionEntities((current) => reconcileMentionEntities(content, nextContent, current))
    setContent(nextContent)
    setMentionCaret(caret)
  }

  function selectMention(person: UserSummary, mention: Parameters<typeof applyMentionSelection>[1]) {
    const currentContent = editingComment?.content ?? content
    const selected = applyMentionSelection(currentContent, mention, person)
    if (editingComment) {
      setEditingComment((current) => current ? {
        ...current,
        content: selected.text,
        entities: [...reconcileMentionEntities(current.content, selected.text, current.entities), selected.entity],
        caret: selected.caret,
      } : current)
    } else {
      setMentionEntities((current) => [...reconcileMentionEntities(content, selected.text, current), selected.entity])
      setContent(selected.text)
      setMentionCaret(selected.caret)
    }
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(selected.caret, selected.caret)
    }, 0)
  }

  function deleteMentionWithKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    const textarea = event.currentTarget
    const currentContent = editingComment?.content ?? content
    const currentEntities = editingComment?.entities ?? mentionEntities
    const currentCaret = editingComment?.caret ?? mentionCaret
    const result = deleteMentionAtSelection(
      currentContent,
      currentEntities,
      textarea.selectionStart ?? currentCaret,
      textarea.selectionEnd ?? currentCaret,
      event.key === 'Backspace' ? 'backward' : 'forward',
    )
    if (!result) return
    event.preventDefault()
    if (editingComment) {
      setEditingComment((current) => current ? { ...current, content: result.text, entities: result.entities, caret: result.caret } : current)
    } else {
      setContent(result.text)
      setMentionEntities(result.entities)
      setMentionCaret(result.caret)
    }
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(result.caret, result.caret)
    }, 0)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    deleteMentionWithKey(event)
    if (event.defaultPrevented || event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && editingComment) {
      event.preventDefault()
      cancelCommentEdit()
      return
    }
    // Enter is the send shortcut. Shift+Enter deliberately keeps the
    // browser's multiline behavior and is the only way to insert a newline.
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    const currentContent = editingComment?.content ?? content
    if (busy || savingCommentId || (!currentContent.trim() && !(editingComment ? loadedComment(editingComment.commentId)?.media : commentImage))) return
    event.currentTarget.form?.requestSubmit()
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    const currentContent = editingComment?.content ?? content
    const start = textarea?.selectionStart ?? currentContent.length
    const end = textarea?.selectionEnd ?? start
    const next = `${currentContent.slice(0, start)}${emoji}${currentContent.slice(end)}`
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

  function loadedComment(commentId: string): SocialComment | null {
    const root = comments.find((comment) => comment.id === commentId)
    if (root) return root
    for (const page of Object.values(replyPages)) {
      const reply = page.items.find((comment) => comment.id === commentId)
      if (reply) return reply
    }
    return null
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
    const sequence = ++commentLoadSequenceRef.current
    const cachedPage = !append && nextCursor === null
      ? readCachedCommentPage(viewerId, targetId, COMMENT_PAGE_LIMIT)
      : null
    if (cachedPage) {
      setComments(cachedPage.items)
      setCursor(cachedPage.endCursor)
      setHasMore(cachedPage.hasNextPage)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const page = await loadCommentPage(viewerId, targetId, COMMENT_PAGE_LIMIT, nextCursor)
      if (sequence !== commentLoadSequenceRef.current) return
      setComments((current) => {
        if (!append) return page.items
        const itemById = new Map(current.map((item) => [item.id, item]))
        page.items.forEach((item) => itemById.set(item.id, item))
        return [...itemById.values()]
      })
      setCursor(page.endCursor)
      setHasMore(page.hasNextPage)
    } catch {
      if (sequence === commentLoadSequenceRef.current) setError(t('commentsLoadError'))
    } finally {
      if (sequence === commentLoadSequenceRef.current) setLoading(false)
    }
  }, [t, targetId, viewerId])

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
    if (replyTarget?.id === comment.id) {
      cancelReply()
      return
    }
    const name = comment.author.displayName || t('fakebookUser')
    const nextContent = `${name} `
    setEditingComment(null)
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

  function cancelCommentEdit() {
    setEditingComment(null)
    setEmojiOpen(false)
  }

  useEffect(() => {
    const cachedPage = readCachedCommentPage(viewerId, targetId, COMMENT_PAGE_LIMIT)
    setComments(cachedPage?.items ?? [])
    setReplyPages({})
    setCursor(cachedPage?.endCursor ?? null)
    setHasMore(cachedPage?.hasNextPage ?? false)
    setLoading(cachedPage === null)
    setContent('')
    setReplyTarget(null)
    setCommentImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setEmojiOpen(false)
    setError(null)
    setCommentLikers({})
    setVisibleLikersCommentId(null)
    setMentionEntities([])
    setMentionCaret(0)
    setCommentMenuId(null)
    setDeleteConfirmCommentId(null)
    setEditingComment(null)
    setSavingCommentId(null)
    setCommentHistory({})
    setExpandedCommentHistoryId(null)
    loadingLikerIdsRef.current.clear()
    loadedLikerIdsRef.current.clear()
  }, [targetId, viewerId])
  useEffect(() => {
    void load()
    return () => { commentLoadSequenceRef.current += 1 }
  }, [load])
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
    if (editingComment) {
      const comment = loadedComment(editingComment.commentId)
      if (comment) await saveCommentEdit(comment)
      return
    }
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
      clearPrefetchedCommentPage(targetId, viewerId)
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

  function beginEditingComment(comment: SocialComment) {
    if (comment.author.id !== viewerId || comment.isDeleted) return
    const draft = editableCommentDraft(comment, t('fakebookUser'))
    setReplyTarget(null)
    setEditingComment({ commentId: comment.id, ...draft })
    setCommentMenuId(null)
    setDeleteConfirmCommentId(null)
    setExpandedCommentHistoryId(null)
    setCommentImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setEmojiOpen(false)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(draft.caret, draft.caret)
    }, 0)
  }

  async function saveCommentEdit(comment: SocialComment) {
    if (!editingComment || editingComment.commentId !== comment.id || savingCommentId) return
    const editState = editingComment
    const serialized = serializeMentionContent(editState.content, editState.entities).trim()
    if (!serialized && !comment.media) return
    if (serialized === comment.content) {
      setEditingComment(null)
      return
    }

    setSavingCommentId(comment.id)
    setError(null)
    try {
      if (!await socialApi.updateComment(comment.id, serialized)) throw new Error('Comment edit rejected')
      const editedAt = new Date().toISOString()
      const mentionIds = new Set(editState.entities.map((entity) => entity.userId))
      patchComment(comment.id, (item) => ({
        ...item,
        content: serialized,
        mentions: editState.entities
          .filter((entity, index, entities) => entities.findIndex((candidate) => candidate.userId === entity.userId) === index)
          .filter((entity) => mentionIds.has(entity.userId))
          .map((entity) => ({ userId: entity.userId, name: entity.displayName, available: true })),
        editedAt,
      }))
      clearPrefetchedCommentPage(targetId, viewerId)
      setCommentHistory((current) => {
        if (!(comment.id in current)) return current
        const next = { ...current }
        delete next[comment.id]
        return next
      })
      setExpandedCommentHistoryId(null)
      setEditingComment((current) => current?.commentId === comment.id ? null : current)
    } catch {
      setError(t('commentEditError'))
    } finally {
      setSavingCommentId(null)
    }
  }

  async function deleteComment(comment: SocialComment) {
    if (comment.author.id !== viewerId || comment.isDeleted || busyCommentId) return
    setBusyCommentId(comment.id)
    setCommentMenuId(null)
    setDeleteConfirmCommentId(null)
    setError(null)
    try {
      if (!await socialApi.deleteContent(comment.id)) throw new Error('Comment delete rejected')
      patchComment(comment.id, (item) => ({
        ...item,
        content: '',
        mentions: [],
        media: null,
        likeCount: 0,
        viewerHasLiked: false,
        canFollowAuthor: false,
        isDeleted: true,
        editedAt: null,
      }))
      clearPrefetchedCommentPage(targetId, viewerId)
      if (replyTarget?.id === comment.id) cancelReply()
      if (editingComment?.commentId === comment.id) setEditingComment(null)
      setExpandedCommentHistoryId((current) => current === comment.id ? null : current)
      setCommentHistory((current) => {
        if (!(comment.id in current)) return current
        const next = { ...current }
        delete next[comment.id]
        return next
      })
    } catch {
      setError(t('commentDeleteError'))
    } finally {
      setBusyCommentId(null)
    }
  }

  async function toggleCommentEditHistory(comment: SocialComment) {
    if (!comment.editedAt || comment.isDeleted) return
    if (expandedCommentHistoryId === comment.id) {
      setExpandedCommentHistoryId(null)
      return
    }
    setExpandedCommentHistoryId(comment.id)
    if (commentHistory[comment.id]?.loaded || commentHistory[comment.id]?.loading) return
    setCommentHistory((current) => ({
      ...current,
      [comment.id]: { items: current[comment.id]?.items ?? [], loaded: false, loading: true },
    }))
    try {
      const items = await socialApi.getCommentEditHistory(comment.id)
      setCommentHistory((current) => ({ ...current, [comment.id]: { items, loaded: true, loading: false } }))
    } catch {
      setCommentHistory((current) => ({ ...current, [comment.id]: { items: [], loaded: true, loading: false } }))
      setError(t('commentHistoryError'))
    }
  }

  function renderComment(comment: SocialComment, depth = 0): ReactNode {
    const replies = replyPages[comment.id]
    const loadedReplies = replies?.items ?? []
    const showReplyLoader = comment.replyCount > 0 && !replies?.loaded
    const hasLoadedReplies = Boolean(replies?.loaded && loadedReplies.length > 0)
    const isReplyTarget = replyTarget?.id === comment.id
    const isEditing = editingComment?.commentId === comment.id
    const hasThreadChildren = hasLoadedReplies || isReplyTarget || Boolean(replies?.hasMore)
    const likerState = commentLikers[comment.id]
    const remainingLikerCount = Math.max(0, comment.likeCount - (likerState?.items.length ?? 0))
    const likerTooltipId = `comment-likers-${comment.id}`
    const showLikerTooltip = visibleLikersCommentId === comment.id && comment.likeCount > 0 && (!likerState?.loaded || likerState.items.length > 0)
    const commentTimestamp = formatPostTimestamp(comment.createdAt, locale)
    const isDeleted = Boolean(comment.isDeleted)
    const historyExpanded = expandedCommentHistoryId === comment.id
    const historyState = commentHistory[comment.id]
    return <div className={`thread-comment-node${depth > 0 ? ' is-reply' : ''}${hasThreadChildren ? ' has-children has-thread-children' : ''}`} key={comment.id} data-depth={depth}>
      <article className={`thread-comment${isDeleted ? ' is-deleted' : ''}`}>
        <button type="button" className="comment-author" onClick={() => onNavigate?.(`/profile/${comment.author.id}`)}><Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size={depth === 0 ? 34 : 30} /></button>
        <div className="thread-comment-copy">
          {isDeleted ? <><div className="comment-heading comment-state-heading"><strong>{comment.author.displayName}<VerifiedBadge verified={comment.author.isVerified} size={12} /></strong></div><div className="comment-state-bubble comment-deleted-bubble"><p className="comment-state-text">{t('commentDeleted')}</p></div></> : <>
            <div className="comment-bubble">
              <div className="comment-heading">
                <strong>{comment.author.displayName}<VerifiedBadge verified={comment.author.isVerified} size={12} /></strong>
                {comment.canFollowAuthor && comment.author.id !== viewerId && <button type="button" className="comment-follow-action" disabled={busyFollowAuthorId === comment.author.id} onClick={() => void followCommentAuthor(comment)}>{t('follow')}</button>}
                <HoverTooltip label={commentTimestamp.detail} className="comment-time-hover"><time dateTime={comment.createdAt}>{relativeTime(comment.createdAt, locale)}</time></HoverTooltip>
                {comment.author.id === viewerId && <div className="comment-options" data-comment-options-root>
                  <button type="button" className="comment-options-trigger" aria-label={t('commentOptions')} aria-expanded={commentMenuId === comment.id} onClick={() => {
                    setCommentMenuId((current) => current === comment.id ? null : comment.id)
                    setDeleteConfirmCommentId(null)
                  }}><Icon name="more" size={17} /></button>
                  {commentMenuId === comment.id && <div className="comment-options-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => beginEditingComment(comment)}><Icon name="edit" size={18} /><span>{t('editComment')}</span></button>
                    <button type="button" role="menuitem" className={`danger${deleteConfirmCommentId === comment.id ? ' active' : ''}`} aria-pressed={deleteConfirmCommentId === comment.id} onClick={() => setDeleteConfirmCommentId(comment.id)}><Icon name="trash" size={18} /><span>{t('deleteComment')}</span></button>
                    {deleteConfirmCommentId === comment.id && <div className="comment-delete-confirm-row" role="group" aria-label={t('deleteCommentConfirm')} data-testid={`comment-delete-confirm-${comment.id}`}>
                      <button type="button" className="confirm" disabled={busyCommentId === comment.id} onClick={() => void deleteComment(comment)}>{t('confirm')}</button>
                      <button type="button" onClick={() => setDeleteConfirmCommentId(null)}>{t('cancel')}</button>
                    </div>}
                  </div>}
                </div>}
              </div>
              {isEditing
                ? <div className="comment-active-edit-preview">
                    <button
                      type="button"
                      className="comment-active-edit-title"
                      onClick={cancelCommentEdit}
                      aria-label={t('editingOwnComment')}
                      title={t('cancel')}
                    >
                      {t('editingOwnComment')}
                    </button>
                    {comment.content && <div className="comment-state-text comment-active-edit-original"><MentionContent content={comment.content} mentions={comment.mentions} onNavigate={onNavigate} /></div>}
                  </div>
                : comment.content && <><ExpandableCommentContent content={comment.content} mentions={comment.mentions} onNavigate={onNavigate} /><LinkPreview content={comment.content} onNavigate={onNavigate} /></>}
              {historyExpanded && <div className="comment-edit-history" aria-label={t('commentEditHistory')}>
                {historyState?.loading || !historyState
                  ? <span className="comment-history-loading"><i className="spinner" /></span>
                  : historyState.items.length === 0
                    ? <p className="comment-history-empty">{t('noCommentEditHistory')}</p>
                    : historyState.items.map((revision, index) => <HoverTooltip label={formatPostTimestamp(revision.editedAt, locale).detail} className="comment-history-entry" key={`${revision.editedAt}:${index}`}>
                      <span className="comment-history-content"><MentionContent content={revision.content} mentions={revision.mentions} onNavigate={onNavigate} /></span>
                    </HoverTooltip>)}
              </div>}
            </div>
            {comment.media && <div className={`comment-media media-type-${comment.media.type}`}>{comment.media.type === 1
            ? <video src={comment.media.url} controls preload="metadata" />
            : comment.media.type === 2
              ? <audio src={comment.media.url} controls preload="metadata" />
              : <img src={comment.media.url} alt="" />}</div>}
            <div className="comment-meta">
            <button type="button" className={`comment-like-action${comment.viewerHasLiked ? ' active' : ''}`} aria-label={t('like')} aria-pressed={comment.viewerHasLiked} disabled={busyCommentId === comment.id} onClick={() => void toggleCommentLike(comment)}><Icon name={comment.viewerHasLiked ? 'like' : 'likeOutline'} size={15} /></button>
            <button type="button" className={`comment-meta-text-action comment-reply-action${isReplyTarget ? ' active' : ''}`} aria-pressed={isReplyTarget} onClick={() => startReply(comment)}>{t('reply')}</button>
            {comment.editedAt && <button type="button" className="comment-meta-text-action comment-edited-action" aria-expanded={historyExpanded} onClick={() => void toggleCommentEditHistory(comment)}>{historyExpanded ? t('hideCommentEditHistory') : t('editedMessage')}</button>}
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
          </>}
          {showReplyLoader && <button type="button" className="thread-replies-toggle" disabled={replies?.loading} onClick={() => void loadReplies(comment.id)}><svg className="thread-replies-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" /></svg>{replies?.loading ? t('loadingComments') : t('viewReplies', { count: comment.replyCount })}</button>}
        </div>
      </article>
      {hasThreadChildren && <div className="thread-comment-children">
        {loadedReplies.map((reply, index) => <div className={`thread-comment-child${!isReplyTarget && index === loadedReplies.length - 1 ? ' is-last' : ''}`} key={reply.id}><span className="thread-comment-branch" aria-hidden="true" />{renderComment(reply, depth + 1)}</div>)}
        {isReplyTarget && <div className="thread-comment-child is-last reply-draft-child">
          <span className="thread-comment-branch" aria-hidden="true" />
          <div className="thread-comment-node is-reply reply-draft-node" data-depth={depth + 1}>
            <article className="thread-comment">
              <span className="comment-author reply-draft-author"><Avatar name={viewerDisplayName} src={viewer?.avatarUrl || null} size={30} /></span>
              <div className="thread-comment-copy"><div className="comment-heading comment-state-heading"><strong>{viewerDisplayName}<VerifiedBadge verified={viewer?.isVerified} size={12} /></strong></div><button type="button" className="comment-state-bubble reply-draft-bubble" onClick={cancelReply}><span className="comment-state-text">{comment.author.id === viewerId ? t('replyingToOwnComment') : t('replyingToComment', { name: comment.author.displayName || t('fakebookUser') })}</span></button></div>
            </article>
          </div>
        </div>}
        {replies?.hasMore && <button type="button" className="thread-replies-toggle more" disabled={replies.loading || !replies.cursor} onClick={() => void loadReplies(comment.id, true)}>{replies.loading ? t('loadingMore') : t('seeMoreReplies')}</button>}
      </div>}
    </div>
  }

  const showLikeCount = engagement.likeCount > 0
  const showCommentCount = engagement.commentCount > 0
  const showShareCount = engagement.shareCount > 0
  const showViewCount = post?.__typename === 'ReelDetail' && engagement.viewCount > 0
  const showEngagementSummary = showLikeCount || showCommentCount || showShareCount || showViewCount
  const showEmptyComments = !loading && comments.length === 0

  const discussionScroll = <div className="content-thread-scroll">
    {post && <ThreadPostPreview post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} onOpenImage={onOpenImage} onOpenReel={onOpenReel} onHidden={onClose} onPostChanged={onPostChanged} hideMedia={variant === 'photo-sidebar'} />}
    {post && <div className={`content-actions-wrap thread-post-engagement${showEngagementSummary ? '' : ' no-summary'}${post.sharedSource ? ' has-shared-source' : ''}`}>
      {showEngagementSummary && <div className="content-engagement-summary">
        {showLikeCount && <span className="content-like-summary"><Icon name="like" size={15} />{engagement.likeCount}</span>}
        {showCommentCount && <span className="content-comment-summary">{engagement.commentCount} {t('comments')}</span>}
        {showShareCount && <span className="content-share-summary">{engagement.shareCount} {t('shares')}</span>}
        {showViewCount && <span className="content-view-summary">{engagement.viewCount} {t('views')}</span>}
      </div>}
      <nav className={`gateway-post-actions${canShare ? '' : ' no-share'}`}>
        <button type="button" className={engagement.viewerHasLiked ? 'active' : ''} disabled={likeBusy} onClick={() => void onToggleLike()}><Icon name={engagement.viewerHasLiked ? 'like' : 'likeOutline'} size={21} />{t('like')}</button>
        <button type="button" onClick={() => textareaRef.current?.focus()}><Icon name="commentOutline" size={21} />{t('commentAction')}</button>
        {canShare && <button type="button" disabled={shareDisabled} aria-disabled={shareDisabled} onClick={onShare}><Icon name="shareOutline" size={22} />{t('shareAction')}</button>}
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
  const composerContent = editingComment?.content ?? content
  const composerEntities = editingComment?.entities ?? mentionEntities
  const composerCaret = editingComment?.caret ?? mentionCaret
  const editingTarget = editingComment ? loadedComment(editingComment.commentId) : null
  const composerTarget = editingTarget ?? replyTarget
  const composerHasMedia = editingComment ? Boolean(editingTarget?.media) : Boolean(commentImage)
  const composer = <form className={`comment-compose${editingComment ? ' is-editing' : ''}`} onSubmit={submit}>
    <div className="comment-compose-row">
      <div className={`comment-compose-avatar-stack${composerTarget ? ' replying' : ''}`}>
        <Avatar name={viewerDisplayName} src={viewer?.avatarUrl || null} size={32} />
        {composerTarget && <span className="comment-compose-reply-target"><Avatar name={composerTarget.author.displayName || t('fakebookUser')} src={composerTarget.author.avatarUrl || null} size={18} /></span>}
        {composerTarget && <button type="button" className="comment-compose-reply-cancel-zone" aria-label={t('cancel')} title={t('cancel')} onClick={editingComment ? cancelCommentEdit : cancelReply} />}
      </div>
      <div className="comment-compose-box">
        <div className="mention-compose-field"><MentionDraftOverlay text={composerContent} entities={composerEntities} textareaRef={textareaRef} /><textarea ref={textareaRef} rows={1} value={composerContent} spellCheck={false} aria-label={editingComment ? t('editComment') : undefined} onChange={(event) => changeContent(event.target.value, event.target.selectionStart ?? event.target.value.length)} onPaste={(event) => {
          if (editingComment) return
          const [pastedImage] = clipboardImageFiles(event.clipboardData)
          if (pastedImage) {
            event.preventDefault()
            selectCommentImage(pastedImage)
            return
          }
          const pasted = event.clipboardData.getData('text').trim()
          if (!isDirectImageUrl(pasted) || commentImage) return
          event.preventDefault()
          void remoteImageFileFromUrl(pasted).then((file) => selectCommentImage(file)).catch(() => changeContent(`${content}${content ? ' ' : ''}${pasted}`, content.length + pasted.length + (content ? 1 : 0)))
        }} onKeyDown={handleComposerKeyDown} onSelect={(event) => {
          const caret = event.currentTarget.selectionStart ?? composerContent.length
          if (editingComment) setEditingComment((current) => current ? { ...current, caret } : current)
          else setMentionCaret(caret)
        }} placeholder={editingComment ? t('editComment') : replyTarget ? t('writeReply') : t('commentAs', { name: viewerDisplayName })} /><MentionSuggestions text={composerContent} people={friends} textareaRef={textareaRef} caretIndex={composerCaret} onSelected={selectMention} placement="above" limit={5} className="comment-mention-suggestions" fitToNames /></div>
        {!editingComment && commentImage && <div className="comment-image-preview"><img src={commentImage.previewUrl} alt="" /><button type="button" aria-label={t('removeMedia')} onClick={() => setCommentImage(null)}><Icon name="close" size={14} /></button></div>}
        <div className="comment-compose-tools">
          <div className="comment-compose-tool-list">
            <div className="comment-emoji-wrap"><button type="button" aria-label={t('feeling')} title={t('feeling')} aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}><Icon name="feeling" size={18} /></button>{emojiOpen && <div className="comment-emoji-menu" role="menu">{COMMENT_EMOJIS.map((emoji) => <button key={emoji} type="button" role="menuitem" aria-label={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}</div>
            {!editingComment && <label aria-label={t('attachPhoto')} title={t('attachPhoto')}><Icon name="photo" size={18} /><input type="file" accept="image/*" onChange={(event) => { selectCommentImage(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>}
            <button type="button" aria-label={t('stickers')} title={t('stickers')}><Icon name="sticker" size={18} /></button>
          </div>
          <button type="submit" disabled={busy || Boolean(savingCommentId) || (!composerContent.trim() && !composerHasMedia)} aria-label={editingComment ? t('save') : t('sendComment')}><Icon name="send" size={19} /></button>
        </div>
      </div>
    </div>
  </form>

  if (variant === 'photo-sidebar') {
    return <section className="photo-detail-discussion content-thread-modal" aria-label={t('comments')}>
      {discussionScroll}
      {error && <p className="form-error content-modal-error">{error}</p>}
      {composer}
    </section>
  }

  return <>
    {createPortal(<button type="button" className="content-detail-shell-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={24} /></button>, document.body)}
    <div className="modal-backdrop content-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal content-thread-modal" role="dialog" aria-modal="true" aria-label={t('comments')} onClick={(event) => event.stopPropagation()}>
        <header className="modal-head content-thread-head">
          <h2>{post ? t('postBy', { name: post.author.name }) : t('comments')}</h2>
          <button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button>
        </header>
        {discussionScroll}
        {error && <p className="form-error content-modal-error">{error}</p>}
        {composer}
      </section>
    </div>
  </>
}

function ThreadPostPreview({ post, locale, viewerId, onNavigate, onOpenImage, onOpenReel, onHidden, onPostChanged, hideMedia = false }: { post: GatewayPost; locale: string; viewerId: string; onNavigate?: (path: string) => void; onOpenImage?: (post: GatewayPost, media: GatewayMedia, index: number, initialPlaybackTime?: number) => void; onOpenReel?: (post: GatewayReelPost) => void; onHidden: () => void; onPostChanged?: (post: GatewayPost) => void; hideMedia?: boolean }) {
  const { t } = useI18n()
  const [privacyBusy, setPrivacyBusy] = useState(false)
  const [privacyError, setPrivacyError] = useState<string | null>(null)
  const timestamp = formatPostTimestamp(post.create, locale)
  const isGroup = post.__typename === 'GroupPostDetail'
  const privacy: PostPrivacy = post.privacy === 1 || post.privacy === 2 || post.privacy === 3 ? post.privacy : 0
  const privacyLabel = isGroup
    ? post.privacy === 0 ? t('publicGroup') : t('privateGroup')
    : privacy === 0 ? t('privacyPublic') : privacy === 1 ? t('privacyFriendsFollowers') : privacy === 2 ? t('privacyFriends') : t('privacyOnlyMe')
  const taggedUsers = post.__typename === 'FeedPostDetail' ? (post.taggedUsers ?? []).filter((person) => person.id !== post.author.id) : []
  const decodedContent = decodePostContent(post.content)
  const postBackground = post.media.length === 0 ? getPostBackgroundPreset(decodedContent.backgroundId) : null
  const hasSharedSource = Boolean(post.sharedSource)
  const openPrimary = () => onNavigate?.(isGroup ? `/groups/${post.group.id}` : `/profile/${post.author.id}`)
  const owned = viewerId === post.author.id
  const privacyOptions: Array<{ value: PostPrivacy; label: string }> = [
    { value: 0, label: t('privacyPublic') },
    { value: 1, label: t('privacyFriendsFollowers') },
    { value: 2, label: t('privacyFriends') },
    { value: 3, label: t('privacyOnlyMe') },
  ]

  async function changePrivacy(nextPrivacy: PostPrivacy) {
    if (!owned || isGroup || nextPrivacy === privacy) return
    setPrivacyBusy(true)
    setPrivacyError(null)
    try {
      const updated = await socialApi.updatePost(post.id, { privacy: nextPrivacy })
      if (!updated) throw new Error('Privacy update rejected')
      onPostChanged?.({ ...post, privacy: updated.privacy })
    } catch {
      setPrivacyError(t('postPrivacyUpdateError'))
    } finally {
      setPrivacyBusy(false)
    }
  }

  return <article className={`gateway-post thread-post-preview${hasSharedSource ? ' has-shared-source' : ''}`}>
    <header className={isGroup ? 'group-feed-post-head' : 'feed-post-head'}>
      <button type="button" className="post-author-avatar" onClick={openPrimary}>{isGroup ? <GroupPostAvatar groupName={post.group.name} groupAvatar={post.group.avatar || null} userName={post.author.name} userAvatar={post.author.avatar || null} size={40} /> : <Avatar name={post.author.name} src={post.author.avatar || null} size={40} />}</button>
      <div className="post-head-copy thread-post-head-copy">
        <div className="post-head-primary">
          {isGroup ? <button type="button" className="post-group-link" onClick={openPrimary}><strong><span className="thread-post-primary-name">{post.group.name}</span></strong></button> : <button type="button" className="post-author-name" onClick={openPrimary}><strong><span className="thread-post-primary-name">{post.author.name}</span><VerifiedBadge verified={post.author.isVerified} /></strong></button>}
          <ThreadTaggedUsers users={taggedUsers} onNavigate={onNavigate} />
        </div>
        <span className="post-head-meta">
          {isGroup && <><button type="button" className="post-meta-author" onClick={() => onNavigate?.(`/profile/${post.author.id}`)}><span className="thread-post-meta-author-name">{post.author.name}</span><VerifiedBadge verified={post.author.isVerified} size={12} /></button><i>·</i></>}
          <HoverTooltip label={timestamp.detail} className="post-meta-hover post-time-hover"><time dateTime={post.create}>{timestamp.display}</time></HoverTooltip>
          <i>·</i>
          {owned && !isGroup
            ? <PostPrivacyControl privacy={privacy} label={privacyLabel} options={privacyOptions} busy={privacyBusy} onSelect={(value) => void changePrivacy(value)} />
            : <HoverTooltip label={privacyLabel} className="post-meta-hover post-privacy-hover"><span aria-label={privacyLabel}><PostPrivacyIcon privacy={privacy} size={13} group={isGroup} /></span></HoverTooltip>}
        </span>
      </div>
      <PostOptionsMenu post={post} viewerId={viewerId} owned={viewerId === post.author.id} onPostHidden={onHidden} />
    </header>
    {privacyError && <p className="form-error post-relationship-error">{privacyError}</p>}
    {decodedContent.text && <PostContent content={decodedContent.text} mentions={post.mentions ?? []} className={`gateway-post-content${postBackground ? ' has-background' : ''}`} style={postBackground ? { background: postBackground.background } : undefined} onNavigate={onNavigate} />}
    {!hideMedia && <PostMediaGallery media={post.media} preferredAspectRatio={post.__typename === 'ReelDetail' ? post.aspectRatio : null} focalPointX={post.__typename === 'ReelDetail' ? post.focalPointX : null} focalPointY={post.__typename === 'ReelDetail' ? post.focalPointY : null} onOpenImage={post.__typename === 'ReelDetail' ? onOpenReel ? () => onOpenReel(post) : undefined : onOpenImage ? (media, index, initialPlaybackTime) => onOpenImage(post, media, index, initialPlaybackTime) : undefined} />}
    {!hideMedia && post.sharedSource && <SharedPostSourceCard source={post.sharedSource} locale={locale} onNavigate={onNavigate} onOpenImage={onOpenImage && post.sharedSource.type !== 4 ? (source, media, index, initialPlaybackTime) => onOpenImage(sharedSourceAsPost(source, post), media, index, initialPlaybackTime) : undefined} onOpenReel={post.sharedSource.type === 4 ? (source) => {
      const reel = sharedPostSourceToGatewayReel(source)
      if (reel && onOpenReel) onOpenReel(reel)
      else onNavigate?.(reelOverlayHref(source.id))
    } : undefined} />}
  </article>
}

function sharedSourceAsPost(source: SharedPostSource, parent: GatewayPost): GatewayPost {
  return {
    __typename: 'FeedPostDetail',
    id: source.id,
    type: source.type ?? 1,
    content: source.content ?? '',
    privacy: source.privacy ?? 0,
    create: source.create ?? parent.create,
    author: {
      id: source.author?.id ?? parent.author.id,
      name: source.author?.name ?? parent.author.name,
      avatar: source.author?.avatar ?? parent.author.avatar,
      isVerified: source.author?.isVerified ?? false,
    },
    media: source.media,
    mentions: source.mentions,
    taggedUsers: [],
    sharedSource: null,
  }
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

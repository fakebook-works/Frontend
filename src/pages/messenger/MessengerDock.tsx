import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode, TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api/client'
import { messengerApi } from '../../api/messenger'
import type { MessengerPresenceDto, MessengerRealtimeEvent } from '../../api/messenger'
import { socialApi } from '../../api/social'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { RichTextContent } from '../../components/MentionContent'
import { Icon } from '../../components/Icon'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { LinkPreview } from '../../components/LinkPreview'
import { useI18n } from '../../i18n'
import { relativeTime } from '../../lib/format'
import { clipboardImageFiles } from '../../lib/clipboardMedia'
import { playIncomingMessageSound } from '../../lib/sounds'
import { isDirectImageUrl, remoteImageFileFromUrl } from '../../lib/urlMedia'
import { MESSENGER_ATTACHMENT_ACCEPT } from './attachmentPolicy'
import { conversationAvatar, conversationName, encodeMessengerLike, formatPresence, formatTime, groupPresenceSummary, messageGroupPosition, messengerConversationPreview, messengerLikeLevel, shouldShowAvatar, shouldShowTimestamp } from './helpers'
import type { MessageVisualBreaks } from './helpers'
import { EmojiButton } from './EmojiButton'
import { HoldLikeButton } from './HoldLikeButton'
import { ForwardMessageDialog } from './ForwardMessageDialog'
import { GroupConversationManager } from './GroupConversationManager'
import { MessageActionRail, MessageHoverTimestamp, MessageReactionSummary, MessageReplyPreview } from './MessageInteractions'
import { MessageSenderAvatar } from './MessageSenderAvatar'
import { MessageEditHistory, MessageEditingBar, MessageEditMarker } from './MessageEditState'
import { SystemMessageLine } from './SystemMessageLine'
import { MessengerLikeIcon } from './MessengerLikeIcon'
import { MediaAttachmentPreview, MediaGallery } from './MediaGallery'
import { NewConversationPanel } from './NewConversationPanel'
import { StickerButton } from './StickerButton'
import './MessengerPage.css'

export interface MessengerDockHandle {
  openDirect: (profileId: string) => Promise<void>
  openConversation: (conversation: MessengerConversationDto) => void
  openComposer: () => void
}

interface MessengerDockProps {
  me: UserSummary
  friends: UserSummary[]
  panelOpen: boolean
  hidden?: boolean
  showComposeRail?: boolean
  layout?: 'default' | 'media-viewer'
  onPanelClose: () => void
  onOpenAll: (conversationId?: string) => void
  onOpenProfile: (profileId: string) => void
  onNavigate?: (path: string) => void
}

type PanelFilter = 'all' | 'unread' | 'groups'
const MAX_OPEN_CHATS = 3
const VOICE_RECORDING_LIMIT_MS = 4 * 60_000

interface ActiveVoiceRecording {
  conversationId: string
  recorder: MediaRecorder
  stream: MediaStream
  chunks: Blob[]
  timeoutId: number
  tickerId: number
  startedAt: number
  discard: boolean
}

interface BubblePreviewAnchor {
  conversationId: string
  top: number
  right: number
}

function bubbleConversationActivity(conversation: MessengerConversationDto, viewerId: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const message = conversation.lastMessage
  if (!message) return { text: t('startConversation'), senderId: null as string | null }

  const latestReaction = [...(message.reactions ?? [])].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
  const messageActivityAt = Math.max(Date.parse(message.createdAt) || 0, Date.parse(message.editedAt ?? '') || 0)
  const reactionActivityAt = latestReaction ? Date.parse(latestReaction.updatedAt) || 0 : 0
  if (latestReaction && reactionActivityAt >= messageActivityAt) {
    return { text: t('reactedToMessagePreview', { emoji: latestReaction.emoji }), senderId: latestReaction.userId }
  }

  return {
    text: messengerConversationPreview(message, t) || t('startConversation'),
    senderId: message.kind === 'SYSTEM' ? null : message.sender.id === viewerId ? viewerId : message.sender.id,
  }
}

function visibleChatLimit(viewportWidth: number) {
  if (viewportWidth < 761) return 1
  if (viewportWidth < 1240) return 2
  return MAX_OPEN_CHATS
}

function formatVoiceRecordingTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.min(VOICE_RECORDING_LIMIT_MS / 1_000, Math.floor(milliseconds / 1_000)))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function upsertDockMessage(items: MessengerMessageDto[], incoming: MessengerMessageDto): MessengerMessageDto[] {
  const index = items.findIndex((item) => item.id === incoming.id)
  if (index < 0) return [...items, incoming]
  const rank: Record<MessengerMessageDto['status'], number> = { sending: 0, sent: 1, delivered: 2, read: 3 }
  return items.map((item, itemIndex) => itemIndex === index
    ? { ...incoming, status: rank[item.status] > rank[incoming.status] ? item.status : incoming.status }
    : item)
}

function isNewerDockSequence(next: string, previous?: string): boolean {
  try {
    return BigInt(next) > BigInt(previous ?? '0')
  } catch {
    return next !== previous
  }
}

function MiniChatMessages({
  activityKey,
  conversationId,
  editFocusId,
  onContainerChange,
  children,
}: {
  activityKey: string
  conversationId: string
  editFocusId?: string | null
  onContainerChange: (conversationId: string, element: HTMLDivElement | null) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const setContainerRef = useCallback((element: HTMLDivElement | null) => {
    ref.current = element
    onContainerChange(conversationId, element)
  }, [conversationId, onContainerChange])
  useEffect(() => {
    const element = ref.current
    if (element) element.scrollTop = element.scrollHeight
  }, [activityKey])
  return <div className={`mini-chat-messages${editFocusId ? ' has-edit-focus' : ''}`} ref={setContainerRef}>{children}</div>
}

const MINI_COMPOSER_MAX_ROWS = 8

function MiniComposerTextarea({ value, onChange, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = 'auto'
    if (element.scrollHeight <= 0) {
      element.style.removeProperty('height')
      element.style.overflowY = 'hidden'
      return
    }
    const style = window.getComputedStyle(element)
    const parsedLineHeight = Number.parseFloat(style.lineHeight)
    const fontSize = Number.parseFloat(style.fontSize) || 14.5
    const lineHeight = parsedLineHeight > 8
      ? parsedLineHeight
      : parsedLineHeight > 0
        ? parsedLineHeight * fontSize
        : 19
    const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)
    const maxHeight = lineHeight * MINI_COMPOSER_MAX_ROWS + padding
    const nextHeight = Math.min(element.scrollHeight, maxHeight)
    element.style.height = `${Math.ceil(nextHeight)}px`
    element.style.overflowY = element.scrollHeight > maxHeight + .5 ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => resize(ref.current), [resize, value])

  return <textarea
    {...props}
    ref={ref}
    rows={1}
    value={value}
    onChange={(event) => {
      onChange?.(event)
      resize(event.currentTarget)
    }}
  />
}

export const MessengerDock = forwardRef<MessengerDockHandle, MessengerDockProps>(function MessengerDock({
  me,
  friends,
  panelOpen,
  hidden = false,
  showComposeRail = false,
  layout = 'default',
  onPanelClose,
  onOpenAll,
  onOpenProfile,
  onNavigate,
}, ref) {
  const { t, locale } = useI18n()
  const [conversations, setConversations] = useState<MessengerConversationDto[]>([])
  const [messages, setMessages] = useState<Record<string, MessengerMessageDto[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingAttachments, setPendingAttachments] = useState<Record<string, MediaUpload[]>>({})
  const [openIds, setOpenIds] = useState<string[]>([])
  const [minimizedIds, setMinimizedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0)
  const [showNewModal, setShowNewModal] = useState(false)
  const [panelQuery, setPanelQuery] = useState('')
  const [panelFilter, setPanelFilter] = useState<PanelFilter>('all')
  const [panelMenuOpen, setPanelMenuOpen] = useState(false)
  const [fullChatLimit, setFullChatLimit] = useState(() => visibleChatLimit(window.innerWidth))
  const [mediaOverlayOpen, setMediaOverlayOpen] = useState(() => document.body.classList.contains('post-photo-viewer-open') || document.body.classList.contains('reels-comments-open'))
  const mediaViewerLayout = layout === 'media-viewer' || mediaOverlayOpen
  const [friendshipByUserId, setFriendshipByUserId] = useState<Record<string, boolean>>({})
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, MessengerPresenceDto>>({})
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  const [typingByConversationId, setTypingByConversationId] = useState<Record<string, Record<string, number>>>({})
  const [replyToByConversationId, setReplyToByConversationId] = useState<Record<string, string | null>>({})
  const [attentionConversationIds, setAttentionConversationIds] = useState<Set<string>>(() => new Set())
  const [forwardingMessage, setForwardingMessage] = useState<MessengerMessageDto | null>(null)
  const [managedGroupId, setManagedGroupId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [composeToolsConversationId, setComposeToolsConversationId] = useState<string | null>(null)
  const [expandedEditHistoryIds, setExpandedEditHistoryIds] = useState<Set<string>>(() => new Set())
  const [bubblePreviewAnchor, setBubblePreviewAnchor] = useState<BubblePreviewAnchor | null>(null)
  const translateRef = useRef(t)
  translateRef.current = t
  const seenEventIds = useRef(new Set<string>())
  const conversationsRef = useRef<MessengerConversationDto[]>([])
  // Read through a ref so the inbox stream does not tear down and reconnect every time a
  // chat window is opened, closed or minimised.
  const fullOpenIdsRef = useRef<string[]>([])
  const messagesRef = useRef<Record<string, MessengerMessageDto[]>>({})
  const outgoingTypingTimers = useRef(new Map<string, number>())
  const outgoingTypingSentAt = useRef(new Map<string, number>())
  const incomingTypingTimers = useRef(new Map<string, number>())
  const activeVoiceRecording = useRef<ActiveVoiceRecording | null>(null)
  const lastMarkedReadSequence = useRef(new Map<string, string>())
  const latestIncomingSequence = useRef(new Map<string, string>())
  const messengerPopoverRef = useRef<HTMLElement>(null)
  const miniMessageContainers = useRef(new Map<string, HTMLDivElement>())
  const keepBottomAfterReply = useRef(new Set<string>())
  const replyNavigationHighlightRef = useRef<{ element: HTMLElement; timeoutId: number } | null>(null)
  const expandedOpenIds = useMemo(
    () => openIds.filter((id) => !minimizedIds.has(id)),
    [minimizedIds, openIds],
  )
  const visibleConversationLimit = showNewModal
    ? Math.max(0, (mediaViewerLayout ? 1 : fullChatLimit) - 1)
    : mediaViewerLayout ? 1 : fullChatLimit
  const fullOpenIds = useMemo(
    () => visibleConversationLimit > 0 ? expandedOpenIds.slice(-visibleConversationLimit) : [],
    [expandedOpenIds, visibleConversationLimit],
  )
  const fullOpenIdKey = fullOpenIds.join(',')
  fullOpenIdsRef.current = fullOpenIds

  useEffect(() => {
    if (composeToolsConversationId && !fullOpenIds.includes(composeToolsConversationId)) setComposeToolsConversationId(null)
  }, [composeToolsConversationId, fullOpenIds])

  useEffect(() => {
    if (!composeToolsConversationId) return
    const close = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target?.closest('[data-mini-compose-tools]')) setComposeToolsConversationId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setComposeToolsConversationId(null)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [composeToolsConversationId])
  const collapsedOpenIds = useMemo(
    () => openIds.filter((id) => !fullOpenIds.includes(id)),
    [fullOpenIds, openIds],
  )
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends])
  const friendIdKey = useMemo(() => [...friendIds].sort().join(','), [friendIds])
  const directOtherIds = useMemo(() => [...new Set(openIds.flatMap((conversationId) => {
    const conversation = conversations.find((item) => item.id === conversationId)
    if (conversation?.type !== 'DIRECT') return []
    const other = conversation.participants.find((person) => person.id !== me.id)
    return other ? [other.id] : []
  }))], [conversations, me.id, openIds])
  const directOtherIdKey = directOtherIds.join(',')
  const presenceUserIds = useMemo(() => [...new Set(conversations.flatMap((conversation) => {
    if (conversation.type === 'DIRECT') {
      const other = conversation.participants.find((person) => person.id !== me.id)
      return other ? [other.id] : []
    }
    if (!openIds.includes(conversation.id)) return []
    return conversation.participants
      .filter((person) => person.id !== me.id && !person.leftAt)
      .map((person) => person.id)
  }))].slice(0, 250), [conversations, me.id, openIds])
  const presenceUserIdKey = presenceUserIds.join(',')

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const registerMiniMessageContainer = useCallback((conversationId: string, element: HTMLDivElement | null) => {
    if (element) miniMessageContainers.current.set(conversationId, element)
    else miniMessageContainers.current.delete(conversationId)
  }, [])

  const markConversationAttention = useCallback((conversationId: string) => {
    setAttentionConversationIds((current) => {
      if (current.has(conversationId)) return current
      const next = new Set(current)
      next.add(conversationId)
      return next
    })
  }, [])

  const clearConversationAttention = useCallback((conversationId: string) => {
    setAttentionConversationIds((current) => {
      if (!current.has(conversationId)) return current
      const next = new Set(current)
      next.delete(conversationId)
      return next
    })
  }, [])

  const markConversationRead = useCallback((conversationId: string, preferredSequence?: string) => {
    const conversation = conversationsRef.current.find((item) => item.id === conversationId)
    const needsReadReceipt = Boolean(
      conversation && (conversation.unreadCount > 0 || attentionConversationIds.has(conversationId)),
    )
    if (!conversation || !needsReadReceipt) return

    const sequence = preferredSequence
      ?? latestIncomingSequence.current.get(conversationId)
      ?? [...(messagesRef.current[conversationId] ?? [])].reverse().find((message) => message.sequence)?.sequence
      ?? conversation.lastMessage?.sequence
    if (!sequence || !isNewerDockSequence(sequence, lastMarkedReadSequence.current.get(conversationId))) return

    const previousUnreadCount = conversation.unreadCount
    lastMarkedReadSequence.current.set(conversationId, sequence)
    clearConversationAttention(conversationId)
    setConversations((current) => current.map((item) => item.id === conversationId
      ? { ...item, unreadCount: 0 }
      : item))
    void messengerApi.markRead(conversationId, sequence).catch(() => {
      if (lastMarkedReadSequence.current.get(conversationId) === sequence) lastMarkedReadSequence.current.delete(conversationId)
      setConversations((current) => current.map((item) => item.id === conversationId
        ? { ...item, unreadCount: Math.max(item.unreadCount, previousUnreadCount) }
        : item))
      markConversationAttention(conversationId)
      setError(t('messengerUnavailableDesc'))
    })
  }, [attentionConversationIds, clearConversationAttention, markConversationAttention, t])

  useLayoutEffect(() => {
    keepBottomAfterReply.current.forEach((conversationId) => {
      if (!replyToByConversationId[conversationId]) {
        keepBottomAfterReply.current.delete(conversationId)
        return
      }
      const container = miniMessageContainers.current.get(conversationId)
      if (container) container.scrollTop = container.scrollHeight
      keepBottomAfterReply.current.delete(conversationId)
    })
  }, [replyToByConversationId])

  const replyToDockMessage = useCallback((conversationId: string, messageId: string) => {
    const container = miniMessageContainers.current.get(conversationId)
    if (container && container.scrollHeight - container.scrollTop - container.clientHeight <= 32) {
      keepBottomAfterReply.current.add(conversationId)
    } else {
      keepBottomAfterReply.current.delete(conversationId)
    }
    setReplyToByConversationId((current) => ({ ...current, [conversationId]: messageId }))
  }, [])

  const navigateToDockMessage = useCallback((conversationId: string, messageId: string) => {
    const container = miniMessageContainers.current.get(conversationId)
    const target = container
      ? Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'))
        .find((element) => element.dataset.messageId === messageId)
      : undefined
    if (!target) return

    const previousHighlight = replyNavigationHighlightRef.current
    if (previousHighlight) {
      window.clearTimeout(previousHighlight.timeoutId)
      previousHighlight.element.classList.remove('reply-navigation-target')
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.remove('reply-navigation-target')
    void target.offsetWidth
    target.classList.add('reply-navigation-target')
    const timeoutId = window.setTimeout(() => {
      target.classList.remove('reply-navigation-target')
      if (replyNavigationHighlightRef.current?.element === target) replyNavigationHighlightRef.current = null
    }, 1_400)
    replyNavigationHighlightRef.current = { element: target, timeoutId }
  }, [])

  useEffect(() => {
    const updateLimit = () => setFullChatLimit(visibleChatLimit(window.innerWidth))
    window.addEventListener('resize', updateLimit)
    return () => window.removeEventListener('resize', updateLimit)
  }, [])

  useEffect(() => {
    const syncMediaOverlayState = () => setMediaOverlayOpen(document.body.classList.contains('post-photo-viewer-open') || document.body.classList.contains('reels-comments-open'))
    syncMediaOverlayState()
    const observer = new MutationObserver(syncMediaOverlayState)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => setPresenceNow(Date.now()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (directOtherIds.length === 0) return
    let active = true
    void Promise.all(directOtherIds.map(async (targetId) => {
      try {
        const relationship = await socialApi.getProfileRelationshipState(me.id, targetId)
        return [targetId, relationship.friendship === 'friend'] as const
      } catch {
        return [targetId, friendIds.has(targetId)] as const
      }
    })).then((results) => {
      if (!active) return
      setFriendshipByUserId((current) => ({
        ...current,
        ...Object.fromEntries(results),
      }))
    })
    return () => { active = false }
    // Stable keys avoid refetching only because a Set/array identity changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directOtherIdKey, friendIdKey, me.id])

  useEffect(() => {
    if (hidden || presenceUserIds.length === 0) return
    let active = true
    const refreshPresence = () => {
      void messengerApi.presence(presenceUserIds).then((statuses) => {
        if (!active) return
        setPresenceByUserId((current) => ({
          ...current,
          ...Object.fromEntries(statuses.map((status) => [status.userId, status])),
        }))
      }).catch(() => undefined)
    }
    refreshPresence()
    const intervalId = window.setInterval(refreshPresence, 30_000)
    const unsubscribe = messengerApi.subscribePresence(presenceUserIds, (event) => {
      if (event.kind !== 'PRESENCE_CHANGED' || !event.userId) return
      const expiresAt = event.expiresAt && new Date(event.expiresAt).getTime() > Date.now()
        ? event.expiresAt
        : null
      setPresenceByUserId((current) => ({
        ...current,
        [event.userId!]: {
          userId: event.userId!,
          isOnline: Boolean(expiresAt),
          expiresAt,
          updatedAt: expiresAt ? event.occurredAt : current[event.userId!]?.updatedAt ?? event.occurredAt,
        },
      }))
    })
    return () => {
      active = false
      window.clearInterval(intervalId)
      unsubscribe()
    }
    // Stable scalar key prevents reconnecting only because array identity changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, presenceUserIdKey])

  const clearIncomingTyping = useCallback((conversationId: string, userId: string) => {
    const timerKey = `${conversationId}:${userId}`
    const timer = incomingTypingTimers.current.get(timerKey)
    if (timer !== undefined) window.clearTimeout(timer)
    incomingTypingTimers.current.delete(timerKey)
    setTypingByConversationId((current) => {
      const conversationTyping = current[conversationId]
      if (!conversationTyping?.[userId]) return current
      const nextConversationTyping = { ...conversationTyping }
      delete nextConversationTyping[userId]
      const next = { ...current }
      if (Object.keys(nextConversationTyping).length === 0) delete next[conversationId]
      else next[conversationId] = nextConversationTyping
      return next
    })
  }, [])

  const applyTypingEvent = useCallback((event: MessengerRealtimeEvent) => {
    if (event.kind !== 'TYPING_CHANGED' || !event.conversationId || !event.userId || event.userId === me.id) return
    const expiresAt = event.expiresAt ? new Date(event.expiresAt).getTime() : 0
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      clearIncomingTyping(event.conversationId, event.userId)
      return
    }
    const conversationId = event.conversationId
    const userId = event.userId
    setTypingByConversationId((current) => ({
      ...current,
      [conversationId]: { ...current[conversationId], [userId]: expiresAt },
    }))
    const timerKey = `${conversationId}:${userId}`
    const existingTimer = incomingTypingTimers.current.get(timerKey)
    if (existingTimer !== undefined) window.clearTimeout(existingTimer)
    incomingTypingTimers.current.set(timerKey, window.setTimeout(() => {
      clearIncomingTyping(conversationId, userId)
    }, Math.max(0, expiresAt - Date.now()) + 50))
  }, [clearIncomingTyping, me.id])

  const stopTyping = useCallback((conversationId: string) => {
    const timer = outgoingTypingTimers.current.get(conversationId)
    const wasTyping = timer !== undefined || outgoingTypingSentAt.current.has(conversationId)
    if (timer !== undefined) window.clearTimeout(timer)
    outgoingTypingTimers.current.delete(conversationId)
    outgoingTypingSentAt.current.delete(conversationId)
    if (wasTyping) void messengerApi.setTyping(conversationId, false).catch(() => undefined)
  }, [])

  const updateDraft = useCallback((conversationId: string, value: string) => {
    setDrafts((current) => ({ ...current, [conversationId]: value }))
    if (value.length === 0) setComposeToolsConversationId((current) => current === conversationId ? null : current)
    const existingTimer = outgoingTypingTimers.current.get(conversationId)
    if (existingTimer !== undefined) window.clearTimeout(existingTimer)
    if (!value.trim()) {
      stopTyping(conversationId)
      return
    }
    const now = Date.now()
    const lastSentAt = outgoingTypingSentAt.current.get(conversationId) ?? 0
    if (now - lastSentAt >= 3_500) {
      outgoingTypingSentAt.current.set(conversationId, now)
      void messengerApi.setTyping(conversationId, true).catch(() => undefined)
    }
    outgoingTypingTimers.current.set(conversationId, window.setTimeout(() => {
      stopTyping(conversationId)
    }, 1_200))
  }, [stopTyping])

  useEffect(() => () => {
    outgoingTypingTimers.current.forEach((timer) => window.clearTimeout(timer))
    incomingTypingTimers.current.forEach((timer) => window.clearTimeout(timer))
    const highlight = replyNavigationHighlightRef.current
    if (highlight) window.clearTimeout(highlight.timeoutId)
    const recording = activeVoiceRecording.current
    if (recording) {
      recording.discard = true
      window.clearTimeout(recording.timeoutId)
      window.clearInterval(recording.tickerId)
      recording.stream.getTracks().forEach((track) => track.stop())
      if (recording.recorder.state !== 'inactive') recording.recorder.stop()
    }
  }, [])

  const loadConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const items = await messengerApi.conversations(me.id, 100)
      conversationsRef.current = items
      setConversations(items)
      setError(null)
      return items
    } catch {
      setError(translateRef.current('messengerUnavailableDesc'))
      return null
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [me.id])

  useEffect(() => {
    if (panelOpen) void loadConversations(conversationsRef.current.length === 0)
  }, [loadConversations, panelOpen])

  useEffect(() => {
    if (!panelOpen) {
      setPanelMenuOpen(false)
      return
    }
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (messengerPopoverRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.shell-messenger-button')) return
      setPanelMenuOpen(false)
      onPanelClose()
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (panelMenuOpen) setPanelMenuOpen(false)
      else onPanelClose()
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [onPanelClose, panelMenuOpen, panelOpen])

  useEffect(() => {
    // Rendered as null while hidden, and MessengerPage is mounted on that route with its
    // own streams. Holding these open would spend connections nothing can display.
    if (hidden) return
    return messengerApi.subscribeInbox((event) => {
      if (seenEventIds.current.has(event.eventId)) return
      seenEventIds.current.add(event.eventId)
      if (event.kind === 'CONVERSATION_DELETED' && event.conversationId) {
        const deletedId = event.conversationId
        setManagedGroupId((current) => current === deletedId ? null : current)
        setConversations((current) => current.filter((conversation) => conversation.id !== deletedId))
        conversationsRef.current = conversationsRef.current.filter((conversation) => conversation.id !== deletedId)
        setOpenIds((current) => current.filter((id) => id !== deletedId))
        setMinimizedIds((current) => {
          const next = new Set(current)
          next.delete(deletedId)
          return next
        })
        setMessages((current) => {
          const next = { ...current }
          delete next[deletedId]
          return next
        })
        setPendingAttachments((current) => {
          const next = { ...current }
          delete next[deletedId]
          return next
        })
        setDrafts((current) => {
          const next = { ...current }
          delete next[deletedId]
          return next
        })
        return
      }
      if (event.kind === 'MESSAGE_ADDED' && event.userId && event.userId !== me.id) {
        if (event.conversationId && event.sequence) {
          latestIncomingSequence.current.set(event.conversationId, event.sequence)
          void messengerApi.markDelivered(event.conversationId, event.sequence).catch(() => setError(t('messengerUnavailableDesc')))
        }
        playIncomingMessageSound()
      }
      void (async () => {
        const latestConversations = await loadConversations()
        if (!event.conversationId) return

        if (event.kind === 'MESSAGE_ADDED' && event.userId && event.userId !== me.id) {
          clearIncomingTyping(event.conversationId, event.userId)
          const conversation = latestConversations?.find((item) => item.id === event.conversationId)
            ?? conversationsRef.current.find((item) => item.id === event.conversationId)
          if (!conversation) return
          markConversationAttention(conversation.id)
          setConversations((current) => [
            conversation,
            ...current.filter((item) => item.id !== conversation.id),
          ])
          setOpenIds((current) => [...current.filter((id) => id !== conversation.id), conversation.id])
          setMinimizedIds((current) => {
            const next = new Set(current)
            next.delete(conversation.id)
            return next
          })
          onPanelClose()
          const hasLoadedHistory = messagesRef.current[conversation.id] !== undefined
          const loadMessages = event.messageId && hasLoadedHistory
            ? messengerApi.message(event.messageId, me.id).then((incoming) => {
              setMessages((current) => ({
                ...current,
                [conversation.id]: upsertDockMessage(current[conversation.id] ?? [], incoming),
              }))
            })
            : messengerApi.messages(conversation.id, me.id).then((items) => {
              setMessages((current) => ({ ...current, [conversation.id]: items }))
            })
          void loadMessages.then(() => setError(null)).catch(() => setError(t('messengerUnavailableDesc')))
          return
        }

        if (fullOpenIdsRef.current.includes(event.conversationId)) {
          const loadMessageChange = event.messageId && ['MESSAGE_ADDED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'REACTION_CHANGED'].includes(event.kind)
            ? messengerApi.message(event.messageId, me.id).then((incoming) => {
              setMessages((current) => ({
                ...current,
                [event.conversationId!]: upsertDockMessage(current[event.conversationId!] ?? [], incoming),
              }))
            })
            : messengerApi.messages(event.conversationId, me.id).then((items) => {
              setMessages((current) => ({ ...current, [event.conversationId!]: items }))
            })
          void loadMessageChange.catch(() => setError(t('messengerUnavailableDesc')))
        }
      })()
    }, () => setError(t('messengerUnavailableDesc')))
  }, [clearIncomingTyping, hidden, loadConversations, markConversationAttention, me.id, onPanelClose, t])

  useEffect(() => {
    if (hidden) return
    // One stream for every open chat instead of one per chat. Each event names its own
    // conversation, which is what the per-conversation closure used to provide.
    const watched = fullOpenIdKey.split(',').filter((id) => id.length > 0)
    return messengerApi.subscribeConversations(watched, (event) => {
      const conversationId = event.conversationId
      if (!conversationId || !watched.includes(conversationId)) return
      if (seenEventIds.current.has(event.eventId)) return
      seenEventIds.current.add(event.eventId)
      if (event.kind === 'TYPING_CHANGED') {
        applyTypingEvent(event)
        return
      }
      if (event.kind === 'MESSAGE_ADDED' && event.userId && event.userId !== me.id) {
        if (event.sequence) {
          latestIncomingSequence.current.set(conversationId, event.sequence)
          void messengerApi.markDelivered(conversationId, event.sequence).catch(() => setError(t('messengerUnavailableDesc')))
        }
        markConversationAttention(conversationId)
      }
      if (event.kind === 'MESSAGE_ADDED' && event.userId) clearIncomingTyping(conversationId, event.userId)
      const loadMessages = ['MESSAGE_ADDED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'REACTION_CHANGED'].includes(event.kind) && event.messageId
        ? messengerApi.message(event.messageId, me.id).then((incoming) => {
          setMessages((current) => ({
            ...current,
            [conversationId]: upsertDockMessage(current[conversationId] ?? [], incoming),
          }))
        })
        : messengerApi.messages(conversationId, me.id).then((items) => {
          setMessages((current) => ({ ...current, [conversationId]: items }))
        })
      void loadMessages.then(() => setError(null)).catch(() => setError(t('messengerUnavailableDesc')))
    }, () => setError(t('messengerUnavailableDesc')))
    // Keyed on the scalar rather than the array, so the stream is not rebuilt merely because
    // a new array instance was produced. `watched` is derived from that same key, which keeps
    // the dependency list honest.
  }, [applyTypingEvent, clearIncomingTyping, fullOpenIdKey, hidden, markConversationAttention, me.id, t])

  const openConversation = useCallback((conversation: MessengerConversationDto) => {
    setConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ])
    markConversationRead(conversation.id, conversation.lastMessage?.sequence)
    // Keep every opened conversation in least-recently-used order. Only the
    // newest three are rendered as full windows; older ones stay reachable as
    // avatar bubbles in the dock rail.
    setOpenIds((current) => [...current.filter((id) => id !== conversation.id), conversation.id])
    setMinimizedIds((current) => {
      const next = new Set(current)
      next.delete(conversation.id)
      return next
    })
    onPanelClose()
    if (!messages[conversation.id]) {
      void messengerApi.messages(conversation.id, me.id).then((items) => {
        setMessages((current) => ({ ...current, [conversation.id]: items }))
        setError(null)
      }).catch(() => setError(t('messengerUnavailableDesc')))
    }
  }, [markConversationRead, me.id, messages, onPanelClose, t])

  const openDirect = useCallback(async (profileId: string) => {
    const conversation = await messengerApi.createDirectConversation(profileId, me.id)
    openConversation(conversation)
  }, [me.id, openConversation])

  useImperativeHandle(ref, () => ({
    openDirect,
    openConversation,
    openComposer: () => setShowNewModal(true),
  }), [openConversation, openDirect])

  async function startConversation(person: UserSummary) {
    try {
      await openDirect(person.id)
      setShowNewModal(false)
    } catch {
      setError(t('messageActionError'))
    }
  }

  async function startGroupConversation(title: string, people: UserSummary[]) {
    try {
      const conversation = await messengerApi.createGroupConversation(title, people.map((person) => person.id), me.id)
      openConversation(conversation)
      window.dispatchEvent(new CustomEvent<MessengerConversationDto>('fakebook:conversation-upserted', { detail: conversation }))
      setShowNewModal(false)
    } catch {
      setError(t('messageActionError'))
    }
  }

  async function sendPayload(conversation: MessengerConversationDto, body: string, attachments: MediaUpload[]) {
    if ((!body && attachments.length === 0) || sendingId) return
    const replyToMessageId = replyToByConversationId[conversation.id] ?? null
    setComposeToolsConversationId((current) => current === conversation.id ? null : current)
    stopTyping(conversation.id)
    const optimistic: MessengerMessageDto = {
      id: `local-${crypto.randomUUID()}`,
      conversationId: conversation.id,
      sender: me,
      body,
      replyToMessageId,
      reactions: [],
      deleted: false,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments,
    }
    setDrafts((current) => ({ ...current, [conversation.id]: '' }))
    setPendingAttachments((current) => ({ ...current, [conversation.id]: [] }))
    setReplyToByConversationId((current) => ({ ...current, [conversation.id]: null }))
    setMessages((current) => ({ ...current, [conversation.id]: [...(current[conversation.id] ?? []), optimistic] }))
    setSendingId(conversation.id)
    try {
      const sent = await messengerApi.sendMessage(conversation.id, me, { body, attachments, replyToMessageId })
      setMessages((current) => ({
        ...current,
        [conversation.id]: (current[conversation.id] ?? []).map((item) => item.id === optimistic.id ? sent : item),
      }))
      setConversations((current) => current.map((item) => item.id === conversation.id
        ? { ...item, lastMessage: sent, updatedAt: sent.createdAt, unreadCount: 0 }
        : item))
      setError(null)
      void api.finalizePendingMedia(attachments).catch(() => setError(t('messengerUnavailableDesc')))
    } catch {
      setMessages((current) => ({ ...current, [conversation.id]: (current[conversation.id] ?? []).filter((item) => item.id !== optimistic.id) }))
      setDrafts((current) => ({ ...current, [conversation.id]: messengerLikeLevel(body) ? '' : body }))
      setPendingAttachments((current) => ({ ...current, [conversation.id]: attachments }))
      setReplyToByConversationId((current) => ({ ...current, [conversation.id]: replyToMessageId }))
      setError(t('messengerUnavailableDesc'))
    } finally {
      setSendingId(null)
    }
  }

  function applyDockMessageUpdate(incoming: MessengerMessageDto) {
    setMessages((current) => ({
      ...current,
      [incoming.conversationId]: upsertDockMessage(current[incoming.conversationId] ?? [], incoming),
    }))
    setConversations((current) => current.map((conversation) => conversation.id === incoming.conversationId && conversation.lastMessage?.id === incoming.id
      ? { ...conversation, lastMessage: incoming }
      : conversation))
  }

  async function reactToDockMessage(message: MessengerMessageDto, emoji: string | null) {
    try {
      const updated = await messengerApi.setMessageReaction(message.id, emoji, me.id)
      applyDockMessageUpdate(updated)
      setError(null)
    } catch (error) {
      setError(t('messengerUnavailableDesc'))
      throw error
    }
  }

  async function recallDockMessage(message: MessengerMessageDto) {
    try {
      const updated = await messengerApi.deleteMessage(message.id, me.id)
      applyDockMessageUpdate(updated)
      setError(null)
    } catch (error) {
      setError(t('messengerUnavailableDesc'))
      throw error
    }
  }

  function beginDockMessageEdit(message: MessengerMessageDto) {
    setReplyToByConversationId((current) => ({ ...current, [message.conversationId]: null }))
    setExpandedEditHistoryIds((current) => {
      if (!current.has(message.id)) return current
      const next = new Set(current)
      next.delete(message.id)
      return next
    })
    setEditingMessageId(message.id)
    setEditDraft(message.body)
    window.requestAnimationFrame(() => {
      miniMessageContainers.current.get(message.conversationId)?.parentElement
        ?.querySelector<HTMLTextAreaElement>('.mini-compose-input textarea')?.focus()
    })
  }

  function cancelDockMessageEdit(conversationId?: string) {
    setEditingMessageId(null)
    setEditDraft('')
    if (conversationId) {
      window.requestAnimationFrame(() => {
        miniMessageContainers.current.get(conversationId)?.parentElement
          ?.querySelector<HTMLTextAreaElement>('.mini-compose-input textarea')?.focus()
      })
    }
  }

  function toggleDockEditHistory(messageId: string) {
    setExpandedEditHistoryIds((current) => {
      const next = new Set(current)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  async function editDockMessage(event: FormEvent, message: MessengerMessageDto) {
    event.preventDefault()
    const text = editDraft.trim()
    if (!text || editBusy) return
    setEditBusy(true)
    try {
      const updated = await messengerApi.editMessage(message.id, text, me.id)
      applyDockMessageUpdate(updated)
      cancelDockMessageEdit(message.conversationId)
      setError(null)
    } catch {
      setError(t('messengerUnavailableDesc'))
    } finally {
      setEditBusy(false)
    }
  }

  async function forwardDockMessage(target: MessengerConversationDto) {
    if (!forwardingMessage) return
    try {
      const sent = await messengerApi.sendMessage(target.id, me, {
        body: forwardingMessage.body,
        attachments: forwardingMessage.attachments,
      })
      setMessages((current) => current[target.id]
        ? { ...current, [target.id]: upsertDockMessage(current[target.id], sent) }
        : current)
      setConversations((current) => current.map((conversation) => conversation.id === target.id
        ? { ...conversation, lastMessage: sent, updatedAt: sent.createdAt }
        : conversation))
      setError(null)
    } catch (error) {
      setError(t('messengerUnavailableDesc'))
      throw error
    }
  }

  async function send(event: FormEvent, conversation: MessengerConversationDto) {
    event.preventDefault()
    const editingMessage = editingMessageId
      ? (messages[conversation.id] ?? []).find((message) => message.id === editingMessageId)
      : undefined
    if (editingMessage) {
      await editDockMessage(event, editingMessage)
      return
    }
    await sendPayload(
      conversation,
      (drafts[conversation.id] ?? '').trim(),
      pendingAttachments[conversation.id] ?? [],
    )
  }

  async function attachFiles(conversationId: string, files: FileList | File[] | null) {
    if (!files?.length) return
    setUploadingId(conversationId)
    try {
      const uploaded = await api.uploadMediaFiles(Array.from(files).slice(0, 10))
      setPendingAttachments((current) => ({
        ...current,
        [conversationId]: [...(current[conversationId] ?? []), ...uploaded].slice(0, 10),
      }))
      setError(null)
    } catch {
      setError(t('messengerUnavailableDesc'))
    } finally {
      setUploadingId(null)
    }
  }

  function stopVoiceRecording(discard = false) {
    const recording = activeVoiceRecording.current
    if (!recording) return
    recording.discard ||= discard
    window.clearTimeout(recording.timeoutId)
    window.clearInterval(recording.tickerId)
    if (recording.recorder.state !== 'inactive') recording.recorder.stop()
  }

  async function toggleVoiceRecording(conversation: MessengerConversationDto) {
    const current = activeVoiceRecording.current
    if (current) {
      stopVoiceRecording(current.conversationId !== conversation.id)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('messengerUnavailableDesc'))
      return
    }

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : null
      if (!mimeType) throw new Error('This browser does not expose a supported audio recorder.')
      const recorder = new MediaRecorder(stream, { mimeType })
      const recording: ActiveVoiceRecording = {
        conversationId: conversation.id,
        recorder,
        stream,
        chunks: [],
        timeoutId: 0,
        tickerId: 0,
        startedAt: Date.now(),
        discard: false,
      }
      activeVoiceRecording.current = recording
      setRecordingId(conversation.id)
      setRecordingElapsedMs(0)
      setError(null)

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) recording.chunks.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        window.clearTimeout(recording.timeoutId)
        window.clearInterval(recording.tickerId)
        recording.stream.getTracks().forEach((track) => track.stop())
        if (activeVoiceRecording.current === recording) activeVoiceRecording.current = null
        setRecordingId((currentId) => currentId === conversation.id ? null : currentId)
        setRecordingElapsedMs(0)
        if (recording.discard || recording.chunks.length === 0) return

        void (async () => {
          setUploadingId(conversation.id)
          try {
            const contentType = recorder.mimeType.split(';', 1)[0] || 'audio/webm'
            const extension = contentType === 'audio/mp4' ? 'm4a' : 'webm'
            const blob = new Blob(recording.chunks, { type: contentType })
            const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: contentType })
            const [uploaded] = await api.uploadMediaFiles([file])
            if (!uploaded) throw new Error('Voice upload returned no asset.')
            const voice: MediaUpload = {
              ...uploaded,
              type: 'audio',
              mediaType: 'audio',
              contentType: uploaded.contentType || 'audio/webm',
              durationMs: uploaded.durationMs ?? Math.min(VOICE_RECORDING_LIMIT_MS, Date.now() - recording.startedAt),
            }
            setUploadingId(null)
            await sendPayload(conversation, '', [voice])
          } catch {
            setError(t('messengerUnavailableDesc'))
          } finally {
            setUploadingId((currentId) => currentId === conversation.id ? null : currentId)
          }
        })()
      }, { once: true })

      recorder.start(250)
      recording.tickerId = window.setInterval(() => {
        setRecordingElapsedMs(Math.min(VOICE_RECORDING_LIMIT_MS, Date.now() - recording.startedAt))
      }, 200)
      recording.timeoutId = window.setTimeout(() => stopVoiceRecording(), VOICE_RECORDING_LIMIT_MS)
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      setRecordingId(null)
      setRecordingElapsedMs(0)
      setError(t('messengerUnavailableDesc'))
    }
  }

  function removePendingAttachment(conversationId: string, attachment: MediaUpload) {
    setPendingAttachments((current) => ({
      ...current,
      [conversationId]: (current[conversationId] ?? []).filter((item) => item.url !== attachment.url),
    }))
    void api.cancelPendingMedia(attachment).catch(() => undefined)
  }

  function closeChat(conversationId: string) {
    setComposeToolsConversationId((current) => current === conversationId ? null : current)
    if (activeVoiceRecording.current?.conversationId === conversationId) stopVoiceRecording(true)
    if ((messagesRef.current[conversationId] ?? []).some((message) => message.id === editingMessageId)) {
      cancelDockMessageEdit()
    }
    stopTyping(conversationId)
    setOpenIds((current) => current.filter((id) => id !== conversationId))
    setMinimizedIds((current) => {
      const next = new Set(current)
      next.delete(conversationId)
      return next
    })
    setBubblePreviewAnchor((current) => current?.conversationId === conversationId ? null : current)
  }

  function showBubblePreview(conversationId: string, element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    setBubblePreviewAnchor({
      conversationId,
      top: Math.max(30, Math.min(window.innerHeight - 30, rect.top + rect.height / 2)),
      right: Math.max(8, window.innerWidth - rect.left + 13),
    })
  }

  function updateManagedConversation(updated: MessengerConversationDto) {
    setConversations((current) => current.map((conversation) => conversation.id === updated.id ? updated : conversation))
    conversationsRef.current = conversationsRef.current.map((conversation) => conversation.id === updated.id ? updated : conversation)
    if (updated.lastMessage) {
      setMessages((current) => current[updated.id]
        ? { ...current, [updated.id]: upsertDockMessage(current[updated.id], updated.lastMessage!) }
        : current)
    }
    setError(null)
    window.dispatchEvent(new CustomEvent<MessengerConversationDto>('fakebook:conversation-upserted', { detail: updated }))
  }

  function removeConversationLocally(conversationId: string) {
    if (activeVoiceRecording.current?.conversationId === conversationId) stopVoiceRecording(true)
    stopTyping(conversationId)
    setManagedGroupId((current) => current === conversationId ? null : current)
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId))
    conversationsRef.current = conversationsRef.current.filter((conversation) => conversation.id !== conversationId)
    setOpenIds((current) => current.filter((id) => id !== conversationId))
    setMinimizedIds((current) => {
      const next = new Set(current)
      next.delete(conversationId)
      return next
    })
    setMessages((current) => {
      const next = { ...current }
      delete next[conversationId]
      return next
    })
    const pending = pendingAttachments[conversationId] ?? []
    void Promise.allSettled(pending.map((attachment) => api.cancelPendingMedia(attachment)))
    setPendingAttachments((current) => {
      const next = { ...current }
      delete next[conversationId]
      return next
    })
    setDrafts((current) => {
      const next = { ...current }
      delete next[conversationId]
      return next
    })
    setReplyToByConversationId((current) => {
      const next = { ...current }
      delete next[conversationId]
      return next
    })
    clearConversationAttention(conversationId)
    setError(null)
  }

  function minimizeConversation(conversationId: string) {
    if (activeVoiceRecording.current?.conversationId === conversationId) stopVoiceRecording(true)
    stopTyping(conversationId)
    setMinimizedIds((current) => {
      const next = new Set(current)
      next.add(conversationId)
      return next
    })
  }

  const panelConversations = useMemo(() => {
    const query = panelQuery.trim().toLocaleLowerCase()
    return conversations.filter((conversation) => {
      if (panelFilter === 'unread' && conversation.unreadCount < 1) return false
      if (panelFilter === 'groups' && conversation.type !== 'GROUP') return false
      return !query || conversationName(conversation, me).toLocaleLowerCase().includes(query)
    })
  }, [conversations, me, panelFilter, panelQuery])

  const openConversations = fullOpenIds.flatMap((id) => {
    const conversation = conversations.find((item) => item.id === id)
    return conversation ? [conversation] : []
  })
  const collapsedConversations = collapsedOpenIds.flatMap((id) => {
    const conversation = conversations.find((item) => item.id === id)
    return conversation ? [conversation] : []
  })
  const managedGroup = managedGroupId
    ? conversations.find((conversation) => conversation.id === managedGroupId && conversation.type === 'GROUP') ?? null
    : null
  const showPinnedComposeRail = showComposeRail && !mediaViewerLayout
  const hasCollapsedRail = !hidden && (showNewModal || showPinnedComposeRail || collapsedConversations.length > 0 || (mediaViewerLayout && openConversations.length > 0))
  const bubblePreviewConversation = bubblePreviewAnchor
    ? collapsedConversations.find((conversation) => conversation.id === bubblePreviewAnchor.conversationId) ?? null
    : null
  const bubblePreviewName = bubblePreviewConversation ? conversationName(bubblePreviewConversation, me) : ''
  const bubblePreviewActivity = bubblePreviewConversation ? bubbleConversationActivity(bubblePreviewConversation, me.id, t) : null

  useEffect(() => {
    if (bubblePreviewAnchor && !collapsedOpenIds.includes(bubblePreviewAnchor.conversationId)) setBubblePreviewAnchor(null)
  }, [bubblePreviewAnchor, collapsedOpenIds])

  useEffect(() => {
    document.body.classList.toggle('mini-chat-bubble-rail-open', hasCollapsedRail)
    return () => document.body.classList.remove('mini-chat-bubble-rail-open')
  }, [hasCollapsedRail])

  if (hidden) return null

  return <>
    {panelOpen && <aside ref={messengerPopoverRef} className="messenger-popover messenger-popover-redesign" role="dialog" aria-label={t('messages')}>
      <header className="messenger-popover-head">
        <div><h2>{t('chats')}</h2>{error && <small>{error}</small>}</div>
        <div className="messenger-popover-actions">

          <button type="button" aria-label={t('openMessenger')} onClick={() => onOpenAll()} disabled style={{ opacity: 0.5 }}><Icon name="expand" size={19} /></button>
          <button type="button" aria-label={t('newMessage')} onClick={() => setShowNewModal(true)}><Icon name="edit" size={19} /></button>
        </div>
      </header>
      <label className="messenger-popover-search"><Icon name="search" size={20} /><input value={panelQuery} onChange={(event) => setPanelQuery(event.target.value)} placeholder={t('searchMessenger')} /></label>
      <div className="messenger-popover-tabs" role="tablist" aria-label={t('inboxFilters')}>
        <button type="button" className={panelFilter === 'all' ? 'active' : ''} onClick={() => setPanelFilter('all')}>{t('allNotifications')}</button>
        <button type="button" className={panelFilter === 'unread' ? 'active' : ''} onClick={() => setPanelFilter('unread')}>{t('unreadOnly')}</button>
        <button type="button" className={panelFilter === 'groups' ? 'active' : ''} onClick={() => setPanelFilter('groups')}>{t('groups')}</button>
      </div>
      <div className="messenger-popover-list">{loading ? <div className="messenger-loading"><span className="spinner" /></div> : panelConversations.length === 0 ? <p className="muted">{error ?? t('noChatsFound')}</p> : panelConversations.map((conversation) => {
        const name = conversationName(conversation, me)
        const other = conversation.type === 'DIRECT'
          ? conversation.participants.find((person) => person.id !== me.id)
          : undefined
        return <button type="button" className={conversation.unreadCount > 0 ? 'unread' : ''} key={conversation.id} onClick={() => openConversation(conversation)}><Avatar name={name} src={conversationAvatar(conversation, me)} size={48} online={Boolean(other && presenceByUserId[other.id]?.isOnline)} /><span><strong>{name}</strong><small>{conversation.lastMessage?.kind !== 'SYSTEM' && conversation.lastMessage?.sender.id === me.id ? `${t('you')}: ` : ''}{messengerConversationPreview(conversation.lastMessage, t) || t('startConversation')} · {relativeTime(conversation.updatedAt, locale)}</small></span></button>
      })}</div>
    </aside>}

    <div className={`mini-chat-region${hasCollapsedRail ? ' has-bubble-rail' : ''}${showPinnedComposeRail ? ' home-compose-rail' : ''}${mediaViewerLayout ? ' media-viewer-compose-rail' : ''}${mediaOverlayOpen ? ' media-viewer-comments-rail' : ''}`} data-layout={mediaViewerLayout ? 'media-viewer' : 'default'}><div className="mini-chat-dock-layout">{(openConversations.length > 0 || showNewModal) && <div className="mini-chat-windows" aria-label={t('messages')}>{openConversations.map((conversation) => {
      const name = conversationName(conversation, me)
      const other = conversation.participants.find((person) => person.id !== me.id)
      const isFriend = other
        ? friendshipByUserId[other.id] ?? (friendIds.has(other.id) ? true : undefined)
        : undefined
      const conversationMessages = messages[conversation.id] ?? []
      const latestOwnPendingMessage = [...conversationMessages].reverse().find((message) => !message.deleted && message.sender.id === me.id && (message.status === 'sent' || message.status === 'delivered'))
      const latestOwnReadMessage = [...conversationMessages].reverse().find((message) => !message.deleted && message.sender.id === me.id && message.status === 'read')
      const attachments = pendingAttachments[conversation.id] ?? []
      const draft = drafts[conversation.id] ?? ''
      const replyTarget = conversationMessages.find((message) => message.id === replyToByConversationId[conversation.id]) ?? null
      const editingMessage = editingMessageId
        ? conversationMessages.find((message) => message.id === editingMessageId) ?? null
        : null
      const composeValue = editingMessage ? editDraft : draft
      const composeHasText = composeValue.length > 0
      const composeToolsOpen = composeToolsConversationId === conversation.id
      const visualBreaks: MessageVisualBreaks = {
        beforeMessageIds: new Set(conversationMessages
          .filter((message) => Boolean(message.editedAt) || message.id === editingMessageId)
          .map((message) => message.id)),
        afterMessageIds: new Set([
          latestOwnPendingMessage?.id,
          latestOwnReadMessage?.id,
        ].filter((id): id is string => Boolean(id))),
      }
      const presence = other ? presenceByUserId[other.id] : undefined
      const groupPresence = conversation.type === 'GROUP'
        ? groupPresenceSummary(conversation, me.id, presenceByUserId, t, presenceNow)
        : null
      const typingUserIds = Object.entries(typingByConversationId[conversation.id] ?? {})
        .filter(([, expiresAt]) => expiresAt > Date.now())
        .map(([userId]) => userId)
      const typingPerson = conversation.participants.find((person) => typingUserIds.includes(person.id))
      const isTyping = Boolean(typingPerson)
      const isOnline = conversation.type === 'GROUP' ? Boolean(groupPresence?.onlineCount) : Boolean(presence?.isOnline)
      const needsAttention = attentionConversationIds.has(conversation.id)
      const readFromChatInteraction = (target: EventTarget) => {
        if (target instanceof Element && target.closest('[data-chat-read-ignore="true"]')) return
        markConversationRead(conversation.id)
      }
      return <section className={`mini-chat-window${needsAttention ? ' has-attention' : ''}`} key={conversation.id} aria-label={name} onPointerDownCapture={(event) => readFromChatInteraction(event.target)} onClickCapture={(event) => readFromChatInteraction(event.target)}>
        <header className="mini-chat-head">
          <button type="button" className="mini-chat-id" onClick={() => {
            if (conversation.type === 'GROUP') setManagedGroupId(conversation.id)
            else if (other) onOpenProfile(other.id)
          }}><Avatar name={name} src={conversationAvatar(conversation, me)} size={29} online={isOnline} /></button>
          <div className="mini-chat-name"><strong>{name}<VerifiedBadge verified={other?.isVerified} size={12} /></strong><small className={isTyping ? 'typing' : isOnline ? 'online' : 'offline'}>{isTyping ? t('typingNow') : conversation.type === 'GROUP' ? groupPresence?.label ?? t('offline') : formatPresence(presence, t, presenceNow)}</small></div>
          <div className="mini-chat-controls">
            <button type="button" className="mini-ctrl mini-minimize" data-chat-read-ignore="true" aria-label={t('minimize')} onClick={() => minimizeConversation(conversation.id)}>−</button>
            <button type="button" className="mini-ctrl" data-chat-read-ignore="true" aria-label={t('close')} onClick={() => closeChat(conversation.id)}><Icon name="close" size={20} className="mini-chat-close-icon" /></button>
          </div>
        </header>
        <>
          <MiniChatMessages activityKey={`${conversationMessages[conversationMessages.length - 1]?.id ?? 'empty'}:${typingPerson?.id ?? ''}`} conversationId={conversation.id} editFocusId={editingMessage?.id} onContainerChange={registerMiniMessageContainer}>
            <div className={`mini-chat-intro${conversationMessages.length > 0 ? ' has-history' : ''}`}><Avatar name={name} src={conversationAvatar(conversation, me)} size={60} online={isOnline} /><strong>{name}</strong>{conversation.type === 'DIRECT' ? <small>{isFriend === undefined ? t('relationshipLoading') : isFriend ? t('friendsOnFakebook') : t('notFriendsOnFakebook')}</small> : <small>{t('startConversation')}</small>}</div>
            {conversationMessages.map((message, index) => {
              if (message.kind === 'SYSTEM') {
                return <SystemMessageLine key={message.id} message={message} viewerId={me.id} compact />
              }
              const mine = message.sender.id === me.id
              const showAvatar = shouldShowAvatar(conversationMessages, index, visualBreaks)
              const showTime = shouldShowTimestamp(conversationMessages, index)
              const groupPosition = messageGroupPosition(conversationMessages, index, visualBreaks)
              const likeLevel = messengerLikeLevel(message.body)
              const repliedMessage = message.replyToMessageId
                ? conversationMessages.find((candidate) => candidate.id === message.replyToMessageId)
                : null
              const hasReactions = Boolean(message.reactions?.length)
              const actionable = !message.deleted && !message.id.startsWith('local-')
              const canEdit = actionable && mine && Boolean(message.body.trim()) && !likeLevel &&
                Date.now() - new Date(message.createdAt).getTime() <= 15 * 60_000
              const senderIsAdmin = conversation.type === 'GROUP' &&
                conversation.participants.some((participant) => participant.id === message.sender.id && participant.role === 'ADMIN')
              const editing = editingMessageId === message.id
              const historyExpanded = expandedEditHistoryIds.has(message.id)
              return <div className={`mini-msg-entry${editing ? ' is-editing' : ''}`} data-message-id={message.id} inert={Boolean(editingMessage) && !editing} key={message.id}>
                {showTime && <div className="mini-msg-time">{formatTime(message.createdAt)}</div>}
                <div className={`mini-msg-line group-${groupPosition}${mine ? ' mine' : ''}`}>
                  {!mine && <span className="mini-msg-avatar">{showAvatar && <MessageSenderAvatar person={message.sender} size={26} isAdmin={senderIsAdmin} />}</span>}
                  <div className={`mini-msg-stack message-interaction-host${hasReactions ? ' has-reactions' : ''}`}>
                    {(editing || message.editedAt) && <MessageEditMarker
                      active={editing}
                      expanded={historyExpanded}
                      onClick={() => editing
                        ? cancelDockMessageEdit(conversation.id)
                        : toggleDockEditHistory(message.id)}
                    />}
                    {historyExpanded && !editing && <MessageEditHistory revisions={message.editHistory ?? []} compact />}
                    {message.replyToMessageId && <MessageReplyPreview message={repliedMessage} missing={!repliedMessage} compact viewerId={me.id} replyingSender={message.sender} onNavigate={repliedMessage ? () => navigateToDockMessage(conversation.id, message.replyToMessageId!) : undefined} />}
                    <div className="message-primary-shell">
                      <div className="message-content-hover-target">
                        {message.deleted
                          ? <p className="mini-msg-bubble message-deleted-bubble">Tin nhắn đã được thu hồi</p>
                          : likeLevel
                            ? <span className={`messenger-like-message level-${likeLevel}`} aria-label={t('like')}><MessengerLikeIcon size={48} /></span>
                            : message.body && <><p className="mini-msg-bubble"><RichTextContent content={message.body} onNavigate={onNavigate} /></p><LinkPreview content={message.body} onNavigate={onNavigate} /></>}
                        {!message.deleted && <MediaGallery attachments={message.attachments} compact messageId={message.id} mine={mine} senderName={message.sender.displayName} loadConversationMedia={() => messengerApi.conversationMedia(conversation.id)} onForward={() => setForwardingMessage(message)} />}
                        <MessageHoverTimestamp createdAt={message.createdAt} mine={mine} />
                        <MessageReactionSummary reactions={message.reactions} viewerId={me.id} />
                      </div>
                      {actionable && !editing && <MessageActionRail compact message={message} viewerId={me.id} mine={mine} canEdit={canEdit} onEdit={() => beginDockMessageEdit(message)} onReact={(emoji) => reactToDockMessage(message, emoji)} onReply={() => replyToDockMessage(conversation.id, message.id)} onRecall={mine ? () => recallDockMessage(message) : undefined} onForward={() => setForwardingMessage(message)} />}
                    </div>
                  </div>
                </div>
                {mine && latestOwnPendingMessage?.id === message.id && <div className="mini-message-delivery-state"><span>{message.status === 'delivered' ? 'Đã nhận' : 'Đã gửi'}</span></div>}
                {mine && latestOwnReadMessage?.id === message.id && other && <div className="mini-message-delivery-state read" title={`${other.displayName} đã xem`}><Avatar name={other.displayName} src={other.avatarUrl} size={14} /></div>}
              </div>
            })}
            {typingPerson && <div className="mini-typing-line" aria-label={`${typingPerson.displayName} ${t('typingNow')}`}><span className="mini-msg-avatar"><MessageSenderAvatar person={typingPerson} size={26} isAdmin={conversation.type === 'GROUP' && typingPerson.role === 'ADMIN'} /></span><span className="mini-typing-bubble"><i /><i /><i /></span></div>}
          </MiniChatMessages>
          {editingMessage
            ? <div className="mini-editing-bar"><MessageEditingBar message={editingMessage} compact onCancel={() => cancelDockMessageEdit(conversation.id)} /></div>
            : replyTarget && <div className="mini-replying-bar"><MessageReplyPreview message={replyTarget} viewerId={me.id} compact composer onCancel={() => setReplyToByConversationId((current) => ({ ...current, [conversation.id]: null }))} /></div>}
          {recordingId === conversation.id ? (
            <div className="mini-chat-compose mini-chat-voice-compose">
              <button type="button" className="mini-voice-cancel" aria-label={t('cancel')} onClick={() => stopVoiceRecording(true)}>
                <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                  <path d="M2.25 2.25 9.75 9.75M9.75 2.25 2.25 9.75" />
                </svg>
              </button>
              <div className="mini-voice-capture">
                <button type="button" className="mini-voice-stop" aria-label={t('stopRecording')} onClick={() => stopVoiceRecording()}><span aria-hidden="true" /></button>
                <span
                  className="mini-voice-limit-track"
                  role="progressbar"
                  aria-label={`${t('recordVoice')} 4:00`}
                  aria-valuemin={0}
                  aria-valuemax={VOICE_RECORDING_LIMIT_MS}
                  aria-valuenow={Math.min(VOICE_RECORDING_LIMIT_MS, recordingElapsedMs)}
                  aria-valuetext={`${formatVoiceRecordingTime(recordingElapsedMs)} / 4:00`}
                >
                  <i aria-hidden="true" style={{ width: `${Math.min(100, recordingElapsedMs / VOICE_RECORDING_LIMIT_MS * 100)}%` }} />
                </span>
                <span className="mini-voice-duration">{formatVoiceRecordingTime(recordingElapsedMs)}</span>
              </div>
              <button type="button" className="mini-compose-btn send ready mini-voice-send" aria-label={t('sendMessage')} onClick={() => stopVoiceRecording()}><Icon name="send" size={22} /></button>
            </div>
          ) : (
            <form className={`mini-chat-compose${composeHasText ? ' is-writing' : ''}${attachments.length > 0 ? ' has-attachments' : ''}`} onSubmit={(event) => void send(event, conversation)}>
              <div className={`mini-compose-tools${composeHasText ? ' compact' : ''}`} data-mini-compose-tools>
                {composeHasText
                  ? <div className="mini-compose-more-wrap">
                      <button type="button" className="mini-compose-btn mini-compose-more-btn" aria-label={t('more')} aria-expanded={composeToolsOpen} onClick={() => setComposeToolsConversationId((current) => current === conversation.id ? null : conversation.id)}><Icon name="plus" size={20} /></button>
                      {composeToolsOpen && <div className="mini-compose-tools-menu" role="group" aria-label={t('more')}>
                        <button type="button" className="mini-compose-btn voice" aria-label={t('recordVoice')} disabled={Boolean(editingMessage) || uploadingId === conversation.id || sendingId === conversation.id || recordingId !== null} onClick={() => { setComposeToolsConversationId(null); void toggleVoiceRecording(conversation) }}><Icon name="mic" size={21} /></button>
                        <label className={`mini-compose-btn${editingMessage ? ' disabled' : ''}`} aria-label={t('addAttachment')}><Icon name="photo" size={21} /><input className="messenger-file-input" type="file" multiple accept={MESSENGER_ATTACHMENT_ACCEPT} disabled={Boolean(editingMessage) || uploadingId === conversation.id} onChange={(event) => { setComposeToolsConversationId(null); void attachFiles(conversation.id, event.currentTarget.files); event.currentTarget.value = '' }} /></label>
                        <StickerButton disabled={Boolean(editingMessage) || sendingId === conversation.id} onPick={(sticker) => { setComposeToolsConversationId(null); void sendPayload(conversation, sticker, []) }} />
                      </div>}
                    </div>
                  : <>
                      <button type="button" className="mini-compose-btn voice" aria-label={t('recordVoice')} disabled={Boolean(editingMessage) || uploadingId === conversation.id || sendingId === conversation.id || recordingId !== null} onClick={() => void toggleVoiceRecording(conversation)}><Icon name="mic" size={21} /></button>
                      <label className={`mini-compose-btn${editingMessage ? ' disabled' : ''}`} aria-label={t('addAttachment')}><Icon name="photo" size={21} /><input className="messenger-file-input" type="file" multiple accept={MESSENGER_ATTACHMENT_ACCEPT} disabled={Boolean(editingMessage) || uploadingId === conversation.id} onChange={(event) => { void attachFiles(conversation.id, event.currentTarget.files); event.currentTarget.value = '' }} /></label>
                      <StickerButton disabled={Boolean(editingMessage) || sendingId === conversation.id} onPick={(sticker) => void sendPayload(conversation, sticker, [])} />
                    </>}
              </div>
              <div className="mini-compose-body">
                {attachments.length > 0 && <div className="mini-compose-previews">{attachments.map((attachment) => <div className="mini-compose-preview" key={attachment.url}><MediaAttachmentPreview attachment={attachment} /><button type="button" aria-label={t('removeMedia')} onClick={() => removePendingAttachment(conversation.id, attachment)}><Icon name="close" size={14} /></button></div>)}</div>}
                <label className="mini-compose-input"><MiniComposerTextarea value={composeValue} onChange={(event) => {
                  if (editingMessage) {
                    setEditDraft(event.target.value)
                    if (event.target.value.length === 0) setComposeToolsConversationId((current) => current === conversation.id ? null : current)
                  } else updateDraft(conversation.id, event.target.value)
                }} onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }} onPaste={(event) => {
                  if (editingMessage || attachments.length >= 10) return
                  const pastedImages = clipboardImageFiles(event.clipboardData)
                  if (pastedImages.length > 0) {
                    event.preventDefault()
                    void attachFiles(conversation.id, pastedImages.slice(0, 10 - attachments.length))
                    return
                  }
                  const pasted = event.clipboardData.getData('text').trim()
                  if (!isDirectImageUrl(pasted)) return
                  event.preventDefault()
                  void remoteImageFileFromUrl(pasted).then((file) => attachFiles(conversation.id, [file])).catch(() => updateDraft(conversation.id, `${draft}${draft ? ' ' : ''}${pasted}`))
                }} placeholder="Aa" /><EmojiButton onPick={(emoji) => editingMessage ? setEditDraft(`${editDraft}${emoji}`) : updateDraft(conversation.id, `${draft}${emoji}`)} /></label>
              </div>
              {editingMessage || draft.trim() || attachments.length > 0 ? <button type="submit" className="mini-compose-btn send ready" aria-label={t('sendMessage')} disabled={editBusy || sendingId === conversation.id || uploadingId === conversation.id || (Boolean(editingMessage) && !editDraft.trim())}><Icon name="send" size={22} /></button> : <HoldLikeButton label={t('like')} disabled={sendingId === conversation.id} onSend={(level) => void sendPayload(conversation, encodeMessengerLike(level), [])} />}
            </form>
          )}
        </>
      </section>
    })}{showNewModal && <NewConversationPanel creatorName={me.displayName} friends={friends} onStart={startConversation} onCreateGroup={startGroupConversation} onClose={() => setShowNewModal(false)} />}</div>}
      {hasCollapsedRail && <aside className="mini-chat-bubble-rail" aria-label={t('messages')}>
        <div className="mini-chat-overflow-list" onScroll={() => setBubblePreviewAnchor(null)}>{collapsedConversations.map((conversation) => {
          const name = conversationName(conversation, me)
          const other = conversation.type === 'DIRECT'
            ? conversation.participants.find((person) => person.id !== me.id)
            : undefined
          const groupPresence = conversation.type === 'GROUP'
            ? groupPresenceSummary(conversation, me.id, presenceByUserId, t, presenceNow)
            : null
          const unreadCount = Math.max(0, conversation.unreadCount)
          return <div
            className={`mini-chat-bubble-item${unreadCount > 0 ? ' has-unread' : ''}`}
            key={conversation.id}
            onMouseEnter={(event) => showBubblePreview(conversation.id, event.currentTarget)}
            onMouseLeave={() => setBubblePreviewAnchor((current) => current?.conversationId === conversation.id ? null : current)}
            onFocus={(event) => showBubblePreview(conversation.id, event.currentTarget)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setBubblePreviewAnchor((current) => current?.conversationId === conversation.id ? null : current)
            }}
          >
            <button
              type="button"
              className="mini-chat-overflow-avatar"
              aria-label={`${t('messages')}: ${name}`}
              onClick={() => { setBubblePreviewAnchor(null); openConversation(conversation) }}
            >
              <Avatar name={name} src={conversationAvatar(conversation, me)} size={40} title={false} online={conversation.type === 'GROUP' ? Boolean(groupPresence?.onlineCount) : Boolean(other && presenceByUserId[other.id]?.isOnline)} />
            </button>
            <button type="button" className="mini-chat-bubble-dismiss" aria-label={`${t('close')}: ${name}`} onClick={(event) => { event.stopPropagation(); closeChat(conversation.id) }}>
              {unreadCount > 0 && <span className="mini-chat-bubble-unread-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              <span className="mini-chat-bubble-close-circle"><Icon name="close" size={7} /></span>
            </button>
          </div>
        })}</div>
        <button type="button" className="mini-chat-new-button" aria-label={t('newMessage')} title={t('newMessage')} aria-expanded={showNewModal} onClick={() => setShowNewModal(true)}><Icon name="compose" size={23} className="mini-chat-compose-icon" /></button>
      </aside>}
    </div></div>

    {bubblePreviewAnchor && bubblePreviewConversation && bubblePreviewActivity && createPortal(<div className="mini-chat-bubble-preview" style={{ top: bubblePreviewAnchor.top, right: bubblePreviewAnchor.right }} aria-hidden="true">
      <strong>{bubblePreviewName}</strong>
      <small>{bubblePreviewActivity.senderId !== me.id && bubblePreviewConversation.unreadCount > 0 && <i className="mini-chat-bubble-preview-unread" />}{bubblePreviewActivity.senderId === me.id && <span className="mini-chat-bubble-preview-own">{t('you')}:</span>}<span className="mini-chat-bubble-preview-message">{bubblePreviewActivity.text}</span></small>
    </div>, document.body)}

    {forwardingMessage && <ForwardMessageDialog message={forwardingMessage} conversations={conversations} me={me} onForward={forwardDockMessage} onClose={() => setForwardingMessage(null)} />}
    {managedGroup && <GroupConversationManager me={me} friends={friends} conversation={managedGroup} onClose={() => setManagedGroupId(null)} onUpdated={updateManagedConversation} onRemoved={removeConversationLocally} onOpenProfile={onOpenProfile} />}
  </>
})

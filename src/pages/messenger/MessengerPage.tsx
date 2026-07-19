import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../api/client'
import { messengerApi } from '../../api/messenger'
import type { MessengerPresenceDto, MessengerRealtimeEvent } from '../../api/messenger'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Icon } from '../../components/Icon'
import { useI18n } from '../../i18n'
import { ConversationDetail } from './ConversationDetail'
import { ConversationList } from './ConversationList'
import { ForwardMessageDialog } from './ForwardMessageDialog'
import { MessageThread } from './MessageThread'
import { NewConversationModal } from './NewConversationModal'
import { encodeMessengerLike } from './helpers'
import type { MessengerLikeLevel } from './helpers'
import './MessengerPage.css'

interface MessengerPageProps {
  me: UserSummary
  friends: UserSummary[]
  onOpenProfile: (id: string) => void
  initialConversationId?: string | null
}

function upsertMessage(items: MessengerMessageDto[], incoming: MessengerMessageDto): MessengerMessageDto[] {
  const index = items.findIndex((item) => item.id === incoming.id)
  if (index < 0) return [...items, incoming]
  const rank: Record<MessengerMessageDto['status'], number> = { sending: 0, sent: 1, delivered: 2, read: 3 }
  return items.map((item, itemIndex) => itemIndex === index
    ? { ...incoming, status: rank[item.status] > rank[incoming.status] ? item.status : incoming.status }
    : item)
}

function isNewerSequence(next: string, previous?: string): boolean {
  try {
    return BigInt(next) > BigInt(previous ?? '0')
  } catch {
    return next !== previous
  }
}

export function MessengerPage({ me, friends, onOpenProfile, initialConversationId = null }: MessengerPageProps) {
  const { t } = useI18n()
  const [conversations, setConversations] = useState<MessengerConversationDto[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, MessengerMessageDto[]>>({})
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingAttachmentsByConversation, setPendingAttachmentsByConversation] = useState<Record<string, MediaUpload[]>>({})
  const [uploadingConversationId, setUploadingConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiState, setApiState] = useState<'gateway' | 'unavailable'>('gateway')
  const [showNewModal, setShowNewModal] = useState(false)
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const [showDetail, setShowDetail] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'communities'>('inbox')
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, MessengerPresenceDto>>({})
  const [typingByConversationId, setTypingByConversationId] = useState<Record<string, string>>({})
  const [replyToByConversationId, setReplyToByConversationId] = useState<Record<string, string | null>>({})
  const [forwardingMessage, setForwardingMessage] = useState<MessengerMessageDto | null>(null)
  const seenEventIds = useRef(new Set<string>())
  const outgoingTypingTimers = useRef(new Map<string, number>())
  const outgoingTypingSentAt = useRef(new Map<string, number>())
  const incomingTypingTimers = useRef(new Map<string, number>())
  const lastMarkedReadSequence = useRef(new Map<string, string>())

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
    outgoingTypingTimers.current.set(conversationId, window.setTimeout(() => stopTyping(conversationId), 1_200))
  }, [stopTyping])

  const applyTypingEvent = useCallback((event: MessengerRealtimeEvent) => {
    if (event.kind !== 'TYPING_CHANGED' || !event.conversationId || !event.userId || event.userId === me.id) return
    const key = `${event.conversationId}:${event.userId}`
    const existingTimer = incomingTypingTimers.current.get(key)
    if (existingTimer !== undefined) window.clearTimeout(existingTimer)
    const expiresAt = event.expiresAt ? new Date(event.expiresAt).getTime() : 0
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      incomingTypingTimers.current.delete(key)
      setTypingByConversationId((current) => {
        if (current[event.conversationId!] !== event.userId) return current
        const next = { ...current }
        delete next[event.conversationId!]
        return next
      })
      return
    }
    setTypingByConversationId((current) => ({ ...current, [event.conversationId!]: event.userId! }))
    incomingTypingTimers.current.set(key, window.setTimeout(() => {
      incomingTypingTimers.current.delete(key)
      setTypingByConversationId((current) => {
        if (current[event.conversationId!] !== event.userId) return current
        const next = { ...current }
        delete next[event.conversationId!]
        return next
      })
    }, Math.max(0, expiresAt - Date.now()) + 50))
  }, [me.id])

  const loadConversations = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    try {
      const items = await messengerApi.conversations(me.id)
      setConversations(items)
      setSelectedId((current) => initialConversationId && items.some((item) => item.id === initialConversationId)
        ? initialConversationId
        : current ?? items[0]?.id ?? null)
      setApiState('gateway')
    } catch {
      if (initial) {
        setConversations([])
        setSelectedId(null)
      }
      setApiState('unavailable')
    } finally {
      if (initial) setLoading(false)
    }
  }, [initialConversationId, me.id])

  useEffect(() => { void loadConversations(true) }, [loadConversations])

  useEffect(() => messengerApi.subscribeInbox((event) => {
    if (seenEventIds.current.has(event.eventId)) return
    seenEventIds.current.add(event.eventId)
    void loadConversations()
    if (['MESSAGE_ADDED', 'MESSAGE_DELETED', 'REACTION_CHANGED'].includes(event.kind) && event.conversationId && event.messageId) {
      void messengerApi.message(event.messageId, me.id).then((incoming) => {
        setMessages((current) => {
          const existing = current[event.conversationId!]
          if (!existing) return current
          return { ...current, [event.conversationId!]: upsertMessage(existing, incoming) }
        })
        setApiState('gateway')
      }).catch(() => setApiState('unavailable'))
    }
  }, () => setApiState('unavailable')), [loadConversations, me.id])

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0] ?? null
  const selectedOther = selected?.type === 'DIRECT'
    ? selected.participants.find((participant) => participant.id !== me.id)
    : undefined
  const presenceUserIds = useMemo(() => [...new Set(conversations.flatMap((conversation) => {
    if (conversation.type !== 'DIRECT') return []
    const other = conversation.participants.find((participant) => participant.id !== me.id)
    return other ? [other.id] : []
  }))], [conversations, me.id])
  const presenceUserIdKey = presenceUserIds.join(',')

  useEffect(() => {
    if (presenceUserIds.length === 0) return
    let active = true
    const refreshPresence = () => {
      void messengerApi.presence(presenceUserIds).then((statuses) => {
        if (active) setPresenceByUserId((current) => ({
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
  }, [presenceUserIdKey])

  useEffect(() => {
    if (!selected || messages[selected.id]) return
    let cancelled = false
    messengerApi.messages(selected.id, me.id)
      .then((items) => { if (!cancelled) setMessages((current) => ({ ...current, [selected.id]: items })) })
      .catch(() => {
        if (!cancelled) {
          setMessages((current) => ({ ...current, [selected.id]: [] }))
          setApiState('unavailable')
        }
      })
    return () => { cancelled = true }
  }, [me.id, messages, selected])

  useEffect(() => {
    if (!selected) return
    return messengerApi.subscribeConversation(selected.id, (event) => {
      if (seenEventIds.current.has(event.eventId)) return
      seenEventIds.current.add(event.eventId)
      if (event.kind === 'TYPING_CHANGED') {
        applyTypingEvent(event)
        return
      }
      if (event.kind === 'MESSAGE_ADDED' && event.userId) {
        setTypingByConversationId((current) => {
          if (current[selected.id] !== event.userId) return current
          const next = { ...current }
          delete next[selected.id]
          return next
        })
      }
      if (['MESSAGE_ADDED', 'MESSAGE_DELETED', 'REACTION_CHANGED'].includes(event.kind) && event.messageId) {
        void messengerApi.message(event.messageId, me.id).then((incoming) => {
          setMessages((current) => ({
            ...current,
            [selected.id]: upsertMessage(current[selected.id] ?? [], incoming),
          }))
          setApiState('gateway')
        }).catch(() => setApiState('unavailable'))
        return
      }
      messengerApi.messages(selected.id, me.id).then((items) => {
        setMessages((current) => ({ ...current, [selected.id]: items }))
        setApiState('gateway')
      }).catch(() => setApiState('unavailable'))
    }, () => setApiState('unavailable'))
  }, [applyTypingEvent, me.id, selected])

  useEffect(() => () => {
    outgoingTypingTimers.current.forEach((timer) => window.clearTimeout(timer))
    incomingTypingTimers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const activeMessages = useMemo(() => selected ? messages[selected.id] ?? [] : [], [messages, selected])
  const replyTarget = selected
    ? activeMessages.find((message) => message.id === replyToByConversationId[selected.id]) ?? null
    : null
  const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)

  useEffect(() => {
    if (!selected || (window.innerWidth <= 760 && !mobileShowThread)) return
    const sequence = [...activeMessages].reverse().find((message) => message.sequence)?.sequence
    if (!sequence || !isNewerSequence(sequence, lastMarkedReadSequence.current.get(selected.id))) return
    lastMarkedReadSequence.current.set(selected.id, sequence)
    void messengerApi.markRead(selected.id, sequence).catch(() => {
      if (lastMarkedReadSequence.current.get(selected.id) === sequence) lastMarkedReadSequence.current.delete(selected.id)
      setApiState('unavailable')
    })
  }, [activeMessages, mobileShowThread, selected])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const draft = drafts[selected.id] ?? ''
    const pendingAttachments = pendingAttachmentsByConversation[selected.id] ?? []
    if (!draft.trim() && pendingAttachments.length === 0) return
    const text = draft.trim()
    const attachments = pendingAttachments
    const replyToMessageId = replyToByConversationId[selected.id] ?? null
    stopTyping(selected.id)
    setDrafts((current) => ({ ...current, [selected.id]: '' }))
    setPendingAttachmentsByConversation((current) => ({ ...current, [selected.id]: [] }))
    setReplyToByConversationId((current) => ({ ...current, [selected.id]: null }))
    const optimistic: MessengerMessageDto = {
      id: `local-${crypto.randomUUID()}`,
      conversationId: selected.id,
      sender: me,
      body: text,
      replyToMessageId,
      reactions: [],
      deleted: false,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments,
    }
    setMessages((current) => ({ ...current, [selected.id]: [...(current[selected.id] ?? []), optimistic] }))
    try {
      const sent = await messengerApi.sendMessage(selected.id, me, { body: text, attachments, replyToMessageId })
      setMessages((current) => ({ ...current, [selected.id]: (current[selected.id] ?? []).map((message) => message.id === optimistic.id ? sent : message) }))
      setConversations((current) => current.map((conversation) => conversation.id === selected.id ? { ...conversation, lastMessage: sent, updatedAt: sent.createdAt, unreadCount: 0 } : conversation))
      setApiState('gateway')
      void api.finalizePendingMedia(attachments).catch(() => setApiState('unavailable'))
    } catch {
      setMessages((current) => ({ ...current, [selected.id]: (current[selected.id] ?? []).filter((message) => message.id !== optimistic.id) }))
      setDrafts((current) => ({ ...current, [selected.id]: text }))
      setPendingAttachmentsByConversation((current) => ({ ...current, [selected.id]: attachments }))
      setReplyToByConversationId((current) => ({ ...current, [selected.id]: replyToMessageId }))
      setApiState('unavailable')
    }
  }

  async function sendLike(level: MessengerLikeLevel) {
    if (!selected) return
    const body = encodeMessengerLike(level)
    const replyToMessageId = replyToByConversationId[selected.id] ?? null
    stopTyping(selected.id)
    setReplyToByConversationId((current) => ({ ...current, [selected.id]: null }))
    const optimistic: MessengerMessageDto = {
      id: `local-${crypto.randomUUID()}`,
      conversationId: selected.id,
      sender: me,
      body,
      replyToMessageId,
      reactions: [],
      deleted: false,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments: [],
    }
    setMessages((current) => ({ ...current, [selected.id]: [...(current[selected.id] ?? []), optimistic] }))
    try {
      const sent = await messengerApi.sendMessage(selected.id, me, { body, attachments: [], replyToMessageId })
      setMessages((current) => ({ ...current, [selected.id]: (current[selected.id] ?? []).map((message) => message.id === optimistic.id ? sent : message) }))
      setConversations((current) => current.map((conversation) => conversation.id === selected.id ? { ...conversation, lastMessage: sent, updatedAt: sent.createdAt, unreadCount: 0 } : conversation))
      setApiState('gateway')
    } catch {
      setMessages((current) => ({ ...current, [selected.id]: (current[selected.id] ?? []).filter((message) => message.id !== optimistic.id) }))
      setApiState('unavailable')
      setReplyToByConversationId((current) => ({ ...current, [selected.id]: replyToMessageId }))
    }
  }

  function applyMessageUpdate(incoming: MessengerMessageDto) {
    setMessages((current) => ({
      ...current,
      [incoming.conversationId]: upsertMessage(current[incoming.conversationId] ?? [], incoming),
    }))
    setConversations((current) => current.map((conversation) => conversation.id === incoming.conversationId && conversation.lastMessage?.id === incoming.id
      ? { ...conversation, lastMessage: incoming }
      : conversation))
  }

  async function reactToMessage(message: MessengerMessageDto, emoji: string | null) {
    try {
      const updated = await messengerApi.setMessageReaction(message.id, emoji, me.id)
      applyMessageUpdate(updated)
      setApiState('gateway')
    } catch (error) {
      setApiState('unavailable')
      throw error
    }
  }

  async function recallMessage(message: MessengerMessageDto) {
    try {
      const updated = await messengerApi.deleteMessage(message.id, me.id)
      applyMessageUpdate(updated)
      setApiState('gateway')
    } catch (error) {
      setApiState('unavailable')
      throw error
    }
  }

  async function forwardMessage(target: MessengerConversationDto) {
    if (!forwardingMessage) return
    try {
      const sent = await messengerApi.sendMessage(target.id, me, {
        body: forwardingMessage.body,
        attachments: forwardingMessage.attachments,
      })
      setMessages((current) => current[target.id]
        ? { ...current, [target.id]: upsertMessage(current[target.id], sent) }
        : current)
      setConversations((current) => current.map((conversation) => conversation.id === target.id
        ? { ...conversation, lastMessage: sent, updatedAt: sent.createdAt }
        : conversation))
      setApiState('gateway')
    } catch (error) {
      setApiState('unavailable')
      throw error
    }
  }

  async function startConversation(person: UserSummary) {
    setShowNewModal(false)
    try {
      const created = await messengerApi.createDirectConversation(person.id, me.id)
      setConversations((current) => [created, ...current.filter((conversation) => conversation.id !== created.id)])
      setSelectedId(created.id)
      setMessages((current) => current[created.id] ? current : ({ ...current, [created.id]: [] }))
      setDrafts((current) => ({ ...current, [created.id]: '' }))
      setPendingAttachmentsByConversation((current) => ({ ...current, [created.id]: [] }))
      setMobileShowThread(true)
      setApiState('gateway')
    } catch {
      setApiState('unavailable')
    }
  }

  async function startGroupConversation(title: string, people: UserSummary[]) {
    setShowNewModal(false)
    try {
      const created = await messengerApi.createGroupConversation(title, people.map((person) => person.id), me.id)
      setConversations((current) => [created, ...current.filter((conversation) => conversation.id !== created.id)])
      setSelectedId(created.id)
      setMessages((current) => current[created.id] ? current : ({ ...current, [created.id]: [] }))
      setDrafts((current) => ({ ...current, [created.id]: '' }))
      setPendingAttachmentsByConversation((current) => ({ ...current, [created.id]: [] }))
      setMobileShowThread(true)
      setApiState('gateway')
    } catch {
      setApiState('unavailable')
    }
  }

  async function leaveSelectedConversation() {
    if (!selected || selected.type !== 'GROUP') return
    const leavingId = selected.id
    try {
      await messengerApi.leaveConversation(leavingId, me.id)
      setConversations((current) => current.filter((conversation) => conversation.id !== leavingId))
      setSelectedId(null)
      setMessages((current) => {
        const next = { ...current }
        delete next[leavingId]
        return next
      })
      const pending = pendingAttachmentsByConversation[leavingId] ?? []
      void Promise.allSettled(pending.map((attachment) => api.cancelPendingMedia(attachment)))
      setDrafts((current) => {
        const next = { ...current }
        delete next[leavingId]
        return next
      })
      setPendingAttachmentsByConversation((current) => {
        const next = { ...current }
        delete next[leavingId]
        return next
      })
      setApiState('gateway')
    } catch {
      setApiState('unavailable')
    }
  }

  async function attachFiles(conversationId: string, files: FileList | null) {
    if (!files?.length) return
    const current = pendingAttachmentsByConversation[conversationId] ?? []
    const remaining = Math.max(0, 10 - current.length)
    if (remaining === 0) return
    const selectedFiles = Array.from(files).slice(0, remaining)
    setUploadingConversationId(conversationId)
    try {
      const uploaded = await api.uploadMediaFiles(selectedFiles)
      setPendingAttachmentsByConversation((all) => ({
        ...all,
        [conversationId]: [...(all[conversationId] ?? []), ...uploaded].slice(0, 10),
      }))
      setApiState('gateway')
    } catch {
      setApiState('unavailable')
    } finally {
      setUploadingConversationId((currentId) => currentId === conversationId ? null : currentId)
    }
  }

  function selectConversation(id: string) {
    if (selected && selected.id !== id) stopTyping(selected.id)
    setSelectedId(id)
    setMobileShowThread(true)
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation))
  }

  function removePendingAttachment(url: string) {
    if (!selected) return
    const conversationId = selected.id
    const attachment = (pendingAttachmentsByConversation[conversationId] ?? []).find((item) => item.url === url)
    setPendingAttachmentsByConversation((current) => ({
      ...current,
      [conversationId]: (current[conversationId] ?? []).filter((item) => item.url !== url),
    }))
    if (attachment) void api.cancelPendingMedia(attachment).catch(() => undefined)
  }

  return <>
    <main className={`messenger-shell${mobileShowThread ? ' thread-open' : ''}${showDetail ? ' detail-open' : ''}`} aria-label="Messenger">
      <ConversationList me={me} conversations={conversations} presenceByUserId={presenceByUserId} selectedId={selectedId} query={query} loading={loading} activeTab={activeTab} totalUnread={totalUnread} onSelect={selectConversation} onQueryChange={setQuery} onTabChange={setActiveTab} onNewMessage={() => setShowNewModal(true)} />
      {selected ? <MessageThread me={me} conversation={selected} messages={activeMessages} draft={drafts[selected.id] ?? ''} pendingAttachments={pendingAttachmentsByConversation[selected.id] ?? []} uploading={uploadingConversationId === selected.id} apiState={apiState} showDetail={showDetail} presence={selectedOther ? presenceByUserId[selectedOther.id] : undefined} typingUserId={typingByConversationId[selected.id] ?? null} replyTarget={replyTarget} onDraftChange={(value) => updateDraft(selected.id, value)} onAttachFiles={(files) => void attachFiles(selected.id, files)} onRemoveAttachment={removePendingAttachment} onSubmit={handleSubmit} onSendLike={(level) => void sendLike(level)} onReplyMessage={(message) => setReplyToByConversationId((current) => ({ ...current, [selected.id]: message.id }))} onCancelReply={() => setReplyToByConversationId((current) => ({ ...current, [selected.id]: null }))} onReactMessage={reactToMessage} onRecallMessage={recallMessage} onForwardMessage={setForwardingMessage} onOpenProfile={onOpenProfile} onToggleDetail={() => setShowDetail((value) => !value)} onBack={() => setMobileShowThread(false)} /> : <section className="messenger-empty"><Icon name="messenger" size={56} /><h2>{apiState === 'unavailable' ? t('messengerUnavailable') : t('selectChat')}</h2><p>{apiState === 'unavailable' ? t('messengerUnavailableDesc') : t('chooseConversation')}</p></section>}
      {showDetail && selected && <ConversationDetail me={me} conversation={selected} presence={selectedOther ? presenceByUserId[selectedOther.id] : undefined} onOpenProfile={onOpenProfile} onLeave={() => void leaveSelectedConversation()} />}
    </main>
    {showNewModal && <NewConversationModal friends={friends} onStart={startConversation} onCreateGroup={startGroupConversation} onClose={() => setShowNewModal(false)} />}
    {forwardingMessage && <ForwardMessageDialog message={forwardingMessage} conversations={conversations} me={me} onForward={forwardMessage} onClose={() => setForwardingMessage(null)} />}
  </>
}

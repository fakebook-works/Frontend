import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { messengerApi } from '../../api/messenger'
import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { useI18n } from '../../i18n'
import { conversationAvatar, conversationName, formatTime } from './helpers'
import { NewConversationModal } from './NewConversationModal'
import './MessengerPage.css'

export interface MessengerDockHandle {
  openDirect: (profileId: string) => Promise<void>
}

interface MessengerDockProps {
  me: UserSummary
  friends: UserSummary[]
  panelOpen: boolean
  hidden?: boolean
  onPanelClose: () => void
  onOpenAll: (conversationId?: string) => void
  onOpenProfile: (profileId: string) => void
}

const MAX_OPEN_CHATS = 3

export const MessengerDock = forwardRef<MessengerDockHandle, MessengerDockProps>(function MessengerDock({
  me,
  friends,
  panelOpen,
  hidden = false,
  onPanelClose,
  onOpenAll,
  onOpenProfile,
}, ref) {
  const { t } = useI18n()
  const [conversations, setConversations] = useState<MessengerConversationDto[]>([])
  const [messages, setMessages] = useState<Record<string, MessengerMessageDto[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [openIds, setOpenIds] = useState<string[]>([])
  const [minimizedIds, setMinimizedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const seenEventIds = useRef(new Set<string>())

  const loadConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const items = await messengerApi.conversations(me.id)
      setConversations(items)
      setError(null)
    } catch {
      setError(t('messengerUnavailableDesc'))
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [me.id, t])

  useEffect(() => {
    if (panelOpen && conversations.length === 0) void loadConversations(true)
  }, [conversations.length, loadConversations, panelOpen])

  useEffect(() => {
    if (!panelOpen && openIds.length === 0) return
    return messengerApi.subscribeInbox((event) => {
      if (seenEventIds.current.has(event.eventId)) return
      seenEventIds.current.add(event.eventId)
      void loadConversations()
      if (event.conversationId && openIds.includes(event.conversationId)) {
        void messengerApi.messages(event.conversationId, me.id).then((items) => {
          setMessages((current) => ({ ...current, [event.conversationId!]: items }))
        }).catch(() => setError(t('messengerUnavailableDesc')))
      }
    }, () => setError(t('messengerUnavailableDesc')))
  }, [loadConversations, me.id, openIds, panelOpen, t])

  useEffect(() => {
    const unsubscribers = openIds.map((conversationId) => messengerApi.subscribeConversation(conversationId, (event) => {
      if (seenEventIds.current.has(event.eventId)) return
      seenEventIds.current.add(event.eventId)
      void messengerApi.messages(conversationId, me.id).then((items) => {
        setMessages((current) => ({ ...current, [conversationId]: items }))
        setError(null)
      }).catch(() => setError(t('messengerUnavailableDesc')))
    }, () => setError(t('messengerUnavailableDesc'))))
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [me.id, openIds, t])

  const openConversation = useCallback((conversation: MessengerConversationDto) => {
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)])
    setOpenIds((current) => [...current.filter((id) => id !== conversation.id), conversation.id].slice(-MAX_OPEN_CHATS))
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
  }, [me.id, messages, onPanelClose, t])

  const openDirect = useCallback(async (profileId: string) => {
    const conversation = await messengerApi.createDirectConversation(profileId, me.id)
    openConversation(conversation)
  }, [me.id, openConversation])

  useImperativeHandle(ref, () => ({ openDirect }), [openDirect])

  async function startConversation(person: UserSummary) {
    setShowNewModal(false)
    try {
      await openDirect(person.id)
    } catch {
      setError(t('messageActionError'))
    }
  }

  async function startGroupConversation(title: string, people: UserSummary[]) {
    setShowNewModal(false)
    try {
      await openDirectGroup(title, people)
    } catch {
      setError(t('messageActionError'))
    }
  }

  async function openDirectGroup(title: string, people: UserSummary[]) {
    const conversation = await messengerApi.createGroupConversation(title, people.map((person) => person.id), me.id)
    openConversation(conversation)
  }

  async function send(event: FormEvent, conversation: MessengerConversationDto) {
    event.preventDefault()
    const body = (drafts[conversation.id] ?? '').trim()
    if (!body || sendingId) return
    const optimistic: MessengerMessageDto = {
      id: `local-${crypto.randomUUID()}`,
      conversationId: conversation.id,
      sender: me,
      body,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments: [],
    }
    setDrafts((current) => ({ ...current, [conversation.id]: '' }))
    setMessages((current) => ({ ...current, [conversation.id]: [...(current[conversation.id] ?? []), optimistic] }))
    setSendingId(conversation.id)
    try {
      const sent = await messengerApi.sendMessage(conversation.id, me.id, { body })
      setMessages((current) => ({
        ...current,
        [conversation.id]: (current[conversation.id] ?? []).map((item) => item.id === optimistic.id ? sent : item),
      }))
      setConversations((current) => current.map((item) => item.id === conversation.id
        ? { ...item, lastMessage: sent, updatedAt: sent.createdAt, unreadCount: 0 }
        : item))
      setError(null)
    } catch {
      setMessages((current) => ({ ...current, [conversation.id]: (current[conversation.id] ?? []).filter((item) => item.id !== optimistic.id) }))
      setDrafts((current) => ({ ...current, [conversation.id]: body }))
      setError(t('messengerUnavailableDesc'))
    } finally {
      setSendingId(null)
    }
  }

  function closeChat(conversationId: string) {
    setOpenIds((current) => current.filter((id) => id !== conversationId))
    setMinimizedIds((current) => {
      const next = new Set(current)
      next.delete(conversationId)
      return next
    })
  }

  function toggleMinimized(conversationId: string) {
    setMinimizedIds((current) => {
      const next = new Set(current)
      if (next.has(conversationId)) next.delete(conversationId)
      else next.add(conversationId)
      return next
    })
  }

  if (hidden) return null

  const openConversations = openIds.flatMap((id) => {
    const conversation = conversations.find((item) => item.id === id)
    return conversation ? [conversation] : []
  })

  return <>
    {panelOpen && <aside className="messenger-popover" role="dialog" aria-label={t('messages')}>
      <header><div><h2>{t('chats')}</h2>{error && <small>{error}</small>}</div><div><button type="button" className="icon-circle subtle" aria-label={t('newMessage')} onClick={() => setShowNewModal(true)}><Icon name="edit" size={18} /></button><button type="button" className="icon-circle subtle" aria-label={t('close')} onClick={onPanelClose}><Icon name="close" size={18} /></button></div></header>
      <div className="messenger-popover-list">{loading ? <div className="messenger-loading"><span className="spinner" /></div> : conversations.length === 0 ? <p className="muted">{error ?? t('noChatsFound')}</p> : conversations.slice(0, 12).map((conversation) => {
        const name = conversationName(conversation, me)
        return <button type="button" key={conversation.id} onClick={() => openConversation(conversation)}><Avatar name={name} src={conversationAvatar(conversation, me)} size={48} /><span><strong>{name}</strong><small>{conversation.lastMessage?.body || t('startConversation')}</small></span>{conversation.unreadCount > 0 && <b>{Math.min(99, conversation.unreadCount)}</b>}</button>
      })}</div>
      <footer><button type="button" onClick={() => onOpenAll()}>{t('openMessenger')}</button></footer>
    </aside>}

    {openConversations.length > 0 && <div className="messenger-chat-dock" aria-label={t('messages')}>{openConversations.map((conversation) => {
      const name = conversationName(conversation, me)
      const other = conversation.participants.find((person) => person.id !== me.id)
      const minimized = minimizedIds.has(conversation.id)
      const conversationMessages = messages[conversation.id] ?? []
      return <section className={`messenger-chat-window${minimized ? ' minimized' : ''}`} key={conversation.id} aria-label={name}>
        <header><button type="button" className="chat-window-person" onClick={() => other && onOpenProfile(other.id)}><Avatar name={name} src={conversationAvatar(conversation, me)} size={32} /><strong>{name}<VerifiedBadge verified={other?.isVerified} size={12} /></strong></button><div><button type="button" aria-label={t('minimize')} onClick={() => toggleMinimized(conversation.id)}>−</button><button type="button" aria-label={t('close')} onClick={() => closeChat(conversation.id)}>×</button></div></header>
        {!minimized && <><div className="chat-window-messages">{conversationMessages.length === 0 ? <p className="muted">{t('startConversation')}</p> : conversationMessages.map((message) => <div className={message.sender.id === me.id ? 'mine' : ''} key={message.id}><span>{message.body}</span><small>{formatTime(message.createdAt)}</small></div>)}</div><form onSubmit={(event) => void send(event, conversation)}><input value={drafts[conversation.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [conversation.id]: event.target.value }))} placeholder="Aa" /><button type="submit" aria-label={t('sendMessage')} disabled={sendingId === conversation.id || !(drafts[conversation.id] ?? '').trim()}><Icon name="send" size={17} /></button></form></>}
      </section>
    })}</div>}

    {showNewModal && <NewConversationModal friends={friends} onStart={startConversation} onCreateGroup={startGroupConversation} onClose={() => setShowNewModal(false)} />}
  </>
})

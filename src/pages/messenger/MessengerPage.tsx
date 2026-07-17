import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../api/client'
import { messengerApi } from '../../api/messenger'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Icon } from '../../components/Icon'
import { useI18n } from '../../i18n'
import { ConversationDetail } from './ConversationDetail'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'
import { NewConversationModal } from './NewConversationModal'
import './MessengerPage.css'

interface MessengerPageProps {
  me: UserSummary
  friends: UserSummary[]
  onOpenProfile: (id: string) => void
  initialConversationId?: string | null
}

export function MessengerPage({ me, friends, onOpenProfile, initialConversationId = null }: MessengerPageProps) {
  const { t } = useI18n()
  const [conversations, setConversations] = useState<MessengerConversationDto[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, MessengerMessageDto[]>>({})
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<MediaUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiState, setApiState] = useState<'gateway' | 'unavailable'>('gateway')
  const [showNewModal, setShowNewModal] = useState(false)
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const [showDetail, setShowDetail] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'communities'>('inbox')
  const seenEventIds = useRef(new Set<string>())

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
  }, () => setApiState('unavailable')), [loadConversations])

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0] ?? null

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
      messengerApi.messages(selected.id, me.id).then((items) => {
        setMessages((current) => ({ ...current, [selected.id]: items }))
        setApiState('gateway')
      }).catch(() => setApiState('unavailable'))
    }, () => setApiState('unavailable'))
  }, [me.id, selected])

  const activeMessages = selected ? messages[selected.id] ?? [] : []
  const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected || (!draft.trim() && pendingAttachments.length === 0)) return
    const text = draft.trim()
    const attachments = pendingAttachments
    setDraft('')
    setPendingAttachments([])
    const optimistic: MessengerMessageDto = {
      id: `local-${crypto.randomUUID()}`,
      conversationId: selected.id,
      sender: me,
      body: text,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments,
    }
    setMessages((current) => ({ ...current, [selected.id]: [...(current[selected.id] ?? []), optimistic] }))
    try {
      const sent = await messengerApi.sendMessage(selected.id, me.id, { body: text, attachments })
      setMessages((current) => ({ ...current, [selected.id]: (current[selected.id] ?? []).map((message) => message.id === optimistic.id ? sent : message) }))
      setConversations((current) => current.map((conversation) => conversation.id === selected.id ? { ...conversation, lastMessage: sent, updatedAt: sent.createdAt, unreadCount: 0 } : conversation))
      setApiState('gateway')
      void api.finalizePendingMedia(attachments).catch(() => setApiState('unavailable'))
    } catch {
      setMessages((current) => ({ ...current, [selected.id]: (current[selected.id] ?? []).filter((message) => message.id !== optimistic.id) }))
      setDraft(text)
      setPendingAttachments(attachments)
      setApiState('unavailable')
    }
  }

  async function startConversation(person: UserSummary) {
    setShowNewModal(false)
    try {
      const created = await messengerApi.createDirectConversation(person.id, me.id)
      setConversations((current) => [created, ...current.filter((conversation) => conversation.id !== created.id)])
      setSelectedId(created.id)
      setMessages((current) => current[created.id] ? current : ({ ...current, [created.id]: [] }))
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
      setMobileShowThread(true)
      setApiState('gateway')
    } catch {
      setApiState('unavailable')
    }
  }

  async function leaveSelectedConversation() {
    if (!selected || selected.type !== 'GROUP') return
    try {
      await messengerApi.leaveConversation(selected.id, me.id)
      setConversations((current) => current.filter((conversation) => conversation.id !== selected.id))
      setSelectedId(null)
      setMessages((current) => {
        const next = { ...current }
        delete next[selected.id]
        return next
      })
      setApiState('gateway')
    } catch {
      setApiState('unavailable')
    }
  }

  async function attachFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const uploaded = await api.uploadMediaFiles(Array.from(files).slice(0, 10))
      setPendingAttachments((current) => [...current, ...uploaded].slice(0, 10))
      setApiState('gateway')
    } catch {
      setApiState('unavailable')
    } finally {
      setUploading(false)
    }
  }

  function selectConversation(id: string) {
    setSelectedId(id)
    setMobileShowThread(true)
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation))
  }

  function removePendingAttachment(url: string) {
    const attachment = pendingAttachments.find((item) => item.url === url)
    setPendingAttachments((current) => current.filter((item) => item.url !== url))
    if (attachment) void api.cancelPendingMedia(attachment).catch(() => undefined)
  }

  return <>
    <main className={`messenger-shell${mobileShowThread ? ' thread-open' : ''}${showDetail ? ' detail-open' : ''}`} aria-label="Messenger">
      <ConversationList me={me} conversations={conversations} selectedId={selectedId} query={query} loading={loading} activeTab={activeTab} totalUnread={totalUnread} onSelect={selectConversation} onQueryChange={setQuery} onTabChange={setActiveTab} onNewMessage={() => setShowNewModal(true)} />
      {selected ? <MessageThread me={me} conversation={selected} messages={activeMessages} draft={draft} pendingAttachments={pendingAttachments} uploading={uploading} apiState={apiState} showDetail={showDetail} onDraftChange={setDraft} onAttachFiles={attachFiles} onRemoveAttachment={removePendingAttachment} onSubmit={handleSubmit} onOpenProfile={onOpenProfile} onToggleDetail={() => setShowDetail((value) => !value)} onBack={() => setMobileShowThread(false)} /> : <section className="messenger-empty"><Icon name="messenger" size={56} /><h2>{apiState === 'unavailable' ? t('messengerUnavailable') : t('selectChat')}</h2><p>{apiState === 'unavailable' ? t('messengerUnavailableDesc') : t('chooseConversation')}</p></section>}
      {showDetail && selected && <ConversationDetail me={me} conversation={selected} onOpenProfile={onOpenProfile} onLeave={() => void leaveSelectedConversation()} />}
    </main>
    {showNewModal && <NewConversationModal friends={friends} onStart={startConversation} onCreateGroup={startGroupConversation} onClose={() => setShowNewModal(false)} />}
  </>
}

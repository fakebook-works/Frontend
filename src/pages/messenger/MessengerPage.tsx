import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { legacyApi as api } from '../../api/client'
import { createGatewaySocket } from '../../api/realtime'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Icon } from '../../components/Icon'
import { ConversationDetail } from './ConversationDetail'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'
import { NewConversationModal } from './NewConversationModal'
import { seedConversations, seedMessages } from './helpers'
import './MessengerPage.css'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MessengerPageProps {
  me: UserSummary
  friends: UserSummary[]
  onOpenProfile: (id: string) => void
}

/* ------------------------------------------------------------------ */
/*  Full-page Messenger                                                */
/* ------------------------------------------------------------------ */

export function MessengerPage({ me, friends, onOpenProfile }: MessengerPageProps) {
  const [conversations, setConversations] = useState<MessengerConversationDto[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, MessengerMessageDto[]>>({})
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<MediaUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiState, setApiState] = useState<'gateway' | 'seed'>('gateway')
  const [showNewModal, setShowNewModal] = useState(false)
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const [showDetail, setShowDetail] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'communities'>('inbox')

  // Socket.IO real-time messages
  useEffect(() => {
    let socket: ReturnType<typeof createGatewaySocket> | null = null
    try {
      socket = createGatewaySocket('/messenger')
      socket.on('message', (msg: MessengerMessageDto) => {
        setMessages((prev) => ({
          ...prev,
          [msg.conversationId]: [...(prev[msg.conversationId] ?? []), msg],
        }))
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId
              ? { ...c, lastMessage: msg, updatedAt: msg.createdAt, unreadCount: c.unreadCount + 1 }
              : c,
          ),
        )
      })
    } catch {
      /* Socket unavailable — graceful degradation */
    }
    return () => { socket?.disconnect() }
  }, [])

  // Load conversations
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await api.messengerConversations()
        if (cancelled) return
        const list = res.length ? res : seedConversations(me, friends)
        setConversations(list)
        setSelectedId((cur) => cur ?? list[0]?.id ?? null)
        setApiState(res.length ? 'gateway' : 'seed')
      } catch {
        if (cancelled) return
        const seeded = seedConversations(me, friends)
        setConversations(seeded)
        setSelectedId((cur) => cur ?? seeded[0]?.id ?? null)
        setApiState('seed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [friends, me])

  const selected = conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null

  // Load messages for selected conversation
  useEffect(() => {
    if (!selected || messages[selected.id]) return
    let cancelled = false
    api.messengerMessages(selected.id)
      .then((res) => { if (!cancelled) setMessages((prev) => ({ ...prev, [selected.id]: res })) })
      .catch(() => { if (!cancelled) setMessages((prev) => ({ ...prev, [selected.id]: seedMessages(selected, me) })) })
    return () => { cancelled = true }
  }, [selected, messages, me])

  const activeMessages = selected ? messages[selected.id] ?? [] : []
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  // Send message
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selected || (!draft.trim() && pendingAttachments.length === 0)) return
    const text = draft.trim()
    const attachments = pendingAttachments
    setDraft('')
    setPendingAttachments([])

    const optimistic: MessengerMessageDto = {
      id: `local-${Date.now()}`,
      conversationId: selected.id,
      sender: me,
      body: text,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments,
    }
    setMessages((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), optimistic] }))
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selected.id ? { ...c, lastMessage: optimistic, updatedAt: optimistic.createdAt, unreadCount: 0 } : c,
      ),
    )

    try {
      const sent = await api.sendMessengerMessage(selected.id, { body: text, attachments })
      setMessages((prev) => ({
        ...prev,
        [selected.id]: (prev[selected.id] ?? []).map((m) => (m.id === optimistic.id ? sent : m)),
      }))
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, lastMessage: sent, updatedAt: sent.createdAt } : c)),
      )
      setApiState('gateway')
    } catch {
      const delivered = { ...optimistic, status: 'sent' as const }
      setMessages((prev) => ({
        ...prev,
        [selected.id]: (prev[selected.id] ?? []).map((m) => (m.id === optimistic.id ? delivered : m)),
      }))
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, lastMessage: delivered } : c)),
      )
      setApiState('seed')
    }
  }

  // Start new conversation
  async function startConversation(person: UserSummary) {
    setShowNewModal(false)
    const existing = conversations.find((c) => c.participants.some((p) => p.id === person.id))
    if (existing) {
      setSelectedId(existing.id)
      setMobileShowThread(true)
      return
    }
    let newConvo: MessengerConversationDto
    try {
      newConvo = await api.startConversation(person)
      setApiState('gateway')
    } catch {
      newConvo = {
        id: `new-${Date.now()}`,
        participants: [me, person],
        title: null,
        avatarUrl: person.avatarUrl,
        updatedAt: new Date().toISOString(),
        unreadCount: 0,
        lastMessage: null,
      }
      setApiState('seed')
    }
    setConversations((prev) => [newConvo, ...prev])
    setSelectedId(newConvo.id)
    setMessages((prev) => ({ ...prev, [newConvo.id]: [] }))
    setMobileShowThread(true)
  }

  async function attachFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(Array.from(files).slice(0, 10).map((file) => api.uploadMedia(file)))
      setPendingAttachments((prev) => [...prev, ...uploaded].slice(0, 10))
      setApiState('gateway')
    } catch {
      setApiState('seed')
    } finally {
      setUploading(false)
    }
  }

  function removeAttachment(url: string) {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.url !== url))
  }

  function selectConversation(id: string) {
    setSelectedId(id)
    setMobileShowThread(true)
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }

  return (
    <>
      <main className={`messenger-shell${mobileShowThread ? ' thread-open' : ''}${showDetail ? ' detail-open' : ''}`} aria-label="Messenger">
        <ConversationList
          me={me}
          conversations={conversations}
          selectedId={selectedId}
          query={query}
          loading={loading}
          activeTab={activeTab}
          totalUnread={totalUnread}
          onSelect={selectConversation}
          onQueryChange={setQuery}
          onTabChange={setActiveTab}
          onNewMessage={() => setShowNewModal(true)}
        />

        {selected ? (
          <MessageThread
            me={me}
            conversation={selected}
            messages={activeMessages}
            draft={draft}
            pendingAttachments={pendingAttachments}
            uploading={uploading}
            apiState={apiState}
            showDetail={showDetail}
            onDraftChange={setDraft}
            onAttachFiles={attachFiles}
            onRemoveAttachment={removeAttachment}
            onSubmit={handleSubmit}
            onOpenProfile={onOpenProfile}
            onToggleDetail={() => setShowDetail((v) => !v)}
            onBack={() => setMobileShowThread(false)}
          />
        ) : (
          <section className="messenger-empty">
            <Icon name="messenger" size={56} />
            <h2>Select a chat</h2>
            <p>Choose a conversation or start a new one.</p>
          </section>
        )}

        {showDetail && selected && (
          <ConversationDetail
            me={me}
            conversation={selected}
            onOpenProfile={onOpenProfile}
          />
        )}
      </main>

      {showNewModal && (
        <NewConversationModal
          friends={friends}
          onStart={startConversation}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </>
  )
}

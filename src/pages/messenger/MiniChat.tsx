import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { legacyApi as api } from '../../api/client'
import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { timeAgo } from '../../lib/format'
import { EmojiButton } from './EmojiButton'
import {
  conversationAvatar,
  conversationName,
  formatTime,
  seedConversations,
  seedMessages,
  shouldShowAvatar,
  shouldShowTimestamp,
} from './helpers'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MiniChatWindow {
  conversationId: string
  minimized: boolean
}

interface MiniChatProps {
  me: UserSummary
  friends: UserSummary[]
  onOpenProfile: (id: string) => void
  onOpenFullMessenger: () => void
}

/* ------------------------------------------------------------------ */
/*  Single Mini Chat Window                                            */
/* ------------------------------------------------------------------ */

function MiniChatBox({
  me,
  conversation,
  messages,
  onSend,
  onClose,
  onMinimize,
  onOpenProfile,
  minimized,
}: {
  me: UserSummary
  conversation: MessengerConversationDto
  messages: MessengerMessageDto[]
  onSend: (conversationId: string, body: string) => void
  onClose: () => void
  onMinimize: () => void
  onOpenProfile: (id: string) => void
  minimized: boolean
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!minimized) scrollToBottom()
  }, [messages, minimized, scrollToBottom])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    onSend(conversation.id, draft.trim())
    setDraft('')
    inputRef.current?.focus()
  }

  return (
    <div className={`mini-chat-window${minimized ? ' minimized' : ''}`}>
      {/* Header — always visible */}
      <header className="mini-chat-head" onClick={onMinimize}>
        <button
          type="button"
          className="mini-chat-id"
          onClick={(e) => {
            e.stopPropagation()
            if (otherParticipant) onOpenProfile(otherParticipant.id)
          }}
        >
          <Avatar name={name} src={avatar} size={32} online />
        </button>
        <span className="mini-chat-name">
          <strong>{name}</strong>
          <small>Active now</small>
        </span>
        <div className="mini-chat-controls">
          <button type="button" className="mini-ctrl" aria-label="Audio call">
            <Icon name="phone" size={16} />
          </button>
          <button type="button" className="mini-ctrl" aria-label="Video call">
            <Icon name="video" size={16} />
          </button>
          <button type="button" className="mini-ctrl" aria-label="Minimize" onClick={(e) => { e.stopPropagation(); onMinimize() }}>
            <Icon name="caret" size={14} />
          </button>
          <button type="button" className="mini-ctrl" aria-label="Close" onClick={(e) => { e.stopPropagation(); onClose() }}>
            <Icon name="close" size={14} />
          </button>
        </div>
      </header>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          <div className="mini-chat-messages">
            {messages.map((msg, idx) => {
              const mine = msg.sender.id === me.id
              const showTime = shouldShowTimestamp(messages, idx)
              const showAv = shouldShowAvatar(messages, idx)
              return (
                <div key={msg.id}>
                  {showTime && <div className="mini-msg-time">{formatTime(msg.createdAt)}</div>}
                  <div className={`mini-msg-line${mine ? ' mine' : ''}${showAv ? '' : ' grouped'}`}>
                    {!mine && (
                      <div className="mini-msg-avatar">
                        {showAv && <Avatar name={msg.sender.displayName} src={msg.sender.avatarUrl} size={24} />}
                      </div>
                    )}
                    <p className="mini-msg-bubble">{msg.body}</p>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>

          <form className="mini-chat-compose" onSubmit={handleSubmit}>
            <button type="button" className="mini-compose-btn" aria-label="Add">
              <Icon name="plus" size={16} />
            </button>
            <label className="mini-compose-input">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Aa"
                autoComplete="off"
              />
              <EmojiButton onPick={(emoji) => setDraft((d) => d + emoji)} />
            </label>
            <button
              type="submit"
              className={`mini-compose-btn send${draft.trim() ? ' ready' : ''}`}
              disabled={!draft.trim()}
              aria-label="Send"
            >
              {draft.trim() ? <Icon name="send" size={16} /> : <Icon name="like" size={18} />}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mini Chat Manager (bottom-right floating widget)                   */
/* ------------------------------------------------------------------ */

export function MiniChat({ me, friends, onOpenProfile, onOpenFullMessenger }: MiniChatProps) {
  const [conversations, setConversations] = useState<MessengerConversationDto[]>([])
  const [messages, setMessages] = useState<Record<string, MessengerMessageDto[]>>({})
  const [windows, setWindows] = useState<MiniChatWindow[]>([])
  const [showList, setShowList] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load conversations on first toggle
  useEffect(() => {
    if (!showList || loaded) return
    let cancelled = false
    async function load() {
      try {
        const res = await api.messengerConversations()
        if (cancelled) return
        setConversations(res.length ? res : seedConversations(me, friends))
      } catch {
        if (cancelled) return
        setConversations(seedConversations(me, friends))
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [showList, loaded, me, friends])

  // Load messages for open windows
  useEffect(() => {
    for (const w of windows) {
      if (messages[w.conversationId]) continue
      const convo = conversations.find((c) => c.id === w.conversationId)
      if (!convo) continue
      api.messengerMessages(w.conversationId)
        .then((res) => setMessages((prev) => ({ ...prev, [w.conversationId]: res })))
        .catch(() => setMessages((prev) => ({ ...prev, [w.conversationId]: seedMessages(convo, me) })))
    }
  }, [windows, conversations, messages, me])

  function openChat(conversationId: string) {
    setShowList(false)
    setWindows((prev) => {
      const exists = prev.find((w) => w.conversationId === conversationId)
      if (exists) return prev.map((w) => w.conversationId === conversationId ? { ...w, minimized: false } : w)
      const updated = [...prev, { conversationId, minimized: false }]
      // Keep max 3 windows open
      return updated.slice(-3)
    })
  }

  function closeChat(conversationId: string) {
    setWindows((prev) => prev.filter((w) => w.conversationId !== conversationId))
  }

  function toggleMinimize(conversationId: string) {
    setWindows((prev) =>
      prev.map((w) => w.conversationId === conversationId ? { ...w, minimized: !w.minimized } : w),
    )
  }

  async function sendMessage(conversationId: string, body: string) {
    const optimistic: MessengerMessageDto = {
      id: `local-${Date.now()}`,
      conversationId,
      sender: me,
      body,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments: [],
    }
    setMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), optimistic] }))

    try {
      const sent = await api.sendMessengerMessage(conversationId, { body })
      setMessages((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) => m.id === optimistic.id ? sent : m),
      }))
    } catch {
      setMessages((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) =>
          m.id === optimistic.id ? { ...m, status: 'sent' as const } : m,
        ),
      }))
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <div className="mini-chat-region">
      {/* Open chat windows */}
      <div className="mini-chat-windows">
        {windows.map((w) => {
          const convo = conversations.find((c) => c.id === w.conversationId)
          if (!convo) return null
          return (
            <MiniChatBox
              key={w.conversationId}
              me={me}
              conversation={convo}
              messages={messages[w.conversationId] ?? []}
              minimized={w.minimized}
              onSend={sendMessage}
              onClose={() => closeChat(w.conversationId)}
              onMinimize={() => toggleMinimize(w.conversationId)}
              onOpenProfile={onOpenProfile}
            />
          )
        })}
      </div>

      {/* Conversation list popup */}
      {showList && (
        <div className="mini-chat-list">
          <header className="mini-chat-list-head">
            <h3>Chats</h3>
            <div className="mini-chat-list-actions">
              <button type="button" className="mini-ctrl" aria-label="Full messenger" onClick={onOpenFullMessenger}>
                <Icon name="messenger" size={16} />
              </button>
              <button type="button" className="mini-ctrl" aria-label="Close" onClick={() => setShowList(false)}>
                <Icon name="close" size={14} />
              </button>
            </div>
          </header>
          <label className="mini-chat-search">
            <Icon name="search" size={14} />
            <input placeholder="Search Messenger" />
          </label>
          <div className="mini-chat-rows">
            {conversations.map((c) => {
              const name = conversationName(c, me)
              return (
                <button key={c.id} type="button" className="mini-chat-row" onClick={() => openChat(c.id)}>
                  <Avatar name={name} src={conversationAvatar(c, me)} size={40} online />
                  <span className="mini-chat-row-copy">
                    <strong>{name}</strong>
                    <small>
                      {c.lastMessage?.sender.id === me.id ? 'You: ' : ''}
                      {c.lastMessage?.body ?? 'Start chatting'}
                      {' · '}
                      {timeAgo(c.updatedAt)}
                    </small>
                  </span>
                  {c.unreadCount > 0 && <i className="messenger-unread-dot" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        type="button"
        className="mini-chat-fab"
        aria-label="Messenger"
        onClick={() => setShowList((v) => !v)}
      >
        <Icon name="messenger" size={24} />
        {totalUnread > 0 && <span className="mini-chat-fab-badge">{totalUnread}</span>}
      </button>
    </div>
  )
}

import { useMemo } from 'react'
import type { MessengerConversationDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { timeAgo } from '../../lib/format'
import { conversationAvatar, conversationName } from './helpers'

interface ConversationListProps {
  me: UserSummary
  conversations: MessengerConversationDto[]
  selectedId: string | null
  query: string
  loading: boolean
  activeTab: 'inbox' | 'communities'
  totalUnread: number
  onSelect: (id: string) => void
  onQueryChange: (q: string) => void
  onTabChange: (tab: 'inbox' | 'communities') => void
  onNewMessage: () => void
}

export function ConversationList({
  me,
  conversations,
  selectedId,
  query,
  loading,
  activeTab,
  totalUnread,
  onSelect,
  onQueryChange,
  onTabChange,
  onNewMessage,
}: ConversationListProps) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((c) => conversationName(c, me).toLowerCase().includes(needle))
  }, [conversations, me, query])

  return (
    <aside className="messenger-list" aria-label="Chats">
      <header className="messenger-list-head">
        <h1>
          Chats
          {totalUnread > 0 && <span className="messenger-badge">{totalUnread}</span>}
        </h1>
        <div className="messenger-actions">
          <button type="button" className="icon-circle subtle" aria-label="Messenger settings">
            <Icon name="settings" size={18} />
          </button>
          <button type="button" className="icon-circle subtle" aria-label="New message" onClick={onNewMessage}>
            <Icon name="edit" size={18} />
          </button>
        </div>
      </header>

      <label className="messenger-search">
        <Icon name="search" size={16} />
        <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search Messenger" />
      </label>

      <div className="messenger-tabs" role="tablist" aria-label="Inbox filters">
        <button
          type="button"
          className={activeTab === 'inbox' ? 'active' : ''}
          onClick={() => onTabChange('inbox')}
        >
          Inbox
        </button>
        <button
          type="button"
          className={activeTab === 'communities' ? 'active' : ''}
          onClick={() => onTabChange('communities')}
        >
          Communities
        </button>
      </div>

      <div className="messenger-rows">
        {loading ? (
          <div className="messenger-loading">
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="muted small pad">No chats found.</p>
        ) : (
          filtered.map((conversation) => {
            const name = conversationName(conversation, me)
            const isActive = conversation.id === selectedId
            const hasUnread = conversation.unreadCount > 0
            return (
              <button
                type="button"
                key={conversation.id}
                className={`messenger-row${isActive ? ' active' : ''}${hasUnread ? ' unread' : ''}`}
                onClick={() => onSelect(conversation.id)}
              >
                <Avatar name={name} src={conversationAvatar(conversation, me)} size={56} online />
                <span className="messenger-row-copy">
                  <strong>{name}</strong>
                  <span>
                    {conversation.lastMessage?.sender.id === me.id ? 'You: ' : ''}
                    {conversation.lastMessage?.body ?? 'Start the conversation'}
                  </span>
                </span>
                <span className="messenger-row-meta">
                  {timeAgo(conversation.updatedAt)}
                  {hasUnread && <i className="messenger-unread-dot" />}
                </span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}

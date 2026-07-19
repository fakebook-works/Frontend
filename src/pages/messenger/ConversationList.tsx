import { useMemo } from 'react'
import type { MessengerPresenceDto } from '../../api/messenger'
import type { MessengerConversationDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { timeAgo } from '../../lib/format'
import { conversationAvatar, conversationName, messengerMessagePreview } from './helpers'
import { useI18n } from '../../i18n'

interface ConversationListProps {
  me: UserSummary
  conversations: MessengerConversationDto[]
  presenceByUserId: Record<string, MessengerPresenceDto>
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
  presenceByUserId,
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
  const { t } = useI18n()
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((c) => conversationName(c, me).toLowerCase().includes(needle))
  }, [conversations, me, query])

  return (
    <aside className="messenger-list" aria-label={t('chats')}>
      <header className="messenger-list-head">
        <h1>
          {t('chats')}
          {totalUnread > 0 && <span className="messenger-badge">{totalUnread}</span>}
        </h1>
        <div className="messenger-actions">
          <button type="button" className="btn-soft messenger-new-message" aria-label={t('newMessage')} onClick={onNewMessage}>
            <Icon name="edit" size={18} />
            <span>{t('newMessage')}</span>
          </button>
        </div>
      </header>

      <label className="messenger-search">
        <Icon name="search" size={16} />
        <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder={t('searchMessenger')} />
      </label>

      <div className="messenger-tabs" role="tablist" aria-label={t('inboxFilters')}>
        <button
          type="button"
          className={activeTab === 'inbox' ? 'active' : ''}
          onClick={() => onTabChange('inbox')}
        >
          {t('inbox')}
        </button>
        <button
          type="button"
          className={activeTab === 'communities' ? 'active' : ''}
          onClick={() => onTabChange('communities')}
        >
          {t('communities')}
        </button>
      </div>

      <div className="messenger-rows">
        {loading ? (
          <div className="messenger-loading">
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="muted small pad">{t('noChatsFound')}</p>
        ) : (
          filtered.map((conversation) => {
            const name = conversationName(conversation, me)
            const other = conversation.type === 'DIRECT'
              ? conversation.participants.find((participant) => participant.id !== me.id)
              : undefined
            const isActive = conversation.id === selectedId
            const hasUnread = conversation.unreadCount > 0
            return (
              <button
                type="button"
                key={conversation.id}
                className={`messenger-row${isActive ? ' active' : ''}${hasUnread ? ' unread' : ''}`}
                onClick={() => onSelect(conversation.id)}
              >
                <Avatar name={name} src={conversationAvatar(conversation, me)} size={56} online={Boolean(other && presenceByUserId[other.id]?.isOnline)} />
                <span className="messenger-row-copy">
                  <strong>{name}</strong>
                  <span>
                    {conversation.lastMessage?.sender.id === me.id ? `${t('you')}: ` : ''}
                    {messengerMessagePreview(conversation.lastMessage?.body) || t('startConversation')}
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

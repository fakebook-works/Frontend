import type { MessengerConversationDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { conversationAvatar, conversationName } from './helpers'

interface ConversationDetailProps {
  me: UserSummary
  conversation: MessengerConversationDto
  apiState: 'gateway' | 'seed'
  onOpenProfile: (id: string) => void
}

export function ConversationDetail({ me, conversation, apiState, onOpenProfile }: ConversationDetailProps) {
  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)

  return (
    <aside className="messenger-detail" aria-label="Conversation details">
      <Avatar name={name} src={avatar} size={84} online />
      <h2>{name}</h2>
      <p className="muted small">Fakebook friend</p>

      <div className="messenger-detail-actions">
        <button type="button" onClick={() => otherParticipant && onOpenProfile(otherParticipant.id)}>
          <Icon name="friends" size={16} />
          <span>Profile</span>
        </button>
        <button type="button">
          <Icon name="bell" size={16} />
          <span>Mute</span>
        </button>
        <button type="button">
          <Icon name="search" size={16} />
          <span>Search</span>
        </button>
      </div>

      <div className="messenger-detail-section">
        <button type="button" className="messenger-detail-row">
          <Icon name="photo" size={20} /> Media, files and links
          <Icon name="caret" size={14} className="detail-caret" />
        </button>
        <button type="button" className="messenger-detail-row">
          <Icon name="bookmark" size={20} /> Pinned messages
          <Icon name="caret" size={14} className="detail-caret" />
        </button>
        <button type="button" className="messenger-detail-row">
          <Icon name="settings" size={20} /> Chat settings
          <Icon name="caret" size={14} className="detail-caret" />
        </button>
      </div>

      <div className="messenger-gateway-note">
        <strong>🔗 API Gateway Routes</strong>
        <span>GET /api/messenger/conversations</span>
        <span>GET /api/messenger/conversations/:id/messages</span>
        <span>POST /api/messenger/conversations/:id/messages</span>
        <span>POST /api/messenger/conversations</span>
        <div className="msg-api-status">
          <span className={`msg-status-dot ${apiState}`} />
          <span>{apiState === 'gateway' ? 'Connected' : 'Using seed data'}</span>
        </div>
      </div>
    </aside>
  )
}

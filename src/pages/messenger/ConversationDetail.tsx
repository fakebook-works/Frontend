import type { MessengerPresenceDto } from '../../api/messenger'
import type { MessengerConversationDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { conversationAvatar, conversationName } from './helpers'
import { useI18n } from '../../i18n'

interface ConversationDetailProps {
  me: UserSummary
  conversation: MessengerConversationDto
  presence?: MessengerPresenceDto
  onOpenProfile: (id: string) => void
  onLeave?: () => void
}

export function ConversationDetail({ me, conversation, presence, onOpenProfile, onLeave }: ConversationDetailProps) {
  const { t } = useI18n()
  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)

  return (
    <aside className="messenger-detail" aria-label={t('conversationDetails')}>
      <Avatar name={name} src={avatar} size={84} online={conversation.type === 'DIRECT' && Boolean(presence?.isOnline)} />
      <h2>{name}<VerifiedBadge verified={otherParticipant?.isVerified} /></h2>
      <p className="muted small">{conversation.type === 'GROUP' ? t('groupConversation') : t('fakebookFriend')}</p>

      <div className="messenger-detail-actions">
        <button type="button" onClick={() => otherParticipant && onOpenProfile(otherParticipant.id)}>
          <Icon name="friends" size={16} />
          <span>{t('profile')}</span>
        </button>
      </div>

      <div className="messenger-detail-section">
        {conversation.type === 'GROUP' && onLeave && <button type="button" className="messenger-detail-row danger-text" onClick={onLeave}>
          <Icon name="logout" size={20} /> {t('leaveConversation')}
        </button>}
      </div>
    </aside>
  )
}

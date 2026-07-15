import type { MessengerConversationDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { conversationAvatar, conversationName } from './helpers'
import { useI18n } from '../../i18n'

interface ConversationDetailProps {
  me: UserSummary
  conversation: MessengerConversationDto
  onOpenProfile: (id: string) => void
}

export function ConversationDetail({ me, conversation, onOpenProfile }: ConversationDetailProps) {
  const { t } = useI18n()
  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)

  return (
    <aside className="messenger-detail" aria-label={t('conversationDetails')}>
      <Avatar name={name} src={avatar} size={84} online />
      <h2>{name}<VerifiedBadge verified={otherParticipant?.isVerified} /></h2>
      <p className="muted small">{t('fakebookFriend')}</p>

      <div className="messenger-detail-actions">
        <button type="button" onClick={() => otherParticipant && onOpenProfile(otherParticipant.id)}>
          <Icon name="friends" size={16} />
          <span>{t('profile')}</span>
        </button>
        <button type="button">
          <Icon name="bell" size={16} />
          <span>{t('mute')}</span>
        </button>
        <button type="button">
          <Icon name="search" size={16} />
          <span>{t('search')}</span>
        </button>
      </div>

      <div className="messenger-detail-section">
        <button type="button" className="messenger-detail-row">
          <Icon name="photo" size={20} /> {t('mediaFilesLinks')}
          <Icon name="caret" size={14} className="detail-caret" />
        </button>
        <button type="button" className="messenger-detail-row">
          <Icon name="bookmark" size={20} /> {t('pinnedMessages')}
          <Icon name="caret" size={14} className="detail-caret" />
        </button>
        <button type="button" className="messenger-detail-row">
          <Icon name="settings" size={20} /> {t('chatSettings')}
          <Icon name="caret" size={14} className="detail-caret" />
        </button>
      </div>
    </aside>
  )
}

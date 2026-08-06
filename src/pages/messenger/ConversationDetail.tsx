import { useState } from 'react'
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
  onOpenGroup?: () => void
  onLeave?: () => void
  onOpenMedia?: () => void
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="messenger-detail-section">
      <button type="button" className="messenger-detail-section-header" onClick={() => setOpen(!open)}>
        <h3>{title}</h3>
        <span style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', display: 'flex' }}>
          <Icon name="caret" size={20} />
        </span>
      </button>
      {open && <div className="messenger-detail-section-content">{children}</div>}
    </div>
  )
}

export function ConversationDetail({ me, conversation, presence, onOpenProfile, onOpenGroup, onLeave, onOpenMedia }: ConversationDetailProps) {
  const { t } = useI18n()
  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)
  const isGroup = conversation.type === 'GROUP'

  return (
    <aside className="messenger-detail" aria-label={t('conversationDetails')}>
      <div className="messenger-detail-header">
        <Avatar name={name} src={avatar} size={84} online={!isGroup && Boolean(presence?.isOnline)} onClick={isGroup ? onOpenGroup : otherParticipant ? () => onOpenProfile(otherParticipant.id) : undefined} />
        <h2>{name}<VerifiedBadge verified={otherParticipant?.isVerified} /></h2>
        <p className="muted small">{isGroup ? t('groupConversation') : t('fakebookFriend')}</p>
        
        <div className="messenger-detail-actions">
          <button type="button" onClick={() => isGroup ? onOpenGroup?.() : otherParticipant && onOpenProfile(otherParticipant.id)}>
            <Icon name={isGroup ? 'groups' : 'user'} size={16} />
            <span>{isGroup ? t('manageGroup') || 'Manage' : t('profile')}</span>
          </button>
        </div>
      </div>

      <CollapsibleSection title={t('conversationInfo') || 'Conversation Info'}>
        {isGroup ? (
          <div className="messenger-detail-row">
            <Icon name="groups" size={20} />
            <span>{conversation.participants.length} {t('members') || 'Members'}</span>
          </div>
        ) : (
          <div className="messenger-detail-row">
            <Icon name="user" size={20} />
            <span>{t('friendsOnFakebook')}</span>
          </div>
        )}
      </CollapsibleSection>

      {isGroup && (
        <CollapsibleSection title={t('customizeChat') || 'Customize Chat'}>
          <button type="button" className="messenger-detail-row action-row" onClick={onOpenGroup}>
            <Icon name="edit" size={20} />
            <span>{t('renameGroup') || 'Rename Group'}</span>
          </button>
          <button type="button" className="messenger-detail-row action-row" onClick={onOpenGroup}>
            <Icon name="user" size={20} />
            <span>{t('manageMembers') || 'Manage Members'}</span>
          </button>
        </CollapsibleSection>
      )}

      {isGroup && (
        <CollapsibleSection title={t('members') || 'Members'}>
          {conversation.participants.slice(0, 5).map(p => (
            <div key={p.id} className="messenger-detail-row member-row" onClick={() => onOpenProfile(p.id)}>
              <Avatar name={p.displayName} src={p.avatarUrl} size={32} />
              <span>{p.displayName}</span>
            </div>
          ))}
          {conversation.participants.length > 5 && (
            <button type="button" className="messenger-detail-row action-row" onClick={onOpenGroup}>
              <Icon name="groups" size={20} />
              <span>{t('viewAll') || 'View all'}</span>
            </button>
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection title={t('mediaFilesLinks') || 'Media, Files and Links'}>
        <button type="button" className="messenger-detail-row action-row" onClick={onOpenMedia}>
          <Icon name="bookmark" size={20} />
          <span>{t('mediaFilesLinks') || 'Media, Files and Links'}</span>
        </button>
      </CollapsibleSection>

      <CollapsibleSection title={t('privacySupport') || 'Privacy and Support'}>
        {isGroup && onLeave && (
          <button type="button" className="messenger-detail-row danger-text action-row" onClick={onLeave}>
            <Icon name="logout" size={20} />
            <span>{t('leaveConversation')}</span>
          </button>
        )}
      </CollapsibleSection>
    </aside>
  )
}

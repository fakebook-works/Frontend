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
  onOpenMediaTab?: (tab: 'media' | 'files' | 'links') => void
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="messenger-detail-accordion">
      <button type="button" className="messenger-detail-accordion-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}><Icon name="caret" size={16} /></span>
      </button>
      {open && <div className="messenger-detail-accordion-content">{children}</div>}
    </div>
  )
}

export function ConversationDetail({ me, conversation, presence, onOpenProfile, onOpenGroup, onLeave, onOpenMediaTab }: ConversationDetailProps) {
  const { t } = useI18n()
  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)

  return (
    <aside className="messenger-detail" aria-label={t('conversationDetails')}>
      <div className="messenger-detail-profile-header">
        <Avatar name={name} src={avatar} size={84} online={conversation.type === 'DIRECT' && Boolean(presence?.isOnline)} onClick={conversation.type === 'GROUP' ? onOpenGroup : otherParticipant ? () => onOpenProfile(otherParticipant.id) : undefined} />
        <h2>{name}<VerifiedBadge verified={otherParticipant?.isVerified} /></h2>
        {conversation.type === 'DIRECT' && <p className="muted small">{t('fakebookFriend')}</p>}
      </div>

      <div className="messenger-detail-actions-row">
        {conversation.type === 'GROUP' ? (
          <button type="button" className="action-circle-btn" onClick={() => onOpenGroup?.()}>
            <div className="action-circle-icon"><Icon name="groups" size={20} /></div>
            <span>{t('manageGroup')}</span>
          </button>
        ) : (
          <button type="button" className="action-circle-btn" onClick={() => otherParticipant && onOpenProfile(otherParticipant.id)}>
            <div className="action-circle-icon"><Icon name="user" size={20} /></div>
            <span>{t('profile')}</span>
          </button>
        )}
      </div>

      <div className="messenger-detail-sections">
        {conversation.type === 'GROUP' ? (
          <>
            <CollapsibleSection title="Tùy chỉnh đoạn chat">
              <button type="button" className="messenger-detail-row" onClick={() => onOpenGroup?.()}>
                <Icon name="edit" size={20} /> Đổi tên đoạn chat
              </button>
              <button type="button" className="messenger-detail-row" onClick={() => onOpenGroup?.()}>
                <Icon name="photo" size={20} /> Thay đổi ảnh
              </button>
            </CollapsibleSection>
            
            <CollapsibleSection title="Thành viên trong đoạn chat">
              <button type="button" className="messenger-detail-row" onClick={() => onOpenGroup?.()}>
                <Icon name="groups" size={20} /> Xem thành viên
              </button>
              <button type="button" className="messenger-detail-row" onClick={() => onOpenGroup?.()}>
                <Icon name="userPlus" size={20} /> Thêm người
              </button>
            </CollapsibleSection>

            <CollapsibleSection title="File phương tiện, file và liên kết">
              <button type="button" className="messenger-detail-row" onClick={() => onOpenMediaTab?.('media')}>
                <Icon name="photo" size={20} /> File phương tiện
              </button>
              <button type="button" className="messenger-detail-row" onClick={() => onOpenMediaTab?.('files')}>
                <Icon name="bookmark" size={20} /> File
              </button>
              <button type="button" className="messenger-detail-row" onClick={() => onOpenMediaTab?.('links')}>
                <Icon name="link" size={20} /> Liên kết
              </button>
            </CollapsibleSection>

            <CollapsibleSection title="Quyền riêng tư & hỗ trợ">
              {onLeave && (
                <button type="button" className="messenger-detail-row danger-text" onClick={onLeave}>
                  <Icon name="logout" size={20} /> Rời khỏi nhóm
                </button>
              )}
            </CollapsibleSection>
          </>
        ) : (
          <>
            <CollapsibleSection title="File phương tiện và file">
              <button type="button" className="messenger-detail-row" onClick={() => onOpenMediaTab?.('media')}>
                <Icon name="photo" size={20} /> File phương tiện
              </button>
              <button type="button" className="messenger-detail-row" onClick={() => onOpenMediaTab?.('files')}>
                <Icon name="bookmark" size={20} /> File
              </button>
            </CollapsibleSection>
          </>
        )}
      </div>
    </aside>
  )
}

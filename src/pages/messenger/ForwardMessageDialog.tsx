import { useMemo, useState } from 'react'
import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { conversationAvatar, conversationName, messengerMessagePreview } from './helpers'

interface ForwardMessageDialogProps {
  message: MessengerMessageDto
  conversations: MessengerConversationDto[]
  me: UserSummary
  onForward: (conversation: MessengerConversationDto) => Promise<void>
  onClose: () => void
}

export function ForwardMessageDialog({ message, conversations, me, onForward, onClose }: ForwardMessageDialogProps) {
  const [query, setQuery] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    return conversations.filter((conversation) => !value || conversationName(conversation, me).toLocaleLowerCase().includes(value))
  }, [conversations, me, query])
  const preview = messengerMessagePreview(message.body)
    || (message.attachments[0]?.type === 'image' ? 'Ảnh' : message.attachments[0]?.type === 'video' ? 'Video' : message.attachments[0]?.type === 'audio' ? 'Tin nhắn thoại' : 'Tệp đính kèm')

  async function forward(conversation: MessengerConversationDto) {
    if (sendingId || sentIds.has(conversation.id)) return
    setSendingId(conversation.id)
    setError(null)
    try {
      await onForward(conversation)
      setSentIds((current) => new Set(current).add(conversation.id))
    } catch {
      setError('Không thể chuyển tiếp tin nhắn. Vui lòng thử lại.')
    } finally {
      setSendingId(null)
    }
  }

  return <div className="forward-message-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="forward-message-dialog" role="dialog" aria-modal="true" aria-label="Chuyển tiếp tin nhắn">
      <header><span /><h2>Chuyển tiếp tin nhắn</h2><button type="button" aria-label="Đóng" onClick={onClose}><Icon name="close" size={20} /></button></header>
      <div className="forward-message-source"><small>Tin nhắn</small><strong>{preview}</strong></div>
      <label className="forward-message-search"><Icon name="search" size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm đoạn chat" /></label>
      {error && <p className="forward-message-error">{error}</p>}
      <div className="forward-message-list">
        {filtered.length === 0 ? <p>Không tìm thấy đoạn chat.</p> : filtered.map((conversation) => {
          const sent = sentIds.has(conversation.id)
          return <div className="forward-message-row" key={conversation.id}>
            <Avatar name={conversationName(conversation, me)} src={conversationAvatar(conversation, me)} size={42} />
            <strong>{conversationName(conversation, me)}</strong>
            <button type="button" className={sent ? 'sent' : ''} disabled={Boolean(sendingId) || sent} onClick={() => void forward(conversation)}>{sent ? 'Đã gửi' : sendingId === conversation.id ? 'Đang gửi...' : 'Gửi'}</button>
          </div>
        })}
      </div>
    </section>
  </div>
}

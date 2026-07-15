import { useCallback, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { EmojiButton } from './EmojiButton'
import { conversationAvatar, conversationName, formatTime, shouldShowAvatar, shouldShowTimestamp } from './helpers'
import { useI18n } from '../../i18n'

interface MessageThreadProps {
  me: UserSummary
  conversation: MessengerConversationDto
  messages: MessengerMessageDto[]
  draft: string
  pendingAttachments: MediaUpload[]
  uploading: boolean
  apiState: 'gateway' | 'seed'
  showDetail: boolean
  onDraftChange: (value: string) => void
  onAttachFiles: (files: FileList | null) => void
  onRemoveAttachment: (url: string) => void
  onSubmit: (e: FormEvent) => void
  onOpenProfile: (id: string) => void
  onToggleDetail: () => void
  onBack: () => void
}

export function MessageThread({
  me,
  conversation,
  messages,
  draft,
  pendingAttachments,
  uploading,
  apiState,
  showDetail,
  onDraftChange,
  onAttachFiles,
  onRemoveAttachment,
  onSubmit,
  onOpenProfile,
  onToggleDetail,
  onBack,
}: MessageThreadProps) {
  const { t } = useI18n()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)

  function handleSubmit(e: FormEvent) {
    onSubmit(e)
    inputRef.current?.focus()
  }

  return (
    <section className="messenger-thread" aria-label={name}>
      {/* Header */}
      <header className="messenger-thread-head">
        <button type="button" className="messenger-back" onClick={onBack} aria-label="Back to chats">
          <Icon name="caret" size={20} />
        </button>
        <button
          type="button"
          className="messenger-id"
          onClick={() => otherParticipant && onOpenProfile(otherParticipant.id)}
        >
          <Avatar name={name} src={avatar} size={40} online />
          <span>
            <strong>{name}<VerifiedBadge verified={otherParticipant?.isVerified} size={13} /></strong>
            <small>Active now</small>
          </span>
        </button>
        <div className="messenger-actions">
          <button type="button" className="icon-circle subtle" aria-label="Start audio call">
            <Icon name="phone" size={19} />
          </button>
          <button type="button" className="icon-circle subtle" aria-label="Start video call">
            <Icon name="video" size={19} />
          </button>
          <button
            type="button"
            className={`icon-circle subtle${showDetail ? ' active' : ''}`}
            aria-label="Conversation info"
            onClick={onToggleDetail}
          >
            <Icon name="info" size={19} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="messenger-messages">
        <div className="messenger-intro">
          <Avatar name={name} src={avatar} size={72} online />
          <h2>{name}<VerifiedBadge verified={otherParticipant?.isVerified} /></h2>
          <p>{apiState === 'gateway' ? t('messengerReadyMessage') : t('messengerPreviewMessage')}</p>
        </div>

        {messages.map((message, idx) => {
          const mine = message.sender.id === me.id
          const showTime = shouldShowTimestamp(messages, idx)
          const showAv = shouldShowAvatar(messages, idx)

          return (
            <div key={message.id}>
              {showTime && <div className="message-timestamp">{formatTime(message.createdAt)}</div>}
              <div className={`message-line${mine ? ' mine' : ''}${showAv ? '' : ' grouped'}`}>
                {!mine && (
                  <div className="message-avatar-slot">
                    {showAv && <Avatar name={message.sender.displayName} src={message.sender.avatarUrl} size={28} />}
                  </div>
                )}
                <div className="message-stack">
                  {message.body && <p>{message.body}</p>}
                  {message.attachments?.map((attachment) => (
                    <a
                      key={attachment.url}
                      className={`message-attachment ${attachment.type}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.type === 'image' ? (
                        <img src={attachment.url} alt={attachment.name} />
                      ) : (
                        <span>{attachment.name}</span>
                      )}
                    </a>
                  ))}
                </div>
                {mine && message.status && (
                  <small className="message-status">
                    {message.status === 'sending'
                      ? '⏳'
                      : message.status === 'sent'
                        ? '✓'
                        : message.status === 'delivered'
                          ? '✓✓'
                          : '👁'}
                  </small>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      <form className="messenger-compose" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          className="messenger-file-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,application/pdf"
          onChange={(event) => {
            onAttachFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
        <button
          type="button"
          className="icon-circle subtle"
          aria-label="Add attachment"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Icon name="plus" size={19} />
        </button>
        <button
          type="button"
          className="icon-circle subtle"
          aria-label="Attach photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Icon name="photo" size={19} />
        </button>
        <button type="button" className="icon-circle subtle" aria-label="Record voice">
          <Icon name="mic" size={19} />
        </button>
        <label className="messenger-input-wrap">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Aa"
            autoComplete="off"
          />
          <EmojiButton onPick={(emoji) => onDraftChange(draft + emoji)} />
        </label>
        <button
          type="submit"
          className={`icon-circle subtle send${draft.trim() ? ' ready' : ''}`}
          aria-label="Send message"
          disabled={uploading || (!draft.trim() && pendingAttachments.length === 0)}
        >
          {draft.trim() || pendingAttachments.length ? <Icon name="send" size={18} /> : <Icon name="like" size={22} />}
        </button>
      </form>
      {(pendingAttachments.length > 0 || uploading) && (
        <div className="messenger-attachment-tray">
          {uploading && <span className="attachment-chip">Uploading...</span>}
          {pendingAttachments.map((attachment) => (
            <button
              key={attachment.url}
              type="button"
              className="attachment-chip"
              onClick={() => onRemoveAttachment(attachment.url)}
            >
              {attachment.name}
              <span>×</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { messengerApi, type MessengerPresenceDto } from '../../api/messenger'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { EmojiButton } from './EmojiButton'
import { MESSENGER_ATTACHMENT_ACCEPT } from './attachmentPolicy'
import { conversationAvatar, conversationName, formatPresence, formatTime, messageGroupPosition, messengerLikeLevel, shouldShowAvatar, shouldShowTimestamp } from './helpers'
import type { MessengerLikeLevel } from './helpers'
import { HoldLikeButton } from './HoldLikeButton'
import { MessengerLikeIcon } from './MessengerLikeIcon'
import { MediaAttachmentPreview, MediaGallery } from './MediaGallery'
import { MessageActionRail, MessageHoverTimestamp, MessageReactionSummary, MessageReplyPreview } from './MessageInteractions'
import { useI18n } from '../../i18n'

interface MessageThreadProps {
  me: UserSummary
  conversation: MessengerConversationDto
  messages: MessengerMessageDto[]
  draft: string
  pendingAttachments: MediaUpload[]
  uploading: boolean
  apiState: 'gateway' | 'unavailable'
  showDetail: boolean
  presence?: MessengerPresenceDto
  typingUserId: string | null
  onDraftChange: (value: string) => void
  onAttachFiles: (files: FileList | null) => void
  onRemoveAttachment: (url: string) => void
  onSubmit: (e: FormEvent) => void
  onSendLike: (level: MessengerLikeLevel) => void
  replyTarget: MessengerMessageDto | null
  onReplyMessage: (message: MessengerMessageDto) => void
  onCancelReply: () => void
  onReactMessage: (message: MessengerMessageDto, emoji: string | null) => void | Promise<void>
  onRecallMessage: (message: MessengerMessageDto) => void | Promise<void>
  onForwardMessage: (message: MessengerMessageDto) => void
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
  presence,
  typingUserId,
  onDraftChange,
  onAttachFiles,
  onRemoveAttachment,
  onSubmit,
  onSendLike,
  replyTarget,
  onReplyMessage,
  onCancelReply,
  onReactMessage,
  onRecallMessage,
  onForwardMessage,
  onOpenProfile,
  onToggleDetail,
  onBack,
}: MessageThreadProps) {
  const { t } = useI18n()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const keepBottomAfterReplyRef = useRef(false)
  const replyNavigationHighlightRef = useRef<{ element: HTMLElement; timeoutId: number } | null>(null)
  const [presenceNow, setPresenceNow] = useState(() => Date.now())

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  const loadConversationImages = useCallback(
    () => messengerApi.conversationImages(conversation.id),
    [conversation.id],
  )

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom, typingUserId])

  useEffect(() => {
    const intervalId = window.setInterval(() => setPresenceNow(Date.now()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (replyTarget) inputRef.current?.focus()
  }, [replyTarget])

  useLayoutEffect(() => {
    if (!replyTarget || !keepBottomAfterReplyRef.current) return
    const container = messagesContainerRef.current
    if (container) container.scrollTop = container.scrollHeight
    keepBottomAfterReplyRef.current = false
  }, [replyTarget])

  useEffect(() => () => {
    const highlight = replyNavigationHighlightRef.current
    if (highlight) window.clearTimeout(highlight.timeoutId)
  }, [])

  const handleReplyMessage = useCallback((message: MessengerMessageDto) => {
    const container = messagesContainerRef.current
    keepBottomAfterReplyRef.current = Boolean(
      container && container.scrollHeight - container.scrollTop - container.clientHeight <= 40,
    )
    onReplyMessage(message)
  }, [onReplyMessage])

  const navigateToMessage = useCallback((messageId: string) => {
    const container = messagesContainerRef.current
    const target = container
      ? Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'))
        .find((element) => element.dataset.messageId === messageId)
      : undefined
    if (!target) return

    const previousHighlight = replyNavigationHighlightRef.current
    if (previousHighlight) {
      window.clearTimeout(previousHighlight.timeoutId)
      previousHighlight.element.classList.remove('reply-navigation-target')
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.remove('reply-navigation-target')
    void target.offsetWidth
    target.classList.add('reply-navigation-target')
    const timeoutId = window.setTimeout(() => {
      target.classList.remove('reply-navigation-target')
      if (replyNavigationHighlightRef.current?.element === target) replyNavigationHighlightRef.current = null
    }, 1_400)
    replyNavigationHighlightRef.current = { element: target, timeoutId }
  }, [])

  const name = conversationName(conversation, me)
  const avatar = conversationAvatar(conversation, me)
  const otherParticipant = conversation.participants.find((p) => p.id !== me.id)
  const latestOwnPendingMessage = [...messages].reverse().find((message) => !message.deleted && message.sender.id === me.id && (message.status === 'sent' || message.status === 'delivered'))
  const latestOwnReadMessage = [...messages].reverse().find((message) => !message.deleted && message.sender.id === me.id && message.status === 'read')
  const typingParticipant = typingUserId
    ? conversation.participants.find((participant) => participant.id === typingUserId)
    : undefined
  const isOnline = Boolean(presence?.isOnline)

  function handleSubmit(e: FormEvent) {
    onSubmit(e)
    inputRef.current?.focus()
  }

  return (
    <section className="messenger-thread" aria-label={name}>
      {/* Header */}
      <header className="messenger-thread-head">
        <button type="button" className="messenger-back" onClick={onBack} aria-label={t('backToChats')}>
          <Icon name="caret" size={20} />
        </button>
        <button
          type="button"
          className="messenger-id"
          onClick={() => otherParticipant && onOpenProfile(otherParticipant.id)}
        >
          <Avatar name={name} src={avatar} size={40} online={isOnline} />
          <span>
            <strong>{name}<VerifiedBadge verified={otherParticipant?.isVerified} size={13} /></strong>
            {conversation.type === 'DIRECT' && <small className={typingParticipant ? 'typing' : isOnline ? 'online' : 'offline'}>{typingParticipant ? t('typingNow') : formatPresence(presence, t, presenceNow)}</small>}
          </span>
        </button>
        <div className="messenger-actions">
          <button
            type="button"
            className={`icon-circle subtle${showDetail ? ' active' : ''}`}
            aria-label={t('conversationInfo')}
            onClick={onToggleDetail}
          >
            <Icon name="info" size={19} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="messenger-messages" ref={messagesContainerRef}>
        <div className="messenger-intro">
          <Avatar name={name} src={avatar} size={72} online={isOnline} />
          <h2>{name}<VerifiedBadge verified={otherParticipant?.isVerified} /></h2>
          <p>{apiState === 'gateway' ? t('messengerReadyMessage') : t('messengerUnavailableDesc')}</p>
        </div>

        {messages.map((message, idx) => {
          const mine = message.sender.id === me.id
          const showTime = shouldShowTimestamp(messages, idx)
          const showAv = shouldShowAvatar(messages, idx)
          const groupPosition = messageGroupPosition(messages, idx)
          const likeLevel = messengerLikeLevel(message.body)
          const repliedMessage = message.replyToMessageId
            ? messages.find((candidate) => candidate.id === message.replyToMessageId)
            : null
          const hasReactions = Boolean(message.reactions?.length)
          const actionable = !message.deleted && !message.id.startsWith('local-')

          return (
            <div className="message-entry" data-message-id={message.id} key={message.id}>
              {showTime && <div className="message-timestamp">{formatTime(message.createdAt)}</div>}
              <div className={`message-line group-${groupPosition}${mine ? ' mine' : ''}`}>
                {!mine && (
                  <div className="message-avatar-slot">
                    {showAv && <Avatar name={message.sender.displayName} src={message.sender.avatarUrl} size={28} />}
                  </div>
                )}
                <div className={`message-stack message-interaction-host${hasReactions ? ' has-reactions' : ''}`}>
                  {message.replyToMessageId && <MessageReplyPreview message={repliedMessage} missing={!repliedMessage} viewerId={me.id} replyingSender={message.sender} onNavigate={repliedMessage ? () => navigateToMessage(message.replyToMessageId!) : undefined} />}
                  <div className="message-primary-shell">
                    <div className="message-content-hover-target">
                      {message.deleted
                        ? <p className="message-deleted-bubble">Tin nhắn đã được thu hồi</p>
                        : likeLevel
                          ? <span className={`messenger-like-message level-${likeLevel}`} aria-label={t('like')}><MessengerLikeIcon size={48} /></span>
                          : message.body && <p>{message.body}</p>}
                      {!message.deleted && <MediaGallery attachments={message.attachments} messageId={message.id} mine={mine} senderName={message.sender.displayName} loadConversationImages={loadConversationImages} />}
                      <MessageHoverTimestamp createdAt={message.createdAt} mine={mine} />
                      <MessageReactionSummary reactions={message.reactions} viewerId={me.id} />
                    </div>
                    {actionable && <MessageActionRail message={message} viewerId={me.id} mine={mine} onReact={(emoji) => onReactMessage(message, emoji)} onReply={() => handleReplyMessage(message)} onRecall={mine ? () => onRecallMessage(message) : undefined} onForward={() => onForwardMessage(message)} />}
                  </div>
                </div>
              </div>
              {mine && latestOwnPendingMessage?.id === message.id && <div className="message-delivery-state"><span>{message.status === 'delivered' ? 'Đã nhận' : 'Đã gửi'}</span></div>}
              {mine && latestOwnReadMessage?.id === message.id && otherParticipant && <div className="message-delivery-state read" title={`${otherParticipant.displayName} đã xem`}><Avatar name={otherParticipant.displayName} src={otherParticipant.avatarUrl} size={16} /></div>}
            </div>
          )
        })}
        {typingParticipant && <div className="message-typing-line" aria-label={`${typingParticipant.displayName} ${t('typingNow')}`}><div className="message-avatar-slot"><Avatar name={typingParticipant.displayName} src={typingParticipant.avatarUrl} size={28} /></div><span className="message-typing-bubble"><i /><i /><i /></span></div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      {replyTarget && <div className="messenger-replying-bar"><MessageReplyPreview message={replyTarget} viewerId={me.id} composer onCancel={onCancelReply} /></div>}
      <form className="messenger-compose" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          className="messenger-file-input"
          type="file"
          multiple
          accept={MESSENGER_ATTACHMENT_ACCEPT}
          onChange={(event) => {
            onAttachFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
        <button
          type="button"
          className="icon-circle subtle"
          aria-label={t('addAttachment')}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Icon name="plus" size={19} />
        </button>
        <button
          type="button"
          className="icon-circle subtle"
          aria-label={t('attachPhoto')}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Icon name="photo" size={19} />
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
        {draft.trim() || pendingAttachments.length ? <button
          type="submit"
          className="icon-circle subtle send ready"
          aria-label={t('sendMessage')}
          disabled={uploading}
        >
          <Icon name="send" size={20} />
        </button> : <HoldLikeButton label={t('like')} disabled={uploading} buttonClassName="icon-circle subtle send ready messenger-hold-like" onSend={onSendLike} />}
      </form>
      {(pendingAttachments.length > 0 || uploading) && (
        <div className="messenger-attachment-tray">
          {uploading && <span className="attachment-chip">{t('uploading')}</span>}
          {pendingAttachments.map((attachment) => (
            <button
              key={attachment.url}
              type="button"
              className="attachment-chip"
              onClick={() => onRemoveAttachment(attachment.url)}
            >
              <MediaAttachmentPreview attachment={attachment} />
              <span className="attachment-chip-name">{attachment.name}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

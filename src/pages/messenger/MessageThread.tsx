import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { messengerApi, type MessengerPresenceDto } from '../../api/messenger'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { RichTextContent } from '../../components/MentionContent'
import { Icon } from '../../components/Icon'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { LinkPreview } from '../../components/LinkPreview'
import { clipboardImageFiles } from '../../lib/clipboardMedia'
import { isDirectImageUrl, remoteImageFileFromUrl } from '../../lib/urlMedia'
import { INPUT_LIMITS } from '../../lib/inputLimits'
import { EmojiButton } from './EmojiButton'
import { MESSENGER_ATTACHMENT_ACCEPT } from './attachmentPolicy'
import { conversationAvatar, conversationName, formatPresence, formatTime, messageGroupPosition, messageReadReceiptParticipant, messengerLikeLevel, shouldShowAvatar, shouldShowTimestamp } from './helpers'
import type { MessageVisualBreaks, MessengerLikeLevel } from './helpers'
import { HoldLikeButton } from './HoldLikeButton'
import { MessengerLikeIcon } from './MessengerLikeIcon'
import { MediaAttachmentPreview, MediaGallery } from './MediaGallery'
import { MessageActionRail, MessageHoverTimestamp, MessageReactionSummary, MessageReplyPreview } from './MessageInteractions'
import { MessageSenderAvatar } from './MessageSenderAvatar'
import { MessageEditHistory, MessageEditingBar, MessageEditMarker } from './MessageEditState'
import { SystemMessageLine } from './SystemMessageLine'
import type { PendingMediaUploadPreview } from './pendingMediaUploadState'
import { useI18n } from '../../i18n'

interface MessageThreadProps {
  me: UserSummary
  conversation: MessengerConversationDto
  messages: MessengerMessageDto[]
  draft: string
  pendingAttachments: MediaUpload[]
  pendingUploadPreviews: PendingMediaUploadPreview[]
  uploading: boolean
  apiState: 'gateway' | 'unavailable'
  showDetail: boolean
  presence?: MessengerPresenceDto
  groupPresenceLabel?: string
  groupOnlineCount?: number
  typingUserId: string | null
  onInteract: () => void
  onDraftChange: (value: string) => void
  onAttachFiles: (files: FileList | File[] | null) => void
  onRemoveAttachment: (url: string) => void
  onRemovePendingUpload: (id: string) => void
  onSubmit: (e: FormEvent) => void
  onSendLike: (level: MessengerLikeLevel) => void
  replyTarget: MessengerMessageDto | null
  onReplyMessage: (message: MessengerMessageDto) => void
  onCancelReply: () => void
  onReactMessage: (message: MessengerMessageDto, emoji: string | null) => void | Promise<void>
  onRecallMessage: (message: MessengerMessageDto) => void | Promise<void>
  onEditMessage: (message: MessengerMessageDto, text: string) => void | Promise<void>
  onForwardMessage: (message: MessengerMessageDto) => void
  onOpenProfile: (id: string) => void
  onNavigate?: (path: string) => void
  onOpenGroup?: () => void
  onUnblockDirect?: (targetUserId: string) => void
  onToggleDetail: () => void
  onBack: () => void
}

export function MessageThread({
  me,
  conversation,
  messages,
  draft,
  pendingAttachments,
  pendingUploadPreviews,
  uploading,
  apiState,
  showDetail,
  presence,
  groupPresenceLabel,
  groupOnlineCount = 0,
  typingUserId,
  onInteract,
  onDraftChange,
  onAttachFiles,
  onRemoveAttachment,
  onRemovePendingUpload,
  onSubmit,
  onSendLike,
  replyTarget,
  onReplyMessage,
  onCancelReply,
  onReactMessage,
  onRecallMessage,
  onEditMessage,
  onForwardMessage,
  onOpenProfile,
  onNavigate,
  onOpenGroup,
  onUnblockDirect,
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [expandedEditHistoryIds, setExpandedEditHistoryIds] = useState<Set<string>>(() => new Set())

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  const loadConversationMedia = useCallback(
    () => messengerApi.conversationMedia(conversation.id),
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

  useEffect(() => {
    setEditingMessageId(null)
    setEditDraft('')
    setEditBusy(false)
    setExpandedEditHistoryIds(new Set())
  }, [conversation.id])

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
    setEditingMessageId(null)
    setEditDraft('')
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
  const latestReadParticipant = latestOwnReadMessage
    ? messageReadReceiptParticipant(conversation, latestOwnReadMessage, me.id)
    : undefined
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  )
  const editingMessage = editingMessageId
    ? messageById.get(editingMessageId) ?? null
    : null
  const visualBreaks = useMemo<MessageVisualBreaks>(() => ({
    beforeMessageIds: new Set(messages
      .filter((message) => Boolean(message.editedAt) || message.id === editingMessageId)
      .map((message) => message.id)),
    afterMessageIds: new Set([
      latestOwnPendingMessage?.id,
      latestOwnReadMessage?.id,
    ].filter((id): id is string => Boolean(id))),
  }), [editingMessageId, latestOwnPendingMessage?.id, latestOwnReadMessage?.id, messages])
  const typingParticipant = typingUserId
    ? conversation.participants.find((participant) => participant.id === typingUserId)
    : undefined
  const isOnline = conversation.type === 'GROUP' ? groupOnlineCount > 0 : Boolean(presence?.isOnline)
  const viewerBlockedOther = conversation.type === 'DIRECT' && Boolean(conversation.viewerHasBlockedDirectUser)
  const otherBlockedViewer = conversation.type === 'DIRECT' && Boolean(conversation.directUserHasBlockedViewer)
  const directBlockNotice = viewerBlockedOther && otherBlockedViewer
    ? 'messengerBlockedBoth'
    : viewerBlockedOther
      ? 'messengerBlockedByYou'
      : otherBlockedViewer
        ? 'messengerBlockedByThem'
        : null

  function handleSubmit(e: FormEvent) {
    if (editingMessage) {
      void saveEdit(e, editingMessage)
      return
    }
    onSubmit(e)
    inputRef.current?.focus()
  }

  function beginEditing(message: MessengerMessageDto) {
    onCancelReply()
    setExpandedEditHistoryIds((current) => {
      if (!current.has(message.id)) return current
      const next = new Set(current)
      next.delete(message.id)
      return next
    })
    setEditingMessageId(message.id)
    setEditDraft(message.body)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  function cancelEditing() {
    setEditingMessageId(null)
    setEditDraft('')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  function toggleEditHistory(messageId: string) {
    setExpandedEditHistoryIds((current) => {
      const next = new Set(current)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  async function saveEdit(event: FormEvent, message: MessengerMessageDto) {
    event.preventDefault()
    const text = editDraft.trim()
    if (!text || editBusy) return
    setEditBusy(true)
    try {
      await onEditMessage(message, text)
      cancelEditing()
    } catch {
      // The parent keeps the existing message and exposes the shared API state.
    } finally {
      setEditBusy(false)
    }
  }

  return (
    <section className="messenger-thread" aria-label={name} onClickCapture={onInteract}>
      {/* Header */}
      <header className="messenger-thread-head">
        <button type="button" className="messenger-back" onClick={onBack} aria-label={t('backToChats')}>
          <Icon name="caret" size={20} />
        </button>
        <div className="messenger-id">
          <button type="button" className="messenger-id-avatar" aria-label={name} onClick={() => {
            if (conversation.type === 'GROUP') onOpenGroup?.()
            else if (otherParticipant) onOpenProfile(otherParticipant.id)
          }}>
            <Avatar name={name} src={avatar} size={40} online={isOnline} fallback={conversation.type === 'GROUP' ? 'initials' : 'avatar'} />
          </button>
          <span>
            <strong>{name}<VerifiedBadge verified={otherParticipant?.isVerified} size={13} /></strong>
            <small className={typingParticipant ? 'typing' : isOnline ? 'online' : 'offline'}>{typingParticipant ? t('typingNow') : conversation.type === 'GROUP' ? groupPresenceLabel ?? t('offline') : formatPresence(presence, t, presenceNow)}</small>
          </span>
        </div>
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
      <div className={`messenger-messages${editingMessage ? ' has-edit-focus' : ''}`} ref={messagesContainerRef}>
        <div className="messenger-intro">
          <Avatar name={name} src={avatar} size={72} online={isOnline} fallback={conversation.type === 'GROUP' ? 'initials' : 'avatar'} />
          <h2>{name}<VerifiedBadge verified={otherParticipant?.isVerified} /></h2>
          <p>{apiState === 'gateway' ? t('messengerReadyMessage') : t('messengerUnavailableDesc')}</p>
        </div>

        {messages.map((message, idx) => {
          if (message.kind === 'SYSTEM') {
            return <SystemMessageLine key={message.id} message={message} viewerId={me.id} />
          }
          const mine = message.sender.id === me.id
          const showTime = shouldShowTimestamp(messages, idx)
          const showAv = shouldShowAvatar(messages, idx, visualBreaks)
          const groupPosition = messageGroupPosition(messages, idx, visualBreaks)
          const likeLevel = messengerLikeLevel(message.body)
          const repliedMessage = message.replyToMessageId
            ? messageById.get(message.replyToMessageId)
            : null
          const hasReactions = Boolean(message.reactions?.length)
          const actionable = !message.deleted && !message.id.startsWith('local-')
          const canEdit = actionable && mine && Boolean(message.body.trim()) && !likeLevel &&
            Date.now() - new Date(message.createdAt).getTime() <= 15 * 60_000
          const senderIsAdmin = conversation.type === 'GROUP' &&
            conversation.participants.some((participant) => participant.id === message.sender.id && participant.role === 'ADMIN')
          const editing = editingMessageId === message.id
          const historyExpanded = expandedEditHistoryIds.has(message.id)

          return (
            <div
              className={`message-entry${editing ? ' is-editing' : ''}`}
              data-message-id={message.id}
              inert={Boolean(editingMessage) && !editing}
              key={message.id}
            >
              {showTime && <div className="message-timestamp">{formatTime(message.createdAt)}</div>}
              <div className={`message-line group-${groupPosition}${mine ? ' mine' : ''}`}>
                {!mine && (
                  <div className="message-avatar-slot">
                    {showAv && <MessageSenderAvatar person={message.sender} size={30} isAdmin={senderIsAdmin} />}
                  </div>
                )}
                <div className={`message-stack message-interaction-host${hasReactions ? ' has-reactions' : ''}`}>
                  {(editing || message.editedAt) && <MessageEditMarker
                    active={editing}
                    expanded={historyExpanded}
                    onClick={() => editing ? cancelEditing() : toggleEditHistory(message.id)}
                  />}
                  {historyExpanded && !editing && <MessageEditHistory revisions={message.editHistory ?? []} />}
                  {message.replyToMessageId && <MessageReplyPreview message={repliedMessage} missing={!repliedMessage} viewerId={me.id} replyingSender={message.sender} onNavigate={repliedMessage ? () => navigateToMessage(message.replyToMessageId!) : undefined} />}
                  <div className="message-primary-shell">
                    <div className="message-content-hover-target">
                      {message.deleted
                        ? <p className="message-deleted-bubble">Tin nhắn đã được thu hồi</p>
                        : likeLevel
                          ? <span className={`messenger-like-message level-${likeLevel}`} aria-label={t('like')}><MessengerLikeIcon size={48} /></span>
                          : message.body && <><p><RichTextContent content={message.body} onNavigate={onNavigate} /></p><LinkPreview content={message.body} onNavigate={onNavigate} /></>}
                      {!message.deleted && <MediaGallery attachments={message.attachments} messageId={message.id} mine={mine} senderName={message.sender.displayName} loadConversationMedia={loadConversationMedia} onForward={() => onForwardMessage(message)} />}
                      <MessageHoverTimestamp createdAt={message.createdAt} mine={mine} />
                      <MessageReactionSummary reactions={message.reactions} viewerId={me.id} />
                    </div>
                    {actionable && !editing && <MessageActionRail message={message} viewerId={me.id} mine={mine} canEdit={canEdit} onEdit={() => beginEditing(message)} onReact={(emoji) => onReactMessage(message, emoji)} onReply={() => handleReplyMessage(message)} onRecall={mine ? () => onRecallMessage(message) : undefined} onForward={() => onForwardMessage(message)} />}
                  </div>
                </div>
              </div>
              {mine && latestOwnPendingMessage?.id === message.id && <div className="message-delivery-state"><span>{message.status === 'delivered' ? 'Đã nhận' : 'Đã gửi'}</span></div>}
              {mine && latestOwnReadMessage?.id === message.id && latestReadParticipant && <div className="message-delivery-state read" title={`${latestReadParticipant.displayName} đã xem`}><Avatar name={latestReadParticipant.displayName} src={latestReadParticipant.avatarUrl} size={16} /></div>}
            </div>
          )
        })}
        {typingParticipant && <div className="message-typing-line" aria-label={`${typingParticipant.displayName} ${t('typingNow')}`}><div className="message-avatar-slot"><MessageSenderAvatar person={typingParticipant} size={30} isAdmin={conversation.type === 'GROUP' && typingParticipant.role === 'ADMIN'} /></div><span className="message-typing-bubble"><i /><i /><i /></span></div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      {directBlockNotice ? <div className="messenger-block-notice" role="status">
        <p>{t(directBlockNotice)}</p>
        {viewerBlockedOther && otherParticipant && onUnblockDirect && <button type="button" onClick={() => onUnblockDirect(otherParticipant.id)}>{t('unblock')}</button>}
      </div> : <>
      {editingMessage
        ? <div className="messenger-editing-bar"><MessageEditingBar message={editingMessage} onCancel={cancelEditing} /></div>
        : replyTarget && <div className="messenger-replying-bar"><MessageReplyPreview message={replyTarget} viewerId={me.id} composer onCancel={onCancelReply} /></div>}
      <form className="messenger-compose" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          className="messenger-file-input"
          type="file"
          multiple
          accept={MESSENGER_ATTACHMENT_ACCEPT}
          disabled={Boolean(editingMessage) || uploading}
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
          disabled={Boolean(editingMessage) || uploading}
        >
          <Icon name="plus" size={19} />
        </button>
        <button
          type="button"
          className="icon-circle subtle"
          aria-label={t('attachPhoto')}
          onClick={() => fileInputRef.current?.click()}
          disabled={Boolean(editingMessage) || uploading}
        >
          <Icon name="photo" size={19} />
        </button>
        <label className="messenger-input-wrap">
          <input
            ref={inputRef}
            value={editingMessage ? editDraft : draft}
            onChange={(e) => editingMessage ? setEditDraft(e.target.value) : onDraftChange(e.target.value)}
            onPaste={(event) => {
              if (editingMessage || pendingAttachments.length >= 10) return
              const pastedImages = clipboardImageFiles(event.clipboardData)
              if (pastedImages.length > 0) {
                event.preventDefault()
                onAttachFiles(pastedImages.slice(0, 10 - pendingAttachments.length))
                return
              }
              const pasted = event.clipboardData.getData('text').trim()
              if (!isDirectImageUrl(pasted)) return
              event.preventDefault()
              void remoteImageFileFromUrl(pasted).then((file) => onAttachFiles([file])).catch(() => onDraftChange(`${draft}${draft ? ' ' : ''}${pasted}`))
            }}
            placeholder="Aa"
            maxLength={INPUT_LIMITS.messenger}
            autoComplete="off"
          />
          <EmojiButton onPick={(emoji) => editingMessage ? setEditDraft(editDraft + emoji) : onDraftChange(draft + emoji)} />
        </label>
        {editingMessage || draft.trim() || pendingAttachments.length || pendingUploadPreviews.length ? <button
          type="submit"
          className="icon-circle subtle send ready"
          aria-label={t('sendMessage')}
          disabled={uploading || editBusy || (Boolean(editingMessage) && !editDraft.trim())}
        >
          <Icon name="send" size={20} />
        </button> : <HoldLikeButton label={t('like')} disabled={uploading} buttonClassName="icon-circle subtle send ready messenger-hold-like" onSend={onSendLike} />}
      </form>
      {(pendingAttachments.length > 0 || pendingUploadPreviews.length > 0) && (
        <div className="messenger-attachment-tray">
          {pendingUploadPreviews.map((preview) => (
            <button className="attachment-chip" key={preview.id} type="button" onClick={() => onRemovePendingUpload(preview.id)}>
              <MediaAttachmentPreview attachment={preview.attachment} />
              <span className="attachment-chip-name">{preview.attachment.name}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
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
      </>}
    </section>
  )
}

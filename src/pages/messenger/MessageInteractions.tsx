import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { MessengerMessageDto, MessengerMessageReactionDto, UserSummary } from '../../api/types'
import { formatMessageHoverTime } from './messageInteractionTime'
import { messengerLikeLevel } from './helpers'
import { MessengerLikeIcon } from './MessengerLikeIcon'
import './MessageInteractions.css'

const QUICK_REACTIONS = ['🌺', '👀', '😱', '😢', '🙀', '👌'] as const

function ReactionIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4" /><circle cx="9" cy="10" r=".8" className="fill" /><circle cx="15" cy="10" r=".8" className="fill" /><path d="M8.6 14.1c1 1.45 2.1 2.15 3.4 2.15s2.4-.7 3.4-2.15" /></svg>
}

function ReplyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path className="fill" d="M10.1 5.1 3.4 11.2a1.1 1.1 0 0 0 0 1.6l6.7 6.1c.65.6 1.7.13 1.7-.75v-3.1c4.05.05 6.8 1.15 8.25 3.35.35.53 1.18.22 1.08-.42-.76-4.92-3.84-7.72-9.35-8.1V5.85c0-.88-1.04-1.35-1.68-.75Z" /></svg>
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="1.55" className="fill" /><circle cx="12" cy="12" r="1.55" className="fill" /><circle cx="12" cy="18.5" r="1.55" className="fill" /></svg>
}

function ReplyContextIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7.2 3 2.6 7.1a.8.8 0 0 0 0 1.2l4.6 4.1c.45.4 1.15.08 1.15-.52V9.9c2.65.05 4.45.78 5.4 2.2.24.36.8.15.73-.28-.5-3.25-2.52-5.08-6.13-5.34V3.52c0-.6-.7-.92-1.15-.52Z" /></svg>
}

function PaperclipIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6.8 10.7 5.55-5.55a2.45 2.45 0 0 1 3.47 3.47l-6.7 6.7a3.7 3.7 0 0 1-5.24-5.23l6.5-6.5" /></svg>
}

function useFloatingPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  layerRef: RefObject<HTMLElement | null>,
  align: 'start' | 'end',
  refreshKey: unknown,
): CSSProperties {
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const anchor = anchorRef.current
      const layer = layerRef.current
      if (!anchor || !layer) return
      const anchorRect = anchor.getBoundingClientRect()
      const layerRect = layer.getBoundingClientRect()
      const viewportPadding = 8
      const wantedLeft = align === 'end' ? anchorRect.right - layerRect.width : anchorRect.left
      const left = Math.min(
        window.innerWidth - layerRect.width - viewportPadding,
        Math.max(viewportPadding, wantedLeft),
      )
      const above = anchorRect.top - layerRect.height - 8
      const top = above >= viewportPadding
        ? above
        : Math.min(window.innerHeight - layerRect.height - viewportPadding, anchorRect.bottom + 8)
      setPosition({ left, top, visibility: 'visible' })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [align, anchorRef, layerRef, open, refreshKey])
  return position
}

interface MessageActionRailProps {
  message: MessengerMessageDto
  viewerId: string
  mine: boolean
  compact?: boolean
  onReact: (emoji: string | null) => void | Promise<void>
  onReply: () => void
  onRecall?: () => void | Promise<void>
  onForward: () => void
}

export function MessageActionRail({
  message,
  viewerId,
  mine,
  compact = false,
  onReact,
  onReply,
  onRecall,
  onForward,
}: MessageActionRailProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const reactionButtonRef = useRef<HTMLButtonElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const pickerLayerRef = useRef<HTMLDivElement>(null)
  const menuLayerRef = useRef<HTMLDivElement>(null)
  const selectedReaction = message.reactions?.find((reaction) => reaction.userId === viewerId)?.emoji ?? null
  const pickerPosition = useFloatingPosition(pickerOpen, reactionButtonRef, pickerLayerRef, mine ? 'end' : 'start', pickerOpen)
  const menuPosition = useFloatingPosition(moreOpen, moreButtonRef, menuLayerRef, mine ? 'start' : 'end', mine)

  useEffect(() => {
    if (!pickerOpen && !moreOpen) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !pickerLayerRef.current?.contains(target) && !menuLayerRef.current?.contains(target)) {
        setPickerOpen(false)
        setMoreOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false)
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [moreOpen, pickerOpen])

  async function chooseReaction(emoji: string) {
    if (pending) return
    setPending(true)
    try {
      await onReact(selectedReaction === emoji ? null : emoji)
      setPickerOpen(false)
    } finally {
      setPending(false)
    }
  }

  async function recall() {
    if (!onRecall || pending) return
    setPending(true)
    try {
      await onRecall()
      setMoreOpen(false)
    } finally {
      setPending(false)
    }
  }

  return <div ref={rootRef} className={`message-action-rail ${mine ? 'mine' : 'received'}${compact ? ' compact' : ''}${pickerOpen || moreOpen ? ' open' : ''}`}>
    <button ref={moreButtonRef} type="button" className="message-action-button more" aria-label="Tùy chọn khác" title="Tùy chọn khác" disabled={pending} onClick={() => { setMoreOpen((value) => !value); setPickerOpen(false) }}><MoreIcon /></button>
    <button type="button" className="message-action-button reply" aria-label="Trả lời" title="Trả lời" disabled={pending} onClick={onReply}><ReplyIcon /></button>
    <button ref={reactionButtonRef} type="button" className={`message-action-button react${pickerOpen ? ' active' : ''}`} aria-label="Bày tỏ cảm xúc" title="Bày tỏ cảm xúc" disabled={pending} onClick={() => { setPickerOpen((value) => !value); setMoreOpen(false) }}><ReactionIcon /></button>

    {pickerOpen && createPortal(<div ref={pickerLayerRef} className="message-reaction-picker floating" style={pickerPosition} role="menu" aria-label="Chọn cảm xúc">
      <div className="message-reaction-row">
        {QUICK_REACTIONS.map((emoji) => <button key={emoji} type="button" role="menuitemradio" aria-checked={selectedReaction === emoji} className={selectedReaction === emoji ? 'selected' : ''} disabled={pending} onClick={() => void chooseReaction(emoji)}>{emoji}</button>)}
        <button type="button" className="reaction-more" aria-label="Thêm cảm xúc" onClick={() => undefined}><span className="reaction-plus-glyph" aria-hidden="true" /></button>
      </div>
    </div>, document.body)}

    {moreOpen && createPortal(<div ref={menuLayerRef} className="message-more-menu floating" style={menuPosition} role="menu" aria-label="Tùy chọn tin nhắn">
      {mine && onRecall && <button type="button" role="menuitem" disabled={pending} onClick={() => void recall()}>Thu hồi</button>}
      <button type="button" role="menuitem" disabled={pending} onClick={() => { setMoreOpen(false); onForward() }}>Chuyển tiếp</button>
    </div>, document.body)}
  </div>
}

export function MessageHoverTimestamp({ createdAt, mine }: { createdAt: string; mine: boolean }) {
  const label = formatMessageHoverTime(createdAt)
  const markerRef = useRef<HTMLSpanElement>(null)
  const layerRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })

  useEffect(() => {
    const anchor = markerRef.current?.parentElement
    if (!anchor) return
    const show = () => setVisible(true)
    const hide = () => setVisible(false)
    const handleFocusOut = (event: FocusEvent) => {
      if (!anchor.contains(event.relatedTarget as Node | null)) hide()
    }
    anchor.addEventListener('mouseenter', show)
    anchor.addEventListener('mouseleave', hide)
    anchor.addEventListener('focusin', show)
    anchor.addEventListener('focusout', handleFocusOut)
    return () => {
      anchor.removeEventListener('mouseenter', show)
      anchor.removeEventListener('mouseleave', hide)
      anchor.removeEventListener('focusin', show)
      anchor.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  useLayoutEffect(() => {
    if (!visible) return
    const update = () => {
      const anchor = markerRef.current?.parentElement
      const layer = layerRef.current
      if (!anchor || !layer) return
      const anchorRect = anchor.getBoundingClientRect()
      const layerRect = layer.getBoundingClientRect()
      const padding = 6
      const wantedLeft = mine
        ? anchorRect.right + padding
        : anchorRect.left - layerRect.width - padding
      const left = Math.min(window.innerWidth - layerRect.width - 4, Math.max(4, wantedLeft))
      const top = Math.min(
        window.innerHeight - layerRect.height - 4,
        Math.max(4, anchorRect.top + (anchorRect.height - layerRect.height) / 2),
      )
      setPosition({ left, top, visibility: 'visible' })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [mine, visible])

  if (!label) return null
  return <>
    <span ref={markerRef} className="message-hover-marker" aria-hidden="true" />
    {visible && createPortal(<span ref={layerRef} className="message-hover-timestamp" style={position} role="tooltip">{label}</span>, document.body)}
  </>
}

interface MessageReactionSummaryProps {
  reactions?: MessengerMessageReactionDto[]
  viewerId: string
}

export function MessageReactionSummary({ reactions = [], viewerId }: MessageReactionSummaryProps) {
  const summary = useMemo(() => {
    const groups = new Map<string, number>()
    reactions.forEach((reaction) => groups.set(reaction.emoji, (groups.get(reaction.emoji) ?? 0) + 1))
    return [...groups.entries()].sort((left, right) => right[1] - left[1])
  }, [reactions])
  if (summary.length === 0) return null
  const total = reactions.length
  const mine = reactions.some((reaction) => reaction.userId === viewerId)
  return <span className={`message-reaction-summary${mine ? ' mine-reacted' : ''}`} title={`${total} lượt bày tỏ cảm xúc`}>
    <span>{summary.slice(0, 3).map(([emoji]) => emoji).join('')}</span>
    {total > 1 && <b>{total}</b>}
  </span>
}

interface MessageReplyPreviewProps {
  message?: MessengerMessageDto | null
  missing?: boolean
  composer?: boolean
  compact?: boolean
  onCancel?: () => void
  onNavigate?: () => void
  viewerId?: string
  replyingSender?: UserSummary
}

export function MessageReplyPreview({ message, missing = false, composer = false, compact = false, onCancel, onNavigate, viewerId, replyingSender }: MessageReplyPreviewProps) {
  if (!message && !missing) return null
  const firstAttachment = message?.attachments[0]
  const attachmentKind = firstAttachment?.mediaType ?? firstAttachment?.type
  const likeLevel = message?.deleted ? null : messengerLikeLevel(message?.body)
  const preview = message?.deleted
    ? 'Tin nhắn đã được thu hồi'
    : likeLevel
      ? 'Like'
      : message?.body
      || (attachmentKind === 'image' ? 'Ảnh' : attachmentKind === 'video' ? 'Video' : attachmentKind === 'audio' ? 'Tin nhắn thoại' : firstAttachment ? 'Tệp đính kèm' : 'Tin nhắn')

  if (composer) return <div className={`message-reply-preview composer${compact ? ' compact' : ''}`}>
    <span className="message-reply-copy">
      <strong>Đang trả lời {message?.sender.id === viewerId ? 'chính mình' : message?.sender.displayName ?? 'một tin nhắn'}</strong>
      {likeLevel
        ? <small className="message-reply-composer-like" role="img" aria-label="Like"><MessengerLikeIcon /></small>
        : <small>{preview}</small>}
    </span>
    {onCancel && <button type="button" aria-label="Hủy trả lời" onClick={onCancel}>×</button>}
  </div>

  const actorName = replyingSender?.id === viewerId ? 'Bạn' : replyingSender?.displayName ?? 'Bạn'
  const targetName = !message
    ? 'một tin nhắn'
    : replyingSender?.id === message.sender.id
      ? 'chính mình'
      : message.sender.id === viewerId
        ? 'bạn'
        : message.sender.displayName
  const sourceKind = likeLevel ? 'like' : attachmentKind === 'image' ? 'picture' : firstAttachment ? 'file' : 'text'
  const sourceContent = likeLevel
    ? <span className="message-reply-like" role="img" aria-label="Like"><MessengerLikeIcon /></span>
    : sourceKind === 'picture' && firstAttachment
    ? <img src={firstAttachment.thumbnailUrl || firstAttachment.url} alt="" />
    : sourceKind === 'file'
      ? <span><em>{attachmentKind === 'audio' ? 'Tin nhắn thoại' : attachmentKind === 'video' ? 'Video đính kèm' : 'File đính kèm'}</em><PaperclipIcon /></span>
      : <span>{missing ? 'Tin nhắn không còn tồn tại' : preview}</span>

  return <div className={`message-reply-preview sent ${sourceKind}${attachmentKind === 'audio' ? ' voice' : ''}${compact ? ' compact' : ''}`}>
    <small className="message-reply-context"><ReplyContextIcon />{actorName} đã trả lời {targetName}</small>
    <div
      className="message-reply-source"
      role={onNavigate ? 'button' : undefined}
      tabIndex={onNavigate ? 0 : undefined}
      aria-label={onNavigate ? 'Đi tới tin nhắn được trả lời' : undefined}
      onClick={onNavigate}
      onKeyDown={onNavigate ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onNavigate()
      } : undefined}
    >
      {sourceContent}
    </div>
  </div>
}

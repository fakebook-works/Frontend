import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import type { MessengerPresenceDto } from '../../api/messenger'

const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000
const MESSENGER_LIKE_PATTERN = /^\[\[fakebook:like:([123])\]\]$/

export type MessageGroupPosition = 'single' | 'start' | 'middle' | 'end'
export type MessengerLikeLevel = 1 | 2 | 3
type Translate = (key: string, values?: Record<string, string | number>) => string

export function encodeMessengerLike(level: MessengerLikeLevel): string {
  return `[[fakebook:like:${level}]]`
}

export function messengerLikeLevel(body: string | null | undefined): MessengerLikeLevel | null {
  const match = body?.match(MESSENGER_LIKE_PATTERN)
  return match ? Number(match[1]) as MessengerLikeLevel : null
}

export function messengerMessagePreview(body: string | null | undefined): string {
  return messengerLikeLevel(body) ? '👍' : body ?? ''
}

export function conversationName(conversation: MessengerConversationDto, me: UserSummary): string {
  return (
    (conversation.title ??
      conversation.participants
        .filter((p) => p.id !== me.id)
        .map((p) => p.displayName)
        .join(', ')) ||
    me.displayName
  )
}

export function conversationAvatar(conversation: MessengerConversationDto, me: UserSummary): string | null {
  return conversation.avatarUrl ?? conversation.participants.find((p) => p.id !== me.id)?.avatarUrl ?? null
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (isToday) return clock
  return (
    d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }) +
    ' ' +
    clock
  )
}

export function formatPresence(status: MessengerPresenceDto | undefined, t: Translate, now = Date.now()): string {
  if (status?.isOnline) return t('activeNow')
  if (!status) return t('offline')
  const updatedAt = new Date(status.updatedAt).getTime()
  if (!Number.isFinite(updatedAt)) return t('offline')
  const elapsedMinutes = Math.max(0, Math.floor((now - updatedAt) / 60_000))
  if (elapsedMinutes < 1) return t('activeJustNow')
  if (elapsedMinutes < 60) return t('activeMinutesAgo', { count: elapsedMinutes })
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return t('activeHoursAgo', { count: elapsedHours })
  return t('activeDaysAgo', { count: Math.floor(elapsedHours / 24) })
}

export function shouldShowTimestamp(messages: MessengerMessageDto[], index: number): boolean {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].createdAt).getTime()
  const curr = new Date(messages[index].createdAt).getTime()
  return curr - prev > 1000 * 60 * 15
}

export function shouldShowAvatar(messages: MessengerMessageDto[], index: number): boolean {
  const position = messageGroupPosition(messages, index)
  return position === 'single' || position === 'end'
}

export function messageGroupPosition(messages: MessengerMessageDto[], index: number): MessageGroupPosition {
  const current = messages[index]
  if (!current) return 'single'

  const joinsPrevious = index > 0 && messagesBelongToSameGroup(messages[index - 1], current)
  const joinsNext = index < messages.length - 1 && messagesBelongToSameGroup(current, messages[index + 1])

  if (!joinsPrevious && !joinsNext) return 'single'
  if (!joinsPrevious) return 'start'
  if (joinsNext) return 'middle'
  return 'end'
}

function messagesBelongToSameGroup(first: MessengerMessageDto, second: MessengerMessageDto): boolean {
  if (first.sender.id !== second.sender.id) return false
  const firstTime = new Date(first.createdAt).getTime()
  const secondTime = new Date(second.createdAt).getTime()
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return false
  return Math.abs(secondTime - firstTime) <= MESSAGE_GROUP_WINDOW_MS
}

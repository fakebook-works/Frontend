import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import type { MessengerPresenceDto } from '../../api/messenger'
import { resolveMediaKind } from './MediaGallery'

const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000
const MESSENGER_LIKE_PATTERN = /^\[\[fakebook:like:([123])\]\]$/
export const MAX_SEEN_REALTIME_EVENT_IDS = 4_096

export type MessageGroupPosition = 'single' | 'start' | 'middle' | 'end'
export type MessengerLikeLevel = 1 | 2 | 3
export interface MessageVisualBreaks {
  beforeMessageIds: ReadonlySet<string>
  afterMessageIds: ReadonlySet<string>
}
type Translate = (key: string, values?: Record<string, string | number>) => string

const NO_MESSAGE_VISUAL_BREAKS: MessageVisualBreaks = {
  beforeMessageIds: new Set<string>(),
  afterMessageIds: new Set<string>(),
}

export function rememberRealtimeEventId(
  seenEventIds: Set<string>,
  eventId: string,
  maxSize = MAX_SEEN_REALTIME_EVENT_IDS,
): boolean {
  if (seenEventIds.has(eventId)) {
    // Refresh insertion order so frequently duplicated events remain inside the LRU window.
    seenEventIds.delete(eventId)
    seenEventIds.add(eventId)
    return false
  }

  seenEventIds.add(eventId)
  const boundedSize = Math.max(1, maxSize)
  while (seenEventIds.size > boundedSize) {
    const oldestEventId = seenEventIds.values().next().value
    if (oldestEventId === undefined) break
    seenEventIds.delete(oldestEventId)
  }
  return true
}

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

export function messengerConversationPreview(message: MessengerMessageDto | null | undefined, t: Translate): string {
  if (!message) return ''
  if (message.kind === 'SYSTEM') return systemMessageLabel(message, '', t)
  const text = messengerMessagePreview(message.body).trim()
  if (text) return text

  const attachments = message.attachments ?? []
  if (attachments.length === 0) return t('sentMessagePreview')
  const kinds = attachments.map(resolveMediaKind)
  if (kinds.every((kind) => kind === 'image')) {
    return attachments.length === 1
      ? t('sentPhotoPreview')
      : t('sentPhotosPreview', { count: attachments.length })
  }
  if (attachments.length === 1) {
    if (kinds[0] === 'audio') return t('sentVoicePreview')
    if (kinds[0] === 'video') return t('sentVideoPreview')
    return t('sentFilePreview')
  }
  return t('sentAttachmentsPreview', { count: attachments.length })
}

export function systemMessageLabel(message: MessengerMessageDto, viewerId: string, t: Translate): string {
  const actor = message.sender.id === viewerId ? t('you') : message.sender.displayName
  const subject = message.systemSubject?.id === viewerId
    ? t('you').toLocaleLowerCase()
    : message.systemSubject?.displayName ?? t('systemUnknownMember')
  switch (message.systemEvent) {
    case 'MEMBER_ADDED': return t('systemMemberAdded', { actor, subject })
    case 'MEMBER_REMOVED': return t('systemMemberRemoved', { actor, subject })
    case 'MEMBER_LEFT': return t('systemMemberLeft', { actor })
    case 'ADMIN_GRANTED': return t('systemAdminGranted', { actor, subject })
    case 'ADMIN_REVOKED': return t('systemAdminRevoked', { actor, subject })
    case 'GROUP_RENAMED': return t('systemGroupRenamed', { actor })
    case 'GROUP_AVATAR_CHANGED': return t('systemGroupAvatarChanged', { actor })
    default: return t('sentMessagePreview')
  }
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
  if (!status?.updatedAt) return t('offline')
  const updatedAt = new Date(status.updatedAt).getTime()
  if (!Number.isFinite(updatedAt)) return t('offline')
  const elapsedMinutes = Math.max(0, Math.floor((now - updatedAt) / 60_000))
  if (elapsedMinutes < 1) return t('activeJustNow')
  if (elapsedMinutes < 60) return t('activeMinutesAgo', { count: elapsedMinutes })
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return t('activeHoursAgo', { count: elapsedHours })
  return t('activeDaysAgo', { count: Math.floor(elapsedHours / 24) })
}

export function groupPresenceSummary(
  conversation: MessengerConversationDto,
  viewerId: string,
  presenceByUserId: Record<string, MessengerPresenceDto>,
  t: Translate,
  now = Date.now(),
): { onlineCount: number; label: string } {
  const statuses = conversation.participants
    .filter((participant) => participant.id !== viewerId && !participant.leftAt)
    .flatMap((participant) => presenceByUserId[participant.id] ? [presenceByUserId[participant.id]] : [])
  const onlineCount = statuses.filter((status) => status.isOnline).length
  if (onlineCount > 0) return { onlineCount, label: t('groupActiveCount', { count: onlineCount }) }
  const latest = statuses
    .filter((status) => status.updatedAt && Number.isFinite(new Date(status.updatedAt).getTime()))
    .sort((left, right) => new Date(right.updatedAt!).getTime() - new Date(left.updatedAt!).getTime())[0]
  return { onlineCount: 0, label: latest ? formatPresence(latest, t, now) : t('offline') }
}

export function shouldShowTimestamp(messages: MessengerMessageDto[], index: number): boolean {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].createdAt).getTime()
  const curr = new Date(messages[index].createdAt).getTime()
  return curr - prev > 1000 * 60 * 15
}

export function shouldShowAvatar(messages: MessengerMessageDto[], index: number, breaks = NO_MESSAGE_VISUAL_BREAKS): boolean {
  const position = messageGroupPosition(messages, index, breaks)
  return position === 'single' || position === 'end'
}

export function messageGroupPosition(
  messages: MessengerMessageDto[],
  index: number,
  breaks = NO_MESSAGE_VISUAL_BREAKS,
): MessageGroupPosition {
  const current = messages[index]
  if (!current) return 'single'

  const joinsPrevious = index > 0 && messagesBelongToSameVisualGroup(messages[index - 1], current, breaks)
  const joinsNext = index < messages.length - 1 && messagesBelongToSameVisualGroup(current, messages[index + 1], breaks)

  if (!joinsPrevious && !joinsNext) return 'single'
  if (!joinsPrevious) return 'start'
  if (joinsNext) return 'middle'
  return 'end'
}

function messagesBelongToSameVisualGroup(
  first: MessengerMessageDto,
  second: MessengerMessageDto,
  breaks: MessageVisualBreaks,
): boolean {
  return messagesBelongToSameGroup(first, second) &&
    !breaks.afterMessageIds.has(first.id) &&
    !breaks.beforeMessageIds.has(second.id)
}

function messagesBelongToSameGroup(first: MessengerMessageDto, second: MessengerMessageDto): boolean {
  if (first.kind === 'SYSTEM' || second.kind === 'SYSTEM') return false
  if (first.sender.id !== second.sender.id) return false
  const firstTime = new Date(first.createdAt).getTime()
  const secondTime = new Date(second.createdAt).getTime()
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return false
  return Math.abs(secondTime - firstTime) <= MESSAGE_GROUP_WINDOW_MS
}

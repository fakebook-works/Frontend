import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'

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
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

export function shouldShowTimestamp(messages: MessengerMessageDto[], index: number): boolean {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].createdAt).getTime()
  const curr = new Date(messages[index].createdAt).getTime()
  return curr - prev > 1000 * 60 * 15
}

export function shouldShowAvatar(messages: MessengerMessageDto[], index: number): boolean {
  if (index === messages.length - 1) return true
  return messages[index].sender.id !== messages[index + 1].sender.id
}

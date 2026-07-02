import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Seed data (fallback when API Gateway is unreachable)               */
/* ------------------------------------------------------------------ */

const SEED_SNIPPETS = [
  'Can you check the new API gateway route?',
  'Looks good on my side 👍',
  'I sent the screenshots in the group.',
  'Wanna grab lunch later?',
  'Check out this meme 😂',
]

const SEED_PEOPLE: UserSummary[] = [
  { id: 'seed-linh', username: 'linh.tran', displayName: 'Linh Tran', avatarUrl: null },
  { id: 'seed-minh', username: 'minh.do', displayName: 'Minh Do', avatarUrl: null },
  { id: 'seed-anna', username: 'anna.nguyen', displayName: 'Anna Nguyen', avatarUrl: null },
  { id: 'seed-duc', username: 'duc.pham', displayName: 'Duc Pham', avatarUrl: null },
  { id: 'seed-mai', username: 'mai.le', displayName: 'Mai Le', avatarUrl: null },
]

export function seedConversations(me: UserSummary, friends: UserSummary[]): MessengerConversationDto[] {
  const now = Date.now()
  const people = friends.length ? friends : SEED_PEOPLE

  return people.slice(0, 8).map((person, i) => {
    const createdAt = new Date(now - (i + 1) * 1000 * 60 * 17).toISOString()
    return {
      id: `seed-${person.id}`,
      participants: [me, person],
      title: null,
      avatarUrl: person.avatarUrl,
      updatedAt: createdAt,
      unreadCount: i === 0 ? 2 : i === 2 ? 1 : 0,
      lastMessage: {
        id: `seed-last-${person.id}`,
        conversationId: `seed-${person.id}`,
        sender: i % 2 ? me : person,
        body: SEED_SNIPPETS[i % SEED_SNIPPETS.length],
        createdAt,
        status: i === 0 ? 'delivered' : 'read',
      },
    }
  })
}

export function seedMessages(conversation: MessengerConversationDto, me: UserSummary): MessengerMessageDto[] {
  const other = conversation.participants.find((p) => p.id !== me.id) ?? conversation.participants[0]
  const base = Date.now() - 1000 * 60 * 120

  return [
    { id: `${conversation.id}-m1`, conversationId: conversation.id, sender: other, body: 'Hey! How is everything going?', createdAt: new Date(base).toISOString(), status: 'read' },
    { id: `${conversation.id}-m2`, conversationId: conversation.id, sender: me, body: 'Great, thanks! Working on the messenger UI right now.', createdAt: new Date(base + 1000 * 60 * 5).toISOString(), status: 'read' },
    { id: `${conversation.id}-m3`, conversationId: conversation.id, sender: other, body: 'Nice! The API gateway routes are being set up on the backend.', createdAt: new Date(base + 1000 * 60 * 12).toISOString(), status: 'read' },
    { id: `${conversation.id}-m4`, conversationId: conversation.id, sender: me, body: 'Perfect. The UI will connect through the gateway once the endpoints are live.', createdAt: new Date(base + 1000 * 60 * 18).toISOString(), status: 'read' },
    { id: `${conversation.id}-m5`, conversationId: conversation.id, sender: other, body: conversation.lastMessage?.body ?? 'Sounds good, keep me posted!', createdAt: conversation.updatedAt, status: conversation.lastMessage?.status ?? 'delivered' },
  ]
}

import { gatewayGraphQl, graphQlLongLiteral } from './client'
import { subscribeGatewayGraphQl } from './realtime'
import { socialApi } from './social'
import type { MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from './types'

interface SendMessageBody {
  body: string
  attachments?: MediaUpload[]
}

interface ParticipantGraphQl {
  userId: string
  lastDeliveredSequence: string
  lastReadSequence: string
  user: FederatedUserGraphQl | null
}

interface FederatedUserGraphQl {
  id: string
  name: string
  avatar: string
  isVerified: boolean
}

interface MessageGraphQl {
  id: string
  conversationId: string
  senderUserId: string
  sequence: string
  text: string | null
  createdAt: string
  deleted: boolean
  attachments: Array<{ ordinal: number; url: string }>
  sender: FederatedUserGraphQl | null
}

interface ConversationGraphQl {
  id: string
  type: 'DIRECT' | 'GROUP'
  title: string | null
  avatarUrl: string | null
  updatedAt: string
  currentSequence: string
  participants: ParticipantGraphQl[]
  lastMessage: MessageGraphQl | null
}

interface RealtimeEvent {
  eventId: string
  kind: string
  conversationId: string | null
  messageId: string | null
  userId: string | null
  sequence: string | null
}

const MESSAGE_FIELDS = `
  id conversationId senderUserId sequence text createdAt deleted
  attachments { ordinal url }
  sender { id name avatar isVerified }
`

const CONVERSATION_FIELDS = `
  id type title avatarUrl updatedAt currentSequence
  participants { userId lastDeliveredSequence lastReadSequence user { id name avatar isVerified } }
  lastMessage { ${MESSAGE_FIELDS} }
`

function attachmentFromUrl(url: string, ordinal: number): MediaUpload {
  const cleanName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || `attachment-${ordinal + 1}`)
  const isImage = /\.(?:png|jpe?g|gif|webp|avif)$/i.test(cleanName)
  const isVideo = /\.(?:mp4|webm|mov)$/i.test(cleanName)
  return {
    url,
    type: isVideo ? 'video' : 'image',
    contentType: isVideo ? 'video/*' : isImage ? 'image/*' : 'application/octet-stream',
    size: 0,
    name: cleanName,
  }
}

async function participantMap(conversations: ConversationGraphQl[], viewerId: string): Promise<Map<string, UserSummary>> {
  const ids = [...new Set(conversations.flatMap((conversation) => conversation.participants.map((participant) => String(participant.userId))))]
  const people = new Map<string, UserSummary>()
  for (const participant of conversations.flatMap((conversation) => conversation.participants)) {
    if (!participant.user) continue
    const id = String(participant.user.id)
    people.set(id, { id, username: participant.user.name, displayName: participant.user.name, avatarUrl: participant.user.avatar || null, isVerified: participant.user.isVerified })
  }
  const missingIds = ids.filter((id) => !people.has(id))
  const profiles = await socialApi.getProfiles(missingIds).catch(() => [])
  for (const profile of profiles) people.set(profile.id, {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isVerified: profile.isVerified,
  })
  for (const id of ids) {
    if (!people.has(id)) people.set(id, { id, username: id, displayName: id === viewerId ? 'You' : 'Fakebook user', avatarUrl: null })
  }
  return people
}

function messageFromGraphQl(message: MessageGraphQl, people: Map<string, UserSummary>, viewerId: string, status: MessengerMessageDto['status'] = 'sent'): MessengerMessageDto {
  const senderId = String(message.senderUserId)
  const federatedSender = message.sender ? {
    id: String(message.sender.id),
    username: message.sender.name,
    displayName: message.sender.name,
    avatarUrl: message.sender.avatar || null,
    isVerified: message.sender.isVerified,
  } : null
  return {
    id: String(message.id),
    conversationId: String(message.conversationId),
    sender: federatedSender ?? people.get(senderId) ?? {
      id: senderId,
      username: senderId,
      displayName: senderId === viewerId ? 'You' : 'Fakebook user',
      avatarUrl: null,
    },
    body: message.deleted ? '' : message.text ?? '',
    createdAt: message.createdAt,
    status,
    attachments: message.attachments.map((attachment) => attachmentFromUrl(attachment.url, attachment.ordinal)),
  }
}

function conversationFromGraphQl(conversation: ConversationGraphQl, people: Map<string, UserSummary>, viewerId: string): MessengerConversationDto {
  const me = conversation.participants.find((participant) => String(participant.userId) === viewerId)
  const currentSequence = Number(conversation.currentSequence)
  const lastRead = Number(me?.lastReadSequence ?? 0)
  return {
    id: String(conversation.id),
    participants: conversation.participants.flatMap((participant) => {
      const user = people.get(String(participant.userId))
      return user ? [user] : []
    }),
    title: conversation.title,
    avatarUrl: conversation.avatarUrl,
    updatedAt: conversation.updatedAt,
    unreadCount: Math.max(0, currentSequence - lastRead),
    lastMessage: conversation.lastMessage ? messageFromGraphQl(conversation.lastMessage, people, viewerId) : null,
  }
}

export async function conversations(viewerId: string, first = 30, after: string | null = null): Promise<MessengerConversationDto[]> {
  const data = await gatewayGraphQl<{ myConversations: { items: ConversationGraphQl[] } }>(
    `query MyConversations($first: Int!, $after: String) {
      myConversations(first: $first, after: $after) { items { ${CONVERSATION_FIELDS} } }
    }`,
    { first, after },
  )
  const people = await participantMap(data.myConversations.items, viewerId)
  return data.myConversations.items.map((conversation) => conversationFromGraphQl(conversation, people, viewerId))
}

export async function messages(conversationId: string, viewerId: string, last = 50): Promise<MessengerMessageDto[]> {
  const [messageData, conversationData] = await Promise.all([
    gatewayGraphQl<{ conversationMessages: { items: MessageGraphQl[] } }>(
      `query ConversationMessages($id: UUID!, $last: Int!) {
        conversationMessages(conversationId: $id, last: $last) { items { ${MESSAGE_FIELDS} } }
      }`,
      { id: conversationId, last },
    ),
    gatewayGraphQl<{ conversation: ConversationGraphQl }>(
      `query ConversationParticipants($id: UUID!) { conversation(id: $id) { ${CONVERSATION_FIELDS} } }`,
      { id: conversationId },
    ),
  ])
  const people = await participantMap([conversationData.conversation], viewerId)
  const otherRead = Math.max(0, ...conversationData.conversation.participants
    .filter((participant) => String(participant.userId) !== viewerId)
    .map((participant) => Number(participant.lastReadSequence)))
  return messageData.conversationMessages.items.map((message) => messageFromGraphQl(
    message,
    people,
    viewerId,
    String(message.senderUserId) === viewerId && Number(message.sequence) <= otherRead ? 'read' : 'sent',
  ))
}

export async function sendMessage(conversationId: string, viewerId: string, body: SendMessageBody): Promise<MessengerMessageDto> {
  const clientMessageId = crypto.randomUUID()
  const data = await gatewayGraphQl<{ sendMessage: MessageGraphQl }>(
    `mutation SendMessage($input: SendMessageInput!) { sendMessage(input: $input) { ${MESSAGE_FIELDS} } }`,
    {
      input: {
        conversationId,
        clientMessageId,
        text: body.body || null,
        attachmentUrls: body.attachments?.map((attachment) => attachment.url) ?? [],
      },
    },
  )
  const profiles = await socialApi.getProfiles([String(data.sendMessage.senderUserId)]).catch(() => [])
  const people = new Map(profiles.map((profile) => [profile.id, {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isVerified: profile.isVerified,
  }]))
  return messageFromGraphQl(data.sendMessage, people, viewerId)
}

export async function createDirectConversation(targetUserId: string, viewerId: string): Promise<MessengerConversationDto> {
  const target = graphQlLongLiteral(targetUserId)
  const data = await gatewayGraphQl<{ createDirectConversation: ConversationGraphQl }>(
    `mutation CreateDirectConversation {
      createDirectConversation(input: { targetUserId: ${target} }) { ${CONVERSATION_FIELDS} }
    }`,
  )
  const people = await participantMap([data.createDirectConversation], viewerId)
  return conversationFromGraphQl(data.createDirectConversation, people, viewerId)
}

export async function markRead(conversationId: string, sequence: string): Promise<void> {
  const sequenceLiteral = sequence === '0' ? '0' : graphQlLongLiteral(sequence)
  await gatewayGraphQl<{ markConversationRead: { conversationId: string } }>(
    `mutation MarkConversationRead($conversationId: UUID!) {
      markConversationRead(input: { conversationId: $conversationId, sequence: ${sequenceLiteral} }) { conversationId }
    }`,
    { conversationId },
  )
}

export function subscribeInbox(onEvent: (event: RealtimeEvent) => void, onError?: (error: Error) => void): () => void {
  return subscribeGatewayGraphQl<{ inboxEvents: RealtimeEvent }>({
    query: `subscription InboxEvents { inboxEvents { eventId kind conversationId messageId userId sequence } }`,
    onData: (data) => onEvent(data.inboxEvents),
    onError,
  })
}

export function subscribeConversation(conversationId: string, onEvent: (event: RealtimeEvent) => void, onError?: (error: Error) => void): () => void {
  return subscribeGatewayGraphQl<{ conversationEvents: RealtimeEvent }>({
    query: `subscription ConversationEvents($id: UUID!) { conversationEvents(conversationId: $id) { eventId kind conversationId messageId userId sequence } }`,
    variables: { id: conversationId },
    onData: (data) => onEvent(data.conversationEvents),
    onError,
  })
}

export const messengerApi = {
  conversations,
  messages,
  sendMessage,
  createDirectConversation,
  markRead,
  subscribeInbox,
  subscribeConversation,
}

import { gatewayGraphQl, graphQlLongLiteral } from './client'
import { subscribeGatewayGraphQl } from './realtime'
import { socialApi } from './social'
import type { MediaType, MediaUpload, MessengerConversationDto, MessengerMessageDto, UserSummary } from './types'

export interface SendMessageBody {
  body: string
  attachments?: MediaUpload[]
  replyToMessageId?: string | null
}

interface ParticipantGraphQl {
  userId: string
  role: 'ADMIN' | 'MEMBER'
  leftAt: string | null
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
  replyToMessageId: string | null
  createdAt: string
  deleted: boolean
  reactions: Array<{
    userId: string
    emoji: string
    updatedAt: string
  }>
  attachments: Array<{
    ordinal: number
    url: string
    assetId?: string | null
    mediaType?: string | null
    contentType?: string | null
    originalName?: string | null
    sizeBytes?: number | string | null
    width?: number | null
    height?: number | null
    durationMs?: number | string | null
    thumbnailUrl?: string | null
  }>
  sender?: FederatedUserGraphQl | null
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

interface ConversationMessagePageGraphQl {
  items: MessageGraphQl[]
  pageInfo: { startCursor: string | null; hasPreviousPage: boolean }
}

export interface MessengerRealtimeEvent {
  eventId: string
  kind: string
  conversationId: string | null
  messageId: string | null
  userId: string | null
  sequence: string | null
  occurredAt: string
  expiresAt: string | null
}

export interface MessengerPresenceDto {
  userId: string
  isOnline: boolean
  expiresAt: string | null
  updatedAt: string
}

export interface MessengerConversationImage extends MediaUpload {
  galleryKey: string
  messageId: string
  ordinal: number
  createdAt: string
}

const MESSAGE_CORE_FIELDS = `
  id conversationId senderUserId sequence text replyToMessageId createdAt deleted
  reactions { userId emoji updatedAt }
  attachments { ordinal url assetId mediaType contentType originalName sizeBytes width height durationMs thumbnailUrl }
`

const MESSAGE_FIELDS = `
  ${MESSAGE_CORE_FIELDS}
  sender { id name avatar isVerified }
`

const CONVERSATION_FIELDS = `
  id type title avatarUrl updatedAt currentSequence
  participants { userId role leftAt lastDeliveredSequence lastReadSequence user { id name avatar isVerified } }
  lastMessage { ${MESSAGE_FIELDS} }
`

function inferMediaType(url: string, contentType?: string | null): MediaType {
  const mime = contentType?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf' || mime.startsWith('application/')) return 'file'
  const path = url.split(/[?#]/, 1)[0].toLowerCase()
  if (/\.(?:png|jpe?g|gif|webp|avif|bmp|svg)$/.test(path)) return 'image'
  if (/\.(?:mp4|mov|m4v|mkv|ogv)$/.test(path)) return 'video'
  if (/\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/.test(path)) return 'audio'
  return 'file'
}

function attachmentFromGraphQl(attachment: MessageGraphQl['attachments'][number]): MediaUpload {
  const { url, ordinal } = attachment
  const cleanName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || `attachment-${ordinal + 1}`)
  const declared = attachment.mediaType?.toLowerCase() as MediaType | undefined
  const mediaType = declared && ['image', 'video', 'audio', 'file'].includes(declared)
    ? declared
    : inferMediaType(url, attachment.contentType)
  const isAudio = (() => {
    try {
      return new URL(url, 'http://localhost').searchParams.get('kind') === 'audio'
    } catch {
      return false
    }
  })()
  const sizeBytes = attachment.sizeBytes === null || attachment.sizeBytes === undefined
    ? undefined
    : Number(attachment.sizeBytes)
  const durationMs = attachment.durationMs === null || attachment.durationMs === undefined
    ? undefined
    : Number(attachment.durationMs)
  return {
    url,
    type: isAudio ? 'audio' : mediaType,
    mediaType: isAudio ? 'audio' : mediaType,
    contentType: attachment.contentType || (isAudio ? 'audio/webm' : 'application/octet-stream'),
    size: Number.isFinite(sizeBytes) ? sizeBytes! : 0,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
    name: attachment.originalName || cleanName,
    originalName: attachment.originalName || undefined,
    assetId: attachment.assetId || undefined,
    width: attachment.width ?? undefined,
    height: attachment.height ?? undefined,
    durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
    thumbnailUrl: attachment.thumbnailUrl || undefined,
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
    sequence: String(message.sequence),
    sender: federatedSender ?? people.get(senderId) ?? {
      id: senderId,
      username: senderId,
      displayName: senderId === viewerId ? 'You' : 'Fakebook user',
      avatarUrl: null,
    },
    body: message.deleted ? '' : message.text ?? '',
    replyToMessageId: message.replyToMessageId ?? null,
    reactions: message.reactions ?? [],
    deleted: message.deleted,
    createdAt: message.createdAt,
    status,
    attachments: message.deleted ? [] : message.attachments.map(attachmentFromGraphQl),
  }
}

function conversationFromGraphQl(conversation: ConversationGraphQl, people: Map<string, UserSummary>, viewerId: string): MessengerConversationDto {
  const me = conversation.participants.find((participant) => String(participant.userId) === viewerId)
  const currentSequence = Number(conversation.currentSequence)
  const lastRead = Number(me?.lastReadSequence ?? 0)
  return {
    id: String(conversation.id),
    type: conversation.type,
    participants: conversation.participants.flatMap((participant) => {
      const user = people.get(String(participant.userId))
      return user ? [{ ...user, role: participant.role, leftAt: participant.leftAt }] : []
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

export async function directConversations(viewerId: string, first = 40, after: string | null = null): Promise<MessengerConversationDto[]> {
  const data = await gatewayGraphQl<{ myDirectConversations: { items: ConversationGraphQl[] } }>(
    `query MyDirectConversations($first: Int!, $after: String) {
      myDirectConversations(first: $first, after: $after) { items { ${CONVERSATION_FIELDS} } }
    }`,
    { first, after },
  )
  const people = await participantMap(data.myDirectConversations.items, viewerId)
  return data.myDirectConversations.items.map((conversation) => conversationFromGraphQl(conversation, people, viewerId))
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
  const otherParticipants = conversationData.conversation.participants
    .filter((participant) => String(participant.userId) !== viewerId && !participant.leftAt)
  const maxLong = (values: string[]) => values.reduce((highest, value) => {
    try {
      const current = BigInt(value)
      return current > highest ? current : highest
    } catch {
      return highest
    }
  }, 0n)
  const otherRead = maxLong(otherParticipants.map((participant) => participant.lastReadSequence))
  const otherDelivered = maxLong(otherParticipants.map((participant) => participant.lastDeliveredSequence))
  return messageData.conversationMessages.items.map((message) => messageFromGraphQl(
    message,
    people,
    viewerId,
    String(message.senderUserId) !== viewerId
      ? 'sent'
      : BigInt(message.sequence) <= otherRead
        ? 'read'
        : BigInt(message.sequence) <= otherDelivered
          ? 'delivered'
          : 'sent',
  ))
}

export async function conversationImages(conversationId: string): Promise<MessengerConversationImage[]> {
  const pages: MessengerConversationImage[][] = []
  const visitedCursors = new Set<string>()
  let before: string | null = null

  while (true) {
    const data: { conversationMessages: ConversationMessagePageGraphQl } = await gatewayGraphQl<{
      conversationMessages: ConversationMessagePageGraphQl
    }>(
      `query ConversationImages($id: UUID!, $last: Int!, $before: String) {
        conversationMessages(conversationId: $id, last: $last, before: $before) {
          items {
            id conversationId senderUserId sequence text createdAt deleted
            replyToMessageId reactions { userId emoji updatedAt }
            attachments { ordinal url assetId mediaType contentType originalName sizeBytes width height durationMs thumbnailUrl }
          }
          pageInfo { startCursor hasPreviousPage }
        }
      }`,
      { id: conversationId, last: 100, before },
    )

    const page: ConversationMessagePageGraphQl = data.conversationMessages
    pages.unshift(page.items.flatMap((message) => {
      if (message.deleted) return []
      return [...message.attachments]
        .sort((left, right) => left.ordinal - right.ordinal)
        .flatMap((attachment) => {
          const media = attachmentFromGraphQl(attachment)
          if (media.type !== 'image') return []
          return [{
            ...media,
            galleryKey: `${message.id}:${attachment.ordinal}`,
            messageId: String(message.id),
            ordinal: attachment.ordinal,
            createdAt: message.createdAt,
          }]
        })
    }))

    if (!page.pageInfo.hasPreviousPage) break
    const startCursor: string | null = page.pageInfo.startCursor
    if (!startCursor || visitedCursors.has(startCursor)) break
    visitedCursors.add(startCursor)
    before = startCursor
  }

  const seen = new Set<string>()
  return pages.flat().filter((image) => {
    if (seen.has(image.galleryKey)) return false
    seen.add(image.galleryKey)
    return true
  })
}

export async function message(messageId: string, viewerId: string): Promise<MessengerMessageDto> {
  const data = await gatewayGraphQl<{ message: MessageGraphQl }>(
    `query Message($id: UUID!) { message(id: $id) { ${MESSAGE_FIELDS} } }`,
    { id: messageId },
  )
  return messageFromGraphQl(data.message, new Map(), viewerId)
}

export async function sendMessage(conversationId: string, viewer: UserSummary, body: SendMessageBody): Promise<MessengerMessageDto> {
  const clientMessageId = crypto.randomUUID()
  const data = await gatewayGraphQl<{ sendMessage: MessageGraphQl }>(
    `mutation SendMessage($input: SendMessageInput!) { sendMessage(input: $input) { ${MESSAGE_CORE_FIELDS} } }`,
    {
      input: {
        conversationId,
        clientMessageId,
        text: body.body || null,
        replyToMessageId: body.replyToMessageId ?? null,
        attachmentUrls: body.attachments?.map((attachment) => attachment.url) ?? [],
        attachments: body.attachments?.map((attachment) => ({
          url: attachment.url,
          assetId: attachment.assetId ?? null,
          mediaType: attachment.mediaType ?? attachment.type,
          contentType: attachment.contentType || null,
          originalName: attachment.originalName ?? attachment.name ?? null,
          sizeBytes: attachment.sizeBytes ?? attachment.size ?? null,
          width: attachment.width ?? null,
          height: attachment.height ?? null,
          durationMs: attachment.durationMs ?? null,
          thumbnailUrl: attachment.thumbnailUrl ?? null,
        })) ?? [],
      },
    },
  )
  return messageFromGraphQl(data.sendMessage, new Map([[viewer.id, viewer]]), viewer.id)
}

export async function deleteMessage(messageId: string, viewerId: string): Promise<MessengerMessageDto> {
  const data = await gatewayGraphQl<{ deleteMessage: MessageGraphQl }>(
    `mutation DeleteMessage($input: DeleteMessageInput!) {
      deleteMessage(input: $input) { ${MESSAGE_FIELDS} }
    }`,
    { input: { messageId } },
  )
  return messageFromGraphQl(data.deleteMessage, new Map(), viewerId)
}

export async function setMessageReaction(messageId: string, emoji: string | null, viewerId: string): Promise<MessengerMessageDto> {
  const data = await gatewayGraphQl<{ setMessageReaction: MessageGraphQl }>(
    `mutation SetMessageReaction($input: SetMessageReactionInput!) {
      setMessageReaction(input: $input) { ${MESSAGE_FIELDS} }
    }`,
    { input: { messageId, emoji } },
  )
  return messageFromGraphQl(data.setMessageReaction, new Map(), viewerId)
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

export async function createGroupConversation(
  title: string,
  memberUserIds: string[],
  viewerId: string,
  avatarUrl: string | null = null,
): Promise<MessengerConversationDto> {
  if (memberUserIds.length < 2) throw new Error('A group conversation requires at least two friends.')
  const titleValue = title.trim()
  if (!titleValue) throw new Error('A group conversation requires a title.')
  const members = [...new Set(memberUserIds)].map(graphQlLongLiteral).join(', ')
  const data = await gatewayGraphQl<{ createGroupConversation: ConversationGraphQl }>(
    `mutation CreateGroupConversation($title: String!, $avatarUrl: String) {
      createGroupConversation(input: { title: $title, memberUserIds: [${members}], avatarUrl: $avatarUrl }) { ${CONVERSATION_FIELDS} }
    }`,
    { title: titleValue, avatarUrl },
  )
  const people = await participantMap([data.createGroupConversation], viewerId)
  return conversationFromGraphQl(data.createGroupConversation, people, viewerId)
}

export async function updateGroupConversation(
  conversationId: string,
  viewerId: string,
  input: { title?: string | null; avatarUrl?: string | null },
): Promise<MessengerConversationDto> {
  const data = await gatewayGraphQl<{ updateGroupConversation: ConversationGraphQl }>(
    `mutation UpdateGroupConversation($conversationId: UUID!, $title: String, $avatarUrl: String) {
      updateGroupConversation(input: { conversationId: $conversationId, title: $title, avatarUrl: $avatarUrl }) { ${CONVERSATION_FIELDS} }
    }`,
    { conversationId, title: input.title, avatarUrl: input.avatarUrl },
  )
  const people = await participantMap([data.updateGroupConversation], viewerId)
  return conversationFromGraphQl(data.updateGroupConversation, people, viewerId)
}

export async function addConversationMembers(
  conversationId: string,
  memberUserIds: string[],
  viewerId: string,
): Promise<MessengerConversationDto> {
  const ids = [...new Set(memberUserIds)].map(graphQlLongLiteral).join(', ')
  if (!ids) throw new Error('At least one member is required.')
  const data = await gatewayGraphQl<{ addConversationMembers: ConversationGraphQl }>(
    `mutation AddConversationMembers($conversationId: UUID!) {
      addConversationMembers(input: { conversationId: $conversationId, userIds: [${ids}] }) { ${CONVERSATION_FIELDS} }
    }`,
    { conversationId },
  )
  const people = await participantMap([data.addConversationMembers], viewerId)
  return conversationFromGraphQl(data.addConversationMembers, people, viewerId)
}

export async function removeConversationMember(
  conversationId: string,
  targetUserId: string,
  viewerId: string,
): Promise<MessengerConversationDto> {
  const target = graphQlLongLiteral(targetUserId)
  const data = await gatewayGraphQl<{ removeConversationMember: ConversationGraphQl }>(
    `mutation RemoveConversationMember($conversationId: UUID!) {
      removeConversationMember(input: { conversationId: $conversationId, userId: ${target} }) { ${CONVERSATION_FIELDS} }
    }`,
    { conversationId },
  )
  const people = await participantMap([data.removeConversationMember], viewerId)
  return conversationFromGraphQl(data.removeConversationMember, people, viewerId)
}

export async function leaveConversation(conversationId: string, viewerId: string): Promise<MessengerConversationDto> {
  const data = await gatewayGraphQl<{ leaveConversation: ConversationGraphQl }>(
    `mutation LeaveConversation($conversationId: UUID!) {
      leaveConversation(conversationId: $conversationId) { ${CONVERSATION_FIELDS} }
    }`,
    { conversationId },
  )
  const people = await participantMap([data.leaveConversation], viewerId)
  return conversationFromGraphQl(data.leaveConversation, people, viewerId)
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

export async function presence(userIds: string[]): Promise<MessengerPresenceDto[]> {
  const ids = [...new Set(userIds)].filter((id) => id.length > 0).slice(0, 100)
  if (ids.length === 0) return []
  const literals = ids.map(graphQlLongLiteral).join(', ')
  const data = await gatewayGraphQl<{ userPresence: Array<{
    userId: string
    isOnline: boolean
    expiresAt: string | null
    updatedAt: string
  }> }>(
    `query UserPresence { userPresence(userIds: [${literals}]) { userId isOnline expiresAt updatedAt } }`,
  )
  return data.userPresence.map((item) => ({ ...item, userId: String(item.userId) }))
}

export async function heartbeatPresence(): Promise<MessengerPresenceDto> {
  const data = await gatewayGraphQl<{ heartbeatPresence: {
    userId: string
    isOnline: boolean
    expiresAt: string | null
    updatedAt: string
  } }>(
    `mutation HeartbeatPresence { heartbeatPresence { userId isOnline expiresAt updatedAt } }`,
  )
  return { ...data.heartbeatPresence, userId: String(data.heartbeatPresence.userId) }
}

export async function setTyping(conversationId: string, isTyping: boolean): Promise<void> {
  await gatewayGraphQl<{ setTyping: { conversationId: string } }>(
    `mutation SetTyping($conversationId: UUID!, $isTyping: Boolean!) {
      setTyping(input: { conversationId: $conversationId, isTyping: $isTyping }) { conversationId }
    }`,
    { conversationId, isTyping },
  )
}

const REALTIME_EVENT_FIELDS = 'eventId kind conversationId messageId userId sequence occurredAt expiresAt'

export function subscribeInbox(onEvent: (event: MessengerRealtimeEvent) => void, onError?: (error: Error) => void): () => void {
  return subscribeGatewayGraphQl<{ inboxEvents: MessengerRealtimeEvent }>({
    query: `subscription InboxEvents { inboxEvents { ${REALTIME_EVENT_FIELDS} } }`,
    onData: (data) => onEvent(data.inboxEvents),
    onError,
  })
}

export function subscribeConversation(conversationId: string, onEvent: (event: MessengerRealtimeEvent) => void, onError?: (error: Error) => void): () => void {
  return subscribeGatewayGraphQl<{ conversationEvents: MessengerRealtimeEvent }>({
    query: `subscription ConversationEvents($id: UUID!) { conversationEvents(conversationId: $id) { ${REALTIME_EVENT_FIELDS} } }`,
    variables: { id: conversationId },
    onData: (data) => onEvent(data.conversationEvents),
    onError,
  })
}

export function subscribePresence(userIds: string[], onEvent: (event: MessengerRealtimeEvent) => void, onError?: (error: Error) => void): () => void {
  const ids = [...new Set(userIds)].filter((id) => id.length > 0).slice(0, 100)
  if (ids.length === 0) return () => undefined
  const literals = ids.map(graphQlLongLiteral).join(', ')
  return subscribeGatewayGraphQl<{ presenceEvents: MessengerRealtimeEvent }>({
    query: `subscription PresenceEvents { presenceEvents(userIds: [${literals}]) { ${REALTIME_EVENT_FIELDS} } }`,
    onData: (data) => onEvent(data.presenceEvents),
    onError,
  })
}

export const messengerApi = {
  conversations,
  directConversations,
  messages,
  conversationImages,
  message,
  sendMessage,
  deleteMessage,
  setMessageReaction,
  createDirectConversation,
  createGroupConversation,
  updateGroupConversation,
  addConversationMembers,
  removeConversationMember,
  leaveConversation,
  markRead,
  presence,
  heartbeatPresence,
  setTyping,
  subscribeInbox,
  subscribeConversation,
  subscribePresence,
}

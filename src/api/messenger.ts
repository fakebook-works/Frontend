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
  user?: FederatedUserGraphQl | null
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
  kind?: 'USER' | 'SYSTEM'
  systemEvent?: MessengerMessageDto['systemEvent']
  systemSubjectUserId?: string | null
  text: string | null
  replyToMessageId: string | null
  createdAt: string
  editedAt?: string | null
  editHistory?: Array<{
    text: string
    versionAt: string
  }>
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
  systemSubject?: FederatedUserGraphQl | null
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
  viewerHasBlockedDirectUser?: boolean
  directUserHasBlockedViewer?: boolean
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
  updatedAt: string | null
}

export interface MessengerConversationMedia extends MediaUpload {
  galleryKey: string
  messageId: string
  ordinal: number
  createdAt: string
}

/** @deprecated Use MessengerConversationMedia; the viewer now includes video. */
export type MessengerConversationImage = MessengerConversationMedia

const MESSAGE_CORE_FIELDS = `
  id conversationId senderUserId sequence kind systemEvent systemSubjectUserId text replyToMessageId createdAt editedAt deleted
  editHistory { text versionAt }
  reactions { userId emoji updatedAt }
  attachments { ordinal url assetId mediaType contentType originalName sizeBytes width height durationMs thumbnailUrl }
`

// Do not hydrate the federated User entity inside Messenger operations. SocialGraph
// intentionally resolves a blocked user reference to null; Fusion currently reports
// errors for the non-null User fields below that nullable reference, which causes the
// shared GraphQL client to reject the whole inbox response. IDs remain authoritative,
// and participantMap performs one bounded, viewer-filtered profile hydration pass.
const MESSAGE_FIELDS = MESSAGE_CORE_FIELDS

const PROFILE_HYDRATION_BATCH_SIZE = 50
const MAX_PROFILE_HYDRATION_IDS = 250

const CONVERSATION_FIELDS = `
  id type title avatarUrl updatedAt currentSequence
  viewerHasBlockedDirectUser directUserHasBlockedViewer
  participants { userId role leftAt lastDeliveredSequence lastReadSequence }
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

async function participantMap(
  conversations: ConversationGraphQl[],
  viewerId: string,
  additionalMessages: MessageGraphQl[] = [],
): Promise<Map<string, UserSummary>> {
  const messages = [
    ...conversations.flatMap((conversation) => conversation.lastMessage ? [conversation.lastMessage] : []),
    ...additionalMessages,
  ]
  const ids = [...new Set([
    ...conversations.flatMap((conversation) => conversation.participants.map((participant) => String(participant.userId))),
    ...messages.flatMap((message) => [
      String(message.senderUserId),
      ...(message.systemSubjectUserId ? [String(message.systemSubjectUserId)] : []),
    ]),
  ])]
  const people = new Map<string, UserSummary>()
  for (const participant of conversations.flatMap((conversation) => conversation.participants)) {
    if (!participant.user) continue
    const id = String(participant.user.id)
    people.set(id, { id, username: participant.user.name, displayName: participant.user.name, avatarUrl: participant.user.avatar || null, isVerified: participant.user.isVerified })
  }
  for (const message of messages) {
    for (const user of [message.sender, message.systemSubject]) {
      if (!user) continue
      const id = String(user.id)
      people.set(id, { id, username: user.name, displayName: user.name, avatarUrl: user.avatar || null, isVerified: user.isVerified })
    }
  }
  const missingIds = ids.filter((id) => !people.has(id))
  const profileBatches = Array.from(
    { length: Math.ceil(Math.min(missingIds.length, MAX_PROFILE_HYDRATION_IDS) / PROFILE_HYDRATION_BATCH_SIZE) },
    (_, index) => missingIds.slice(index * PROFILE_HYDRATION_BATCH_SIZE, (index + 1) * PROFILE_HYDRATION_BATCH_SIZE),
  )
  const profiles = (await Promise.all(profileBatches.map((batch) => socialApi.getProfiles(batch).catch(() => [])))).flat()
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

function messageFromGraphQl(
  message: MessageGraphQl,
  people: Map<string, UserSummary>,
  viewerId: string,
  status: MessengerMessageDto['status'] = 'sent',
  readBy?: UserSummary[],
): MessengerMessageDto {
  const senderId = String(message.senderUserId)
  const federatedSender = message.sender ? {
    id: String(message.sender.id),
    username: message.sender.name,
    displayName: message.sender.name,
    avatarUrl: message.sender.avatar || null,
    isVerified: message.sender.isVerified,
  } : null
  const systemSubject = message.systemSubject ? {
    id: String(message.systemSubject.id),
    username: message.systemSubject.name,
    displayName: message.systemSubject.name,
    avatarUrl: message.systemSubject.avatar || null,
    isVerified: message.systemSubject.isVerified,
  } : message.systemSubjectUserId
    ? people.get(String(message.systemSubjectUserId)) ?? {
        id: String(message.systemSubjectUserId),
        username: String(message.systemSubjectUserId),
        displayName: 'Fakebook user',
        avatarUrl: null,
      }
    : null
  return {
    id: String(message.id),
    conversationId: String(message.conversationId),
    sequence: String(message.sequence),
    kind: message.kind ?? 'USER',
    systemEvent: message.systemEvent ?? null,
    systemSubject,
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
    editedAt: message.editedAt ?? null,
    editHistory: message.deleted ? [] : message.editHistory ?? [],
    createdAt: message.createdAt,
    status,
    ...(readBy ? { readBy } : {}),
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
    viewerHasBlockedDirectUser: Boolean(conversation.viewerHasBlockedDirectUser),
    directUserHasBlockedViewer: Boolean(conversation.directUserHasBlockedViewer),
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
  const people = await participantMap([conversationData.conversation], viewerId, messageData.conversationMessages.items)
  const otherParticipants = conversationData.conversation.participants
    .filter((participant) => String(participant.userId) !== viewerId && !participant.leftAt)
  const parseLong = (value: string) => {
    try {
      return BigInt(value)
    } catch {
      return 0n
    }
  }
  const participantReceipts = otherParticipants.map((participant, index) => ({
    participant,
    index,
    deliveredSequence: parseLong(participant.lastDeliveredSequence),
    readSequence: parseLong(participant.lastReadSequence),
  }))
  const otherRead = participantReceipts.reduce(
    (highest, receipt) => receipt.readSequence > highest ? receipt.readSequence : highest,
    0n,
  )
  const otherDelivered = participantReceipts.reduce(
    (highest, receipt) => receipt.deliveredSequence > highest ? receipt.deliveredSequence : highest,
    0n,
  )
  return messageData.conversationMessages.items.map((message) => {
    const ownMessage = String(message.senderUserId) === viewerId
    const sequence = parseLong(message.sequence)
    const readBy = ownMessage
      ? participantReceipts
          .filter((receipt) => sequence > 0n && receipt.readSequence >= sequence)
          .sort((left, right) => left.readSequence === right.readSequence
            ? left.index - right.index
            : left.readSequence > right.readSequence ? -1 : 1)
          .flatMap(({ participant }) => {
            const person = people.get(String(participant.userId))
            return person ? [person] : []
          })
      : undefined

    return messageFromGraphQl(
      message,
      people,
      viewerId,
      !ownMessage
        ? 'sent'
        : sequence <= otherRead
          ? 'read'
          : sequence <= otherDelivered
            ? 'delivered'
            : 'sent',
      readBy,
    )
  })
}

export async function conversationMedia(conversationId: string): Promise<MessengerConversationMedia[]> {
  const pages: MessengerConversationMedia[][] = []
  const visitedCursors = new Set<string>()
  let before: string | null = null

  while (true) {
    const data: { conversationMessages: ConversationMessagePageGraphQl } = await gatewayGraphQl<{
      conversationMessages: ConversationMessagePageGraphQl
    }>(
      `query ConversationMedia($id: UUID!, $last: Int!, $before: String) {
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
          if (media.type !== 'image' && media.type !== 'video') return []
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
  return pages.flat().filter((item) => {
    if (seen.has(item.galleryKey)) return false
    seen.add(item.galleryKey)
    return true
  })
}

/** Backwards-compatible alias; it now returns both image and video media. */
export const conversationImages = conversationMedia

export async function message(messageId: string, viewerId: string): Promise<MessengerMessageDto> {
  const data = await gatewayGraphQl<{ message: MessageGraphQl }>(
    `query Message($id: UUID!) { message(id: $id) { ${MESSAGE_FIELDS} } }`,
    { id: messageId },
  )
  const people = await participantMap([], viewerId, [data.message])
  return messageFromGraphQl(data.message, people, viewerId)
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
  const people = await participantMap([], viewerId, [data.deleteMessage])
  return messageFromGraphQl(data.deleteMessage, people, viewerId)
}

export async function editMessage(messageId: string, text: string, viewerId: string): Promise<MessengerMessageDto> {
  const data = await gatewayGraphQl<{ editMessage: MessageGraphQl }>(
    `mutation EditMessage($input: EditMessageInput!) {
      editMessage(input: $input) { ${MESSAGE_FIELDS} }
    }`,
    { input: { messageId, text } },
  )
  const people = await participantMap([], viewerId, [data.editMessage])
  return messageFromGraphQl(data.editMessage, people, viewerId)
}

export async function setMessageReaction(messageId: string, emoji: string | null, viewerId: string): Promise<MessengerMessageDto> {
  const data = await gatewayGraphQl<{ setMessageReaction: MessageGraphQl }>(
    `mutation SetMessageReaction($input: SetMessageReactionInput!) {
      setMessageReaction(input: $input) { ${MESSAGE_FIELDS} }
    }`,
    { input: { messageId, emoji } },
  )
  const people = await participantMap([], viewerId, [data.setMessageReaction])
  return messageFromGraphQl(data.setMessageReaction, people, viewerId)
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
  const hasTitle = Object.prototype.hasOwnProperty.call(input, 'title')
  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(input, 'avatarUrl')
  if (!hasTitle && !hasAvatarUrl) throw new Error('At least one group field is required.')
  const definitions = ['$conversationId: UUID!']
  const assignments = ['conversationId: $conversationId']
  const variables: Record<string, string | null> = { conversationId }
  if (hasTitle) {
    definitions.push('$title: String')
    assignments.push('title: $title')
    variables.title = input.title ?? null
  }
  if (hasAvatarUrl) {
    definitions.push('$avatarUrl: String')
    assignments.push('avatarUrl: $avatarUrl')
    variables.avatarUrl = input.avatarUrl ?? null
  }
  const data = await gatewayGraphQl<{ updateGroupConversation: ConversationGraphQl }>(
    `mutation UpdateGroupConversation(${definitions.join(', ')}) {
      updateGroupConversation(input: { ${assignments.join(', ')} }) { ${CONVERSATION_FIELDS} }
    }`,
    variables,
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

export async function setConversationMemberRole(
  conversationId: string,
  targetUserId: string,
  role: 'ADMIN' | 'MEMBER',
  viewerId: string,
): Promise<MessengerConversationDto> {
  const target = graphQlLongLiteral(targetUserId)
  const data = await gatewayGraphQl<{ setConversationMemberRole: ConversationGraphQl }>(
    `mutation SetConversationMemberRole($conversationId: UUID!) {
      setConversationMemberRole(input: { conversationId: $conversationId, userId: ${target}, role: ${role} }) { ${CONVERSATION_FIELDS} }
    }`,
    { conversationId },
  )
  const people = await participantMap([data.setConversationMemberRole], viewerId)
  return conversationFromGraphQl(data.setConversationMemberRole, people, viewerId)
}

export async function deleteGroupConversation(conversationId: string): Promise<boolean> {
  const data = await gatewayGraphQl<{ deleteGroupConversation: boolean }>(
    `mutation DeleteGroupConversation($conversationId: UUID!) {
      deleteGroupConversation(conversationId: $conversationId)
    }`,
    { conversationId },
  )
  return data.deleteGroupConversation
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

export async function markDelivered(conversationId: string, sequence: string): Promise<void> {
  const sequenceLiteral = graphQlLongLiteral(sequence)
  await gatewayGraphQl(
    `mutation MarkConversationDelivered($conversationId: UUID!) {
      markConversationDelivered(input: { conversationId: $conversationId, sequence: ${sequenceLiteral} }) {
        conversationId lastDeliveredSequence
      }
    }`,
    { conversationId },
  )
}

export async function presence(userIds: string[]): Promise<MessengerPresenceDto[]> {
  const ids = [...new Set(userIds)].filter((id) => id.length > 0).slice(0, 250)
  if (ids.length === 0) return []
  const literals = ids.map(graphQlLongLiteral).join(', ')
  const data = await gatewayGraphQl<{ userPresence: Array<{
    userId: string
    isOnline: boolean
    expiresAt: string | null
    updatedAt: string | null
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

/**
 * Watches several conversations over a single stream.
 *
 * Every server-sent events stream holds a connection open for as long as the chat is on
 * screen, and browsers cap concurrent connections per origin. Subscribing per conversation
 * meant a few open windows, plus inbox, presence and notifications, exhausted that budget
 * and left every other request queued. The event carries `conversationId`, so one stream
 * can serve them all.
 */
export function subscribeConversations(conversationIds: string[], onEvent: (event: MessengerRealtimeEvent) => void, onError?: (error: Error) => void): () => void {
  const ids = [...new Set(conversationIds)].filter((id) => id.length > 0)
  // Nothing open: do not hold a connection for an empty subscription.
  if (ids.length === 0) return () => undefined
  return subscribeGatewayGraphQl<{ conversationEvents: MessengerRealtimeEvent }>({
    // Passed as a variable rather than inlined: these are UUID strings, so unlike the Long
    // ids in subscribePresence there is no precision problem to work around.
    query: `subscription ConversationEvents($ids: [UUID!]!) { conversationEvents(conversationIds: $ids) { ${REALTIME_EVENT_FIELDS} } }`,
    variables: { ids },
    onData: (data) => onEvent(data.conversationEvents),
    onError,
  })
}

export function subscribePresence(userIds: string[], onEvent: (event: MessengerRealtimeEvent) => void, onError?: (error: Error) => void): () => void {
  const ids = [...new Set(userIds)].filter((id) => id.length > 0).slice(0, 250)
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
  conversationMedia,
  conversationImages,
  message,
  sendMessage,
  deleteMessage,
  editMessage,
  setMessageReaction,
  createDirectConversation,
  createGroupConversation,
  updateGroupConversation,
  addConversationMembers,
  removeConversationMember,
  setConversationMemberRole,
  leaveConversation,
  deleteGroupConversation,
  markRead,
  markDelivered,
  presence,
  heartbeatPresence,
  setTyping,
  subscribeInbox,
  subscribeConversations,
  subscribePresence,
}

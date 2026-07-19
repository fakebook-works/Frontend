// Shared frontend projections used by typed Gateway GraphQL adapters and the
// direct Upload Server response. Identity fields remain strings for Snowflakes.

export interface UserSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isVerified?: boolean
}

export interface UserProfile {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
  isVerified?: boolean
  bio: string | null
  birthDate: string | null
  gender: string | null
  location: string | null
  createdAt: string
  friendCount: number
  postCount: number
}

export type MediaType = 'image' | 'video' | 'audio' | 'file'

// Returned by the upload service after storing a file (Fakebook.UploadServer).
// Messenger messages use the same projection and may include the optional
// metadata snapshot returned by the messaging service.
export interface MediaUpload {
  url: string
  type: MediaType
  mediaType?: MediaType
  contentType: string
  size: number
  sizeBytes?: number
  name: string
  originalName?: string
  assetId?: string
  state?: 'pending' | 'committed'
  expiresAt?: string | null
  width?: number | null
  height?: number | null
  durationMs?: number | null
  thumbnailUrl?: string | null
}

export interface MessengerMessageDto {
  id: string
  conversationId: string
  sequence?: string
  sender: UserSummary
  body: string
  replyToMessageId?: string | null
  reactions?: MessengerMessageReactionDto[]
  deleted?: boolean
  createdAt: string
  status: 'sending' | 'sent' | 'delivered' | 'read'
  attachments: MediaUpload[]
}

export interface MessengerMessageReactionDto {
  userId: string
  emoji: string
  updatedAt: string
}

export interface MessengerParticipantDto extends UserSummary {
  role?: 'ADMIN' | 'MEMBER'
  leftAt?: string | null
}

export interface MessengerConversationDto {
  id: string
  type?: 'DIRECT' | 'GROUP'
  participants: MessengerParticipantDto[]
  title: string | null
  avatarUrl: string | null
  updatedAt: string
  unreadCount: number
  lastMessage: MessengerMessageDto | null
}

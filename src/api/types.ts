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

// Returned by the upload service after storing a file (Fakebook.UploadServer).
export interface MediaUpload {
  url: string
  type: 'image' | 'video'
  contentType: string
  size: number
  name: string
}

export interface MessengerMessageDto {
  id: string
  conversationId: string
  sender: UserSummary
  body: string
  createdAt: string
  status: 'sending' | 'sent' | 'delivered' | 'read'
  attachments: MediaUpload[]
}

export interface MessengerConversationDto {
  id: string
  participants: UserSummary[]
  title: string | null
  avatarUrl: string | null
  updatedAt: string
  unreadCount: number
  lastMessage: MessengerMessageDto | null
}

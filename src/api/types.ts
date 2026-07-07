// TypeScript mirrors of the server DTOs (Fakebook.Server/Dtos/Dtos.cs).
// ASP.NET Core uses System.Text.Json "Web" defaults: camelCase property names
// and enums serialized as integers. Keep these in sync with the backend.

export interface UserSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface UserProfile {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
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

export interface MediaUploadRequest {
  uploadId: string
  uploadUrl: string
  expiresAt: string
  maxSize: number
}

export interface AuthResponse {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  user: UserSummary
}

export interface PostDto {
  id: string
  author: UserSummary
  content: string
  imageUrl: string | null
  mediaType: 'image' | 'video' | null
  privacy: number
  createdAt: string
  updatedAt: string
  commentCount: number
  reactionCount: number
  shareCount: number
  myReaction: number | null
  originalPost: PostDto | null
}

export interface CommentDto {
  id: string
  postId: string
  parentCommentId: string | null
  author: UserSummary
  content: string
  createdAt: string
  updatedAt: string
  reactionCount: number
}

export interface FriendDto {
  friendshipId: string
  user: UserSummary
  since: string
}

export interface FriendRequestDto {
  friendshipId: string
  user: UserSummary
  createdAt: string
}

export interface ActivityDto {
  id: string
  type: number
  summary: string | null
  targetPostId: string | null
  targetCommentId: string | null
  targetUserId: string | null
  createdAt: string
}

export interface BidDto {
  id: string
  bidder: UserSummary
  amount: number
  createdAt: string
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

export interface ListingDto {
  id: string
  seller: UserSummary
  title: string
  imageUrl: string | null
  category: number
  location: string | null
  type: number
  price: number
  currentPrice: number
  bidCount: number
  auctionEndsAt: string | null
  status: number
  createdAt: string
}

export interface ListingDetailDto {
  id: string
  seller: UserSummary
  title: string
  description: string
  imageUrl: string | null
  category: number
  location: string | null
  type: number
  price: number
  currentPrice: number
  minNextBid: number
  bidCount: number
  auctionEndsAt: string | null
  status: number
  highestBidder: UserSummary | null
  buyer: UserSummary | null
  isMine: boolean
  createdAt: string
  bids: BidDto[]
}

// Enum value maps. TS `enum` is disallowed here by `erasableSyntaxOnly`,
// so these are const objects mirroring Fakebook.Server/Domain/Enums.cs.
export const Privacy = { Public: 0, FriendsOnly: 1, Private: 2 } as const
export const ReactionType = { Like: 0, Love: 1, Haha: 2, Wow: 3, Sad: 4, Angry: 5 } as const
export const ListingType = { FixedPrice: 0, Auction: 1 } as const
export const ListingStatus = { Active: 0, Sold: 1, Ended: 2, Cancelled: 3 } as const
export const ListingCategory = {
  Other: 0,
  Vehicles: 1,
  Electronics: 2,
  HomeGarden: 3,
  Clothing: 4,
  Toys: 5,
  SportingGoods: 6,
  Hobbies: 7,
  Property: 8,
} as const

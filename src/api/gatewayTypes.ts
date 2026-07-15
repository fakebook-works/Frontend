export interface GatewayMedia {
  id: string
  type: number
  url: string
}

export interface GatewayAuthor {
  id: string
  name: string
  avatar: string
  isVerified: boolean
  canFollow?: boolean
}

export interface FeedPost {
  __typename: 'FeedPostDetail'
  id: string
  type: number
  content: string
  privacy: number
  create: string
  author: GatewayAuthor
  media: GatewayMedia[]
}

export interface GroupPost extends Omit<FeedPost, '__typename'> {
  __typename: 'GroupPostDetail'
  group: {
    id: string
    name: string
    avatar: string
    canJoin: boolean
  }
}

export type GatewayPost = FeedPost | GroupPost

export interface RecommendationItem {
  postId: string
  post: GatewayPost | null
}

export interface CreatedContent {
  id: string
  type: number
  content: string
  privacy: number
  create: string
  authorId: string
  media: GatewayMedia[]
}

export interface NormalStory {
  __typename: 'NormalStory'
  id: string
  content: string
  create: string
  media: GatewayMedia[]
}

export interface SharedStorySource {
  id: string
  content: string
  media: GatewayMedia | null
  author: Omit<GatewayAuthor, 'canFollow'> | null
}

export interface FeedPostShareStory {
  __typename: 'FeedPostShareStory'
  id: string
  content: string
  create: string
  sharedSource: SharedStorySource
}

export interface ReelShareStory extends Omit<FeedPostShareStory, '__typename'> {
  __typename: 'ReelShareStory'
}

export type GatewayStory = NormalStory | FeedPostShareStory | ReelShareStory

export interface StoryBucket {
  author: Omit<GatewayAuthor, 'canFollow'>
  latestCreate: string
  stories: GatewayStory[]
}

export interface StoryPage {
  items: StoryBucket[]
  endCursor: string | null
  hasNextPage: boolean
}

export interface VisitedGroup {
  id: string
  avatar: string
  name: string
}

export interface VisitedGroupPage {
  items: VisitedGroup[]
  endCursor: string | null
  hasNextPage: boolean
}

export type PremiumPlan = 'MONTHLY' | 'YEARLY'

export type PaymentOrderStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PAID'
  | 'ACTIVATION_PENDING'
  | 'ACTIVATED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'

export interface PremiumPlanOffer {
  code: PremiumPlan
  amount: number
  durationMonths: number
}

export interface PremiumCheckout {
  orderCode: string
  status: PaymentOrderStatus
  checkoutUrl: string
}

export interface PremiumOrder {
  orderCode: string
  plan: PremiumPlan
  amount: number
  status: PaymentOrderStatus
  createdAt: string
  expiresAt: string
  paidAt: string | null
  targetValidDate: string | null
}

export interface GatewayMediaInput {
  type: number
  url: string
}

export interface CreateGatewayPostInput {
  authorId: string
  content: string
  privacy: number
  media?: GatewayMediaInput[]
}

export interface CreateGatewayStoryInput {
  authorId: string
  content: string
  media?: GatewayMediaInput | null
}

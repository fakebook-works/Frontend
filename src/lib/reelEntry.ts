import type { GatewayPost } from '../api/gatewayTypes'
import type { SocialContent } from '../api/social'

export type GatewayReelPost = Extract<GatewayPost, { __typename: 'ReelDetail' }>

/**
 * Reuses the already-authorized Reel projection shown by Home/Profile as the
 * first frame of the viewer. The recommendation/profile queue can then load in
 * the background instead of blocking the selected Reel behind another request.
 */
export function gatewayReelToSocialContent(post: GatewayReelPost): SocialContent {
  return {
    id: post.id,
    type: post.type,
    content: post.content,
    privacy: post.privacy,
    createdAt: post.create,
    authorId: post.author.id,
    author: {
      id: post.author.id,
      username: '',
      displayName: post.author.name,
      avatarUrl: post.author.avatar || null,
      isVerified: post.author.isVerified,
    },
    media: post.media,
    aspectRatio: post.aspectRatio,
    focalPointX: post.focalPointX,
    focalPointY: post.focalPointY,
    mentions: post.mentions,
  }
}

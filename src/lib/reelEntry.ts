import type { GatewayPost, SharedPostSource } from '../api/gatewayTypes'
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

/** Builds an immediate Reel viewer seed from the authorized shared-source projection. */
export function sharedPostSourceToGatewayReel(source: SharedPostSource): GatewayReelPost | null {
  if (!source.isAvailable || source.type !== 4 || !source.author) return null
  return {
    __typename: 'ReelDetail',
    id: source.id,
    type: 4,
    content: source.content ?? '',
    privacy: source.privacy ?? 0,
    create: source.create ?? '',
    author: { ...source.author },
    media: source.media,
    mentions: source.mentions ?? [],
    taggedUsers: [],
    sharedSource: null,
    aspectRatio: source.aspectRatio,
    focalPointX: source.focalPointX,
    focalPointY: source.focalPointY,
  }
}

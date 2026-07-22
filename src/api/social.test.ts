// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayGraphQl = vi.hoisted(() => vi.fn())
vi.mock('./client', () => ({
  gatewayGraphQl,
  graphQlLongLiteral: (value: string) => {
    if (!/^[1-9]\d*$/.test(value)) throw new Error('Invalid identifier')
    return value
  },
}))

import { socialApi } from './social'

describe('SocialGraph Gateway adapter', () => {
  beforeEach(() => gatewayGraphQl.mockReset())

  it('keeps Snowflake IDs as GraphQL literals and maps profiles to frontend types', async () => {
    gatewayGraphQl.mockResolvedValue({
      profile: {
        id: '9007199254740993123', avatar: '/a.png', background: '/b.png', name: 'Lan', bio: 'Hello',
        gender: 0, birthdate: '2000-01-01', location: 'Da Nang', privacy: 1, create: '2026-01-01',
        verify: '', isVerified: true, friendCount: 3, followerCount: 4, followingCount: 5,
      },
    })

    const profile = await socialApi.getProfile('9007199254740993123', 'lan@example.com')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profile(userId: 9007199254740993123)')
    expect(profile).toMatchObject({
      id: '9007199254740993123', displayName: 'Lan', email: 'lan@example.com',
      avatarUrl: '/a.png', backgroundUrl: '/b.png', followerCount: 4,
    })
  })

  it('batches profile hydration without converting IDs to JavaScript numbers', async () => {
    gatewayGraphQl.mockResolvedValue({ profiles: [] })
    await socialApi.getProfiles(['9007199254740993123', '9007199254740993124'])
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profiles(userIds: [9007199254740993123, 9007199254740993124])')
  })

  it('loads viewer-owned friend relations and their profiles in one request', async () => {
    gatewayGraphQl.mockResolvedValue({ friendRelationProfiles: [] })

    await socialApi.getRelationProfiles('1', 2)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('friendRelationProfiles(userId: 1')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ associationType: 2, limit: 60 })
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
  })

  it('loads friend suggestions with mutual-friend summaries', async () => {
    gatewayGraphQl.mockResolvedValue({ friendSuggestions: [{
      profile: {
        id: '3', avatar: '/candidate.png', background: '', name: 'Candidate', bio: '', gender: 0,
        birthdate: '', location: '', privacy: 0, create: '2026-01-01', verify: '', isVerified: false,
        friendCount: 2, followerCount: 4, followingCount: 1,
      },
      mutualFriendCount: 1,
      mutualFriends: [{ id: '2', name: 'Mutual Friend', avatar: '/mutual.png', isVerified: true }],
    }] })

    const suggestions = await socialApi.getFriendSuggestions('1', 24)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('friendSuggestions(userId: 1')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ limit: 24 })
    expect(suggestions[0]).toMatchObject({
      profile: { id: '3', displayName: 'Candidate' },
      mutualFriendCount: 1,
      mutualFriends: [{ id: '2', displayName: 'Mutual Friend' }],
    })
  })

  it('hydrates Recommendation reel IDs through the composed reel field', async () => {
    gatewayGraphQl.mockResolvedValueOnce({ recommendReels: [{ reelId: '8', reel: {
      id: '8', type: 4, content: 'Reel', privacy: 0, create: '2026-01-01', authorId: '1', media: [],
    } }] })
    gatewayGraphQl.mockResolvedValueOnce({ profiles: [] })

    const reels = await socialApi.getRecommendedReels('1', 'FOLLOWING')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('recommendReels')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('reel {')
    expect(reels[0]?.id).toBe('8')
  })

  it('uses trusted-viewer relationship state without sending a spoofable viewer argument', async () => {
    gatewayGraphQl.mockResolvedValue({ relationshipState: {
      isFriend: false,
      isFollowing: true,
      followsViewer: false,
      friendRequestSent: true,
      friendRequestReceived: false,
      isBlocked: false,
      isBlockedBy: false,
    } })

    const state = await socialApi.getProfileRelationshipState('1', '2')

    expect(state).toMatchObject({ friendship: 'outgoing', isFollowing: true })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('relationshipState(userId: 2)')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('viewerId')
  })

  it('reads persistent group membership and pending state from the secure viewer query', async () => {
    gatewayGraphQl.mockResolvedValue({ groupViewerState: {
      isMember: false,
      isAdmin: false,
      joinRequestPending: true,
      canViewPosts: false,
    } })

    const state = await socialApi.getGroupMembershipState('1', '20')

    expect(state).toEqual({ isMember: false, isAdmin: false, joinRequestPending: true, canViewPosts: false })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('groupViewerState(groupId: 20)')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('userId: 1')
  })

  it('loads engagement counts and the viewer reaction state for interactive content cards', async () => {
    gatewayGraphQl.mockResolvedValue({ contentEngagement: {
      targetId: '9007199254740993123',
      likeCount: 12,
      commentCount: 4,
      shareCount: 2,
      viewCount: 46,
      viewerHasLiked: true,
      viewerHasSaved: false,
      viewerHasWatched: true,
    } })

    const engagement = await socialApi.getContentEngagement('9007199254740993123')

    expect(engagement).toMatchObject({ likeCount: 12, viewCount: 46, viewerHasLiked: true, viewerHasWatched: true })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('contentEngagement(targetId: 9007199254740993123)')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('viewCount')
  })

  it('loads one comment image while keeping each query scoped to direct children', async () => {
    gatewayGraphQl.mockResolvedValue({ comments: {
      items: [{
        id: '9007199254740993401', content: 'Photo reply', create: '2026-07-20T01:00:00Z',
        author: { id: '3', name: 'Commenter', avatar: '', isVerified: true },
        likeCount: 1, replyCount: 2, viewerHasLiked: false, canFollowAuthor: true, isFollowingAuthor: false, mentions: [],
        media: { id: '9007199254740993499', type: 0, url: '/comment.jpg' },
      }],
      endCursor: 'next',
      hasNextPage: true,
    } })

    const page = await socialApi.getComments('9007199254740993400', 20)

    expect(page.items[0]).toMatchObject({
      id: '9007199254740993401',
      media: { id: '9007199254740993499', type: 0, url: '/comment.jpg' },
      replyCount: 2,
      canFollowAuthor: true,
      isFollowingAuthor: false,
    })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('comments(targetId: 9007199254740993400')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('media { id type url }')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('canFollowAuthor isFollowingAuthor')
  })

  it('loads visible user feed photos with content context and lossless IDs', async () => {
    gatewayGraphQl.mockResolvedValue({ userPhotos: {
      items: [{
        media: { id: '9007199254740993999', type: 0, url: '/photo.jpg' },
        contentId: '9007199254740993888', contentType: 0, create: '2026-01-01',
        authorId: '9007199254740993123', groupId: null,
      }],
      endCursor: 'next',
      hasNextPage: true,
    } })

    const page = await socialApi.getUserPhotos('9007199254740993123', 25)

    expect(page.items[0]).toMatchObject({
      media: { id: '9007199254740993999', type: 0, url: '/photo.jpg' },
      contentId: '9007199254740993888', authorId: '9007199254740993123', groupId: null,
    })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('userPhotos(userId: 9007199254740993123')
    expect(gatewayGraphQl.mock.calls[0][1]).toMatchObject({ limit: 25 })
  })

  it('uses the dedicated group-user feed instead of filtering a generic group page in the browser', async () => {
    gatewayGraphQl.mockResolvedValue({ groupUserPosts: {
      items: [{
        __typename: 'GroupPostDetail', id: '31', type: 1, content: 'Inside group', privacy: 0, create: '2026-01-01',
        author: { id: '12', name: 'Member', avatar: '', isVerified: false },
        group: { id: '20', name: 'Group', avatar: '', canJoin: false }, media: [],
      }],
      endCursor: null,
      hasNextPage: false,
    } })

    const page = await socialApi.getGroupUserPosts('20', '12')

    expect(page.items[0]?.author.id).toBe('12')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('groupUserPosts(groupId: 20, userId: 12')
  })

  it('updates post text, audience, and replacement media through the typed update contract', async () => {
    gatewayGraphQl.mockResolvedValue({ updatePost: {
      id: '31', type: 1, content: 'Updated', privacy: 1, create: '2026-01-01', authorId: '12',
      media: [{ id: '99', type: 0, url: '/updated.jpg' }],
    } })

    const updated = await socialApi.updatePost('31', {
      content: 'Updated',
      privacy: 1,
      media: [{ type: 0, url: '/updated.jpg' }],
    })

    expect(updated).toMatchObject({ id: '31', content: 'Updated', privacy: 1 })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('updatePost(input: { id: 31, privacy: $privacy, content: $content, media: $media })')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ content: 'Updated', privacy: 1, media: [{ type: 0, url: '/updated.jpg' }] })
  })

  it('loads trusted viewer reel collections without a spoofable user argument', async () => {
    gatewayGraphQl.mockResolvedValueOnce({ likedReels: {
      items: [{ id: '8', type: 4, content: 'Liked reel', privacy: 0, create: '2026-01-01', authorId: '1', media: [] }],
      endCursor: null,
      hasNextPage: false,
    } })
    gatewayGraphQl.mockResolvedValueOnce({ profiles: [] })

    const reels = await socialApi.getReelCollection('liked', 10)

    expect(reels[0]?.id).toBe('8')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('likedReels(limit: $limit, cursor: $cursor)')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('userId')
  })
})

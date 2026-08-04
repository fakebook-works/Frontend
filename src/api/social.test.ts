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

import { GROUP_MEMBERSHIP_CHANGED_EVENT, type GroupMembershipChangedDetail } from '../lib/groupMembershipEvents'
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

  it('loads another profile contact through the composed target-scoped query', async () => {
    gatewayGraphQl.mockResolvedValue({
      profile: {
        id: '2', avatar: '', background: '', name: 'Visitor Target', bio: '', gender: 0,
        birthdate: '', location: '', privacy: 0, create: '2026-01-01', verify: '', isVerified: false,
        friendCount: 1, followerCount: 0, followingCount: 0,
      },
      profileContact: { email: 'target@example.com' },
    })

    const profile = await socialApi.getProfile('2')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profileContact(userId: 2)')
    expect(profile?.email).toBe('target@example.com')
  })

  it('batches profile hydration without converting IDs to JavaScript numbers', async () => {
    gatewayGraphQl.mockResolvedValue({ profiles: [] })
    await socialApi.getProfiles(['9007199254740993123', '9007199254740993124'])
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profiles(userIds: [9007199254740993123, 9007199254740993124])')
  })

  it('loads profile feed, Reel and shared-source metadata needed by the profile cards', async () => {
    gatewayGraphQl.mockResolvedValue({
      profilePosts: {
        items: [{
          __typename: 'FeedPostDetail', id: '10', type: 1, content: 'shared', privacy: 0, create: '2026-07-29T10:00:00Z',
          author: { id: '2', name: 'Owner', avatar: '', isVerified: false, canFollow: false }, media: [], mentions: [], taggedUsers: [],
          sharedSource: {
            id: '11', isAvailable: true, type: 1, content: 'source', privacy: 2, create: '2026-07-28T10:00:00Z',
            author: { id: '3', name: 'Source owner', avatar: '', isVerified: false }, media: [], mentions: [],
          },
        }, {
          __typename: 'GroupPostDetail', id: '13', type: 3, content: 'group only', privacy: 1, create: '2026-07-28T10:00:00Z',
          author: { id: '2', name: 'Owner', avatar: '', isVerified: false, canFollow: false },
          group: { id: '20', name: 'Private group', avatar: '', canJoin: false }, media: [], mentions: [], taggedUsers: [],
        }, {
          __typename: 'ReelDetail', id: '12', type: 2, content: 'reel', privacy: 1, create: '2026-07-27T10:00:00Z',
          author: { id: '2', name: 'Owner', avatar: '', isVerified: false, canFollow: false }, media: [], mentions: [],
          aspectRatio: 0.5625, focalPointX: 0.5, focalPointY: 0.5,
        }],
        endCursor: null,
        hasNextPage: false,
      },
    })

    const page = await socialApi.getProfilePosts('2', 20)

    const query = gatewayGraphQl.mock.calls[0][0] as string
    expect(query).toContain('profilePosts(userId: 2')
    expect(query).toMatch(/sharedSource\s*\{[\s\S]*?privacy create/)
    expect(page.items.map((item) => item.__typename)).toEqual(['FeedPostDetail', 'ReelDetail'])
    expect(page.items[0].__typename === 'FeedPostDetail' ? page.items[0].sharedSource : null).toMatchObject({
      id: '11', privacy: 2, create: '2026-07-28T10:00:00Z',
    })
  })

  it('reads exact avatar provenance as lossless IDs through Gateway', async () => {
    gatewayGraphQl.mockResolvedValue({
      profileAvatarSource: {
        contentId: '9007199254740993223',
        mediaId: '9007199254740993224',
      },
    })

    const source = await socialApi.getProfileAvatarSource('9007199254740993123')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profileAvatarSource(userId: 9007199254740993123)')
    expect(source).toEqual({
      contentId: '9007199254740993223',
      mediaId: '9007199254740993224',
    })
  })

  it('sends an existing avatar source as validated Snowflake literals, not rounded variables', async () => {
    gatewayGraphQl.mockResolvedValue({ changeUserAvatar: null })

    await socialApi.changeUserAvatar(
      '9007199254740993123',
      '/media/cropped.jpg',
      null,
      0,
      { contentId: '9007199254740993223', mediaId: '9007199254740993224' },
    )

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('sourceContentId: 9007199254740993223')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('sourceMediaId: 9007199254740993224')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({
      avatarUrl: '/media/cropped.jpg',
      originalUrl: null,
      privacy: 0,
    })
  })

  it('loads viewer-owned friend relations and their profiles in one request', async () => {
    gatewayGraphQl.mockResolvedValue({ friendRelationProfiles: [] })

    await socialApi.getRelationProfiles('1', 2)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('friendRelationProfiles(userId: 1')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ associationType: 2, limit: 60 })
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
  })

  it('loads friend profiles with mutual counts in one request', async () => {
    gatewayGraphQl.mockResolvedValue({ friendProfilesWithMutualCounts: [{
      profile: {
        id: '2', avatar: '/friend.png', background: '', name: 'Friend', bio: '', gender: 0,
        birthdate: '', location: '', privacy: 0, create: '2026-01-01', verify: '', isVerified: false,
        friendCount: 4, followerCount: 0, followingCount: 0,
      },
      mutualFriendCount: 3,
    }] })

    const friends = await socialApi.getFriendProfilesWithMutualCounts('1', 9)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('friendProfilesWithMutualCounts(userId: 1')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ limit: 9 })
    expect(friends[0]).toMatchObject({ profile: { id: '2', displayName: 'Friend' }, mutualFriendCount: 3 })
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
  })

  it('loads the visible friends of another profile without supplying a viewer id', async () => {
    gatewayGraphQl.mockResolvedValue({ profileFriends: [{
      profile: {
        id: '3', avatar: '', background: '', name: 'Visible Friend', bio: '', gender: 0,
        birthdate: '', location: '', privacy: 0, create: '2026-01-01', verify: '', isVerified: false,
        friendCount: 2, followerCount: 0, followingCount: 0,
      },
      mutualFriendCount: 1,
    }] })

    const friends = await socialApi.getProfileFriends('2', 25)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profileFriends(targetUserId: 2')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('viewerId')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ limit: 25 })
    expect(friends[0]).toMatchObject({ profile: { id: '3' }, mutualFriendCount: 1 })
  })

  it('loads the selected profile connection list from SocialGraph', async () => {
    gatewayGraphQl.mockResolvedValue({ profileConnections: [] })

    await socialApi.getProfileConnections('1', 'followers', 40)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profileConnections(userId: 1')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('$query')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ associationType: 4, limit: 40 })
  })

  it('loads reel view counts in one composed GraphQL request', async () => {
    gatewayGraphQl.mockResolvedValue({
      e0: { targetId: '10', viewCount: 7 },
      e1: { targetId: '11', viewCount: 9 },
    })

    const counts = await socialApi.getContentViewCounts(['10', '11'])

    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('e0: contentEngagement(targetId: 10)')
    expect(counts).toEqual({ '10': 7, '11': 9 })
  })

  it('loads every reel view count in batches and ignores missing engagement rows', async () => {
    const ids = Array.from({ length: 52 }, (_, index) => String(index + 1))
    gatewayGraphQl
      .mockResolvedValueOnce(Object.fromEntries(ids.slice(0, 50).map((id, index) => [`e${index}`, { targetId: id, viewCount: index + 1 }])))
      .mockResolvedValueOnce({ e0: { targetId: '51', viewCount: 51 }, e1: null })

    const counts = await socialApi.getContentViewCounts([...ids, '1'])

    expect(gatewayGraphQl).toHaveBeenCalledTimes(2)
    expect(counts['1']).toBe(1)
    expect(counts['51']).toBe(51)
    expect(counts['52']).toBeUndefined()
  })

  it('does not query engagement when the reel list is empty', async () => {
    await expect(socialApi.getContentViewCounts([])).resolves.toEqual({})
    expect(gatewayGraphQl).not.toHaveBeenCalled()
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

  it('loads friend-derived public and private group suggestions without a caller ID input', async () => {
    gatewayGraphQl.mockResolvedValue({ groupSuggestions: [{
      group: {
        id: '41', avatar: '/private.png', background: '', name: 'Private friends group', bio: '',
        privacy: 1, create: '2026-07-31T00:00:00Z', memberCount: 12, adminCount: 1,
      },
      friendMemberCount: 4,
      friendMembers: [
        { id: '2', name: 'First friend', avatar: '/friend-1.png' },
        { id: '3', name: 'Second friend', avatar: '/friend-2.png' },
        { id: '4', name: 'Third friend', avatar: '/friend-3.png' },
      ],
      yesterdayPostCount: 7,
    }] })

    const suggestions = await socialApi.getGroupSuggestions(24)

    const [query, variables] = gatewayGraphQl.mock.calls[0]
    expect(query).toContain('groupSuggestions(limit: $limit)')
    expect(query).toContain('friendMemberCount')
    expect(query).toContain('friendMembers { id name avatar }')
    expect(query).toContain('yesterdayPostCount')
    expect(query).not.toContain('userId')
    expect(variables).toEqual({ limit: 24 })
    expect(suggestions[0]).toMatchObject({
      group: {
        id: '41',
        name: 'Private friends group',
        privacy: 1,
        memberCount: 12,
      },
      friendMemberCount: 4,
      yesterdayPostCount: 7,
    })
    expect(suggestions[0].friendMembers).toHaveLength(3)
    expect(suggestions[0].friendMembers[0]).toMatchObject({ id: '2', displayName: 'First friend' })
  })

  it('loads only the trusted viewer friend-member preview for one group', async () => {
    gatewayGraphQl.mockResolvedValue({ groupFriendMembers: [
      { id: '2', name: 'First friend', avatar: '/friend-1.png' },
      { id: '3', name: 'Second friend', avatar: '/friend-2.png' },
    ] })

    const friends = await socialApi.getGroupFriendMembers('41', 99)

    const [query, variables] = gatewayGraphQl.mock.calls[0]
    expect(query).toContain('groupFriendMembers(groupId: 41, limit: $limit)')
    expect(query).not.toContain('userId')
    expect(variables).toEqual({ limit: 12 })
    expect(friends).toEqual([
      expect.objectContaining({ id: '2', displayName: 'First friend', avatarUrl: '/friend-1.png' }),
      expect.objectContaining({ id: '3', displayName: 'Second friend', avatarUrl: '/friend-2.png' }),
    ])
  })

  it('batches group friend previews without sending a viewer id from the browser', async () => {
    gatewayGraphQl.mockResolvedValue({
      friends0: [{ id: '2', name: 'First friend', avatar: '/friend-1.png', isVerified: false }],
      friends1: [{ id: '3', name: 'Second friend', avatar: '/friend-2.png', isVerified: true }],
    })

    const previews = await socialApi.getGroupFriendMemberPreviews(['41', '42', '41'], 99)

    const [query, variables] = gatewayGraphQl.mock.calls[0]
    expect(query).toContain('friends0: groupFriendMembers(groupId: 41, limit: $limit)')
    expect(query).toContain('friends1: groupFriendMembers(groupId: 42, limit: $limit)')
    expect(query).not.toContain('isVerified')
    expect(query).not.toContain('viewerId')
    expect(variables).toEqual({ limit: 12 })
    expect(previews['41'][0]).toMatchObject({ id: '2', displayName: 'First friend' })
    expect(previews['42'][0]).toMatchObject({ id: '3', displayName: 'Second friend' })
  })

  it('hydrates group join requests directly from the administrator-scoped page', async () => {
    gatewayGraphQl.mockResolvedValue({ groupJoinRequests: {
      items: [{ id: '7', name: 'Pending member', avatar: '/pending.png', isVerified: true }],
      endCursor: null,
      hasNextPage: false,
    } })

    const requests = await socialApi.getGroupJoinRequests('41', 100)

    const [query, variables] = gatewayGraphQl.mock.calls[0]
    expect(query).toContain('groupJoinRequests(groupId: 41, limit: $limit)')
    expect(query).toContain('items { id name avatar isVerified }')
    expect(query).not.toContain('id2')
    expect(variables).toEqual({ limit: 50 })
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
    expect(requests).toEqual([expect.objectContaining({ id: '7', displayName: 'Pending member', avatarUrl: '/pending.png', isVerified: true })])
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

  it('batches trusted viewer group states and keeps Snowflake ids as literals', async () => {
    gatewayGraphQl.mockResolvedValue({
      membership0: { isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true },
      membership1: null,
    })

    const states = await socialApi.getGroupMembershipStates('1', ['9007199254740993123', '22', '22'])

    const query = gatewayGraphQl.mock.calls[0][0] as string
    expect(query).toContain('membership0: groupViewerState(groupId: 9007199254740993123)')
    expect(query).toContain('membership1: groupViewerState(groupId: 22)')
    expect(query).not.toContain('userId: 1')
    expect(states['9007199254740993123'].isMember).toBe(true)
    expect(states['22']).toEqual({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: false })
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

  it('sends Reel privacy and presentation ratio through Gateway GraphQL without rounding the author ID', async () => {
    gatewayGraphQl.mockResolvedValue({ createReel: {
      id: '9007199254740993555', type: 4, content: 'New reel', privacy: 2,
      create: '2026-07-28T10:00:00Z', authorId: '9007199254740993123', aspectRatio: 0.5625,
      focalPointX: 0.25, focalPointY: 0.75,
      media: [{ id: '9007199254740993666', type: 1, url: '/reel.mp4' }],
    } })

    const reel = await socialApi.createReel('9007199254740993123', {
      content: 'New reel',
      privacy: 2,
      aspectRatio: 0.5625,
      focalPointX: 0.25,
      focalPointY: 0.75,
      media: { type: 1, url: '/reel.mp4' },
    })

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('authorId: 9007199254740993123')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('privacy: $privacy, aspectRatio: $aspectRatio, focalPointX: $focalPointX, focalPointY: $focalPointY')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({
      content: 'New reel', privacy: 2, aspectRatio: 0.5625, focalPointX: 0.25, focalPointY: 0.75, media: { type: 1, url: '/reel.mp4' },
    })
    expect(reel).toMatchObject({ id: '9007199254740993555', privacy: 2, aspectRatio: 0.5625, focalPointX: 0.25, focalPointY: 0.75 })
  })

  it('invalidates mounted group views only after a successful leave mutation', async () => {
    const received: GroupMembershipChangedDetail[] = []
    const listener = (event: Event) => received.push((event as CustomEvent<GroupMembershipChangedDetail>).detail)
    window.addEventListener(GROUP_MEMBERSHIP_CHANGED_EVENT, listener)
    try {
      gatewayGraphQl.mockResolvedValueOnce({ leaveGroup: true })
      await expect(socialApi.leaveGroup('9007199254740993123', '9007199254740993999')).resolves.toBe(true)
      expect(received).toEqual([{ groupId: '9007199254740993999', state: 'left' }])

      gatewayGraphQl.mockResolvedValueOnce({ leaveGroup: false })
      await expect(socialApi.leaveGroup('9007199254740993123', '9007199254740994000')).resolves.toBe(false)
      expect(received).toHaveLength(1)
    } finally {
      window.removeEventListener(GROUP_MEMBERSHIP_CHANGED_EVENT, listener)
    }
  })

  it('loads the privacy-filtered group photo and video gallery through Gateway GraphQL', async () => {
    gatewayGraphQl.mockResolvedValue({ groupMedia: {
      items: [
        { media: { id: '91', type: 0, url: '/photo.jpg' }, contentId: '81', contentType: 3, create: 'now', authorId: '71', groupId: '61' },
        { media: { id: '92', type: 1, url: '/video.mp4' }, contentId: '82', contentType: 3, create: 'now', authorId: '72', groupId: '61' },
      ],
      endCursor: null,
      hasNextPage: false,
    } })

    const page = await socialApi.getGroupMedia('61', 50)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('groupMedia(groupId: 61')
    expect(page.items.map((item) => item.media.type)).toEqual([0, 1])
    expect(page.items[1]).toMatchObject({ contentId: '82', authorId: '72', groupId: '61' })
  })

  it('loads another profile group memberships through target-scoped Gateway queries', async () => {
    gatewayGraphQl
      .mockResolvedValueOnce({ profileMemberGroups: {
        items: [{ id: '61', avatar: '', background: '', name: 'Joined group', bio: '', privacy: 0, create: '', memberCount: 12, adminCount: 1 }],
        endCursor: null,
        hasNextPage: false,
      } })
      .mockResolvedValueOnce({ profileAdminGroups: {
        items: [{ id: '62', avatar: '', background: '', name: 'Managed group', bio: '', privacy: 1, create: '', memberCount: 7, adminCount: 2 }],
        endCursor: null,
        hasNextPage: false,
      } })

    const joined = await socialApi.getProfileMemberGroups('9007199254740993123', 25)
    const managed = await socialApi.getProfileAdminGroups('9007199254740993123', 25)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('profileMemberGroups(userId: 9007199254740993123')
    expect(gatewayGraphQl.mock.calls[1][0]).toContain('profileAdminGroups(userId: 9007199254740993123')
    expect(joined.items[0]).toMatchObject({ id: '61', name: 'Joined group' })
    expect(managed.items[0]).toMatchObject({ id: '62', name: 'Managed group' })
  })

  it('creates a group post with stable tagged Snowflake IDs and no client-selected privacy', async () => {
    gatewayGraphQl.mockResolvedValue({ createGroupPost: {
      id: '81', type: 3, content: 'hello', privacy: 1, create: 'now', authorId: '71', media: [],
    } })

    await socialApi.createGroupPost('71', '61', { content: 'hello', taggedUserIds: ['9007199254740993123'] })

    const query = gatewayGraphQl.mock.calls[0][0] as string
    expect(query).toContain('groupId: 61')
    expect(query).toContain('taggedUserIds: [9007199254740993123]')
    expect(query).not.toContain('privacy:')
  })

  it('batches member relationship metadata without accepting a spoofable viewer argument', async () => {
    gatewayGraphQl.mockResolvedValue({
      r0: { isFriend: true, isFollowing: false, followsViewer: false, friendRequestSent: false, friendRequestReceived: false, isBlocked: false, isBlockedBy: false },
      r1: { isFriend: false, isFollowing: true, followsViewer: true, friendRequestSent: false, friendRequestReceived: false, isBlocked: false, isBlockedBy: false },
    })

    const states = await socialApi.getProfileRelationshipStates('71', ['72', '73'])

    expect(states['72'].friendship).toBe('friend')
    expect(states['73'].isFollowing).toBe(true)
    const query = gatewayGraphQl.mock.calls[0][0] as string
    expect(query).toContain('r0: relationshipState(userId: 72)')
    expect(query).toContain('r1: relationshipState(userId: 73)')
    expect(query).not.toContain('viewerId')
  })

  it('maps comment tombstones and loads bounded edit history through the trusted Gateway query', async () => {
    gatewayGraphQl
      .mockResolvedValueOnce({ comments: {
        items: [{
          id: '9007199254740993010', content: '', create: '2026-08-03T00:00:00Z',
          author: { id: '2', name: 'Author', avatar: '', isVerified: false },
          likeCount: 0, replyCount: 2, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false,
          mentions: [], media: null, isDeleted: true, editedAt: null,
        }],
        endCursor: null,
        hasNextPage: false,
      } })
      .mockResolvedValueOnce({ commentEditHistory: [{
        content: 'old [[mention:3]]', editedAt: '2026-08-02T00:00:00Z',
        mentions: [{ userId: '3', name: 'Friend', available: true }],
      }] })

    const page = await socialApi.getComments('9007199254740993000')
    const history = await socialApi.getCommentEditHistory('9007199254740993011')

    expect(page.items[0]).toMatchObject({ isDeleted: true, editedAt: null, replyCount: 2 })
    expect(history[0]).toMatchObject({ content: 'old [[mention:3]]', mentions: [{ userId: '3', name: 'Friend' }] })
    const historyQuery = gatewayGraphQl.mock.calls[1][0] as string
    expect(historyQuery).toContain('commentEditHistory(commentId: 9007199254740993011)')
    expect(historyQuery).not.toContain('viewerId')
  })

  it('edits a comment without sending a spoofable actor id', async () => {
    gatewayGraphQl.mockResolvedValue({ updateComment: { id: '9007199254740993011' } })

    await expect(socialApi.updateComment('9007199254740993011', 'edited')).resolves.toBe(true)

    const [query, variables] = gatewayGraphQl.mock.calls[0]
    expect(query).toContain('updateComment(input: { id: 9007199254740993011, content: $content })')
    expect(query).not.toContain('userId')
    expect(variables).toEqual({ content: 'edited' })
  })
})

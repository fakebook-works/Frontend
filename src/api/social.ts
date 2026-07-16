import { gatewayGraphQl, graphQlLongLiteral } from './client'
import type { GatewayMedia, GatewayPost } from './gatewayTypes'
import type { UserProfile, UserSummary } from './types'

interface ProfileGraphQl {
  id: string
  avatar: string
  background: string
  name: string
  bio: string
  gender: number
  birthdate: string
  location: string
  privacy: number
  create: string
  verify: string
  isVerified: boolean
  friendCount: number
  followerCount: number
  followingCount: number
}

export interface SocialProfile extends UserProfile {
  backgroundUrl: string | null
  privacy: number
  followerCount: number
  followingCount: number
}

export interface SocialGroup {
  id: string
  avatarUrl: string | null
  backgroundUrl: string | null
  name: string
  bio: string | null
  privacy: number
  createdAt: string
  memberCount: number | null
  adminCount: number
}

export interface SocialContent {
  id: string
  type: number
  content: string
  privacy: number
  createdAt: string
  authorId: string
  media: GatewayMedia[]
  author?: UserSummary | null
}

export type SocialOwnedMedia = GatewayMedia

export interface SocialPage<T> {
  items: T[]
  endCursor: string | null
  hasNextPage: boolean
}

export interface UpdatePostValues {
  privacy?: number | null
  content?: string | null
  media?: Array<{ type: number; url: string }> | null
}

export type FriendshipState = 'none' | 'friend' | 'outgoing' | 'incoming'

export interface ProfileRelationshipState {
  friendship: FriendshipState
  isFollowing: boolean
  followsViewer: boolean
  isBlocked: boolean
  isBlockedBy: boolean
}

export interface GroupMembershipState {
  isMember: boolean
  isAdmin: boolean
  joinRequestPending: boolean
  canViewPosts: boolean
}

export interface ContentEngagement {
  targetId: string
  likeCount: number
  commentCount: number
  shareCount: number
  viewerHasLiked: boolean
  viewerHasSaved: boolean
  viewerHasWatched: boolean
}

export interface SocialComment {
  id: string
  content: string
  createdAt: string
  author: UserSummary
  likeCount: number
  replyCount: number
  viewerHasLiked: boolean
}

export type SavedContentItem =
  | { kind: 'post'; id: string; post: GatewayPost }
  | { kind: 'reel'; id: string; reel: SocialContent }

interface AssociationPage {
  items: Array<{ id2: string }>
  nextCursor: string | null
}

interface GroupMembershipPage {
  items: SocialGroup[]
  endCursor: string | null
  hasNextPage: boolean
}

const PROFILE_FIELDS = `
  id avatar background name bio gender birthdate location privacy create verify
  isVerified friendCount followerCount followingCount
`

const GROUP_FIELDS = `id avatar background name bio privacy create memberCount adminCount`
const CONTENT_FIELDS = `id type content privacy create authorId media { id type url }`
const POST_FIELDS = `
  __typename
  ... on FeedPostDetail {
    id type content privacy create
    author { id name avatar isVerified canFollow }
    media { id type url }
  }
  ... on GroupPostDetail {
    id type content privacy create
    author { id name avatar isVerified canFollow }
    group { id name avatar canJoin }
    media { id type url }
  }
`
const GROUP_POST_FIELDS = `
  __typename
  id type content privacy create
  author { id name avatar isVerified canFollow }
  group { id name avatar canJoin }
  media { id type url }
`

function profileFromGraphQl(value: ProfileGraphQl, email = ''): SocialProfile {
  return {
    id: String(value.id),
    username: value.name,
    email,
    displayName: value.name,
    avatarUrl: value.avatar || null,
    backgroundUrl: value.background || null,
    isVerified: value.isVerified,
    bio: value.bio || null,
    birthDate: value.birthdate || null,
    gender: value.gender === 1 ? 'male' : 'female',
    location: value.location || null,
    createdAt: value.create,
    friendCount: value.friendCount,
    followerCount: value.followerCount,
    followingCount: value.followingCount,
    postCount: 0,
    privacy: value.privacy,
  }
}

function summaryFromProfile(profile: SocialProfile): UserSummary {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isVerified: profile.isVerified,
  }
}

function summaryFromGraphQl(value: Record<string, unknown>): UserSummary {
  return {
    id: String(value.id),
    username: String(value.name ?? ''),
    displayName: String(value.name ?? ''),
    avatarUrl: String(value.avatar ?? '') || null,
    isVerified: Boolean(value.isVerified),
  }
}

function groupFromGraphQl(value: Record<string, unknown>): SocialGroup {
  return {
    id: String(value.id),
    avatarUrl: String(value.avatar ?? '') || null,
    backgroundUrl: String(value.background ?? '') || null,
    name: String(value.name ?? ''),
    bio: String(value.bio ?? '') || null,
    privacy: Number(value.privacy ?? 0),
    createdAt: String(value.create ?? ''),
    memberCount: Number(value.memberCount ?? 0),
    adminCount: Number(value.adminCount ?? 0),
  }
}

function contentFromGraphQl(value: Record<string, unknown>): SocialContent {
  return {
    id: String(value.id),
    type: Number(value.type ?? 0),
    content: String(value.content ?? ''),
    privacy: Number(value.privacy ?? 0),
    createdAt: String(value.create ?? ''),
    authorId: String(value.authorId),
    media: ((value.media as GatewayMedia[] | undefined) ?? []).map((item) => ({
      ...item,
      id: String(item.id),
      type: Number(item.type),
    })),
  }
}

async function hydrateContentAuthors(items: SocialContent[]): Promise<SocialContent[]> {
  const authors = await getProfiles(items.map((item) => item.authorId)).catch(() => [])
  const byId = new Map(authors.map((profile) => [profile.id, summaryFromProfile(profile)]))
  return items.map((item) => ({ ...item, author: byId.get(item.authorId) ?? null }))
}

function postFromGraphQl(post: GatewayPost): GatewayPost {
  const normalized = {
    ...post,
    id: String(post.id),
    author: { ...post.author, id: String(post.author.id) },
    media: post.media.map((media) => ({ ...media, id: String(media.id), type: Number(media.type) })),
  }
  return post.__typename === 'GroupPostDetail'
    ? { ...normalized, __typename: 'GroupPostDetail', group: { ...post.group, id: String(post.group.id) } }
    : { ...normalized, __typename: 'FeedPostDetail' }
}

export async function getProfile(userId: string, email = ''): Promise<SocialProfile | null> {
  const id = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ profile: ProfileGraphQl | null }>(
    `query Profile { profile(userId: ${id}) { ${PROFILE_FIELDS} } }`,
  )
  return data.profile ? profileFromGraphQl(data.profile, email) : null
}

export async function getProfiles(userIds: string[]): Promise<SocialProfile[]> {
  const ids = [...new Set(userIds)].slice(0, 50)
  if (ids.length === 0) return []
  const literals = ids.map(graphQlLongLiteral).join(', ')
  const data = await gatewayGraphQl<{ profiles: ProfileGraphQl[] }>(`query Profiles { profiles(userIds: [${literals}]) { ${PROFILE_FIELDS} } }`)
  return data.profiles.map((profile) => profileFromGraphQl(profile))
}

export async function getGroup(groupId: string): Promise<SocialGroup | null> {
  const id = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ group: Record<string, unknown> | null }>(
    `query Group { group(groupId: ${id}) { ${GROUP_FIELDS} } }`,
  )
  return data.group ? groupFromGraphQl(data.group) : null
}

export async function getGroups(groupIds: string[]): Promise<SocialGroup[]> {
  const ids = [...new Set(groupIds)].slice(0, 50)
  if (ids.length === 0) return []
  const literals = ids.map(graphQlLongLiteral).join(', ')
  const data = await gatewayGraphQl<{ groups: Array<Record<string, unknown>> }>(`query Groups { groups(groupIds: [${literals}]) { ${GROUP_FIELDS} } }`)
  return data.groups.map(groupFromGraphQl)
}

export async function getProfilePosts(userId: string, limit = 12, cursor: string | null = null): Promise<{ items: GatewayPost[]; endCursor: string | null; hasNextPage: boolean }> {
  const id = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ profilePosts: { items: GatewayPost[]; endCursor: string | null; hasNextPage: boolean } }>(
    `query ProfilePosts($limit: Int!, $cursor: String) {
      profilePosts(userId: ${id}, limit: $limit, cursor: $cursor) { items { ${POST_FIELDS} } endCursor hasNextPage }
    }`,
    { limit, cursor },
  )
  return { ...data.profilePosts, items: data.profilePosts.items.map(postFromGraphQl) }
}

export async function getProfileReels(userId: string, limit = 20, cursor: string | null = null): Promise<{ items: SocialContent[]; endCursor: string | null; hasNextPage: boolean }> {
  const id = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ profileReels: { items: Array<Record<string, unknown>>; endCursor: string | null; hasNextPage: boolean } }>(
    `query ProfileReels($limit: Int!, $cursor: String) {
      profileReels(userId: ${id}, limit: $limit, cursor: $cursor) { items { ${CONTENT_FIELDS} } endCursor hasNextPage }
    }`,
    { limit, cursor },
  )
  const items = data.profileReels.items.map(contentFromGraphQl)
  return { ...data.profileReels, items: await hydrateContentAuthors(items) }
}

export async function getOwnedMedia(ownerId: string, type: number | null = null, limit = 60, cursor: string | null = null): Promise<SocialPage<SocialOwnedMedia>> {
  const owner = graphQlLongLiteral(ownerId)
  const data = await gatewayGraphQl<{ ownedMedia: { items: GatewayMedia[]; endCursor: string | null; hasNextPage: boolean } }>(
    `query OwnedMedia($type: Int, $limit: Int!, $cursor: String) {
      ownedMedia(ownerId: ${owner}, type: $type, limit: $limit, cursor: $cursor) {
        items { id type url }
        endCursor hasNextPage
      }
    }`,
    { type, limit, cursor },
  )
  return {
    ...data.ownedMedia,
    items: data.ownedMedia.items.map((media) => ({ ...media, id: String(media.id), type: Number(media.type) })),
  }
}

const RELATION_FIELDS = {
  0: 'friends',
  1: 'outgoingFriendRequests',
  2: 'incomingFriendRequests',
  3: 'following',
  4: 'followers',
  5: 'blockedUsers',
} as const

type RelationField = typeof RELATION_FIELDS[keyof typeof RELATION_FIELDS]

async function getRelationIdPage(userId: string, field: RelationField, limit = 100, cursor: string | null = null): Promise<AssociationPage> {
  const id = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<Record<string, AssociationPage>>(
    `query RelationPage($limit: Int!, $cursor: String) {
      ${field}(userId: ${id}, limit: $limit, cursor: $cursor) { items { id2 } nextCursor }
    }`,
    { limit, cursor },
  )
  return {
    items: data[field].items.map((item) => ({ id2: String(item.id2) })),
    nextCursor: data[field].nextCursor,
  }
}

export async function getRelationProfiles(userId: string, associationType: number, limit = 60): Promise<SocialProfile[]> {
  const field = RELATION_FIELDS[associationType as keyof typeof RELATION_FIELDS]
  if (!field) return []
  const page = await getRelationIdPage(userId, field, limit)
  return getProfiles(page.items.map((item) => item.id2))
}

export async function getProfileRelationshipState(viewerId: string, targetId: string): Promise<ProfileRelationshipState> {
  if (viewerId === targetId) return { friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false }
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ relationshipState: {
    isFriend: boolean
    isFollowing: boolean
    followsViewer: boolean
    friendRequestSent: boolean
    friendRequestReceived: boolean
    isBlocked: boolean
    isBlockedBy: boolean
  } | null }>(
    `query RelationshipState {
      relationshipState(userId: ${target}) {
        isFriend isFollowing followsViewer friendRequestSent friendRequestReceived isBlocked isBlockedBy
      }
    }`,
  )
  const state = data.relationshipState
  if (!state) return { friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false }
  return {
    friendship: state.isFriend ? 'friend' : state.friendRequestSent ? 'outgoing' : state.friendRequestReceived ? 'incoming' : 'none',
    isFollowing: state.isFollowing,
    followsViewer: state.followsViewer,
    isBlocked: state.isBlocked,
    isBlockedBy: state.isBlockedBy,
  }
}

async function getGroupMembershipPage(userId: string, field: 'memberGroups' | 'adminGroups', limit = 50, cursor: string | null = null): Promise<GroupMembershipPage> {
  const id = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<Record<string, { items: Array<Record<string, unknown>>; endCursor: string | null; hasNextPage: boolean }>>(
    `query GroupMemberships($limit: Int!, $cursor: String) {
      ${field}(userId: ${id}, limit: $limit, cursor: $cursor) { items { ${GROUP_FIELDS} } endCursor hasNextPage }
    }`,
    { limit, cursor },
  )
  return { ...data[field], items: data[field].items.map(groupFromGraphQl) }
}

export function getMemberGroups(userId: string, limit = 50, cursor: string | null = null): Promise<GroupMembershipPage> {
  return getGroupMembershipPage(userId, 'memberGroups', limit, cursor)
}

export function getAdminGroups(userId: string, limit = 50, cursor: string | null = null): Promise<GroupMembershipPage> {
  return getGroupMembershipPage(userId, 'adminGroups', limit, cursor)
}

export async function getPendingGroupJoins(userId: string, limit = 50, cursor: string | null = null): Promise<GroupMembershipPage> {
  const id = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ pendingGroupJoins: { items: Array<Record<string, unknown>>; endCursor: string | null; hasNextPage: boolean } }>(
    `query PendingGroupJoins($limit: Int!, $cursor: String) {
      pendingGroupJoins(userId: ${id}, limit: $limit, cursor: $cursor) { items { ${GROUP_FIELDS} } endCursor hasNextPage }
    }`,
    { limit, cursor },
  )
  return { ...data.pendingGroupJoins, items: data.pendingGroupJoins.items.map(groupFromGraphQl) }
}

export async function getGroupMembershipState(userId: string, groupId: string): Promise<GroupMembershipState> {
  graphQlLongLiteral(userId)
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ groupViewerState: GroupMembershipState | null }>(
    `query GroupViewerState {
      groupViewerState(groupId: ${group}) { isMember isAdmin joinRequestPending canViewPosts }
    }`,
  )
  return data.groupViewerState ?? { isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: false }
}

export async function getGroupJoinRequests(groupId: string, limit = 100): Promise<SocialProfile[]> {
  const id = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ groupJoinRequests: AssociationPage }>(
    `query GroupJoinRequests($limit: Int!) {
      groupJoinRequests(groupId: ${id}, limit: $limit) { items { id2 } nextCursor }
    }`,
    { limit },
  )
  return getProfiles(data.groupJoinRequests.items.map((item) => String(item.id2)))
}

async function getGroupPeople(groupId: string, field: 'groupMembers' | 'groupAdmins', limit = 50, cursor: string | null = null): Promise<{ items: UserSummary[]; endCursor: string | null; hasNextPage: boolean }> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<Record<string, { items: Array<Record<string, unknown>>; endCursor: string | null; hasNextPage: boolean }>>(
    `query GroupPeople($limit: Int!, $cursor: String) {
      ${field}(groupId: ${group}, limit: $limit, cursor: $cursor) {
        items { id name avatar isVerified }
        endCursor hasNextPage
      }
    }`,
    { limit, cursor },
  )
  return { ...data[field], items: data[field].items.map(summaryFromGraphQl) }
}

export function getGroupMembers(groupId: string, limit = 50, cursor: string | null = null) {
  return getGroupPeople(groupId, 'groupMembers', limit, cursor)
}

export function getGroupAdmins(groupId: string, limit = 50, cursor: string | null = null) {
  return getGroupPeople(groupId, 'groupAdmins', limit, cursor)
}

export async function getGroupPosts(groupId: string, limit = 20, cursor: string | null = null): Promise<{ items: GatewayPost[]; endCursor: string | null; hasNextPage: boolean }> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ groupPosts: { items: GatewayPost[]; endCursor: string | null; hasNextPage: boolean } }>(
    `query GroupPosts($limit: Int!, $cursor: String) {
      groupPosts(groupId: ${group}, limit: $limit, cursor: $cursor) { items { ${GROUP_POST_FIELDS} } endCursor hasNextPage }
    }`,
    { limit, cursor },
  )
  return { ...data.groupPosts, items: data.groupPosts.items.map(postFromGraphQl) }
}

export async function getGroupUserPosts(groupId: string, userId: string, limit = 20, cursor: string | null = null): Promise<SocialPage<GatewayPost>> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ groupUserPosts: { items: GatewayPost[]; endCursor: string | null; hasNextPage: boolean } }>(
    `query GroupUserPosts($limit: Int!, $cursor: String) {
      groupUserPosts(groupId: ${group}, userId: ${user}, limit: $limit, cursor: $cursor) {
        items { ${GROUP_POST_FIELDS} }
        endCursor hasNextPage
      }
    }`,
    { limit, cursor },
  )
  return { ...data.groupUserPosts, items: data.groupUserPosts.items.map(postFromGraphQl) }
}

export async function getContentEngagement(targetId: string): Promise<ContentEngagement | null> {
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ contentEngagement: ContentEngagement | null }>(
    `query ContentEngagement {
      contentEngagement(targetId: ${target}) {
        targetId likeCount commentCount shareCount viewerHasLiked viewerHasSaved viewerHasWatched
      }
    }`,
  )
  return data.contentEngagement ? { ...data.contentEngagement, targetId: String(data.contentEngagement.targetId) } : null
}

export async function getComments(targetId: string, limit = 30, cursor: string | null = null): Promise<{ items: SocialComment[]; endCursor: string | null; hasNextPage: boolean }> {
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ comments: { items: Array<{
    id: string
    content: string
    create: string
    author: Record<string, unknown>
    likeCount: number
    replyCount: number
    viewerHasLiked: boolean
  }>; endCursor: string | null; hasNextPage: boolean } }>(
    `query Comments($limit: Int!, $cursor: String) {
      comments(targetId: ${target}, limit: $limit, cursor: $cursor) {
        items { id content create author { id name avatar isVerified } likeCount replyCount viewerHasLiked }
        endCursor hasNextPage
      }
    }`,
    { limit, cursor },
  )
  return {
    ...data.comments,
    items: data.comments.items.map((comment) => ({
      id: String(comment.id),
      content: comment.content,
      createdAt: comment.create,
      author: summaryFromGraphQl(comment.author),
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      viewerHasLiked: comment.viewerHasLiked,
    })),
  }
}

export async function getSavedContent(limit = 30, cursor: string | null = null): Promise<{ items: SavedContentItem[]; endCursor: string | null; hasNextPage: boolean }> {
  const data = await gatewayGraphQl<{ savedContent: { items: Array<{
    id: string
    type: number
    post: GatewayPost | null
    reel: Record<string, unknown> | null
  }>; endCursor: string | null; hasNextPage: boolean } }>(
    `query SavedContent($limit: Int!, $cursor: String) {
      savedContent(limit: $limit, cursor: $cursor) {
        items { id type post { ${POST_FIELDS} } reel { ${CONTENT_FIELDS} } }
        endCursor hasNextPage
      }
    }`,
    { limit, cursor },
  )
  const reels = data.savedContent.items.flatMap((item) => item.reel ? [contentFromGraphQl(item.reel)] : [])
  const authors = await getProfiles(reels.map((reel) => reel.authorId)).catch(() => [])
  const byAuthor = new Map(authors.map((profile) => [profile.id, summaryFromProfile(profile)]))
  const reelById = new Map(reels.map((reel) => [reel.id, { ...reel, author: byAuthor.get(reel.authorId) ?? null }]))
  const items = data.savedContent.items.flatMap((item): SavedContentItem[] => {
    if (item.post) return [{ kind: 'post', id: String(item.id), post: postFromGraphQl(item.post) }]
    const reel = reelById.get(String(item.id))
    return reel ? [{ kind: 'reel', id: String(item.id), reel }] : []
  })
  return { ...data.savedContent, items }
}

export async function getRecommendedReels(userId: string, mode: 'FOR_YOU' | 'FOLLOWING', skip = 0, take = 20): Promise<SocialContent[]> {
  const data = await gatewayGraphQl<{ recommendReels: Array<{ reelId: string; reel: Record<string, unknown> | null }> }>(
    `query RecommendedReels($userId: ID!, $mode: ReelRecommendationMode!, $skip: Int!, $take: Int!) {
      recommendReels(userId: $userId, mode: $mode, skip: $skip, take: $take) {
        reelId
        reel { ${CONTENT_FIELDS} }
      }
    }`,
    { userId, mode, skip, take },
  )
  const items = data.recommendReels.flatMap((item) => item.reel ? [contentFromGraphQl(item.reel)] : [])
  return hydrateContentAuthors(items)
}

export async function getReelCollection(mode: 'liked' | 'shared' | 'watched', limit = 30, cursor: string | null = null): Promise<SocialContent[]> {
  const field = mode === 'liked' ? 'likedReels' : mode === 'shared' ? 'sharedReels' : 'watchedReels'
  const data = await gatewayGraphQl<Record<string, { items: Array<Record<string, unknown>>; endCursor: string | null; hasNextPage: boolean }>>(
    `query ReelCollection($limit: Int!, $cursor: String) {
      ${field}(limit: $limit, cursor: $cursor) {
        items { ${CONTENT_FIELDS} }
        endCursor hasNextPage
      }
    }`,
    { limit, cursor },
  )
  return hydrateContentAuthors(data[field].items.map(contentFromGraphQl))
}

export async function updateProfile(userId: string, input: {
  name: string
  avatar?: string | null
  background?: string | null
  bio?: string | null
  gender?: boolean | null
  birthdate?: string | null
  location?: string | null
  privacy?: number | null
}): Promise<SocialProfile | null> {
  const id = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ updateUser: ProfileGraphQl | null }>(
    `mutation UpdateProfile($avatar: String, $background: String, $name: String, $bio: String, $gender: Boolean, $birthdate: String, $location: String, $privacy: Int) {
      updateUser(input: { id: ${id}, avatar: $avatar, background: $background, name: $name, bio: $bio, gender: $gender, birthdate: $birthdate, location: $location, privacy: $privacy }) {
        ${PROFILE_FIELDS}
      }
    }`,
    { ...input },
  )
  return data.updateUser ? profileFromGraphQl(data.updateUser) : null
}

export async function sendFriendRequest(viewerId: string, targetId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ sendFriendRequest: boolean }>(
    `mutation { sendFriendRequest(requesterId: ${viewer}, receiverId: ${target}) }`,
  )
  return data.sendFriendRequest
}

export async function acceptFriendRequest(requesterId: string, viewerId: string): Promise<boolean> {
  const requester = graphQlLongLiteral(requesterId)
  const viewer = graphQlLongLiteral(viewerId)
  const data = await gatewayGraphQl<{ acceptFriendRequest: boolean }>(
    `mutation { acceptFriendRequest(requesterId: ${requester}, receiverId: ${viewer}) }`,
  )
  return data.acceptFriendRequest
}

export async function cancelFriendRequest(viewerId: string, receiverId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const receiver = graphQlLongLiteral(receiverId)
  const data = await gatewayGraphQl<{ cancelFriendRequest: boolean }>(
    `mutation { cancelFriendRequest(requesterId: ${viewer}, receiverId: ${receiver}) }`,
  )
  return data.cancelFriendRequest
}

export async function rejectFriendRequest(requesterId: string, viewerId: string): Promise<boolean> {
  const requester = graphQlLongLiteral(requesterId)
  const viewer = graphQlLongLiteral(viewerId)
  const data = await gatewayGraphQl<{ rejectFriendRequest: boolean }>(
    `mutation { rejectFriendRequest(requesterId: ${requester}, receiverId: ${viewer}) }`,
  )
  return data.rejectFriendRequest
}

export async function unfriend(viewerId: string, friendId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const friend = graphQlLongLiteral(friendId)
  const data = await gatewayGraphQl<{ unfriend: boolean }>(
    `mutation { unfriend(userId: ${viewer}, friendId: ${friend}) }`,
  )
  return data.unfriend
}

export async function followUser(viewerId: string, targetUserId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetUserId)
  const data = await gatewayGraphQl<{ followUser: boolean }>(
    `mutation { followUser(followerId: ${viewer}, targetUserId: ${target}) }`,
  )
  return data.followUser
}

export async function unfollowUser(viewerId: string, targetUserId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetUserId)
  const data = await gatewayGraphQl<{ unfollowUser: boolean }>(
    `mutation { unfollowUser(followerId: ${viewer}, targetUserId: ${target}) }`,
  )
  return data.unfollowUser
}

export async function blockUser(viewerId: string, blockedUserId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const blocked = graphQlLongLiteral(blockedUserId)
  const data = await gatewayGraphQl<{ blockUser: boolean }>(
    `mutation { blockUser(blockerId: ${viewer}, blockedUserId: ${blocked}) }`,
  )
  return data.blockUser
}

export async function unblockUser(viewerId: string, blockedUserId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const blocked = graphQlLongLiteral(blockedUserId)
  const data = await gatewayGraphQl<{ unblockUser: boolean }>(
    `mutation { unblockUser(blockerId: ${viewer}, blockedUserId: ${blocked}) }`,
  )
  return data.unblockUser
}

export async function createGroup(viewerId: string, input: { name: string; bio: string; privacy: number }): Promise<SocialGroup> {
  const viewer = graphQlLongLiteral(viewerId)
  const data = await gatewayGraphQl<{ createGroup: Record<string, unknown> }>(
    `mutation CreateGroup($name: String!, $bio: String, $privacy: Int!) {
      createGroup(input: { creatorId: ${viewer}, name: $name, bio: $bio, privacy: $privacy }) { ${GROUP_FIELDS} }
    }`,
    input,
  )
  return groupFromGraphQl(data.createGroup)
}

export async function updateGroup(groupId: string, input: { name?: string | null; bio?: string | null; privacy?: number | null; avatar?: string | null; background?: string | null }): Promise<SocialGroup | null> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ updateGroup: Record<string, unknown> | null }>(
    `mutation UpdateGroup($name: String, $bio: String, $privacy: Int, $avatar: String, $background: String) {
      updateGroup(input: { id: ${group}, name: $name, bio: $bio, privacy: $privacy, avatar: $avatar, background: $background }) { ${GROUP_FIELDS} }
    }`,
    input,
  )
  return data.updateGroup ? groupFromGraphQl(data.updateGroup) : null
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ deleteGroup: boolean }>(`mutation { deleteGroup(groupId: ${group}) }`)
  return data.deleteGroup
}

export async function changeUserAvatar(userId: string, avatarUrl: string, originalUrl: string | null = null): Promise<SocialProfile | null> {
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ changeUserAvatar: ProfileGraphQl | null }>(
    `mutation ChangeUserAvatar($avatarUrl: String!, $originalUrl: String) {
      changeUserAvatar(userId: ${user}, avatarUrl: $avatarUrl, originalUrl: $originalUrl) { ${PROFILE_FIELDS} }
    }`,
    { avatarUrl, originalUrl },
  )
  return data.changeUserAvatar ? profileFromGraphQl(data.changeUserAvatar) : null
}

export async function changeUserBackground(userId: string, backgroundUrl: string, originalUrl: string | null = null): Promise<SocialProfile | null> {
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ changeUserBackground: ProfileGraphQl | null }>(
    `mutation ChangeUserBackground($backgroundUrl: String!, $originalUrl: String) {
      changeUserBackground(userId: ${user}, backgroundUrl: $backgroundUrl, originalUrl: $originalUrl) { ${PROFILE_FIELDS} }
    }`,
    { backgroundUrl, originalUrl },
  )
  return data.changeUserBackground ? profileFromGraphQl(data.changeUserBackground) : null
}

export async function removeUserAvatar(userId: string): Promise<SocialProfile | null> {
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ removeUserAvatar: ProfileGraphQl | null }>(
    `mutation { removeUserAvatar(userId: ${user}) { ${PROFILE_FIELDS} } }`,
  )
  return data.removeUserAvatar ? profileFromGraphQl(data.removeUserAvatar) : null
}

export async function removeUserBackground(userId: string): Promise<SocialProfile | null> {
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ removeUserBackground: ProfileGraphQl | null }>(
    `mutation { removeUserBackground(userId: ${user}) { ${PROFILE_FIELDS} } }`,
  )
  return data.removeUserBackground ? profileFromGraphQl(data.removeUserBackground) : null
}

export async function changeGroupAvatar(groupId: string, avatarUrl: string): Promise<SocialGroup | null> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ changeGroupAvatar: Record<string, unknown> | null }>(
    `mutation ChangeGroupAvatar($avatarUrl: String!) { changeGroupAvatar(groupId: ${group}, avatarUrl: $avatarUrl) { ${GROUP_FIELDS} } }`,
    { avatarUrl },
  )
  return data.changeGroupAvatar ? groupFromGraphQl(data.changeGroupAvatar) : null
}

export async function changeGroupBackground(groupId: string, backgroundUrl: string, originalUrl: string | null = null): Promise<SocialGroup | null> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ changeGroupBackground: Record<string, unknown> | null }>(
    `mutation ChangeGroupBackground($backgroundUrl: String!, $originalUrl: String) { changeGroupBackground(groupId: ${group}, backgroundUrl: $backgroundUrl, originalUrl: $originalUrl) { ${GROUP_FIELDS} } }`,
    { backgroundUrl, originalUrl },
  )
  return data.changeGroupBackground ? groupFromGraphQl(data.changeGroupBackground) : null
}

export async function removeGroupAvatar(groupId: string): Promise<SocialGroup | null> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ removeGroupAvatar: Record<string, unknown> | null }>(
    `mutation { removeGroupAvatar(groupId: ${group}) { ${GROUP_FIELDS} } }`,
  )
  return data.removeGroupAvatar ? groupFromGraphQl(data.removeGroupAvatar) : null
}

export async function removeGroupBackground(groupId: string): Promise<SocialGroup | null> {
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ removeGroupBackground: Record<string, unknown> | null }>(
    `mutation { removeGroupBackground(groupId: ${group}) { ${GROUP_FIELDS} } }`,
  )
  return data.removeGroupBackground ? groupFromGraphQl(data.removeGroupBackground) : null
}

export async function recordGroupVisit(viewerId: string, groupId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ recordGroupVisit: boolean }>(
    `mutation { recordGroupVisit(userId: ${viewer}, groupId: ${group}) }`,
  )
  return data.recordGroupVisit
}

export async function requestJoinGroup(viewerId: string, groupId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ requestJoinGroup: boolean }>(
    `mutation { requestJoinGroup(userId: ${viewer}, groupId: ${group}) }`,
  )
  return data.requestJoinGroup
}

export async function cancelJoinGroupRequest(viewerId: string, groupId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ cancelJoinGroupRequest: boolean }>(
    `mutation { cancelJoinGroupRequest(userId: ${viewer}, groupId: ${group}) }`,
  )
  return data.cancelJoinGroupRequest
}

export async function leaveGroup(viewerId: string, groupId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ leaveGroup: boolean }>(
    `mutation { leaveGroup(userId: ${viewer}, groupId: ${group}) }`,
  )
  return data.leaveGroup
}

export async function approveGroupJoinRequest(groupId: string, userId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ approveGroupJoinRequest: boolean }>(
    `mutation { approveGroupJoinRequest(groupId: ${group}, userId: ${user}) }`,
  )
  return data.approveGroupJoinRequest
}

export async function rejectGroupJoinRequest(groupId: string, userId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ rejectGroupJoinRequest: boolean }>(
    `mutation { rejectGroupJoinRequest(groupId: ${group}, userId: ${user}) }`,
  )
  return data.rejectGroupJoinRequest
}

export async function inviteGroupUser(groupId: string, userId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ inviteGroupUser: boolean }>(
    `mutation { inviteGroupUser(groupId: ${group}, userId: ${user}) }`,
  )
  return data.inviteGroupUser
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ removeGroupMember: boolean }>(
    `mutation { removeGroupMember(groupId: ${group}, userId: ${user}) }`,
  )
  return data.removeGroupMember
}

export async function addGroupMember(groupId: string, userId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ addGroupMember: boolean }>(
    `mutation { addGroupMember(groupId: ${group}, userId: ${user}) }`,
  )
  return data.addGroupMember
}

export async function addGroupAdmin(groupId: string, userId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ addGroupAdmin: boolean }>(
    `mutation { addGroupAdmin(groupId: ${group}, userId: ${user}) }`,
  )
  return data.addGroupAdmin
}

export async function removeGroupAdmin(groupId: string, userId: string): Promise<boolean> {
  const group = graphQlLongLiteral(groupId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ removeGroupAdmin: boolean }>(
    `mutation { removeGroupAdmin(groupId: ${group}, userId: ${user}) }`,
  )
  return data.removeGroupAdmin
}

export async function createReel(viewerId: string, input: { content: string; media?: { type: number; url: string } | null }): Promise<SocialContent> {
  const viewer = graphQlLongLiteral(viewerId)
  const data = await gatewayGraphQl<{ createReel: Record<string, unknown> }>(
    `mutation CreateReel($content: String!, $media: MediaInput) {
      createReel(input: { authorId: ${viewer}, content: $content, media: $media }) { ${CONTENT_FIELDS} }
    }`,
    input,
  )
  return contentFromGraphQl(data.createReel)
}

export async function createGroupPost(viewerId: string, groupId: string, input: { content: string; media?: Array<{ type: number; url: string }> }): Promise<SocialContent> {
  const viewer = graphQlLongLiteral(viewerId)
  const group = graphQlLongLiteral(groupId)
  const data = await gatewayGraphQl<{ createGroupPost: Record<string, unknown> }>(
    `mutation CreateGroupPost($content: String!, $media: [MediaInput!]) {
      createGroupPost(input: { authorId: ${viewer}, groupId: ${group}, content: $content, media: $media }) { ${CONTENT_FIELDS} }
    }`,
    input,
  )
  return contentFromGraphQl(data.createGroupPost)
}

export async function updatePost(postId: string, input: UpdatePostValues): Promise<SocialContent | null> {
  const post = graphQlLongLiteral(postId)
  const data = await gatewayGraphQl<{ updatePost: Record<string, unknown> | null }>(
    `mutation UpdatePost($privacy: Int, $content: String, $media: [MediaInput!]) {
      updatePost(input: { id: ${post}, privacy: $privacy, content: $content, media: $media }) { ${CONTENT_FIELDS} }
    }`,
    { ...input },
  )
  return data.updatePost ? contentFromGraphQl(data.updatePost) : null
}

export async function deleteContent(contentId: string): Promise<boolean> {
  const content = graphQlLongLiteral(contentId)
  const data = await gatewayGraphQl<{ deleteContent: boolean }>(`mutation { deleteContent(contentId: ${content}) }`)
  return data.deleteContent
}

export async function watchContent(viewerId: string, targetId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ watch: boolean }>(`mutation { watch(userId: ${viewer}, targetId: ${target}) }`)
  return data.watch
}

export async function tagUser(postId: string, userId: string): Promise<boolean> {
  const post = graphQlLongLiteral(postId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ tag: boolean }>(`mutation { tag(postId: ${post}, userId: ${user}) }`)
  return data.tag
}

export async function mentionUser(sourceId: string, userId: string): Promise<boolean> {
  const source = graphQlLongLiteral(sourceId)
  const user = graphQlLongLiteral(userId)
  const data = await gatewayGraphQl<{ mention: boolean }>(`mutation { mention(sourceId: ${source}, userId: ${user}) }`)
  return data.mention
}

async function getUserSummaryPage(field: 'storyViewers' | 'likedUsers' | 'taggedUsers' | 'mentionedUsers', argument: string, targetId: string, limit = 50, cursor: string | null = null): Promise<{ items: UserSummary[]; endCursor: string | null; hasNextPage: boolean }> {
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<Record<string, { items: Array<Record<string, unknown>>; endCursor: string | null; hasNextPage: boolean }>>(
    `query UserSummaryPage($limit: Int!, $cursor: String) {
      ${field}(${argument}: ${target}, limit: $limit, cursor: $cursor) { items { id name avatar isVerified } endCursor hasNextPage }
    }`,
    { limit, cursor },
  )
  return { ...data[field], items: data[field].items.map(summaryFromGraphQl) }
}

export function getStoryViewers(storyId: string, limit = 50, cursor: string | null = null) {
  return getUserSummaryPage('storyViewers', 'storyId', storyId, limit, cursor)
}

export function getLikedUsers(targetId: string, limit = 50, cursor: string | null = null) {
  return getUserSummaryPage('likedUsers', 'targetId', targetId, limit, cursor)
}

export function getTaggedUsers(postId: string, limit = 50, cursor: string | null = null) {
  return getUserSummaryPage('taggedUsers', 'postId', postId, limit, cursor)
}

export function getMentionedUsers(sourceId: string, limit = 50, cursor: string | null = null) {
  return getUserSummaryPage('mentionedUsers', 'sourceId', sourceId, limit, cursor)
}

export async function likeContent(viewerId: string, targetId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ like: boolean }>(`mutation { like(userId: ${viewer}, targetId: ${target}) }`)
  return data.like
}

export async function unlikeContent(viewerId: string, targetId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ unlike: boolean }>(`mutation { unlike(userId: ${viewer}, targetId: ${target}) }`)
  return data.unlike
}

export async function saveContent(viewerId: string, targetId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ save: boolean }>(`mutation { save(userId: ${viewer}, targetId: ${target}) }`)
  return data.save
}

export async function unsaveContent(viewerId: string, targetId: string): Promise<boolean> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ unsave: boolean }>(`mutation { unsave(userId: ${viewer}, targetId: ${target}) }`)
  return data.unsave
}

export async function createComment(viewerId: string, targetId: string, content: string): Promise<SocialContent> {
  const viewer = graphQlLongLiteral(viewerId)
  const target = graphQlLongLiteral(targetId)
  const data = await gatewayGraphQl<{ createComment: Record<string, unknown> }>(
    `mutation CreateComment($content: String!) {
      createComment(input: { authorId: ${viewer}, targetId: ${target}, content: $content }) { ${CONTENT_FIELDS} }
    }`,
    { content },
  )
  return contentFromGraphQl(data.createComment)
}

export async function sharePost(viewerId: string, sourceId: string, content: string, privacy: number): Promise<SocialContent> {
  const viewer = graphQlLongLiteral(viewerId)
  const source = graphQlLongLiteral(sourceId)
  const data = await gatewayGraphQl<{ sharePost: Record<string, unknown> }>(
    `mutation SharePost($content: String!, $privacy: Int!) {
      sharePost(input: { authorId: ${viewer}, sourceId: ${source}, content: $content, privacy: $privacy }) { ${CONTENT_FIELDS} }
    }`,
    { content, privacy },
  )
  return contentFromGraphQl(data.sharePost)
}

export const socialApi = {
  getProfile,
  getProfiles,
  getGroup,
  getGroups,
  getProfilePosts,
  getProfileReels,
  getOwnedMedia,
  getRelationProfiles,
  getProfileRelationshipState,
  getMemberGroups,
  getAdminGroups,
  getPendingGroupJoins,
  getGroupMembershipState,
  getGroupJoinRequests,
  getGroupMembers,
  getGroupAdmins,
  getGroupPosts,
  getGroupUserPosts,
  getContentEngagement,
  getComments,
  getSavedContent,
  getRecommendedReels,
  getReelCollection,
  updateProfile,
  sendFriendRequest,
  acceptFriendRequest,
  cancelFriendRequest,
  rejectFriendRequest,
  unfriend,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  createGroup,
  updateGroup,
  deleteGroup,
  changeUserAvatar,
  changeUserBackground,
  removeUserAvatar,
  removeUserBackground,
  changeGroupAvatar,
  changeGroupBackground,
  removeGroupAvatar,
  removeGroupBackground,
  recordGroupVisit,
  requestJoinGroup,
  cancelJoinGroupRequest,
  leaveGroup,
  approveGroupJoinRequest,
  rejectGroupJoinRequest,
  inviteGroupUser,
  removeGroupMember,
  addGroupMember,
  addGroupAdmin,
  removeGroupAdmin,
  createReel,
  createGroupPost,
  updatePost,
  deleteContent,
  watchContent,
  tagUser,
  mentionUser,
  getStoryViewers,
  getLikedUsers,
  getTaggedUsers,
  getMentionedUsers,
  likeContent,
  unlikeContent,
  saveContent,
  unsaveContent,
  createComment,
  sharePost,
}

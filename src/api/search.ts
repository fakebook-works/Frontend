import { gatewayGraphQl } from './client'
import type { GatewayPost, SharedPostSource } from './gatewayTypes'
import type { SocialContent, SocialGroup, SocialProfile } from './social'

export type SearchTab = 'posts' | 'people' | 'reels' | 'groups'
export type ProfileConnectionSearchType = 'friends' | 'following' | 'followers'

export type QuickSearchItem =
  | { kind: 'user'; id: string; referenceId: string; profile: SocialProfile; viewerIsSelf: boolean; viewerIsFriend: boolean; viewerIsFollowing: boolean }
  | { kind: 'group'; id: string; referenceId: string; group: SocialGroup; viewerIsMember: boolean }
export type QuickGroupSearchItem = Extract<QuickSearchItem, { kind: 'group' }>

export type SearchProfile = SocialProfile & { searchReferenceId: string }
export type SearchGroup = SocialGroup & { searchReferenceId: string }
export type SearchPost = GatewayPost & { searchReferenceId: string }
export type SearchReel = SocialContent & { searchReferenceId: string }

export interface SearchPageResult {
  tab: SearchTab
  page: number
  hasNextPage: boolean
  users: SearchProfile[]
  groups: SearchGroup[]
  posts: SearchPost[]
  reels: SearchReel[]
}

export interface GroupScopedSearchResult {
  page: number
  hasNextPage: boolean
  groups: SearchGroup[]
  posts: SearchPost[]
}

interface PageInfo {
  hasNextPage: boolean
}

interface SearchPostPage {
  items: Array<{ post: GatewayPost | null } | null>
  pageInfo: PageInfo
}

interface SearchReelGraphQl {
  id: string
  type: number
  content: string
  privacy: number
  create: string
  authorId: string
  media: Array<{ id: string; type: number; url: string }>
  aspectRatio?: number | null
  focalPointX?: number | null
  focalPointY?: number | null
}

interface SearchUserGraphQl {
  id: string
  name: string
  avatar: string
  bio: string
  isVerified: boolean
  friendCount: number
  followerCount: number
  followingCount: number
  privacy: number
}

interface SearchGroupGraphQl {
  id: string
  avatar: string
  background: string
  name: string
  bio: string
  privacy: number
  create: string
  memberCount: number
  adminCount: number
}

interface SearchAuthorGraphQl {
  id: string
  name: string
  avatar: string
  isVerified: boolean
}

const SEARCH_USER_FIELDS = `id name avatar bio isVerified friendCount followerCount followingCount privacy`
const SEARCH_GROUP_FIELDS = `id avatar background name bio privacy create memberCount adminCount`

function userFromSearch(value: SearchUserGraphQl): SocialProfile {
  return {
    id: String(value.id),
    username: value.name,
    email: '',
    displayName: value.name,
    avatarUrl: value.avatar || null,
    backgroundUrl: null,
    isVerified: value.isVerified,
    bio: value.bio || null,
    birthDate: null,
    gender: null,
    location: null,
    createdAt: '',
    friendCount: Number(value.friendCount),
    followerCount: Number(value.followerCount),
    followingCount: Number(value.followingCount),
    postCount: 0,
    privacy: Number(value.privacy),
  }
}

function groupFromSearch(value: SearchGroupGraphQl): SocialGroup {
  return {
    id: String(value.id),
    avatarUrl: value.avatar || null,
    backgroundUrl: value.background || null,
    name: value.name,
    bio: value.bio || null,
    privacy: Number(value.privacy),
    createdAt: value.create,
    memberCount: Number(value.memberCount),
    adminCount: Number(value.adminCount),
  }
}

const FEED_POST_FIELDS = `
  __typename
  id type content privacy create
  mentions { userId name available }
  taggedUsers { id name avatar isVerified }
  author { id name avatar isVerified canFollow }
  media { id type url }
  sharedSource {
    id isAvailable type content privacy create aspectRatio focalPointX focalPointY requiresGroupMembership
    mentions { userId name available }
    author { id name avatar isVerified }
    media { id type url }
    group { id name avatar background privacy memberCount viewerIsMember joinRequestPending }
  }
`
const GROUP_POST_FIELDS = `
  __typename
  id type content privacy create
  mentions { userId name available }
  taggedUsers { id name avatar isVerified }
  author { id name avatar isVerified canFollow }
  group { id name avatar canJoin }
  media { id type url }
  sharedSource {
    id isAvailable type content privacy create aspectRatio focalPointX focalPointY requiresGroupMembership
    mentions { userId name available }
    author { id name avatar isVerified }
    media { id type url }
    group { id name avatar background privacy memberCount viewerIsMember joinRequestPending }
  }
`

function normalizeSharedSource(source: SharedPostSource | null | undefined): SharedPostSource | null {
  if (!source) return null
  return {
    ...source,
    id: String(source.id),
    type: source.type == null ? null : Number(source.type),
    aspectRatio: source.aspectRatio == null ? null : Number(source.aspectRatio),
    focalPointX: source.focalPointX == null ? null : Number(source.focalPointX),
    focalPointY: source.focalPointY == null ? null : Number(source.focalPointY),
    author: source.author ? { ...source.author, id: String(source.author.id) } : null,
    media: (source.media ?? []).map((media) => ({ ...media, id: String(media.id), type: Number(media.type) })),
    mentions: source.mentions?.map((mention) => ({ ...mention, userId: String(mention.userId) })) ?? [],
    group: source.group ? { ...source.group, id: String(source.group.id) } : null,
  }
}

function normalizePost(post: GatewayPost): GatewayPost {
  const common = {
    ...post,
    id: String(post.id),
    author: { ...post.author, id: String(post.author.id) },
    media: post.media.map((media) => ({ ...media, id: String(media.id), type: Number(media.type) })),
    mentions: post.mentions?.map((mention) => ({ ...mention, userId: String(mention.userId) })) ?? [],
    taggedUsers: post.taggedUsers?.map((user) => ({ ...user, id: String(user.id) })) ?? [],
    sharedSource: normalizeSharedSource(post.sharedSource),
  }
  return post.__typename === 'GroupPostDetail'
    ? { ...common, __typename: 'GroupPostDetail', group: { ...post.group, id: String(post.group.id) } }
    : { ...common, __typename: 'FeedPostDetail' }
}

function isAccessControlError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { status?: unknown; code?: unknown }
  return value.status === 401
    || value.status === 403
    || value.code === 'UNAUTHENTICATED'
    || value.code === 'FORBIDDEN'
}

function resolveIndependentSearchBranches<A, B>(
  results: readonly [PromiseSettledResult<A>, PromiseSettledResult<B>],
): [A | null, B | null] {
  const accessError = results.find((result) => result.status === 'rejected' && isAccessControlError(result.reason))
  if (accessError?.status === 'rejected') throw accessError.reason

  const hasSuccessfulBranch = results.some((result) => result.status === 'fulfilled')
  if (!hasSuccessfulBranch) {
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    throw failure?.reason ?? new Error('Search request failed.')
  }

  return results.map((result) => result.status === 'fulfilled' ? result.value : null) as [A | null, B | null]
}

export async function fastSearch(keyword: string): Promise<QuickSearchItem[]> {
  const normalized = keyword.trim()
  if (normalized.length < 1) return []
  const data = await gatewayGraphQl<{ fastSearch: Array<
    | { __typename: 'UserSearchResult'; viewerIsSelf: boolean; viewerIsFriend: boolean; viewerIsFollowing: boolean; user: SearchUserGraphQl }
    | { __typename: 'GroupSearchResult'; viewerIsMember: boolean; group: SearchGroupGraphQl }
    | null
  > }>(
    `query FastSearch($keyword: String!) {
      fastSearch(keyword: $keyword) {
        __typename
        ... on UserSearchResult { viewerIsSelf viewerIsFriend viewerIsFollowing user { ${SEARCH_USER_FIELDS} } }
        ... on GroupSearchResult { viewerIsMember group { ${SEARCH_GROUP_FIELDS} } }
      }
    }`,
    { keyword: normalized },
  )
  return data.fastSearch.flatMap((item): QuickSearchItem[] => {
    if (!item) return []
    if (item.__typename === 'UserSearchResult') {
      const id = String(item.user.id)
      return [{ kind: 'user', id, referenceId: id, profile: userFromSearch(item.user), viewerIsSelf: item.viewerIsSelf, viewerIsFriend: item.viewerIsFriend, viewerIsFollowing: item.viewerIsFollowing }]
    }
    const id = String(item.group.id)
    return [{ kind: 'group', id, referenceId: id, group: groupFromSearch(item.group), viewerIsMember: item.viewerIsMember }]
  }).slice(0, 8)
}

export async function fastSearchGroups(keyword: string, pageSize = 8): Promise<QuickGroupSearchItem[]> {
  const normalized = keyword.trim()
  if (normalized.length < 1) return []
  const size = Math.max(1, Math.min(8, Math.trunc(pageSize)))
  const data = await gatewayGraphQl<{
    searchGroups: {
      items: Array<{ viewerIsMember: boolean; group: SearchGroupGraphQl } | null>
    }
  }>(
    `query FastSearchGroups($keyword: String!, $size: Int!) {
      searchGroups(keyword: $keyword, pageNumber: 1, pageSize: $size) {
        items { viewerIsMember group { ${SEARCH_GROUP_FIELDS} } }
      }
    }`,
    { keyword: normalized, size },
  )
  return data.searchGroups.items.flatMap((item): QuickGroupSearchItem[] => {
    if (!item) return []
    const group = groupFromSearch(item.group)
    return [{ kind: 'group', id: group.id, referenceId: group.id, group, viewerIsMember: item.viewerIsMember }]
  }).slice(0, size)
}

export async function searchGroupScope(keyword: string, page = 1, pageSize = 20): Promise<GroupScopedSearchResult> {
  const normalized = keyword.trim()
  const safePage = Math.max(1, Math.min(1_000_000, Math.trunc(page)))
  const size = Math.max(1, Math.min(50, Math.trunc(pageSize)))
  const empty: GroupScopedSearchResult = { page: safePage, hasNextPage: false, groups: [], posts: [] }
  if (normalized.length < 1) return empty

  const [groupResult, postResult] = resolveIndependentSearchBranches(await Promise.allSettled([
    gatewayGraphQl<{ searchGroups: { items: Array<{ group: SearchGroupGraphQl } | null>; pageInfo: PageInfo } }>(
      `query SearchGroupScopeGroups($keyword: String!, $page: Int!, $size: Int!) {
      searchGroups(keyword: $keyword, pageNumber: $page, pageSize: $size) {
        items { group { ${SEARCH_GROUP_FIELDS} } }
        pageInfo { hasNextPage }
      }
    }`,
      { keyword: normalized, page: safePage, size },
    ),
    gatewayGraphQl<{ searchGroupPosts: SearchPostPage }>(
      `query SearchGroupScopePosts($keyword: String!, $page: Int!, $size: Int!) {
        searchGroupPosts(keyword: $keyword, pageNumber: $page, pageSize: $size) {
        items { post { ${GROUP_POST_FIELDS} } }
        pageInfo { hasNextPage }
      }
    }`,
      { keyword: normalized, page: safePage, size },
    ),
  ] as const))
  const groups = (groupResult?.searchGroups.items ?? []).flatMap((item): SearchGroup[] => {
    if (!item) return []
    const group = groupFromSearch(item.group)
    return [{ ...group, searchReferenceId: group.id }]
  })
  const posts = (postResult?.searchGroupPosts.items ?? []).flatMap((item): SearchPost[] => {
    if (!item?.post || item.post.__typename !== 'GroupPostDetail') return []
    return [{ ...normalizePost(item.post), searchReferenceId: String(item.post.id) }]
  })
  return {
    page: safePage,
    hasNextPage: Boolean(groupResult?.searchGroups.pageInfo.hasNextPage || postResult?.searchGroupPosts.pageInfo.hasNextPage),
    groups,
    posts,
  }
}

export async function search(keyword: string, tab: SearchTab, page = 1, pageSize = 20): Promise<SearchPageResult> {
  const normalized = keyword.trim()
  const empty: SearchPageResult = { tab, page, hasNextPage: false, users: [], groups: [], posts: [], reels: [] }
  if (normalized.length < 1) return empty

  if (tab === 'people') {
    const data = await gatewayGraphQl<{ searchUsers: { items: Array<{ user: SearchUserGraphQl } | null>; pageInfo: PageInfo } }>(
      `query SearchUsers($keyword: String!, $page: Int!, $size: Int!) {
        searchUsers(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { user { ${SEARCH_USER_FIELDS} } } pageInfo { hasNextPage } }
      }`,
      { keyword: normalized, page, size: pageSize },
    )
    const users = data.searchUsers.items.flatMap((item): SearchProfile[] => {
      if (!item) return []
      const profile = userFromSearch(item.user)
      return [{ ...profile, searchReferenceId: profile.id }]
    })
    return { ...empty, hasNextPage: data.searchUsers.pageInfo.hasNextPage, users }
  }

  if (tab === 'groups') {
    const data = await gatewayGraphQl<{ searchGroups: { items: Array<{ group: SearchGroupGraphQl } | null>; pageInfo: PageInfo } }>(
      `query SearchGroups($keyword: String!, $page: Int!, $size: Int!) {
        searchGroups(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { group { ${SEARCH_GROUP_FIELDS} } } pageInfo { hasNextPage } }
      }`,
      { keyword: normalized, page, size: pageSize },
    )
    const hydrated = data.searchGroups.items.flatMap((item): SearchGroup[] => {
      if (!item) return []
      const group = groupFromSearch(item.group)
      return [{ ...group, searchReferenceId: group.id }]
    })
    return { ...empty, hasNextPage: data.searchGroups.pageInfo.hasNextPage, groups: hydrated }
  }

  if (tab === 'reels') {
    const data = await gatewayGraphQl<{ searchReels: { items: Array<{ reel: SearchReelGraphQl; author: SearchAuthorGraphQl } | null>; pageInfo: PageInfo } }>(
      `query SearchReels($keyword: String!, $page: Int!, $size: Int!) {
        searchReels(keyword: $keyword, pageNumber: $page, pageSize: $size) {
          items { reel { id type content privacy create authorId media { id type url } aspectRatio focalPointX focalPointY } author { id name avatar isVerified } }
          pageInfo { hasNextPage }
        }
      }`,
      { keyword: normalized, page, size: pageSize },
    )
    const reels: SearchReel[] = data.searchReels.items.flatMap((item) => item ? [{
      id: String(item.reel.id),
      type: Number(item.reel.type),
      content: item.reel.content,
      privacy: item.reel.privacy,
      createdAt: item.reel.create,
      authorId: String(item.reel.authorId),
      media: item.reel.media.map((media) => ({ ...media, id: String(media.id), type: Number(media.type) })),
      aspectRatio: item.reel.aspectRatio == null ? null : Number(item.reel.aspectRatio),
      focalPointX: item.reel.focalPointX == null ? null : Number(item.reel.focalPointX),
      focalPointY: item.reel.focalPointY == null ? null : Number(item.reel.focalPointY),
      searchReferenceId: String(item.reel.id),
      author: {
        id: String(item.author.id),
        username: item.author.name,
        displayName: item.author.name,
        avatarUrl: item.author.avatar || null,
        isVerified: item.author.isVerified,
      },
    }] : [])
    return { ...empty, hasNextPage: data.searchReels.pageInfo.hasNextPage, reels }
  }

  const size = Math.max(1, Math.ceil(pageSize / 2))
  const [feedResult, groupResult] = resolveIndependentSearchBranches(await Promise.allSettled([
    gatewayGraphQl<{ searchFeedPosts: SearchPostPage }>(
      `query SearchFeedPosts($keyword: String!, $page: Int!, $size: Int!) {
      searchFeedPosts(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { post { ${FEED_POST_FIELDS} } } pageInfo { hasNextPage } }
    }`,
      { keyword: normalized, page, size },
    ),
    gatewayGraphQl<{ searchGroupPosts: SearchPostPage }>(
      `query SearchGroupPosts($keyword: String!, $page: Int!, $size: Int!) {
        searchGroupPosts(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { post { ${GROUP_POST_FIELDS} } } pageInfo { hasNextPage } }
      }`,
      { keyword: normalized, page, size },
    ),
  ] as const))
  const posts = [
    ...(feedResult?.searchFeedPosts.items ?? []),
    ...(groupResult?.searchGroupPosts.items ?? []),
  ].flatMap((item): SearchPost[] => item?.post ? [{ ...normalizePost(item.post), searchReferenceId: String(item.post.id) }] : [])
  return {
    ...empty,
    hasNextPage: Boolean(feedResult?.searchFeedPosts.pageInfo.hasNextPage || groupResult?.searchGroupPosts.pageInfo.hasNextPage),
    posts,
  }
}

export async function searchDirectContacts(keyword: string, page = 1, pageSize = 20): Promise<SocialProfile[]> {
  const normalized = keyword.trim()
  if (normalized.length < 1) return []
  const data = await gatewayGraphQl<{
    searchDirectContacts: { items: Array<{ user: SearchUserGraphQl } | null> }
  }>(
    `query SearchDirectContacts($keyword: String!, $page: Int!, $size: Int!) {
      searchDirectContacts(keyword: $keyword, pageNumber: $page, pageSize: $size) {
        items { user { ${SEARCH_USER_FIELDS} } }
      }
    }`,
    { keyword: normalized, page, size: pageSize },
  )
  return data.searchDirectContacts.items.flatMap((item) => item ? [userFromSearch(item.user)] : [])
}

export async function searchFriends(keyword: string, page = 1, pageSize = 20): Promise<SocialProfile[]> {
  const normalized = keyword.trim()
  if (normalized.length < 1) return []
  const data = await gatewayGraphQl<{
    searchFriends: { items: Array<{ user: SearchUserGraphQl } | null> }
  }>(
    `query SearchFriends($keyword: String!, $page: Int!, $size: Int!) {
      searchFriends(keyword: $keyword, pageNumber: $page, pageSize: $size) {
        items { user { ${SEARCH_USER_FIELDS} } }
      }
    }`,
    { keyword: normalized, page, size: pageSize },
  )
  return data.searchFriends.items.flatMap((item) => item ? [userFromSearch(item.user)] : [])
}

export async function searchProfileConnections(
  connectionType: ProfileConnectionSearchType,
  keyword: string,
  page = 1,
  pageSize = 100,
): Promise<SocialProfile[]> {
  const normalized = keyword.trim()
  if (normalized.length < 1) return []
  const type = connectionType === 'friends' ? 'FRIENDS' : connectionType === 'following' ? 'FOLLOWING' : 'FOLLOWERS'
  const data = await gatewayGraphQl<{
    searchProfileConnections: { items: Array<{ user: SearchUserGraphQl } | null> }
  }>(
    `query SearchProfileConnections($keyword: String!, $type: ProfileConnectionType!, $page: Int!, $size: Int!) {
      searchProfileConnections(keyword: $keyword, connectionType: $type, pageNumber: $page, pageSize: $size) {
        items { user { ${SEARCH_USER_FIELDS} } }
      }
    }`,
    { keyword: normalized, type, page, size: pageSize },
  )
  return data.searchProfileConnections.items.flatMap((item) => item ? [userFromSearch(item.user)] : [])
}

export async function recordSearchResultView(referenceId: string): Promise<boolean> {
  const data = await gatewayGraphQl<{ recordSearchResultView: boolean }>(
    `mutation RecordSearchResultView($referenceId: ID!) { recordSearchResultView(referenceId: $referenceId) }`,
    { referenceId },
  )
  return data.recordSearchResultView
}

export const searchApi = { fastSearch, fastSearchGroups, search, searchGroupScope, searchDirectContacts, searchFriends, searchProfileConnections, recordSearchResultView }

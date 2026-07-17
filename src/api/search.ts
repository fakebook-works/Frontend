import { gatewayGraphQl } from './client'
import type { GatewayPost } from './gatewayTypes'
import type { SocialContent, SocialGroup, SocialProfile } from './social'

export type SearchTab = 'posts' | 'people' | 'reels' | 'groups'

export type QuickSearchItem =
  | { kind: 'user'; id: string; referenceId: string; profile: SocialProfile }
  | { kind: 'group'; id: string; referenceId: string; group: SocialGroup }

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

interface PageInfo {
  hasNextPage: boolean
}

interface SearchReelGraphQl {
  id: string
  type: number
  content: string
  privacy: number
  create: string
  authorId: string
  media: Array<{ id: string; type: number; url: string }>
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
  author { id name avatar isVerified canFollow }
  media { id type url }
`
const GROUP_POST_FIELDS = `
  __typename
  id type content privacy create
  author { id name avatar isVerified canFollow }
  group { id name avatar canJoin }
  media { id type url }
`

function normalizePost(post: GatewayPost): GatewayPost {
  const common = {
    ...post,
    id: String(post.id),
    author: { ...post.author, id: String(post.author.id) },
    media: post.media.map((media) => ({ ...media, id: String(media.id), type: Number(media.type) })),
  }
  return post.__typename === 'GroupPostDetail'
    ? { ...common, __typename: 'GroupPostDetail', group: { ...post.group, id: String(post.group.id) } }
    : { ...common, __typename: 'FeedPostDetail' }
}

export async function fastSearch(keyword: string): Promise<QuickSearchItem[]> {
  const normalized = keyword.trim()
  if (normalized.length < 2) return []
  const data = await gatewayGraphQl<{ fastSearch: Array<
    | { __typename: 'UserSearchResult'; user: SearchUserGraphQl }
    | { __typename: 'GroupSearchResult'; group: SearchGroupGraphQl }
    | null
  > }>(
    `query FastSearch($keyword: String!) {
      fastSearch(keyword: $keyword) {
        __typename
        ... on UserSearchResult { user { ${SEARCH_USER_FIELDS} } }
        ... on GroupSearchResult { group { ${SEARCH_GROUP_FIELDS} } }
      }
    }`,
    { keyword: normalized },
  )
  return data.fastSearch.flatMap((item): QuickSearchItem[] => {
    if (!item) return []
    if (item.__typename === 'UserSearchResult') {
      const id = String(item.user.id)
      return [{ kind: 'user', id, referenceId: id, profile: userFromSearch(item.user) }]
    }
    const id = String(item.group.id)
    return [{ kind: 'group', id, referenceId: id, group: groupFromSearch(item.group) }]
  }).slice(0, 8)
}

export async function search(keyword: string, tab: SearchTab, page = 1, pageSize = 20): Promise<SearchPageResult> {
  const normalized = keyword.trim()
  const empty: SearchPageResult = { tab, page, hasNextPage: false, users: [], groups: [], posts: [], reels: [] }
  if (normalized.length < 2) return empty

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
          items { reel { id type content privacy create authorId media { id type url } } author { id name avatar isVerified } }
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

  const data = await gatewayGraphQl<{
    searchFeedPosts: { items: Array<{ post: GatewayPost | null }>; pageInfo: PageInfo }
    searchGroupPosts: { items: Array<{ post: GatewayPost | null }>; pageInfo: PageInfo }
  }>(
    `query SearchPosts($keyword: String!, $page: Int!, $size: Int!) {
      searchFeedPosts(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { post { ${FEED_POST_FIELDS} } } pageInfo { hasNextPage } }
      searchGroupPosts(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { post { ${GROUP_POST_FIELDS} } } pageInfo { hasNextPage } }
    }`,
    { keyword: normalized, page, size: Math.max(1, Math.ceil(pageSize / 2)) },
  )
  const posts = [...data.searchFeedPosts.items, ...data.searchGroupPosts.items].flatMap((item): SearchPost[] => item.post ? [{ ...normalizePost(item.post), searchReferenceId: String(item.post.id) }] : [])
  return {
    ...empty,
    hasNextPage: data.searchFeedPosts.pageInfo.hasNextPage || data.searchGroupPosts.pageInfo.hasNextPage,
    posts,
  }
}

export async function recordSearchResultView(referenceId: string): Promise<boolean> {
  const data = await gatewayGraphQl<{ recordSearchResultView: boolean }>(
    `mutation RecordSearchResultView($referenceId: ID!) { recordSearchResultView(referenceId: $referenceId) }`,
    { referenceId },
  )
  return data.recordSearchResultView
}

export const searchApi = { fastSearch, search, recordSearchResultView }

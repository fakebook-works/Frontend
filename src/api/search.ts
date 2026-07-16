import { gatewayGraphQl } from './client'
import type { GatewayPost } from './gatewayTypes'
import { socialApi, type SocialContent, type SocialGroup, type SocialProfile } from './social'

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
    | { __typename: 'UserSearchResult'; user: { id: string } }
    | { __typename: 'GroupSearchResult'; group: { id: string } }
  > }>(
    `query FastSearch($keyword: String!) {
      fastSearch(keyword: $keyword) {
        __typename
        ... on UserSearchResult { user { id } }
        ... on GroupSearchResult { group { id } }
      }
    }`,
    { keyword: normalized },
  )
  const userIds = data.fastSearch.flatMap((item) => item.__typename === 'UserSearchResult' ? [String(item.user.id)] : [])
  const groupIds = data.fastSearch.flatMap((item) => item.__typename === 'GroupSearchResult' ? [String(item.group.id)] : [])
  const [users, groups] = await Promise.all([socialApi.getProfiles(userIds), socialApi.getGroups(groupIds)])
  const userMap = new Map(users.map((item) => [item.id, item]))
  const groupMap = new Map(groups.map((item) => [item.id, item]))
  return data.fastSearch.flatMap((item): QuickSearchItem[] => {
    if (item.__typename === 'UserSearchResult') {
      const id = String(item.user.id)
      const profile = userMap.get(id)
      return profile ? [{ kind: 'user', id, referenceId: id, profile }] : []
    }
    const id = String(item.group.id)
    const group = groupMap.get(id)
    return group ? [{ kind: 'group', id, referenceId: id, group }] : []
  }).slice(0, 8)
}

export async function search(keyword: string, tab: SearchTab, page = 1, pageSize = 20): Promise<SearchPageResult> {
  const normalized = keyword.trim()
  const empty: SearchPageResult = { tab, page, hasNextPage: false, users: [], groups: [], posts: [], reels: [] }
  if (normalized.length < 2) return empty

  if (tab === 'people') {
    const data = await gatewayGraphQl<{ searchUsers: { items: Array<{ user: { id: string } }>; pageInfo: PageInfo } }>(
      `query SearchUsers($keyword: String!, $page: Int!, $size: Int!) {
        searchUsers(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { user { id } } pageInfo { hasNextPage } }
      }`,
      { keyword: normalized, page, size: pageSize },
    )
    const profiles = await socialApi.getProfiles(data.searchUsers.items.map((item) => String(item.user.id)))
    const byId = new Map(profiles.map((profile) => [profile.id, profile]))
    const users = data.searchUsers.items.flatMap((item): SearchProfile[] => {
      const profile = byId.get(String(item.user.id))
      return profile ? [{ ...profile, searchReferenceId: String(item.user.id) }] : []
    })
    return { ...empty, hasNextPage: data.searchUsers.pageInfo.hasNextPage, users }
  }

  if (tab === 'groups') {
    const data = await gatewayGraphQl<{ searchGroups: { items: Array<{ group: { id: string } }>; pageInfo: PageInfo } }>(
      `query SearchGroups($keyword: String!, $page: Int!, $size: Int!) {
        searchGroups(keyword: $keyword, pageNumber: $page, pageSize: $size) { items { group { id } } pageInfo { hasNextPage } }
      }`,
      { keyword: normalized, page, size: pageSize },
    )
    const groups = await socialApi.getGroups(data.searchGroups.items.map((item) => String(item.group.id)))
    const byId = new Map(groups.map((group) => [group.id, group]))
    const hydrated = data.searchGroups.items.flatMap((item): SearchGroup[] => {
      const group = byId.get(String(item.group.id))
      return group ? [{ ...group, searchReferenceId: String(item.group.id) }] : []
    })
    return { ...empty, hasNextPage: data.searchGroups.pageInfo.hasNextPage, groups: hydrated }
  }

  if (tab === 'reels') {
    const data = await gatewayGraphQl<{ searchReels: { items: Array<{ reel: SearchReelGraphQl | null }>; pageInfo: PageInfo } }>(
      `query SearchReels($keyword: String!, $page: Int!, $size: Int!) {
        searchReels(keyword: $keyword, pageNumber: $page, pageSize: $size) {
          items { reel { id type content privacy create authorId media { id type url } } }
          pageInfo { hasNextPage }
        }
      }`,
      { keyword: normalized, page, size: pageSize },
    )
    const reels: SearchReel[] = data.searchReels.items.flatMap((item) => item.reel ? [{
      id: String(item.reel.id),
      type: Number(item.reel.type),
      content: item.reel.content,
      privacy: item.reel.privacy,
      createdAt: item.reel.create,
      authorId: String(item.reel.authorId),
      media: item.reel.media.map((media) => ({ ...media, id: String(media.id), type: Number(media.type) })),
      searchReferenceId: String(item.reel.id),
    }] : [])
    const authors = await socialApi.getProfiles(reels.map((reel) => reel.authorId)).catch(() => [])
    const byId = new Map(authors.map((profile) => [profile.id, { id: profile.id, username: profile.username, displayName: profile.displayName, avatarUrl: profile.avatarUrl, isVerified: profile.isVerified }]))
    return { ...empty, hasNextPage: data.searchReels.pageInfo.hasNextPage, reels: reels.map((reel) => ({ ...reel, author: byId.get(reel.authorId) ?? null })) }
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

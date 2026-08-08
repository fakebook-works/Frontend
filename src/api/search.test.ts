// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayGraphQl = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({ gatewayGraphQl, graphQlLongLiteral: (value: string) => value }))

import { searchApi } from './search'

describe('Search Gateway adapter', () => {
  beforeEach(() => {
    gatewayGraphQl.mockReset()
  })

  it('hydrates composed fast-search entities and preserves ranking order', async () => {
    gatewayGraphQl.mockResolvedValue({ fastSearch: [
      { __typename: 'GroupSearchResult', viewerIsMember: true, group: { id: '20', avatar: '', background: '', name: 'Group', bio: '', privacy: 0, create: '', memberCount: 2, adminCount: 1 } },
      { __typename: 'UserSearchResult', viewerIsSelf: false, viewerIsFriend: true, viewerIsFollowing: false, user: { id: '10', name: 'User', avatar: '', bio: '', isVerified: false, friendCount: 4, followerCount: 7, followingCount: 3, privacy: 1 } },
    ] })

    const results = await searchApi.fastSearch('fakebook')

    expect(results.map((item) => `${item.kind}:${item.id}`)).toEqual(['group:20', 'user:10'])
    expect(results.map((item) => item.referenceId)).toEqual(['20', '10'])
    expect(results[0].kind === 'group' && results[0].viewerIsMember).toBe(true)
    expect(results[1].kind === 'user' && results[1].viewerIsFriend).toBe(true)
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('user { id name avatar bio isVerified friendCount followerCount followingCount privacy }')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('viewerIsSelf viewerIsFriend viewerIsFollowing')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('viewerIsMember')
    expect(results[1].kind === 'user' && results[1].profile.followerCount).toBe(7)
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('referenceId')
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
  })

  it('queries fast search from the first non-space character', async () => {
    gatewayGraphQl.mockResolvedValue({ fastSearch: [] })

    expect(await searchApi.fastSearch('a')).toEqual([])
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 'a' })
  })

  it('rejects search text above 200 characters before reaching Gateway', async () => {
    await expect(searchApi.fastSearch('x'.repeat(201))).rejects.toMatchObject({ code: 'too_long', field: 'search' })
    expect(gatewayGraphQl).not.toHaveBeenCalled()
  })

  it('runs the Groups sidebar quick search against group references only', async () => {
    gatewayGraphQl.mockResolvedValue({ searchGroups: { items: [{
      viewerIsMember: true,
      group: { id: '20', avatar: '', background: '', name: 'Group', bio: '', privacy: 0, create: '', memberCount: 2, adminCount: 1 },
    }] } })

    const results = await searchApi.fastSearchGroups(' group ')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ kind: 'group', id: '20', referenceId: '20', viewerIsMember: true })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('searchGroups')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('fastSearch(')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('searchUsers')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 'group', size: 8 })
  })

  it('searches groups and visible group posts through independent parameterized Gateway documents', async () => {
    const keyword = 'x") { __typename }'
    gatewayGraphQl.mockResolvedValue({
      searchGroups: {
        items: [{ group: { id: '20', avatar: '', background: '', name: 'Group', bio: '', privacy: 0, create: '', memberCount: 2, adminCount: 1 } }],
        pageInfo: { hasNextPage: false },
      },
      searchGroupPosts: {
        items: [{ post: {
          __typename: 'GroupPostDetail', id: '30', type: 3, content: 'Group post', privacy: 0, create: '',
          author: { id: '10', name: 'User', avatar: '', isVerified: false, canFollow: false },
          group: { id: '20', name: 'Group', avatar: '', canJoin: false }, media: [],
        } }],
        pageInfo: { hasNextPage: false },
      },
    })

    const result = await searchApi.searchGroupScope(keyword, 1, 20)
    const documents = gatewayGraphQl.mock.calls.map(([document]) => document as string)
    const variables = gatewayGraphQl.mock.calls.map(([, value]) => value)

    expect(result.groups.map((group) => group.id)).toEqual(['20'])
    expect(result.posts.map((post) => post.id)).toEqual(['30'])
    expect(documents).toHaveLength(2)
    expect(documents.some((document) => document.includes('searchGroups'))).toBe(true)
    expect(documents.some((document) => document.includes('searchGroupPosts'))).toBe(true)
    expect(documents.every((document) => !document.includes('searchFeedPosts'))).toBe(true)
    expect(documents.every((document) => !document.includes(keyword))).toBe(true)
    expect(variables).toEqual([
      { keyword, page: 1, size: 20 },
      { keyword, page: 1, size: 20 },
    ])
  })

  it('ignores denied or stale nullable post lookups instead of throwing', async () => {
    gatewayGraphQl.mockResolvedValue({
      searchFeedPosts: { items: [null, { post: null }], pageInfo: { hasNextPage: false } },
      searchGroupPosts: { items: [null], pageInfo: { hasNextPage: false } },
    })

    await expect(searchApi.search('hidden', 'posts')).resolves.toMatchObject({ posts: [], hasNextPage: false })
  })

  it('keeps visible feed posts when the independent group-post search fails', async () => {
    gatewayGraphQl.mockImplementation((document: string) => {
      if (document.includes('SearchFeedPosts')) {
        return Promise.resolve({ searchFeedPosts: { items: [{ post: {
          __typename: 'FeedPostDetail', id: '31', type: 1, content: 'Visible feed post', privacy: 0, create: '',
          author: { id: '10', name: 'User', avatar: '', isVerified: false, canFollow: false }, media: [],
        } }], pageInfo: { hasNextPage: true } } })
      }
      return Promise.reject(new Error('Group post branch unavailable'))
    })

    await expect(searchApi.search('visible', 'posts')).resolves.toMatchObject({
      posts: [{ id: '31', searchReferenceId: '31' }],
      hasNextPage: true,
    })
    expect(gatewayGraphQl).toHaveBeenCalledTimes(2)
  })

  it('keeps visible group posts when the independent feed-post search fails', async () => {
    gatewayGraphQl.mockImplementation((document: string) => {
      if (document.includes('SearchGroupPosts')) {
        return Promise.resolve({ searchGroupPosts: { items: [{ post: {
          __typename: 'GroupPostDetail', id: '32', type: 3, content: 'Visible group post', privacy: 0, create: '',
          author: { id: '10', name: 'User', avatar: '', isVerified: false, canFollow: false },
          group: { id: '20', name: 'Group', avatar: '', canJoin: false }, media: [],
        } }], pageInfo: { hasNextPage: false } } })
      }
      return Promise.reject(new Error('Feed post branch unavailable'))
    })

    await expect(searchApi.search('visible', 'posts')).resolves.toMatchObject({
      posts: [{ id: '32', searchReferenceId: '32' }],
      hasNextPage: false,
    })
  })

  it('fails post search when every independent branch fails', async () => {
    gatewayGraphQl.mockRejectedValue(new Error('Search unavailable'))

    await expect(searchApi.search('failure', 'posts')).rejects.toThrow('Search unavailable')
  })

  it('never hides an authentication or authorization failure behind partial post results', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403, code: 'FORBIDDEN' })
    gatewayGraphQl.mockImplementation((document: string) => document.includes('SearchFeedPosts')
      ? Promise.resolve({ searchFeedPosts: { items: [], pageInfo: { hasNextPage: false } } })
      : Promise.reject(forbidden))

    await expect(searchApi.search('private', 'posts')).rejects.toBe(forbidden)
  })

  it('runs full search from a one-character keyword', async () => {
    gatewayGraphQl.mockResolvedValue({ searchUsers: { items: [], pageInfo: { hasNextPage: false } } })

    const result = await searchApi.search(' a ', 'people')

    expect(result).toMatchObject({ tab: 'people', users: [], page: 1 })
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 'a', page: 1, size: 20 })
  })

  it('clamps full-search pagination before sending variables to Gateway', async () => {
    gatewayGraphQl.mockResolvedValue({ searchUsers: { items: [], pageInfo: { hasNextPage: false } } })

    const result = await searchApi.search('people', 'people', 0, 500)

    expect(result.page).toBe(1)
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 'people', page: 1, size: 50 })
  })

  it('searches only direct Messenger contacts from the first character', async () => {
    gatewayGraphQl.mockResolvedValue({ searchDirectContacts: { items: [{ user: {
      id: '10', name: 'Contact User', avatar: '', bio: '', isVerified: false,
      friendCount: 0, followerCount: 0, followingCount: 0, privacy: 0,
    } }] } })

    const result = await searchApi.searchDirectContacts(' c ')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: '10', displayName: 'Contact User' })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('searchDirectContacts')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 'c', page: 1, size: 20 })
  })

  it('searches only accepted friends from the first character', async () => {
    gatewayGraphQl.mockResolvedValue({ searchFriends: { items: [{ user: {
      id: '11', name: 'Friend User', avatar: '', bio: '', isVerified: true,
      friendCount: 1, followerCount: 0, followingCount: 0, privacy: 0,
    } }] } })

    const result = await searchApi.searchFriends(' f ')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: '11', displayName: 'Friend User', isVerified: true })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('searchFriends')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 'f', page: 1, size: 20 })
  })

  it.each([
    ['friends', 'FRIENDS'],
    ['following', 'FOLLOWING'],
    ['followers', 'FOLLOWERS'],
  ] as const)('searches the selected %s profile connection through Search and Gateway', async (connectionType, graphQlType) => {
    gatewayGraphQl.mockResolvedValue({ searchProfileConnections: { items: [{ user: {
      id: '12', name: 'Scoped User', avatar: '', bio: '', isVerified: false,
      friendCount: 0, followerCount: 0, followingCount: 0, privacy: 0,
    } }] } })

    const result = await searchApi.searchProfileConnections(connectionType, ' s ')

    expect(result[0]).toMatchObject({ id: '12', displayName: 'Scoped User' })
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('searchProfileConnections')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 's', type: graphQlType, page: 1, size: 100 })
  })

  it('records a trusted viewer opening a search result through the Gateway mutation', async () => {
    gatewayGraphQl.mockResolvedValue({ recordSearchResultView: true })

    await expect(searchApi.recordSearchResultView('search-reference-1')).resolves.toBe(true)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('recordSearchResultView(referenceId: $referenceId)')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ referenceId: 'search-reference-1' })
  })
})

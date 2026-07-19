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
      { __typename: 'GroupSearchResult', group: { id: '20', avatar: '', background: '', name: 'Group', bio: '', privacy: 0, create: '', memberCount: 2, adminCount: 1 } },
      { __typename: 'UserSearchResult', user: { id: '10', name: 'User', avatar: '', bio: '', isVerified: false, friendCount: 4, followerCount: 7, followingCount: 3, privacy: 1 } },
    ] })

    const results = await searchApi.fastSearch('fakebook')

    expect(results.map((item) => `${item.kind}:${item.id}`)).toEqual(['group:20', 'user:10'])
    expect(results.map((item) => item.referenceId)).toEqual(['20', '10'])
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('user { id name avatar bio isVerified friendCount followerCount followingCount privacy }')
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

  it('runs full search from a one-character keyword', async () => {
    gatewayGraphQl.mockResolvedValue({ searchUsers: { items: [], pageInfo: { hasNextPage: false } } })

    const result = await searchApi.search(' a ', 'people')

    expect(result).toMatchObject({ tab: 'people', users: [], page: 1 })
    expect(gatewayGraphQl).toHaveBeenCalledTimes(1)
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ keyword: 'a', page: 1, size: 20 })
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

  it('records a trusted viewer opening a search result through the Gateway mutation', async () => {
    gatewayGraphQl.mockResolvedValue({ recordSearchResultView: true })

    await expect(searchApi.recordSearchResultView('search-reference-1')).resolves.toBe(true)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('recordSearchResultView(referenceId: $referenceId)')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ referenceId: 'search-reference-1' })
  })
})

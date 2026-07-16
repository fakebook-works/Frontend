// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayGraphQl = vi.hoisted(() => vi.fn())
const getProfiles = vi.hoisted(() => vi.fn())
const getGroups = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({ gatewayGraphQl, graphQlLongLiteral: (value: string) => value }))
vi.mock('./social', () => ({ socialApi: { getProfiles, getGroups } }))

import { searchApi } from './search'

describe('Search Gateway adapter', () => {
  beforeEach(() => {
    gatewayGraphQl.mockReset()
    getProfiles.mockReset()
    getGroups.mockReset()
  })

  it('hydrates composed fast-search entities and preserves ranking order', async () => {
    gatewayGraphQl.mockResolvedValue({ fastSearch: [
      { __typename: 'GroupSearchResult', group: { id: '20' } },
      { __typename: 'UserSearchResult', user: { id: '10' } },
    ] })
    getProfiles.mockResolvedValue([{ id: '10', displayName: 'User' }])
    getGroups.mockResolvedValue([{ id: '20', name: 'Group' }])

    const results = await searchApi.fastSearch('fakebook')

    expect(results.map((item) => `${item.kind}:${item.id}`)).toEqual(['group:20', 'user:10'])
    expect(results.map((item) => item.referenceId)).toEqual(['20', '10'])
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('user { id }')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('referenceId')
  })

  it('does not query the service for one-character input', async () => {
    expect(await searchApi.fastSearch('a')).toEqual([])
    expect(gatewayGraphQl).not.toHaveBeenCalled()
  })

  it('records a trusted viewer opening a search result through the Gateway mutation', async () => {
    gatewayGraphQl.mockResolvedValue({ recordSearchResultView: true })

    await expect(searchApi.recordSearchResultView('search-reference-1')).resolves.toBe(true)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('recordSearchResultView(referenceId: $referenceId)')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ referenceId: 'search-reference-1' })
  })
})

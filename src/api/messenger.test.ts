// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayGraphQl = vi.hoisted(() => vi.fn())
const getProfiles = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({
  gatewayGraphQl,
  graphQlLongLiteral: (value: string) => {
    if (!/^[1-9]\d*$/.test(value)) throw new Error('invalid id')
    return value
  },
}))
vi.mock('./realtime', () => ({ subscribeGatewayGraphQl: vi.fn() }))
vi.mock('./social', () => ({ socialApi: { getProfiles } }))

import { createGroupConversation } from './messenger'

describe('messenger GraphQL adapter', () => {
  beforeEach(() => {
    gatewayGraphQl.mockReset()
    getProfiles.mockReset().mockResolvedValue([])
  })

  it('creates a group with lossless Long literals and maps participant roles', async () => {
    gatewayGraphQl.mockResolvedValue({
      createGroupConversation: {
        id: 'conversation-1',
        type: 'GROUP',
        title: 'Weekend plans',
        avatarUrl: null,
        updatedAt: '2026-07-16T00:00:00Z',
        currentSequence: '0',
        participants: [
          { userId: '9007199254740993123', role: 'ADMIN', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '9007199254740993123', name: 'Me', avatar: '', isVerified: false } },
          { userId: '9007199254740993124', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '9007199254740993124', name: 'Friend A', avatar: '', isVerified: false } },
          { userId: '9007199254740993125', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '9007199254740993125', name: 'Friend B', avatar: '', isVerified: false } },
        ],
        lastMessage: null,
      },
    })

    const result = await createGroupConversation(
      'Weekend plans',
      ['9007199254740993124', '9007199254740993125'],
      '9007199254740993123',
    )

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('memberUserIds: [9007199254740993124, 9007199254740993125]')
    expect(result.type).toBe('GROUP')
    expect(result.participants[0]).toMatchObject({ id: '9007199254740993123', role: 'ADMIN' })
    expect(result.participants[1]).toMatchObject({ id: '9007199254740993124', role: 'MEMBER' })
  })

  it('rejects a group with fewer than two friends before network I/O', async () => {
    await expect(createGroupConversation('Too small', ['2'], '1')).rejects.toThrow()
    expect(gatewayGraphQl).not.toHaveBeenCalled()
  })
})

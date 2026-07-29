// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  api,
  clearAuth,
  gatewayGraphQl,
  graphQlLongLiteral,
  isTerminalPaymentStatus,
  nextPageCursor,
  parseGraphQlEnvelope,
  validatedCheckoutUrl,
  visibleRecommendationPosts,
  persistAuth,
  resolveUploadedMediaUrl,
} from './client'
import type { RecommendationItem } from './gatewayTypes'

describe('Gateway contract helpers', () => {
  afterEach(() => {
    clearAuth()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('preserves Snowflake identifiers before JSON parsing can round them', () => {
    const envelope = parseGraphQlEnvelope<{
      post: { id: string; author: { userId: string }; media: { id: string }[] }
    }>(
      '{"data":{"post":{"id":9007199254740993123,"author":{"userId":9007199254740993124},"media":[{"id":9007199254740993125}]}}}',
    )

    expect(envelope.data?.post).toEqual({
      id: '9007199254740993123',
      author: { userId: '9007199254740993124' },
      media: [{ id: '9007199254740993125' }],
    })
  })

  it('preserves Snowflake ids on association-edge fields (id1/id2)', () => {
    const envelope = parseGraphQlEnvelope<{
      groupJoinRequests: { items: { id1: string; id2: string }[] }
    }>(
      '{"data":{"groupJoinRequests":{"items":[{"id1":9007199254740993126,"id2":9007199254740993127}]}}}',
    )

    expect(envelope.data?.groupJoinRequests.items).toEqual([
      { id1: '9007199254740993126', id2: '9007199254740993127' },
    ])
  })

  it('accepts only positive decimal Long literals', () => {
    expect(graphQlLongLiteral('9007199254740993123')).toBe('9007199254740993123')
    expect(() => graphQlLongLiteral('1) { __typename }')).toThrow(ApiError)
    expect(() => graphQlLongLiteral('0')).toThrow(ApiError)
  })

  it('drops nullable recommendation posts without changing order', () => {
    const first = { __typename: 'FeedPostDetail', id: '1' } as const
    const second = { __typename: 'FeedPostDetail', id: '2' } as const
    const items = [
      { postId: '1', post: first },
      { postId: 'gone', post: null },
      { postId: '2', post: second },
    ] as unknown as RecommendationItem[]

    expect(visibleRecommendationPosts(items).map((post) => post.id)).toEqual(['1', '2'])
  })

  it('uses an opaque cursor only when another page exists', () => {
    expect(nextPageCursor({ hasNextPage: true, endCursor: 'opaque-token' })).toBe('opaque-token')
    expect(nextPageCursor({ hasNextPage: false, endCursor: 'ignored' })).toBeNull()
  })

  it('allows only HTTPS checkout URLs', () => {
    expect(validatedCheckoutUrl('https://pay.example/checkout/123')).toBe('https://pay.example/checkout/123')
    expect(() => validatedCheckoutUrl('http://pay.example/checkout/123')).toThrow(ApiError)
    expect(() => validatedCheckoutUrl('not-a-url')).toThrow(ApiError)
  })

  it('recognizes terminal Payment states', () => {
    expect(isTerminalPaymentStatus('ACTIVATED')).toBe(true)
    expect(isTerminalPaymentStatus('FAILED')).toBe(true)
    expect(isTerminalPaymentStatus('PENDING')).toBe(false)
    expect(isTerminalPaymentStatus('ACTIVATION_PENDING')).toBe(false)
  })

  it('uploads media through the Upload Server direct endpoint', async () => {
    persistAuth({
      accessToken: 'test-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      url: '/media/files/image.png',
      type: 'image',
      contentType: 'image/png',
      size: 4,
      name: 'image.png',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' })
    await api.uploadMedia(file)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/media/upload')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toBeInstanceOf(Headers)
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer test-token')
    expect(init?.body).toBeInstanceOf(FormData)
  })

  it('makes returned media URLs absolute when Upload Server has its own origin', () => {
    expect(resolveUploadedMediaUrl('/media/files/image.png', 'https://uploads.example.com')).toBe(
      'https://uploads.example.com/media/files/image.png',
    )
    expect(resolveUploadedMediaUrl('/media/files/image.png', '/media')).toBe('/media/files/image.png')
  })

  it('deduplicates simultaneous identical read-only Gateway queries', async () => {
    let resolveFetch!: (response: Response) => void
    const pendingFetch = new Promise<Response>((resolve) => { resolveFetch = resolve })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingFetch)
    const query = 'query CurrentViewer { me { userId email } }'

    const first = gatewayGraphQl<{ me: { userId: string } }>(query)
    const second = gatewayGraphQl<{ me: { userId: string } }>(query)

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch(new Response('{"data":{"me":{"userId":9007199254740993123,"email":"test@example.com"}}}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    await expect(Promise.all([first, second])).resolves.toEqual([
      { me: { userId: '9007199254740993123', email: 'test@example.com' } },
      { me: { userId: '9007199254740993123', email: 'test@example.com' } },
    ])
  })

  it('never deduplicates Gateway mutations', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"data":{"markAllNotificationsRead":1}}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"data":{"markAllNotificationsRead":2}}', { status: 200 }))
    const mutation = 'mutation MarkAll { markAllNotificationsRead }'

    await expect(Promise.all([
      gatewayGraphQl<{ markAllNotificationsRead: number }>(mutation),
      gatewayGraphQl<{ markAllNotificationsRead: number }>(mutation),
    ])).resolves.toEqual([
      { markAllNotificationsRead: 1 },
      { markAllNotificationsRead: 2 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refreshes an expired access token once and retries with the rotated token', async () => {
    persistAuth({
      accessToken: 'expired-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"errors":[{"extensions":{"code":"UNAUTHENTICATED"}}]}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"data":{"refreshToken":{"accessToken":"rotated-token","refreshTokenExpiresAt":"2026-08-27T00:00:00Z","user":{"userId":1,"email":"test@example.com","validDate":null,"status":1}}}}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"data":{"me":{"userId":1}}}', { status: 200 }))

    await expect(gatewayGraphQl<{ me: { userId: string } }>('query CurrentViewer { me { userId } }'))
      .resolves.toEqual({ me: { userId: 1 } })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(((fetchMock.mock.calls[2][1]?.headers as Headers).get('Authorization'))).toBe('Bearer rotated-token')
    expect(localStorage.getItem('fb.auth')).toContain('rotated-token')
  })

  it('preserves the signed-in user when refresh fails only because the gateway is unavailable', async () => {
    persistAuth({
      accessToken: 'expired-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    })
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"errors":[{"extensions":{"code":"UNAUTHENTICATED"}}]}', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))

    await expect(gatewayGraphQl('query CurrentViewer { me { userId } }'))
      .rejects.toMatchObject({ status: 503 })
    expect(localStorage.getItem('fb.auth')).toContain('expired-token')
  })

  it('clears the user only when Auth definitively rejects the refresh credential', async () => {
    persistAuth({
      accessToken: 'expired-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    })
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"errors":[{"extensions":{"code":"UNAUTHENTICATED"}}]}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"errors":[{"message":"expired","extensions":{"code":"INVALID_REFRESH_TOKEN"}}]}', { status: 200 }))

    await expect(gatewayGraphQl('query CurrentViewer { me { userId } }'))
      .rejects.toMatchObject({ status: 401 })
    expect(localStorage.getItem('fb.auth')).toBeNull()
  })

  it('does not rotate twice when another browser tab refreshed while this tab waited', async () => {
    persistAuth({
      accessToken: 'expired-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    })
    const lockRequest = vi.fn(async (_name: string, _options: unknown, callback: () => Promise<unknown>) => {
      persistAuth({
        accessToken: 'token-from-other-tab',
        refreshTokenExpiresAt: null,
        user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
      })
      return callback()
    })
    vi.stubGlobal('navigator', { ...window.navigator, locks: { request: lockRequest } })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"errors":[{"extensions":{"code":"UNAUTHENTICATED"}}]}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"data":{"me":{"userId":1}}}', { status: 200 }))

    await expect(gatewayGraphQl('query CurrentViewer { me { userId } }')).resolves.toEqual({ me: { userId: 1 } })

    expect(lockRequest).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.some(([, init]) => String(init?.body).includes('RefreshSession'))).toBe(false)
    expect((fetchMock.mock.calls[1][1]?.headers as Headers).get('Authorization')).toBe('Bearer token-from-other-tab')
  })
})

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  GRAPHQL_GATEWAY_URL: 'http://gateway.test/graphql',
  getAuth: () => ({ accessToken: 'test-token' }),
  parseGraphQlEnvelope: (value: string) => JSON.parse(value),
}))

import { subscribeGatewayGraphQl } from './realtime'

/**
 * The reconnect counter used to be reset as soon as fetch resolved, before the response
 * status was ever inspected. A gateway answering 401, 429 or 500 therefore kept the
 * backoff pinned at its first step, and every open stream retried once a second forever —
 * a self-inflicted flood that would trip the very rate limits it was hitting.
 */
describe('realtime reconnect backoff', () => {
  let delays: number[]
  let scheduled: typeof window.setTimeout

  beforeEach(() => {
    vi.useFakeTimers()
    delays = []
    scheduled = window.setTimeout
    // Remove jitter so the progression is exact.
    vi.spyOn(Math, 'random').mockReturnValue(1)
    vi.spyOn(window, 'setTimeout').mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      delays.push(timeout ?? 0)
      return scheduled(handler, timeout, ...args)
    }) as typeof window.setTimeout)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('backs off further on each rejected connection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))

    const unsubscribe = subscribeGatewayGraphQl({ query: 'subscription { x }', onData: () => {} })
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(20_000)
    }
    unsubscribe()

    expect(delays.length).toBeGreaterThanOrEqual(4)
    expect(delays.slice(0, 4)).toEqual([1_000, 2_000, 4_000, 8_000])
  })

  it('forgets earlier failures only once a data frame actually arrives', async () => {
    const healthy = new Response('data: {"data":{"x":1}}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 500 }))
        .mockResolvedValueOnce(new Response('', { status: 500 }))
        .mockResolvedValueOnce(healthy)
        .mockResolvedValue(new Response('', { status: 500 })),
    )

    const received: unknown[] = []
    const unsubscribe = subscribeGatewayGraphQl({
      query: 'subscription { x }',
      onData: (data) => received.push(data),
    })
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(20_000)
    }
    unsubscribe()

    expect(received).toEqual([{ x: 1 }])
    // 1s and 2s for the two rejections, then the healthy frame resets the counter so the
    // next failure starts again at 1s rather than continuing to grow.
    expect(delays.slice(0, 4)).toEqual([1_000, 2_000, 1_000, 2_000])
  })

  it('caps the delay rather than growing without bound', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))

    const unsubscribe = subscribeGatewayGraphQl({ query: 'subscription { x }', onData: () => {} })
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(30_000)
    }
    unsubscribe()

    expect(Math.max(...delays)).toBe(15_000)
  })
})

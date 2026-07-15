import { describe, expect, it } from 'vitest'
import {
  ApiError,
  graphQlLongLiteral,
  isTerminalPaymentStatus,
  nextPageCursor,
  parseGraphQlEnvelope,
  validatedCheckoutUrl,
  visibleRecommendationPosts,
} from './client'
import type { RecommendationItem } from './gatewayTypes'

describe('Gateway contract helpers', () => {
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
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const recordRecommendationImpressions = vi.hoisted(() => vi.fn())
vi.mock('../api/social', () => ({ recordRecommendationImpressions }))

import {
  createRecommendationSessionKey,
  flushRecommendationImpressions,
  queueRecommendationImpression,
  setRecommendationImpressionViewer,
} from './useRecommendationImpression'

describe('recommendation impression batching', () => {
  afterEach(() => {
    vi.useRealTimers()
    recordRecommendationImpressions.mockReset()
    setRecommendationImpressionViewer(null)
  })

  it('deduplicates one visible target per recommendation session and omits viewer identity', async () => {
    vi.useFakeTimers()
    recordRecommendationImpressions.mockResolvedValue(true)
    setRecommendationImpressionViewer('viewer-a')
    const sessionKey = createRecommendationSessionKey()

    queueRecommendationImpression('9007199254740993123', sessionKey, 1_250)
    queueRecommendationImpression('9007199254740993123', sessionKey, 2_000)
    await flushRecommendationImpressions()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    expect(recordRecommendationImpressions).toHaveBeenCalledWith([{
      targetId: '9007199254740993123',
      idempotencyKey: `${sessionKey}:9007199254740993123`,
      dwellMs: 1_250,
    }])
    expect(recordRecommendationImpressions.mock.calls[0][0][0]).not.toHaveProperty('userId')
  })

  it('drops queued account-A impressions before account B can inherit the Gateway session', async () => {
    vi.useFakeTimers()
    recordRecommendationImpressions.mockResolvedValue(true)
    setRecommendationImpressionViewer('viewer-a')
    queueRecommendationImpression('1001', 'session-a', 900)

    setRecommendationImpressionViewer('viewer-b')
    await flushRecommendationImpressions()
    await vi.runAllTimersAsync()

    expect(recordRecommendationImpressions).not.toHaveBeenCalled()
  })
})

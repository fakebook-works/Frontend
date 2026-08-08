import { describe, expect, it } from 'vitest'
import { INPUT_LIMITS } from './inputLimits'

describe('browser input ceilings', () => {
  it('stays aligned with the Gateway contract', () => {
    expect(INPUT_LIMITS).toEqual({
      email: 254,
      displayName: 80,
      profileDescription: 255,
      profileLocation: 255,
      post: 63_206,
      comment: 8_000,
      messenger: 20_000,
      story: 125,
      password: 128,
      search: 200,
      groupName: 100,
      groupDescription: 2_000,
      conversationTitle: 120,
      reelCaption: 5_000,
      verificationCode: 6,
    })
  })
})

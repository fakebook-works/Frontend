import { describe, expect, it } from 'vitest'
import type { SharedPostSource } from '../api/gatewayTypes'
import { sharedPostSourceToGatewayReel } from './reelEntry'

describe('sharedPostSourceToGatewayReel', () => {
  it('preserves the authorized shared Reel presentation crop for the first viewer frame', () => {
    const source: SharedPostSource = {
      id: '93',
      isAvailable: true,
      type: 4,
      content: 'cropped reel',
      privacy: 2,
      create: '2026-08-03T10:00:00Z',
      aspectRatio: 9 / 16,
      focalPointX: 0.2,
      focalPointY: 0.8,
      author: { id: '12', name: 'Minh', avatar: '', isVerified: false },
      media: [{ id: '901', type: 1, url: '/media/reel.mp4' }],
    }

    expect(sharedPostSourceToGatewayReel(source)).toMatchObject({
      id: '93',
      aspectRatio: 9 / 16,
      focalPointX: 0.2,
      focalPointY: 0.8,
    })
  })

  it('does not build a viewer seed from an unavailable source', () => {
    expect(sharedPostSourceToGatewayReel({
      id: '94',
      isAvailable: false,
      type: 4,
      content: null,
      author: null,
      media: [],
    })).toBeNull()
  })
})

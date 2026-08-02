import { describe, expect, it } from 'vitest'
import {
  calculateReelCropOutputSize,
  calculateReelCropRect,
  reelCropIsRequired,
} from './reelCrop'

describe('Reel crop geometry', () => {
  it('crops a wide source horizontally around the selected focal point', () => {
    const centered = calculateReelCropRect(1920, 1080, 9 / 16, .5, .5)
    const left = calculateReelCropRect(1920, 1080, 9 / 16, 0, .5)

    expect(centered).toEqual(expect.objectContaining({ y: 0, height: 1080 }))
    expect(centered.width / centered.height).toBeCloseTo(9 / 16, 6)
    expect(centered.x).toBeCloseTo((1920 - centered.width) / 2, 6)
    expect(left.x).toBe(0)
  })

  it('crops a tall source vertically around the selected focal point', () => {
    const top = calculateReelCropRect(1080, 1920, 16 / 9, .5, 0)
    const bottom = calculateReelCropRect(1080, 1920, 16 / 9, .5, 1)

    expect(top).toEqual(expect.objectContaining({ x: 0, y: 0, width: 1080 }))
    expect(top.width / top.height).toBeCloseTo(16 / 9, 6)
    expect(bottom.y).toBeCloseTo(1920 - bottom.height, 6)
  })

  it('does not re-encode a source that already has the selected aspect ratio', () => {
    expect(reelCropIsRequired(1920, 1080, 16 / 9)).toBe(false)
    expect(reelCropIsRequired(1080, 1920, 9 / 16)).toBe(false)
    expect(reelCropIsRequired(1920, 1080, 1)).toBe(true)
  })

  it('keeps exported dimensions even and caps the longest edge', () => {
    const rect = calculateReelCropRect(3840, 2160, 16 / 9, .5, .5)
    const output = calculateReelCropOutputSize(rect, 16 / 9)

    expect(Math.max(output.width, output.height)).toBeLessThanOrEqual(1920)
    expect(output.width % 2).toBe(0)
    expect(output.height % 2).toBe(0)
    expect(output.width / output.height).toBeCloseTo(16 / 9, 2)
  })
})

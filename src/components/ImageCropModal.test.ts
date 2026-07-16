import { describe, expect, it } from 'vitest'
import { coverCropRect } from '../lib/imageCrop'

describe('coverCropRect', () => {
  it('centers and crops a landscape image into a square', () => {
    expect(coverCropRect(1600, 900, 1)).toEqual({ x: 350, y: 0, width: 900, height: 900 })
  })

  it('applies zoom and clamps positioning inside the image', () => {
    const rect = coverCropRect(1200, 800, 16 / 6, 2, 100, -100)
    expect(rect.x + rect.width).toBeLessThanOrEqual(1200)
    expect(rect.y).toBe(0)
    expect(rect.width / rect.height).toBeCloseTo(16 / 6)
  })
})

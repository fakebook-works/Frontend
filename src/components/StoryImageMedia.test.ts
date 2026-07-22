import { describe, expect, it } from 'vitest'
import { detectStoryImageContentBounds } from '../lib/storyImageBounds'

function imageWithBlackBars(width: number, height: number, top: number, bottom: number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      pixels[offset] = 180
      pixels[offset + 1] = 120
      pixels[offset + 2] = 70
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

describe('detectStoryImageContentBounds', () => {
  it('removes opaque black padding baked into legacy story images', () => {
    const bounds = detectStoryImageContentBounds(imageWithBlackBars(90, 160, 38, 122), 90, 160)
    expect(bounds.y).toBeGreaterThanOrEqual(38)
    expect(bounds.y).toBeLessThanOrEqual(40)
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(120)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(122)
    expect(bounds.height).toBeLessThan(100)
  })

  it('keeps a normal image that reaches every edge', () => {
    const bounds = detectStoryImageContentBounds(imageWithBlackBars(90, 160, 0, 160), 90, 160)
    expect(bounds).toEqual({ x: 0, y: 0, width: 90, height: 160 })
  })
})

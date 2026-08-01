import { describe, expect, it } from 'vitest'
import { dominantAmbientColor } from './useImageAmbientColor'

function pixels(colors: Array<[number, number, number]>) {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]))
}

function rgbChannels(color: string) {
  return color.match(/\d+/g)?.map(Number) ?? []
}

describe('dominantAmbientColor', () => {
  it('keeps the hue of the most frequent color instead of a small bright patch', () => {
    const color = dominantAmbientColor(pixels([
      ...Array.from({ length: 70 }, () => [210, 34, 42] as [number, number, number]),
      ...Array.from({ length: 20 }, () => [250, 250, 250] as [number, number, number]),
      ...Array.from({ length: 10 }, () => [32, 84, 220] as [number, number, number]),
    ]))
    const [r, g, b] = rgbChannels(color)
    expect(r).toBeGreaterThan(g + 45)
    expect(r).toBeGreaterThan(b + 35)
  })

  it('returns a neutral fallback when the sample has no visible pixel', () => {
    expect(dominantAmbientColor(new Uint8ClampedArray([20, 80, 200, 0]), 'rgb(1 2 3)')).toBe('rgb(1 2 3)')
  })

  it('keeps a grayscale dominant sample grayscale after lifting it', () => {
    const [r, g, b] = rgbChannels(dominantAmbientColor(pixels(Array.from({ length: 12 }, () => [72, 72, 72]))))
    expect(r).toBe(g)
    expect(g).toBe(b)
    expect(r).toBeGreaterThan(72)
  })
})

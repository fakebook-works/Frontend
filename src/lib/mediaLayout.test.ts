import { describe, expect, it } from 'vitest'
import {
  MAX_SINGLE_MEDIA_ASPECT_RATIO,
  MIN_SINGLE_MEDIA_ASPECT_RATIO,
  classifyMediaDimensions,
  getAdaptiveMediaLayout,
  getSingleMediaPresentation,
} from './mediaLayout'

describe('mediaLayout', () => {
  it('classifies valid portrait, square and landscape dimensions', () => {
    expect(classifyMediaDimensions({ width: 900, height: 1600 })).toBe('portrait')
    expect(classifyMediaDimensions({ width: 1000, height: 1000 })).toBe('square')
    expect(classifyMediaDimensions({ width: 1600, height: 900 })).toBe('landscape')
    expect(classifyMediaDimensions({ width: 0, height: 900 })).toBe('unknown')
  })

  it('keeps normal single-media ratios and clamps extreme ratios with a backdrop', () => {
    expect(getSingleMediaPresentation({ width: 1000, height: 1000 })).toMatchObject({ frameAspectRatio: 1, needsBackdrop: false })
    expect(getSingleMediaPresentation({ width: 800, height: 1000 })).toMatchObject({ frameAspectRatio: MIN_SINGLE_MEDIA_ASPECT_RATIO, needsBackdrop: false })
    expect(getSingleMediaPresentation({ width: 1910, height: 1000 })).toMatchObject({ frameAspectRatio: MAX_SINGLE_MEDIA_ASPECT_RATIO, needsBackdrop: false })
    expect(getSingleMediaPresentation({ width: 900, height: 1600 })).toMatchObject({ frameAspectRatio: MIN_SINGLE_MEDIA_ASPECT_RATIO, needsBackdrop: true })
    expect(getSingleMediaPresentation({ width: 2400, height: 900 })).toMatchObject({ frameAspectRatio: MAX_SINGLE_MEDIA_ASPECT_RATIO, needsBackdrop: true })
  })

  it('chooses orientation-aware layouts for two and three media items', () => {
    expect(getAdaptiveMediaLayout([{ width: 900, height: 1600 }, { width: 1000, height: 1500 }]).kind).toBe('two-portrait-columns')
    expect(getAdaptiveMediaLayout([{ width: 1600, height: 900 }, { width: 1400, height: 900 }]).kind).toBe('two-landscape-rows')
    expect(getAdaptiveMediaLayout([{ width: 900, height: 1600 }, { width: 1600, height: 900 }, { width: 1600, height: 900 }]).kind).toBe('three-portrait-leading')
    expect(getAdaptiveMediaLayout([{ width: 1600, height: 900 }, { width: 900, height: 1600 }, { width: 900, height: 1600 }]).kind).toBe('three-landscape-leading')
  })

  it('uses stable fallbacks for unknown dimensions and fixed layouts for larger collages', () => {
    expect(getAdaptiveMediaLayout([null, null], 2).kind).toBe('two-portrait-columns')
    expect(getAdaptiveMediaLayout([null, { width: 900, height: 1600 }, null], 3).kind).toBe('three-portrait-leading')
    expect(getAdaptiveMediaLayout([], 4).kind).toBe('four-grid')
    expect(getAdaptiveMediaLayout([], 8)).toEqual({ kind: 'five-two-three', visibleCount: 5, overflowCount: 3 })
  })
})

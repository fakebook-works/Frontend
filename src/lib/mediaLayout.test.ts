import { describe, expect, it } from 'vitest'
import {
  PORTRAIT_SINGLE_MEDIA_FRAME_ASPECT_RATIO,
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

  it('uses the 4:3 sample frame only for portrait media and preserves every non-portrait ratio', () => {
    expect(getSingleMediaPresentation({ width: 1000, height: 1000 })).toMatchObject({ frameAspectRatio: 1, needsLetterbox: false })
    expect(getSingleMediaPresentation({ width: 800, height: 1000 })).toMatchObject({ frameAspectRatio: PORTRAIT_SINGLE_MEDIA_FRAME_ASPECT_RATIO, needsLetterbox: true })
    expect(getSingleMediaPresentation({ width: 1910, height: 1000 })).toMatchObject({ frameAspectRatio: 1.91, needsLetterbox: false })
    expect(getSingleMediaPresentation({ width: 900, height: 1600 })).toMatchObject({ frameAspectRatio: PORTRAIT_SINGLE_MEDIA_FRAME_ASPECT_RATIO, needsLetterbox: true })
    expect(getSingleMediaPresentation({ width: 2400, height: 900 })).toMatchObject({ frameAspectRatio: 2400 / 900, needsLetterbox: false })
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

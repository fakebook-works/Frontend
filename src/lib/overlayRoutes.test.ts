// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  contentOverlayHref,
  fallbackBackgroundHref,
  locationFromHref,
  mediaOverlayHref,
  normalizeLegacyOverlayHref,
  overlayBackgroundHref,
  overlayReturnsWithBack,
  parseOverlayRoute,
  reelOverlayHref,
} from './overlayRoutes'

describe('overlay routes', () => {
  beforeEach(() => window.history.replaceState({}, '', '/home'))

  it('builds and parses canonical content, media and reel URLs', () => {
    expect(parseOverlayRoute(locationFromHref(contentOverlayHref('post/42')))).toEqual({ kind: 'content', contentId: 'post/42' })
    expect(mediaOverlayHref('post 42', 'media/7')).toBe('/photo/post%2042/media%2F7')
    expect(parseOverlayRoute(locationFromHref(mediaOverlayHref('post 42', 'media/7')))).toEqual({ kind: 'media', contentId: 'post 42', mediaId: 'media/7' })
    expect(parseOverlayRoute(locationFromHref(reelOverlayHref('reel 9', 'profile', 'owner/2')))).toEqual({
      kind: 'reel',
      reelId: 'reel 9',
      source: 'profile',
      ownerId: 'owner/2',
    })
  })

  it('accepts only same-app, non-overlay background locations', () => {
    const state = { fakebookOverlay: { backgroundHref: '/friends/suggestions?selected=2', returnWithBack: true } }
    expect(overlayBackgroundHref(state)).toBe('/friends/suggestions?selected=2')
    expect(overlayReturnsWithBack(state)).toBe(true)
    expect(overlayBackgroundHref({ fakebookOverlay: { backgroundHref: '//example.com/steal', returnWithBack: true } })).toBeNull()
    expect(overlayBackgroundHref({ fakebookOverlay: { backgroundHref: '/content/42', returnWithBack: true } })).toBeNull()
  })

  it('normalizes legacy viewer links and derives safe direct-link backgrounds', () => {
    expect(normalizeLegacyOverlayHref(locationFromHref('/home?post=42'))).toBe('/content/42')
    expect(normalizeLegacyOverlayHref(locationFromHref('/reels?source=profile&owner=2&reel=9'))).toBe('/reel/9?source=profile&owner=2')
    const profileReel = parseOverlayRoute(locationFromHref('/reel/9?source=profile&owner=2'))!
    expect(fallbackBackgroundHref(profileReel)).toBe('/profile/2?tab=reels')
    expect(fallbackBackgroundHref({ kind: 'content', contentId: '42' })).toBe('/home')
  })
})

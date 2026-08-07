import type { AppLocation } from './router'

export type OverlayRoute =
  | { kind: 'content'; contentId: string }
  | { kind: 'media'; contentId: string; mediaId: string }
  | { kind: 'reel'; reelId: string; source: 'for-you' | 'profile'; ownerId: string | null }

export interface FakebookOverlayHistoryState {
  fakebookOverlay: {
    backgroundHref: string
    returnWithBack: boolean
  }
}

function decodedSegment(pathname: string, index: number) {
  const value = pathname.split('/').filter(Boolean)[index]
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function parseOverlayRoute(location: Pick<AppLocation, 'pathname' | 'params'>): OverlayRoute | null {
  if (location.pathname.startsWith('/content/')) {
    const contentId = decodedSegment(location.pathname, 1)
    return contentId ? { kind: 'content', contentId } : null
  }
  if (location.pathname.startsWith('/photo/')) {
    const contentId = decodedSegment(location.pathname, 1)
    const mediaId = decodedSegment(location.pathname, 2)
    return contentId && mediaId ? { kind: 'media', contentId, mediaId } : null
  }
  if (location.pathname.startsWith('/reel/')) {
    const reelId = decodedSegment(location.pathname, 1)
    if (!reelId) return null
    const source = location.params.get('source') === 'profile' ? 'profile' : 'for-you'
    return {
      kind: 'reel',
      reelId,
      source,
      ownerId: source === 'profile' ? location.params.get('owner') : null,
    }
  }
  return null
}

export function contentOverlayHref(contentId: string) {
  return `/content/${encodeURIComponent(contentId)}`
}

export function mediaOverlayHref(contentId: string, mediaId: string) {
  return `/photo/${encodeURIComponent(contentId)}/${encodeURIComponent(mediaId)}`
}

export function reelOverlayHref(reelId: string, source: 'for-you' | 'profile' = 'for-you', ownerId?: string | null) {
  const params = new URLSearchParams({ source })
  if (source === 'profile' && ownerId) params.set('owner', ownerId)
  return `/reel/${encodeURIComponent(reelId)}?${params.toString()}`
}

export function appHref(location: Pick<AppLocation, 'pathname' | 'search'>) {
  return `${location.pathname}${location.search}`
}

export function locationFromHref(href: string, state: unknown = null): AppLocation {
  const url = new URL(href, window.location.origin)
  return {
    pathname: url.pathname.replace(/\/+$/, '') || '/',
    search: url.search,
    params: new URLSearchParams(url.search),
    state,
  }
}

export function overlayBackgroundHref(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null
  const overlay = (state as { fakebookOverlay?: unknown }).fakebookOverlay
  if (!overlay || typeof overlay !== 'object') return null
  const backgroundHref = (overlay as { backgroundHref?: unknown }).backgroundHref
  if (typeof backgroundHref !== 'string' || !backgroundHref.startsWith('/') || backgroundHref.startsWith('//')) return null
  let url: URL
  try {
    url = new URL(backgroundHref, window.location.origin)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin || parseOverlayRoute(locationFromHref(`${url.pathname}${url.search}`))) return null
  return `${url.pathname}${url.search}`
}

export function overlayReturnsWithBack(state: unknown) {
  if (!state || typeof state !== 'object') return false
  const overlay = (state as { fakebookOverlay?: unknown }).fakebookOverlay
  return Boolean(overlay && typeof overlay === 'object' && (overlay as { returnWithBack?: unknown }).returnWithBack === true)
}

export function fallbackBackgroundHref(route: OverlayRoute) {
  if (route.kind === 'reel' && route.source === 'profile' && route.ownerId) {
    return `/profile/${encodeURIComponent(route.ownerId)}?tab=reels`
  }
  return '/home'
}

export function normalizeLegacyOverlayHref(location: Pick<AppLocation, 'pathname' | 'params'>): string | null {
  if ((location.pathname === '/' || location.pathname === '/home') && location.params.get('post')) {
    return contentOverlayHref(location.params.get('post')!)
  }
  if (location.pathname.startsWith('/reels')) {
    const reelId = location.params.get('reel')
    if (!reelId) return null
    const source = location.params.get('source') === 'profile' ? 'profile' : 'for-you'
    return reelOverlayHref(reelId, source, location.params.get('owner'))
  }
  return null
}

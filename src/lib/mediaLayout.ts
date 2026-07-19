export interface MediaDimensions {
  width: number
  height: number
}

export type MediaOrientation = 'portrait' | 'square' | 'landscape' | 'unknown'

export type AdaptiveMediaLayoutKind =
  | 'empty'
  | 'single'
  | 'two-portrait-columns'
  | 'two-landscape-rows'
  | 'three-portrait-leading'
  | 'three-landscape-leading'
  | 'four-grid'
  | 'five-two-three'

export interface AdaptiveMediaLayout {
  kind: AdaptiveMediaLayoutKind
  visibleCount: number
  overflowCount: number
}

export const MIN_SINGLE_MEDIA_ASPECT_RATIO = 4 / 5
export const MAX_SINGLE_MEDIA_ASPECT_RATIO = 1.91
export const DEFAULT_SINGLE_MEDIA_ASPECT_RATIO = 4 / 3

export function isValidMediaDimensions(dimensions: MediaDimensions | null | undefined): dimensions is MediaDimensions {
  return Boolean(dimensions && Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height) && dimensions.width > 0 && dimensions.height > 0)
}

export function getMediaAspectRatio(dimensions: MediaDimensions | null | undefined) {
  return isValidMediaDimensions(dimensions) ? dimensions.width / dimensions.height : null
}

export function classifyMediaDimensions(dimensions: MediaDimensions | null | undefined): MediaOrientation {
  const ratio = getMediaAspectRatio(dimensions)
  if (ratio === null) return 'unknown'
  if (ratio < .9) return 'portrait'
  if (ratio > 1.12) return 'landscape'
  return 'square'
}

export function getSingleMediaPresentation(dimensions: MediaDimensions | null | undefined) {
  const naturalAspectRatio = getMediaAspectRatio(dimensions)
  if (naturalAspectRatio === null) {
    return {
      naturalAspectRatio: null,
      frameAspectRatio: DEFAULT_SINGLE_MEDIA_ASPECT_RATIO,
      needsBackdrop: false,
      orientation: 'unknown' as const,
    }
  }

  return {
    naturalAspectRatio,
    frameAspectRatio: Math.min(MAX_SINGLE_MEDIA_ASPECT_RATIO, Math.max(MIN_SINGLE_MEDIA_ASPECT_RATIO, naturalAspectRatio)),
    needsBackdrop: naturalAspectRatio < MIN_SINGLE_MEDIA_ASPECT_RATIO || naturalAspectRatio > MAX_SINGLE_MEDIA_ASPECT_RATIO,
    orientation: classifyMediaDimensions(dimensions),
  }
}

function firstKnownOrientation(dimensions: Array<MediaDimensions | null | undefined>) {
  for (const item of dimensions) {
    const orientation = classifyMediaDimensions(item)
    if (orientation !== 'unknown') return orientation
  }
  return 'landscape' as const
}

export function getAdaptiveMediaLayout(dimensions: Array<MediaDimensions | null | undefined>, itemCount = dimensions.length): AdaptiveMediaLayout {
  const visibleCount = Math.min(5, Math.max(0, itemCount))
  const overflowCount = Math.max(0, itemCount - visibleCount)
  if (visibleCount === 0) return { kind: 'empty', visibleCount, overflowCount }
  if (visibleCount === 1) return { kind: 'single', visibleCount, overflowCount }
  if (visibleCount === 2) {
    const orientations = dimensions.slice(0, 2).map(classifyMediaDimensions).filter((orientation) => orientation !== 'unknown')
    const landscapeCount = orientations.filter((orientation) => orientation === 'landscape').length
    const portraitCount = orientations.filter((orientation) => orientation === 'portrait').length
    const firstOrientation = firstKnownOrientation(dimensions)
    return {
      kind: landscapeCount > portraitCount || (landscapeCount === portraitCount && landscapeCount > 0 && firstOrientation === 'landscape')
        ? 'two-landscape-rows'
        : 'two-portrait-columns',
      visibleCount,
      overflowCount,
    }
  }
  if (visibleCount === 3) {
    return {
      kind: firstKnownOrientation(dimensions) === 'portrait' ? 'three-portrait-leading' : 'three-landscape-leading',
      visibleCount,
      overflowCount,
    }
  }
  if (visibleCount === 4) return { kind: 'four-grid', visibleCount, overflowCount }
  return { kind: 'five-two-three', visibleCount, overflowCount }
}

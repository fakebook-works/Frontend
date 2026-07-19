import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MediaDimensions } from './mediaLayout'

const mediaDimensionCache = new Map<string, MediaDimensions>()
const MEDIA_DIMENSION_CACHE_LIMIT = 600

export function useMediaDimensions(keys: string[]) {
  const keySignature = keys.join('\u0001')
  const stableKeys = useMemo(() => keySignature ? keySignature.split('\u0001') : [], [keySignature])
  const [dimensionsByKey, setDimensionsByKey] = useState<Record<string, MediaDimensions>>(() => Object.fromEntries(
    stableKeys.flatMap((key) => {
      const cached = mediaDimensionCache.get(key)
      return cached ? [[key, cached]] : []
    }),
  ))

  useEffect(() => {
    setDimensionsByKey((current) => {
      let changed = false
      const next = { ...current }
      stableKeys.forEach((key) => {
        const cached = mediaDimensionCache.get(key)
        if (cached && (current[key]?.width !== cached.width || current[key]?.height !== cached.height)) {
          next[key] = cached
          changed = true
        }
      })
      return changed ? next : current
    })
  }, [stableKeys])

  const rememberDimensions = useCallback((key: string, width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
    const next = { width, height }
    mediaDimensionCache.set(key, next)
    if (mediaDimensionCache.size > MEDIA_DIMENSION_CACHE_LIMIT) {
      const oldestKey = mediaDimensionCache.keys().next().value
      if (oldestKey) mediaDimensionCache.delete(oldestKey)
    }
    setDimensionsByKey((current) => current[key]?.width === width && current[key]?.height === height
      ? current
      : { ...current, [key]: next })
  }, [])

  return {
    dimensions: stableKeys.map((key) => dimensionsByKey[key] ?? null),
    rememberDimensions,
  }
}

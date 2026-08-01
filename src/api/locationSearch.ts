export interface LocationSuggestion {
  id: string
  label: string
  detail: string
  value: string
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown }
  properties?: Record<string, unknown>
}

interface PhotonResponse {
  features?: unknown
}

const DEFAULT_LOCATION_SEARCH_URL = 'https://photon.komoot.io/api/'
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000
const LOCATION_CACHE_LIMIT = 60
const LOCATION_REQUEST_TIMEOUT_MS = 8_000
const locationCache = new Map<string, { expiresAt: number; items: LocationSuggestion[] }>()

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueParts(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const normalized = value.toLocaleLowerCase()
    if (!value || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function suggestionFromFeature(feature: PhotonFeature, index: number): LocationSuggestion | null {
  const properties = feature.properties
  if (!properties) return null
  const name = stringValue(properties.name)
  const street = uniqueParts([stringValue(properties.housenumber), stringValue(properties.street)]).join(' ')
  const context = uniqueParts([
    street,
    stringValue(properties.district),
    stringValue(properties.city),
    stringValue(properties.county),
    stringValue(properties.state),
    stringValue(properties.country),
  ]).filter((part) => part.toLocaleLowerCase() !== name.toLocaleLowerCase())
  const label = name || context.shift() || ''
  if (!label) return null
  const detail = context.join(', ')
  const value = uniqueParts([label, ...context]).join(', ').slice(0, 160)
  const osmType = stringValue(properties.osm_type)
  const osmId = typeof properties.osm_id === 'number' || typeof properties.osm_id === 'string' ? String(properties.osm_id) : ''
  return { id: osmType && osmId ? `${osmType}:${osmId}` : `${value}:${index}`, label, detail, value }
}

function locationSearchEndpoint(): URL {
  const configured = import.meta.env.VITE_GEOCODING_API_URL?.trim() || DEFAULT_LOCATION_SEARCH_URL
  const endpoint = new URL(configured)
  const loopbackHttp = endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
  if (endpoint.protocol !== 'https:' && !loopbackHttp) {
    throw new Error('Location search endpoint must use HTTPS')
  }
  return endpoint
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const normalized = query.trim().replace(/\s+/g, ' ')
  if (normalized.length < 3) return []
  const cacheKey = normalized.toLocaleLowerCase()
  const cached = locationCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.items

  const endpoint = locationSearchEndpoint()
  endpoint.searchParams.set('q', normalized)
  endpoint.searchParams.set('limit', '6')
  endpoint.searchParams.set('dedupe', '1')
  const requestController = new AbortController()
  const abortFromCaller = () => requestController.abort()
  if (signal?.aborted) abortFromCaller()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = globalThis.setTimeout(() => requestController.abort(), LOCATION_REQUEST_TIMEOUT_MS)
  let payload: PhotonResponse
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: requestController.signal,
    })
    if (!response.ok) throw new Error(`Location search failed (${response.status})`)
    payload = await response.json() as PhotonResponse
  } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
  const features = Array.isArray(payload.features) ? payload.features.filter((feature): feature is PhotonFeature => Boolean(feature) && typeof feature === 'object' && !Array.isArray(feature)) : []
  const items = features.flatMap((feature, index) => {
    const suggestion = suggestionFromFeature(feature, index)
    return suggestion ? [suggestion] : []
  })
  const seenValues = new Set<string>()
  const uniqueItems = items.filter((item) => {
    const key = item.value.toLocaleLowerCase()
    if (seenValues.has(key)) return false
    seenValues.add(key)
    return true
  }).slice(0, 6)
  if (locationCache.size >= LOCATION_CACHE_LIMIT) locationCache.delete(locationCache.keys().next().value ?? '')
  locationCache.set(cacheKey, { expiresAt: Date.now() + LOCATION_CACHE_TTL_MS, items: uniqueItems })
  return uniqueItems
}

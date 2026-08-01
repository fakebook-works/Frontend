import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchLocations } from './locationSearch'

describe('searchLocations', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not contact the provider for an incomplete query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(searchLocations(' H ')).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requests public suggestions without browser credentials and normalizes Photon features', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      features: [
        null,
        'malformed',
        { properties: { osm_type: 'R', osm_id: 42, name: 'Đà Nẵng', city: 'Đà Nẵng', country: 'Việt Nam' } },
        { properties: { osm_type: 'R', osm_id: 43, name: 'Đà Nẵng', city: 'Đà Nẵng', country: 'Việt Nam' } },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await expect(searchLocations('Unique Đà Nẵng query')).resolves.toEqual([
      { id: 'R:42', label: 'Đà Nẵng', detail: 'Việt Nam', value: 'Đà Nẵng, Việt Nam' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [request, options] = fetchMock.mock.calls[0]
    const url = new URL(String(request))
    expect(url.protocol).toBe('https:')
    expect(url.searchParams.get('q')).toBe('Unique Đà Nẵng query')
    expect(url.searchParams.get('limit')).toBe('6')
    expect(options).toMatchObject({ method: 'GET', credentials: 'omit' })
  })
})

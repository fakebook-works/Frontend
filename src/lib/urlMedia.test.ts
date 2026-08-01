// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractWebUrls, isDirectImageUrl, remoteImageFileFromUrl, toSafeWebUrl } from './urlMedia'

describe('URL media safety', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('recognizes safe image links and rejects insecure cross-origin HTTP URLs', () => {
    expect(extractWebUrls('x https://cdn.example/photo.webp, y')).toEqual(['https://cdn.example/photo.webp'])
    expect(isDirectImageUrl('https://cdn.example/photo.webp?size=2')).toBe(true)
    expect(toSafeWebUrl('http://192.168.1.1/private.png')).toBeNull()
    expect(toSafeWebUrl('https://user:secret@example.com/private.png')).toBeNull()
  })

  it('downloads only CORS-readable image responses into a bounded File for the normal upload pipeline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' }), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': '5' },
    })))

    const file = await remoteImageFileFromUrl('https://cdn.example/photo.png')

    expect(file.name).toBe('photo.png')
    expect(file.type).toBe('image/png')
    expect(fetch).toHaveBeenCalledWith('https://cdn.example/photo.png', expect.objectContaining({ credentials: 'omit', mode: 'cors', redirect: 'error', referrerPolicy: 'no-referrer' }))
  })

  it('stops a response without Content-Length as soon as the streamed cap is exceeded', async () => {
    const oversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(13 * 1024 * 1024))
        controller.enqueue(new Uint8Array(13 * 1024 * 1024))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(oversizedBody, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })))

    await expect(remoteImageFileFromUrl('https://cdn.example/oversized.png')).rejects.toThrow('too large')
  })
})

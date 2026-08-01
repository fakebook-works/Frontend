const WEB_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>{}"']+/gi
const TRAILING_PUNCTUATION = /[),.;!?]+$/
const IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|webp)(?:$|[?#])/i
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024

export function extractWebUrls(value: string): string[] {
  return [...value.matchAll(WEB_URL_PATTERN)].map((match) => match[0].replace(TRAILING_PUNCTUATION, ''))
}

export function toSafeWebUrl(value: string): URL | null {
  try {
    const url = new URL(value.startsWith('www.') ? `https://${value}` : value)
    if (url.username || url.password) return null
    if (url.protocol === 'https:') return url
    if (url.protocol === 'http:' && typeof window !== 'undefined' && url.origin === window.location.origin) return url
    return null
  } catch {
    return null
  }
}

export function isDirectImageUrl(value: string): boolean {
  const url = toSafeWebUrl(value)
  return Boolean(url && IMAGE_EXTENSION_PATTERN.test(`${url.pathname}${url.search}${url.hash}`))
}

export async function remoteImageFileFromUrl(value: string): Promise<File> {
  const url = toSafeWebUrl(value)
  if (!url || !isDirectImageUrl(url.href)) throw new Error('Unsupported image URL.')

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(url.href, {
      credentials: 'omit',
      mode: 'cors',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('Unable to load image URL.')
    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (declaredLength > MAX_REMOTE_IMAGE_BYTES) throw new Error('Remote image is too large.')
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || ''
    if (!contentType.startsWith('image/')) throw new Error('URL does not return an image.')
    const chunks: ArrayBuffer[] = []
    let receivedBytes = 0
    if (response.body) {
      const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue
          receivedBytes += value.byteLength
          if (receivedBytes > MAX_REMOTE_IMAGE_BYTES) {
            controller.abort()
            throw new Error('Remote image is too large.')
          }
          const copy = new Uint8Array(value.byteLength)
          copy.set(value)
          chunks.push(copy.buffer)
        }
      } finally {
        reader.releaseLock()
      }
    } else {
      const fallback = new Uint8Array(await response.arrayBuffer())
      receivedBytes = fallback.byteLength
      if (receivedBytes > MAX_REMOTE_IMAGE_BYTES) throw new Error('Remote image is too large.')
      chunks.push(fallback.buffer)
    }
    if (receivedBytes === 0) throw new Error('Remote image is empty.')
    const blob = new Blob(chunks, { type: contentType })
    const name = decodeURIComponent(url.pathname.split('/').pop() || 'linked-image').replace(/[^a-zA-Z0-9._-]/g, '_')
    return new File([blob], name || 'linked-image', { type: contentType, lastModified: Date.now() })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

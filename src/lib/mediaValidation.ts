import { containsForbiddenInput, InputValidationError } from './inputValidation'

export const MEDIA_LIMITS = {
  standardBytes: 25 * 1024 * 1024,
  videoBytes: 500 * 1024 * 1024,
  imageMaxDimension: 16_384,
  imageMaxPixels: 50_000_000,
  selectionCount: 10,
} as const

export type MediaKind = 'image' | 'video' | 'audio' | 'document'
export type MediaValidationCode =
  | 'empty'
  | 'too_large'
  | 'unsupported_type'
  | 'type_mismatch'
  | 'invalid_signature'
  | 'unreadable_image'
  | 'image_dimensions'

export class MediaValidationError extends Error {
  readonly code: MediaValidationCode
  readonly fileName: string
  readonly limit: number | null

  constructor(code: MediaValidationCode, file: Pick<File, 'name'>, limit: number | null = null) {
    super(`Invalid media ${file.name}: ${code}`)
    this.name = 'MediaValidationError'
    this.code = code
    this.fileName = file.name
    this.limit = limit
  }
}

type MediaDefinition = {
  kind: MediaKind
  extensions: readonly string[]
  maxBytes: number
  signature: (bytes: Uint8Array) => boolean
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value)

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.slice(offset, offset + length))

const ISO_BASE_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42'])
const VIDEO_MP4_BRANDS = new Set([...ISO_BASE_BRANDS, 'mp4v', 'avc1', 'dash', 'cmfc', 'cmfs', '3gp4', '3gp5', '3g2a', 'MSNV', 'M4V '])
const AUDIO_MP4_BRANDS = new Set([...ISO_BASE_BRANDS, 'mp4a', 'M4A ', 'M4B ', 'M4P '])
const hasFtyp = (bytes: Uint8Array) => bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp'
const isoBrands = (bytes: Uint8Array) => {
  if (!hasFtyp(bytes)) return []
  const declaredSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  const limit = Math.min(bytes.length, declaredSize >= 16 ? declaredSize : bytes.length)
  const brands = [ascii(bytes, 8, 4)]
  for (let offset = 16; offset + 4 <= limit; offset += 4) brands.push(ascii(bytes, offset, 4))
  return brands
}
const hasIsoBrand = (bytes: Uint8Array, allowed: ReadonlySet<string>) => isoBrands(bytes).some((brand) => allowed.has(brand))
const AVIF_BRANDS = new Set(['avif', 'avis', 'mif1', 'msf1'])
const isAvif = (bytes: Uint8Array) => hasIsoBrand(bytes, AVIF_BRANDS)
const isVideoMp4 = (bytes: Uint8Array) => hasIsoBrand(bytes, VIDEO_MP4_BRANDS) && !isAvif(bytes)
const isAudioMp4 = (bytes: Uint8Array) => hasIsoBrand(bytes, AUDIO_MP4_BRANDS) && !isAvif(bytes)

const DEFINITIONS: Record<string, MediaDefinition> = {
  'image/jpeg': { kind: 'image', extensions: ['jpg', 'jpeg'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
  'image/png': { kind: 'image', extensions: ['png'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  'image/gif': { kind: 'image', extensions: ['gif'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6)) },
  'image/webp': { kind: 'image', extensions: ['webp'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP' },
  'image/avif': { kind: 'image', extensions: ['avif'], maxBytes: MEDIA_LIMITS.standardBytes, signature: isAvif },
  'video/mp4': { kind: 'video', extensions: ['mp4'], maxBytes: MEDIA_LIMITS.videoBytes, signature: isVideoMp4 },
  'audio/webm': { kind: 'audio', extensions: ['webm'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) },
  'audio/mp4': { kind: 'audio', extensions: ['m4a', 'mp4'], maxBytes: MEDIA_LIMITS.standardBytes, signature: isAudioMp4 },
  'application/pdf': { kind: 'document', extensions: ['pdf'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => ascii(bytes, 0, 5) === '%PDF-' },
  'application/msword': { kind: 'document', extensions: ['doc'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
  'application/vnd.ms-excel': { kind: 'document', extensions: ['xls'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
  'application/vnd.ms-powerpoint': { kind: 'document', extensions: ['ppt'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { kind: 'document', extensions: ['docx'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { kind: 'document', extensions: ['xlsx'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { kind: 'document', extensions: ['pptx'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) },
  'text/plain': { kind: 'document', extensions: ['txt'], maxBytes: MEDIA_LIMITS.standardBytes, signature: () => true },
  'text/csv': { kind: 'document', extensions: ['csv'], maxBytes: MEDIA_LIMITS.standardBytes, signature: () => true },
  'application/csv': { kind: 'document', extensions: ['csv'], maxBytes: MEDIA_LIMITS.standardBytes, signature: () => true },
  'application/rtf': { kind: 'document', extensions: ['rtf'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => ascii(bytes, 0, 5) === '{\\rtf' },
  'text/rtf': { kind: 'document', extensions: ['rtf'], maxBytes: MEDIA_LIMITS.standardBytes, signature: (bytes) => ascii(bytes, 0, 5) === '{\\rtf' },
}

export const PROFILE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const UPLOAD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'] as const
export const POST_MEDIA_MIME_TYPES = [...UPLOAD_IMAGE_MIME_TYPES, 'video/mp4'] as const
export const MESSENGER_ATTACHMENT_MIME_TYPES = Object.freeze(Object.keys(DEFINITIONS))

function acceptList(mimeTypes: readonly string[]) {
  const extensions = mimeTypes.flatMap((mime) => DEFINITIONS[mime]?.extensions ?? []).map((extension) => `.${extension}`)
  return [...new Set([...mimeTypes, ...extensions])].join(',')
}

export const PROFILE_IMAGE_ACCEPT = acceptList(PROFILE_IMAGE_MIME_TYPES)
export const POST_MEDIA_ACCEPT = acceptList(POST_MEDIA_MIME_TYPES)
export const MESSENGER_ATTACHMENT_ACCEPT = acceptList(MESSENGER_ATTACHMENT_MIME_TYPES)

export interface MediaReferenceInput {
  type: number
  url: string
}

/**
 * Validate the small media projection accepted by GraphQL content mutations.
 * This cannot prove ownership or inspect the stored asset; the Gateway must
 * repeat those checks. It does keep malformed/browser-local URLs and invalid
 * media enum values from reaching the request layer.
 */
export function validateMediaReferences(
  references: readonly MediaReferenceInput[] | null | undefined,
  options: { field?: string; max?: number; allowedTypes?: readonly number[] } = {},
) {
  const field = options.field ?? 'media'
  const max = options.max ?? MEDIA_LIMITS.selectionCount
  const allowedTypes = options.allowedTypes ?? [0, 1]
  const values = references ?? []
  if (values.length > max) {
    throw new InputValidationError('too_long', field, { max, actual: values.length })
  }
  values.forEach((reference, index) => {
    if (!Number.isInteger(reference?.type) || !allowedTypes.includes(reference.type)) {
      throw new InputValidationError('invalid_characters', `${field}[${index}]`)
    }
    const rawUrl = typeof reference?.url === 'string' ? reference.url : ''
    const url = rawUrl.trim()
    if (!url || rawUrl !== url || url.length > 2048 || containsForbiddenInput(url)) {
      throw new InputValidationError('invalid_characters', `${field}[${index}]`)
    }
    if (url.startsWith('//')) {
      throw new InputValidationError('invalid_characters', `${field}[${index}]`)
    }
    if (!url.startsWith('/')) {
      try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          throw new Error('unsupported media URL scheme')
        }
      } catch {
        throw new InputValidationError('invalid_characters', `${field}[${index}]`)
      }
    }
  })
}

const inspectionCache = new WeakMap<File, Promise<{ mime: string; definition: MediaDefinition }>>()
const imageDimensionsCache = new WeakMap<File, Promise<{ width: number; height: number }>>()

function extensionOf(fileName: string) {
  const leaf = fileName.replace(/\\/g, '/').split('/').pop() ?? ''
  const dot = leaf.lastIndexOf('.')
  return dot > 0 && dot < leaf.length - 1 ? leaf.slice(dot + 1).toLowerCase() : ''
}

async function readHeader(file: File) {
  return new Uint8Array(await file.slice(0, 64).arrayBuffer())
}

async function decodeImage(file: File) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    try {
      return { width: bitmap.width, height: bitmap.height }
    } finally {
      bitmap.close()
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    if (typeof image.decode === 'function') {
      await image.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Image decode failed'))
      })
    }
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function inspectMediaFile(file: File, mime: string, definition: MediaDefinition) {
  const cached = inspectionCache.get(file)
  if (cached) return cached
  const inspection = (async () => {
    if (file.size <= 0) throw new MediaValidationError('empty', file)
    if (!definition.extensions.includes(extensionOf(file.name))) {
      throw new MediaValidationError('type_mismatch', file)
    }
    if (file.size > definition.maxBytes) {
      throw new MediaValidationError('too_large', file, definition.maxBytes)
    }
    const bytes = await readHeader(file)
    if (!definition.signature(bytes)) {
      throw new MediaValidationError('invalid_signature', file)
    }
    return { mime, definition }
  })()
  inspectionCache.set(file, inspection)
  return inspection
}

function decodedImageDimensions(file: File) {
  const cached = imageDimensionsCache.get(file)
  if (cached) return cached
  const dimensions = decodeImage(file)
  imageDimensionsCache.set(file, dimensions)
  return dimensions
}

export async function validateMediaFile(file: File, options: {
  allowedMimeTypes?: readonly string[]
  decodeImage?: boolean
} = {}) {
  const declaredMime = file.type.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  const genericMime = declaredMime === ''
    || declaredMime === 'application/octet-stream'
    || declaredMime === 'application/zip'
    || declaredMime === 'application/x-zip-compressed'
  const inferredMime = genericMime
    ? Object.entries(DEFINITIONS).find(([, candidate]) => candidate.extensions.includes(extensionOf(file.name)))?.[0]
    : undefined
  const mime = inferredMime ?? declaredMime
  const definition = DEFINITIONS[mime]
  if (!definition || (options.allowedMimeTypes && !options.allowedMimeTypes.includes(mime))) {
    throw new MediaValidationError('unsupported_type', file)
  }
  await inspectMediaFile(file, mime, definition)

  let dimensions: { width: number; height: number } | null = null
  if (definition.kind === 'image' && options.decodeImage !== false) {
    try {
      dimensions = await decodedImageDimensions(file)
    } catch {
      throw new MediaValidationError('unreadable_image', file)
    }
    if (
      dimensions.width <= 0
      || dimensions.height <= 0
      || dimensions.width > MEDIA_LIMITS.imageMaxDimension
      || dimensions.height > MEDIA_LIMITS.imageMaxDimension
      || dimensions.width * dimensions.height > MEDIA_LIMITS.imageMaxPixels
    ) {
      throw new MediaValidationError('image_dimensions', file, MEDIA_LIMITS.imageMaxPixels)
    }
  }

  return { file, mime, kind: definition.kind, dimensions }
}

export async function validateMediaFiles(files: readonly File[], options: {
  allowedMimeTypes?: readonly string[]
  decodeImage?: boolean
  concurrency?: number
} = {}) {
  const outcomes: Array<{
    file: File
    value: Awaited<ReturnType<typeof validateMediaFile>> | null
    error: MediaValidationError | null
  }> = new Array(files.length)
  let nextIndex = 0
  const concurrency = Math.max(1, Math.min(files.length || 1, Math.trunc(options.concurrency ?? 2)))
  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIndex < files.length) {
      const index = nextIndex
      nextIndex += 1
      const file = files[index]
      try {
        const value = await validateMediaFile(file, options)
        outcomes[index] = { file, value, error: null }
      } catch (error) {
        outcomes[index] = {
          file,
          value: null,
          error: error instanceof MediaValidationError
            ? error
            : new MediaValidationError('unsupported_type', file),
        }
      }
    }
  })
  await Promise.all(workers)
  return outcomes
}

export function isMediaValidationError(error: unknown): error is MediaValidationError {
  return error instanceof MediaValidationError
}

export function mediaValidationMessage(
  error: unknown,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (!(error instanceof MediaValidationError)) return t('invalidMediaFile')
  if (error.code === 'empty') return t('mediaFileEmpty')
  if (error.code === 'too_large') {
    return t('mediaFileTooLarge', { max: Math.round((error.limit ?? 0) / 1024 / 1024) })
  }
  if (error.code === 'unsupported_type') return t('mediaFileUnsupported')
  if (error.code === 'type_mismatch' || error.code === 'invalid_signature') return t('mediaFileMismatch')
  if (error.code === 'image_dimensions') return t('mediaImageDimensions')
  return t('mediaImageUnreadable')
}

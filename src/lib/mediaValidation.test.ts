import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MEDIA_LIMITS,
  MediaValidationError,
  PROFILE_IMAGE_MIME_TYPES,
  validateMediaFile,
  validateMediaReferences,
} from './mediaValidation'

function file(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('mediaValidation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('accepts a real, decodable PNG avatar', async () => {
    const close = vi.fn()
    const createBitmap = vi.fn().mockResolvedValue({ width: 800, height: 800, close })
    vi.stubGlobal('createImageBitmap', createBitmap)
    const png = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'avatar.png', 'image/png')
    await expect(validateMediaFile(png, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES })).resolves.toMatchObject({ kind: 'image' })
    await expect(validateMediaFile(png, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES })).resolves.toMatchObject({ kind: 'image' })
    expect(createBitmap).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalled()
  })

  it('rejects a renamed document and mismatched MIME/extension', async () => {
    const fake = file([0x25, 0x50, 0x44, 0x46, 0x2d], 'avatar.png', 'image/png')
    await expect(validateMediaFile(fake, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES, decodeImage: false })).rejects.toMatchObject({ code: 'invalid_signature' })
    const mismatch = file([0xff, 0xd8, 0xff], 'avatar.png', 'image/jpeg')
    await expect(validateMediaFile(mismatch, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES, decodeImage: false })).rejects.toMatchObject({ code: 'type_mismatch' })
  })

  it('rejects empty, unsupported, oversized, corrupt, and excessive-dimension images', async () => {
    await expect(validateMediaFile(new File([], 'empty.png', { type: 'image/png' }))).rejects.toMatchObject({ code: 'empty' })
    await expect(validateMediaFile(file([0x3c, 0x73, 0x76, 0x67], 'avatar.svg', 'image/svg+xml'))).rejects.toMatchObject({ code: 'unsupported_type' })

    const oversized = new File([new Uint8Array(MEDIA_LIMITS.standardBytes + 1)], 'avatar.jpg', { type: 'image/jpeg' })
    await expect(validateMediaFile(oversized, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES, decodeImage: false })).rejects.toMatchObject({ code: 'too_large' })

    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    const corrupt = file([0xff, 0xd8, 0xff], 'avatar.jpg', 'image/jpeg')
    await expect(validateMediaFile(corrupt, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES })).rejects.toMatchObject({ code: 'unreadable_image' })

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 20_000, height: 20_000, close: vi.fn() }))
    const excessive = file([0xff, 0xd8, 0xff], 'excessive.jpg', 'image/jpeg')
    await expect(validateMediaFile(excessive, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES })).rejects.toBeInstanceOf(MediaValidationError)
    await expect(validateMediaFile(excessive, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES })).rejects.toMatchObject({ code: 'image_dimensions' })
  })

  it('infers generic browser MIME values from a verified extension and signature', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 64, height: 64, close: vi.fn() }))
    const genericPng = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'avatar.png', 'application/octet-stream')
    await expect(validateMediaFile(genericPng, { allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES })).resolves.toMatchObject({ mime: 'image/png', kind: 'image' })
    const genericDocx = file([0x50, 0x4b, 0x03, 0x04], 'document.docx', 'application/zip')
    await expect(validateMediaFile(genericDocx, { decodeImage: false })).resolves.toMatchObject({
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      kind: 'document',
    })
  })

  it('requires an MP4-compatible ISO brand instead of accepting every ftyp container', async () => {
    const validMp4 = file([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 'clip.mp4', 'video/mp4')
    await expect(validateMediaFile(validMp4, { decodeImage: false })).resolves.toMatchObject({ kind: 'video' })

    const avifRenamedAsVideo = file([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 'clip.mp4', 'video/mp4')
    await expect(validateMediaFile(avifRenamedAsVideo, { decodeImage: false })).rejects.toMatchObject({ code: 'invalid_signature' })

    const validAvif = file([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 'photo.avif', 'image/avif')
    await expect(validateMediaFile(validAvif, { decodeImage: false })).resolves.toMatchObject({ kind: 'image' })

    const compatibleAvif = file([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31, 0, 0, 0, 0, 0x61, 0x76, 0x69, 0x66], 'compatible.avif', 'image/avif')
    await expect(validateMediaFile(compatibleAvif, { decodeImage: false })).resolves.toMatchObject({ kind: 'image' })

    const audioRenamedAsVideo = file([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20], 'audio.mp4', 'video/mp4')
    await expect(validateMediaFile(audioRenamedAsVideo, { decodeImage: false })).rejects.toMatchObject({ code: 'invalid_signature' })
  })

  it('rejects malformed media mutation references before GraphQL', () => {
    expect(() => validateMediaReferences([{ type: 0, url: '/media/photo.jpg' }])).not.toThrow()
    expect(() => validateMediaReferences([{ type: 2, url: '/media/audio.mp3' }], { allowedTypes: [0, 1] })).toThrow()
    expect(() => validateMediaReferences([{ type: 0, url: 'blob:https://fakebook.local/id' }])).toThrow()
    expect(() => validateMediaReferences(Array.from({ length: MEDIA_LIMITS.selectionCount + 1 }, (_, index) => ({ type: 0, url: `/media/${index}.jpg` })))).toThrow()
  })
})

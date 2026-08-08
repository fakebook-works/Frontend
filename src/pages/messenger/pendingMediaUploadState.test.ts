// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPendingMediaUploadPreviews,
  releasePendingMediaUploadPreviews,
} from './pendingMediaUploadState'

function pngFile(name = 'photo.png') {
  return new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ], name, { type: 'image/png' })
}

describe('pending Messenger media validation', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 640, height: 480, close: vi.fn() }))
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('creates previews only after an attachment passes signature and decode checks', async () => {
    const result = await createPendingMediaUploadPreviews([pngFile()])

    expect(result.errors).toEqual([])
    expect(result.previews).toHaveLength(1)
    expect(result.previews[0].attachment).toMatchObject({
      type: 'image',
      contentType: 'image/png',
      name: 'photo.png',
    })
    expect(URL.createObjectURL).toHaveBeenCalledOnce()

    releasePendingMediaUploadPreviews(result.previews)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('rejects mismatched content without creating a preview URL', async () => {
    const renamedPdf = new File([
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
    ], 'photo.png', { type: 'image/png' })

    const result = await createPendingMediaUploadPreviews([renamedPdf])

    expect(result.previews).toEqual([])
    expect(result.errors[0]).toMatchObject({ code: 'invalid_signature', fileName: 'photo.png' })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

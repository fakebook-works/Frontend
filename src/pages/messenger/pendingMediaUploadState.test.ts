// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPendingMediaUploadPreviews,
  releasePendingMediaUploadPreviews,
} from './pendingMediaUploadState'

describe('pending Messenger media preview lifecycle', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  it('releases each preview URL at most once', () => {
    const previews = createPendingMediaUploadPreviews([
      new File(['image'], 'photo.png', { type: 'image/png' }),
    ])

    expect(previews).toHaveLength(1)
    expect(previews[0].attachment).toMatchObject({
      type: 'image',
      contentType: 'image/png',
      name: 'photo.png',
    })
    expect(URL.createObjectURL).toHaveBeenCalledOnce()

    releasePendingMediaUploadPreviews(previews)
    releasePendingMediaUploadPreviews(previews)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})

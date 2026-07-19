// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORY_IMAGE_HEIGHT, STORY_IMAGE_WIDTH, createEditedStoryImage } from './storyImage'

describe('createEditedStoryImage', () => {
  const context = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
  }

  beforeEach(() => {
    Object.values(context).forEach((value) => {
      if (typeof value === 'function' && 'mockClear' in value) value.mockClear()
    })

    class FakeImage {
      decoding = ''
      naturalWidth = 1000
      naturalHeight = 500
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }

    vi.stubGlobal('Image', FakeImage)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:source-image'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exports a centered 1080x1920 image using contain, zoom and rotation', async () => {
    const source = new File([new Uint8Array([9])], 'holiday.png', { type: 'image/png' })

    const result = await createEditedStoryImage(source, { zoom: 1.5, rotation: 90 })

    expect(result.name).toBe('holiday-story-edited.jpg')
    expect(result.type).toBe('image/jpeg')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, STORY_IMAGE_WIDTH, STORY_IMAGE_HEIGHT)
    expect(context.translate).toHaveBeenCalledWith(540, 960)
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(context.scale).toHaveBeenCalledWith(1.5, 1.5)
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), -540, -270, 1080, 540)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source-image')
  })

  it('rejects non-image files before creating a canvas', async () => {
    const source = new File([new Uint8Array([9])], 'story.mp4', { type: 'video/mp4' })

    await expect(createEditedStoryImage(source)).rejects.toThrow('Only image files')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

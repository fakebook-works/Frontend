import { describe, expect, it, vi } from 'vitest'
import { clipboardImageFiles } from './clipboardMedia'

function clipboardData(items: Array<{ kind: string; type: string; getAsFile: () => File | null }>, files: File[] = []) {
  return { items, files } as unknown as DataTransfer
}

describe('clipboardImageFiles', () => {
  it('prefers copied binary images over an accompanying URL payload', () => {
    const image = new File(['image'], 'copied.png', { type: 'image/png' })
    const getImage = vi.fn(() => image)
    const result = clipboardImageFiles(clipboardData([
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: getImage },
    ], [image]))

    expect(result).toEqual([image])
    expect(getImage).toHaveBeenCalledTimes(1)
  })

  it('falls back to clipboard files and ignores non-images', () => {
    const image = new File(['image'], 'copied.webp', { type: 'image/webp' })
    const documentFile = new File(['document'], 'notes.txt', { type: 'text/plain' })

    expect(clipboardImageFiles(clipboardData([], [documentFile, image]))).toEqual([image])
  })

  it('adds a safe extension when clipboard providers omit the filename', () => {
    const image = new File(['image'], '', { type: 'image/jpeg' })
    const [result] = clipboardImageFiles(clipboardData([
      { kind: 'file', type: 'image/jpeg', getAsFile: () => image },
    ]))

    expect(result.name).toBe('clipboard-image-1.jpg')
    expect(result.type).toBe('image/jpeg')
  })
})

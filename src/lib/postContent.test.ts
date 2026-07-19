import { describe, expect, it } from 'vitest'
import {
  decodePostContent,
  encodePostContent,
  getPostBackgroundPreset,
} from './postContent'

describe('postContent', () => {
  it('round-trips visible text and an approved background preset', () => {
    const encoded = encodePostContent('  Một bài viết mới  ', 'violet')

    expect(encoded).toBe('[[post-bg:v1:violet]]\nMột bài viết mới')
    expect(decodePostContent(encoded)).toEqual({
      text: 'Một bài viết mới',
      backgroundId: 'violet',
      hasBackgroundMetadata: true,
    })
  })

  it('keeps ordinary and multiline post content unchanged', () => {
    const content = 'Dòng đầu\nDòng thứ hai'

    expect(encodePostContent(content)).toBe(content)
    expect(decodePostContent(content)).toEqual({
      text: content,
      backgroundId: null,
      hasBackgroundMetadata: false,
    })
  })

  it('strips recognized metadata with an unknown preset without applying it as CSS', () => {
    expect(decodePostContent('[[post-bg:v1:unknown]]\nNội dung an toàn')).toEqual({
      text: 'Nội dung an toàn',
      backgroundId: null,
      hasBackgroundMetadata: false,
    })
  })

  it('leaves malformed user text untouched', () => {
    const malformed = '[[post-bg:v1:ocean]\nNội dung cũ'
    expect(decodePostContent(malformed).text).toBe(malformed)
  })

  it('only exposes CSS values from the local preset list', () => {
    expect(getPostBackgroundPreset('ocean')?.background).toContain('linear-gradient')
    expect(getPostBackgroundPreset(null)).toBeNull()
  })
})

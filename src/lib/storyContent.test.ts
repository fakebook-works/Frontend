import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STORY_BACKGROUND,
  decodeStoryContent,
  encodeStoryContent,
} from './storyContent'

describe('storyContent', () => {
  it('round-trips text and an allowed background color', () => {
    const encoded = encodeStoryContent('  Một tin mới  ', '#7c3aed')

    expect(encoded).toBe('[[story-bg:#7c3aed]]\nMột tin mới')
    expect(decodeStoryContent(encoded)).toEqual({
      text: 'Một tin mới',
      backgroundColor: '#7c3aed',
      hasBackgroundMetadata: true,
    })
  })

  it('uses the default background when encoding an unsupported color', () => {
    expect(encodeStoryContent('Hello', '#ffffff')).toBe(`[[story-bg:${DEFAULT_STORY_BACKGROUND}]]\nHello`)
  })

  it('keeps legacy story content unchanged', () => {
    expect(decodeStoryContent('Legacy story')).toEqual({
      text: 'Legacy story',
      backgroundColor: DEFAULT_STORY_BACKGROUND,
      hasBackgroundMetadata: false,
    })
  })

  it('does not apply malformed or unapproved metadata as CSS', () => {
    const raw = '[[story-bg:#ffffff]]\nDo not trust this color'
    expect(decodeStoryContent(raw)).toEqual({
      text: raw,
      backgroundColor: DEFAULT_STORY_BACKGROUND,
      hasBackgroundMetadata: false,
    })
  })
})

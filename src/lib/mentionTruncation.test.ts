import { describe, expect, it } from 'vitest'
import { buildMentionTruncationMap } from './mentionTruncation'

describe('buildMentionTruncationMap', () => {
  it('keeps mention tokens atomic while mapping raw and visible offsets', () => {
    const content = 'A[[mention:12]]B\u{1F60A}'
    const result = buildMentionTruncationMap(content, [{ userId: '12', name: 'Bob', available: true }], 'User')

    expect(result.display).toBe('ABobB\u{1F60A}')
    expect(result.rawOffsets).toEqual([0, 1, 15, 16, 18])
    expect(result.displayOffsets).toEqual([0, 1, 4, 5, 7])
    expect(content.slice(0, result.rawOffsets[2])).toBe('A[[mention:12]]')
    expect(result.display.slice(0, result.displayOffsets[2])).toBe('ABob')
  })

  it('stores linear numeric offsets instead of every cumulative string prefix', () => {
    const content = 'x'.repeat(20_000)
    const result = buildMentionTruncationMap(content, [], 'User')

    expect(result.display).toBe(content)
    expect(result.rawOffsets).toHaveLength(content.length + 1)
    expect(result.displayOffsets).toHaveLength(content.length + 1)
    expect(result.rawOffsets.every((offset) => typeof offset === 'number')).toBe(true)
    expect(result.displayOffsets.every((offset) => typeof offset === 'number')).toBe(true)
  })
})

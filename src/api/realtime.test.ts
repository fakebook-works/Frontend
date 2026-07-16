// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseSseFrames } from './realtime'

describe('GraphQL over SSE parser', () => {
  it('parses complete data frames and preserves an incomplete tail', () => {
    const parsed = parseSseFrames('event: next\r\ndata: {"data":{"value":1}}\r\n\r\ndata: {"data"')
    expect(parsed.payloads).toEqual(['{"data":{"value":1}}'])
    expect(parsed.remainder).toBe('data: {"data"')
  })

  it('joins multi-line data fields', () => {
    expect(parseSseFrames('data: first\ndata: second\n\n').payloads).toEqual(['first\nsecond'])
  })
})

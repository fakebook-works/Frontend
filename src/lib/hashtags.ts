export type HashtagTextSegment =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string }

const HASHTAG_PATTERN = /(^|[^\p{L}\p{M}\p{N}_#])(#[\p{L}\p{M}\p{N}_]+)/gu

/** Splits plain text without interpreting URLs or producing HTML. */
export function parseHashtagText(value: string): HashtagTextSegment[] {
  const segments: HashtagTextSegment[] = []
  let cursor = 0

  for (const match of value.matchAll(HASHTAG_PATTERN)) {
    const offset = match.index ?? 0
    const hashtagOffset = offset + match[1].length
    if (hashtagOffset > cursor) segments.push({ type: 'text', value: value.slice(cursor, hashtagOffset) })
    segments.push({ type: 'hashtag', value: match[2] })
    cursor = hashtagOffset + match[2].length
  }

  if (cursor < value.length) segments.push({ type: 'text', value: value.slice(cursor) })
  return segments.length > 0 ? segments : [{ type: 'text', value }]
}

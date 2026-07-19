import type { UserSummary } from '../api/types'

const MENTION_TOKEN_SOURCE = '\\[\\[mention:([1-9]\\d*)\\]\\]'
const MAX_LONG_ID = 9_223_372_036_854_775_807n

export interface ActiveMention {
  start: number
  end: number
  query: string
}

export interface MentionEntity {
  userId: string
  displayName: string
  start: number
  end: number
}

export interface MentionDisplayUser {
  userId: string
  name: string
  available: boolean
}

export type MentionContentSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; userId: string }

export type MentionDraftSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; entity: MentionEntity }

function isValidMentionUserId(value: string): boolean {
  try {
    const id = BigInt(value)
    return id > 0n && id <= MAX_LONG_ID
  } catch {
    return false
  }
}

export function mentionToken(userId: string): string {
  if (!isValidMentionUserId(userId)) throw new Error('Mention user ID must be a positive 64-bit integer.')
  return `[[mention:${userId}]]`
}

export function activeMentionAt(text: string, caretIndex: number): ActiveMention | null {
  const caret = Math.max(0, Math.min(caretIndex, text.length))
  const prefix = text.slice(0, caret)
  const match = /(?:^|\s)@([^\s@]*)$/u.exec(prefix)
  if (!match) return null
  const start = match.index + (match[0].startsWith('@') ? 0 : match[0].length - match[1].length - 1)
  let end = caret
  while (end < text.length && !/\s/u.test(text[end]) && text[end] !== '@') end += 1
  return { start, end, query: match[1].toLocaleLowerCase() }
}

export function activeMention(text: string): { start: number; query: string } | null {
  const mention = activeMentionAt(text, text.length)
  return mention ? { start: mention.start, query: mention.query } : null
}

export function applyMentionSelection(text: string, mention: ActiveMention, person: UserSummary): {
  text: string
  entity: MentionEntity
  caret: number
} {
  const visibleMention = person.displayName
  const replacement = `${visibleMention} `
  return {
    text: `${text.slice(0, mention.start)}${replacement}${text.slice(mention.end)}`,
    entity: {
      userId: person.id,
      displayName: person.displayName,
      start: mention.start,
      end: mention.start + visibleMention.length,
    },
    caret: mention.start + replacement.length,
  }
}

export function reconcileMentionEntities(previousText: string, nextText: string, entities: MentionEntity[]): MentionEntity[] {
  if (previousText === nextText || entities.length === 0) return entities

  let prefixLength = 0
  const sharedLength = Math.min(previousText.length, nextText.length)
  while (prefixLength < sharedLength && previousText[prefixLength] === nextText[prefixLength]) prefixLength += 1

  let suffixLength = 0
  while (
    suffixLength < previousText.length - prefixLength &&
    suffixLength < nextText.length - prefixLength &&
    previousText[previousText.length - suffixLength - 1] === nextText[nextText.length - suffixLength - 1]
  ) suffixLength += 1

  const previousEditEnd = previousText.length - suffixLength
  const delta = nextText.length - previousText.length
  return entities.flatMap((entity) => {
    if (entity.end <= prefixLength) return [entity]
    if (entity.start >= previousEditEnd) return [{ ...entity, start: entity.start + delta, end: entity.end + delta }]
    return []
  })
}

export function serializeMentionContent(text: string, entities: MentionEntity[]): string {
  const valid = [...entities]
    .filter((entity) => isValidMentionUserId(entity.userId) && text.slice(entity.start, entity.end) === entity.displayName)
    .sort((left, right) => left.start - right.start)
    .filter((entity, index, values) => index === 0 || values[index - 1].end <= entity.start)

  let result = text
  for (const entity of valid.reverse()) {
    result = `${result.slice(0, entity.start)}${mentionToken(entity.userId)}${result.slice(entity.end)}`
  }
  return result
}

export function parseMentionDraft(text: string, entities: MentionEntity[]): MentionDraftSegment[] {
  const valid = [...entities]
    .filter((entity) => entity.start >= 0 && entity.end > entity.start && text.slice(entity.start, entity.end) === entity.displayName)
    .sort((left, right) => left.start - right.start)
    .filter((entity, index, values) => index === 0 || values[index - 1].end <= entity.start)
  if (valid.length === 0) return [{ type: 'text', value: text }]

  const segments: MentionDraftSegment[] = []
  let cursor = 0
  for (const entity of valid) {
    if (entity.start > cursor) segments.push({ type: 'text', value: text.slice(cursor, entity.start) })
    segments.push({ type: 'mention', entity })
    cursor = entity.end
  }
  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) })
  return segments
}

export function extractMentionUserIds(content: string): string[] {
  const ids = new Set<string>()
  const pattern = new RegExp(MENTION_TOKEN_SOURCE, 'g')
  for (const match of content.matchAll(pattern)) {
    if (isValidMentionUserId(match[1])) ids.add(match[1])
  }
  return [...ids]
}

export function parseMentionContent(content: string): MentionContentSegment[] {
  const segments: MentionContentSegment[] = []
  const pattern = new RegExp(MENTION_TOKEN_SOURCE, 'g')
  let cursor = 0
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push({ type: 'text', value: content.slice(cursor, index) })
    if (isValidMentionUserId(match[1])) segments.push({ type: 'mention', userId: match[1] })
    else segments.push({ type: 'text', value: match[0] })
    cursor = index + match[0].length
  }
  if (cursor < content.length) segments.push({ type: 'text', value: content.slice(cursor) })
  return segments.length > 0 ? segments : [{ type: 'text', value: content }]
}

import { describe, expect, it } from 'vitest'
import { activeMention, activeMentionAt, applyMentionSelection, extractMentionUserIds, parseMentionContent, parseMentionDraft, reconcileMentionEntities, serializeMentionContent } from './mentions'

const person = { id: '9007199254740993124', username: 'lan', displayName: 'Lan Nguyen', avatarUrl: null }

describe('mention content tokens', () => {
  it('finds a mention at the caret without treating an email as a mention', () => {
    expect(activeMentionAt('Hello @La world', 9)).toEqual({ start: 6, end: 9, query: 'la' })
    expect(activeMention('mail@example.com')).toBeNull()
  })

  it('serializes a selected display label to an ID-only token', () => {
    const selected = applyMentionSelection('Hello @La!', { start: 6, end: 9, query: 'la' }, person)
    expect(selected.text).toBe('Hello Lan Nguyen !')
    expect(serializeMentionContent(selected.text, [selected.entity])).toBe('Hello [[mention:9007199254740993124]] !')
    expect(parseMentionDraft(selected.text, [selected.entity])).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'mention', entity: selected.entity },
      { type: 'text', value: ' !' },
    ])
  })

  it('shifts mentions for outside edits and removes a mention edited from within', () => {
    const entity = { userId: person.id, displayName: person.displayName, start: 6, end: 16 }
    expect(reconcileMentionEntities('Hello Lan Nguyen', 'Hey Hello Lan Nguyen', [entity])).toEqual([{ ...entity, start: 10, end: 20 }])
    expect(reconcileMentionEntities('Hello Lan Nguyen', 'Hello Lan XNguyen', [entity])).toEqual([])
  })

  it('parses repeated tokens while returning unique user IDs', () => {
    const content = 'A [[mention:12]] B [[mention:12]] C [[mention:13]]'
    expect(extractMentionUserIds(content)).toEqual(['12', '13'])
    expect(parseMentionContent(content).filter((segment) => segment.type === 'mention')).toHaveLength(3)
  })
})

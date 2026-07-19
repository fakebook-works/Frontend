import { describe, expect, it } from 'vitest'
import type { MessengerMessageDto, UserSummary } from '../../api/types'
import { encodeMessengerLike, formatPresence, formatTime, messageGroupPosition, messengerLikeLevel, messengerMessagePreview, shouldShowAvatar, shouldShowTimestamp } from './helpers'

const alice: UserSummary = { id: '1', username: 'alice', displayName: 'Alice', avatarUrl: null }
const bob: UserSummary = { id: '2', username: 'bob', displayName: 'Bob', avatarUrl: null }

function message(id: string, sender: UserSummary, minute: number): MessengerMessageDto {
  return {
    id,
    conversationId: 'conversation-1',
    sender,
    body: id,
    createdAt: new Date(Date.UTC(2026, 6, 18, 12, minute)).toISOString(),
    status: 'sent',
    attachments: [],
  }
}

describe('message grouping', () => {
  it('formats message clocks with a 24-hour value', () => {
    const today = new Date()
    today.setHours(13, 5, 0, 0)
    expect(formatTime(today.toISOString())).toBe('13:05')
  })

  it('groups consecutive messages from one sender and shows the avatar only at the end', () => {
    const messages = [message('one', alice, 0), message('two', alice, 1), message('three', alice, 2)]

    expect(messages.map((_, index) => messageGroupPosition(messages, index))).toEqual(['start', 'middle', 'end'])
    expect(messages.map((_, index) => shouldShowAvatar(messages, index))).toEqual([false, false, true])
  })

  it('starts a new bubble group when the sender changes or the time gap is too large', () => {
    const senderChange = [message('one', alice, 0), message('two', bob, 1)]
    expect(senderChange.map((_, index) => messageGroupPosition(senderChange, index))).toEqual(['single', 'single'])

    const timeGap = [message('one', alice, 0), message('two', alice, 6)]
    expect(timeGap.map((_, index) => messageGroupPosition(timeGap, index))).toEqual(['single', 'single'])
    expect(timeGap.map((_, index) => shouldShowAvatar(timeGap, index))).toEqual([true, true])
  })

  it('shows a centered timestamp after a long pause', () => {
    const messages = [message('one', alice, 0), message('two', alice, 16)]
    expect(shouldShowTimestamp(messages, 0)).toBe(true)
    expect(shouldShowTimestamp(messages, 1)).toBe(true)
  })
})

describe('presence formatting', () => {
  const t = (key: string, values?: Record<string, string | number>) => values?.count === undefined
    ? key
    : `${key}:${values.count}`

  it('uses online state and real last-active timestamps', () => {
    const now = Date.UTC(2026, 6, 18, 12, 0)
    expect(formatPresence({ userId: '2', isOnline: true, expiresAt: null, updatedAt: new Date(now).toISOString() }, t, now)).toBe('activeNow')
    expect(formatPresence({ userId: '2', isOnline: false, expiresAt: null, updatedAt: new Date(now - 35 * 60_000).toISOString() }, t, now)).toBe('activeMinutesAgo:35')
  })
})

describe('Messenger like messages', () => {
  it('round-trips all three hold levels and keeps conversation previews readable', () => {
    expect([1, 2, 3].map((level) => messengerLikeLevel(encodeMessengerLike(level as 1 | 2 | 3)))).toEqual([1, 2, 3])
    expect(messengerMessagePreview(encodeMessengerLike(3))).toBe('👍')
    expect(messengerLikeLevel('ordinary message')).toBeNull()
    expect(messengerMessagePreview('ordinary message')).toBe('ordinary message')
  })
})

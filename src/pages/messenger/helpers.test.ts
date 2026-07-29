import { describe, expect, it } from 'vitest'
import type { MessengerMessageDto, UserSummary } from '../../api/types'
import { encodeMessengerLike, formatPresence, formatTime, messageGroupPosition, messengerConversationPreview, messengerLikeLevel, messengerMessagePreview, shouldShowAvatar, shouldShowTimestamp, type MessageVisualBreaks } from './helpers'

const alice: UserSummary = { id: '1', username: 'alice', displayName: 'Alice', avatarUrl: null }
const bob: UserSummary = { id: '2', username: 'bob', displayName: 'Bob', avatarUrl: null }

function message(id: string, sender: UserSummary, minute: number): MessengerMessageDto {
  return {
    id,
    conversationId: 'conversation-1',
    sequence: String(minute + 1),
    sender,
    body: id,
    createdAt: new Date(Date.UTC(2026, 6, 18, 12, minute)).toISOString(),
    status: 'sent',
    attachments: [],
  }
}

const none: MessageVisualBreaks = {
  beforeMessageIds: new Set(),
  afterMessageIds: new Set(),
}

describe('message grouping', () => {
  const messages = [message('a', alice, 0), message('b', alice, 1), message('c', alice, 2)]

  it('formats message clocks with a 24-hour value', () => {
    const today = new Date()
    today.setHours(13, 5, 0, 0)
    expect(formatTime(today.toISOString())).toBe('13:05')
  })

  it('groups consecutive messages normally when no receipt or edit marker interrupts them', () => {
    expect(messages.map((_, index) => messageGroupPosition(messages, index, none)))
      .toEqual(['start', 'middle', 'end'])
    expect(shouldShowAvatar(messages, 0, none)).toBe(false)
    expect(shouldShowAvatar(messages, 2, none)).toBe(true)
  })

  it('splits a group after the message that renders a read receipt', () => {
    const receiptAfterFirst: MessageVisualBreaks = {
      beforeMessageIds: new Set(),
      afterMessageIds: new Set(['a']),
    }

    expect(messages.map((_, index) => messageGroupPosition(messages, index, receiptAfterFirst)))
      .toEqual(['single', 'start', 'end'])
  })

  it('regroups automatically after the receipt moves to the newest message', () => {
    const receiptAfterNewest: MessageVisualBreaks = {
      beforeMessageIds: new Set(),
      afterMessageIds: new Set(['c']),
    }

    expect(messages.map((_, index) => messageGroupPosition(messages, index, receiptAfterNewest)))
      .toEqual(['start', 'middle', 'end'])
  })

  it('starts a fresh group for a message carrying an edit marker', () => {
    const editBeforeSecond: MessageVisualBreaks = {
      beforeMessageIds: new Set(['b']),
      afterMessageIds: new Set(),
    }

    expect(messages.map((_, index) => messageGroupPosition(messages, index, editBeforeSecond)))
      .toEqual(['single', 'start', 'end'])
  })

  it('starts a new bubble group when the sender changes or the time gap is too large', () => {
    const senderChange = [message('one', alice, 0), message('two', bob, 1)]
    expect(senderChange.map((_, index) => messageGroupPosition(senderChange, index))).toEqual(['single', 'single'])

    const timeGap = [message('one', alice, 0), message('two', alice, 6)]
    expect(timeGap.map((_, index) => messageGroupPosition(timeGap, index))).toEqual(['single', 'single'])
    expect(timeGap.map((_, index) => shouldShowAvatar(timeGap, index))).toEqual([true, true])
  })

  it('shows a centered timestamp after a long pause', () => {
    const paused = [message('one', alice, 0), message('two', alice, 16)]
    expect(shouldShowTimestamp(paused, 0)).toBe(true)
    expect(shouldShowTimestamp(paused, 1)).toBe(true)
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

describe('conversation message previews', () => {
  const t = (key: string, values?: Record<string, string | number>) => values?.count === undefined
    ? key
    : `${key}:${values.count}`

  it('uses attachment metadata when the newest message has no text body', () => {
    const base = message('media', bob, 0)
    expect(messengerConversationPreview({ ...base, body: '', attachments: [{ url: '/photo.jpg', type: 'image', contentType: 'image/jpeg', size: 1, name: 'photo.jpg' }] }, t)).toBe('sentPhotoPreview')
    expect(messengerConversationPreview({ ...base, body: '', attachments: [{ url: '/voice.webm', type: 'audio', contentType: 'audio/webm', size: 1, name: 'voice.webm' }] }, t)).toBe('sentVoicePreview')
    expect(messengerConversationPreview({ ...base, body: '', attachments: [{ url: '/clip.mp4', type: 'video', contentType: 'video/mp4', size: 1, name: 'clip.mp4' }] }, t)).toBe('sentVideoPreview')
    expect(messengerConversationPreview({ ...base, body: '', attachments: [{ url: '/guide.pdf', type: 'file', contentType: 'application/pdf', size: 1, name: 'guide.pdf' }] }, t)).toBe('sentFilePreview')
  })

  it('summarizes image batches and preserves ordinary text', () => {
    const base = message('media', bob, 0)
    const photos = [1, 2].map((index) => ({ url: `/photo-${index}.jpg`, type: 'image' as const, contentType: 'image/jpeg', size: 1, name: `photo-${index}.jpg` }))
    expect(messengerConversationPreview({ ...base, body: '', attachments: photos }, t)).toBe('sentPhotosPreview:2')
    expect(messengerConversationPreview({ ...base, body: 'Caption', attachments: photos }, t)).toBe('Caption')
    expect(messengerConversationPreview(null, t)).toBe('')
  })
})

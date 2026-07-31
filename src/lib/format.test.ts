import { describe, expect, it } from 'vitest'
import { groupVisitRelativeTime, relativeTime } from './format'

describe('relativeTime', () => {
  const now = new Date('2026-07-20T12:00:00Z').getTime()

  it('formats Vietnamese conversation ages through years', () => {
    expect(relativeTime('2026-07-20T11:55:00Z', 'vi-VN', now)).toBe('5 phút trước')
    expect(relativeTime('2026-07-20T09:00:00Z', 'vi-VN', now)).toBe('3 giờ trước')
    expect(relativeTime('2026-07-06T12:00:00Z', 'vi-VN', now)).toBe('2 tuần trước')
    expect(relativeTime('2026-04-20T12:00:00Z', 'vi-VN', now)).toBe('3 tháng trước')
    expect(relativeTime('2024-07-20T12:00:00Z', 'vi-VN', now)).toBe('2 năm trước')
  })

  it('keeps the same relative units in English', () => {
    expect(relativeTime('2026-07-20T11:59:45Z', 'en', now)).toBe('Just now')
    expect(relativeTime('2025-07-20T12:00:00Z', 'en', now)).toBe('1 year ago')
  })

  it('qualifies partially elapsed hours for group visit timestamps', () => {
    expect(groupVisitRelativeTime('2026-07-20T08:46:00Z', 'vi-VN', now)).toBe('3 giờ trước')
    expect(groupVisitRelativeTime('2026-07-20T08:45:00Z', 'vi-VN', now)).toBe('khoảng 3 giờ trước')
    expect(groupVisitRelativeTime('2026-07-20T08:16:00Z', 'vi-VN', now)).toBe('khoảng 3 giờ trước')
    expect(groupVisitRelativeTime('2026-07-20T08:15:00Z', 'vi-VN', now)).toBe('gần 4 giờ trước')
    expect(groupVisitRelativeTime('2026-07-20T08:45:00Z', 'en', now)).toBe('about 3 hours ago')
  })
})

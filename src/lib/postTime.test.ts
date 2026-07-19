import { describe, expect, it } from 'vitest'
import { formatPostTimestamp } from './postTime'

describe('formatPostTimestamp', () => {
  const now = new Date(2026, 6, 19, 15, 30, 0)

  it('uses relative minutes and hours for posts created today', () => {
    expect(formatPostTimestamp(new Date(2026, 6, 19, 15, 10).toISOString(), 'vi-VN', now).display).toBe('20 phút trước')
    expect(formatPostTimestamp(new Date(2026, 6, 19, 12, 20).toISOString(), 'vi-VN', now).display).toBe('3 giờ trước')
  })

  it('uses yesterday with a 24-hour clock', () => {
    expect(formatPostTimestamp(new Date(2026, 6, 18, 9, 5).toISOString(), 'vi-VN', now).display).toBe('Hôm qua lúc 09:05')
  })

  it('omits the year inside the current year and includes it for older years', () => {
    expect(formatPostTimestamp(new Date(2026, 6, 17, 8, 15).toISOString(), 'vi-VN', now).display).toBe('17 tháng 7 lúc 08:15')
    expect(formatPostTimestamp(new Date(2025, 11, 31, 23, 45).toISOString(), 'vi-VN', now).display).toBe('31 tháng 12, 2025 lúc 23:45')
  })

  it('keeps an exact detailed value for the hover tooltip', () => {
    const timestamp = formatPostTimestamp(new Date(2026, 6, 17, 8, 15, 12).toISOString(), 'vi-VN', now)
    expect(timestamp.detail).toContain('17 tháng 7, 2026')
    expect(timestamp.detail).toContain('08:15:12')
  })

  it('falls back to the original value when the timestamp is invalid', () => {
    expect(formatPostTimestamp('unknown', 'vi-VN', now)).toEqual({ display: 'unknown', detail: 'unknown' })
  })
})

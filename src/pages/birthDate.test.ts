import { describe, expect, it } from 'vitest'
import { birthDateBounds, isAllowedBirthDate } from './birthDate'

describe('birth-date age validation', () => {
  const today = new Date(2026, 6, 15)

  it('accepts ages from 14 through 120 inclusive', () => {
    expect(isAllowedBirthDate('2012-07-15', today)).toBe(true)
    expect(isAllowedBirthDate('1905-07-16', today)).toBe(true)
  })

  it('rejects users younger than 14 or older than 120', () => {
    expect(isAllowedBirthDate('2012-07-16', today)).toBe(false)
    expect(isAllowedBirthDate('1905-07-15', today)).toBe(false)
    expect(isAllowedBirthDate('1111-01-01', today)).toBe(false)
  })

  it('provides matching HTML date-input bounds', () => {
    expect(birthDateBounds(today)).toEqual({ min: '1905-07-16', max: '2012-07-15' })
  })
})

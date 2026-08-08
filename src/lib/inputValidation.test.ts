import { describe, expect, it } from 'vitest'
import {
  InputValidationError,
  containsForbiddenInput,
  graphemeLength,
  isAllowedBirthDateInput,
  isValidDateOnlyInput,
  normalizeMultilineInput,
  normalizeSingleLineInput,
  truncateGraphemes,
  validateEmailInput,
  validatePasswordInput,
  validateTextInput,
} from './inputValidation'

describe('inputValidation', () => {
  it('counts user-perceived characters without splitting emoji or combining marks', () => {
    expect(graphemeLength('👨‍👩‍👧‍👦🇻🇳e\u0301')).toBe(3)
    expect(truncateGraphemes('a👨‍👩‍👧‍👦b', 2)).toBe('a👨‍👩‍👧‍👦')
  })

  it('normalizes Unicode, line endings, and single-line whitespace', () => {
    expect(normalizeMultilineInput(' e\u0301\r\nline 2 ')).toBe('é\nline 2')
    expect(normalizeSingleLineInput('  Fakebook\r\n  Việt Nam  ')).toBe('Fakebook Việt Nam')
  })

  it('rejects forbidden controls, bidi overrides, and lone surrogates', () => {
    expect(containsForbiddenInput('safe text')).toBe(false)
    expect(containsForbiddenInput('bad\u0000text')).toBe(true)
    expect(containsForbiddenInput('bad\u202etext')).toBe(true)
    expect(containsForbiddenInput(`bad${String.fromCharCode(0xd800)}`)).toBe(true)
  })

  it('accepts the exact grapheme boundary and rejects the next grapheme', () => {
    expect(validateTextInput('👍🏽👍🏽', { field: 'bio', max: 2 }).length).toBe(2)
    expect(() => validateTextInput('👍🏽👍🏽a', { field: 'bio', max: 2 })).toThrow(InputValidationError)
  })

  it('validates and normalizes email addresses', () => {
    expect(validateEmailInput('  USER@example.com ')).toBe('user@example.com')
    expect(() => validateEmailInput('not-an-email')).toThrow(InputValidationError)
  })

  it('rejects an all-whitespace password without trimming valid password bytes', () => {
    expect(() => validatePasswordInput('        ', { minimum: 8 })).toThrow(InputValidationError)
    expect(validatePasswordInput(' valid password ', { minimum: 8 })).toBe(' valid password ')
  })

  it('validates calendar dates and the inclusive account age range', () => {
    const today = new Date(2026, 6, 15)
    expect(isValidDateOnlyInput('2000-02-29')).toBe(true)
    expect(isValidDateOnlyInput('2001-02-29')).toBe(false)
    expect(isAllowedBirthDateInput('2012-07-15', today)).toBe(true)
    expect(isAllowedBirthDateInput('2012-07-16', today)).toBe(false)
    expect(isAllowedBirthDateInput('1905-07-16', today)).toBe(true)
    expect(isAllowedBirthDateInput('1905-07-15', today)).toBe(false)
  })
})

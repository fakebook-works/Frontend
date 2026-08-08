export const INPUT_LIMITS = {
  displayName: 50,
  bio: 101,
  location: 160,
  email: 254,
  post: 63_206,
  backgroundPost: 130,
  comment: 8_000,
  reelCaption: 2_200,
  story: 500,
  messengerMessage: 10_000,
  messengerGroupTitle: 120,
  groupName: 100,
  groupDescription: 2_000,
  mentions: 100,
} as const

export type InputValidationCode = 'required' | 'too_long' | 'too_short' | 'invalid_characters' | 'invalid_email'

export class InputValidationError extends Error {
  readonly code: InputValidationCode
  readonly field: string
  readonly max: number | null
  readonly min: number | null
  readonly actual: number | null

  constructor(code: InputValidationCode, field: string, options: { max?: number; min?: number; actual?: number } = {}) {
    super(`Invalid ${field}: ${code}`)
    this.name = 'InputValidationError'
    this.code = code
    this.field = field
    this.max = options.max ?? null
    this.min = options.min ?? null
    this.actual = options.actual ?? null
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

function hasForbiddenCodePoint(value: string) {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (
      code <= 0x08
      || code === 0x0b
      || code === 0x0c
      || (code >= 0x0e && code <= 0x1f)
      || (code >= 0x7f && code <= 0x9f)
      || (code >= 0x202a && code <= 0x202e)
      || (code >= 0x2066 && code <= 0x2069)
    ) return true
  }
  return false
}

function hasLoneSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) return true
      const next = value.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) return true
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true
    }
  }
  return false
}

type GraphemeSegmenter = { segment: (input: string) => Iterable<{ segment: string }> }

const GraphemeSegmenterConstructor = (Intl as unknown as {
  Segmenter?: new (locales?: string | string[], options?: { granularity: 'grapheme' }) => GraphemeSegmenter
}).Segmenter
const graphemeSegmenter = typeof GraphemeSegmenterConstructor === 'function'
  ? new GraphemeSegmenterConstructor(undefined, { granularity: 'grapheme' })
  : null

function *segmentGraphemes(value: string): Iterable<string> {
  if (graphemeSegmenter) {
    for (const { segment } of graphemeSegmenter.segment(value)) yield segment
    return
  }
  for (const character of value) yield character
}

export function graphemeLength(value: string) {
  let length = 0
  for (const segment of segmentGraphemes(value)) {
    if (segment.length > 0) length += 1
  }
  return length
}

export function truncateGraphemes(value: string, max: number) {
  if (max <= 0) return ''
  let length = 0
  let truncated = ''
  for (const segment of segmentGraphemes(value)) {
    if (length >= max) return truncated
    truncated += segment
    length += 1
  }
  return value
}

export function containsForbiddenInput(value: string) {
  return hasForbiddenCodePoint(value) || hasLoneSurrogate(value)
}

export function normalizeMultilineInput(value: string) {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').trim()
}

export function normalizeSingleLineInput(value: string) {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\p{Z}\t\n\f\v]+/gu, ' ')
    .trim()
}

export function validateTextInput(value: string, options: {
  field: string
  max: number
  required?: boolean
  multiline?: boolean
}) {
  if (containsForbiddenInput(value)) {
    throw new InputValidationError('invalid_characters', options.field)
  }
  const normalized = options.multiline === false
    ? normalizeSingleLineInput(value)
    : normalizeMultilineInput(value)
  const actual = graphemeLength(normalized)
  if (options.required && actual === 0) {
    throw new InputValidationError('required', options.field, { actual })
  }
  if (actual > options.max) {
    throw new InputValidationError('too_long', options.field, { max: options.max, actual })
  }
  return { value: normalized, length: actual }
}

export function validateEmailInput(value: string, field = 'email') {
  const normalized = normalizeSingleLineInput(value).toLowerCase()
  const actual = graphemeLength(normalized)
  if (!normalized) throw new InputValidationError('required', field, { actual })
  if (containsForbiddenInput(normalized) || actual > INPUT_LIMITS.email || !EMAIL_PATTERN.test(normalized)) {
    throw new InputValidationError('invalid_email', field, { max: INPUT_LIMITS.email, actual })
  }
  return normalized
}

export function validatePasswordInput(value: string, options: {
  field?: string
  minimum?: number
  maximum?: number
  required?: boolean
  rejectForbidden?: boolean
} = {}) {
  const field = options.field ?? 'password'
  const minimum = options.minimum ?? 0
  const maximum = options.maximum ?? 128
  const required = options.required ?? true
  if (typeof value !== 'string') throw new InputValidationError('required', field)
  if (required && value.trim().length === 0) throw new InputValidationError('required', field, { actual: value.length })
  if (value.length > maximum) throw new InputValidationError('too_long', field, { max: maximum, actual: value.length })
  if ((options.rejectForbidden ?? true) && containsForbiddenInput(value)) {
    throw new InputValidationError('invalid_characters', field, { actual: value.length })
  }
  if (value.length > 0 && value.length < minimum) {
    throw new InputValidationError('too_short', field, { min: minimum, actual: value.length })
  }
  return value
}

export function isValidDateOnlyInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/**
 * Birth dates accepted by the account/profile contract.  Keep this in the
 * shared validation module so API callers cannot bypass the date input's UI
 * bounds (the UI currently uses the same inclusive 14..120 range).
 */
export function isAllowedBirthDateInput(value: string, today = new Date()) {
  if (!isValidDateOnlyInput(value)) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  let age = today.getFullYear() - year
  const currentMonth = today.getMonth() + 1
  if (currentMonth < month || (currentMonth === month && today.getDate() < day)) age -= 1
  return age >= 14 && age <= 120
}

export function isInputValidationError(error: unknown): error is InputValidationError {
  return error instanceof InputValidationError
}

export function inputValidationMessage(
  error: unknown,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (!(error instanceof InputValidationError)) return t('invalidInput')
  if (error.code === 'required') return t('inputRequired')
  if (error.code === 'too_long') return t('inputTooLong', { max: error.max ?? 0 })
  if (error.code === 'too_short') return t('passwordMinimum', { min: error.min ?? 0 })
  if (error.code === 'invalid_email') return t('emailInvalid')
  return t('inputInvalidCharacters')
}

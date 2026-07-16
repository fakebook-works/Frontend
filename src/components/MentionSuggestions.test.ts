import { describe, expect, it } from 'vitest'
import { activeMention } from '../lib/mentions'

describe('activeMention', () => {
  it('finds the active query after an at sign', () => {
    expect(activeMention('Hello @Lan')).toEqual({ start: 6, query: 'lan' })
  })

  it('ignores completed mentions and email-like text', () => {
    expect(activeMention('Hello @Lan Nguyen ')).toBeNull()
    expect(activeMention('mail@example.com')).toBeNull()
  })
})

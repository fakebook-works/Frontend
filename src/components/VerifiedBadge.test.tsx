// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VerifiedBadge } from './VerifiedBadge'

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('VerifiedBadge spacing', () => {
  afterEach(() => cleanup())

  it('does not add a second gap when the name wrapper controls spacing', () => {
    render(
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <span>Uyen</span>
        <VerifiedBadge verified />
      </span>,
    )

    expect(screen.getByLabelText('verifiedAccount')).toHaveStyle({ marginLeft: '0px' })
  })

  it('keeps an explicit margin for the main profile heading', () => {
    render(<VerifiedBadge verified size={24} marginLeft={2} />)

    expect(screen.getByLabelText('verifiedAccount')).toHaveStyle({ marginLeft: '2px' })
  })

  it('does not render for unverified accounts', () => {
    render(<VerifiedBadge verified={false} />)

    expect(screen.queryByLabelText('verifiedAccount')).not.toBeInTheDocument()
  })
})

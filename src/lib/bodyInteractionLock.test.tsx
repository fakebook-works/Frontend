// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModalInteractionGuard, resetBodyInteractionLocksForTests, useBodyInteractionLock } from './bodyInteractionLock'

function Lock({ active = true, className }: { active?: boolean; className: string }) {
  useBodyInteractionLock(active, [className])
  return null
}

describe('body interaction lock', () => {
  afterEach(() => {
    cleanup()
    document.body.removeAttribute('class')
    document.body.removeAttribute('style')
    document.documentElement.removeAttribute('style')
    resetBodyInteractionLocksForTests()
  })

  it('keeps shared classes and scrolling locked until the final owner closes', () => {
    const { rerender } = render(<><Lock className="content-detail-open" /><Lock className="content-detail-open" /></>)
    expect(document.body).toHaveClass('modal-interaction-locked', 'content-detail-open')
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Lock className="content-detail-open" />)
    expect(document.body).toHaveClass('modal-interaction-locked', 'content-detail-open')

    rerender(<Lock active={false} className="content-detail-open" />)
    expect(document.body).not.toHaveClass('modal-interaction-locked', 'content-detail-open')
    expect(document.body.style.overflow).toBe('')
  })

  it('locks generic modal backdrops and blocks wheel events on their background', async () => {
    const leakedWheel = vi.fn()
    const { rerender } = render(<div onWheel={leakedWheel}><ModalInteractionGuard /><div className="modal-backdrop" data-testid="backdrop"><section className="modal" /></div></div>)
    await waitFor(() => expect(document.body).toHaveClass('modal-layer-open', 'modal-interaction-locked'))

    fireEvent.wheel(document.querySelector('[data-testid="backdrop"]')!)
    expect(leakedWheel).not.toHaveBeenCalled()

    rerender(<div><ModalInteractionGuard /></div>)
    await waitFor(() => expect(document.body).not.toHaveClass('modal-layer-open', 'modal-interaction-locked'))
  })
})

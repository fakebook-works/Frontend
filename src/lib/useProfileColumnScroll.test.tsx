/* @vitest-environment jsdom */
import { Activity, useRef } from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProfileColumnScroll } from './useProfileColumnScroll'

function ProfileColumns() {
  const pageRef = useRef<HTMLElement>(null)
  const firstColumnRef = useRef<HTMLElement>(null)
  const secondColumnRef = useRef<HTMLDivElement>(null)
  useProfileColumnScroll({
    active: true,
    pageRef,
    firstColumnRef,
    secondColumnRef,
    resetKey: 'profile-1',
  })

  return <main ref={pageRef} data-testid="profile-page">
    <section className="self-profile-destination-grid">
      <aside ref={firstColumnRef} data-testid="first-column" />
      <div ref={secondColumnRef} data-testid="second-column" />
    </section>
  </main>
}

function Harness({ visible }: { visible: boolean }) {
  return <div className="authenticated-destination-scroll" data-testid="viewport">
    <Activity mode={visible ? 'visible' : 'hidden'}><ProfileColumns /></Activity>
  </div>
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useProfileColumnScroll', () => {
  it('preserves its sticky anchor and column offsets while an Activity is hidden', async () => {
    vi.stubGlobal('innerWidth', 1024)
    let sticky = false
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { top: this.classList.contains('self-profile-destination-grid') ? (sticky ? 0 : 800) : 0 } as DOMRect
    })

    const { getByTestId, rerender } = render(<Harness visible />)
    const viewport = getByTestId('viewport')
    const page = getByTestId('profile-page')
    const firstColumn = getByTestId('first-column')
    const secondColumn = getByTestId('second-column')
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 800 },
      scrollHeight: { configurable: true, value: 2300 },
    })
    Object.defineProperties(firstColumn, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1000 },
    })
    Object.defineProperties(secondColumn, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 2000 },
    })

    act(() => window.dispatchEvent(new Event('resize')))
    await waitFor(() => expect(page.style.getPropertyValue('--profile-column-scroll-span')).toBe('1500px'))
    viewport.scrollTop = 1500
    fireEvent.scroll(viewport)
    expect(firstColumn.scrollTop).toBe(500)
    expect(secondColumn.scrollTop).toBe(700)

    sticky = true
    rerender(<Harness visible={false} />)
    expect(page.style.getPropertyValue('--profile-column-scroll-span')).toBe('1500px')
    rerender(<Harness visible />)
    fireEvent.scroll(viewport)

    expect(firstColumn.scrollTop).toBe(500)
    expect(secondColumn.scrollTop).toBe(700)
  })
})

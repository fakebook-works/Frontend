// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PostContent } from './PostContent'

vi.mock('../i18n', () => ({
  useI18n: () => ({ locale: 'en', t: (key: string) => key }),
}))

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean }>) => void

describe('PostContent truncation measurement', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('defers the expensive probe for an offscreen content-visibility card', async () => {
    const callbacks: IntersectionCallback[] = []
    class IntersectionObserverMock {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        callbacks.push((entries) => callback(entries as IntersectionObserverEntry[]))
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)

    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element instanceof HTMLElement && element.classList.contains('gateway-post')) {
        return { contentVisibility: 'auto' } as CSSStyleDeclaration
      }
      return {
        contentVisibility: 'visible',
        lineHeight: '20px',
        font: '16px sans-serif',
        fontSize: '16px',
        fontWeight: '400',
        letterSpacing: '0px',
      } as CSSStyleDeclaration
    })
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('gateway-post')) {
        return { top: 5000, bottom: 5680, left: 0, right: 600, width: 600, height: 680, x: 0, y: 5000, toJSON: () => ({}) }
      }
      return { top: 5000, bottom: 5680, left: 0, right: 600, width: 600, height: 680, x: 0, y: 5000, toJSON: () => ({}) }
    })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return (this.textContent?.length ?? 0) > 80 ? 220 : 20
    })

    render(<article className="gateway-post"><PostContent content={'Long post '.repeat(80)} mentions={[]} /></article>)

    // The card itself is checked, but the paragraph/probe layout is deferred.
    expect(rectSpy).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.post-content-toggle')).not.toBeInTheDocument()

    await act(async () => {
      callbacks[0]?.([{ isIntersecting: true }])
    })

    await waitFor(() => expect(document.querySelector('.post-content-toggle')).toHaveTextContent('seeMore'))
    expect(rectSpy.mock.calls.length).toBeGreaterThan(1)
  })

  it('keeps visible cards measured synchronously', () => {
    class IntersectionObserverMock {
      constructor() {}
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      contentVisibility: 'auto',
      lineHeight: '20px',
      font: '16px sans-serif',
      fontSize: '16px',
      fontWeight: '400',
      letterSpacing: '0px',
    } as CSSStyleDeclaration))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('gateway-post')) {
        return { top: 20, bottom: 700, left: 0, right: 600, width: 600, height: 680, x: 0, y: 20, toJSON: () => ({}) }
      }
      return { top: 20, bottom: 700, left: 0, right: 600, width: 600, height: 680, x: 0, y: 20, toJSON: () => ({}) }
    })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(20)

    const { container } = render(<article className="gateway-post"><PostContent content="Visible post" mentions={[]} /></article>)

    expect(container.querySelector('article > p')).toHaveTextContent('Visible post')
  })

  it('expands and collapses long post content from the inline toggle', async () => {
    const content = 'Long post content '.repeat(40)
    render(<PostContent content={content} mentions={[]} />)

    const expand = await screen.findByRole('button', { name: 'seeMore' })
    expect(document.querySelector('p')).not.toHaveTextContent(content)

    fireEvent.click(expand)
    expect(document.querySelector('p')).toHaveTextContent(content)
    expect(screen.getByRole('button', { name: 'seeLess' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'seeLess' }))
    expect(document.querySelector('p')).not.toHaveTextContent(content)
    expect(screen.getByRole('button', { name: 'seeMore' })).toBeInTheDocument()
  })
})

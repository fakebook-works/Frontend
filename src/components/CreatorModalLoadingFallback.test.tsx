// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreatorModalLoadingFallback } from './CreatorModalLoadingFallback'

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('CreatorModalLoadingFallback', () => {
  afterEach(cleanup)

  it('portals the story loading layer and closes from its visible control', () => {
    const onClose = vi.fn()
    render(<CreatorModalLoadingFallback kind="story" onClose={onClose} />)

    expect(document.querySelector('.story-creator-loading-backdrop')?.parentElement).toBe(document.body)
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('lets a Reel loading layer close with Escape', () => {
    const onClose = vi.fn()
    render(<CreatorModalLoadingFallback kind="reel" onClose={onClose} />)

    expect(document.querySelector('.reel-composer-backdrop')?.parentElement).toBe(document.body)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

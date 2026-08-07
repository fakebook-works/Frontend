// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoryViewerLoadingFallback } from './StoryViewerLoadingFallback'

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('StoryViewerLoadingFallback', () => {
  afterEach(cleanup)

  it('keeps the shell logo slot available and lets the first load close immediately', () => {
    const shellTarget = document.createElement('div')
    shellTarget.id = 'content-detail-shell-close-target'
    document.body.append(shellTarget)
    const onClose = vi.fn()
    const view = render(<StoryViewerLoadingFallback onClose={onClose} />)

    expect(document.body).toHaveClass('content-detail-open', 'story-viewer-open')
    const closeButton = shellTarget.querySelector<HTMLButtonElement>('.story-viewer-shell-close')
    expect(closeButton).toBeInTheDocument()
    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalledTimes(1)

    view.unmount()
    shellTarget.remove()
    expect(document.body).not.toHaveClass('content-detail-open', 'story-viewer-open')
  })
})

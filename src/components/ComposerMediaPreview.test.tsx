// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ComposerMediaPreview from './ComposerMediaPreview'

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function item(name: string, previewUrl: string) {
  return { file: new File(['image'], name, { type: 'image/jpeg' }), previewUrl }
}

function loadImage(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height })
  fireEvent.load(image)
}

describe('ComposerMediaPreview', () => {
  afterEach(cleanup)

  it('previews a tall image without stretching it and fills the side space with a backdrop', async () => {
    const { container } = render(<ComposerMediaPreview items={[item('composer-tall.jpg', '/composer-tall.jpg')]} fileKey={0} busy={false} onReplace={vi.fn()} onClear={vi.fn()} />)
    loadImage(container.querySelector<HTMLImageElement>('.home-media-content')!, 900, 1600)

    await waitFor(() => expect(container.querySelector('.home-media-slot')).toHaveClass('letterboxed'))
    expect(container.querySelector('.home-media-preview')).toHaveStyle({ aspectRatio: '0.8' })
    expect(container.querySelector('.home-media-backdrop')).toBeInTheDocument()
  })

  it('changes the upload preview to landscape rows after reading both image sizes', async () => {
    const { container } = render(<ComposerMediaPreview items={[
      item('composer-wide-a.jpg', '/composer-wide-a.jpg'),
      item('composer-wide-b.jpg', '/composer-wide-b.jpg'),
    ]} fileKey={0} busy={false} onReplace={vi.fn()} onClear={vi.fn()} />)
    container.querySelectorAll<HTMLImageElement>('.home-media-content').forEach((image) => loadImage(image, 1600, 900))

    await waitFor(() => expect(container.querySelector('.home-media-grid')).toHaveClass('layout-two-landscape-rows'))
    expect(container.querySelectorAll('.home-media-slot')).toHaveLength(2)
  })

  it('uses the two-plus-three layout and retains the overflow indicator', () => {
    const items = Array.from({ length: 7 }, (_, index) => item(`composer-${index}.jpg`, `/composer-${index}.jpg`))
    const { container, getByText } = render(<ComposerMediaPreview items={items} fileKey={0} busy={false} onReplace={vi.fn()} onClear={vi.fn()} />)

    expect(container.querySelector('.home-media-grid')).toHaveClass('layout-five-two-three')
    expect(container.querySelectorAll('.home-media-slot')).toHaveLength(5)
    expect(getByText('+2')).toBeInTheDocument()
    expect(container.querySelector('.home-media-edit-all')).not.toBeInTheDocument()
    expect(container.querySelector('.home-media-preview-controls > button')).toHaveAccessibleName('removeMedia')
  })
})

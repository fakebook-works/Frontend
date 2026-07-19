// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PostMediaGallery } from './PostMediaGallery'

function loadImage(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height })
  fireEvent.load(image)
}

describe('PostMediaGallery', () => {
  afterEach(cleanup)

  it('contains an extremely tall image inside a 4:5 frame with a blurred backdrop', async () => {
    const { container } = render(<PostMediaGallery media={[{ id: 'tall-feed', type: 0, url: '/tall-feed.jpg' }]} />)
    const foreground = container.querySelector<HTMLImageElement>('.post-media-content')!
    loadImage(foreground, 900, 1600)

    await waitFor(() => expect(container.querySelector('.post-media-slot')).toHaveClass('letterboxed'))
    expect(container.querySelector<HTMLElement>('.post-media-slot')?.style.aspectRatio).toBe('0.8 / 1')
    expect(container.querySelector('.post-media-backdrop')).toBeInTheDocument()
  })

  it('keeps a normal single-image ratio without adding a backdrop', async () => {
    const { container } = render(<PostMediaGallery media={[{ id: 'normal-feed', type: 0, url: '/normal-feed.jpg' }]} />)
    loadImage(container.querySelector<HTMLImageElement>('.post-media-content')!, 1200, 1000)

    await waitFor(() => expect(container.querySelector<HTMLElement>('.post-media-slot')?.style.aspectRatio).toBe('1.2 / 1'))
    expect(container.querySelector('.post-media-backdrop')).not.toBeInTheDocument()
  })

  it('stacks two landscape images and places two portrait images in columns', async () => {
    const landscape = render(<PostMediaGallery media={[
      { id: 'landscape-a', type: 0, url: '/landscape-a.jpg' },
      { id: 'landscape-b', type: 0, url: '/landscape-b.jpg' },
    ]} />)
    landscape.container.querySelectorAll<HTMLImageElement>('.post-media-content').forEach((image) => loadImage(image, 1600, 900))
    await waitFor(() => expect(landscape.container.querySelector('.post-media-gallery')).toHaveClass('layout-two-landscape-rows'))
    landscape.unmount()

    const portrait = render(<PostMediaGallery media={[
      { id: 'portrait-a', type: 0, url: '/portrait-a.jpg' },
      { id: 'portrait-b', type: 0, url: '/portrait-b.jpg' },
    ]} />)
    portrait.container.querySelectorAll<HTMLImageElement>('.post-media-content').forEach((image) => loadImage(image, 900, 1500))
    await waitFor(() => expect(portrait.container.querySelector('.post-media-gallery')).toHaveClass('layout-two-portrait-columns'))
  })

  it('uses the first known media orientation to choose a three-item collage', async () => {
    const { container } = render(<PostMediaGallery media={[
      { id: 'three-tall', type: 0, url: '/three-tall.jpg' },
      { id: 'three-wide-a', type: 0, url: '/three-wide-a.jpg' },
      { id: 'three-wide-b', type: 0, url: '/three-wide-b.jpg' },
    ]} />)
    const images = container.querySelectorAll<HTMLImageElement>('.post-media-content')
    loadImage(images[0], 900, 1600)
    loadImage(images[1], 1600, 900)
    loadImage(images[2], 1600, 900)

    await waitFor(() => expect(container.querySelector('.post-media-gallery')).toHaveClass('layout-three-portrait-leading'))
  })
})

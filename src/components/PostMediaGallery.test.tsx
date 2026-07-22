// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PostMediaGallery } from './PostMediaGallery'

vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: (key: string) => key }) }))

function loadImage(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height })
  fireEvent.load(image)
}

describe('PostMediaGallery', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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

  it('renders videos with the custom playback bar instead of native browser controls', async () => {
    const { container } = render(<PostMediaGallery media={[{ id: 'feed-video', type: 1, url: '/feed-video.mp4' }]} />)
    const video = container.querySelector<HTMLVideoElement>('video')!
    Object.defineProperties(video, {
      duration: { configurable: true, value: 154 },
      videoWidth: { configurable: true, value: 1280 },
      videoHeight: { configurable: true, value: 720 },
    })
    fireEvent.loadedMetadata(video)

    expect(video).not.toHaveAttribute('controls')
    expect(container.querySelector('.post-video-player')).toBeInTheDocument()
    expect(container.querySelector('.post-video-controls')).toHaveTextContent('0:00 / 2:34')
    expect(container.querySelector<HTMLInputElement>('.post-video-progress')).toHaveAttribute('max', '154')

    const settingsButton = container.querySelector<HTMLButtonElement>('.post-video-settings-wrap > button')!
    fireEvent.click(settingsButton)
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelector('.post-video-settings-menu')).toHaveTextContent('720p')
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.post-video-settings-row')[0])
    expect(container.querySelector('.post-video-quality-options')).toHaveTextContent('videoOriginalQuality')
  })

  it('keeps a silent-video volume icon crisp but non-interactive', async () => {
    const { container } = render(<PostMediaGallery media={[{ id: 'silent-feed-video', type: 1, url: '/silent-feed-video.mp4' }]} />)
    const video = container.querySelector<HTMLVideoElement>('video')!
    Object.defineProperties(video, {
      duration: { configurable: true, value: 8 },
      videoWidth: { configurable: true, value: 1280 },
      videoHeight: { configurable: true, value: 720 },
      mozHasAudio: { configurable: true, value: false },
    })
    fireEvent.loadedMetadata(video)

    const volumeButton = await waitFor(() => container.querySelector<HTMLButtonElement>('[aria-label="videoNoAudio"]')!)
    expect(volumeButton).not.toBeDisabled()
    expect(volumeButton).toHaveAttribute('aria-disabled', 'true')
    expect(container.querySelector('.post-video-volume-popover')).not.toBeInTheDocument()
    fireEvent.click(volumeButton)
    expect(video.muted).toBe(true)
  })

  it('autoplays a visible feed video, pauses it after scrolling away, and starts muted', async () => {
    let notifyIntersection: ((entries: IntersectionObserverEntry[]) => void) | null = null
    class IntersectionObserverMock {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0, 0.5, 0.68, 1]
      constructor(callback: IntersectionObserverCallback) {
        notifyIntersection = (entries) => callback(entries, this as unknown as IntersectionObserver)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const { container } = render(<PostMediaGallery media={[{ id: 'autoplay-video', type: 1, url: '/autoplay.mp4' }]} />)
    const video = container.querySelector<HTMLVideoElement>('video')!
    const player = container.querySelector<HTMLElement>('.post-video-player')!

    expect(video.muted).toBe(true)
    act(() => notifyIntersection?.([{ target: player, isIntersecting: true, intersectionRatio: 0.75 } as unknown as IntersectionObserverEntry]))
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

    act(() => notifyIntersection?.([{ target: player, isIntersecting: false, intersectionRatio: 0 } as unknown as IntersectionObserverEntry]))
    expect(pause).toHaveBeenCalled()
  })
})

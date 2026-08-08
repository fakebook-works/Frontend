// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PostVideoPlayer } from './PostVideoPlayer'

vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: (key: string) => key }) }))

function setMediaState(video: HTMLVideoElement, { src, duration, currentTime = 0, width = 1280, height = 720, readyState = 1 }: {
  src?: string
  duration: number
  currentTime?: number
  width?: number
  height?: number
  readyState?: number
}) {
  Object.defineProperties(video, {
    duration: { configurable: true, value: duration },
    currentTime: { configurable: true, writable: true, value: currentTime },
    videoWidth: { configurable: true, value: width },
    videoHeight: { configurable: true, value: height },
    readyState: { configurable: true, value: readyState },
    ...(src ? { currentSrc: { configurable: true, value: new URL(src, document.baseURI).href } } : {}),
  })
}

describe('PostVideoPlayer media lifecycle', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('recovers metadata when a reused video element already has a ready resource', () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const { container, rerender } = render(<PostVideoPlayer src="/first.mp4" autoPlay={false} />)
    const video = container.querySelector<HTMLVideoElement>('video')!

    setMediaState(video, { src: '/first.mp4', duration: 12 })
    fireEvent.loadedMetadata(video)
    expect(container.querySelector('time')).toHaveTextContent('0:00 / 0:12')

    // React keeps the DOM node when only src changes. Simulate a cached second
    // resource whose metadata is available before the new event is delivered.
    setMediaState(video, { src: '/second.mp4', duration: 8, currentTime: 2.5 })
    act(() => rerender(<PostVideoPlayer src="/second.mp4" autoPlay={false} />))

    expect(load).toHaveBeenCalledTimes(1)
    expect(container.querySelector('time')).toHaveTextContent('0:02 / 0:08')
    expect(container.querySelector<HTMLInputElement>('.post-video-progress')).toHaveAttribute('max', '8')
  })

  it('resets source-bound state and applies the new initial playback position', () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const { container, rerender } = render(<PostVideoPlayer src="/first.mp4" autoPlay={false} initialTime={4} />)
    const video = container.querySelector<HTMLVideoElement>('video')!

    setMediaState(video, { src: '/first.mp4', duration: 12 })
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(4)

    setMediaState(video, { src: '/second.mp4', duration: 20, currentTime: 1 })
    act(() => rerender(<PostVideoPlayer src="/second.mp4" autoPlay={false} initialTime={6} />))

    expect(load).toHaveBeenCalledTimes(1)
    expect(video.currentTime).toBe(6)
    expect(container.querySelector('time')).toHaveTextContent('0:06 / 0:20')
  })

  it('ignores late metadata events from the source that was replaced', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const { container, rerender } = render(<PostVideoPlayer src="/old.mp4" autoPlay={false} />)
    const video = container.querySelector<HTMLVideoElement>('video')!

    setMediaState(video, { src: '/old.mp4', duration: 12 })
    fireEvent.loadedMetadata(video)

    // Keep currentSrc on the old resource to model a queued durationchange
    // event arriving just after React commits the replacement URL.
    setMediaState(video, { src: '/old.mp4', duration: 99, currentTime: 5 })
    act(() => rerender(<PostVideoPlayer src="/new.mp4" autoPlay={false} />))
    fireEvent.durationChange(video)
    fireEvent.timeUpdate(video)
    expect(container.querySelector('time')).toHaveTextContent('0:00 / 0:00')

    setMediaState(video, { src: '/new.mp4', duration: 7, readyState: 3 })
    fireEvent.canPlay(video)
    expect(container.querySelector('time')).toHaveTextContent('0:00 / 0:07')
  })

  it('uses canplay/durationchange as a metadata fallback when loadedmetadata was missed', () => {
    const { container } = render(<PostVideoPlayer src="/cached.mp4" autoPlay={false} />)
    const video = container.querySelector<HTMLVideoElement>('video')!
    setMediaState(video, { duration: 31, currentTime: 3, readyState: 3 })

    fireEvent.canPlay(video)

    expect(container.querySelector('time')).toHaveTextContent('0:03 / 0:31')
    expect(container.querySelector<HTMLInputElement>('.post-video-progress')).toHaveAttribute('max', '31')
  })

  it('does not consume the dimensions callback before natural dimensions are available', () => {
    const onLoadedMetadata = vi.fn()
    const { container } = render(<PostVideoPlayer src="/late-dimensions.mp4" autoPlay={false} onLoadedMetadata={onLoadedMetadata} />)
    const video = container.querySelector<HTMLVideoElement>('video')!

    setMediaState(video, { duration: 9, width: 0, height: 0, readyState: 3 })
    fireEvent.canPlay(video)
    expect(onLoadedMetadata).not.toHaveBeenCalled()

    setMediaState(video, { duration: 9, width: 1920, height: 1080, readyState: 1 })
    fireEvent.loadedMetadata(video)
    expect(onLoadedMetadata).toHaveBeenCalledWith(1920, 1080)
  })

  it('stops a manually controlled video when its player unmounts', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const { container, unmount } = render(<PostVideoPlayer src="/manual.mp4" autoPlay={false} />)
    const video = container.querySelector<HTMLVideoElement>('video')!
    Object.defineProperty(video, 'paused', { configurable: true, value: false })

    unmount()

    expect(pause).toHaveBeenCalledTimes(1)
  })
})

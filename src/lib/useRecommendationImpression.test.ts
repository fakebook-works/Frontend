// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuth, persistAuth } from '../api/client'

const recordRecommendationImpressions = vi.hoisted(() => vi.fn())
vi.mock('../api/social', () => ({ recordRecommendationImpressions }))

import {
  createRecommendationSessionKey,
  flushRecommendationImpressions,
  queueRecommendationImpression,
  setRecommendationImpressionViewer,
  useRecommendationImpression,
  type RecommendationImpressionOptions,
} from './useRecommendationImpression'

describe('recommendation impression batching and attention metrics', () => {
  beforeEach(() => {
    recordRecommendationImpressions.mockResolvedValue(true)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    clearAuth()
    setRecommendationImpressionViewer(null)
    vi.useRealTimers()
    recordRecommendationImpressions.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function useVisibleDocument() {
    let visibility: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    return (next: DocumentVisibilityState) => {
      visibility = next
      act(() => document.dispatchEvent(new Event('visibilitychange')))
    }
  }

  function observeTarget(
    element: HTMLElement,
    targetId = '1001',
    sessionKey = 'session-a',
    options: RecommendationImpressionOptions = {},
  ) {
    let callback: IntersectionObserverCallback | null = null
    let observerOptions: IntersectionObserverInit | undefined
    class IntersectionObserverMock {
      root = null
      rootMargin = ''
      thresholds: readonly number[] = []
      constructor(nextCallback: IntersectionObserverCallback, nextOptions?: IntersectionObserverInit) {
        callback = nextCallback
        observerOptions = nextOptions
        this.thresholds = Array.isArray(nextOptions?.threshold)
          ? nextOptions.threshold
          : [Number(nextOptions?.threshold ?? 0)]
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    document.body.appendChild(element)
    const rendered = renderHook(() => useRecommendationImpression(
      { current: element },
      targetId,
      sessionKey,
      0.5,
      options,
    ))
    const intersect = (ratio: number, geometry?: { cardHeight: number; visibleHeight: number; viewportHeight: number }) => {
      const cardHeight = geometry?.cardHeight ?? 0
      const visibleHeight = geometry?.visibleHeight ?? 0
      const viewportHeight = geometry?.viewportHeight ?? 0
      act(() => {
        callback?.([{
          target: element,
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
          boundingClientRect: { height: cardHeight } as DOMRectReadOnly,
          intersectionRect: { height: visibleHeight } as DOMRectReadOnly,
          rootBounds: geometry ? { height: viewportHeight } as DOMRectReadOnly : null,
        } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
      })
    }
    return { ...rendered, intersect, getObserverOptions: () => observerOptions }
  }

  function makeVideo(container: HTMLElement, durationSeconds = 100, hidden = false) {
    const video = document.createElement('video')
    let paused = true
    let ended = false
    Object.defineProperties(video, {
      duration: { configurable: true, get: () => durationSeconds },
      paused: { configurable: true, get: () => paused },
      ended: { configurable: true, get: () => ended },
    })
    video.hidden = hidden
    container.appendChild(video)
    return {
      video,
      play: () => {
        paused = false
        ended = false
        video.dispatchEvent(new Event('playing'))
      },
      startSilently: () => {
        paused = false
        ended = false
      },
      pause: () => {
        paused = true
        video.dispatchEvent(new Event('pause'))
      },
      end: () => {
        paused = true
        ended = true
        video.dispatchEvent(new Event('ended'))
      },
    }
  }

  it('deduplicates one target and omits viewer identity', async () => {
    vi.useFakeTimers()
    setRecommendationImpressionViewer('viewer-a')
    const sessionKey = createRecommendationSessionKey()

    expect(queueRecommendationImpression('9007199254740993123', sessionKey, 1_250)).toBe(true)
    expect(queueRecommendationImpression('9007199254740993123', sessionKey, 2_000)).toBe(false)
    await flushRecommendationImpressions()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    const [items, transport] = recordRecommendationImpressions.mock.calls[0]
    expect(items).toEqual([{
      targetId: '9007199254740993123',
      idempotencyKey: `${sessionKey}:9007199254740993123:SHORT`,
      dwellMs: 1_250,
    }])
    expect(items[0]).not.toHaveProperty('userId')
    expect(transport.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts account-A in-flight telemetry and never requeues it for account B', async () => {
    vi.useFakeTimers()
    let resolveRequest!: (accepted: boolean) => void
    recordRecommendationImpressions.mockImplementation(() => new Promise<boolean>((resolve) => { resolveRequest = resolve }))
    setRecommendationImpressionViewer('viewer-a')
    queueRecommendationImpression('1001', 'session-a', 900)
    const flush = flushRecommendationImpressions()
    const signal = recordRecommendationImpressions.mock.calls[0][1].signal as AbortSignal

    setRecommendationImpressionViewer('viewer-b')
    expect(signal.aborted).toBe(true)
    resolveRequest(true)
    await flush
    await vi.runAllTimersAsync()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
  })

  it('resets a still-mounted tracker when the authenticated viewer changes', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const observed = observeTarget(document.createElement('div'), '1002', 'shared-session')
    observed.intersect(1)
    await vi.advanceTimersByTimeAsync(900)

    act(() => setRecommendationImpressionViewer('viewer-b'))
    observed.intersect(1)
    await vi.advanceTimersByTimeAsync(1_000)
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    expect(recordRecommendationImpressions.mock.calls[0][0][0]).toMatchObject({ targetId: '1002', dwellMs: 1_000 })
    observed.unmount()
  })

  it('deduplicates one tier, accepts richer evidence, and permits a new five-minute window', async () => {
    vi.useFakeTimers()
    setRecommendationImpressionViewer('viewer-a')

    expect(queueRecommendationImpression('1003', 'window-a', 1_000, 0, 'post')).toBe(true)
    expect(queueRecommendationImpression('1003', 'window-a', 2_000, 0, 'post')).toBe(false)
    await flushRecommendationImpressions()
    expect(queueRecommendationImpression('1003', 'window-a', 5_000, 0, 'post')).toBe(true)
    await flushRecommendationImpressions()
    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)
    expect(queueRecommendationImpression('1003', 'window-a', 1_000, 0, 'post')).toBe(true)
    await flushRecommendationImpressions()
    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(3)
  })

  it('upgrades queued video SEEN evidence to SKIP instead of letting the weaker tier suppress it', async () => {
    vi.useFakeTimers()
    setRecommendationImpressionViewer('viewer-a')

    expect(queueRecommendationImpression('1004', 'window-video', 0, 0, 'video')).toBe(true)
    expect(queueRecommendationImpression('1004', 'window-video', 400, 5, 'video')).toBe(true)
    await flushRecommendationImpressions()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        targetId: '1004',
        idempotencyKey: 'window-video:1004:SKIP',
        dwellMs: 400,
        completionPct: 5,
      }),
    ])
  })

  it('does not misclassify a long actively played Reel as idle when completion is still low', async () => {
    vi.useFakeTimers()
    setRecommendationImpressionViewer('viewer-a')

    expect(queueRecommendationImpression('1005', 'long-reel', 600_000, 4, 'video')).toBe(true)
    await flushRecommendationImpressions()

    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        idempotencyKey: 'long-reel:1005:LOW',
        dwellMs: 600_000,
        completionPct: 4,
      }),
    ])
  })

  it('combines attentive FeedPost dwell with active video completion for VIDEO_POST', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('article')
    const media = makeVideo(container, 100)
    const observed = observeTarget(container, '1006', 'hybrid-post', { kind: 'video-post' })
    observed.intersect(1)
    media.play()

    for (let currentTime = 5; currentTime <= 50; currentTime += 5) {
      await vi.advanceTimersByTimeAsync(1_000)
      media.video.currentTime = currentTime
      media.video.dispatchEvent(new Event('timeupdate'))
    }
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        idempotencyKey: 'hybrid-post:1006:MID',
        dwellMs: 10_000,
        completionPct: 50,
      }),
    ])
    observed.unmount()
  })

  it('accumulates attentive post dwell across viewport visits and flushes once on exit', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const { intersect, unmount } = observeTarget(document.createElement('div'))

    intersect(0.75)
    await vi.advanceTimersByTimeAsync(500)
    intersect(0.25)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(recordRecommendationImpressions).not.toHaveBeenCalled()

    intersect(0.75)
    await vi.advanceTimersByTimeAsync(400)
    intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([expect.objectContaining({
      dwellMs: 900,
      completionPct: 0,
    })])
    unmount()
  })

  it('treats 350ms intentional post scroll-through as a light signal but shorter/incidental exits as neutral', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const first = observeTarget(document.createElement('div'), '1101', 'fast-a')
    first.intersect(1)
    await vi.advanceTimersByTimeAsync(349)
    act(() => window.dispatchEvent(new WheelEvent('wheel')))
    first.intersect(0)
    first.unmount()
    await vi.advanceTimersByTimeAsync(250)
    expect(recordRecommendationImpressions).not.toHaveBeenCalled()

    const second = observeTarget(document.createElement('div'), '1102', 'fast-b')
    second.intersect(1)
    await vi.advanceTimersByTimeAsync(350)
    second.intersect(0)
    second.unmount()
    await vi.advanceTimersByTimeAsync(250)
    expect(recordRecommendationImpressions).not.toHaveBeenCalled()

    const third = observeTarget(document.createElement('div'), '1103', 'fast-c')
    third.intersect(1)
    await vi.advanceTimersByTimeAsync(350)
    act(() => window.dispatchEvent(new WheelEvent('wheel')))
    third.intersect(0)
    await vi.advanceTimersByTimeAsync(250)
    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({ targetId: '1103', dwellMs: 350 }),
    ])
    third.unmount()
  })

  it('accepts a meaningful pixel slice of a tall post that can never reach a 0.5 ratio', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const observed = observeTarget(document.createElement('article'), '1201', 'tall-post')
    expect(observed.getObserverOptions()?.threshold).toEqual(expect.arrayContaining([0.1, 0.2, 0.5]))

    observed.intersect(0.16, { cardHeight: 2_000, visibleHeight: 320, viewportHeight: 800 })
    await vi.advanceTimersByTimeAsync(900)
    observed.intersect(0, { cardHeight: 2_000, visibleHeight: 0, viewportHeight: 800 })
    await vi.advanceTimersByTimeAsync(250)

    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({ targetId: '1201', dwellMs: 900 }),
    ])
    observed.unmount()
  })

  it('counts only active visible video playback and derives completion from played time, not seeks', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    const media = makeVideo(container, 100)
    const observed = observeTarget(container, '1301', 'video-a', { kind: 'video' })

    observed.intersect(1)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(recordRecommendationImpressions).not.toHaveBeenCalled()

    media.play()
    await vi.advanceTimersByTimeAsync(4_000)
    media.video.currentTime = 4
    media.video.dispatchEvent(new Event('timeupdate'))
    await vi.advanceTimersByTimeAsync(4_000)
    media.video.currentTime = 8
    media.video.dispatchEvent(new Event('timeupdate'))
    media.video.dispatchEvent(new Event('seeking'))
    media.video.currentTime = 90
    media.video.dispatchEvent(new Event('seeked'))
    await vi.advanceTimersByTimeAsync(1_000)
    media.video.currentTime = 91
    media.video.dispatchEvent(new Event('timeupdate'))
    media.end()
    await Promise.resolve()

    const impression = recordRecommendationImpressions.mock.calls[0][0][0]
    expect(impression.dwellMs).toBe(9_000)
    expect(impression.completionPct).toBeCloseTo(9, 3)
    observed.unmount()
  })

  it('does not count playback or completion while the document is hidden', async () => {
    vi.useFakeTimers()
    const setVisibility = useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    const media = makeVideo(container, 100)
    const observed = observeTarget(container, '1307', 'video-hidden-page', { kind: 'video' })
    observed.intersect(1)
    media.play()
    await vi.advanceTimersByTimeAsync(1_000)
    media.video.currentTime = 1
    media.video.dispatchEvent(new Event('timeupdate'))

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(3_000)
    media.video.currentTime = 4
    media.video.dispatchEvent(new Event('timeupdate'))
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(1_000)
    media.video.currentTime = 5
    media.video.dispatchEvent(new Event('timeupdate'))
    media.pause()
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    // Going hidden finalizes the exposure; neither the hidden interval nor the
    // later BFCache-style continuation can inflate that already-recorded sample.
    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({ targetId: '1307', dwellMs: 1_000, completionPct: 1 }),
    ])
    observed.unmount()
  })

  it('ignores hidden descendant videos and follows only the active visible player', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    const hiddenVideo = makeVideo(container, 10, true)
    const visibleVideo = makeVideo(container, 10)
    const observed = observeTarget(container, '1302', 'video-b', { kind: 'video' })

    observed.intersect(1)
    hiddenVideo.play()
    await vi.advanceTimersByTimeAsync(2_000)
    hiddenVideo.video.dispatchEvent(new Event('timeupdate'))
    visibleVideo.play()
    await vi.advanceTimersByTimeAsync(1_000)
    visibleVideo.video.currentTime = 1
    visibleVideo.video.dispatchEvent(new Event('timeupdate'))
    visibleVideo.pause()
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    const impression = recordRecommendationImpressions.mock.calls[0][0][0]
    expect(impression.dwellMs).toBe(1_000)
    expect(impression.completionPct).toBeCloseTo(10, 3)
    observed.unmount()
  })

  it('does not count buffering and keeps completion per video instead of dividing an aggregate by the last duration', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    const first = makeVideo(container, 10)
    const second = makeVideo(container, 100)
    const observed = observeTarget(container, '1305', 'video-multi', { kind: 'video' })
    observed.intersect(1)

    first.play()
    for (let secondPlayed = 1; secondPlayed <= 5; secondPlayed += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
      first.video.currentTime = secondPlayed
      first.video.dispatchEvent(new Event('timeupdate'))
    }
    first.video.dispatchEvent(new Event('waiting'))
    await vi.advanceTimersByTimeAsync(2_000)
    first.pause()

    second.play()
    for (let secondPlayed = 1; secondPlayed <= 10; secondPlayed += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
      second.video.currentTime = secondPlayed
      second.video.dispatchEvent(new Event('timeupdate'))
    }
    second.pause()
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    const impression = recordRecommendationImpressions.mock.calls[0][0][0]
    expect(impression.dwellMs).toBe(15_000)
    expect(impression.completionPct).toBeCloseTo(50, 3)
    observed.unmount()
  })

  it('continues timing an already-playing visible gallery video when the active video starts buffering', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    const first = makeVideo(container, 20)
    const second = makeVideo(container, 20)
    const observed = observeTarget(container, '1306', 'video-fallback', { kind: 'video' })
    observed.intersect(1)

    first.play()
    second.startSilently()
    await vi.advanceTimersByTimeAsync(1_000)
    first.video.currentTime = 1
    first.video.dispatchEvent(new Event('timeupdate'))
    first.video.dispatchEvent(new Event('waiting'))
    await vi.advanceTimersByTimeAsync(1_000)
    second.video.currentTime = 1
    second.video.dispatchEvent(new Event('timeupdate'))
    second.pause()
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({ targetId: '1306', dwellMs: 2_000, completionPct: 5 }),
    ])
    observed.unmount()
  })

  it('does not freeze a long video metric at 30 seconds and flushes the final active watch time', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    const media = makeVideo(container, 120)
    const observed = observeTarget(container, '1303', 'video-c', { kind: 'video' })

    observed.intersect(1)
    media.play()
    for (let second = 5; second <= 45; second += 5) {
      await vi.advanceTimersByTimeAsync(5_000)
      media.video.currentTime = second
      media.video.dispatchEvent(new Event('timeupdate'))
      if (second === 30) expect(recordRecommendationImpressions).not.toHaveBeenCalled()
    }
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({ dwellMs: 45_000, completionPct: 37.5 }),
    ])
    observed.unmount()
  })

  it('records a meaningful visible Reel as seen even when playback never starts', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    makeVideo(container, 30)
    const observed = observeTarget(container, '1304', 'video-seen', { kind: 'video' })

    observed.intersect(1)
    await vi.advanceTimersByTimeAsync(900)
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)

    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual([
      expect.objectContaining({ targetId: '1304', dwellMs: 0, completionPct: 0 }),
    ])
    observed.unmount()
  })

  it('maps an unattended static card to neutral IDLE and pauses clocks on window blur', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const observed = observeTarget(document.createElement('div'), '1401', 'idle-a')
    observed.intersect(1)
    await vi.advanceTimersByTimeAsync(180_000)
    observed.intersect(0)
    await vi.advanceTimersByTimeAsync(250)
    expect(recordRecommendationImpressions.mock.calls[0][0][0]).toMatchObject({
      dwellMs: 300_000,
      idempotencyKey: 'idle-a:1401:IDLE',
    })
    observed.unmount()

    const blurred = observeTarget(document.createElement('div'), '1402', 'idle-b')
    blurred.intersect(1)
    await vi.advanceTimersByTimeAsync(900)
    act(() => window.dispatchEvent(new Event('blur')))
    await vi.advanceTimersByTimeAsync(30_000)
    act(() => window.dispatchEvent(new Event('focus')))
    await vi.advanceTimersByTimeAsync(100)
    blurred.intersect(0)
    await vi.advanceTimersByTimeAsync(250)
    expect(recordRecommendationImpressions.mock.calls[1][0][0].dwellMs).toBe(1_000)
    blurred.unmount()
  })

  it('finalizes every mounted hook before one pagehide keepalive batch', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const first = observeTarget(document.createElement('div'), '1501', 'pagehide-a')
    const second = observeTarget(document.createElement('div'), '1502', 'pagehide-a')
    first.intersect(1)
    second.intersect(1)
    await vi.advanceTimersByTimeAsync(1_200)

    act(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
    await Promise.resolve()
    await Promise.resolve()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    expect(recordRecommendationImpressions.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: '1501', dwellMs: 1_200 }),
      expect.objectContaining({ targetId: '1502', dwellMs: 1_200 }),
    ]))
    expect(recordRecommendationImpressions.mock.calls[0][1]).toMatchObject({ keepalive: true })
    first.unmount()
    second.unmount()
  })

  it('lets an overlay preempt and continue an underlying target without double recording', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const background = observeTarget(document.createElement('div'), '1601', 'feed-session')
    const overlay = observeTarget(document.createElement('div'), '1601', 'overlay-session', { overlay: true })
    background.intersect(1)
    await vi.advanceTimersByTimeAsync(500)
    overlay.intersect(1)
    await vi.advanceTimersByTimeAsync(900)
    overlay.intersect(0)
    await vi.advanceTimersByTimeAsync(250)
    background.intersect(0)
    await vi.runAllTimersAsync()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    expect(recordRecommendationImpressions.mock.calls[0][0][0]).toMatchObject({
      targetId: '1601',
      dwellMs: 1_400,
    })
    background.unmount()
    overlay.unmount()
  })

  it('records an intentional short Reel skip when active ownership changes before IO exits', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const container = document.createElement('div')
    const playback = makeVideo(container, 100)
    const options: RecommendationImpressionOptions = {
      kind: 'video',
      active: true,
      intentionalDeactivation: false,
    }
    const tracker = observeTarget(container, '1701', 'reel-session', options)
    tracker.intersect(1)
    playback.play()
    await vi.advanceTimersByTimeAsync(400)
    playback.video.currentTime = 0.4
    playback.video.dispatchEvent(new Event('timeupdate'))

    options.active = false
    options.intentionalDeactivation = true
    tracker.rerender()
    await vi.runAllTimersAsync()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    expect(recordRecommendationImpressions.mock.calls[0][0][0]).toMatchObject({
      targetId: '1701',
      dwellMs: 400,
    })
    tracker.unmount()
  })

  it('hands verified played progress to an overlay without treating its resumed currentTime as a seek', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    setRecommendationImpressionViewer('viewer-a')
    const backgroundElement = document.createElement('div')
    const overlayElement = document.createElement('div')
    const backgroundVideo = makeVideo(backgroundElement, 100)
    const overlayVideo = makeVideo(overlayElement, 100)
    backgroundVideo.video.src = '/shared-video.mp4'
    overlayVideo.video.src = '/shared-video.mp4'
    const background = observeTarget(backgroundElement, '1702', 'feed-session', { kind: 'video-post' })
    const overlay = observeTarget(overlayElement, '1702', 'overlay-session', { kind: 'video-post', overlay: true })

    background.intersect(1)
    backgroundVideo.play()
    for (let second = 5; second <= 30; second += 5) {
      await vi.advanceTimersByTimeAsync(100)
      backgroundVideo.video.currentTime = second
      backgroundVideo.video.dispatchEvent(new Event('timeupdate'))
    }

    overlayVideo.video.currentTime = 30
    overlayVideo.play()
    overlay.intersect(1)
    for (let second = 35; second <= 100; second += 5) {
      await vi.advanceTimersByTimeAsync(100)
      overlayVideo.video.currentTime = second
      overlayVideo.video.dispatchEvent(new Event('timeupdate'))
    }
    overlay.intersect(0)
    background.intersect(0)
    await vi.runAllTimersAsync()

    expect(recordRecommendationImpressions).toHaveBeenCalledTimes(1)
    expect(recordRecommendationImpressions.mock.calls[0][0][0]).toMatchObject({ targetId: '1702' })
    expect(recordRecommendationImpressions.mock.calls[0][0][0].completionPct).toBeGreaterThanOrEqual(99)
    background.unmount()
    overlay.unmount()
  })

  it('starts neutral when mounted into an already-unfocused document', async () => {
    vi.useFakeTimers()
    useVisibleDocument()
    vi.mocked(document.hasFocus).mockReturnValue(false)
    setRecommendationImpressionViewer('viewer-a')
    const tracker = observeTarget(document.createElement('div'), '1703', 'focus-session')
    tracker.intersect(1)
    await vi.advanceTimersByTimeAsync(2_000)
    tracker.intersect(0)
    await vi.runAllTimersAsync()

    expect(recordRecommendationImpressions).not.toHaveBeenCalled()
    tracker.unmount()
  })

  it('drops a queued account-A sample synchronously before account B token is committed', async () => {
    vi.useFakeTimers()
    persistAuth({
      accessToken: 'account-a-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1801', email: 'a@example.com', validDate: null, status: 1 },
    })
    expect(queueRecommendationImpression('1704', 'auth-switch-session', 1_200)).toBe(true)

    persistAuth({
      accessToken: 'account-b-token',
      refreshTokenExpiresAt: null,
      user: { userId: '1802', email: 'b@example.com', validDate: null, status: 1 },
    })
    await vi.runAllTimersAsync()

    expect(recordRecommendationImpressions).not.toHaveBeenCalled()
  })
})

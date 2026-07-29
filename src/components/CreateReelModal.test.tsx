// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_REEL_ASPECT_RATIO, MAX_REEL_BYTES, MIN_REEL_ASPECT_RATIO, ratioFromSlider, sliderFromRatio } from '../lib/reelPresentation'
import CreateReelModal from './CreateReelModal'

const apiMocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
  cancelPendingMedia: vi.fn(),
  postDetail: vi.fn(),
}))
const socialMocks = vi.hoisted(() => ({ createReel: vi.fn() }))

vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}))

describe('CreateReelModal', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:reel-preview'),
      revokeObjectURL: vi.fn(),
    })
    apiMocks.uploadMedia.mockReset().mockResolvedValue({
      url: 'https://uploads.example/reel.mp4',
      type: 'video',
      contentType: 'video/mp4',
      size: 4,
      name: 'reel.mp4',
      assetId: 'asset-1',
      state: 'pending',
    })
    apiMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
    apiMocks.postDetail.mockReset().mockResolvedValue(null)
    socialMocks.createReel.mockReset().mockResolvedValue({
      id: '9007199254740993001',
      type: 4,
      content: 'A new reel',
      privacy: 2,
      createdAt: '2026-07-28T09:00:00Z',
      authorId: '9007199254740993123',
      media: [{ id: 'media-1', type: 1, url: 'https://uploads.example/reel.mp4' }],
      aspectRatio: MIN_REEL_ASPECT_RATIO,
      focalPointX: 0.5,
      focalPointY: 0.5,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function renderComposer() {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    const view = render(<CreateReelModal userId="9007199254740993123" displayName="Owner" avatarUrl={null} onClose={onClose} onCreated={onCreated} />)
    return { ...view, onClose, onCreated }
  }

  it('publishes the selected crop and privacy then emits a hydrated Home reel shape', async () => {
    const { container, onClose, onCreated } = renderComposer()
    const file = new File(['reel'], 'reel.mp4', { type: 'video/mp4' })
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })
    expect(container.querySelector('[aria-label="videoSettings"]')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-label="videoFullscreen"]')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: 'reelFrame' }), { target: { value: '100' } })
    fireEvent.change(screen.getByPlaceholderText('reelCaptionPlaceholder'), { target: { value: 'A new reel' } })
    fireEvent.click(screen.getByRole('button', { name: /privacyPublic/ }))
    fireEvent.click(screen.getByRole('option', { name: /^privacyFriends$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'publish' }))

    await waitFor(() => expect(socialMocks.createReel).toHaveBeenCalledWith('9007199254740993123', {
      content: 'A new reel',
      privacy: 2,
      aspectRatio: MIN_REEL_ASPECT_RATIO,
      focalPointX: 0.5,
      focalPointY: 0.5,
      media: { type: 1, url: 'https://uploads.example/reel.mp4' },
    }))
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      __typename: 'ReelDetail',
      id: '9007199254740993001',
      aspectRatio: MIN_REEL_ASPECT_RATIO,
      focalPointX: 0.5,
      focalPointY: 0.5,
      privacy: 2,
    }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('rejects non-video files before upload', () => {
    const { container } = renderComposer()
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] },
    })

    expect(screen.getByText('reelVideoOnly')).toBeInTheDocument()
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'publish' })).toBeDisabled()
  })

  it('keeps both frame endpoints exact so the backend accepts the widest and tallest settings', () => {
    expect(ratioFromSlider(0)).toBe(MAX_REEL_ASPECT_RATIO)
    expect(ratioFromSlider(100)).toBe(MIN_REEL_ASPECT_RATIO)
  })

  it('starts from the source aspect ratio and persists a dragged crop focal point', async () => {
    const { container } = renderComposer()
    const file = new File(['reel'], 'wide-reel.mp4', { type: 'video/mp4' })
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })

    const video = container.querySelector<HTMLVideoElement>('video')!
    Object.defineProperties(video, {
      duration: { configurable: true, value: 12 },
      videoWidth: { configurable: true, value: 2000 },
      videoHeight: { configurable: true, value: 1000 },
    })
    fireEvent.loadedMetadata(video)

    const frameSlider = screen.getByRole<HTMLInputElement>('slider', { name: 'reelFrame' })
    expect(Number(frameSlider.value)).toBe(sliderFromRatio(2))
    expect(ratioFromSlider(Number(frameSlider.value))).toBe(MAX_REEL_ASPECT_RATIO)

    const frame = container.querySelector<HTMLElement>('.reel-preview-frame')!
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 180, width: 320, height: 180,
      toJSON: () => ({}),
    })
    fireEvent.pointerDown(video, { pointerId: 7, button: 0, clientX: 100, clientY: 90 })
    fireEvent.pointerMove(frame, { pointerId: 7, clientX: 120, clientY: 90 })
    fireEvent.pointerUp(frame, { pointerId: 7, clientX: 120, clientY: 90 })
    fireEvent.click(screen.getByRole('button', { name: 'publish' }))

    await waitFor(() => expect(socialMocks.createReel).toHaveBeenCalledWith('9007199254740993123', expect.objectContaining({
      aspectRatio: MAX_REEL_ASPECT_RATIO,
      focalPointX: 0,
      focalPointY: 0.5,
    })))
  })

  it('accepts exactly 500 MiB and rejects one byte more before upload', () => {
    const { container } = renderComposer()
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const allowed = new File(['x'], 'allowed.mp4', { type: 'video/mp4' })
    Object.defineProperty(allowed, 'size', { configurable: true, value: MAX_REEL_BYTES })
    fireEvent.change(input, { target: { files: [allowed] } })
    expect(screen.getByRole('button', { name: 'publish' })).toBeEnabled()
    expect(screen.queryByText('reelVideoTooLarge')).not.toBeInTheDocument()

    const oversized = new File(['x'], 'oversized.mp4', { type: 'video/mp4' })
    Object.defineProperty(oversized, 'size', { configurable: true, value: MAX_REEL_BYTES + 1 })
    fireEvent.change(input, { target: { files: [oversized] } })
    expect(screen.getByText('reelVideoTooLarge')).toBeInTheDocument()
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()
  })

  it('cancels a pending upload when the GraphQL write fails', async () => {
    socialMocks.createReel.mockRejectedValueOnce(new Error('write failed'))
    const { container, onCreated } = renderComposer()
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['reel'], 'reel.mp4', { type: 'video/mp4' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'publish' }))

    await waitFor(() => expect(apiMocks.cancelPendingMedia).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-1' })))
    expect(screen.getByText('createReelError')).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })
})

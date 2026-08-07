// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Activity } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fitReelFrame, reelViewerVerticalGap, ReelsPage, shrinkReelFrameToViewport } from './ReelsPage'

const socialMocks = vi.hoisted(() => ({
  getRecommendedReels: vi.fn(),
  getProfileReels: vi.fn(),
  getSavedContent: vi.fn(),
  getReelCollection: vi.fn(),
  getContentViewCounts: vi.fn(),
  getProfile: vi.fn(),
  getProfileRelationshipStates: vi.fn(),
  watchContent: vi.fn(),
}))
const prefetchMocks = vi.hoisted(() => ({ prefetchCommentPage: vi.fn() }))
const apiMocks = vi.hoisted(() => ({ postDetail: vi.fn() }))

function toGatewayReel(reel: { id: string; type: number; content: string; privacy: number; createdAt: string; author: { id: string; displayName: string; avatarUrl: string | null; isVerified: boolean }; media: Array<{ id: string; type: number; url: string }>; aspectRatio?: number | null; focalPointX?: number | null; focalPointY?: number | null }) {
  return {
    __typename: 'ReelDetail' as const,
    id: reel.id,
    type: reel.type,
    content: reel.content,
    privacy: reel.privacy,
    create: reel.createdAt,
    author: { id: reel.author.id, name: reel.author.displayName, avatar: reel.author.avatarUrl ?? '', isVerified: reel.author.isVerified },
    media: reel.media,
    mentions: [],
    taggedUsers: [],
    sharedSource: null,
    aspectRatio: reel.aspectRatio ?? null,
    focalPointX: reel.focalPointX ?? null,
    focalPointY: reel.focalPointY ?? null,
  }
}

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../lib/commentPagePrefetch', () => prefetchMocks)
vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../components/ContentActions', () => ({
  ContentActions: ({ contentId, post, commentsOpen, renderActions = true, renderComments = true, onCommentsOpenChange, onContentDeleted }: {
    contentId: string
    post: { __typename: string; id: string }
    commentsOpen: boolean
    renderActions?: boolean
    renderComments?: boolean
    onCommentsOpenChange: (open: boolean) => void
    onContentDeleted?: (contentId: string) => void
  }) => <>
    {renderActions && <><button type="button" aria-label="commentAction" aria-expanded={commentsOpen} onClick={() => onCommentsOpenChange(!commentsOpen)}>comment</button><button type="button" aria-label={`delete-${contentId}`} onClick={() => onContentDeleted?.(contentId)}>delete</button></>}
    {renderComments && commentsOpen && <aside data-testid="reel-comments-sidebar" data-content-id={contentId} data-post-id={post.id} data-post-type={post.__typename} />}
  </>,
}))

describe('ReelsPage media discussion layout', () => {
  beforeEach(() => {
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([{
      id: '9007199254740993',
      type: 3,
      content: 'A reel with comments',
      privacy: 0,
      createdAt: '2026-07-30T08:00:00Z',
      authorId: '2',
      author: { id: '2', username: 'author', displayName: 'Reel Author', avatarUrl: null, isVerified: false },
      media: [{ id: 'media-1', type: 1, url: 'https://uploads.example.com/reel.mp4' }],
      aspectRatio: 9 / 16,
    }])
    socialMocks.getProfile.mockReset().mockResolvedValue(null)
    socialMocks.getProfileReels.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getSavedContent.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getReelCollection.mockReset().mockResolvedValue([])
    socialMocks.getContentViewCounts.mockReset().mockResolvedValue({})
    socialMocks.getProfileRelationshipStates.mockReset().mockResolvedValue({})
    socialMocks.watchContent.mockReset().mockResolvedValue(true)
    prefetchMocks.prefetchCommentPage.mockReset()
    apiMocks.postDetail.mockReset().mockResolvedValue(null)
  })

  afterEach(() => {
    cleanup()
    document.body.classList.remove('reels-comments-open')
  })

  it('restores the Reels tab without loading its media again', async () => {
    const { rerender } = render(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} /></Activity>)
    await screen.findByRole('button', { name: 'commentAction' }, { timeout: 5_000 })
    expect(socialMocks.getRecommendedReels).toHaveBeenCalledTimes(1)

    rerender(<Activity mode="hidden"><ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} /></Activity>)
    rerender(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} /></Activity>)

    expect(socialMocks.getRecommendedReels).toHaveBeenCalledTimes(1)
    expect(socialMocks.getProfile).toHaveBeenCalledTimes(1)
  })

  it('removes a deleted Reel from the visible queue without returning to the first item', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel remains' },
    ])
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findByText('Second reel remains')

    fireEvent.click(screen.getByRole('button', { name: 'delete-9007199254740993' }))

    await waitFor(() => expect(container.querySelectorAll('.reel-card')).toHaveLength(1))
    expect(screen.getByText('Second reel remains')).toBeInTheDocument()
  })

  it('restores the progress bar from the video element after the preserved route becomes visible again', async () => {
    const { container, rerender } = render(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" active onNavigate={vi.fn()} /></Activity>)
    await waitFor(() => expect(container.querySelector('.reel-card video')).toBeInTheDocument())
    const video = container.querySelector<HTMLVideoElement>('.reel-card video')!
    Object.defineProperty(video, 'duration', { configurable: true, value: 10 })
    video.currentTime = 3
    fireEvent.durationChange(video)
    fireEvent.timeUpdate(video)
    expect(container.querySelector<HTMLInputElement>('.reel-progress')?.style.getPropertyValue('--reel-progress')).toBe('30%')

    rerender(<Activity mode="hidden"><ReelsPage userId="1" mode="for-you" active={false} onNavigate={vi.fn()} /></Activity>)
    rerender(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" active onNavigate={vi.fn()} /></Activity>)

    await waitFor(() => expect(container.querySelector<HTMLInputElement>('.reel-progress')?.style.getPropertyValue('--reel-progress')).toBe('30%'))
  })

  it('realigns the selected Reel after the preserved destination is hidden mid-transition', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second preserved Reel' },
    ])
    const { container, rerender } = render(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" active onNavigate={vi.fn()} /></Activity>)
    await screen.findByText('Second preserved Reel')
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    const scrollTo = vi.fn()
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTop', { configurable: true, writable: true, value: 0 })
    scrollTo.mockImplementation(({ top }: { top: number }) => { stage.scrollTop = top })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: scrollTo })
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    scrollTo.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'nextReel' }))

    rerender(<Activity mode="hidden"><ReelsPage userId="1" mode="for-you" active={false} onNavigate={vi.fn()} /></Activity>)
    rerender(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" active onNavigate={vi.fn()} /></Activity>)

    await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'auto' }))
    expect(container.querySelectorAll('.reel-card')[1]).toHaveAttribute('aria-current', 'true')
  })

  it('caches each feed mode while the Reels destination stays mounted', async () => {
    const { rerender } = render(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} /></Activity>)
    await screen.findByRole('button', { name: 'commentAction' })
    rerender(<Activity mode="visible"><ReelsPage userId="1" mode="following" onNavigate={vi.fn()} /></Activity>)
    await screen.findByRole('button', { name: 'commentAction' })
    rerender(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} /></Activity>)
    await screen.findByRole('button', { name: 'commentAction' })

    expect(socialMocks.getRecommendedReels).toHaveBeenCalledTimes(2)
    expect(socialMocks.getRecommendedReels).toHaveBeenNthCalledWith(2, '1', 'FOLLOWING', 0, 24)
  })

  it('restores the previously active Reel independently for each feed tab', async () => {
    const [first] = await socialMocks.getRecommendedReels()
    const second = { ...first, id: '9007199254740994', content: 'Second For You Reel' }
    const following = { ...first, id: '9007199254740995', content: 'Following Reel' }
    socialMocks.getRecommendedReels.mockReset().mockImplementation((_userId: string, recommendationMode: string) => (
      Promise.resolve(recommendationMode === 'FOLLOWING' ? [following] : [first, second])
    ))
    const { container, rerender } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findByText('Second For You Reel')
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    const scrollTo = vi.fn()
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTop', { configurable: true, writable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: scrollTo })
    fireEvent.scroll(stage)
    await waitFor(() => expect(container.querySelectorAll('.reel-card')[1]).toHaveAttribute('aria-current', 'true'))

    rerender(<ReelsPage userId="1" mode="following" onNavigate={vi.fn()} />)
    await screen.findByText('Following Reel')
    rerender(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)

    await waitFor(() => expect(container.querySelectorAll('.reel-card')[1]).toHaveAttribute('aria-current', 'true'))
    await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'auto' }))
  })

  it('cancels an in-flight Reel transition before loading another feed tab', async () => {
    const [first] = await socialMocks.getRecommendedReels()
    const forYouSecond = { ...first, id: '9007199254740994', content: 'Second For You Reel' }
    const followingFirst = { ...first, id: '9007199254740995', content: 'First Following Reel' }
    const followingSecond = { ...first, id: '9007199254740996', content: 'Second Following Reel' }
    socialMocks.getRecommendedReels.mockReset().mockImplementation((_userId: string, recommendationMode: string) => (
      Promise.resolve(recommendationMode === 'FOLLOWING'
        ? [followingFirst, followingSecond]
        : [first, forYouSecond])
    ))
    const { container, rerender } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findByText('Second For You Reel')
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTop', { configurable: true, writable: true, value: 0 })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'nextReel' }))

    rerender(<ReelsPage userId="1" mode="following" onNavigate={vi.fn()} />)
    await screen.findByText('Second Following Reel')
    stage.scrollTop = 640
    fireEvent.scroll(stage)

    await waitFor(() => expect(container.querySelectorAll('.reel-card')[1]).toHaveAttribute('aria-current', 'true'))
  })

  it('opens the right-side photo-viewer discussion for the selected Reel without navigating', async () => {
    const onNavigate = vi.fn()
    const { container, unmount } = render(<ReelsPage userId="1" mode="for-you" onNavigate={onNavigate} />)
    await screen.findByRole('button', { name: 'commentAction' }, { timeout: 5_000 })
    expect(document.documentElement).toHaveClass('reels-page-scroll')
    expect(document.body).toHaveClass('reels-page-scroll')

    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const sidebar = await screen.findByTestId('reel-comments-sidebar')
    expect(sidebar).toHaveAttribute('data-content-id', '9007199254740993')
    expect(sidebar).toHaveAttribute('data-post-id', '9007199254740993')
    expect(sidebar).toHaveAttribute('data-post-type', 'ReelDetail')
    expect(container.querySelector('.reels-page')).toHaveClass('has-comments-sidebar')
    expect(document.body).toHaveClass('reels-comments-open')
    expect(onNavigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    await waitFor(() => expect(screen.queryByTestId('reel-comments-sidebar')).not.toBeInTheDocument())
    expect(container.querySelector('.reels-page')).not.toHaveClass('has-comments-sidebar')
    unmount()
    expect(document.documentElement).not.toHaveClass('reels-page-scroll')
    expect(document.body).not.toHaveClass('reels-page-scroll')
  })

  it('records a Reel once playback actually begins', async () => {
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findAllByRole('button', { name: 'commentAction' })
    const video = container.querySelector('video')!

    fireEvent.play(video)
    fireEvent.play(video)

    expect(socialMocks.watchContent).toHaveBeenCalledTimes(1)
    expect(socialMocks.watchContent).toHaveBeenCalledWith('1', '9007199254740993')
  })

  it('keeps the same vertical inset for portrait and landscape reels', () => {
    const portrait = fitReelFrame(1_000, 800, .2)
    const landscape = fitReelFrame(1_000, 800, 4)
    const roomyLandscape = fitReelFrame(2_000, 800, 4)

    expect(portrait.width / portrait.height).toBeCloseTo(9 / 16, 2)
    expect(landscape.height).toBe(portrait.height)
    expect(landscape.width).toBeLessThanOrEqual(912)
    expect(roomyLandscape.height).toBe(portrait.height)
    expect(roomyLandscape.width / roomyLandscape.height).toBeCloseTo(16 / 9, 2)
  })

  it('keeps the current portrait height but reserves one topbar at both edges for other detail ratios', () => {
    const portraitGap = reelViewerVerticalGap(9 / 16, true)
    const squareGap = reelViewerVerticalGap(1, true)
    const portrait = fitReelFrame(1_200, 800, 9 / 16, portraitGap)
    const square = fitReelFrame(1_200, 800, 1, squareGap)

    expect(portraitGap).toBe(26)
    expect(squareGap).toBe(104)
    expect(portrait.height).toBe(774)
    expect(square.height).toBe(696)
    expect((800 - square.height) / 2).toBe(52)
  })

  it('shrinks the complete frame proportionally when comments take horizontal space', () => {
    const regular = fitReelFrame(1_300, 800, 16 / 9)
    const withComments = shrinkReelFrameToViewport(regular, 900)

    expect(withComments.width).toBeLessThan(regular.width)
    expect(withComments.height).toBeLessThan(regular.height)
    expect(withComments.width / withComments.height).toBeCloseTo(regular.width / regular.height, 2)
    expect(withComments.width).toBeLessThanOrEqual(900 - 88)
  })

  it('moves one complete card with the explicit reel controls', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel' },
    ])
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    const nextButton = await screen.findByRole('button', { name: 'nextReel' })
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    const scrollTo = vi.fn()
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: scrollTo })

    fireEvent.click(nextButton)

    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'smooth' })
    expect(scrollTo).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(nextButton).toBeDisabled())
  })

  it('accumulates a touchpad gesture and advances exactly one complete Reel', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel' },
    ])
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findByRole('button', { name: 'nextReel' })
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    const scrollTo = vi.fn()
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: scrollTo })

    fireEvent.wheel(screen.getAllByRole('slider', { name: 'reelProgress' })[0], { deltaY: 120 })
    expect(scrollTo).not.toHaveBeenCalled()

    fireEvent.wheel(stage, { deltaY: 8 })
    fireEvent.wheel(stage, { deltaY: 8 })
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.wheel(stage, { deltaY: 14 })
    fireEvent.wheel(stage, { deltaY: 120 })

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'smooth' })
  })

  it('keeps a programmatic Reel target active while smooth scrolling crosses the previous card', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel' },
    ])
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    const nextButton = await screen.findByRole('button', { name: 'nextReel' })
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTop', { configurable: true, writable: true, value: 0 })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: vi.fn() })

    fireEvent.click(nextButton)
    stage.scrollTop = 120
    fireEvent.scroll(stage)

    await waitFor(() => expect(container.querySelectorAll('.reel-card')[1]).toHaveAttribute('aria-current', 'true'))
    expect(nextButton).toBeDisabled()
  })

  it('handles Reel wheel navigation over its sidebar but leaves slider keyboard input alone', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel' },
    ])
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findByRole('button', { name: 'nextReel' })
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    const scrollTo = vi.fn()
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: scrollTo })

    fireEvent.keyDown(screen.getAllByRole('slider', { name: 'reelProgress' })[0], { key: 'ArrowDown' })
    expect(scrollTo).not.toHaveBeenCalled()

    fireEvent.wheel(container.querySelector('.reels-sidebar')!, { deltaY: 120 })
    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'smooth' })
  })

  it('ignores a long momentum tail and accepts the next gesture after a quiet gap', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel' },
      { ...first[0], id: '9007199254740995', content: 'Third reel' },
    ])
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findByRole('button', { name: 'nextReel' })
    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    const scrollTo = vi.fn()
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTop', { configurable: true, writable: true, value: 0 })
    scrollTo.mockImplementation(({ top }: { top: number }) => { stage.scrollTop = top })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: scrollTo })
    let now = 1
    const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => now)
    try {
      fireEvent.wheel(stage, { deltaY: 120 })
      for (let index = 0; index < 4; index += 1) {
        now += 100
        fireEvent.wheel(stage, { deltaY: 60 })
      }
      expect(scrollTo).toHaveBeenCalledTimes(1)

      now += 160
      fireEvent.wheel(stage, { deltaY: 120 })

      expect(scrollTo).toHaveBeenCalledTimes(2)
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 1280, behavior: 'smooth' })
    } finally {
      performanceNow.mockRestore()
    }
  })

  it('keeps one comments sidebar mounted while moving to the next Reel', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel' },
    ])
    render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'commentAction' }))[0])
    const sidebar = await screen.findByTestId('reel-comments-sidebar')

    fireEvent.click(screen.getByRole('button', { name: 'nextReel' }))

    await waitFor(() => expect(sidebar).toHaveAttribute('data-content-id', '9007199254740994'))
    expect(screen.getByTestId('reel-comments-sidebar')).toBe(sidebar)
    expect(document.body).toHaveClass('reels-comments-open')
  })

  it('warms only a bounded media and comments window around the active Reel', async () => {
    const [first] = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue(Array.from({ length: 5 }, (_, index) => ({
      ...first,
      id: `900719925474099${index + 3}`,
      content: `Reel ${index + 1}`,
      media: [{ ...first.media[0], id: `media-${index + 1}`, url: `https://uploads.example.com/reel-${index + 1}.mp4` }],
    })))
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findAllByRole('button', { name: 'commentAction' })
    const videos = [...container.querySelectorAll('video')]

    expect(videos.map((video) => video.preload)).toEqual(['auto', 'auto', 'auto', 'none', 'none'])
    fireEvent.click(screen.getAllByRole('button', { name: 'commentAction' })[0])
    await waitFor(() => expect(prefetchMocks.prefetchCommentPage).toHaveBeenCalledTimes(2))
    expect(prefetchMocks.prefetchCommentPage).toHaveBeenCalledWith('1', '9007199254740994')
    expect(prefetchMocks.prefetchCommentPage).toHaveBeenCalledWith('1', '9007199254740995')

    fireEvent.click(screen.getByRole('button', { name: 'nextReel' }))
    await waitFor(() => expect(videos[3].preload).toBe('auto'))
    expect(videos[4].preload).toBe('none')
  })

  it('keeps the comments sidebar open and switches its target with the active Reel', async () => {
    const first = await socialMocks.getRecommendedReels()
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([
      ...first,
      { ...first[0], id: '9007199254740994', content: 'Second reel' },
    ])
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findAllByRole('button', { name: 'commentAction' })
    fireEvent.click(screen.getAllByRole('button', { name: 'commentAction' })[0])
    expect(await screen.findByTestId('reel-comments-sidebar')).toHaveAttribute('data-content-id', '9007199254740993')

    const stage = container.querySelector<HTMLElement>('.reels-stage')!
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 640 })
    Object.defineProperty(stage, 'scrollTo', { configurable: true, value: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'nextReel' }))

    await waitFor(() => expect(screen.getByTestId('reel-comments-sidebar')).toHaveAttribute('data-content-id', '9007199254740994'))
    expect(container.querySelector('.reels-page')).toHaveClass('has-comments-sidebar')
  })

  it('opens a Home Reel first and continues with the deduplicated FOR_YOU queue', async () => {
    const [first] = await socialMocks.getRecommendedReels()
    const selected = { ...first, id: '9007199254740994', content: 'Selected Home Reel' }
    socialMocks.getRecommendedReels.mockReset().mockResolvedValue([first, selected])
    apiMocks.postDetail.mockResolvedValue(toGatewayReel(selected))

    const { container } = render(<ReelsPage userId="1" mode="for-you" entrySource="for-you" entryReelId={selected.id} onNavigate={vi.fn()} />)

    await screen.findByText('Selected Home Reel')
    expect(document.documentElement).not.toHaveClass('reels-page-scroll')
    expect(document.body).not.toHaveClass('reels-page-scroll')
    const cards = [...container.querySelectorAll('.reel-card')]
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('Selected Home Reel')
    expect(cards[0]).toHaveAttribute('aria-current', 'true')
    expect(cards[1]).toHaveTextContent('A reel with comments')
    expect(apiMocks.postDetail).toHaveBeenCalledWith(selected.id)
  })

  it('paints the selected Reel immediately while its following queue loads in the background', () => {
    socialMocks.getRecommendedReels.mockReset().mockReturnValue(new Promise(() => undefined))
    const seed = {
      id: 'instant-reel',
      type: 2,
      content: 'Render this Reel immediately',
      privacy: 0,
      createdAt: '2026-08-02T00:00:00Z',
      authorId: '2',
      author: { id: '2', username: 'author', displayName: 'Reel Author', avatarUrl: null, isVerified: false },
      media: [{ id: 'instant-media', type: 1, url: '/instant.mp4' }],
      aspectRatio: 9 / 16,
      focalPointX: .5,
      focalPointY: .5,
    }
    apiMocks.postDetail.mockResolvedValue(toGatewayReel(seed))

    const { container } = render(<ReelsPage userId="1" mode="for-you" entrySource="for-you" entryReelId={seed.id} entryReel={seed} onNavigate={vi.fn()} />)

    expect(screen.getByText('Render this Reel immediately')).toBeInTheDocument()
    expect(container.querySelector('.reel-feed-skeleton')).not.toBeInTheDocument()
    expect(container.querySelector('.reel-card')).toHaveAttribute('aria-current', 'true')
    expect(socialMocks.getRecommendedReels).toHaveBeenCalledWith('1', 'FOR_YOU', 0, 24)
  })

  it('keeps profile Reels ordered around the selected Reel and hides its close control with the preserved route', async () => {
    const [first] = await socialMocks.getRecommendedReels()
    const profileReels = [
      { ...first, id: '9007199254740995', content: 'Newer Reel' },
      { ...first, id: '9007199254740994', content: 'Selected Profile Reel' },
      { ...first, id: '9007199254740993', content: 'Older Reel' },
    ]
    socialMocks.getProfileReels.mockReset().mockResolvedValue({ items: profileReels, endCursor: null, hasNextPage: false })
    apiMocks.postDetail.mockResolvedValue(toGatewayReel(profileReels[1]))
    const onEntryClose = vi.fn()
    const { container, rerender } = render(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" active entrySource="profile" entryOwnerId="2" entryReelId="9007199254740994" onEntryClose={onEntryClose} onNavigate={vi.fn()} /></Activity>)

    await screen.findByText('Selected Profile Reel')
    const cards = [...container.querySelectorAll('.reel-card')]
    expect(cards.map((card) => card.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Newer Reel'),
      expect.stringContaining('Selected Profile Reel'),
      expect.stringContaining('Older Reel'),
    ]))
    expect(cards[1]).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument()
    expect(container.querySelector('.reels-library-viewer-close')?.parentElement).toBe(container)
    expect(document.body).toHaveClass('reels-library-viewer-open')
    expect(document.body).not.toHaveClass('content-detail-open')
    expect(document.documentElement).not.toHaveClass('reels-page-scroll')
    expect(document.body).not.toHaveClass('reels-page-scroll')

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(onEntryClose).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.reels-page')).toHaveClass('is-library-viewer')

    rerender(<Activity mode="hidden"><ReelsPage userId="1" mode="for-you" active={false} entrySource="profile" entryOwnerId="2" entryReelId="9007199254740994" onEntryClose={onEntryClose} onNavigate={vi.fn()} /></Activity>)
    expect(screen.queryByRole('button', { name: 'close' })).not.toBeInTheDocument()
  })

  it('releases document viewport ownership while its preserved destination is hidden', () => {
    const { rerender } = render(<Activity mode="visible"><ReelsPage userId="1" mode="for-you" active onNavigate={vi.fn()} /></Activity>)
    expect(document.documentElement).toHaveClass('reels-page-scroll')
    expect(document.body).toHaveClass('reels-page-scroll')

    rerender(<Activity mode="hidden"><ReelsPage userId="1" mode="for-you" active={false} onNavigate={vi.fn()} /></Activity>)
    expect(document.documentElement).not.toHaveClass('reels-page-scroll')
    expect(document.body).not.toHaveClass('reels-page-scroll')
  })

  it('opens the Reel author profile directly on its Reels tab', async () => {
    const onNavigate = vi.fn()
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={onNavigate} />)
    await screen.findByRole('button', { name: 'commentAction' })

    fireEvent.click(container.querySelector<HTMLButtonElement>('.reel-author-avatar')!)

    expect(onNavigate).toHaveBeenCalledWith('/profile/2?tab=reels')
  })

  it('renders a stable Reel-shaped loading surface for both feed modes', () => {
    socialMocks.getRecommendedReels.mockReset().mockReturnValue(new Promise(() => undefined))
    const { container, rerender } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    expect(container.querySelector('.reel-feed-skeleton')).toBeInTheDocument()
    expect(container.querySelector('.reels-stage-state .spinner')).not.toBeInTheDocument()

    rerender(<ReelsPage userId="1" mode="following" onNavigate={vi.fn()} />)
    expect(container.querySelector('.reel-feed-skeleton')).toBeInTheDocument()
  })

  it('uses the profile Reel API for the library and opens a selected item in the transparent viewer', async () => {
    const items = await socialMocks.getRecommendedReels()
    socialMocks.getProfileReels.mockResolvedValue({ items, endCursor: null, hasNextPage: false })
    socialMocks.getContentViewCounts.mockResolvedValue({ '9007199254740993': 12 })
    const { container } = render(<ReelsPage userId="1" mode="mine" onNavigate={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'reelsLibrary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'createReel' })).toBeInTheDocument()
    const yourReelsFilter = screen.getByRole('button', { name: 'yourReels' })
    expect(yourReelsFilter).toHaveClass('active')
    expect(yourReelsFilter.parentElement?.querySelector('button')).toBe(yourReelsFilter)
    fireEvent.click(screen.getByRole('button', { name: 'Reel Author' }))

    await screen.findByRole('button', { name: 'commentAction' })
    expect(container.querySelector('.reels-page')).toHaveClass('is-library-viewer')
    expect(container.querySelector('.reels-sidebar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reel-comments-sidebar')).not.toBeInTheDocument()
    expect(document.body).toHaveClass('reels-library-viewer-open')
    expect(document.body).not.toHaveClass('content-detail-open')

    const closeButton = screen.getByRole('button', { name: 'close' })
    expect(closeButton.parentElement).toBe(container)
    fireEvent.click(closeButton)
    await waitFor(() => expect(container.querySelector('.reels-library-content')).toBeInTheDocument())
    expect(document.body).not.toHaveClass('content-detail-open', 'reels-library-viewer-open')
  })

  it('delegates library Reel opening to the route owner when the app shell owns overlays', async () => {
    const items = await socialMocks.getRecommendedReels()
    socialMocks.getProfileReels.mockResolvedValue({ items, endCursor: null, hasNextPage: false })
    const onNavigate = vi.fn()
    render(<ReelsPage userId="1" mode="mine" routeOverlays onNavigate={onNavigate} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reel Author' }))
    expect(onNavigate).toHaveBeenCalledWith('/reel/9007199254740993?source=for-you')
    expect(document.body).not.toHaveClass('reels-library-viewer-open')
  })

  it('plays a profile Reel preview only while its library tile is hovered', async () => {
    const items = await socialMocks.getRecommendedReels()
    socialMocks.getProfileReels.mockResolvedValue({ items, endCursor: null, hasNextPage: false })
    const { container } = render(<ReelsPage userId="1" mode="mine" onNavigate={vi.fn()} />)
    const tile = (await screen.findByRole('button', { name: 'Reel Author' }))
    const preview = container.querySelector<HTMLVideoElement>('.reels-library-tile video')!
    const play = vi.spyOn(preview, 'play').mockResolvedValue()
    const pause = vi.spyOn(preview, 'pause').mockImplementation(() => undefined)

    fireEvent.mouseEnter(tile)
    expect(play).toHaveBeenCalledTimes(1)
    fireEvent.mouseLeave(tile)
    expect(pause).toHaveBeenCalledTimes(1)
    expect(preview.currentTime).toBe(0)
  })

  it('paints one volume track from the current volume instead of stacking two tracks', async () => {
    const { container } = render(<ReelsPage userId="1" mode="for-you" onNavigate={vi.fn()} />)
    await screen.findByRole('button', { name: 'commentAction' })
    const control = container.querySelector<HTMLElement>('.reel-volume-control')!
    const slider = screen.getByRole('slider', { name: 'videoVolume' })
    expect(control.style.getPropertyValue('--reel-volume-fill')).toBe('0%')

    fireEvent.change(slider, { target: { value: '0.5' } })

    await waitFor(() => expect(control.style.getPropertyValue('--reel-volume-fill')).toBe('50%'))
  })
})

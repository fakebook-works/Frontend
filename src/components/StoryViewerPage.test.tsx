// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost, StoryBucket } from '../api/gatewayTypes'
import type { ContentEngagement } from '../api/social'
import type { UserSummary } from '../api/types'
import { STORY_IMAGE_DURATION_MS, STORY_VIDEO_MAX_DURATION_MS, StoryViewerPage } from './StoryViewerPage'

const apiMocks = vi.hoisted(() => ({ deleteStory: vi.fn(), postDetail: vi.fn() }))
const socialMocks = vi.hoisted(() => ({
  getContentEngagement: vi.fn(),
  getStoryViewers: vi.fn(),
  getLikedUsers: vi.fn(),
  getProfileRelationshipState: vi.fn(),
  watchContent: vi.fn(),
  likeContent: vi.fn(),
  unlikeContent: vi.fn(),
  unfriend: vi.fn(),
  unfollowUser: vi.fn(),
}))

vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: (key: string, params?: Record<string, unknown>) => params?.count == null ? key : `${params.count} ${key}` }) }))

const ownerId = '9007199254740993123'

function textBucket(authorId: string, name: string, storyIds = ['story-1']): StoryBucket {
  return {
    author: { id: authorId, name, avatar: '', isVerified: false },
    latestCreate: '2026-07-17T10:00:00Z',
    hasUnseen: true,
    stories: storyIds.map((id, index) => ({
      __typename: 'NormalStory' as const,
      id,
      content: `Story content ${index + 1}`,
      create: '2026-07-17T10:00:00Z',
      media: [],
    })),
  }
}

function renderViewer(buckets: StoryBucket[], initialBucketId = buckets[0].author.id, props: Partial<Parameters<typeof StoryViewerPage>[0]> = {}) {
  return render(<StoryViewerPage
    buckets={buckets}
    initialBucketId={initialBucketId}
    viewerId={ownerId}
    onClose={vi.fn()}
    {...props}
  />)
}

describe('StoryViewerPage', () => {
  beforeEach(() => {
    apiMocks.deleteStory.mockReset().mockResolvedValue({ success: true, message: null })
    apiMocks.postDetail.mockReset().mockResolvedValue(null)
    socialMocks.getContentEngagement.mockReset().mockResolvedValue({
      targetId: 'story-1', likeCount: 2, commentCount: 0, shareCount: 0,
      viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: true,
    })
    socialMocks.getStoryViewers.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getLikedUsers.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({ friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false })
    socialMocks.watchContent.mockReset().mockResolvedValue(true)
    socialMocks.likeContent.mockReset().mockResolvedValue(true)
    socialMocks.unlikeContent.mockReset().mockResolvedValue(true)
    socialMocks.unfriend.mockReset().mockResolvedValue(true)
    socialMocks.unfollowUser.mockReset().mockResolvedValue(true)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows owner viewers, likes, details and the delete-story menu', async () => {
    const ownerBucket = textBucket(ownerId, 'Owner')
    socialMocks.getStoryViewers.mockResolvedValue({
      items: [{ id: '2', username: 'viewer', displayName: 'Viewer One', avatarUrl: null, isVerified: false }],
      endCursor: null,
      hasNextPage: false,
    })
    socialMocks.getLikedUsers.mockResolvedValue({
      items: [{ id: '2', username: 'viewer', displayName: 'Viewer One', avatarUrl: null, isVerified: false }],
      endCursor: null,
      hasNextPage: false,
    })
    const onStoryDeleted = vi.fn()
    const { container } = renderViewer([ownerBucket], ownerId, { onStoryDeleted })

    expect(await screen.findByRole('button', { name: 'storyOptions' })).toBeInTheDocument()
    expect(container.querySelector('.story-owner > .avatar')).toHaveStyle({ width: '42px', height: '42px' })
    expect(container.querySelector('.story-owner > .story-owner-copy')).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.story-owner-like-count')).toHaveTextContent('2'))
    fireEvent.click(container.querySelector('.story-viewer-insights')!)
    expect(await screen.findByText('storyDetails')).toBeInTheDocument()
    expect(screen.getByText('Viewer One')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'storyOptions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'deleteStory' }))
    await waitFor(() => expect(apiMocks.deleteStory).toHaveBeenCalledWith(ownerId, 'story-1'))
    expect(onStoryDeleted).toHaveBeenCalledWith('story-1')
  })

  it('renders the original author and content for a text-only post shared to a story', async () => {
    const sharedBucket: StoryBucket = {
      author: { id: '2', name: 'Story Sharer', avatar: '', isVerified: false },
      latestCreate: '2026-07-21T09:00:00Z',
      hasUnseen: true,
      unseenCount: 1,
      stories: [{
        __typename: 'FeedPostShareStory',
        id: 'shared-story-1',
        content: '',
        create: '2026-07-21T09:00:00Z',
        sharedSource: {
          id: 'source-post-1',
          content: 'The original post is visible inside this story',
          media: null,
          author: { id: '3', name: 'Original Author', avatar: '', isVerified: true },
        },
      }],
    }
    apiMocks.postDetail.mockResolvedValue({
      __typename: 'FeedPostDetail',
      id: 'source-post-1',
      type: 1,
      content: 'The original post is visible inside this story',
      privacy: 2,
      create: '2026-07-20T08:00:00Z',
      author: { id: '3', name: 'Original Author', avatar: '', isVerified: true, canFollow: false },
      media: [],
      sharedSource: null,
    })
    const onNavigate = vi.fn()
    const onClose = vi.fn()
    const { container } = renderViewer([sharedBucket], '2', { onNavigate, onClose })

    expect(await screen.findByText('Original Author')).toBeInTheDocument()
    expect(screen.getByText('The original post is visible inside this story')).toBeInTheDocument()
    await waitFor(() => expect(apiMocks.postDetail).toHaveBeenCalledWith('source-post-1'))
    expect(container.querySelector('.shared-story-ambient')).toBeInTheDocument()
    expect(container.querySelector('.story-shared-post-card .shared-post-source')).toBeInTheDocument()
    expect(container.querySelector('.story-shared-post-card time')).toHaveAttribute('datetime', '2026-07-20T08:00:00Z')
    expect(within(container.querySelector('.story-shared-post-card') as HTMLElement).getByLabelText('privacyFriends')).toBeInTheDocument()
    fireEvent.click(screen.getByText('The original post is visible inside this story'))
    expect(onClose).toHaveBeenCalled()
    expect(onNavigate).toHaveBeenCalledWith('/home?post=source-post-1')
  })

  it('waits for the complete shared post instead of flashing its single story preview image', async () => {
    let resolveDetail!: (value: GatewayPost | null) => void
    apiMocks.postDetail.mockImplementation(() => new Promise((resolve) => { resolveDetail = resolve }))
    const sharedBucket: StoryBucket = {
      author: { id: '2', name: 'Story Sharer', avatar: '', isVerified: false },
      latestCreate: '2026-07-21T09:00:00Z',
      hasUnseen: true,
      stories: [{
        __typename: 'FeedPostShareStory',
        id: 'shared-story-loading',
        content: '',
        create: '2026-07-21T09:00:00Z',
        sharedSource: {
          id: 'source-post-loading',
          content: 'Original post',
          media: { id: 'preview-media', type: 0, url: '/media/first-only.jpg' },
          author: { id: '3', name: 'Original Author', avatar: '', isVerified: false },
        },
      }],
    }
    const { container } = renderViewer([sharedBucket], '2')

    await waitFor(() => expect(apiMocks.postDetail).toHaveBeenCalledWith('source-post-loading'))
    expect(container.querySelector('.story-shared-post-loading')).toBeInTheDocument()
    expect(container.querySelector('.story-shared-post-card .shared-post-source')).not.toBeInTheDocument()

    resolveDetail({
      __typename: 'FeedPostDetail', id: 'source-post-loading', type: 1, content: 'Original post', privacy: 0,
      create: '2026-07-20T08:00:00Z', author: { id: '3', name: 'Original Author', avatar: '', isVerified: false, canFollow: false },
      media: [{ id: 'first-media', type: 0, url: '/media/first.jpg' }, { id: 'second-media', type: 0, url: '/media/second.jpg' }], sharedSource: null,
    })

    await waitFor(() => expect(container.querySelector('.story-shared-post-card .shared-post-source')).toBeInTheDocument())
    expect(container.querySelector('.story-shared-post-loading')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.story-shared-post-card .post-media-slot')).toHaveLength(2)
  })

  it('uses the detail scrubber and keeps the viewer open after deleting one of several owner stories', async () => {
    const ownerBucket = textBucket(ownerId, 'Owner', ['story-1', 'story-2'])
    const onClose = vi.fn()
    const onStoryDeleted = vi.fn()
    const { container } = renderViewer([ownerBucket], ownerId, { onClose, onStoryDeleted })

    fireEvent.click(container.querySelector('.story-viewer-insights')!)
    const scrubber = await screen.findByRole('slider', { name: 'storySelect' })
    fireEvent.pointerDown(scrubber)
    fireEvent.change(scrubber, { target: { value: '.6' } })
    expect(scrubber).toHaveValue('0.6')
    expect(container.querySelector('.story-text-only p')).toHaveTextContent('Story content 2')
    expect(container.querySelector('[data-story-index="1"]')).toHaveClass('active')
    fireEvent.pointerUp(scrubber)
    expect(scrubber).toHaveValue('1')

    fireEvent.click(container.querySelector('.story-viewer-insights')!)
    fireEvent.click(screen.getByRole('button', { name: 'storyOptions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'deleteStory' }))

    await waitFor(() => expect(apiMocks.deleteStory).toHaveBeenCalledWith(ownerId, 'story-2'))
    expect(onStoryDeleted).toHaveBeenCalledWith('story-2')
    expect(onClose).not.toHaveBeenCalled()
    expect(container.querySelector('.story-text-only p')).toHaveTextContent('Story content 1')
  })

  it('does not flash the empty-viewer message while owner insight data is loading', async () => {
    let resolveEngagement!: (value: ContentEngagement) => void
    let resolveViewers!: (value: { items: UserSummary[]; endCursor: string | null; hasNextPage: boolean }) => void
    socialMocks.getContentEngagement.mockReturnValue(new Promise<ContentEngagement>((resolve) => { resolveEngagement = resolve }))
    socialMocks.getStoryViewers.mockReturnValue(new Promise((resolve) => { resolveViewers = resolve }))

    const { container } = renderViewer([textBucket(ownerId, 'Owner')])
    const insights = container.querySelector('.story-viewer-insights')

    expect(insights).toHaveTextContent('storyViewersLabel')
    expect(insights).not.toHaveTextContent('storyNoViewersShort')
    expect(container.querySelector('.owner-footer')).toHaveClass('loading-viewers')
    expect(container.querySelector('.story-viewer-canvas')).toHaveClass('story-viewer-canvas-owner')

    await act(async () => {
      resolveEngagement({
        targetId: 'story-1', likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 4,
        viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: true,
      })
      resolveViewers({
        items: [{ id: '2', username: 'viewer', displayName: 'Viewer One', avatarUrl: null, isVerified: false }],
        endCursor: null,
        hasNextPage: false,
      })
    })

    await waitFor(() => expect(insights).toHaveTextContent('4 storyViewersCount'))
    expect(insights).not.toHaveTextContent('storyNoViewersShort')
    expect(container.querySelector('.owner-footer')).toHaveClass('has-viewers')
  })

  it('shows the exact unseen-card count and the compact transparent-gap sidebar avatar', () => {
    const ownerBucket = textBucket(ownerId, 'Owner')
    ownerBucket.hasUnseen = false
    ownerBucket.unseenCount = 0
    const friendBucket = textBucket('2', 'Friend Story', ['friend-1', 'friend-2', 'friend-3'])
    friendBucket.unseenCount = 2
    const { container } = renderViewer([ownerBucket, friendBucket])

    expect(screen.getByText('2 newStoryCardsCount')).toBeInTheDocument()
    const ownerRow = container.querySelector('.story-sidebar-owner-section > .story-sidebar-bucket')!
    const friendRow = screen.getByText('Friend Story').closest('.story-sidebar-bucket')!
    expect(ownerRow.parentElement).toHaveClass('story-sidebar-owner-section')
    expect(ownerRow.parentElement?.tagName).toBe('SECTION')
    expect(friendRow.parentElement?.tagName).toBe('SECTION')
    expect(friendRow.querySelector('.story-sidebar-avatar')).toHaveClass('unseen')
    expect(friendRow.querySelector('.story-sidebar-avatar .avatar')).toHaveStyle({ width: '44px', height: '44px' })
    expect(container.querySelector('.story-sidebar-avatar .avatar')).toBeInTheDocument()
  })

  it('uses the shell navigation chrome, a real blurred image layer and aggregate owner counts', async () => {
    const ownerBucket = textBucket(ownerId, 'Owner')
    ownerBucket.stories[0] = {
      __typename: 'NormalStory', id: 'story-1', content: '', create: '2026-07-17T10:00:00Z',
      media: [{ id: 'media-image', type: 0, url: '/story-image.jpg' }],
    }
    socialMocks.getContentEngagement.mockResolvedValue({
      targetId: 'story-1', likeCount: 7, commentCount: 0, shareCount: 0, viewCount: 12,
      viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: true,
    })
    socialMocks.getStoryViewers.mockResolvedValue({
      items: [{ id: '2', username: 'viewer', displayName: 'Only loaded viewer', avatarUrl: null, isVerified: false }],
      endCursor: 'next',
      hasNextPage: true,
    })

    const { container, unmount } = renderViewer([ownerBucket])

    expect(document.body).toHaveClass('content-detail-open', 'story-viewer-open')
    expect(document.querySelector('.story-viewer-shell-close')).toBeInTheDocument()
    expect(container.querySelector('.story-image-foreground-source')).toHaveAttribute('src', '/story-image.jpg')
    expect(container.querySelector('.story-stage-backdrop canvas')).toBeInTheDocument()
    const noAudio = screen.getByRole('button', { name: 'storyNoAudio' })
    expect(noAudio).not.toBeDisabled()
    expect(noAudio).toHaveAttribute('aria-disabled', 'true')
    expect(noAudio.querySelector('.story-rounded-control-icon')).toHaveAttribute('stroke-linecap', 'round')
    expect([...container.querySelectorAll('.story-viewer-controls .story-rounded-control-icon')].every((icon) => icon.getAttribute('width') === '24')).toBe(true)
    await waitFor(() => expect(container.querySelector('.story-viewer-insights')).toHaveTextContent('storyViewersCount'))
    expect(container.querySelector('.story-viewer-insights')).toHaveTextContent('12')
    expect(container.querySelector('.owner-footer')).toHaveClass('has-viewers')
    const viewerCaret = container.querySelector('.story-viewer-insights-label .story-rounded-control-icon')
    expect(viewerCaret).toHaveAttribute('width', '20')
    expect(viewerCaret).toHaveAttribute('stroke-linejoin', 'round')
    expect(container.querySelector('.story-owner-like-count')).toHaveTextContent('7')

    unmount()
    expect(document.body).not.toHaveClass('content-detail-open', 'story-viewer-open')
    expect(document.querySelector('.story-viewer-shell-close')).not.toBeInTheDocument()
  })

  it('uses the compact no-viewers state and hides a zero owner like count', async () => {
    const ownerBucket = textBucket(ownerId, 'Owner')
    socialMocks.getContentEngagement.mockResolvedValue({
      targetId: 'story-1', likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0,
      viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: true,
    })
    const { container } = renderViewer([ownerBucket])

    await waitFor(() => expect(container.querySelector('.story-viewer-insights')).toHaveTextContent('storyNoViewersShort'))
    expect(container.querySelector('.owner-footer')).toHaveClass('no-viewers')
    expect(container.querySelector('.story-owner-like-count')).not.toBeInTheDocument()
  })

  it('keeps only Like for a friend and offers unfriend in the options menu', async () => {
    const friendBucket = textBucket('2', 'Friend')
    socialMocks.getProfileRelationshipState.mockResolvedValue({ friendship: 'friend', isFollowing: true, followsViewer: true, isBlocked: false, isBlockedBy: false })
    const onRelationshipRemoved = vi.fn()
    const { container } = renderViewer([friendBucket], '2', { onRelationshipRemoved })

    const options = await screen.findByRole('button', { name: 'storyOptions' })
    const likeButton = container.querySelector<HTMLButtonElement>('.story-like')!
    expect(container.querySelectorAll('.story-like')).toHaveLength(1)
    expect(container.querySelector('.audience-footer')).toContainElement(likeButton)
    expect(likeButton).toHaveAttribute('aria-pressed', 'false')
    expect(likeButton.querySelector('svg')).toHaveAttribute('fill', 'none')
    expect(likeButton.querySelector('svg')).toHaveAttribute('width', '24')
    expect(likeButton.querySelector('strong')).not.toBeInTheDocument()
    expect(screen.queryByText('shareAction')).not.toBeInTheDocument()
    fireEvent.click(options)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'removeFriend' }))
    await waitFor(() => expect(socialMocks.unfriend).toHaveBeenCalledWith(ownerId, '2'))
    expect(onRelationshipRemoved).toHaveBeenCalledWith('2')
  })

  it('keeps only Like for a followed user, removes sharing and offers unfollow', async () => {
    const followBucket = textBucket('3', 'Followed')
    socialMocks.getProfileRelationshipState.mockResolvedValue({ friendship: 'none', isFollowing: true, followsViewer: false, isBlocked: false, isBlockedBy: false })
    const { container } = renderViewer([followBucket], '3')

    const options = await screen.findByRole('button', { name: 'storyOptions' })
    expect(container.querySelectorAll('.story-like')).toHaveLength(1)
    expect(container.querySelector('[aria-label="shareAction"]')).not.toBeInTheDocument()
    fireEvent.click(options)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'unfollow' }))
    await waitFor(() => expect(socialMocks.unfollowUser).toHaveBeenCalledWith(ownerId, '3'))
  })

  it('runs an image story for five seconds before advancing', () => {
    vi.useFakeTimers()
    const bucket = textBucket('2', 'Friend', ['story-1', 'story-2'])
    renderViewer([bucket], '2')
    expect(screen.getByText('Story content 1')).toBeInTheDocument()
    const nextButton = screen.getByRole('button', { name: 'stories next' })
    expect(nextButton.querySelector('.story-navigation-chevron')).toHaveAttribute('width', '28')
    expect(nextButton.querySelector('.story-navigation-chevron')).toHaveAttribute('stroke-linecap', 'round')

    act(() => vi.advanceTimersByTime(STORY_IMAGE_DURATION_MS))

    expect(screen.getByText('Story content 2')).toBeInTheDocument()
  })

  it('starts a cached image story immediately instead of waiting for a missed load event', () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1280)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(720)
    const bucket = textBucket('2', 'Friend', ['story-image', 'story-after'])
    bucket.stories[0] = {
      __typename: 'NormalStory', id: 'story-image', content: 'Cached image', create: '2026-07-17T10:00:00Z',
      media: [{ id: 'media-image', type: 0, url: '/cached-story.jpg' }],
    }

    renderViewer([bucket], '2')
    act(() => vi.advanceTimersByTime(STORY_IMAGE_DURATION_MS))

    expect(screen.getByText('Story content 2')).toBeInTheDocument()
  })

  it('retries blocked unmuted autoplay in muted mode without freezing the story', async () => {
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    play.mockReset().mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError')).mockResolvedValue(undefined)
    const bucket = textBucket('2', 'Friend', ['story-video'])
    bucket.stories[0] = {
      __typename: 'NormalStory', id: 'story-video', content: '', create: '2026-07-17T10:00:00Z',
      media: [{ id: 'media-video', type: 1, url: '/video.mp4' }],
    }
    renderViewer([bucket], '2')
    const video = document.querySelector<HTMLVideoElement>('.story-viewer-video-source')!
    Object.defineProperties(video, {
      duration: { configurable: true, value: 12 },
      videoWidth: { configurable: true, value: 1920 },
      videoHeight: { configurable: true, value: 1080 },
      mozHasAudio: { configurable: true, value: true },
      captureStream: { configurable: true, value: () => ({ getAudioTracks: () => [{}] }) },
    })

    fireEvent.loadedMetadata(video)

    await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
    expect(video.muted).toBe(true)
    expect(screen.getByRole('button', { name: 'storyUnmute' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'storyPause' })).toBeInTheDocument()
  })

  it('locks the volume control without fading it when a video has no audio track', () => {
    const bucket = textBucket('2', 'Friend', ['silent-video'])
    bucket.stories[0] = {
      __typename: 'NormalStory', id: 'silent-video', content: '', create: '2026-07-17T10:00:00Z',
      media: [{ id: 'silent-media', type: 1, url: '/silent.mp4' }],
    }
    renderViewer([bucket], '2')
    const video = document.querySelector<HTMLVideoElement>('.story-viewer-video-source')!
    Object.defineProperties(video, {
      duration: { configurable: true, value: 8 },
      videoWidth: { configurable: true, value: 1280 },
      videoHeight: { configurable: true, value: 720 },
      mozHasAudio: { configurable: true, value: false },
      captureStream: { configurable: true, value: () => ({ getAudioTracks: () => [] }) },
    })

    fireEvent.loadedMetadata(video)

    const audioControl = screen.getByRole('button', { name: 'storyNoAudio' })
    expect(audioControl).not.toBeDisabled()
    expect(audioControl).toHaveAttribute('aria-disabled', 'true')
    expect(video.muted).toBe(false)
    fireEvent.click(audioControl)
    expect(video.muted).toBe(false)
  })

  it('caps a long video at sixty seconds and advances to the next story', () => {
    const bucket = textBucket('2', 'Friend', ['story-video', 'story-after'])
    bucket.stories[0] = {
      __typename: 'NormalStory', id: 'story-video', content: '', create: '2026-07-17T10:00:00Z',
      media: [{ id: 'media-video', type: 1, url: '/video.mp4' }],
    }
    renderViewer([bucket], '2')
    const video = document.querySelector<HTMLVideoElement>('.story-stage video')!
    Object.defineProperty(video, 'duration', { configurable: true, value: 120 })
    fireEvent.loadedMetadata(video)
    Object.defineProperty(video, 'currentTime', { configurable: true, value: STORY_VIDEO_MAX_DURATION_MS / 1_000 })
    fireEvent.timeUpdate(video)

    expect(screen.getByText('Story content 2')).toBeInTheDocument()
  })
})

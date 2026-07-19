// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryBucket } from '../api/gatewayTypes'
import { STORY_IMAGE_DURATION_MS, STORY_VIDEO_MAX_DURATION_MS, StoryViewerPage } from './StoryViewerPage'

const apiMocks = vi.hoisted(() => ({ deleteStory: vi.fn() }))
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
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: (key: string) => key }) }))

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
    await waitFor(() => expect(container.querySelector('.story-owner-like-count')).toHaveTextContent('2'))
    fireEvent.click(container.querySelector('.story-viewer-insights')!)
    expect(await screen.findByText('storyDetails')).toBeInTheDocument()
    expect(screen.getByText('Viewer One')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'storyOptions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'deleteStory' }))
    await waitFor(() => expect(apiMocks.deleteStory).toHaveBeenCalledWith(ownerId, 'story-1'))
    expect(onStoryDeleted).toHaveBeenCalledWith('story-1')
  })

  it('keeps only Like for a friend and offers unfriend in the options menu', async () => {
    const friendBucket = textBucket('2', 'Friend')
    socialMocks.getProfileRelationshipState.mockResolvedValue({ friendship: 'friend', isFollowing: true, followsViewer: true, isBlocked: false, isBlockedBy: false })
    const onRelationshipRemoved = vi.fn()
    const { container } = renderViewer([friendBucket], '2', { onRelationshipRemoved })

    const options = await screen.findByRole('button', { name: 'storyOptions' })
    expect(container.querySelectorAll('.story-like')).toHaveLength(1)
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

    act(() => vi.advanceTimersByTime(STORY_IMAGE_DURATION_MS))

    expect(screen.getByText('Story content 2')).toBeInTheDocument()
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

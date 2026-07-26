// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost } from '../api/gatewayTypes'
import { PostPhotoViewer } from './PostPhotoViewer'

const apiMocks = vi.hoisted(() => ({ postDetail: vi.fn() }))
const socialMocks = vi.hoisted(() => ({
  getContentEngagement: vi.fn(),
  likeContent: vi.fn(),
  unlikeContent: vi.fn(),
}))

vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: (key: string) => key }) }))
vi.mock('./ContentActions', () => ({ ShareModal: () => <div data-testid="share-modal" /> }))
vi.mock('./PostDetailCommentsModal', () => ({
  PostDetailCommentsModal: ({ targetId, variant }: { targetId: string; variant?: string }) => <div data-testid="photo-discussion" data-target-id={targetId} data-variant={variant} />,
}))

describe('PostPhotoViewer', () => {
  const post: GatewayPost = {
    __typename: 'FeedPostDetail',
    id: 'post-1',
    type: 1,
    content: 'Photo post',
    privacy: 0,
    create: '2026-07-24T10:00:00Z',
    author: { id: 'author-1', name: 'Author', avatar: '', isVerified: false },
    media: [
      { id: 'photo-a', type: 0, url: '/photo-a.jpg' },
      { id: 'video-a', type: 1, url: '/video-a.mp4' },
      { id: 'photo-b', type: 0, url: '/photo-b.jpg' },
    ],
    mentions: [],
    taggedUsers: [],
    sharedSource: null,
  }

  beforeEach(() => {
    apiMocks.postDetail.mockReset().mockResolvedValue(post)
    socialMocks.getContentEngagement.mockReset().mockResolvedValue({
      targetId: 'post-1', likeCount: 1, commentCount: 2, shareCount: 0, viewCount: 0,
      viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false,
    })
    socialMocks.likeContent.mockReset().mockResolvedValue(true)
    socialMocks.unlikeContent.mockReset().mockResolvedValue(true)
  })

  afterEach(() => cleanup())

  it('opens the requested image, navigates only among photos and keeps comments attached to the post', async () => {
    const onClose = vi.fn()
    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-b" initialPost={post} onClose={onClose} />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-b.jpg'))
    expect(screen.getByTestId('photo-discussion')).toHaveAttribute('data-target-id', 'post-1')
    expect(screen.getByTestId('photo-discussion')).toHaveAttribute('data-variant', 'photo-sidebar')
    expect(screen.queryByRole('button', { name: 'nextPhoto' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'previousPhoto' }))
    expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-a.jpg')
    expect(screen.getByRole('button', { name: 'nextPhoto' })).toBeInTheDocument()
    expect(apiMocks.postDetail).toHaveBeenCalledTimes(1)
    expect(document.body).toHaveClass('post-photo-viewer-open', 'content-detail-open')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

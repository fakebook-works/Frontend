// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost } from '../api/gatewayTypes'
import { PostPhotoViewer } from './PostPhotoViewer'

const apiMocks = vi.hoisted(() => ({ postDetail: vi.fn() }))
const socialMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getContentEngagement: vi.fn(),
  likeContent: vi.fn(),
  unlikeContent: vi.fn(),
}))

vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: (key: string) => key }) }))
vi.mock('./ContentActions', () => ({ ShareModal: ({ canReshare }: { canReshare: boolean }) => <div data-testid="share-modal" data-can-reshare={String(canReshare)} /> }))
vi.mock('./PostDetailCommentsModal', () => ({
  PostDetailCommentsModal: ({ targetId, variant, canShare, shareDisabled, onShare }: { targetId: string; variant?: string; canShare?: boolean; shareDisabled?: boolean; onShare?: () => void }) => <div data-testid="photo-discussion" data-target-id={targetId} data-variant={variant}>{canShare && <button type="button" aria-label="shareAction" disabled={shareDisabled} onClick={onShare} />}</div>,
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
    socialMocks.getProfile.mockReset().mockResolvedValue({ displayName: 'Viewer', avatarUrl: '/viewer.jpg' })
    socialMocks.getContentEngagement.mockReset().mockResolvedValue({
      targetId: 'post-1', likeCount: 1, commentCount: 2, shareCount: 0, viewCount: 0,
      viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false,
    })
    socialMocks.likeContent.mockReset().mockResolvedValue(true)
    socialMocks.unlikeContent.mockReset().mockResolvedValue(true)
  })

  afterEach(() => cleanup())

  it('opens the requested image, loops through post media and keeps comments attached to the post', async () => {
    const onClose = vi.fn()
    const onActiveMediaChange = vi.fn()
    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-b" initialPost={post} onClose={onClose} onActiveMediaChange={onActiveMediaChange} />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-b.jpg'))
    await waitFor(() => expect(onActiveMediaChange).toHaveBeenLastCalledWith('post-1', 'photo-b'))
    expect(screen.getByTestId('photo-discussion')).toHaveAttribute('data-target-id', 'post-1')
    expect(screen.getByTestId('photo-discussion')).toHaveAttribute('data-variant', 'photo-sidebar')
    expect(screen.getByRole('button', { name: 'nextPhoto' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'nextPhoto' }))
    expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-a.jpg')
    await waitFor(() => expect(onActiveMediaChange).toHaveBeenLastCalledWith('post-1', 'photo-a'))
    fireEvent.click(screen.getByRole('button', { name: 'previousPhoto' }))
    expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-b.jpg')
    expect(screen.getByRole('button', { name: 'nextPhoto' })).toBeInTheDocument()
    expect(apiMocks.postDetail).toHaveBeenCalledTimes(1)
    expect(document.body).toHaveClass('post-photo-viewer-open')
    expect(document.body).not.toHaveClass('content-detail-open')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resolves the requested media before reporting the initial URL on a direct link', async () => {
    const onActiveMediaChange = vi.fn()
    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-b" onClose={vi.fn()} onActiveMediaChange={onActiveMediaChange} />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-b.jpg'))
    expect(onActiveMediaChange.mock.calls[0]).toEqual(['post-1', 'photo-b'])
  })

  it('allows resharing a private photo post already authorized for the viewer', async () => {
    const privatePost = { ...post, privacy: 2 }
    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-a" initialPost={privatePost} onClose={vi.fn()} />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-a.jpg'))
    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    expect(screen.getByTestId('share-modal')).toHaveAttribute('data-can-reshare', 'true')
  })

  it('disables photo-sidebar sharing when the shared private-group source is unavailable', async () => {
    const unavailableWrapper: GatewayPost = {
      ...post,
      sharedSource: {
        id: 'private-source', isAvailable: false, type: 3, content: null, privacy: 1, create: null,
        author: null, media: [], requiresGroupMembership: true,
        group: { id: 'private-group', name: 'Private Group', avatar: '', background: '', privacy: 1, memberCount: 10, viewerIsMember: false, joinRequestPending: false },
      },
    }
    apiMocks.postDetail.mockResolvedValue(unavailableWrapper)
    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-a" initialPost={unavailableWrapper} onClose={vi.fn()} />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-a.jpg'))
    expect(screen.getByRole('button', { name: 'shareAction' })).toBeDisabled()
    expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
  })

  it('loops across feed posts, switches the discussion owner and excludes Reel media', async () => {
    const secondPost: GatewayPost = {
      ...post,
      id: 'post-2',
      content: 'Second photo post',
      author: { id: 'author-2', name: 'Second Author', avatar: '', isVerified: false },
      media: [{ id: 'photo-c', type: 0, url: '/photo-c.jpg' }],
    }
    const reel = {
      ...post,
      __typename: 'ReelDetail' as const,
      id: 'reel-1',
      media: [{ id: 'reel-video', type: 1, url: '/reel.mp4' }],
    } as GatewayPost
    const entries = [
      ...post.media.map((media) => ({ post, media })),
      { post: secondPost, media: secondPost.media[0] },
      { post: reel, media: reel.media[0] },
    ]

    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-b" initialPost={post} mediaEntries={entries} onClose={vi.fn()} />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-b.jpg'))
    expect(screen.getByTestId('photo-discussion')).toHaveAttribute('data-target-id', 'post-1')
    fireEvent.click(screen.getByRole('button', { name: 'nextPhoto' }))
    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-c.jpg'))
    expect(screen.getByTestId('photo-discussion')).toHaveAttribute('data-target-id', 'post-2')
    fireEvent.click(screen.getByRole('button', { name: 'nextPhoto' }))
    expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-a.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'previousPhoto' }))
    expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-c.jpg')
    expect(document.querySelector('video[src="/reel.mp4"]')).not.toBeInTheDocument()
    expect(apiMocks.postDetail).toHaveBeenCalledWith('post-1')
  })

  it('renders the protected unavailable discussion for an unlinked profile picture', async () => {
    render(<PostPhotoViewer
      viewerId="viewer-1"
      contentId="profile-avatar-author-1"
      initialMediaId="standalone-avatar"
      mediaEntries={[{ post: null, media: { id: 'standalone-avatar', type: 0, url: '/standalone-avatar.jpg' } }]}
      unavailableAuthor={{ id: 'author-1', name: 'Author', avatar: '/standalone-avatar.jpg', isVerified: false }}
      onClose={vi.fn()}
    />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/standalone-avatar.jpg'))
    expect(document.querySelector('.post-photo-viewer')).not.toHaveClass('no-sidebar')
    expect(document.querySelector('[data-post-unavailable="true"]')).toBeInTheDocument()
    expect(screen.getByText('unavailablePostPlaceholder')).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
    expect(screen.getByText('cannotComment')).toBeInTheDocument()
    expect(screen.getByText('postCannotBeCommented')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'commentFeatureUnavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'commentFeatureUnavailable' })).toBeDisabled()
    await waitFor(() => expect(document.querySelector('.unavailable-comment-compose .avatar img')).toHaveAttribute('src', '/viewer.jpg'))
    expect(apiMocks.postDetail).not.toHaveBeenCalled()
    expect(socialMocks.getContentEngagement).not.toHaveBeenCalled()
  })

  it('opens a post video at the feed playback position and uses the player for real fullscreen', async () => {
    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="video-a" initialPlaybackTime={42.5} initialPost={post} onClose={vi.fn()} />)

    await waitFor(() => expect(document.querySelector('.post-photo-viewer-video video')).toBeInTheDocument())
    const video = document.querySelector<HTMLVideoElement>('.post-photo-viewer-video video')!
    Object.defineProperties(video, {
      duration: { configurable: true, value: 120 },
      videoWidth: { configurable: true, value: 1920 },
      videoHeight: { configurable: true, value: 1080 },
    })
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(42.5)
    expect(screen.queryByRole('button', { name: 'storyZoomIn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'storyZoomOut' })).not.toBeInTheDocument()

    const player = document.querySelector<HTMLElement>('.post-photo-viewer-video .post-video-player')!
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(player, 'requestFullscreen', { configurable: true, value: requestFullscreen })
    fireEvent.click(screen.getByRole('button', { name: 'videoFullscreen' }))
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('zooms from a fixed minimum and exits fullscreen before closing the viewer', async () => {
    const onClose = vi.fn()
    render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-a" initialPost={post} onClose={onClose} />)

    await waitFor(() => expect(document.querySelector<HTMLImageElement>('.post-photo-viewer-image')).toHaveAttribute('src', '/photo-a.jpg'))
    const zoomOut = screen.getByRole('button', { name: 'storyZoomOut' })
    expect(zoomOut).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'storyZoomIn' }))
    expect(zoomOut).toBeEnabled()
    const image = document.querySelector<HTMLImageElement>('.post-photo-viewer-image')!
    const stage = document.querySelector<HTMLElement>('.post-photo-viewer-stage')!
    expect(image).toHaveStyle({ transform: 'translate3d(0px, 0px, 0) scale(1.5)' })
    Object.defineProperties(stage, { clientWidth: { configurable: true, value: 400 }, clientHeight: { configurable: true, value: 300 } })
    Object.defineProperties(image, {
      clientWidth: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 300 },
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => false) },
    })
    fireEvent.pointerDown(image, { pointerId: 7, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(image, { pointerId: 7, clientX: 140, clientY: 120 })
    expect(image).toHaveStyle({ transform: 'translate3d(40px, 20px, 0) scale(1.5)' })
    fireEvent.pointerUp(image, { pointerId: 7 })

    const fullscreen = screen.getByRole('button', { name: 'videoFullscreen' })
    fireEvent.click(fullscreen)
    expect(fullscreen).toHaveAttribute('aria-pressed', 'true')
    expect(document.body).toHaveClass('post-photo-viewer-fullscreen')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(document.body).not.toHaveClass('post-photo-viewer-fullscreen')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('places its close action in the shared shell slot', () => {
    const shellTarget = document.createElement('div')
    shellTarget.id = 'content-detail-shell-close-target'
    document.body.append(shellTarget)
    const onClose = vi.fn()
    const view = render(<PostPhotoViewer viewerId="viewer-1" contentId="post-1" initialMediaId="photo-a" initialPost={post} onClose={onClose} />)

    const closeButton = shellTarget.querySelector<HTMLButtonElement>('.post-photo-viewer-close')
    expect(closeButton).toBeInTheDocument()
    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalledTimes(1)

    view.unmount()
    shellTarget.remove()
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Activity } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReelsPage } from './ReelsPage'

const socialMocks = vi.hoisted(() => ({
  getRecommendedReels: vi.fn(),
  getProfile: vi.fn(),
}))

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../components/ContentActions', () => ({
  ContentActions: ({ contentId, post, commentsOpen, onCommentsOpenChange }: {
    contentId: string
    post: { __typename: string; id: string }
    commentsOpen: boolean
    onCommentsOpenChange: (open: boolean) => void
  }) => <>
    <button type="button" aria-label="commentAction" aria-expanded={commentsOpen} onClick={() => onCommentsOpenChange(!commentsOpen)}>comment</button>
    {commentsOpen && <aside data-testid="reel-comments-sidebar" data-content-id={contentId} data-post-id={post.id} data-post-type={post.__typename} />}
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
})

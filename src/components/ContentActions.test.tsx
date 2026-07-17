// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost } from '../api/gatewayTypes'
import { ContentActions } from './ContentActions'

const socialMocks = vi.hoisted(() => ({
  getContentEngagement: vi.fn(),
  likeContent: vi.fn(),
  unlikeContent: vi.fn(),
  saveContent: vi.fn(),
  unsaveContent: vi.fn(),
  getComments: vi.fn(),
  getRelationProfiles: vi.fn(),
  createComment: vi.fn(),
  mentionUser: vi.fn(),
  getProfile: vi.fn(),
  sharePost: vi.fn(),
}))
const apiMocks = vi.hoisted(() => ({ createShareStory: vi.fn() }))
const messengerMocks = vi.hoisted(() => ({ createDirectConversation: vi.fn(), sendMessage: vi.fn() }))
const translate = vi.hoisted(() => (key: string) => key)

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/messenger', () => ({ messengerApi: messengerMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: translate }) }))

const post: GatewayPost = {
  __typename: 'GroupPostDetail',
  id: '90',
  type: 2,
  content: 'Full post shown above its comments',
  privacy: 0,
  create: '2026-07-17T08:00:00Z',
  author: { id: '2', name: 'Post Author', avatar: '', isVerified: false, canFollow: false },
  group: { id: '8', name: 'Reference Group', avatar: '', canJoin: false },
  media: [{ id: 'm1', type: 0, url: 'https://uploads.example.com/post.jpg' }],
}

describe('ContentActions refreshed overlays', () => {
  beforeEach(() => {
    socialMocks.getContentEngagement.mockReset().mockResolvedValue({ targetId: '90', likeCount: 2, commentCount: 1, shareCount: 0, viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false })
    socialMocks.likeContent.mockReset().mockResolvedValue(true)
    socialMocks.unlikeContent.mockReset().mockResolvedValue(true)
    socialMocks.saveContent.mockReset().mockResolvedValue(true)
    socialMocks.unsaveContent.mockReset().mockResolvedValue(true)
    socialMocks.getComments.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([])
    socialMocks.createComment.mockReset()
    socialMocks.mentionUser.mockReset()
    socialMocks.getProfile.mockReset().mockResolvedValue(null)
    socialMocks.sharePost.mockReset().mockResolvedValue({ id: 'share-1' })
    apiMocks.createShareStory.mockReset().mockResolvedValue({ id: 'story-1' })
    messengerMocks.createDirectConversation.mockReset()
    messengerMocks.sendMessage.mockReset()
  })

  afterEach(cleanup)

  it('opens a post-detail thread with media before the comment list', async () => {
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    expect(await screen.findByRole('dialog', { name: 'comments' })).toBeInTheDocument()
    expect(screen.getByText('Full post shown above its comments')).toBeInTheDocument()
    expect(screen.getByText('Reference Group')).toBeInTheDocument()
    expect(container.querySelector('.thread-post-preview .post-media-gallery')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('commentAs')).toBeInTheDocument()
    expect(container.querySelector('.group-post-avatar-stack .group-post-user-avatar')).toHaveStyle({ width: '24px', height: '24px' })
    expect(screen.queryByText('mostRelevant')).not.toBeInTheDocument()
  })

  it('uses a three-button post footer and a filled blue state after liking', async () => {
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    const footer = container.querySelector<HTMLElement>('.content-actions-wrap > .gateway-post-actions')!
    expect(footer.querySelectorAll(':scope > button')).toHaveLength(3)
    expect(footer.querySelector('[aria-label="save"]')).not.toBeInTheDocument()

    const likeButton = within(footer).getByRole('button', { name: 'like' })
    await waitFor(() => expect(likeButton).not.toBeDisabled())
    expect(likeButton.querySelector('svg')).toHaveAttribute('fill', 'none')
    fireEvent.click(likeButton)

    await waitFor(() => expect(likeButton).toHaveClass('active'))
    expect(likeButton.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
    expect(screen.getByText('youAndOthersReacted')).toBeInTheDocument()
  })

  it('sends the canonical content link through a direct Messenger conversation', async () => {
    const friend = { id: '3', username: 'friend', email: '', displayName: 'Friend Name', avatarUrl: null, isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '', friendCount: 1, postCount: 0 }
    socialMocks.getRelationProfiles.mockResolvedValue([friend])
    messengerMocks.createDirectConversation.mockResolvedValue({ id: 'conversation-1' })
    messengerMocks.sendMessage.mockResolvedValue({ id: 'message-1' })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    const contactName = await screen.findByText('Friend Name')
    fireEvent.click(contactName.closest('button')!)

    await waitFor(() => expect(messengerMocks.createDirectConversation).toHaveBeenCalledWith('3', '1'))
    expect(messengerMocks.sendMessage).toHaveBeenCalledWith('conversation-1', '1', { body: `${window.location.origin}/content/90` })
    expect(await screen.findByText('sentInMessenger')).toBeInTheDocument()
  })

  it('keeps group-post sharing link-only while exposing it from the detail thread', async () => {
    render(<ContentActions viewerId="1" contentId="90" post={post} canShare canReshare={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const thread = await screen.findByRole('dialog', { name: 'comments' })
    fireEvent.click(within(thread).getByRole('button', { name: 'shareAction' }))

    const shareDialog = await screen.findByRole('dialog', { name: 'sharePost' })
    expect(within(shareDialog).getByRole('button', { name: 'copyLink' })).toBeInTheDocument()
    expect(within(shareDialog).queryByRole('button', { name: 'shareNow' })).not.toBeInTheDocument()
    expect(within(shareDialog).queryByRole('button', { name: 'shareToStory' })).not.toBeInTheDocument()
    expect(socialMocks.sharePost).not.toHaveBeenCalled()
  })
})

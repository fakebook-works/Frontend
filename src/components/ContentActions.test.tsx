// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Activity, useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost, SharedStory } from '../api/gatewayTypes'
import { clearAllPrefetchedCommentPagesForTests } from '../lib/commentPagePrefetch'
import { MESSENGER_MESSAGE_SENT_EVENT } from '../lib/messengerLocalEvents'
import { ContentActions, ContentDetailOverlay } from './ContentActions'

const socialMocks = vi.hoisted(() => ({
  getContentEngagement: vi.fn(),
  likeContent: vi.fn(),
  unlikeContent: vi.fn(),
  saveContent: vi.fn(),
  unsaveContent: vi.fn(),
  getComments: vi.fn(),
  getLikedUsers: vi.fn(),
  getRelationProfiles: vi.fn(),
  createComment: vi.fn(),
  followUser: vi.fn(),
  mentionUser: vi.fn(),
  getProfile: vi.fn(),
  getMemberGroups: vi.fn(),
  getAdminGroups: vi.fn(),
  sharePost: vi.fn(),
  updatePost: vi.fn(),
  deleteContent: vi.fn(),
  updateComment: vi.fn(),
  getCommentEditHistory: vi.fn(),
}))
const apiMocks = vi.hoisted(() => ({
  createShareStory: vi.fn(),
  postDetail: vi.fn(),
  uploadMediaFiles: vi.fn(),
  cancelPendingMedia: vi.fn(),
}))
const messengerMocks = vi.hoisted(() => ({ conversations: vi.fn(), createDirectConversation: vi.fn(), sendMessage: vi.fn() }))
const translate = vi.hoisted(() => (key: string) => key)
const recommendationMocks = vi.hoisted(() => ({
  getRecommendationSurfaceSessionKey: vi.fn(() => 'detail-session'),
  useRecommendationImpression: vi.fn(),
}))

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/messenger', () => ({ messengerApi: messengerMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'en', t: translate }) }))
vi.mock('../lib/useRecommendationImpression', () => recommendationMocks)

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
  it('delegates post comments to the canonical route when the app shell owns overlays', async () => {
    const onNavigate = vi.fn()
    render(<ContentActions viewerId="1" contentId="90" post={post} routeComments onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    expect(onNavigate).toHaveBeenCalledWith('/content/90')
    expect(screen.queryByRole('dialog', { name: 'comments' })).not.toBeInTheDocument()
  })

  beforeEach(() => {
    clearAllPrefetchedCommentPagesForTests()
    window.sessionStorage.clear()
    socialMocks.getContentEngagement.mockReset().mockResolvedValue({ targetId: '90', likeCount: 2, commentCount: 1, shareCount: 0, viewCount: 0, viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false })
    socialMocks.likeContent.mockReset().mockResolvedValue(true)
    socialMocks.unlikeContent.mockReset().mockResolvedValue(true)
    socialMocks.saveContent.mockReset().mockResolvedValue(true)
    socialMocks.unsaveContent.mockReset().mockResolvedValue(true)
    socialMocks.getComments.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getLikedUsers.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([])
    socialMocks.createComment.mockReset()
    socialMocks.followUser.mockReset().mockResolvedValue(true)
    socialMocks.mentionUser.mockReset()
    socialMocks.getProfile.mockReset().mockResolvedValue(null)
    socialMocks.getMemberGroups.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getAdminGroups.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.sharePost.mockReset().mockResolvedValue({ id: 'share-1' })
    socialMocks.updatePost.mockReset().mockResolvedValue({ id: '90', privacy: 2 })
    socialMocks.deleteContent.mockReset().mockResolvedValue(true)
    socialMocks.updateComment.mockReset().mockResolvedValue(true)
    socialMocks.getCommentEditHistory.mockReset().mockResolvedValue([])
    apiMocks.createShareStory.mockReset().mockResolvedValue({ id: 'story-1' })
    apiMocks.postDetail.mockReset()
    apiMocks.uploadMediaFiles.mockReset()
    apiMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
    messengerMocks.createDirectConversation.mockReset()
    messengerMocks.conversations.mockReset().mockResolvedValue([])
    messengerMocks.sendMessage.mockReset()
    recommendationMocks.getRecommendationSurfaceSessionKey.mockClear()
    recommendationMocks.useRecommendationImpression.mockClear()
  })

  afterEach(cleanup)

  it('opens a post-detail thread with media before the comment list', async () => {
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    expect(await screen.findByRole('dialog', { name: 'comments' })).toBeInTheDocument()
    expect(screen.getByText('Full post shown above its comments')).toBeInTheDocument()
    expect(screen.getByText('Reference Group')).toBeInTheDocument()
    expect(container.querySelector('.thread-post-preview')).toHaveClass('gateway-post')
    expect(container.querySelector('.thread-post-preview .post-media-gallery')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('commentAs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'stickers' })).toBeEnabled()
    expect(container.querySelector('.group-post-avatar-stack .group-post-user-avatar')).toHaveStyle({ width: '24px', height: '24px' })
    expect(screen.queryByText('mostRelevant')).not.toBeInTheDocument()
    expect(await screen.findByText('noCommentsYet')).toBeInTheDocument()
    expect(screen.getByText('beFirstToComment')).toBeInTheDocument()
    expect(container.querySelector('.no-comments-document')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body).toHaveClass('content-detail-open')
    expect(document.querySelector('.content-detail-shell-close')).toBeInTheDocument()
    expect(container.querySelector('.thread-post-engagement')).toHaveClass('content-actions-wrap')
    expect(container.querySelector('.thread-post-engagement > nav')).toHaveClass('gateway-post-actions')
    expect(container.querySelector('.content-engagement-summary .content-share-summary')).not.toBeInTheDocument()
    expect(container.querySelector('.thread-post-engagement .content-share-summary')).not.toBeInTheDocument()
  })

  it('measures detail dwell on the post preview instead of the persistent comments shell', async () => {
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    await screen.findByRole('dialog', { name: 'comments' })

    const impressionCalls = recommendationMocks.useRecommendationImpression.mock.calls
    const measuredRef = impressionCalls[impressionCalls.length - 1]?.[0] as { current: HTMLElement | null }
    expect(measuredRef.current).toHaveClass('thread-post-preview')
    expect(measuredRef.current).not.toHaveClass('content-thread-modal')
  })

  it('closes the preserved post-detail portal before a hashtag navigates to Search', async () => {
    const onNavigate = vi.fn()
    const hashtagPost = { ...post, content: 'Look at #security' }
    function PreservedDestination() {
      const [visible, setVisible] = useState(true)
      return <Activity mode={visible ? 'visible' : 'hidden'}><ContentActions viewerId="1" contentId="90" post={hashtagPost} onNavigate={(path) => { onNavigate(path); setVisible(false) }} /></Activity>
    }
    render(<PreservedDestination />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    fireEvent.click(await screen.findByRole('link', { name: '#security' }))

    expect(onNavigate).toHaveBeenCalledWith('/search?q=%23security&tab=posts')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'comments' })).not.toBeInTheDocument())
    expect(document.querySelector('.content-detail-shell-close')).not.toBeInTheDocument()
  })

  it('submits a comment with Enter while Shift+Enter remains multiline', async () => {
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    const textarea = await screen.findByPlaceholderText('commentAs') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(socialMocks.createComment).not.toHaveBeenCalled()
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => expect(socialMocks.createComment).toHaveBeenCalledWith('1', '90', 'hello', null))
  })

  it('opens the shared photo viewer when an image is selected inside post detail', async () => {
    const onOpenImage = vi.fn()
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} onOpenImage={onOpenImage} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const imageSlot = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('.thread-post-preview .post-media-slot.image-interactive')
      expect(element).not.toBeNull()
      return element!
    })
    fireEvent.click(imageSlot)

    expect(onOpenImage).toHaveBeenCalledWith(post, post.media[0], 0, undefined)
  })

  it('omits the engagement summary completely when every count is zero', async () => {
    socialMocks.getContentEngagement.mockResolvedValue({
      targetId: '90', likeCount: 0, commentCount: 0, shareCount: 0,
      viewCount: 0,
      viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false,
    })
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)

    await waitFor(() => expect(container.querySelector('.content-actions-wrap')).toHaveClass('no-summary'))
    expect(container.querySelector('.content-engagement-summary')).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent('0 comments')
    expect(container).not.toHaveTextContent('0 shares')

    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    const dialog = await screen.findByRole('dialog', { name: 'comments' })
    expect(dialog).toHaveClass('content-thread-modal')
    expect(dialog).not.toHaveClass('photo-detail-discussion')
    expect(dialog.parentElement).toHaveClass('content-modal-backdrop')
    await screen.findByText('noCommentsYet')
    expect(dialog.querySelector('.thread-post-engagement')).toHaveClass('no-summary')
    expect(dialog.querySelector('.thread-post-engagement > div')).not.toBeInTheDocument()
    expect(dialog.querySelector('.content-thread-scroll')).toBeInTheDocument()

    fireEvent.click(dialog.querySelector('.content-thread-head button')!)
    await waitFor(() => expect(document.body.style.overflow).toBe(''))
    expect(document.body).not.toHaveClass('content-detail-open')
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

  it('submits comment mentions atomically as ID tokens', async () => {
    socialMocks.getRelationProfiles.mockResolvedValue([{
      id: '3', username: 'friend', displayName: 'Friend Name', avatarUrl: null, isVerified: false,
    }])
    socialMocks.createComment.mockResolvedValue({ id: 'comment-mention' })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const textarea = await screen.findByPlaceholderText('commentAs') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Hi @Fr' } })
    textarea.setSelectionRange(6, 6)
    fireEvent.select(textarea)
    fireEvent.click(await screen.findByRole('option', { name: /Friend Name/ }))
    expect(textarea).toHaveValue('Hi Friend Name ')
    expect(screen.getByText('Friend Name', { selector: 'strong.mention-draft-name' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'sendComment' }))

    await waitFor(() => expect(socialMocks.createComment).toHaveBeenCalledWith('1', '90', 'Hi [[mention:3]]', null))
    expect(socialMocks.mentionUser).not.toHaveBeenCalled()
  })

  it('loads direct replies lazily and starts a reply with the parent author mention', async () => {
    const rootComment = {
      id: '401', content: 'Root comment', createdAt: '2026-07-20T01:00:00Z',
      author: { id: '3', username: 'root', displayName: 'Root User', avatarUrl: null, isVerified: true },
      likeCount: 0, replyCount: 1, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
    }
    const childComment = {
      id: '402', content: 'Direct child', createdAt: '2026-07-20T01:05:00Z',
      author: { id: '4', username: 'child', displayName: 'Child User', avatarUrl: null, isVerified: false },
      likeCount: 2, replyCount: 0, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
    }
    socialMocks.getComments.mockImplementation((targetId: string) => Promise.resolve(targetId === '90'
      ? { items: [rootComment], endCursor: null, hasNextPage: false }
      : { items: [childComment], endCursor: null, hasNextPage: false }))
    socialMocks.createComment.mockResolvedValue({ id: 'reply-1' })
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const expand = await screen.findByRole('button', { name: /viewReplies/ })
    expect(socialMocks.getComments).toHaveBeenCalledTimes(1)
    fireEvent.click(expand)
    expect(await screen.findByText('Direct child')).toBeInTheDocument()
    expect(socialMocks.getComments).toHaveBeenCalledWith('401', 20, null)
    expect(container.querySelector('.thread-comment-children')).toBeInTheDocument()

    const rootNode = screen.getByText('Root comment').closest('.thread-comment-node')!
    const rootArticle = rootNode.querySelector<HTMLElement>(':scope > .thread-comment')!
    const replyButton = within(rootArticle).getByRole('button', { name: 'reply' })
    fireEvent.click(replyButton)
    const textarea = screen.getByPlaceholderText('writeReply') as HTMLTextAreaElement
    expect(textarea).toHaveValue('Root User ')
    expect(screen.getByText('Root User', { selector: 'strong.mention-draft-name' })).toBeInTheDocument()
    expect(screen.queryByText('replyingTo')).not.toBeInTheDocument()
    expect(screen.getByText('replyingToComment').closest('.reply-draft-node')).toBeInTheDocument()
    expect(rootNode).toHaveClass('has-children')
    expect(replyButton).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('.comment-compose-avatar-stack')).toHaveClass('replying')
    expect(container.querySelector('.comment-compose-reply-target .avatar')).toHaveStyle({ width: '18px', height: '18px' })

    fireEvent.click(replyButton)
    expect(screen.queryByText('replyingToComment')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('commentAs')).toHaveValue('')
    expect(replyButton).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('.comment-compose-reply-target')).not.toBeInTheDocument()

    fireEvent.click(replyButton)
    fireEvent.click(container.querySelector('.comment-compose-reply-cancel-zone')!)
    expect(screen.queryByText('replyingToComment')).not.toBeInTheDocument()
    expect(replyButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(replyButton)
    fireEvent.change(textarea, { target: { value: 'Root User thanks' } })
    fireEvent.click(screen.getByRole('button', { name: 'sendComment' }))
    await waitFor(() => expect(socialMocks.createComment).toHaveBeenCalledWith('1', '401', '[[mention:3]] thanks', null))
    await waitFor(() => expect(container.querySelector('.thread-post-engagement .content-comment-summary')).toHaveTextContent('2 comments'))
  })

  it('keeps the next-reply-page control reachable when a filtered page is empty', async () => {
    const rootComment = {
      id: 'empty-page-root', content: 'Root before an empty reply page', createdAt: '2026-07-20T01:00:00Z',
      author: { id: '3', username: 'root', displayName: 'Root User', avatarUrl: null, isVerified: false },
      likeCount: 0, replyCount: 2, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
    }
    const visibleReply = {
      id: 'visible-after-filter', content: 'Visible reply after filtered records', createdAt: '2026-07-20T01:05:00Z',
      author: { id: '4', username: 'reply', displayName: 'Reply User', avatarUrl: null, isVerified: false },
      likeCount: 0, replyCount: 0, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
    }
    socialMocks.getComments.mockImplementation((targetId: string, _limit: number, cursor: string | null) => {
      if (targetId === '90') return Promise.resolve({ items: [rootComment], endCursor: null, hasNextPage: false })
      return cursor == null
        ? Promise.resolve({ items: [], endCursor: '20', hasNextPage: true })
        : Promise.resolve({ items: [visibleReply], endCursor: null, hasNextPage: false })
    })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    fireEvent.click(await screen.findByRole('button', { name: /viewReplies/ }))
    const loadNextPage = await screen.findByRole('button', { name: 'seeMoreReplies' })
    expect(loadNextPage).toBeEnabled()
    fireEvent.click(loadNextPage)

    expect(await screen.findByText('Visible reply after filtered records')).toBeInTheDocument()
    expect(socialMocks.getComments).toHaveBeenCalledWith('empty-page-root', 20, '20')
  })

  it('deduplicates root comments when offset pages overlap', async () => {
    const repeated = {
      id: 'repeated-root', content: 'Repeated root comment', createdAt: '2026-07-20T01:00:00Z',
      author: { id: '3', username: 'root', displayName: 'Root User', avatarUrl: null, isVerified: false },
      likeCount: 0, replyCount: 0, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
    }
    const next = { ...repeated, id: 'next-root', content: 'Next unique root comment' }
    socialMocks.getComments.mockImplementation((_targetId: string, _limit: number, cursor: string | null) => cursor == null
      ? Promise.resolve({ items: [repeated], endCursor: '1', hasNextPage: true })
      : Promise.resolve({ items: [repeated, next], endCursor: null, hasNextPage: false }))
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    await screen.findByText('Repeated root comment')
    fireEvent.click(screen.getByRole('button', { name: 'seeMore' }))
    expect(await screen.findByText('Next unique root comment')).toBeInTheDocument()
    expect(screen.getAllByText('Repeated root comment')).toHaveLength(1)
  })

  it('uses the own-comment reply copy when the viewer replies to themself', async () => {
    socialMocks.getProfile.mockResolvedValue({ id: '1', username: 'viewer', displayName: 'Viewer Name', avatarUrl: null, isVerified: false })
    socialMocks.getComments.mockResolvedValue({
      items: [{
        id: 'self-comment', content: 'My own comment', createdAt: '2026-07-20T01:00:00Z',
        author: { id: '1', username: 'viewer', displayName: 'Viewer Name', avatarUrl: null, isVerified: false },
        likeCount: 0, replyCount: 0, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
      }],
      endCursor: null,
      hasNextPage: false,
    })
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    const commentNode = (await screen.findByText('My own comment')).closest('.thread-comment-node')!
    fireEvent.click(within(commentNode.querySelector<HTMLElement>(':scope > .thread-comment')!).getByRole('button', { name: 'reply' }))

    expect(screen.getByText('replyingToOwnComment')).toBeInTheDocument()
    expect(screen.queryByText('replyingToComment')).not.toBeInTheDocument()
    const replyState = screen.getByText('replyingToOwnComment').closest<HTMLElement>('.reply-draft-node')!
    const replyBubble = within(replyState).getByText('replyingToOwnComment').closest('.comment-state-bubble')!
    expect(replyBubble).not.toHaveTextContent('Viewer Name')
    expect(replyState.querySelector('.comment-state-heading')).toHaveTextContent('Viewer Name')
    expect(container.querySelector('.comment-compose-reply-target .avatar')).toHaveAttribute('aria-label', 'Viewer Name')
    fireEvent.click(replyBubble)
    expect(screen.queryByText('replyingToOwnComment')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('commentAs')).toBeInTheDocument()
  })

  it('grows the comment composer to eight lines and expands long rendered comments on demand', async () => {
    const longContent = Array.from({ length: 12 }, (_, index) => `Comment line ${index + 1}`).join('\n')
    socialMocks.getComments.mockResolvedValue({
      items: [{
        id: 'long-comment', content: longContent, createdAt: '2026-07-20T01:00:00Z',
        author: { id: '3', username: 'long', displayName: 'Long Commenter', avatarUrl: null, isVerified: false },
        likeCount: 0, replyCount: 0, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
      }],
      endCursor: null,
      hasNextPage: false,
    })
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    await screen.findByText('Long Commenter')
    const renderedContent = container.querySelector<HTMLParagraphElement>('.comment-content-wrap > p')!
    Object.defineProperties(renderedContent, {
      scrollHeight: { configurable: true, value: 240 },
      clientHeight: { configurable: true, value: 120 },
    })
    fireEvent.resize(window)
    const seeMore = await screen.findByRole('button', { name: 'seeMore' })
    expect(renderedContent).toHaveClass('is-collapsed')
    fireEvent.click(seeMore)
    expect(renderedContent).not.toHaveClass('is-collapsed')
    expect(screen.queryByRole('button', { name: 'seeMore' })).not.toBeInTheDocument()
    const seeLess = screen.getByRole('button', { name: 'seeLess' })
    fireEvent.click(seeLess)
    expect(renderedContent).toHaveClass('is-collapsed')
    expect(screen.getByRole('button', { name: 'seeMore' })).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText('commentAs') as HTMLTextAreaElement
    let textareaScrollHeight = 240
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => textareaScrollHeight })
    fireEvent.change(textarea, { target: { value: Array.from({ length: 10 }, (_, index) => `Draft ${index + 1}`).join('\n') } })
    await waitFor(() => expect(textarea.style.overflowY).toBe('auto'))
    expect(Number.parseFloat(textarea.style.height)).toBeLessThanOrEqual(161)

    textareaScrollHeight = 24
    fireEvent.change(textarea, { target: { value: 'Short draft' } })
    await waitFor(() => expect(textarea.style.overflowY).toBe('hidden'))
    expect(textarea.style.height).toBe('24px')
  })

  it('uses a like icon for comments and lazily caches the liker names tooltip', async () => {
    socialMocks.getComments.mockResolvedValue({
      items: [{
        id: '501', content: 'Liked comment', createdAt: '2026-07-20T02:00:00Z',
        author: { id: '3', username: 'commenter', displayName: 'Comment Author', avatarUrl: null, isVerified: false },
        likeCount: 2, replyCount: 0, viewerHasLiked: false, canFollowAuthor: false, isFollowingAuthor: false, mentions: [], media: null,
      }],
      endCursor: null,
      hasNextPage: false,
    })
    socialMocks.getLikedUsers.mockResolvedValue({
      items: [{ id: '7', username: 'liker', displayName: 'Liker One', avatarUrl: null, isVerified: false }],
      endCursor: null,
      hasNextPage: false,
    })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const commentArticle = (await screen.findByText('Liked comment')).closest('.thread-comment') as HTMLElement
    const likeAction = within(commentArticle).getByRole('button', { name: 'like' })
    expect(likeAction).not.toHaveTextContent('like')
    expect(likeAction.querySelector('svg')).toBeInTheDocument()
    const commentTimeAnchor = commentArticle.querySelector('time')?.parentElement as HTMLElement
    fireEvent.mouseEnter(commentTimeAnchor)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('2026')
    fireEvent.mouseLeave(commentTimeAnchor)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    const likeControl = commentArticle.querySelector('.comment-like-summary') as HTMLElement

    fireEvent.mouseEnter(likeControl)
    expect(await screen.findByText('Liker One')).toBeInTheDocument()
    expect(screen.getByText(/taggedAnd taggedOthers/)).toBeInTheDocument()
    expect(socialMocks.getLikedUsers).toHaveBeenCalledWith('501', 5)
    fireEvent.mouseLeave(likeControl)
    fireEvent.mouseEnter(likeControl)
    await waitFor(() => expect(socialMocks.getLikedUsers).toHaveBeenCalledTimes(1))
  })

  it('shows Follow only for followable comment authors and updates every loaded comment from that author', async () => {
    const author = { id: '8', username: 'followable', displayName: 'Followable User', avatarUrl: null, isVerified: false }
    socialMocks.getComments.mockResolvedValue({
      items: [
        { id: '601', content: 'First comment', createdAt: '2026-07-20T02:00:00Z', author, likeCount: 0, replyCount: 0, viewerHasLiked: false, canFollowAuthor: true, isFollowingAuthor: false, mentions: [], media: null },
        { id: '602', content: 'Second comment', createdAt: '2026-07-20T02:05:00Z', author, likeCount: 0, replyCount: 0, viewerHasLiked: false, canFollowAuthor: true, isFollowingAuthor: false, mentions: [], media: null },
      ],
      endCursor: null,
      hasNextPage: false,
    })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const followButtons = await screen.findAllByRole('button', { name: 'follow' })
    expect(followButtons).toHaveLength(2)
    fireEvent.click(followButtons[0])

    await waitFor(() => expect(socialMocks.followUser).toHaveBeenCalledWith('1', '8'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'follow' })).not.toBeInTheDocument())
  })

  it('allows an image-only comment and sends exactly one uploaded image', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:comment-preview') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    apiMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'https://uploads.example.com/comment.jpg', type: 'image', contentType: 'image/jpeg',
      size: 10, name: 'comment.jpg', assetId: 'asset-comment', state: 'pending',
    }])
    socialMocks.createComment.mockResolvedValue({ id: 'comment-image' })
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    await screen.findByPlaceholderText('commentAs')

    const file = new File([new Uint8Array([1, 2, 3])], 'comment.jpg', { type: 'image/jpeg' })
    const input = container.querySelector<HTMLInputElement>('.comment-compose-tool-list input[type="file"]')!
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'sendComment' }))

    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalledWith([file]))
    expect(socialMocks.createComment).toHaveBeenCalledWith('1', '90', '', { type: 0, url: 'https://uploads.example.com/comment.jpg' })
    expect(apiMocks.cancelPendingMedia).not.toHaveBeenCalled()
  })

  it('edits, shows revision history and tombstones an own comment without removing its node', async () => {
    socialMocks.getComments.mockResolvedValue({
      items: [{
        id: 'own-comment-700', content: 'Current text', createdAt: '2026-07-20T02:00:00Z',
        author: { id: '1', username: 'viewer', displayName: 'Viewer Name', avatarUrl: null, isVerified: false },
        likeCount: 1, replyCount: 0, viewerHasLiked: true, canFollowAuthor: false, isFollowingAuthor: false,
        mentions: [], media: null, isDeleted: false, editedAt: '2026-07-20T02:05:00Z',
      }],
      endCursor: null,
      hasNextPage: false,
    })
    socialMocks.getCommentEditHistory.mockResolvedValue([{
      content: 'Original text', editedAt: '2026-07-20T02:05:00Z', mentions: [],
    }])
    socialMocks.getProfile.mockResolvedValue({ id: '1', username: 'viewer', displayName: 'Viewer Name', avatarUrl: null, isVerified: false })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    await screen.findByText('Current text')

    fireEvent.click(screen.getByRole('button', { name: 'commentOptions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'editComment' }))
    const initialEditor = screen.getByRole('textbox', { name: 'editComment' })
    expect(initialEditor.closest('.comment-compose')).toBeInTheDocument()
    expect(document.querySelector('.comment-inline-editor')).not.toBeInTheDocument()
    const activeEditPreview = screen.getByText('editingOwnComment').closest<HTMLElement>('.comment-active-edit-preview')!
    expect(activeEditPreview).toBeInTheDocument()
    expect(activeEditPreview).toHaveTextContent('Current text')
    expect(activeEditPreview.querySelector('.comment-active-edit-title')).toHaveTextContent('editingOwnComment')
    expect(activeEditPreview.querySelector('.comment-active-edit-original')).toHaveClass('comment-state-text')
    const activeEditTitle = screen.getByRole('button', { name: 'editingOwnComment' })
    expect(activeEditTitle).toHaveClass('comment-active-edit-title')
    fireEvent.click(activeEditTitle)
    expect(screen.queryByRole('textbox', { name: 'editComment' })).not.toBeInTheDocument()
    expect(screen.queryByText('editingOwnComment')).not.toBeInTheDocument()
    expect(screen.getByText('Current text')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'commentOptions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'editComment' }))
    const editor = screen.getByRole('textbox', { name: 'editComment' })
    fireEvent.change(editor, { target: { value: 'Updated text' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(socialMocks.updateComment).toHaveBeenCalledWith('own-comment-700', 'Updated text'))
    expect(await screen.findByText('Updated text')).toBeInTheDocument()

    const replyAction = screen.getByRole('button', { name: 'reply' })
    const editedAction = screen.getByRole('button', { name: 'editedMessage' })
    expect(replyAction).toHaveClass('comment-meta-text-action')
    expect(editedAction).toHaveClass('comment-meta-text-action')
    fireEvent.click(editedAction)
    const currentText = screen.getByText('Updated text')
    const historyText = await screen.findByText('Original text')
    const historyEntry = historyText.closest('.comment-history-entry')!
    expect(currentText.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(historyEntry).not.toHaveClass('comment-bubble')
    expect(historyEntry.compareDocumentPosition(replyAction.closest('.comment-meta')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.mouseEnter(historyEntry)
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(historyEntry)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    expect(socialMocks.getCommentEditHistory).toHaveBeenCalledWith('own-comment-700')

    fireEvent.click(screen.getByRole('button', { name: 'commentOptions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'deleteComment' }))
    expect(screen.getByRole('menuitem', { name: 'deleteComment' })).toHaveClass('active')
    expect(screen.getByRole('menuitem', { name: 'deleteComment' })).toHaveAttribute('aria-pressed', 'true')
    let deleteConfirm = screen.getByRole('group', { name: 'deleteCommentConfirm' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(socialMocks.deleteContent).not.toHaveBeenCalled()
    fireEvent.click(within(deleteConfirm).getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('group', { name: 'deleteCommentConfirm' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'deleteComment' })).not.toHaveClass('active')
    expect(screen.getByRole('menuitem', { name: 'deleteComment' })).toHaveAttribute('aria-pressed', 'false')
    expect(socialMocks.deleteContent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('menuitem', { name: 'deleteComment' }))
    deleteConfirm = screen.getByRole('group', { name: 'deleteCommentConfirm' })
    fireEvent.click(within(deleteConfirm).getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(socialMocks.deleteContent).toHaveBeenCalledWith('own-comment-700'))
    const tombstone = (await screen.findByText('commentDeleted')).closest<HTMLElement>('.thread-comment')!
    expect(tombstone).toHaveTextContent('Viewer Name')
    expect(tombstone.querySelector('.comment-author .avatar')).toBeInTheDocument()
    const tombstoneBubble = within(tombstone).getByText('commentDeleted').closest('.comment-state-bubble')!
    expect(tombstoneBubble).not.toHaveTextContent('Viewer Name')
    expect(tombstone.querySelector('.comment-state-heading')).toHaveTextContent('Viewer Name')
    expect(screen.queryByText('Updated text')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reply' })).not.toBeInTheDocument()
  })

  it('pastes a copied image into the existing one-image comment upload flow', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:clipboard-comment') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    apiMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'https://uploads.example.com/comment-clipboard.png', type: 'image', contentType: 'image/png',
      size: 10, name: 'comment-clipboard.png', assetId: 'asset-comment-clipboard', state: 'pending',
    }])
    socialMocks.createComment.mockResolvedValue({ id: 'comment-clipboard' })
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    const textarea = await screen.findByPlaceholderText('commentAs')
    const image = new File(['clipboard'], 'comment-clipboard.png', { type: 'image/png' })

    fireEvent.paste(textarea, { clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      files: [image],
      getData: () => 'https://example.com/comment-clipboard.png',
    } })
    await waitFor(() => expect(container.querySelector('.comment-image-preview img')).toHaveAttribute('src', 'blob:clipboard-comment'))
    fireEvent.click(screen.getByRole('button', { name: 'sendComment' }))

    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalledWith([image]))
    expect(socialMocks.createComment).toHaveBeenCalledWith('1', '90', '', { type: 0, url: 'https://uploads.example.com/comment-clipboard.png' })
  })

  it('shows reel views last and hides the metric when it is zero', async () => {
    const reel: GatewayPost = {
      __typename: 'ReelDetail', id: '91', type: 3, content: 'Reel in home', privacy: 0,
      create: '2026-07-20T01:00:00Z', author: { id: '2', name: 'Reel Author', avatar: '', isVerified: false, canFollow: false },
      media: [{ id: 'rm1', type: 1, url: 'https://uploads.example.com/reel.mp4' }],
    }
    socialMocks.getContentEngagement.mockResolvedValue({ targetId: '91', likeCount: 1, commentCount: 2, shareCount: 3, viewCount: 46, viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false })
    const { container } = render(<ContentActions viewerId="1" contentId="91" post={reel} />)

    await waitFor(() => expect(container.querySelector('.content-view-summary')).toHaveTextContent('46 views'))
    const metrics = [...container.querySelectorAll('.content-engagement-summary > span')]
    expect(metrics[metrics.length - 1]).toHaveClass('content-view-summary')
  })

  it('keeps zero-valued Reel action slots stable while hiding their numbers', async () => {
    const reel: GatewayPost = {
      __typename: 'ReelDetail', id: '92', type: 3, content: 'Empty Reel metrics', privacy: 0,
      create: '2026-07-20T01:00:00Z', author: { id: '2', name: 'Reel Author', avatar: '', isVerified: false, canFollow: false },
      media: [{ id: 'rm2', type: 1, url: 'https://uploads.example.com/reel-empty.mp4' }],
    }
    socialMocks.getContentEngagement.mockResolvedValue({ targetId: '92', likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false })
    const { container } = render(<ContentActions viewerId="1" contentId="92" post={reel} variant="reel" />)

    await waitFor(() => expect(container.querySelectorAll('.reel-actions > button span')).toHaveLength(3))
    expect([...container.querySelectorAll('.reel-actions > button span')].map((node) => node.textContent)).toEqual(['0', '0', '0'])
    expect(container.querySelectorAll('.reel-action-count.is-empty')).toHaveLength(3)
    expect(container.querySelector('.reel-save-action')).not.toHaveTextContent('save')
  })

  it('offers Reel interest, link and playback-speed options without changing the action rail', async () => {
    const reel: GatewayPost = {
      __typename: 'ReelDetail', id: 'reel-options-93', type: 3, content: 'Options', privacy: 0,
      create: '2026-07-20T01:00:00Z', author: { id: '2', name: 'Reel Author', avatar: '', isVerified: false },
      media: [{ id: 'rm3', type: 1, url: 'https://uploads.example.com/reel-options.mp4' }],
    }
    const onRateChange = vi.fn()
    const { container } = render(<ContentActions viewerId="1" contentId={reel.id} post={reel} variant="reel" reelPlaybackRate={1} onReelPlaybackRateChange={onRateChange} />)

    await waitFor(() => expect(container.querySelector('.reel-more-action')).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'more' }))
    expect(screen.getByRole('menuitem', { name: 'interested' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'notInterested' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'copyLink' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'deleteReel' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /videoPlaybackSpeed/ }))
    expect(screen.queryByRole('menuitem', { name: 'interested' })).not.toBeInTheDocument()
    expect(container.querySelector('.reel-speed-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.getByRole('menuitem', { name: 'interested' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /videoPlaybackSpeed/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '1.5x' }))
    expect(onRateChange).toHaveBeenCalledWith(1.5)
    expect(container.querySelector('.reel-options-menu')).not.toBeInTheDocument()
  })

  it('offers deletion only to the Reel owner and reports the deleted id', async () => {
    const ownedReel: GatewayPost = {
      __typename: 'ReelDetail', id: 'owned-reel-94', type: 3, content: 'Mine', privacy: 0,
      create: '2026-07-20T01:00:00Z', author: { id: '1', name: 'Viewer', avatar: '', isVerified: false },
      media: [{ id: 'rm4', type: 1, url: 'https://uploads.example.com/owned-reel.mp4' }],
    }
    const onContentDeleted = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ContentActions viewerId="1" contentId={ownedReel.id} post={ownedReel} variant="reel" onContentDeleted={onContentDeleted} />)

    fireEvent.click(screen.getByRole('button', { name: 'more' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'deleteReel' }))

    await waitFor(() => expect(socialMocks.deleteContent).toHaveBeenCalledWith(ownedReel.id))
    expect(onContentDeleted).toHaveBeenCalledWith(ownedReel.id)
    confirm.mockRestore()
  })

  it('renders Reel comments in the reusable photo-viewer sidebar without opening a modal', async () => {
    const longAuthorName = 'Reel Author With A Name That Exceeds The Comment Sidebar Width'
    const reel: GatewayPost = {
      __typename: 'ReelDetail', id: 'reel-sidebar-9007199254740993', type: 3, content: 'Reel discussion', privacy: 0,
      create: '2026-07-20T01:00:00Z', author: { id: '2', name: longAuthorName, avatar: '', isVerified: false },
      media: [{ id: 'rm-sidebar', type: 1, url: 'https://uploads.example.com/reel-sidebar.mp4' }],
    }
    const onCommentsOpenChange = vi.fn()
    const { container, rerender } = render(<ContentActions viewerId="1" contentId={reel.id} post={reel} variant="reel" commentsPresentation="sidebar" commentsOpen={false} onCommentsOpenChange={onCommentsOpenChange} />)
    const reelActions = container.querySelector<HTMLElement>('.reel-actions')!

    fireEvent.click(within(reelActions).getByRole('button', { name: 'commentAction' }))
    expect(onCommentsOpenChange).toHaveBeenCalledWith(true)

    rerender(<ContentActions viewerId="1" contentId={reel.id} post={reel} variant="reel" commentsPresentation="sidebar" commentsOpen onCommentsOpenChange={onCommentsOpenChange} />)
    expect(container.querySelector('.reels-comments-sidebar .photo-detail-discussion')).toBeInTheDocument()
    expect(container.querySelector('.photo-detail-discussion .thread-post-primary-name')).toHaveTextContent(longAuthorName)
    expect(container.querySelector('.photo-detail-discussion .post-privacy-hover')).toBeInTheDocument()
    expect(container.querySelector('.reels-comments-sidebar')).toHaveAttribute('aria-label', 'comments')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Reel discussion')).toBeInTheDocument()

    fireEvent.click(within(reelActions).getByRole('button', { name: 'commentAction' }))
    expect(onCommentsOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('sends the canonical content link through a direct Messenger conversation', async () => {
    const friend = { id: '3', username: 'friend', email: '', displayName: 'Friend Name', avatarUrl: null, isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '', friendCount: 1, postCount: 0 }
    messengerMocks.conversations.mockResolvedValue([{ id: 'conversation-1', type: 'DIRECT', participants: [{ id: '1', username: 'me', displayName: 'Me', avatarUrl: null }, friend], title: null, avatarUrl: null, updatedAt: '', unreadCount: 0, lastMessage: null }])
    messengerMocks.sendMessage.mockResolvedValue({ id: 'message-1' })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    fireEvent.click(await screen.findByRole('button', { name: 'sendInMessenger' }))
    const contactName = await screen.findByText('Friend Name')
    fireEvent.click(contactName.closest('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await waitFor(() => expect(messengerMocks.sendMessage).toHaveBeenCalled())
    expect(messengerMocks.createDirectConversation).not.toHaveBeenCalled()
    expect(messengerMocks.sendMessage).toHaveBeenCalledWith('conversation-1', expect.objectContaining({ id: '1' }), { body: `${window.location.origin}/content/90` })
  })

  it('notifies open Messenger views after a shared link is accepted', async () => {
    const friend = { id: '3', username: 'friend', email: '', displayName: 'Friend Name', avatarUrl: null, isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '', friendCount: 1, postCount: 0 }
    const sharedMessage = { id: 'message-1', conversationId: 'conversation-1', body: `${window.location.origin}/content/90`, createdAt: '2026-08-08T10:00:00Z' }
    const onMessageSent = vi.fn()
    window.addEventListener(MESSENGER_MESSAGE_SENT_EVENT, onMessageSent)
    messengerMocks.conversations.mockResolvedValue([{ id: 'conversation-1', type: 'DIRECT', participants: [{ id: '1', username: 'me', displayName: 'Me', avatarUrl: null }, friend], title: null, avatarUrl: null, updatedAt: '', unreadCount: 0, lastMessage: null }])
    messengerMocks.sendMessage.mockResolvedValue(sharedMessage)

    try {
      render(<ContentActions viewerId="1" contentId="90" post={post} />)
      fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
      fireEvent.click(await screen.findByRole('button', { name: 'sendInMessenger' }))
      fireEvent.click((await screen.findByText('Friend Name')).closest('button')!)
      fireEvent.click(screen.getByRole('button', { name: 'send' }))

      await waitFor(() => expect(onMessageSent).toHaveBeenCalledTimes(1))
      expect((onMessageSent.mock.calls[0][0] as CustomEvent).detail).toEqual(sharedMessage)
    } finally {
      window.removeEventListener(MESSENGER_MESSAGE_SENT_EVENT, onMessageSent)
    }
  })

  it('sends one shared link to multiple direct and group conversations in one action', async () => {
    const friend = { id: '3', username: 'friend', displayName: 'Friend Name', avatarUrl: null }
    messengerMocks.conversations.mockResolvedValue([
      { id: 'direct-1', type: 'DIRECT', participants: [{ id: '1', username: 'me', displayName: 'Me', avatarUrl: null }, friend], title: null, avatarUrl: null, updatedAt: '', unreadCount: 0, lastMessage: null },
      { id: 'group-1', type: 'GROUP', participants: [{ id: '1', username: 'me', displayName: 'Me', avatarUrl: null }, friend], title: 'Project team', avatarUrl: null, updatedAt: '', unreadCount: 0, lastMessage: null },
    ])
    render(<ContentActions viewerId="1" contentId="90" post={post} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    fireEvent.click(await screen.findByRole('button', { name: 'sendInMessenger' }))
    fireEvent.click(await screen.findByText('Friend Name'))
    fireEvent.click(screen.getByText('Project team'))
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await waitFor(() => expect(messengerMocks.sendMessage).toHaveBeenCalledTimes(2))
    expect(messengerMocks.sendMessage).toHaveBeenCalledWith('direct-1', expect.anything(), { body: `${window.location.origin}/content/90` })
    expect(messengerMocks.sendMessage).toHaveBeenCalledWith('group-1', expect.anything(), { body: `${window.location.origin}/content/90` })
  })

  it('keeps only failed Messenger targets selected after a partial send', async () => {
    const friend = { id: '3', username: 'friend', displayName: 'Friend Name', avatarUrl: null }
    messengerMocks.conversations.mockResolvedValue([
      { id: 'direct-1', type: 'DIRECT', participants: [{ id: '1', username: 'me', displayName: 'Me', avatarUrl: null }, friend], title: null, avatarUrl: null, updatedAt: '', unreadCount: 0, lastMessage: null },
      { id: 'group-1', type: 'GROUP', participants: [{ id: '1', username: 'me', displayName: 'Me', avatarUrl: null }, friend], title: 'Project team', avatarUrl: null, updatedAt: '', unreadCount: 0, lastMessage: null },
    ])
    messengerMocks.sendMessage.mockImplementation((conversationId: string) => conversationId === 'group-1'
      ? Promise.reject(new Error('temporary failure'))
      : Promise.resolve({ id: 'sent' }))
    render(<ContentActions viewerId="1" contentId="90" post={post} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    fireEvent.click(await screen.findByRole('button', { name: 'sendInMessenger' }))
    fireEvent.click(await screen.findByText('Friend Name'))
    fireEvent.click(screen.getByText('Project team'))
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('sendInMessengerError')
    expect(screen.getByText('Friend Name').closest('button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Project team').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the selected group composer preview and creates a GroupPost share wrapper', async () => {
    socialMocks.getMemberGroups.mockResolvedValue({ items: [{ id: 'group-8', name: 'Design group', avatarUrl: null, backgroundUrl: null, privacy: 1, memberCount: 12, adminCount: 1, bio: null, createdAt: '' }], endCursor: null, hasNextPage: false })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    const dialog = await screen.findByRole('dialog', { name: 'sharePost' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'shareToGroup' }))
    fireEvent.click(await within(dialog).findByText('Design group'))
    expect(within(dialog).getByText('privateGroup')).toBeInTheDocument()
    const shareToGroupButtons = within(dialog).getAllByRole('button', { name: 'shareToGroup' })
    fireEvent.click(shareToGroupButtons[shareToGroupButtons.length - 1])

    await waitFor(() => expect(socialMocks.sharePost).toHaveBeenCalledWith('1', '90', '', 0, 'group-8'))
  })

  it('renders the Newsfeed share dialog in the document-level modal layer', async () => {
    const { container } = render(<ContentActions viewerId="1" contentId="90" post={post} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    const dialog = await screen.findByRole('dialog', { name: 'sharePost' })

    expect(dialog.parentElement).toHaveClass('modal-backdrop', 'share-post-backdrop')
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(container).not.toContainElement(dialog)
  })

  it('renders a full unavailable post and disabled discussion shell for an inaccessible deep link', async () => {
    apiMocks.postDetail.mockResolvedValue(null)
    render(<ContentDetailOverlay viewerId="1" contentId="missing-post" onClose={vi.fn()} />)

    const dialog = await screen.findByRole('dialog', { name: 'contentUnavailable' })
    expect(within(dialog).getAllByText('unavailablePostPlaceholder').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('cannotComment')).toBeInTheDocument()
    expect(within(dialog).getByPlaceholderText('commentFeatureUnavailable')).toBeDisabled()
  })

  it('lets the owner change privacy from the post-detail header', async () => {
    const ownedPost: GatewayPost = {
      __typename: 'FeedPostDetail', id: 'owned-1', type: 2, content: 'Owned', privacy: 0, create: '2026-07-20T08:00:00Z',
      author: { id: '1', name: 'Owner', avatar: '', isVerified: false }, media: [], sharedSource: null,
    }
    apiMocks.postDetail.mockResolvedValue(ownedPost)
    socialMocks.updatePost.mockResolvedValue({ id: 'owned-1', privacy: 2 })
    render(<ContentDetailOverlay viewerId="1" contentId="owned-1" onClose={vi.fn()} />)

    const dialog = await screen.findByRole('dialog', { name: 'comments' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'privacyPublic' }))
    fireEvent.click(await screen.findByRole('option', { name: 'privacyFriends' }))

    await waitFor(() => expect(socialMocks.updatePost).toHaveBeenCalledWith('owned-1', { privacy: 2 }))
  })

  it('returns the fully created shared story so Home can update its tile and unseen ring immediately', async () => {
    const feedPost: GatewayPost = {
      __typename: 'FeedPostDetail', id: '90', type: 2, content: 'Original post content', privacy: 0,
      create: '2026-07-21T08:00:00Z', author: { id: '2', name: 'Original Author', avatar: '', isVerified: false },
      media: [], sharedSource: null,
    }
    const story: SharedStory = {
      __typename: 'FeedPostShareStory',
      id: 'story-shared-1',
      content: '',
      create: '2026-07-21T09:00:00Z',
      sharedSource: {
        id: '90',
        content: 'Original post content',
        media: null,
        author: { id: '2', name: 'Original Author', avatar: '', isVerified: false },
      },
    }
    apiMocks.createShareStory.mockResolvedValue(story)
    const onStoryCreated = vi.fn()
    render(<ContentActions viewerId="1" contentId="90" post={feedPost} onStoryCreated={onStoryCreated} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    fireEvent.click(await screen.findByRole('button', { name: 'shareToStory' }))

    await waitFor(() => expect(apiMocks.createShareStory).toHaveBeenCalledWith('1', '90', ''))
    expect(onStoryCreated).toHaveBeenCalledWith(story)
    expect(window.sessionStorage.getItem('fakebook.own-unseen-stories.1')).toContain('story-shared-1')
  })

  it('resharing a shared feed post targets the original post instead of nesting the wrapper', async () => {
    const sharedWrapper: GatewayPost = {
      __typename: 'FeedPostDetail',
      id: 'share-wrapper',
      type: 1,
      content: 'Wrapper commentary',
      privacy: 0,
      create: '2026-07-21T08:00:00Z',
      author: { id: '4', name: 'Wrapper Author', avatar: '', isVerified: false, canFollow: false },
      media: [],
      sharedSource: {
        id: 'original-post',
        isAvailable: true,
        type: 2,
        content: 'Original content',
        privacy: 0,
        create: '2026-07-20T08:00:00Z',
        author: { id: '2', name: 'Original Author', avatar: '', isVerified: false },
        media: [],
      },
    }
    apiMocks.postDetail.mockResolvedValue({
      __typename: 'FeedPostDetail',
      id: 'original-post',
      type: 2,
      content: 'Original content',
      privacy: 0,
      create: '2026-07-20T08:00:00Z',
      author: { id: '2', name: 'Original Author', avatar: '', isVerified: false, canFollow: false },
      media: [],
      sharedSource: null,
    })
    render(<ContentActions viewerId="1" contentId="share-wrapper" post={sharedWrapper} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    const shareDialog = await screen.findByRole('dialog', { name: 'sharePost' })
    expect(await within(shareDialog).findByText('Original content')).toBeInTheDocument()
    expect(within(shareDialog).queryByText('shareToFeed')).not.toBeInTheDocument()
    expect(within(shareDialog).getByRole('button', { name: 'sendInMessenger' })).toBeInTheDocument()
    expect(within(shareDialog).getByRole('button', { name: 'shareToStory' })).toBeInTheDocument()
    expect(within(shareDialog).getByRole('button', { name: 'copyLink' })).toBeInTheDocument()
    expect(within(shareDialog).getByRole('button', { name: 'shareToGroup' })).toBeInTheDocument()
    fireEvent.click(within(shareDialog).getByRole('button', { name: 'shareNow' }))

    await waitFor(() => expect(socialMocks.sharePost).toHaveBeenCalledWith('1', 'original-post', '', 0, null))
  })

  it('loads a shared source into the existing post-detail modal without navigating', async () => {
    const sourcePost: GatewayPost = {
      __typename: 'FeedPostDetail',
      id: 'original-post',
      type: 1,
      content: 'Original detail content',
      privacy: 0,
      create: '2026-07-20T08:00:00Z',
      author: { id: '2', name: 'Original Author', avatar: '', isVerified: false, canFollow: false },
      media: [],
      sharedSource: null,
    }
    apiMocks.postDetail.mockResolvedValue(sourcePost)
    socialMocks.getContentEngagement.mockResolvedValue({ targetId: 'original-post', likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false })
    const onNavigate = vi.fn()

    render(<ContentDetailOverlay viewerId="1" contentId="original-post" onClose={vi.fn()} onNavigate={onNavigate} />)

    expect(await screen.findByRole('dialog', { name: 'comments' })).toBeInTheDocument()
    expect(screen.getByText('Original detail content')).toBeInTheDocument()
    expect(apiMocks.postDetail).toHaveBeenCalledWith('original-post')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('closes post detail before navigating from a hashtag', async () => {
    const hashtagPost: GatewayPost = {
      __typename: 'FeedPostDetail', id: 'hashtag-post', type: 2, content: 'Đọc #thước_phim', privacy: 0,
      create: '2026-07-20T08:00:00Z', author: { id: '2', name: 'Original Author', avatar: '', isVerified: false, canFollow: false },
      media: [], sharedSource: null,
    }
    apiMocks.postDetail.mockResolvedValue(hashtagPost)
    const onClose = vi.fn()
    const onNavigate = vi.fn()
    render(<ContentDetailOverlay viewerId="1" contentId={hashtagPost.id} onClose={onClose} onNavigate={onNavigate} />)

    fireEvent.click(await screen.findByRole('link', { name: '#thước_phim' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onNavigate).toHaveBeenCalledWith('/search?q=%23th%C6%B0%E1%BB%9Bc_phim&tab=posts')
  })

  it('keeps feed and story sharing available for a private post the viewer can read', async () => {
    const privatePost: GatewayPost = {
      __typename: 'FeedPostDetail',
      id: 'friends-post',
      type: 1,
      content: 'Friends-only source',
      privacy: 2,
      create: '2026-07-20T08:00:00Z',
      author: { id: '2', name: 'Friend Author', avatar: '', isVerified: false, canFollow: false },
      media: [],
      sharedSource: null,
    }
    apiMocks.postDetail.mockResolvedValue(privatePost)
    socialMocks.getContentEngagement.mockResolvedValue({ targetId: privatePost.id, likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, viewerHasLiked: false, viewerHasSaved: false, viewerHasWatched: false })
    render(<ContentDetailOverlay viewerId="1" contentId={privatePost.id} onClose={vi.fn()} />)

    const thread = await screen.findByRole('dialog', { name: 'comments' })
    fireEvent.click(within(thread).getByRole('button', { name: 'shareAction' }))
    const shareDialog = await screen.findByRole('dialog', { name: 'sharePost' })
    expect(within(shareDialog).getByRole('button', { name: 'shareNow' })).toBeInTheDocument()
    expect(within(shareDialog).getByRole('button', { name: 'shareToStory' })).toBeInTheDocument()
  })

  it('allows a visible group post to be shared to feed or group, but not to Story', async () => {
    render(<ContentActions viewerId="1" contentId="90" post={post} canShare canReshare />)
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))

    const thread = await screen.findByRole('dialog', { name: 'comments' })
    fireEvent.click(within(thread).getByRole('button', { name: 'shareAction' }))

    const shareDialog = await screen.findByRole('dialog', { name: 'sharePost' })
    expect(within(shareDialog).getByRole('button', { name: 'copyLink' })).toBeInTheDocument()
    expect(within(shareDialog).getByRole('button', { name: 'shareNow' })).toBeInTheDocument()
    expect(within(shareDialog).getByRole('button', { name: 'shareToGroup' })).toBeInTheDocument()
    expect(within(shareDialog).queryByRole('button', { name: 'shareToStory' })).not.toBeInTheDocument()
    expect(socialMocks.sharePost).not.toHaveBeenCalled()
  })

  it('disables the share action when a private group source is unavailable to the viewer', async () => {
    const wrapper: GatewayPost = {
      __typename: 'FeedPostDetail', id: 'private-wrapper', type: 1, content: '', privacy: 0,
      create: '2026-07-20T08:00:00Z',
      author: { id: '2', name: 'Wrapper Author', avatar: '', isVerified: false },
      media: [],
      sharedSource: {
        id: 'private-group-post', isAvailable: false, type: 3, content: null, privacy: 1,
        create: null, author: null, media: [], requiresGroupMembership: true,
        group: { id: 'private-group', name: 'Private Group', avatar: '', background: '', privacy: 1, memberCount: 20, viewerIsMember: false, joinRequestPending: false },
      },
    }
    render(<ContentActions viewerId="1" contentId={wrapper.id} post={wrapper} canShare canReshare={false} />)

    const shareButton = await screen.findByRole('button', { name: 'shareAction' })
    expect(shareButton).toBeDisabled()
    fireEvent.click(shareButton)
    expect(screen.queryByRole('dialog', { name: 'sharePost' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'commentAction' }))
    const detail = await screen.findByRole('dialog', { name: 'comments' })
    expect(within(detail).getByRole('button', { name: 'shareAction' })).toBeDisabled()
  })

  it('reuses the canonical Group preview when resharing a post that already shares a group', async () => {
    const wrapper: GatewayPost = {
      __typename: 'FeedPostDetail', id: 'group-wrapper', type: 1, content: '', privacy: 0,
      create: '2026-07-20T08:00:00Z',
      author: { id: '2', name: 'Wrapper Author', avatar: '', isVerified: false },
      media: [],
      sharedSource: {
        id: 'group-source', isAvailable: true, type: 1, content: null, privacy: 1,
        create: '2026-07-19T08:00:00Z', author: null, media: [],
        group: { id: 'group-source', name: 'Canonical Group', avatar: '/group.jpg', background: '/cover.jpg', privacy: 1, memberCount: 20, viewerIsMember: true, joinRequestPending: false },
      },
    }
    render(<ContentActions viewerId="1" contentId={wrapper.id} post={wrapper} canShare canReshare />)
    fireEvent.click(await screen.findByRole('button', { name: 'shareAction' }))

    const dialog = await screen.findByRole('dialog', { name: 'sharePost' })
    expect(within(dialog).getByText('Canonical Group')).toBeInTheDocument()
    expect(apiMocks.postDetail).not.toHaveBeenCalledWith('group-source')
  })
})

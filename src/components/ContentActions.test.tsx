// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost, SharedStory } from '../api/gatewayTypes'
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
  sharePost: vi.fn(),
}))
const apiMocks = vi.hoisted(() => ({
  createShareStory: vi.fn(),
  postDetail: vi.fn(),
  uploadMediaFiles: vi.fn(),
  cancelPendingMedia: vi.fn(),
}))
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
    socialMocks.sharePost.mockReset().mockResolvedValue({ id: 'share-1' })
    apiMocks.createShareStory.mockReset().mockResolvedValue({ id: 'story-1' })
    apiMocks.postDetail.mockReset()
    apiMocks.uploadMediaFiles.mockReset()
    apiMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
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
    fireEvent.click(within(rootArticle).getByRole('button', { name: 'reply' }))
    const textarea = screen.getByPlaceholderText('writeReply') as HTMLTextAreaElement
    expect(textarea).toHaveValue('Root User ')
    expect(screen.getByText('Root User', { selector: 'strong.mention-draft-name' })).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'Root User thanks' } })
    fireEvent.click(screen.getByRole('button', { name: 'sendComment' }))
    await waitFor(() => expect(socialMocks.createComment).toHaveBeenCalledWith('1', '401', '[[mention:3]] thanks', null))
    await waitFor(() => expect(container.querySelector('.thread-post-engagement .content-comment-summary')).toHaveTextContent('2 comments'))
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

  it('sends the canonical content link through a direct Messenger conversation', async () => {
    const friend = { id: '3', username: 'friend', email: '', displayName: 'Friend Name', avatarUrl: null, isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '', friendCount: 1, postCount: 0 }
    socialMocks.getRelationProfiles.mockResolvedValue([friend])
    messengerMocks.createDirectConversation.mockResolvedValue({ id: 'conversation-1' })
    messengerMocks.sendMessage.mockResolvedValue({ id: 'message-1' })
    render(<ContentActions viewerId="1" contentId="90" post={post} />)

    fireEvent.click(screen.getByRole('button', { name: 'shareAction' }))
    fireEvent.click(await screen.findByRole('button', { name: 'sendInMessenger' }))
    const contactName = await screen.findByText('Friend Name')
    fireEvent.click(contactName.closest('button')!)

    await waitFor(() => expect(messengerMocks.createDirectConversation).toHaveBeenCalledWith('3', '1'))
    expect(messengerMocks.sendMessage).toHaveBeenCalledWith('conversation-1', expect.objectContaining({ id: '1' }), { body: `${window.location.origin}/content/90` })
    expect(await screen.findByText('sentInMessenger')).toBeInTheDocument()
  })

  it('returns the fully created shared story so Home can update its tile and unseen ring immediately', async () => {
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
    render(<ContentActions viewerId="1" contentId="90" post={post} onStoryCreated={onStoryCreated} />)

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
        type: 1,
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
      type: 1,
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

    await waitFor(() => expect(socialMocks.sharePost).toHaveBeenCalledWith('1', 'original-post', '', 0))
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

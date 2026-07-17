// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GatewayHomePage } from './GatewayHomePage'

const apiMocks = vi.hoisted(() => ({
  recommendedFeed: vi.fn(),
  homeStories: vi.fn(),
  myStories: vi.fn(),
  visitedGroups: vi.fn(),
  recordGroupVisit: vi.fn(),
  uploadMedia: vi.fn(),
  uploadMediaFiles: vi.fn(),
  cancelPendingMedia: vi.fn(),
  createFeedPost: vi.fn(),
  postDetail: vi.fn(),
  createNormalStory: vi.fn(),
  deleteStory: vi.fn(),
}))
const socialMocks = vi.hoisted(() => ({
  getRelationProfiles: vi.fn(),
  getContentEngagement: vi.fn(),
  watchContent: vi.fn(),
  getStoryViewers: vi.fn(),
  getLikedUsers: vi.fn(),
  likeContent: vi.fn(),
  unlikeContent: vi.fn(),
  followUser: vi.fn(),
  requestJoinGroup: vi.fn(),
  getProfileRelationshipState: vi.fn(),
  getGroupMembershipState: vi.fn(),
  saveContent: vi.fn(),
  unsaveContent: vi.fn(),
  unfollowUser: vi.fn(),
  unfriend: vi.fn(),
  blockUser: vi.fn(),
  leaveGroup: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string) => key)

vi.mock('../api/client', () => ({
  api: apiMocks,
  visibleRecommendationPosts: (items: Array<{ post: unknown | null }>) => items.flatMap((item) => item.post ? [item.post] : []),
}))

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../components/ContentActions', () => ({ ContentActions: () => <div data-testid="content-actions" /> }))

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '9007199254740993123', email: 'owner@example.com', validDate: null, status: 1 },
  }),
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: translate,
  }),
}))

describe('GatewayHomePage', () => {
  beforeEach(() => {
    apiMocks.recommendedFeed.mockResolvedValue([])
    apiMocks.homeStories.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    apiMocks.myStories.mockResolvedValue(null)
    apiMocks.visitedGroups.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    apiMocks.recordGroupVisit.mockResolvedValue(true)
    apiMocks.uploadMedia.mockReset()
    apiMocks.uploadMediaFiles.mockReset()
    apiMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
    apiMocks.createFeedPost.mockReset()
    apiMocks.postDetail.mockReset()
    apiMocks.createNormalStory.mockReset()
    apiMocks.deleteStory.mockReset()
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([])
    socialMocks.getContentEngagement.mockReset().mockResolvedValue(null)
    socialMocks.watchContent.mockReset().mockResolvedValue(true)
    socialMocks.getStoryViewers.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getLikedUsers.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.likeContent.mockReset().mockResolvedValue(true)
    socialMocks.unlikeContent.mockReset().mockResolvedValue(true)
    socialMocks.followUser.mockReset().mockResolvedValue(true)
    socialMocks.requestJoinGroup.mockReset().mockResolvedValue(true)
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({ friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false })
    socialMocks.getGroupMembershipState.mockReset().mockResolvedValue({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: true })
    socialMocks.saveContent.mockReset().mockResolvedValue(true)
    socialMocks.unsaveContent.mockReset().mockResolvedValue(true)
    socialMocks.unfollowUser.mockReset().mockResolvedValue(true)
    socialMocks.unfriend.mockReset().mockResolvedValue(true)
    socialMocks.blockUser.mockReset().mockResolvedValue(true)
    socialMocks.leaveGroup.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders honest empty states for all composed services', async () => {
    render(<GatewayHomePage />)

    expect(await screen.findByText('noRecommendedPosts')).toBeInTheDocument()
    expect(screen.getByText('noStories')).toBeInTheDocument()
    expect(screen.getByText('noVisitedGroups')).toBeInTheDocument()
    expect(apiMocks.recommendedFeed).toHaveBeenCalledWith('9007199254740993123', 0, 12)
  })

  it('renders retryable service errors', async () => {
    apiMocks.recommendedFeed.mockRejectedValueOnce(new Error('offline'))
    apiMocks.homeStories.mockRejectedValueOnce(new Error('offline'))
    render(<GatewayHomePage />)

    expect(await screen.findByText('feedLoadError')).toBeInTheDocument()
    expect(await screen.findByText('storiesLoadError')).toBeInTheDocument()
    expect(screen.getAllByText('tryAgain')).toHaveLength(1)
  })

  it('hydrates and inserts a newly created SocialGraph post', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: '41', post: {
      __typename: 'FeedPostDetail', id: '41', type: 1, content: 'Older post', privacy: 0,
      create: '2026-07-14T12:00:00Z', author: { id: '2', name: 'Older Author', avatar: '', isVerified: false, canFollow: false },
      media: [], sharedSource: null,
    } }])
    apiMocks.createFeedPost.mockResolvedValue({ id: '42' })
    apiMocks.postDetail.mockResolvedValue({
      __typename: 'FeedPostDetail',
      id: '42',
      type: 1,
      content: 'Hello Gateway',
      privacy: 0,
      create: '2026-07-15T12:00:00Z',
      author: { id: '9007199254740993123', name: 'Owner', avatar: '', isVerified: true, canFollow: false },
      media: [],
    })
    const { container } = render(<GatewayHomePage />)

    await screen.findByText('Older post')
    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    fireEvent.change(screen.getByPlaceholderText('postComposerPlaceholder'), { target: { value: 'Hello Gateway' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalled())
    await waitFor(() => expect(apiMocks.postDetail).toHaveBeenCalledWith('42'))
    expect(await screen.findByText('Hello Gateway')).toBeInTheDocument()
    expect(screen.getByLabelText('verifiedAccount')).toBeInTheDocument()
    expect(screen.queryByText('publishPostSuccess')).not.toBeInTheDocument()
    const feedCards = container.querySelectorAll('.feed-section > article.gateway-post')
    expect(feedCards[0]).toHaveTextContent('Hello Gateway')
    expect(feedCards[1]).toHaveTextContent('Older post')
  })

  it('uploads media then saves returned URL through createFeedPost', async () => {
    apiMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'https://uploads.example.com/media/files/photo.png',
      type: 'image',
      contentType: 'image/png',
      size: 4,
      name: 'photo.png',
    }])
    apiMocks.createFeedPost.mockResolvedValue({ id: '43' })
    apiMocks.postDetail.mockResolvedValue(null)
    render(<GatewayHomePage />)

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' })
    const fileInputs = screen.getAllByLabelText('photoVideo')
    fireEvent.change(fileInputs[0], { target: { files: [file] } })
    fireEvent.change(screen.getByPlaceholderText('postComposerPlaceholder'), { target: { value: 'Photo post' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: 'Photo post',
      privacy: 0,
      media: [{ type: 0, url: 'https://uploads.example.com/media/files/photo.png' }],
    }))
    expect(await screen.findByText('Photo post')).toBeInTheDocument()
    expect(screen.queryByText('publishPostSuccess')).not.toBeInTheDocument()
    expect(apiMocks.cancelPendingMedia).not.toHaveBeenCalled()
  })

  it('keeps a successful publish successful when post hydration is temporarily unavailable', async () => {
    apiMocks.createFeedPost.mockResolvedValue({
      id: '46',
      type: 1,
      content: 'Already persisted',
      privacy: 0,
      create: '2026-07-17T09:00:00Z',
      authorId: '9007199254740993123',
      media: [],
    })
    apiMocks.postDetail.mockRejectedValue(new Error('read projection timeout'))
    render(<GatewayHomePage profile={{
      id: '9007199254740993123', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
      isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z',
      friendCount: 0, postCount: 0,
    }} />)

    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    fireEvent.change(screen.getByPlaceholderText('postComposerPlaceholder'), { target: { value: 'Already persisted' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    await waitFor(() => expect(screen.getByText('Already persisted')).toBeInTheDocument())
    expect(screen.queryByText('publishPostSuccess')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'createPost' })).not.toBeInTheDocument()
    expect(apiMocks.cancelPendingMedia).not.toHaveBeenCalled()
  })

  it('previews five tiles with an overflow count while uploading every selected file', async () => {
    const files = Array.from({ length: 7 }, (_, index) => new File(
      [new Uint8Array([index + 1])],
      `photo-${index + 1}.png`,
      { type: 'image/png', lastModified: index + 1 },
    ))
    apiMocks.uploadMediaFiles.mockResolvedValue(files.map((file, index) => ({
      url: `https://uploads.example.com/media/files/${file.name}`,
      type: 'image',
      contentType: 'image/png',
      size: file.size,
      name: file.name,
      index,
    })))
    apiMocks.createFeedPost.mockResolvedValue({ id: '44' })
    apiMocks.postDetail.mockResolvedValue(null)
    const { container } = render(<GatewayHomePage />)

    fireEvent.change(screen.getAllByLabelText('photoVideo')[0], { target: { files } })

    expect(await screen.findByText('+2')).toBeInTheDocument()
    expect(screen.getByLabelText('mediaPreview')).toHaveClass('media-count-5')
    expect(container.querySelectorAll('.home-media-slot')).toHaveLength(5)
    fireEvent.change(screen.getByPlaceholderText('postComposerPlaceholder'), { target: { value: 'Seven photos' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalledWith(files))
    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: 'Seven photos',
      privacy: 0,
      media: files.map((file) => ({ type: 0, url: `https://uploads.example.com/media/files/${file.name}` })),
    }))
  })

  it('selects friends in the tag picker and submits taggedUserIds independently from mentions', async () => {
    socialMocks.getRelationProfiles.mockResolvedValue([
      {
        id: '2', username: 'friend-one', email: 'one@example.com', displayName: 'Friend One', avatarUrl: null,
        isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z',
        friendCount: 1, postCount: 0, backgroundUrl: null, privacy: 0, followerCount: 0, followingCount: 0,
      },
      {
        id: '3', username: 'friend-two', email: 'two@example.com', displayName: 'Friend Two', avatarUrl: null,
        isVerified: true, bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z',
        friendCount: 1, postCount: 0, backgroundUrl: null, privacy: 0, followerCount: 0, followingCount: 0,
      },
    ])
    apiMocks.createFeedPost.mockResolvedValue({ id: '45' })
    apiMocks.postDetail.mockResolvedValue(null)
    render(<GatewayHomePage />)
    await waitFor(() => expect(socialMocks.getRelationProfiles).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    fireEvent.click(screen.getByRole('button', { name: 'tagPeople' }))
    const picker = await screen.findByRole('dialog', { name: 'tagPeople' })
    const friendOneButton = within(picker).getByText('Friend One').closest('button')!
    fireEvent.click(friendOneButton)
    fireEvent.click(within(picker).getByText('Friend Two').closest('button')!)
    expect(friendOneButton).toHaveClass('selected')
    fireEvent.click(within(picker).getByRole('button', { name: 'done' }))
    fireEvent.change(screen.getByPlaceholderText('postComposerPlaceholder'), { target: { value: 'Tagged post' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: 'Tagged post',
      privacy: 0,
      media: [],
      taggedUserIds: ['2', '3'],
    }))
  })

  it('keeps the requested shortcut order and story order with an unseen ring', async () => {
    apiMocks.myStories.mockResolvedValue({
      author: { id: '9007199254740993123', name: 'Owner Name', avatar: '', isVerified: false },
      latestCreate: '2026-07-17T08:00:00Z',
      hasUnseen: false,
      stories: [{ __typename: 'NormalStory', id: '10', content: 'Mine', create: '2026-07-17T08:00:00Z', media: [] }],
    })
    apiMocks.homeStories.mockResolvedValue({
      items: [{
        author: { id: '2', name: 'Friend Story', avatar: '', isVerified: false },
        latestCreate: '2026-07-17T09:00:00Z',
        hasUnseen: true,
        stories: [{ __typename: 'NormalStory', id: '11', content: 'Friend update', create: '2026-07-17T09:00:00Z', media: [] }],
      }],
      endCursor: null,
      hasNextPage: false,
    })

    const { container } = render(<GatewayHomePage profile={{
      id: '9007199254740993123', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: 'https://uploads.example.com/avatar-square.jpg',
      bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z', friendCount: 0, postCount: 0,
    }} />)

    await screen.findByText('Friend Story')
    const shortcutLabels = [...screen.getByRole('navigation', { name: 'primaryNavLabel' }).querySelectorAll('button strong')].map((item) => item.textContent)
    expect(shortcutLabels).toEqual(['Owner Name', 'saved', 'friends', 'reels', 'groups'])
    const storyLabels = [...container.querySelectorAll('.story-tile strong')].map((item) => item.textContent)
    expect(storyLabels).toEqual(['storyCreate', 'yourStory', 'Friend Story'])
    expect(container.querySelector<HTMLElement>('.create-story-preview')?.style.backgroundImage).toContain('avatar-square.jpg')
    expect(container.querySelectorAll('.story-avatar-ring.unseen')).toHaveLength(1)
    const friendTile = screen.getByText('Friend Story').closest('.story-tile')!
    expect(friendTile.querySelector('.story-avatar-ring')).toHaveClass('unseen')
    expect(screen.getByText('yourStory').closest('.story-tile')?.querySelector('.story-avatar-ring')).not.toHaveClass('unseen')
    fireEvent.click(friendTile.querySelector('.story-open')!)
    await waitFor(() => expect(socialMocks.watchContent).toHaveBeenCalledWith('9007199254740993123', '11'))
    await waitFor(() => expect(friendTile.querySelector('.story-avatar-ring')).not.toHaveClass('unseen'))
  })

  it('inserts a newly published story into the viewer bucket without a success banner or reload', async () => {
    apiMocks.createNormalStory.mockResolvedValue({
      __typename: 'NormalStory', id: 'story-new', content: 'Fresh story', create: '2026-07-17T10:00:00Z', media: [],
    })
    render(<GatewayHomePage profile={{
      id: '9007199254740993123', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
      isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z',
      friendCount: 0, postCount: 0,
    }} />)

    await waitFor(() => expect(apiMocks.myStories).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('storyCreate').closest('button')!)
    fireEvent.change(await screen.findByLabelText('storyPrompt'), { target: { value: 'Fresh story' } })
    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))

    const ownStoryLabel = await screen.findByText('yourStory')
    expect(screen.getByText('Fresh story')).toBeInTheDocument()
    expect(screen.queryByText('storyPublished')).not.toBeInTheDocument()
    expect(apiMocks.myStories).toHaveBeenCalledTimes(1)
    const ownStoryTile = ownStoryLabel.closest('.story-tile')!
    expect(ownStoryTile.querySelector('.story-avatar-ring')).toHaveClass('unseen')

    fireEvent.click(ownStoryTile.querySelector('.story-open')!)
    await waitFor(() => expect(ownStoryTile.querySelector('.story-avatar-ring')).not.toHaveClass('unseen'))
  })

  it('opens a direct conversation from the contacts rail', async () => {
    socialMocks.getRelationProfiles.mockResolvedValue([{
      id: '2', username: 'friend', email: 'friend@example.com', displayName: 'Friend Contact', avatarUrl: null,
      isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z',
      friendCount: 1, postCount: 0, backgroundUrl: null, privacy: 0, followerCount: 0, followingCount: 0,
    }])
    const onMessage = vi.fn().mockResolvedValue(undefined)
    render(<GatewayHomePage onMessage={onMessage} />)

    const contactName = await screen.findByText('Friend Contact')
    fireEvent.click(contactName.closest('button')!)
    expect(onMessage).toHaveBeenCalledWith('2')
  })

  it('offers contextual follow and group join actions in the feed', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([
      { postId: '61', post: {
        __typename: 'FeedPostDetail', id: '61', type: 1, content: 'Public author post', privacy: 0,
        create: '2026-07-17T08:00:00Z', author: { id: '2', name: 'Followable Author', avatar: '', isVerified: false, canFollow: true }, media: [], sharedSource: null,
      } },
      { postId: '62', post: {
        __typename: 'GroupPostDetail', id: '62', type: 2, content: 'Public group post', privacy: 0,
        create: '2026-07-17T08:01:00Z', author: { id: '3', name: 'Group Author', avatar: '', isVerified: false, canFollow: false },
        group: { id: '8', name: 'Design Group', avatar: '', canJoin: true }, media: [],
      } },
    ])
    const { container } = render(<GatewayHomePage />)

    fireEvent.click(await screen.findByRole('button', { name: 'follow' }))
    await waitFor(() => expect(socialMocks.followUser).toHaveBeenCalledWith('9007199254740993123', '2'))
    expect(screen.queryByRole('button', { name: 'follow' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'joinGroup' }))
    await waitFor(() => expect(socialMocks.requestJoinGroup).toHaveBeenCalledWith('9007199254740993123', '8'))
    expect(screen.queryByRole('button', { name: 'joinGroup' })).not.toBeInTheDocument()
    expect(screen.getByText('Design Group').closest('button')).toHaveClass('post-group-link')
    expect(container.querySelector('.group-post-avatar-stack .group-post-user-avatar')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'hidePost' })).toHaveLength(2)

    const feedCard = screen.getByText('Public author post').closest('article')!
    fireEvent.click(within(feedCard).getByRole('button', { name: 'hidePost' }))
    expect(screen.queryByText('Public author post')).not.toBeInTheDocument()
    expect(screen.getByText('Public group post')).toBeInTheDocument()
  })

  it('keeps a share wrapper visible when its source is no longer available', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: '50', post: {
      __typename: 'FeedPostDetail',
      id: '50',
      type: 0,
      content: 'My commentary survives',
      privacy: 0,
      create: '2026-07-15T12:00:00Z',
      author: { id: '2', name: 'Sharer', avatar: '', isVerified: false, canFollow: false },
      media: [],
      sharedSource: { id: '49', isAvailable: false, type: null, content: null, author: null, media: [] },
    } }])

    render(<GatewayHomePage />)

    expect(await screen.findByText('My commentary survives')).toBeInTheDocument()
    expect(screen.getByText('contentUnavailable')).toBeInTheDocument()
    expect(screen.getByText('contentUnavailableDesc')).toBeInTheDocument()
  })
})

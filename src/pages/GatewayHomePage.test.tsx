// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const messengerMocks = vi.hoisted(() => ({
  directConversations: vi.fn(),
  createDirectConversation: vi.fn(),
  presence: vi.fn(),
  subscribePresence: vi.fn(),
}))
const searchMocks = vi.hoisted(() => ({
  searchDirectContacts: vi.fn(),
  searchFriends: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string) => key)
type PresenceEvent = { kind: string; userId: string | null; expiresAt: string | null }
let presenceListener: ((event: PresenceEvent) => void) | null = null

vi.mock('../api/client', () => ({
  api: apiMocks,
  visibleRecommendationPosts: (items: Array<{ post: unknown | null }>) => items.flatMap((item) => item.post ? [item.post] : []),
}))

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../api/messenger', () => ({ messengerApi: messengerMocks }))
vi.mock('../api/search', () => ({ searchApi: searchMocks }))
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
    messengerMocks.directConversations.mockReset().mockResolvedValue([])
    messengerMocks.createDirectConversation.mockReset()
    messengerMocks.presence.mockReset().mockResolvedValue([])
    presenceListener = null
    messengerMocks.subscribePresence.mockReset().mockImplementation((_userIds: string[], onEvent: (event: PresenceEvent) => void) => {
      presenceListener = onEvent
      return vi.fn()
    })
    searchMocks.searchDirectContacts.mockReset().mockResolvedValue([])
    searchMocks.searchFriends.mockReset().mockResolvedValue([])
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
    const composerDialog = screen.getByRole('dialog', { name: 'createPost' })
    expect(within(composerDialog).getByRole('button', { name: 'close' }).querySelector('path')).toHaveAttribute('d', 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z')
    const privacyButton = within(composerDialog).getByRole('button', { name: 'privacy' })
    expect(privacyButton).toHaveTextContent('privacyPublic')
    expect(privacyButton.querySelector('.home-post-public-icon')).toBeInTheDocument()
    expect(privacyButton.querySelector('.home-post-privacy-caret path')).toHaveAttribute('d', 'M7.2 9.2h9.6c.75 0 1.15.88.64 1.44l-4.72 5.18c-.38.42-1.06.42-1.44 0l-4.72-5.18C6.05 10.08 6.45 9.2 7.2 9.2Z')
    fireEvent.click(privacyButton)
    expect(within(composerDialog).getByRole('option', { name: 'privacyFriendsFollowers' }).querySelector('.privacy-1 path')).toHaveAttribute('d', 'M16.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7.5 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 1.5c-3 0-7 1.6-7 4.7V21h14v-2.8c0-3.1-4-4.7-7-4.7zm7.5.2c.5.8.8 1.7.8 2.5V21H23v-2.5c0-2.4-3.1-3.9-6-4.3-.4.1-.8.2-1 .7z')
    expect(within(composerDialog).getByRole('option', { name: 'privacyFriends' }).querySelector('.privacy-2 path')).toHaveAttribute('d', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z')
    fireEvent.click(within(composerDialog).getByRole('option', { name: 'privacyOnlyMe' }))
    expect(privacyButton).toHaveTextContent('privacyOnlyMe')
    fireEvent.click(privacyButton)
    fireEvent.click(within(composerDialog).getByRole('option', { name: 'privacyPublic' }))
    fireEvent.change(screen.getByPlaceholderText('postComposerPersonalPlaceholder'), { target: { value: 'Hello Gateway' } })
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

  it('stores a selected post background in content metadata and renders only the visible text', async () => {
    apiMocks.createFeedPost.mockResolvedValue({ id: 'background-post' })
    apiMocks.postDetail.mockResolvedValue(null)
    const { container } = render(<GatewayHomePage />)

    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    const composerDialog = screen.getByRole('dialog', { name: 'createPost' })
    expect(within(composerDialog).getByPlaceholderText('postComposerPersonalPlaceholder')).toBeInTheDocument()
    const backgroundToggle = within(composerDialog).getByRole('button', { name: 'postBackground' })
    fireEvent.click(backgroundToggle)
    expect(backgroundToggle.querySelector('.home-post-background-back-icon')).toBeInTheDocument()
    fireEvent.click(within(composerDialog).getByRole('button', { name: 'postBackground 2' }))
    expect(composerDialog.querySelector('.home-post-editor')).toHaveClass('has-background')
    const backgroundTextarea = within(composerDialog).getByPlaceholderText('postComposerPersonalPlaceholder') as HTMLTextAreaElement
    expect(backgroundTextarea.style.getPropertyValue('--home-post-background-padding')).not.toBe('')

    fireEvent.change(backgroundTextarea, { target: { value: 'Bài có nền' } })
    fireEvent.click(within(composerDialog).getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: '[[post-bg:v1:violet]]\nBài có nền',
      privacy: 0,
      media: [],
    }))
    const renderedContent = await screen.findByText('Bài có nền')
    expect(renderedContent).toHaveClass('gateway-post-content', 'has-background')
    expect(container).not.toHaveTextContent('[[post-bg:v1:')
  })

  it('inserts emoji at the current composer cursor', () => {
    render(<GatewayHomePage />)

    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    const composerDialog = screen.getByRole('dialog', { name: 'createPost' })
    const textarea = within(composerDialog).getByPlaceholderText('postComposerPersonalPlaceholder') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Fakebook ' } })
    textarea.setSelectionRange(9, 9)
    fireEvent.click(within(composerDialog).getByRole('button', { name: 'insertEmoji' }))
    fireEvent.click(within(composerDialog).getByRole('menuitem', { name: '🔥' }))

    expect(textarea).toHaveValue('Fakebook 🔥')
  })

  it('removes the selected background when media is added and submits plain content', async () => {
    apiMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'https://uploads.example.com/media/files/background-clear.png',
      type: 'image',
      contentType: 'image/png',
      size: 4,
      name: 'background-clear.png',
    }])
    apiMocks.createFeedPost.mockResolvedValue({ id: 'background-clear-post' })
    apiMocks.postDetail.mockResolvedValue(null)
    render(<GatewayHomePage />)

    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    const composerDialog = screen.getByRole('dialog', { name: 'createPost' })
    const backgroundButton = within(composerDialog).getByRole('button', { name: 'postBackground' })
    fireEvent.click(backgroundButton)
    fireEvent.click(within(composerDialog).getByRole('button', { name: 'postBackground 1' }))
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'background-clear.png', { type: 'image/png' })
    fireEvent.change(composerDialog.querySelector<HTMLInputElement>('.home-add-to-post input[type="file"]')!, { target: { files: [file] } })

    expect(backgroundButton).not.toBeInTheDocument()
    expect(composerDialog).toHaveClass('has-media')
    const mediaScrollRegion = composerDialog.querySelector('.home-media-preview-scroll')
    expect(mediaScrollRegion).toBeInTheDocument()
    expect(mediaScrollRegion).toContainElement(await within(composerDialog).findByLabelText('mediaPreview'))
    const fixedClearButton = within(composerDialog).getByRole('button', { name: 'removeMedia' })
    expect(fixedClearButton).toHaveClass('home-media-preview-fixed-clear')
    expect(mediaScrollRegion).not.toContainElement(fixedClearButton)
    const mediaEditor = composerDialog.querySelector('.home-post-editor')
    expect(mediaEditor).toHaveClass('has-media')
    expect(mediaEditor).not.toHaveClass('has-background')
    expect(within(mediaEditor as HTMLElement).getByRole('button', { name: 'insertEmoji' }).closest('.home-post-emoji-picker')).toHaveClass('inline')
    expect(composerDialog.querySelector('.home-post-style-row')).not.toBeInTheDocument()
    fireEvent.change(within(composerDialog).getByPlaceholderText('postComposerPersonalPlaceholder'), { target: { value: 'Ảnh không có nền chữ' } })
    fireEvent.click(within(composerDialog).getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: 'Ảnh không có nền chữ',
      privacy: 0,
      media: [{ type: 0, url: 'https://uploads.example.com/media/files/background-clear.png' }],
    }))
  })

  it('decodes background metadata returned by the feed service', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: 'background-feed', post: {
      __typename: 'FeedPostDetail', id: 'background-feed', type: 1,
      content: '[[post-bg:v1:sunset]]\nNội dung từ service', privacy: 0,
      create: '2026-07-18T12:00:00Z', author: { id: '2', name: 'Background Author', avatar: '', isVerified: false, canFollow: false },
      media: [], sharedSource: null,
    } }])
    const { container } = render(<GatewayHomePage />)

    const content = await screen.findByText('Nội dung từ service')
    expect(content).toHaveClass('gateway-post-content', 'has-background')
    expect(container).not.toHaveTextContent('[[post-bg:v1:sunset]]')
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
    fireEvent.change(screen.getByPlaceholderText('postComposerPersonalPlaceholder'), { target: { value: 'Photo post' } })
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
    fireEvent.change(screen.getByPlaceholderText('postComposerPersonalPlaceholder'), { target: { value: 'Already persisted' } })
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
    fireEvent.change(screen.getByPlaceholderText('postComposerPersonalPlaceholder'), { target: { value: 'Seven photos' } })
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
    fireEvent.change(screen.getByPlaceholderText('postComposerPersonalPlaceholder'), { target: { value: 'Tagged post' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: 'Tagged post',
      privacy: 0,
      media: [],
      taggedUserIds: ['2', '3'],
    }))
  })

  it('serializes a selected mention as an ID token and renders the current name without an at sign', async () => {
    socialMocks.getRelationProfiles.mockResolvedValue([{
      id: '2', username: 'friend-one', email: 'one@example.com', displayName: 'Friend One', avatarUrl: null,
      isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z',
      friendCount: 1, postCount: 0, backgroundUrl: null, privacy: 0, followerCount: 0, followingCount: 0,
    }])
    apiMocks.createFeedPost.mockResolvedValue({ id: 'mention-post' })
    apiMocks.postDetail.mockResolvedValue(null)
    render(<GatewayHomePage onNavigate={vi.fn()} />)
    await waitFor(() => expect(socialMocks.getRelationProfiles).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    const textarea = screen.getByPlaceholderText('postComposerPersonalPlaceholder') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Hello @Fr' } })
    textarea.setSelectionRange(9, 9)
    fireEvent.select(textarea)
    fireEvent.click(await screen.findByRole('option', { name: /Friend One/ }))

    expect(textarea).toHaveValue('Hello Friend One ')
    expect(screen.getByText('Friend One', { selector: 'strong.mention-draft-name' })).toBeInTheDocument()
    expect(screen.queryByText('@Friend One')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'post' }))
    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: 'Hello [[mention:2]]',
      privacy: 0,
      media: [],
    }))
    expect(await screen.findByRole('button', { name: 'Friend One' })).toBeInTheDocument()
    expect(screen.queryByText('@Friend One')).not.toBeInTheDocument()
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
        stories: [{ __typename: 'NormalStory', id: '11', content: 'Friend update', create: '2026-07-17T09:00:00Z', media: [{ type: 0, url: 'https://uploads.example.com/story.jpg' }] }],
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
    expect(friendTile.querySelector<HTMLElement>('.story-cover-backdrop')?.style.backgroundImage).toContain('story.jpg')
    expect(friendTile.querySelector('.story-cover')).toBeInTheDocument()
    expect(friendTile.querySelector('.story-avatar-ring')).toHaveClass('unseen')
    expect(friendTile.querySelector('.story-avatar-ring .avatar')).toHaveStyle({ width: '32px', height: '32px' })
    expect(screen.getByText('yourStory').closest('.story-tile')?.querySelector('.story-avatar-ring')).not.toHaveClass('unseen')
    expect(screen.queryByRole('button', { name: 'deleteStory' })).not.toBeInTheDocument()
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
    messengerMocks.directConversations.mockResolvedValue([
      {
        id: 'group-1', type: 'GROUP', participants: [
          { id: '9007199254740993123', username: 'me', displayName: 'Me', avatarUrl: null, leftAt: null },
          { id: '3', username: 'group-only', displayName: 'Group Only', avatarUrl: null, leftAt: null },
        ], title: 'Group Only', avatarUrl: null, updatedAt: '2026-01-02', unreadCount: 0, lastMessage: null,
      },
      {
        id: 'direct-1', type: 'DIRECT', participants: [
          { id: '9007199254740993123', username: 'me', displayName: 'Me', avatarUrl: null, leftAt: null },
          { id: '2', username: 'friend', displayName: 'Friend Contact', avatarUrl: null, leftAt: null },
        ], title: null, avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null,
      },
    ])
    const onMessage = vi.fn().mockResolvedValue(undefined)
    render(<GatewayHomePage onMessage={onMessage} />)

    const contactName = await screen.findByText('Friend Contact')
    expect(screen.queryByText('Group Only')).not.toBeInTheDocument()
    fireEvent.click(contactName.closest('button')!)
    expect(onMessage).toHaveBeenCalledWith('2')
  })

  it('searches the complete direct-contact scope through Search Service', async () => {
    messengerMocks.directConversations.mockResolvedValue([])
    searchMocks.searchDirectContacts.mockResolvedValue([{
      id: '8', username: 'older', email: '', displayName: 'Older Contact', avatarUrl: null,
      isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '',
      friendCount: 0, postCount: 0, backgroundUrl: null, privacy: 0, followerCount: 0, followingCount: 0,
    }])
    const { container } = render(<GatewayHomePage />)
    await waitFor(() => expect(messengerMocks.directConversations).toHaveBeenCalledWith('9007199254740993123', 40))

    fireEvent.click(container.querySelector<HTMLButtonElement>('.contacts-module button[aria-label="search"]')!)
    fireEvent.change(screen.getByPlaceholderText('searchContacts'), { target: { value: 'o' } })

    await waitFor(() => expect(searchMocks.searchDirectContacts).toHaveBeenCalledWith('o', 1, 20))
    expect(await screen.findByText('Older Contact')).toBeInTheDocument()
  })

  it('starts a direct conversation from the plus button using friend-scoped search', async () => {
    const olderFriend = {
      id: '88', username: 'remote-friend', email: '', displayName: 'Remote Friend', avatarUrl: null,
      isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '',
      friendCount: 1, postCount: 0, backgroundUrl: null, privacy: 0, followerCount: 0, followingCount: 0,
    }
    searchMocks.searchFriends.mockResolvedValue([olderFriend])
    const onMessage = vi.fn().mockResolvedValue(undefined)
    render(<GatewayHomePage onMessage={onMessage} />)

    fireEvent.click(await screen.findByRole('button', { name: 'newMessage' }))
    fireEvent.change(screen.getByPlaceholderText('searchFriends'), { target: { value: 'r' } })

    await waitFor(() => expect(searchMocks.searchFriends).toHaveBeenCalledWith('r', 1, 30))
    fireEvent.click(await screen.findByRole('button', { name: /Remote Friend/ }))
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith('88'))
    expect(screen.queryByPlaceholderText('searchFriends')).not.toBeInTheDocument()
  })

  it('shows the active state returned by Messenger presence', async () => {
    messengerMocks.directConversations.mockResolvedValue([{
      id: 'direct-online', type: 'DIRECT', participants: [
        { id: '9007199254740993123', username: 'me', displayName: 'Me', avatarUrl: null, leftAt: null },
        { id: '77', username: 'online', displayName: 'Online Friend', avatarUrl: null, leftAt: null },
      ], title: null, avatarUrl: null, updatedAt: '2026-07-18T00:00:00Z', unreadCount: 0, lastMessage: null,
    }])
    messengerMocks.presence.mockResolvedValue([{ userId: '77', isOnline: true, expiresAt: null, updatedAt: '2026-07-18T00:00:00Z' }])

    render(<GatewayHomePage />)

    expect(await screen.findByText('Online Friend')).toBeInTheDocument()
    await waitFor(() => expect(messengerMocks.presence).toHaveBeenCalledWith(['77']))
    expect(screen.getByText('activeNow')).toBeInTheDocument()
    expect(screen.getByLabelText('Online Friend').querySelector('.avatar-dot')).toBeInTheDocument()
  })

  it('updates contact presence from realtime events without refreshing the page', async () => {
    messengerMocks.directConversations.mockResolvedValue([{
      id: 'direct-realtime', type: 'DIRECT', participants: [
        { id: '9007199254740993123', username: 'me', displayName: 'Me', avatarUrl: null, leftAt: null },
        { id: '78', username: 'realtime', displayName: 'Realtime Friend', avatarUrl: null, leftAt: null },
      ], title: null, avatarUrl: null, updatedAt: '2026-07-18T00:00:00Z', unreadCount: 0, lastMessage: null,
    }])
    messengerMocks.presence.mockResolvedValue([{ userId: '78', isOnline: false, expiresAt: null, updatedAt: new Date(Date.now() - 35 * 60_000).toISOString() }])

    render(<GatewayHomePage />)

    expect(await screen.findByText('Realtime Friend')).toBeInTheDocument()
    await waitFor(() => expect(presenceListener).not.toBeNull())
    expect(screen.queryByText('activeNow')).not.toBeInTheDocument()
    expect(await screen.findByText('activeMinutesAgo')).toHaveProperty('tagName', 'SMALL')

    act(() => presenceListener?.({
      kind: 'PRESENCE_CHANGED',
      userId: '78',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }))
    expect(screen.getByText('activeNow')).toBeInTheDocument()
    expect(screen.getByLabelText('Realtime Friend').querySelector('.avatar-dot')).toBeInTheDocument()

    act(() => presenceListener?.({ kind: 'PRESENCE_CHANGED', userId: '78', expiresAt: null }))
    expect(screen.queryByText('activeNow')).not.toBeInTheDocument()
    expect(screen.getByText('activeJustNow')).toHaveProperty('tagName', 'SMALL')
    expect(screen.getByLabelText('Realtime Friend').querySelector('.avatar-dot')).not.toBeInTheDocument()
  })

  it('offers contextual follow and group join actions in the feed', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([
      { postId: '61', post: {
        __typename: 'FeedPostDetail', id: '61', type: 1, content: 'Public author post', privacy: 2,
        create: '2026-07-17T08:00:00Z', author: { id: '2', name: 'Followable Author', avatar: '', isVerified: false, canFollow: true }, media: [], sharedSource: null,
        taggedUsers: [{ id: '4', name: 'Tagged Friend', avatar: '', isVerified: false }],
      } },
      { postId: '62', post: {
        __typename: 'GroupPostDetail', id: '62', type: 2, content: 'Public group post', privacy: 0,
        create: '2026-07-17T08:01:00Z', author: { id: '3', name: 'Group Author', avatar: '', isVerified: false, canFollow: false },
        group: { id: '8', name: 'Design Group', avatar: '', canJoin: true }, media: [],
      } },
    ])
    const { container } = render(<GatewayHomePage />)

    const feedCard = (await screen.findByText('Public author post')).closest('article')!
    expect(within(feedCard).getByRole('button', { name: 'Tagged Friend' })).toBeInTheDocument()
    expect(feedCard.querySelector('.post-privacy-hover .privacy-2 path')).toHaveAttribute('d', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z')
    fireEvent.mouseEnter(feedCard.querySelector('.post-time-hover')!)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('2026')
    fireEvent.mouseLeave(feedCard.querySelector('.post-time-hover')!)
    fireEvent.mouseEnter(feedCard.querySelector('.post-privacy-hover')!)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('privacyFriends')
    fireEvent.mouseLeave(feedCard.querySelector('.post-privacy-hover')!)

    fireEvent.click(await screen.findByRole('button', { name: 'follow' }))
    await waitFor(() => expect(socialMocks.followUser).toHaveBeenCalledWith('9007199254740993123', '2'))
    expect(screen.queryByRole('button', { name: 'follow' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'joinGroup' }))
    await waitFor(() => expect(socialMocks.requestJoinGroup).toHaveBeenCalledWith('9007199254740993123', '8'))
    expect(screen.queryByRole('button', { name: 'joinGroup' })).not.toBeInTheDocument()
    expect(screen.getByText('Design Group').closest('button')).toHaveClass('post-group-link')
    expect(container.querySelector('.group-post-avatar-stack .group-post-user-avatar')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'hidePost' })).toHaveLength(2)

    const headerActions = feedCard.querySelector('.post-header-actions')!
    expect(headerActions.children).toHaveLength(2)
    expect(headerActions.children[0]).toHaveClass('post-options-menu')
    expect(headerActions.children[1]).toHaveAttribute('aria-label', 'hidePost')
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

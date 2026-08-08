// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Activity } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost } from '../api/gatewayTypes'
import { notifyGroupLeft } from '../lib/groupMembershipEvents'
import { GatewayHomePage, GatewayPostCard, HOME_REFRESH_EVENT, PostComposer } from './GatewayHomePage'

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
  cancelJoinGroupRequest: vi.fn(),
  updatePost: vi.fn(),
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
  conversations: vi.fn(),
  directConversations: vi.fn(),
  createDirectConversation: vi.fn(),
  presence: vi.fn(),
  subscribePresence: vi.fn(),
}))
const searchMocks = vi.hoisted(() => ({
  searchDirectContacts: vi.fn(),
  searchFriends: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string, params?: Record<string, unknown>) => (
  key === 'visitedTime' ? `visited:${String(params?.time ?? '')}` : key
))
type PresenceEvent = { kind: string; userId: string | null; expiresAt: string | null }
let presenceListener: ((event: PresenceEvent) => void) | null = null

vi.mock('../api/client', () => ({
  api: apiMocks,
  visibleRecommendationPosts: (items: Array<{ post: unknown | null }>) => items.flatMap((item) => item.post ? [item.post] : []),
}))

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../api/messenger', () => ({ messengerApi: messengerMocks }))
vi.mock('../api/search', () => ({ searchApi: searchMocks }))
vi.mock('../components/ContentActions', () => ({
  ContentActions: () => <div data-testid="content-actions" />,
  ContentDetailOverlay: ({ contentId, onClose }: { contentId: string; onClose: () => void }) => <div role="dialog" aria-label="shared-post-detail" data-testid="content-detail-overlay"><span>{contentId}</span><button type="button" onClick={onClose}>close</button></div>,
}))
vi.mock('../components/PostPhotoViewer', () => ({
  PostPhotoViewer: ({ contentId, initialMediaId, onClose }: { contentId: string; initialMediaId?: string; onClose: () => void }) => <div role="dialog" aria-label="post-photo-viewer" data-testid="post-photo-viewer"><span>{contentId}:{initialMediaId}</span><button type="button" onClick={onClose}>close-photo</button></div>,
}))

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
    window.sessionStorage.clear()
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
    socialMocks.cancelJoinGroupRequest.mockReset().mockResolvedValue(true)
    socialMocks.updatePost.mockReset()
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({ friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false })
    socialMocks.getGroupMembershipState.mockReset().mockResolvedValue({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: true })
    socialMocks.saveContent.mockReset().mockResolvedValue(true)
    socialMocks.unsaveContent.mockReset().mockResolvedValue(true)
    socialMocks.unfollowUser.mockReset().mockResolvedValue(true)
    socialMocks.unfriend.mockReset().mockResolvedValue(true)
    socialMocks.blockUser.mockReset().mockResolvedValue(true)
    socialMocks.leaveGroup.mockReset().mockResolvedValue(true)
    messengerMocks.conversations.mockReset().mockResolvedValue([])
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
    vi.unstubAllGlobals()
  })

  it('renders honest empty states for all composed services', async () => {
    const { container, unmount } = render(<GatewayHomePage />)

    expect(container.querySelector('.contacts-module > .spinner')).not.toBeInTheDocument()
    expect(container.querySelector('.gateway-left-rail > .spinner')).not.toBeInTheDocument()
    expect(container.querySelector('.group-conversations-module > .spinner')).not.toBeInTheDocument()

    expect(await screen.findByText('noRecommendedPosts')).toBeInTheDocument()
    expect(screen.getByText('noStories')).toBeInTheDocument()
    expect(screen.getByText('noVisitedGroups')).toBeInTheDocument()
    expect(apiMocks.recommendedFeed).toHaveBeenCalledWith('9007199254740993123', 0, 12)
    expect(document.documentElement).toHaveClass('home-page-scroll')
    expect(document.body).toHaveClass('home-page-scroll')

    unmount()
    expect(document.documentElement).not.toHaveClass('home-page-scroll')
    expect(document.body).not.toHaveClass('home-page-scroll')
  })

  it('renders recently visited groups as square shortcuts with their visit time', async () => {
    apiMocks.visitedGroups.mockResolvedValue({
      items: [{ id: '81', name: 'Recent group', avatar: '/group.png', visitedAt: new Date(Date.now() - (3 * 60 + 15) * 60_000).toISOString() }],
      endCursor: null,
      hasNextPage: false,
    })

    const { container } = render(<GatewayHomePage />)

    expect(await screen.findByText('Recent group')).toBeInTheDocument()
    expect(screen.getByText('visited:about 3 hours ago')).toBeInTheDocument()
    expect(container.querySelector('.group-shortcuts .avatar')).toHaveStyle({ width: '36px', height: '36px' })
    expect(container.querySelector('.group-shortcuts .home-visited-group-copy')).toBeInTheDocument()
  })

  it('removes a successfully left group from the preserved Home shortcuts and refreshes the source', async () => {
    apiMocks.visitedGroups
      .mockResolvedValueOnce({
        items: [
          { id: '81', name: 'Left group', avatar: '/left.png', visitedAt: '2026-07-31T10:00:00Z' },
          { id: '82', name: 'Kept group', avatar: '/kept.png', visitedAt: '2026-07-31T11:00:00Z' },
        ],
        endCursor: null,
        hasNextPage: false,
      })
      .mockResolvedValueOnce({
        items: [{ id: '82', name: 'Kept group', avatar: '/kept.png', visitedAt: '2026-07-31T11:00:00Z' }],
        endCursor: null,
        hasNextPage: false,
      })

    render(<GatewayHomePage />)
    expect(await screen.findByText('Left group')).toBeInTheDocument()

    act(() => notifyGroupLeft('81'))

    await waitFor(() => expect(screen.queryByText('Left group')).not.toBeInTheDocument())
    expect(screen.getByText('Kept group')).toBeInTheDocument()
    await waitFor(() => expect(apiMocks.visitedGroups).toHaveBeenCalledTimes(2))
  })

  it('ignores an older visited-group response that finishes after a group is left', async () => {
    let resolveStale!: (value: { items: Array<{ id: string; name: string; avatar: string; visitedAt: string }>; endCursor: null; hasNextPage: false }) => void
    const staleRequest = new Promise<{ items: Array<{ id: string; name: string; avatar: string; visitedAt: string }>; endCursor: null; hasNextPage: false }>((resolve) => { resolveStale = resolve })
    apiMocks.visitedGroups
      .mockReturnValueOnce(staleRequest)
      .mockResolvedValueOnce({ items: [], endCursor: null, hasNextPage: false })

    render(<GatewayHomePage />)
    await waitFor(() => expect(apiMocks.visitedGroups).toHaveBeenCalledTimes(1))

    act(() => notifyGroupLeft('81'))
    await waitFor(() => expect(apiMocks.visitedGroups).toHaveBeenCalledTimes(2))
    await act(async () => resolveStale({
      items: [{ id: '81', name: 'Stale left group', avatar: '/left.png', visitedAt: '2026-07-31T10:00:00Z' }],
      endCursor: null,
      hasNextPage: false,
    }))

    expect(screen.queryByText('Stale left group')).not.toBeInTheDocument()
  })

  it('refreshes only the feed and resets its scroll regions on the active-Home event', async () => {
    const { container } = render(<GatewayHomePage />)
    await screen.findByText('noRecommendedPosts')
    const leftRail = container.querySelector<HTMLElement>('.gateway-left-rail')!
    const rightRail = container.querySelector<HTMLElement>('.gateway-right-rail')!
    document.documentElement.scrollTop = 240
    document.body.scrollTop = 240
    leftRail.scrollTop = 80
    rightRail.scrollTop = 90

    window.dispatchEvent(new Event(HOME_REFRESH_EVENT))

    await waitFor(() => expect(apiMocks.recommendedFeed).toHaveBeenCalledTimes(2))
    expect(apiMocks.homeStories).toHaveBeenCalledTimes(1)
    expect(apiMocks.visitedGroups).toHaveBeenCalledTimes(1)
    expect(messengerMocks.conversations).toHaveBeenCalledTimes(1)
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(leftRail.scrollTop).toBe(0)
    expect(rightRail.scrollTop).toBe(0)
  })

  it('ignores a stale next-page response after an active-Home reset starts', async () => {
    let intersect: (() => void) | null = null
    class IntersectionObserverMock {
      readonly root = null
      readonly rootMargin = '520px 0px'
      readonly thresholds = [0.01]
      constructor(callback: IntersectionObserverCallback) {
        intersect = () => callback([{ isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const makePost = (id: string, content: string): GatewayPost => ({
      __typename: 'FeedPostDetail', id, type: 1, content, privacy: 0,
      create: '2026-07-20T08:00:00Z', author: { id: '2', name: 'Feed Author', avatar: '', isVerified: false, canFollow: false },
      media: [], sharedSource: null,
    })
    const firstPage = Array.from({ length: 12 }, (_, index) => ({ postId: `first-${index}`, post: makePost(`first-${index}`, `First ${index}`) }))
    let resolveAppend!: (items: Array<{ postId: string; post: GatewayPost }>) => void
    let resolveRefresh!: (items: Array<{ postId: string; post: GatewayPost }>) => void
    const appendPromise = new Promise<Array<{ postId: string; post: GatewayPost }>>((resolve) => { resolveAppend = resolve })
    const refreshPromise = new Promise<Array<{ postId: string; post: GatewayPost }>>((resolve) => { resolveRefresh = resolve })
    let initialPageCalls = 0
    apiMocks.recommendedFeed.mockImplementation((_viewerId: string, offset: number) => {
      if (offset === 12) return appendPromise
      initialPageCalls += 1
      return initialPageCalls === 1 ? Promise.resolve(firstPage) : refreshPromise
    })

    const { container } = render(<GatewayHomePage />)
    await waitFor(() => expect(container.querySelectorAll('.feed-section > article.gateway-post')).toHaveLength(12))
    await waitFor(() => expect(intersect).not.toBeNull())
    act(() => intersect?.())
    await waitFor(() => expect(apiMocks.recommendedFeed).toHaveBeenCalledWith('9007199254740993123', 12, 12))

    act(() => window.dispatchEvent(new Event(HOME_REFRESH_EVENT)))
    await waitFor(() => expect(initialPageCalls).toBe(2))
    await act(async () => { resolveRefresh([{ postId: 'fresh', post: makePost('fresh', 'Fresh post') }]); await Promise.resolve() })
    await waitFor(() => expect(screen.getByText('Fresh post')).toBeInTheDocument())

    await act(async () => { resolveAppend([{ postId: 'stale', post: makePost('stale', 'Stale append') }]); await Promise.resolve() })
    expect(screen.queryByText('Stale append')).not.toBeInTheDocument()
    expect(screen.getByText('Fresh post')).toBeInTheDocument()
  })

  it('does not reload Home data when an Activity restores the preserved tab', async () => {
    const { rerender } = render(<Activity mode="visible"><GatewayHomePage refreshToken={0} /></Activity>)
    await screen.findByText('noRecommendedPosts')
    expect(apiMocks.recommendedFeed).toHaveBeenCalledTimes(1)
    expect(apiMocks.homeStories).toHaveBeenCalledTimes(1)

    rerender(<Activity mode="hidden"><GatewayHomePage refreshToken={0} /></Activity>)
    rerender(<Activity mode="visible"><GatewayHomePage refreshToken={0} /></Activity>)

    expect(apiMocks.recommendedFeed).toHaveBeenCalledTimes(1)
    expect(apiMocks.homeStories).toHaveBeenCalledTimes(1)
    expect(apiMocks.visitedGroups).toHaveBeenCalledTimes(1)
  })

  it('uses CSS overscroll-behavior to contain wheel movement inside the side rails without blocking the event', async () => {
    vi.stubGlobal('innerWidth', 1440)
    const { container } = render(<GatewayHomePage />)
    await screen.findByText('noRecommendedPosts')

    const leftRail = container.querySelector<HTMLElement>('.gateway-left-rail')!
    const rightRail = container.querySelector<HTMLElement>('.gateway-right-rail')!
    const leftWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })
    const rightWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 80 })

    // The non-passive JS wheel listener was removed to fix scroll jank.
    // Scroll containment is now handled by CSS overscroll-behavior-y: contain
    // (applied via the home-page-scroll body class). Native wheel events must
    // NOT be cancelled so the browser compositor can start scroll frames early.
    expect(leftRail.dispatchEvent(leftWheel)).toBe(true)
    expect(rightRail.dispatchEvent(rightWheel)).toBe(true)

    // The home-page-scroll class must be present for the CSS rule to apply.
    expect(document.body.classList.contains('home-page-scroll')).toBe(true)
    expect(document.documentElement.classList.contains('home-page-scroll')).toBe(true)
  })

  it('uses a structured feed skeleton while the initial Home request is pending', async () => {
    apiMocks.recommendedFeed.mockReturnValue(new Promise(() => undefined))
    const { container } = render(<GatewayHomePage />)

    await screen.findByText('noStories')
    expect(screen.getByRole('status', { name: 'loadingMore' })).toHaveClass('home-feed-skeleton')
    expect(container.querySelector('.home-feed-skeleton-avatar')).toBeInTheDocument()
    expect(container.querySelector('.home-feed-skeleton-media')).toBeInTheDocument()
    expect(container.querySelector('.feed-section > .state-card')).not.toBeInTheDocument()
  })

  it('keeps the profile composer size contract and opens its Reel composer in place', async () => {
    const onCreated = vi.fn()
    const { container, rerender } = render(<PostComposer variant="profile" userId="9007199254740993123" displayName="Profile Owner" avatarUrl={null} friends={[]} onCreated={onCreated} />)
    const composer = container.querySelector('.profile-composer-card')!

    expect(composer.querySelector('.home-composer-row .avatar')).toHaveStyle({ width: '40px', height: '40px' })
    expect(composer.querySelector('.profile-composer-actions .live svg')).toHaveAttribute('width', '29')
    expect(composer.querySelector('.profile-composer-actions .media svg')).toHaveAttribute('width', '26')
    expect(composer.querySelector('.profile-composer-actions .reel svg')).toHaveAttribute('width', '26')
    expect(composer.querySelector('.profile-composer-actions .live .profile-composer-action-label')).toHaveTextContent('profileLiveVideo')
    expect(composer.querySelector('.profile-composer-actions .media .profile-composer-action-label')).toHaveTextContent('photoVideo')
    expect(composer.querySelector('.profile-composer-actions .reel .profile-composer-action-label')).toHaveTextContent('profileTabReels')
    fireEvent.click(within(composer as HTMLElement).getByRole('button', { name: 'profileTabReels' }))
    const dialog = await screen.findByRole('dialog', { name: 'createReel' })
    expect(dialog).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'createReel' })).not.toBeInTheDocument())

    rerender(<PostComposer variant="profile" triggerOnly externalReelOpenRequest={1} userId="9007199254740993123" displayName="Profile Owner" avatarUrl={null} friends={[]} onCreated={onCreated} />)
    expect(await screen.findByRole('dialog', { name: 'createReel' })).toBeInTheDocument()
  })

  it('opens the Home Reel composer from state isolated inside the composer subtree', async () => {
    const { container } = render(<PostComposer userId="9007199254740993123" displayName="Home Owner" avatarUrl={null} friends={[]} onCreated={vi.fn()} />)

    fireEvent.click(within(container.querySelector('.home-composer-card') as HTMLElement).getByRole('button', { name: 'createReel' }))

    const dialog = await screen.findByRole('dialog', { name: 'createReel' })
    expect(dialog).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'createReel' })).not.toBeInTheDocument())
  })

  it('navigates from the Home composer avatar without opening the composer', () => {
    const onNavigate = vi.fn()
    const { container } = render(<PostComposer userId="9007199254740993123" displayName="Home Owner" avatarUrl={null} friends={[]} onNavigate={onNavigate} onCreated={vi.fn()} />)

    fireEvent.click(within(container.querySelector('.home-composer-card') as HTMLElement).getByRole('button', { name: 'Home Owner' }))

    expect(onNavigate).toHaveBeenCalledWith('/profile/9007199254740993123')
    expect(screen.queryByRole('dialog', { name: 'createPostTitle' })).not.toBeInTheDocument()
  })

  it('renders retryable service errors', async () => {
    apiMocks.recommendedFeed.mockRejectedValueOnce(new Error('offline'))
    apiMocks.homeStories.mockRejectedValueOnce(new Error('offline'))
    render(<GatewayHomePage />)

    expect(await screen.findByText('feedLoadError')).toBeInTheDocument()
    expect(await screen.findByText('storiesLoadError')).toBeInTheDocument()
    expect(screen.getAllByText('tryAgain')).toHaveLength(1)
  })

  it('renders a recommended reel through the same home post card', async () => {
    const onNavigate = vi.fn()
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: 'reel-71', post: {
      __typename: 'ReelDetail', id: 'reel-71', type: 4, content: 'Recommended reel', privacy: 0,
      create: '2026-07-20T08:00:00Z', author: { id: '7', name: 'Reel Author', avatar: '', isVerified: false, canFollow: true },
      mentions: [], media: [{ id: 'media-71', type: 1, url: 'https://uploads.example.com/reels/reel-71.mp4' }],
    } }])
    const { container } = render(<GatewayHomePage onNavigate={onNavigate} />)

    const content = await screen.findByText('Recommended reel')
    const card = content.closest('article.gateway-post')
    expect(card).not.toBeNull()
    expect(card).toHaveTextContent('Reel Author')
    expect(card?.querySelector('.post-author-avatar .avatar')).toHaveStyle({ width: '40px', height: '40px', fontSize: '17px' })
    expect(card?.querySelector('video')).toHaveAttribute('src', 'https://uploads.example.com/reels/reel-71.mp4')
    fireEvent.click(card!.querySelector('video')!)
    expect(onNavigate).toHaveBeenCalledWith('/reel/reel-71?source=for-you')
    expect(container.querySelectorAll('.feed-section > article.gateway-post')).toHaveLength(1)
    expect(await within(card as HTMLElement).findByTestId('content-actions')).toBeInTheDocument()
  })

  it('loads the next feed page automatically when the end sentinel enters the viewport', async () => {
    let intersect: (() => void) | null = null
    class IntersectionObserverMock {
      readonly root = null
      readonly rootMargin = '520px 0px'
      readonly thresholds = [0.01]
      constructor(callback: IntersectionObserverCallback) {
        intersect = () => callback([{ isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const makePost = (id: string): GatewayPost => ({
      __typename: 'FeedPostDetail', id, type: 1, content: `Post ${id}`, privacy: 0,
      create: '2026-07-20T08:00:00Z', author: { id: '2', name: 'Feed Author', avatar: '', isVerified: false, canFollow: false },
      media: [], sharedSource: null,
    })
    apiMocks.recommendedFeed.mockImplementation((_viewerId: string, offset: number) => Promise.resolve(offset === 0
      ? Array.from({ length: 12 }, (_, index) => ({ postId: `page-1-${index}`, post: makePost(`page-1-${index}`) }))
      : [{ postId: 'page-2-0', post: makePost('page-2-0') }]))

    const { container } = render(<GatewayHomePage />)
    await waitFor(() => expect(container.querySelectorAll('.feed-section > article.gateway-post')).toHaveLength(12))
    expect(screen.queryByRole('button', { name: 'loadMorePosts' })).not.toBeInTheDocument()
    await waitFor(() => expect(intersect).not.toBeNull())
    act(() => intersect?.())

    await waitFor(() => expect(apiMocks.recommendedFeed).toHaveBeenCalledWith('9007199254740993123', 12, 12))
    await waitFor(() => expect(container.querySelectorAll('.feed-section > article.gateway-post')).toHaveLength(13))
    expect(await screen.findByText('endOfFeed')).toBeInTheDocument()
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
    expect(composerDialog.closest('.home-composer-backdrop')?.parentElement).toBe(document.body)
    expect(within(composerDialog).getByRole('button', { name: 'close' }).querySelector('path')).toHaveAttribute('d', 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z')
    const privacyButton = within(composerDialog).getByRole('button', { name: 'privacy' })
    expect(privacyButton).toHaveTextContent('privacyPublic')
    expect(privacyButton.querySelector('.home-post-public-icon')).toBeInTheDocument()
    expect(privacyButton.querySelector('.home-post-privacy-caret path')).toHaveAttribute('d', 'M7.2 9.2h9.6c.75 0 1.15.88.64 1.44l-4.72 5.18c-.38.42-1.06.42-1.44 0l-4.72-5.18C6.05 10.08 6.45 9.2 7.2 9.2Z')
    fireEvent.click(privacyButton)
    const friendsFollowersIcon = within(composerDialog).getByRole('option', { name: 'privacyFriendsFollowers' }).querySelector('.privacy-1')
    expect(friendsFollowersIcon).toHaveClass('friend-people-glyph', 'is-filled')
    expect(friendsFollowersIcon?.querySelectorAll(':scope > g')).toHaveLength(3)
    const friendsIcon = within(composerDialog).getByRole('option', { name: 'privacyFriends' }).querySelector('.privacy-2')
    expect(friendsIcon).toHaveClass('friend-person-glyph')
    expect(friendsIcon?.querySelector(':scope > g')).toHaveAttribute('transform', 'translate(12 13)')
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

  it('opens a routed post detail over Home and closes it without leaving Home', async () => {
    const onDetailClose = vi.fn()
    render(<GatewayHomePage detailPostId="source-post-from-story" onDetailClose={onDetailClose} />)

    const detail = await screen.findByTestId('content-detail-overlay')
    expect(detail).toHaveTextContent('source-post-from-story')
    expect(screen.getByRole('main')).toHaveClass('gateway-home')
    fireEvent.click(within(detail).getByRole('button', { name: 'close' }))
    expect(onDetailClose).toHaveBeenCalledTimes(1)
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

  it('pastes a copied image into the same preview and upload pipeline as a local file', async () => {
    apiMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'https://uploads.example.com/media/files/clipboard.png',
      type: 'image', contentType: 'image/png', size: 4, name: 'clipboard.png',
    }])
    apiMocks.createFeedPost.mockResolvedValue({ id: 'clipboard-post' })
    apiMocks.postDetail.mockResolvedValue(null)
    render(<GatewayHomePage />)

    fireEvent.click(screen.getByRole('button', { name: 'postComposerPlaceholder' }))
    const textarea = screen.getByPlaceholderText('postComposerPersonalPlaceholder')
    const image = new File([new Uint8Array([137, 80, 78, 71])], 'clipboard.png', { type: 'image/png' })
    fireEvent.paste(textarea, { clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      files: [image],
      getData: () => 'https://example.com/clipboard.png',
    } })

    expect(await screen.findByLabelText('mediaPreview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'post' }))
    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalledWith([image]))
    expect(apiMocks.createFeedPost).toHaveBeenCalledWith(expect.objectContaining({
      media: [{ type: 0, url: 'https://uploads.example.com/media/files/clipboard.png' }],
    }))
  })

  it('can publish the same video twice without remounting or refreshing the page', async () => {
    const video = new File([new Uint8Array([0, 0, 0, 0, 102, 116, 121, 112])], 'repeat.mp4', { type: 'video/mp4' })
    apiMocks.uploadMediaFiles.mockImplementation(async () => [{
      url: `https://uploads.example.com/media/files/video-${apiMocks.uploadMediaFiles.mock.calls.length}.mp4`,
      type: 'video',
      contentType: 'video/mp4',
      size: video.size,
      name: video.name,
    }])
    apiMocks.createFeedPost
      .mockResolvedValueOnce({ id: 'video-post-1' })
      .mockResolvedValueOnce({ id: 'video-post-2' })
    apiMocks.postDetail.mockResolvedValue(null)
    render(<GatewayHomePage />)

    const firstInput = screen.getAllByLabelText('photoVideo')[0]
    fireEvent.change(firstInput, { target: { files: [video] } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'createPost' })).getByRole('button', { name: 'post' }))
    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'createPost' })).not.toBeInTheDocument())

    const secondInput = screen.getAllByLabelText('photoVideo')[0]
    expect(secondInput).not.toBe(firstInput)
    fireEvent.change(secondInput, { target: { files: [video] } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'createPost' })).getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledTimes(2))
    expect(apiMocks.uploadMediaFiles.mock.calls[0][0]).toEqual([video])
    expect(apiMocks.uploadMediaFiles.mock.calls[1][0]).toEqual([video])
  })

  it('rejects an oversized feed video before starting the upload request', () => {
    const video = new File([new Uint8Array([0, 0, 0, 0, 102, 116, 121, 112])], 'too-large.mp4', { type: 'video/mp4' })
    Object.defineProperty(video, 'size', { value: (500 * 1024 * 1024) + 1 })
    render(<GatewayHomePage />)

    fireEvent.change(screen.getAllByLabelText('photoVideo')[0], { target: { files: [video] } })

    const dialog = screen.getByRole('dialog', { name: 'createPost' })
    expect(within(dialog).getByText('postVideoTooLarge')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'post' })).toBeDisabled()
    expect(apiMocks.uploadMediaFiles).not.toHaveBeenCalled()
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
    render(<GatewayHomePage />)

    fireEvent.change(screen.getAllByLabelText('photoVideo')[0], { target: { files } })

    expect(await screen.findByText('+2')).toBeInTheDocument()
    expect(screen.getByLabelText('mediaPreview')).toHaveClass('media-count-5')
    expect(document.querySelectorAll('.home-media-slot')).toHaveLength(5)
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

    const onNavigate = vi.fn()
    const { container } = render(<GatewayHomePage onNavigate={onNavigate} profile={{
      id: '9007199254740993123', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: 'https://uploads.example.com/avatar-square.jpg',
      bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z', friendCount: 0, postCount: 0,
    }} />)

    await screen.findByText('Friend Story')
    const shortcutLabels = [...screen.getByRole('navigation', { name: 'primaryNavLabel' }).querySelectorAll('button strong')].map((item) => item.textContent)
    expect(shortcutLabels).toEqual(['Owner Name', 'saved', 'friends', 'reels', 'groups'])
    const composerQuickActions = [...container.querySelector('.home-composer-quick-actions')!.children].map((item) => item.getAttribute('aria-label'))
    expect(composerQuickActions).toEqual(['liveVideo', 'photoVideo', 'createReel'])
    fireEvent.click(screen.getByRole('button', { name: 'liveVideo' }))
    expect(screen.queryByRole('dialog', { name: 'createPost' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'createReel' }))
    expect(await screen.findByRole('dialog', { name: 'createReel' })).toBeInTheDocument()
    expect(onNavigate).not.toHaveBeenCalledWith('/reels')
    const storyLabels = [...container.querySelectorAll('.story-tile strong')].map((item) => item.textContent)
    expect(storyLabels).toEqual(['storyCreate', 'yourStory', 'Friend Story'])
    expect(container.querySelector<HTMLElement>('.create-story-preview')?.style.backgroundImage).toContain('avatar-square.jpg')
    expect(container.querySelectorAll('.story-avatar-ring.unseen')).toHaveLength(1)
    const friendTile = screen.getByText('Friend Story').closest('.story-tile')!
    expect(friendTile.querySelectorAll('.home-story-media-preview')).toHaveLength(1)
    expect(friendTile.querySelector('.story-image-foreground-source')).toHaveAttribute('src', 'https://uploads.example.com/story.jpg')
    expect(friendTile.querySelector('.story-stage-backdrop canvas')).toBeInTheDocument()
    expect(friendTile.querySelector('.home-story-caption-preview')).toHaveTextContent('Friend update')
    expect(friendTile.querySelector('.story-avatar-ring')).toHaveClass('unseen')
    expect(friendTile.querySelector('.story-avatar-ring .avatar')).toHaveStyle({ width: '32px', height: '32px' })
    expect(screen.getByText('yourStory').closest('.story-tile')?.querySelector('.story-avatar-ring')).not.toHaveClass('unseen')
    expect(screen.queryByRole('button', { name: 'deleteStory' })).not.toBeInTheDocument()
    fireEvent.click(friendTile.querySelector('.story-open')!)
    await waitFor(() => expect(socialMocks.watchContent).toHaveBeenCalledWith('9007199254740993123', '11'))
    await waitFor(() => expect(friendTile.querySelector('.story-avatar-ring')).not.toHaveClass('unseen'))
  })

  it('restores a newly shared story preview and its unseen ring after Home loads again', async () => {
    window.sessionStorage.setItem('fakebook.own-unseen-stories.9007199254740993123', JSON.stringify(['shared-story-1']))
    apiMocks.myStories.mockResolvedValue({
      author: { id: '9007199254740993123', name: 'Owner Name', avatar: '', isVerified: false },
      latestCreate: '2026-07-21T09:00:00Z',
      hasUnseen: false,
      unseenCount: 0,
      stories: [{
        __typename: 'FeedPostShareStory',
        id: 'shared-story-1',
        content: '',
        create: '2026-07-21T09:00:00Z',
        sharedSource: {
          id: 'source-post-1',
          content: 'Shared post preview text',
          media: null,
          author: { id: '2', name: 'Original Author', avatar: '', isVerified: false },
        },
      }],
    })

    const { container } = render(<GatewayHomePage profile={{
      id: '9007199254740993123', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
      isVerified: false, bio: null, birthDate: null, gender: null, location: null, createdAt: '2026-01-01T00:00:00Z',
      friendCount: 0, postCount: 0,
    }} />)

    expect(await screen.findByText('Shared post preview text')).toBeInTheDocument()
    const ownStoryTile = screen.getByText('yourStory').closest('.story-tile')!
    expect(ownStoryTile.querySelector('.shared-story-miniature.home-shared-story-preview')).toBeInTheDocument()
    expect(ownStoryTile.querySelector('.shared-story-mini-post')).toBeInTheDocument()
    expect(ownStoryTile.querySelector('.story-avatar-ring')).toHaveClass('unseen')
    expect(container.querySelectorAll('.story-avatar-ring.unseen')).toHaveLength(1)
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

  it('removes a deleted story in place without closing the viewer or showing a home banner', async () => {
    apiMocks.myStories.mockResolvedValue({
      author: { id: '9007199254740993123', name: 'Owner Name', avatar: '', isVerified: false },
      latestCreate: '2026-07-17T10:00:00Z',
      hasUnseen: false,
      stories: [
        { __typename: 'NormalStory', id: 'story-delete', content: 'Delete me', create: '2026-07-17T10:00:00Z', media: [] },
        { __typename: 'NormalStory', id: 'story-keep', content: 'Keep me', create: '2026-07-17T09:00:00Z', media: [] },
      ],
    })
    apiMocks.deleteStory.mockResolvedValue({ success: true, message: null })
    render(<GatewayHomePage />)

    const ownStoryTile = (await screen.findByText('yourStory')).closest('.story-tile')!
    fireEvent.click(ownStoryTile.querySelector('.story-open')!)
    fireEvent.click(await screen.findByRole('button', { name: 'storyOptions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'deleteStory' }))

    await waitFor(() => expect(apiMocks.deleteStory).toHaveBeenCalledWith('9007199254740993123', 'story-delete'))
    const viewer = screen.getByRole('dialog', { name: 'stories' })
    await waitFor(() => expect(viewer.querySelector('.story-text-only p')).toHaveTextContent('Keep me'))
    expect(screen.queryByText('storyDeleted')).not.toBeInTheDocument()
    expect(apiMocks.myStories).toHaveBeenCalledTimes(1)
  })

  it('opens a direct conversation from the contacts rail', async () => {
    messengerMocks.directConversations.mockResolvedValue([
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
    fireEvent.click(contactName.closest('button')!)
    expect(onMessage).toHaveBeenCalledWith('2')
  })

  it('opens an existing direct conversation without requiring the contact to remain a friend', async () => {
    const directConversation = {
      id: 'direct-existing', type: 'DIRECT' as const, participants: [
        { id: '9007199254740993123', username: 'me', displayName: 'Me', avatarUrl: null, leftAt: null },
        { id: '9', username: 'former-friend', displayName: 'Former Friend', avatarUrl: null, leftAt: null },
      ], title: null, avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null,
    }
    messengerMocks.directConversations.mockResolvedValue([directConversation])
    const onConversation = vi.fn()
    const onMessage = vi.fn().mockResolvedValue(undefined)
    render(<GatewayHomePage onConversation={onConversation} onMessage={onMessage} />)

    const contactName = await screen.findByText('Former Friend')
    fireEvent.click(contactName.closest('button')!)
    expect(onConversation).toHaveBeenCalledWith(directConversation)
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('renders active group conversations below contacts and opens the selected group', async () => {
    const directConversation = {
      id: 'direct-1', type: 'DIRECT' as const, participants: [
        { id: '9007199254740993123', username: 'me', displayName: 'Me', avatarUrl: null, leftAt: null },
        { id: '2', username: 'friend', displayName: 'Friend Contact', avatarUrl: null, leftAt: null },
      ], title: null, avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null,
    }
    const groupConversation = {
      id: 'group-1', type: 'GROUP' as const, participants: [
        { id: '9007199254740993123', username: 'me', displayName: 'Me', avatarUrl: null, leftAt: null },
        { id: '3', username: 'group-member', displayName: 'Group Member', avatarUrl: null, leftAt: null },
      ], title: 'Group Only', avatarUrl: null, updatedAt: '2026-01-02', unreadCount: 0, lastMessage: null,
    }
    const leftGroupConversation = {
      ...groupConversation,
      id: 'group-left',
      title: 'Left Group',
      participants: groupConversation.participants.map((participant) => participant.id === '9007199254740993123'
        ? { ...participant, leftAt: '2026-01-03' }
        : participant),
    }
    messengerMocks.directConversations.mockResolvedValue([directConversation])
    messengerMocks.conversations.mockResolvedValue([groupConversation, directConversation, leftGroupConversation])
    const onConversation = vi.fn()
    const { container } = render(<GatewayHomePage onConversation={onConversation} />)

    const rightRail = container.querySelector<HTMLElement>('.gateway-right-rail')!
    const contactsModule = rightRail.querySelector<HTMLElement>('.contacts-module')!
    const groupModule = rightRail.querySelector<HTMLElement>('.group-conversations-module')!
    expect(await within(contactsModule).findByText('Friend Contact')).toBeInTheDocument()
    expect(within(contactsModule).queryByText('Group Only')).not.toBeInTheDocument()
    expect(within(groupModule).getByRole('heading', { name: 'groupChats' })).toBeInTheDocument()
    const groupName = await within(groupModule).findByText('Group Only')
    expect(within(groupModule).queryByText('Friend Contact')).not.toBeInTheDocument()
    expect(within(groupModule).queryByText('Left Group')).not.toBeInTheDocument()
    expect(contactsModule.compareDocumentPosition(groupModule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(messengerMocks.conversations).toHaveBeenCalledWith('9007199254740993123', 100)

    fireEvent.click(groupName.closest('button')!)
    expect(onConversation).toHaveBeenCalledWith(groupConversation)
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
    expect(container.querySelector('.contacts-module > .spinner')).not.toBeInTheDocument()

    await waitFor(() => expect(searchMocks.searchDirectContacts).toHaveBeenCalledWith('o', 1, 20))
    expect(await screen.findByText('Older Contact')).toBeInTheDocument()
  })

  it('delegates the contacts plus button to the dock conversation composer', async () => {
    const onNewConversation = vi.fn()
    render(<GatewayHomePage onNewConversation={onNewConversation} />)

    fireEvent.click(await screen.findByRole('button', { name: 'newMessage' }))

    expect(onNewConversation).toHaveBeenCalledTimes(1)
    expect(searchMocks.searchFriends).not.toHaveBeenCalled()
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
    expect(within(feedCard).queryByRole('button', { name: 'privacyFriends' })).not.toBeInTheDocument()
    expect(feedCard.querySelector('.post-privacy-hover .privacy-2')).toHaveClass('friend-person-glyph')
    expect(feedCard.querySelector('.post-privacy-hover .privacy-2 > g')).toHaveAttribute('transform', 'translate(12 13)')
    fireEvent.mouseEnter(feedCard.querySelector('.post-time-hover')!)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('2026')
    fireEvent.mouseLeave(feedCard.querySelector('.post-time-hover')!)
    fireEvent.mouseEnter(feedCard.querySelector('.post-privacy-hover')!)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('privacyFriends')
    fireEvent.mouseLeave(feedCard.querySelector('.post-privacy-hover')!)

    fireEvent.click(await screen.findByRole('button', { name: 'follow' }))
    await waitFor(() => expect(socialMocks.followUser).toHaveBeenCalledWith('9007199254740993123', '2'))
    const followingButton = screen.getByRole('button', { name: 'following' })
    expect(followingButton).toHaveClass('is-settled')
    fireEvent.click(followingButton)
    await waitFor(() => expect(socialMocks.unfollowUser).toHaveBeenCalledWith('9007199254740993123', '2'))
    expect(screen.getByRole('button', { name: 'follow' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'joinGroup' }))
    await waitFor(() => expect(socialMocks.requestJoinGroup).toHaveBeenCalledWith('9007199254740993123', '8'))
    const requestedButton = screen.getByRole('button', { name: 'joinRequested' })
    expect(requestedButton).toHaveClass('is-settled')
    fireEvent.click(requestedButton)
    await waitFor(() => expect(socialMocks.cancelJoinGroupRequest).toHaveBeenCalledWith('9007199254740993123', '8'))
    expect(screen.getByRole('button', { name: 'joinGroup' })).toBeInTheDocument()
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

  it('hydrates a pending group request on first render and cancels it from the post header', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: 'pending-group-post', post: {
      __typename: 'GroupPostDetail', id: 'pending-group-post', type: 2, content: 'Pending group post', privacy: 0,
      create: '2026-07-17T08:01:00Z', author: { id: '3', name: 'Group Author', avatar: '', isVerified: false, canFollow: false },
      group: { id: 'pending-group', name: 'Pending Group', avatar: '', canJoin: true, joinRequestPending: true }, media: [],
    } }])

    render(<GatewayHomePage />)

    const requestedButton = await screen.findByRole('button', { name: 'joinRequested' })
    expect(requestedButton).toHaveClass('is-settled')
    expect(socialMocks.requestJoinGroup).not.toHaveBeenCalled()
    fireEvent.click(requestedButton)
    await waitFor(() => expect(socialMocks.cancelJoinGroupRequest).toHaveBeenCalledWith('9007199254740993123', 'pending-group'))
    expect(screen.getByRole('button', { name: 'joinGroup' })).toBeInTheDocument()
  })

  it('uses group-derived privacy labels and the group icon for private group posts', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: 'private-group-post', post: {
      __typename: 'GroupPostDetail', id: 'private-group-post', type: 3, content: 'Private group content', privacy: 1,
      create: '2026-07-17T08:01:00Z', author: { id: '3', name: 'Group Author', avatar: '', isVerified: false, canFollow: false },
      group: { id: '18', name: 'Private Design Group', avatar: '', canJoin: false }, media: [],
    } }])
    const { container } = render(<GatewayHomePage />)

    const card = (await screen.findByText('Private group content')).closest('article')!
    const privateGroupIcon = card.querySelector('.post-privacy-hover .group-private-privacy-icon')
    expect(privateGroupIcon).toBeInTheDocument()
    expect(privateGroupIcon?.tagName).toBe('SPAN')
    expect(privateGroupIcon?.querySelectorAll('.group-private-privacy-glyph > g > circle')).toHaveLength(3)
    expect(privateGroupIcon?.querySelectorAll('.group-private-privacy-glyph > g > path')).toHaveLength(3)
    expect(privateGroupIcon?.querySelector('.group-private-privacy-glyph > g')).toHaveAttribute('fill', 'var(--group-private-privacy-glyph-color)')
    expect(privateGroupIcon?.querySelector('.group-private-privacy-glyph > g')).toHaveAttribute('stroke', 'var(--group-private-privacy-surface)')
    expect(privateGroupIcon?.querySelector('.group-private-privacy-glyph > g')).toHaveAttribute('stroke-width', '0.52')
    expect(privateGroupIcon?.querySelector('.group-private-privacy-glyph > g')).toHaveAttribute('transform', 'translate(-0.35 -0.9)')
    expect(card.querySelector('.post-privacy-hover .privacy-1')).not.toBeInTheDocument()
    fireEvent.mouseEnter(card.querySelector('.post-privacy-hover')!)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('privateGroup')
    expect(container.querySelector('.group-post-avatar-stack')).toBeInTheDocument()
  })

  it('uses only the author identity for a post inside its owning group and exposes delete to its administrator', async () => {
    const groupPost: GatewayPost = {
      __typename: 'GroupPostDetail',
      id: 'group-profile-post',
      type: 3,
      content: 'Group profile content',
      privacy: 1,
      create: '2026-07-31T08:00:00Z',
      author: { id: 'group-author', name: 'Group author', avatar: '/author.jpg', isVerified: false },
      group: { id: 'owning-group', name: 'Owning group', avatar: '/group.jpg', canJoin: false },
      media: [],
    }

    const { container } = render(<GatewayPostCard
      post={groupPost}
      locale="vi-VN"
      viewerId="group-admin"
      groupContextId="owning-group"
      viewerCanModerateGroupPosts
    />)

    expect(screen.getAllByRole('button', { name: 'Group author' })).toHaveLength(2)
    expect(container.querySelector('.group-post-avatar-stack')).not.toBeInTheDocument()
    expect(container.querySelector('.post-group-link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'joinGroup' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'postOptions' }))
    expect(await screen.findByRole('menuitem', { name: /deletePost/ })).toBeInTheDocument()
  })

  it('offers group-post deletion to the current group administrator outside the group profile too', async () => {
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: false, isAdmin: true, joinRequestPending: false, canViewPosts: true })
    const groupPost: GatewayPost = {
      __typename: 'GroupPostDetail',
      id: 'moderated-group-post',
      type: 3,
      content: 'Moderated content',
      privacy: 0,
      create: '2026-07-31T08:00:00Z',
      author: { id: 'another-author', name: 'Another author', avatar: '', isVerified: false },
      group: { id: 'moderated-group', name: 'Moderated group', avatar: '', canJoin: false },
      media: [],
    }

    render(<GatewayPostCard post={groupPost} locale="vi-VN" viewerId="group-admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'postOptions' }))

    expect(await screen.findByRole('menuitem', { name: /deletePost/ })).toBeInTheDocument()
    expect(socialMocks.getGroupMembershipState).toHaveBeenCalledWith('group-admin', 'moderated-group')
  })

  it('lets the feed post owner change privacy directly from the metadata icon', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: 'owner-post', post: {
      __typename: 'FeedPostDetail', id: 'owner-post', type: 1, content: 'Owner privacy post', privacy: 0,
      create: '2026-07-19T08:00:00Z', author: { id: '9007199254740993123', name: 'Owner', avatar: '', isVerified: false, canFollow: false },
      media: [], sharedSource: null,
    } }])
    socialMocks.updatePost.mockResolvedValue({
      id: 'owner-post', type: 1, content: 'Owner privacy post', privacy: 3, createdAt: '2026-07-19T08:00:00Z', authorId: '9007199254740993123', media: [],
    })
    render(<GatewayHomePage />)

    const card = (await screen.findByText('Owner privacy post')).closest('article')!
    fireEvent.click(within(card).getByRole('button', { name: 'privacyPublic' }))
    const privacyMenu = screen.getByRole('listbox', { name: 'privacy' })
    expect(privacyMenu).not.toHaveTextContent('✓')
    fireEvent.click(within(privacyMenu).getByRole('option', { name: 'privacyOnlyMe' }))

    await waitFor(() => expect(socialMocks.updatePost).toHaveBeenCalledWith('owner-post', { privacy: 3 }))
    expect(within(card).getByRole('button', { name: 'privacyOnlyMe' }).querySelector('.privacy-3')).toBeInTheDocument()
    expect(screen.queryByRole('listbox', { name: 'privacy' })).not.toBeInTheDocument()
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

  it('renders shared source metadata and a playable adaptive media gallery', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: 'shared-70', post: {
      __typename: 'FeedPostDetail',
      id: 'shared-70',
      type: 1,
      content: 'Sharer commentary',
      privacy: 0,
      create: '2026-07-21T12:00:00Z',
      author: { id: '7', name: 'Sharer Name', avatar: '', isVerified: false, canFollow: false },
      media: [],
      sharedSource: {
        id: 'original-69',
        isAvailable: true,
        type: 1,
        content: 'Original body',
        privacy: 2,
        create: '2026-07-20T09:15:00Z',
        author: { id: '6', name: 'Original Name', avatar: '', isVerified: true },
        media: [
          { id: 'video-1', type: 1, url: 'https://uploads.example.com/original.mp4' },
          { id: 'image-1', type: 0, url: 'https://uploads.example.com/original-1.jpg' },
          { id: 'image-2', type: 0, url: 'https://uploads.example.com/original-2.jpg' },
        ],
      },
    } }])

    render(<GatewayHomePage />)

    const sourceCard = (await screen.findByText('Original body')).closest('.shared-post-source')!
    expect(sourceCard.closest('.gateway-post')).toHaveClass('has-shared-source')
    expect(sourceCard.querySelector('.post-author-name strong')).toHaveTextContent('Original Name')
    expect(sourceCard.querySelector('time')).toHaveAttribute('datetime', '2026-07-20T09:15:00Z')
    expect(within(sourceCard as HTMLElement).getByLabelText('privacyFriends')).toBeInTheDocument()
    expect(sourceCard.querySelector('.post-media-gallery')).not.toHaveClass('compact')
    expect(sourceCard.querySelectorAll('.post-media-slot')).toHaveLength(3)
    expect(sourceCard.querySelector('video')).not.toHaveAttribute('controls')
    expect(sourceCard.querySelector('.post-video-player')).toBeInTheDocument()
    expect(sourceCard.querySelector('.post-video-controls')).toBeInTheDocument()
    fireEvent.click(within(sourceCard as HTMLElement).getByRole('button', { name: 'videoSettings' }))
    expect(within(sourceCard as HTMLElement).getByRole('menu')).toBeInTheDocument()
    expect(screen.queryByTestId('content-detail-overlay')).not.toBeInTheDocument()
    const sourceHeader = sourceCard.querySelector('.shared-source-head')!
    const sourceGallery = sourceCard.querySelector('.post-media-gallery')!
    expect(sourceHeader.compareDocumentPosition(sourceGallery) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    fireEvent.click(sourceHeader)
    expect(await screen.findByTestId('content-detail-overlay')).toHaveTextContent('original-69')
    fireEvent.click(within(screen.getByTestId('content-detail-overlay')).getByRole('button', { name: 'close' }))
    fireEvent.click(sourceCard.querySelectorAll<HTMLElement>('.post-media-slot.image-interactive')[0])
    expect(await screen.findByTestId('post-photo-viewer')).toHaveTextContent('original-69:image-1')
  })

  it('opens a normal post image in the photo viewer but leaves its video controls alone', async () => {
    apiMocks.recommendedFeed.mockResolvedValue([{ postId: 'photo-post', post: {
      __typename: 'FeedPostDetail',
      id: 'photo-post',
      type: 1,
      content: 'Mixed media post',
      privacy: 0,
      create: '2026-07-24T10:00:00Z',
      author: { id: '2', name: 'Author', avatar: '', isVerified: false, canFollow: false },
      media: [
        { id: 'post-image', type: 0, url: '/post-image.jpg' },
        { id: 'post-video', type: 1, url: '/post-video.mp4' },
      ],
      sharedSource: null,
    } }])

    render(<GatewayHomePage />)

    const card = (await screen.findByText('Mixed media post')).closest('.gateway-post')!
    fireEvent.click(card.querySelector<HTMLElement>('.post-media-slot.image-interactive')!)
    expect(await screen.findByTestId('post-photo-viewer')).toHaveTextContent('photo-post:post-image')
    fireEvent.click(screen.getByRole('button', { name: 'close-photo' }))
    fireEvent.click(card.querySelector<HTMLElement>('.post-video-player')!)
    expect(screen.queryByTestId('post-photo-viewer')).not.toBeInTheDocument()
  })
})

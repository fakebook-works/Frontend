// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Activity } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GroupsPage } from './GroupsPage'

const apiMocks = vi.hoisted(() => ({
  recommendedFeed: vi.fn(),
  visitedGroups: vi.fn(),
}))
const socialMocks = vi.hoisted(() => ({
  getMemberGroups: vi.fn(),
  getAdminGroups: vi.fn(),
  getPendingGroupJoins: vi.fn(),
  getGroups: vi.fn(),
  getGroupSuggestions: vi.fn(),
  requestJoinGroup: vi.fn(),
  createGroup: vi.fn(),
  inviteGroupUser: vi.fn(),
  getRelationProfiles: vi.fn(),
}))
const searchMocks = vi.hoisted(() => ({
  search: vi.fn(),
  fastSearchGroups: vi.fn(),
  searchGroupScope: vi.fn(),
  recordSearchResultView: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string) => key)

vi.mock('../api/client', () => ({
  api: apiMocks,
  visibleRecommendationPosts: (items: Array<{ post: unknown | null }>) => items.flatMap((item) => item.post ? [item.post] : []),
}))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../api/search', () => ({ searchApi: searchMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'vi-VN', t: translate }) }))
vi.mock('./GatewayHomePage', () => ({
  GatewayPostCard: ({ post }: { post: { id: string; content: string } }) => <article data-testid={`group-post-${post.id}`}>{post.content}</article>,
}))

const publicGroup = {
  id: '301',
  avatarUrl: '/group-avatar.jpg',
  backgroundUrl: '/group-cover.jpg',
  name: 'Nhóm thiết kế công khai',
  bio: null,
  privacy: 0,
  createdAt: '2026-07-20T08:00:00Z',
  memberCount: 42,
  adminCount: 1,
}

const privateGroup = {
  ...publicGroup,
  id: '302',
  name: 'Private design group',
  privacy: 1,
}

const suggestionFriends = [
  { id: '201', username: 'an', displayName: 'An', avatarUrl: '/an.jpg' },
  { id: '202', username: 'binh', displayName: 'Bình', avatarUrl: '/binh.jpg' },
  { id: '203', username: 'chi', displayName: 'Chi', avatarUrl: '/chi.jpg' },
  { id: '204', username: 'dung', displayName: 'Dung', avatarUrl: '/dung.jpg' },
]

const publicSuggestion = {
  group: publicGroup,
  friendMemberCount: 5,
  friendMembers: suggestionFriends,
  yesterdayPostCount: 7,
}

const privateSuggestion = {
  group: privateGroup,
  friendMemberCount: 1,
  friendMembers: suggestionFriends.slice(0, 1),
  yesterdayPostCount: 2,
}

describe('GroupsPage', () => {
  beforeEach(() => {
    apiMocks.visitedGroups.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    apiMocks.recommendedFeed.mockReset().mockResolvedValue([
      { postId: 'feed-1', post: {
        __typename: 'FeedPostDetail', id: 'feed-1', type: 2, content: 'Bài feed thường không thuộc trang nhóm', privacy: 0,
        create: '2026-07-20T08:00:00Z', author: { id: '8', name: 'User', avatar: '', isVerified: false }, media: [],
      } },
      { postId: 'group-1', post: {
        __typename: 'GroupPostDetail', id: 'group-1', type: 3, content: 'Bài viết nhóm được đề xuất', privacy: 0,
        create: '2026-07-20T09:00:00Z', author: { id: '9', name: 'Member', avatar: '', isVerified: false },
        group: { id: publicGroup.id, name: publicGroup.name, avatar: publicGroup.avatarUrl, canJoin: true }, media: [],
      } },
    ])
    socialMocks.getMemberGroups.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getAdminGroups.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getPendingGroupJoins.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getGroups.mockReset().mockResolvedValue([])
    socialMocks.getGroupSuggestions.mockReset().mockResolvedValue([publicSuggestion, privateSuggestion])
    socialMocks.requestJoinGroup.mockReset().mockResolvedValue(true)
    socialMocks.createGroup.mockReset().mockResolvedValue({ ...publicGroup, id: '999', name: 'Nhóm mới' })
    socialMocks.inviteGroupUser.mockReset().mockResolvedValue(true)
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([])
    searchMocks.search.mockReset().mockResolvedValue({ tab: 'groups', page: 1, hasNextPage: false, users: [], groups: [], posts: [], reels: [] })
    searchMocks.fastSearchGroups.mockReset().mockResolvedValue([])
    searchMocks.searchGroupScope.mockReset().mockResolvedValue({ page: 1, hasNextPage: false, groups: [], posts: [] })
    searchMocks.recordSearchResultView.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('hides the page scrollbar only while the Groups page is mounted', () => {
    const { unmount } = render(<GroupsPage userId="100" onNavigate={vi.fn()} />)

    expect(document.documentElement).toHaveClass('groups-page-scroll')
    expect(document.body).toHaveClass('groups-page-scroll')

    unmount()
    expect(document.documentElement).not.toHaveClass('groups-page-scroll')
    expect(document.body).not.toHaveClass('groups-page-scroll')
  })

  it('uses layout-matched sidebar and post skeletons during the initial group load', () => {
    const pending = new Promise<never>(() => undefined)
    apiMocks.visitedGroups.mockReturnValue(pending)
    apiMocks.recommendedFeed.mockReturnValue(pending)
    socialMocks.getMemberGroups.mockReturnValue(pending)
    socialMocks.getAdminGroups.mockReturnValue(pending)
    socialMocks.getPendingGroupJoins.mockReturnValue(pending)
    socialMocks.getGroupSuggestions.mockReturnValue(pending)

    const { container } = render(<GroupsPage userId="100" onNavigate={vi.fn()} />)

    expect(container.querySelector('.groups-sidebar-collections-skeleton')).toBeInTheDocument()
    expect(container.querySelectorAll('.groups-sidebar-skeleton-row')).toHaveLength(5)
    expect(container.querySelectorAll('.groups-feed-skeleton .home-feed-skeleton')).toHaveLength(2)
    expect(container.querySelectorAll('.groups-feed-skeleton .home-feed-skeleton-media')).toHaveLength(2)
  })

  it('restores the Groups tab without reloading its collections or feed', async () => {
    const { rerender } = render(<Activity mode="visible"><GroupsPage userId="100" onNavigate={vi.fn()} /></Activity>)
    await screen.findByTestId('group-post-group-1')
    expect(apiMocks.recommendedFeed).toHaveBeenCalledTimes(1)
    expect(socialMocks.getMemberGroups).toHaveBeenCalledTimes(1)

    rerender(<Activity mode="hidden"><GroupsPage userId="100" onNavigate={vi.fn()} /></Activity>)
    rerender(<Activity mode="visible"><GroupsPage userId="100" onNavigate={vi.fn()} /></Activity>)

    expect(apiMocks.recommendedFeed).toHaveBeenCalledTimes(1)
    expect(socialMocks.getMemberGroups).toHaveBeenCalledTimes(1)
    expect(socialMocks.getAdminGroups).toHaveBeenCalledTimes(1)
    expect(socialMocks.getGroupSuggestions).toHaveBeenCalledTimes(1)
  })

  it('renders only recommended group posts in the group feed', async () => {
    render(<GroupsPage userId="100" onNavigate={vi.fn()} />)

    expect(await screen.findByText('Bài viết nhóm được đề xuất')).toBeInTheDocument()
    expect(screen.queryByText('Bài feed thường không thuộc trang nhóm')).not.toBeInTheDocument()
    expect(apiMocks.recommendedFeed).toHaveBeenCalledWith('100', 0, 60)
  })

  it('opens the scoped search without resizing it and shows the recent-search empty state', () => {
    const { container } = render(<GroupsPage userId="100" onNavigate={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'groupSearchPlaceholder' })

    fireEvent.focus(input)

    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('noRecentSearches')).toBeInTheDocument()
    expect(container.querySelector('.groups-search-shell')).toHaveClass('is-open')
    expect(container.querySelector('.sidebar-settings-glyph path')).toBeInTheDocument()
    expect(container.querySelectorAll('.sidebar-settings-glyph rect')).toHaveLength(0)
    expect(searchMocks.fastSearchGroups).not.toHaveBeenCalled()
    expect(searchMocks.searchGroupScope).not.toHaveBeenCalled()
  })

  it('shows only scoped quick groups and records a click without blocking navigation', async () => {
    const onNavigate = vi.fn()
    searchMocks.fastSearchGroups.mockResolvedValue([{ kind: 'group', id: '440', referenceId: '440', viewerIsMember: true, group: {
      ...publicGroup, id: '440', name: 'Quick group result',
    } }])
    searchMocks.recordSearchResultView.mockRejectedValueOnce(new Error('analytics unavailable'))
    render(<GroupsPage userId="100" onNavigate={onNavigate} />)
    const input = screen.getByRole('textbox', { name: 'groupSearchPlaceholder' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: ' quick ' } })

    await waitFor(() => expect(searchMocks.fastSearchGroups).toHaveBeenCalledWith('quick', 8))
    fireEvent.click(await screen.findByRole('button', { name: /Quick group result/ }))

    expect(searchMocks.recordSearchResultView).toHaveBeenCalledWith('440')
    expect(onNavigate).toHaveBeenCalledWith('/groups/440')
    expect(searchMocks.searchGroupScope).not.toHaveBeenCalled()
  })

  it('submits a full group-scoped search containing groups and group posts', async () => {
    const scopedGroup = { ...publicGroup, id: '550', name: 'Full group result' }
    const scopedPost = {
      __typename: 'GroupPostDetail' as const, id: 'post-550', type: 3, content: 'Full group post result', privacy: 0,
      create: '2026-07-20T09:00:00Z', author: { id: '9', name: 'Member', avatar: '', isVerified: false },
      group: { id: scopedGroup.id, name: scopedGroup.name, avatar: scopedGroup.avatarUrl, canJoin: false }, media: [],
    }
    searchMocks.searchGroupScope.mockResolvedValue({ page: 1, hasNextPage: false, groups: [scopedGroup], posts: [scopedPost] })
    render(<GroupsPage userId="100" onNavigate={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'groupSearchPlaceholder' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'full' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(searchMocks.searchGroupScope).toHaveBeenCalledWith('full', 1, 24))
    expect(await screen.findByText('Full group result')).toBeInTheDocument()
    expect(await screen.findByText('Full group post result')).toBeInTheDocument()
    expect(searchMocks.search).not.toHaveBeenCalled()
  })

  it('ignores a stale full-search response after a newer query finishes', async () => {
    type ScopedResult = { page: number; hasNextPage: boolean; groups: typeof publicGroup[]; posts: never[] }
    let resolveFirst!: (value: ScopedResult) => void
    let resolveSecond!: (value: ScopedResult) => void
    const first = new Promise<ScopedResult>((resolve) => { resolveFirst = resolve })
    const second = new Promise<ScopedResult>((resolve) => { resolveSecond = resolve })
    searchMocks.searchGroupScope.mockImplementation((keyword: string) => keyword === 'first' ? first : second)
    render(<GroupsPage userId="100" onNavigate={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'groupSearchPlaceholder' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'first' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(searchMocks.searchGroupScope).toHaveBeenCalledWith('first', 1, 24))

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'second' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(searchMocks.searchGroupScope).toHaveBeenCalledWith('second', 1, 24))

    await act(async () => resolveSecond({ page: 1, hasNextPage: false, groups: [{ ...publicGroup, id: 'second', name: 'Second result' }], posts: [] }))
    expect(await screen.findByText('Second result')).toBeInTheDocument()

    await act(async () => resolveFirst({ page: 1, hasNextPage: false, groups: [{ ...publicGroup, id: 'first', name: 'Stale first result' }], posts: [] }))
    expect(screen.queryByText('Stale first result')).not.toBeInTheDocument()
    expect(screen.getByText('Second result')).toBeInTheDocument()
  })

  it('loads public and private groups joined by friends and requests to join from Discover', async () => {
    const { container } = render(<GroupsPage userId="100" onNavigate={vi.fn()} />)
    await screen.findByText('Bài viết nhóm được đề xuất')

    fireEvent.click(screen.getByRole('button', { name: 'groupDiscover' }))
    expect(await screen.findByText(publicGroup.name)).toBeInTheDocument()
    expect(screen.getByText(privateGroup.name)).toBeInTheDocument()
    expect(screen.getAllByText('groupPostsPerDay')).toHaveLength(2)
    expect(screen.getByText('groupFriendMembers')).toBeInTheDocument()
    expect(screen.getByText('groupFriendMemberSingle')).toBeInTheDocument()
    expect(container.querySelectorAll('.groups-suggestion-card:first-child .groups-suggestion-friend-avatars .avatar')).toHaveLength(3)
    expect(socialMocks.getGroupSuggestions).toHaveBeenCalledWith(24)
    fireEvent.click(screen.getAllByRole('button', { name: 'joinGroupLong' })[1])

    await waitFor(() => expect(socialMocks.requestJoinGroup).toHaveBeenCalledWith('100', privateGroup.id))
  })

  it('splits managed and joined directories, formats partial hours, and routes sidebar actions to the matching section', async () => {
    const now = new Date('2026-07-31T12:00:00Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    const managedGroup = { ...publicGroup, id: '601', name: 'Managed directory group', memberCount: 18 }
    const joinedGroup = { ...privateGroup, id: '602', name: 'Joined directory group', memberCount: 27 }
    socialMocks.getAdminGroups.mockResolvedValue({ items: [managedGroup], endCursor: null, hasNextPage: false })
    socialMocks.getMemberGroups.mockResolvedValue({ items: [managedGroup, joinedGroup], endCursor: null, hasNextPage: false })
    apiMocks.visitedGroups.mockResolvedValue({
      items: [
        { id: managedGroup.id, avatar: managedGroup.avatarUrl, name: managedGroup.name, visitedAt: new Date(now - (3 * 60 + 20) * 60_000).toISOString() },
        { id: joinedGroup.id, avatar: joinedGroup.avatarUrl, name: joinedGroup.name, visitedAt: new Date(now - (3 * 60 + 50) * 60_000).toISOString() },
      ],
      endCursor: null,
      hasNextPage: false,
    })
    socialMocks.getGroups.mockResolvedValue([managedGroup, joinedGroup])

    try {
      const { container } = render(<GroupsPage userId="100" onNavigate={vi.fn()} />)
      await screen.findAllByText(managedGroup.name)

      const seeAllButtons = screen.getAllByRole('button', { name: 'seeAll' })
      fireEvent.click(seeAllButtons[1])

      expect(await screen.findByText('managedGroupsCount')).toBeInTheDocument()
      expect(screen.getByText('joinedGroupsCount')).toBeInTheDocument()
      expect(screen.getByText('khoảng 3 giờ trước')).toBeInTheDocument()
      expect(screen.getByText('gần 4 giờ trước')).toBeInTheDocument()
      expect(container.querySelectorAll('.groups-membership-card-directory')).toHaveLength(2)
      expect(container.querySelector('.groups-membership-card-directory .avatar')).toHaveStyle({ width: '72px', height: '72px' })
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
      expect((scrollIntoView.mock.contexts[scrollIntoView.mock.contexts.length - 1] as HTMLElement).dataset.section).toBe('joined')
    } finally {
      nowSpy.mockRestore()
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView })
    }
  })

  it('hides the empty managed section and leaves the empty joined section clear', async () => {
    const { container } = render(<GroupsPage userId="100" onNavigate={vi.fn()} />)
    await screen.findByTestId('group-post-group-1')

    fireEvent.click(screen.getByRole('button', { name: 'yourGroups' }))

    expect(screen.queryByText('managedGroupsCount')).not.toBeInTheDocument()
    expect(screen.getByText('joinedGroupsCount')).toBeInTheDocument()
    expect(screen.queryByText('joinMoreGroupsPrompt')).not.toBeInTheDocument()
    expect(container.querySelector('.groups-membership-card-directory')).not.toBeInTheDocument()
  })

  it('creates a group from the two-column creation experience', async () => {
    const onNavigate = vi.fn()
    render(<GroupsPage userId="100" profile={null} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'createNewGroup' }))

    fireEvent.change(screen.getByLabelText('groupName'), { target: { value: 'Nhóm mới' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'createGroup' }))

    await waitFor(() => expect(socialMocks.createGroup).toHaveBeenCalledWith('100', { name: 'Nhóm mới', bio: '', privacy: 0 }))
    expect(onNavigate).toHaveBeenCalledWith('/groups/999')
  })
})

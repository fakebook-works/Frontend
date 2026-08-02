// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchPageResult, SearchTab } from '../api/search'
import type { SocialGroup, SocialProfile } from '../api/social'
import { SearchPage } from './SearchPage'

const searchMocks = vi.hoisted(() => ({
  search: vi.fn(),
  recordSearchResultView: vi.fn(),
}))
const socialMocks = vi.hoisted(() => ({
  getProfiles: vi.fn(),
  getProfileRelationshipStates: vi.fn(),
  getFriendProfilesWithMutualCounts: vi.fn(),
  getFriendSuggestions: vi.fn(),
  getGroupMembershipStates: vi.fn(),
  getGroupFriendMemberPreviews: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  followUser: vi.fn(),
  requestJoinGroup: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string, values?: Record<string, unknown>) => values ? `${key}:${Object.values(values).join(':')}` : key)

vi.mock('../api/search', () => ({ searchApi: searchMocks }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({
  useI18n: () => ({ locale: 'vi', t: translate }),
}))
vi.mock('./GatewayHomePage', () => ({
  GatewayPostCard: ({ post }: { post: { id: string; __typename: string; author: { name: string } } }) => <div data-testid="gateway-search-post" data-id={post.id} data-type={post.__typename}>{post.author.name}</div>,
}))

const profile: SocialProfile = {
  id: '2', username: 'lan', email: '', displayName: 'Lan Nguyen', avatarUrl: '/lan.png', backgroundUrl: null,
  isVerified: true, bio: null, birthDate: null, gender: null, location: 'Da Nang', createdAt: '2026-01-01',
  friendCount: 5, followerCount: 12, followingCount: 3, postCount: 0, privacy: 0,
}
const group: SocialGroup = {
  id: '20', avatarUrl: '/group.png', backgroundUrl: null, name: 'Fakebook Builders', bio: null,
  privacy: 1, createdAt: '2026-01-01', memberCount: 34, adminCount: 1,
}

function empty(tab: SearchTab): SearchPageResult {
  return { tab, page: 1, hasNextPage: false, users: [], groups: [], posts: [], reels: [] }
}

describe('SearchPage results redesign', () => {
  beforeEach(() => {
    searchMocks.search.mockReset()
    searchMocks.recordSearchResultView.mockReset().mockResolvedValue(true)
    socialMocks.getProfiles.mockReset().mockResolvedValue([profile])
    socialMocks.getProfileRelationshipStates.mockReset().mockResolvedValue({
      '2': { friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false },
    })
    socialMocks.getFriendProfilesWithMutualCounts.mockReset().mockResolvedValue([{ profile, mutualFriendCount: 2 }])
    socialMocks.getFriendSuggestions.mockReset().mockResolvedValue([])
    socialMocks.getGroupMembershipStates.mockReset().mockResolvedValue({
      '20': { isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: false },
    })
    socialMocks.getGroupFriendMemberPreviews.mockReset().mockResolvedValue({
      '20': [
        { id: '3', username: 'mai', displayName: 'Mai', avatarUrl: '/mai.png', isVerified: false },
        { id: '4', username: 'nam', displayName: 'Nam', avatarUrl: '/nam.png', isVerified: false },
      ],
    })
    socialMocks.sendFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.acceptFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.followUser.mockReset().mockResolvedValue(true)
    socialMocks.requestJoinGroup.mockReset().mockResolvedValue(true)
  })

  afterEach(cleanup)

  it('keeps the result layout stable with entity skeletons while People is loading', () => {
    searchMocks.search.mockImplementation(() => new Promise(() => undefined))
    const { container } = render(<SearchPage query="lan" tab="people" userId="1" onNavigate={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'loadingSearch' })).toBeInTheDocument()
    expect(container.querySelectorAll('.search-entity-skeleton')).toHaveLength(6)
    expect(container.querySelector('.discovery-sidebar')).toBeInTheDocument()
    expect(screen.queryByText('loadingSearch')).not.toBeInTheDocument()
  })

  it('uses post-shaped skeletons while Posts is loading', () => {
    searchMocks.search.mockImplementation(() => new Promise(() => undefined))
    const { container } = render(<SearchPage query="post" tab="posts" userId="1" onNavigate={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'loadingSearch' })).toBeInTheDocument()
    expect(container.querySelectorAll('.search-feed-results-skeleton .home-feed-skeleton')).toHaveLength(2)
  })

  it('shows the empty-results state instead of a load error after a successful empty search', async () => {
    searchMocks.search.mockResolvedValue(empty('groups'))

    render(<SearchPage query="missing group" tab="groups" userId="1" onNavigate={vi.fn()} />)

    expect(await screen.findByText('noSearchResults')).toBeInTheDocument()
    expect(screen.getByText('noSearchResultsDesc')).toBeInTheDocument()
    expect(screen.queryByText('unableToLoad')).not.toBeInTheDocument()
    expect(screen.queryByText('searchLoadError')).not.toBeInTheDocument()
  })

  it('uses the Friend/Group sidebar structure and renders hydrated people actions', async () => {
    searchMocks.search.mockResolvedValue({
      ...empty('people'),
      users: [{ ...profile, location: null, searchReferenceId: 'person-ref' }],
    })
    const { container } = render(<SearchPage query="lan" tab="people" userId="1" onNavigate={vi.fn()} />)

    await screen.findByText('Lan Nguyen')
    expect(container.querySelector('.discovery-sidebar > header')).toHaveTextContent('searchResults')
    expect(container.querySelector('.discovery-sidebar > p')).not.toBeInTheDocument()
    expect([...container.querySelectorAll('.discovery-sidebar nav strong')].map((node) => node.textContent)).toEqual(['searchPosts', 'searchPeople', 'reels', 'groups'])
    expect(container.querySelector('.search-person-result')).toHaveTextContent('livesIn:Da Nang')
    expect(container.querySelector('.search-person-result')).toHaveTextContent('mutualFriendsCount:2')
    expect(container.querySelector('.search-person-result')).toHaveTextContent('followersCount:12')

    fireEvent.click(screen.getByRole('button', { name: 'addFriend' }))
    await waitFor(() => expect(socialMocks.sendFriendRequest).toHaveBeenCalledWith('1', '2'))
    expect(await screen.findByRole('button', { name: 'requestSent' })).toBeDisabled()
  })

  it('opens Messenger for friends instead of offering another relationship action', async () => {
    searchMocks.search.mockResolvedValue({ ...empty('people'), users: [{ ...profile, searchReferenceId: 'person-ref' }] })
    socialMocks.getProfileRelationshipStates.mockResolvedValue({
      '2': { friendship: 'friend', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false },
    })
    const onMessage = vi.fn().mockResolvedValue(undefined)
    render(<SearchPage query="lan" tab="people" userId="1" onNavigate={vi.fn()} onMessage={onMessage} />)

    fireEvent.click(await screen.findByRole('button', { name: 'messageUser' }))
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith('2'))
  })

  it('renders group membership metadata and changes Join to Requested after a successful request', async () => {
    searchMocks.search.mockResolvedValue({ ...empty('groups'), groups: [{ ...group, searchReferenceId: 'group-ref' }] })
    const { container } = render(<SearchPage query="builders" tab="groups" userId="1" onNavigate={vi.fn()} />)

    await screen.findByText('Fakebook Builders')
    expect(container.querySelector('.search-group-avatar .group-square-avatar')).toBeInTheDocument()
    expect(container.querySelectorAll('.search-group-friend-avatars .avatar')).toHaveLength(2)
    expect(container.querySelector('.search-group-result')).toHaveTextContent('groupPrivateVisibility')
    expect(container.querySelector('.search-group-result')).toHaveTextContent('membersCount:34')

    fireEvent.click(screen.getByRole('button', { name: 'joinGroup' }))
    await waitFor(() => expect(socialMocks.requestJoinGroup).toHaveBeenCalledWith('1', '20'))
    expect(await screen.findByRole('button', { name: 'joinRequested' })).toBeDisabled()
  })

  it('keeps Search group hits visible when optional friend previews are unavailable', async () => {
    searchMocks.search.mockResolvedValue({ ...empty('groups'), groups: [{ ...group, searchReferenceId: 'group-ref' }] })
    socialMocks.getGroupFriendMemberPreviews.mockRejectedValueOnce(new Error('preview schema unavailable'))

    render(<SearchPage query="builders" tab="groups" userId="1" onNavigate={vi.fn()} />)

    expect(await screen.findByText('Fakebook Builders')).toBeInTheDocument()
    expect(screen.queryByText('unableToLoad')).not.toBeInTheDocument()
  })

  it('renders searched reels through the same post card used by Home', async () => {
    searchMocks.search.mockResolvedValue({
      ...empty('reels'),
      reels: [{
        id: '90', type: 4, content: 'A reel', privacy: 1, createdAt: '2026-08-03', authorId: '2',
        media: [{ id: '91', type: 1, url: '/reel.mp4' }], aspectRatio: 0.5625, focalPointX: 0.4, focalPointY: 0.6,
        author: { id: '2', username: 'lan', displayName: 'Lan Nguyen', avatarUrl: '/lan.png', isVerified: true },
        searchReferenceId: 'reel-ref',
      }],
    })

    render(<SearchPage query="reel" tab="reels" userId="1" onNavigate={vi.fn()} />)

    const card = await screen.findByTestId('gateway-search-post')
    expect(card).toHaveAttribute('data-id', '90')
    expect(card).toHaveAttribute('data-type', 'ReelDetail')
    expect(card).toHaveTextContent('Lan Nguyen')
  })
})

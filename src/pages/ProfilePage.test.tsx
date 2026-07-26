// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const socialMocks = vi.hoisted(() => ({
  getProfilePosts: vi.fn(),
  getProfileRelationshipState: vi.fn(),
  getRelationProfiles: vi.fn(),
  getFriendProfilesWithMutualCounts: vi.fn(),
  getProfileConnections: vi.fn(),
  getUserPhotos: vi.fn(),
  getMyFeedPhotoCandidates: vi.fn(),
  getProfileReels: vi.fn(),
  getContentViewCounts: vi.fn(),
  getSavedContent: vi.fn(),
  getMemberGroups: vi.fn(),
  changeUserAvatar: vi.fn(),
  changeUserBackground: vi.fn(),
  sendFriendRequest: vi.fn(),
  unfriend: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  blockUser: vi.fn(),
}))
const apiMocks = vi.hoisted(() => ({ myStories: vi.fn(), uploadMediaFiles: vi.fn(), cancelPendingMedia: vi.fn() }))
const searchMocks = vi.hoisted(() => ({ searchProfileConnections: vi.fn() }))

vi.mock('../api/social', () => ({
  socialApi: {
    ...socialMocks,
    cancelFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    unblockUser: vi.fn(),
  },
}))
vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/search', () => ({ searchApi: searchMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en' }) }))
vi.mock('../components/ImageCropModal', () => ({ ImageCropModal: ({ file, onConfirm }: { file: File; onConfirm: (original: File, cropped: File) => Promise<void> | void }) => <button type="button" onClick={() => void onConfirm(file, new File(['cropped'], 'cover-cropped.jpg', { type: 'image/jpeg' }))}>confirmCoverCrop</button> }))
vi.mock('./GatewayHomePage', () => ({ GatewayPostCard: () => null, PostComposer: ({ triggerOnly, externalOpenRequest }: { triggerOnly?: boolean; externalOpenRequest?: number }) => <div data-testid="profile-post-composer" data-trigger-only={triggerOnly ? 'true' : 'false'} data-open-request={externalOpenRequest ?? 0} /> }))

describe('ProfilePage messaging', () => {
  beforeEach(() => {
    localStorage.clear()
    socialMocks.getProfilePosts.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({
      friendship: 'friend',
      isFollowing: false,
      followsViewer: false,
      isBlocked: false,
      isBlockedBy: false,
    })
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([])
    socialMocks.getFriendProfilesWithMutualCounts.mockReset().mockResolvedValue([])
    socialMocks.getProfileConnections.mockReset().mockResolvedValue([])
    socialMocks.getUserPhotos.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getMyFeedPhotoCandidates.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getProfileReels.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getContentViewCounts.mockReset().mockResolvedValue({})
    socialMocks.getSavedContent.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getMemberGroups.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.changeUserAvatar.mockReset().mockResolvedValue(null)
    socialMocks.changeUserBackground.mockReset()
    socialMocks.sendFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.unfriend.mockReset().mockResolvedValue(true)
    socialMocks.followUser.mockReset().mockResolvedValue(true)
    socialMocks.unfollowUser.mockReset().mockResolvedValue(true)
    socialMocks.blockUser.mockReset().mockResolvedValue(true)
    searchMocks.searchProfileConnections.mockReset().mockResolvedValue([])
    apiMocks.myStories.mockReset().mockResolvedValue(null)
    apiMocks.uploadMediaFiles.mockReset()
    apiMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it('opens the idempotent direct-message flow from a friend profile', async () => {
    const onMessage = vi.fn().mockResolvedValue(undefined)
    render(<ProfilePage
      profile={{
        id: 'friend-1',
        username: 'lan',
        email: 'lan@example.com',
        displayName: 'Lan Nguyen',
        avatarUrl: null,
        backgroundUrl: null,
        bio: null,
        location: null,
        birthDate: null,
        gender: null,
        createdAt: '2026-01-01T00:00:00Z',
        privacy: 0,
        isVerified: false,
        friendCount: 1,
        postCount: 0,
        followerCount: 2,
        followingCount: 3,
      }}
      loading={false}
      error={null}
      canEdit={false}
      viewerId="me"
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onMessage={onMessage}
    />)

    const messageButton = await screen.findByRole('button', { name: /messageUser/ })
    fireEvent.click(messageButton)
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith('friend-1'))
  })

  it('uses the owner-only profile layout with live friend, photo, story and composer data', async () => {
    socialMocks.getFriendProfilesWithMutualCounts.mockResolvedValue([{
      profile: {
        id: 'friend-1', username: 'lan', email: '', displayName: 'Lan Nguyen', avatarUrl: null, backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
        friendCount: 2, postCount: 0, followerCount: 0, followingCount: 0,
      },
      mutualFriendCount: 3,
    }])
    socialMocks.getUserPhotos.mockResolvedValue({
      items: [{ media: { id: 'media-1', type: 0, url: '/media/profile-photo.jpg' }, contentId: 'post-1', contentType: 1, createdAt: '', authorId: 'me', groupId: null }],
      endCursor: null,
      hasNextPage: false,
    })
    apiMocks.myStories.mockResolvedValue({
      author: { id: 'me', name: 'Owner', avatar: '', isVerified: false }, latestCreate: '2026-07-21T10:00:00Z', hasUnseen: false,
      stories: [{ __typename: 'NormalStory', id: 'story-1', content: '', create: '2026-07-21T10:00:00Z', media: [{ id: 'story-media', type: 0, url: '/media/story.jpg' }] }],
    })
    socialMocks.getMemberGroups.mockResolvedValue({
      items: [{ id: 'group-1', avatarUrl: null, backgroundUrl: null, name: 'Fakebook Builders', bio: null, privacy: 0, createdAt: '', memberCount: 12, adminCount: 1 }],
      endCursor: null,
      hasNextPage: false,
    })
    const onEdit = vi.fn()
    const onNavigate = vi.fn()
    const { container, unmount } = render(<ProfilePage
      profile={{
        id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
        backgroundUrl: null, bio: 'Owner bio', location: 'Ha Noi', birthDate: '2000-01-01', gender: 'male',
        createdAt: '2026-01-01T00:00:00Z', privacy: 0, isVerified: true, friendCount: 1, postCount: 0,
        followerCount: 2, followingCount: 3,
      }}
      loading={false}
      error={null}
      canEdit
      viewerId="me"
      onEdit={onEdit}
      onNavigate={onNavigate}
      onMessage={vi.fn()}
    />)

    const coverButton = screen.getByRole('button', { name: 'profileAddCover' })
    expect(coverButton).toBeInTheDocument()
    const addStoryButton = screen.getByRole('button', { name: 'profileAddStory' })
    expect(addStoryButton).toBeInTheDocument()
    expect(addStoryButton.querySelector('.self-profile-add-story-icon')).toHaveAttribute('stroke-linecap', 'round')
    expect(screen.getByTestId('profile-post-composer')).toBeInTheDocument()
    expect(screen.getByText('profilePersonalInfo')).toBeInTheDocument()
    expect(screen.getByText('profileContactInfo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'profileAddFeatured' })).toBeInTheDocument()
    expect(screen.getByText('profilePhotoStat')).toBeInTheDocument()
    const introCard = container.querySelector('.self-profile-intro-card')!
    expect(introCard.querySelectorAll('.self-profile-info-icon')).toHaveLength(4)
    expect(introCard.querySelectorAll('.self-profile-info-edit-icon')).toHaveLength(2)
    expect(introCard.querySelector('time')).toHaveAttribute('datetime', '2000-01-01')
    expect(introCard.querySelector('time')).toHaveTextContent('2000')
    expect(introCard).toHaveTextContent('genderMale')
    expect(introCard).not.toHaveTextContent('genderLabel')
    expect(introCard.querySelector('.self-profile-gender-icon')).toHaveClass('male')
    expect(introCard.querySelector('.self-profile-gender-icon')?.closest('p')).toHaveClass('prominent')
    expect(introCard.querySelector('.self-profile-zodiac-icon')).toHaveAttribute('data-zodiac', 'capricorn')
    expect(introCard).not.toHaveTextContent('followingCount')
    expect(introCard.querySelector('a')).toHaveAttribute('href', 'mailto:owner@example.com')
    expect(introCard.querySelector('a')).toHaveTextContent('owner@example.com')
    expect(await screen.findByText('Lan Nguyen')).toBeInTheDocument()
    expect(screen.getByText('mutualFriendsCount')).toBeInTheDocument()
    expect(document.querySelector('.self-profile-photo-preview img')).toHaveAttribute('src', '/media/profile-photo.jpg')
    expect(document.querySelector('.self-profile-featured-list img')).toHaveAttribute('src', '/media/story.jpg')
    const profileTitle = container.querySelector('.profile-destination-title')!
    expect(profileTitle).toHaveTextContent('profileFriendStat')
    expect(profileTitle).toHaveTextContent('profileFollowerStat')
    expect(profileTitle).toHaveTextContent('profileFollowingStat')
    expect(profileTitle).toHaveTextContent('Owner bio')
    expect(profileTitle).toHaveTextContent('Ha Noi')
    expect(profileTitle).not.toHaveTextContent('@owner')
    expect(profileTitle.querySelectorAll('.self-profile-detail-line > svg')).toHaveLength(2)
    expect(profileTitle.querySelector('.self-profile-bio-icon')).toBeInTheDocument()
    expect(profileTitle.querySelectorAll('.self-profile-summary-icon')).toHaveLength(2)
    expect(container.querySelector('.self-profile-avatar-wrap')).toHaveClass('has-story')
    expect(document.documentElement).toHaveClass('profile-page-scroll')
    expect(document.body).toHaveClass('profile-page-scroll')
    expect(screen.getByRole('button', { name: 'profileEditAvatar' }).querySelector('.self-profile-cover-camera-icon')).toBeInTheDocument()
    expect(container.querySelectorAll('.self-profile-header-actions > button')).toHaveLength(3)
    expect(container.querySelector('.self-profile-header-chevron')).toHaveAttribute('aria-label', 'more')
    expect(container.querySelector('.self-profile-header-actions > details')).not.toBeInTheDocument()
    const postTools = container.querySelector('.self-profile-post-tools')!
    expect(postTools.querySelector('.profile-post-filter-icon')).toBeInTheDocument()
    expect(postTools.querySelector('.profile-post-manage-icon')).toBeInTheDocument()
    const postViewButtons = Array.from(postTools.querySelectorAll<HTMLButtonElement>('.self-profile-post-view-tabs > button'))
    expect(postViewButtons).toHaveLength(2)
    expect(postViewButtons[0].querySelector('.profile-post-list-icon')).toBeInTheDocument()
    expect(postViewButtons[1].querySelector('.profile-post-grid-icon')).toBeInTheDocument()
    expect(postViewButtons[0]).toHaveClass('active')
    fireEvent.click(postViewButtons[1])
    expect(postViewButtons[1]).toHaveClass('active')
    expect(postViewButtons[0]).not.toHaveClass('active')
    fireEvent.click(postViewButtons[0])
    const profileTabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.self-profile-tab-option'))
    expect(profileTabs.map((button) => button.textContent)).toEqual(['profileTabAll', 'profileTabAbout', 'profileTabPhotos', 'profileTabFriends', 'profileTabReels', 'profileTabGroups'])
    expect(profileTabs[0]).toHaveClass('active')
    const profileTabMore = container.querySelector<HTMLButtonElement>('.self-profile-tab-more')!
    fireEvent.click(profileTabMore)
    expect(profileTabs[0]).toHaveClass('active')
    expect(onNavigate).not.toHaveBeenCalled()

    fireEvent.click(profileTabs[5])
    expect(await screen.findByText('Fakebook Builders')).toBeInTheDocument()
    expect(socialMocks.getMemberGroups).toHaveBeenCalledWith('me', 60)

    fireEvent.click(coverButton)
    expect(screen.getByRole('menuitem', { name: 'profileChooseCover' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'profileUploadCover' })).toBeInTheDocument()
    expect(onEdit).not.toHaveBeenCalled()
    unmount()
    expect(document.documentElement).not.toHaveClass('profile-page-scroll')
    expect(document.body).not.toHaveClass('profile-page-scroll')
  })

  it('falls back to the existing friend-profile query while a gateway is still on the previous schema', async () => {
    socialMocks.getFriendProfilesWithMutualCounts.mockRejectedValue(new Error('Unknown field'))
    socialMocks.getRelationProfiles.mockResolvedValue([{
      id: 'friend-fallback', username: 'fallback', email: '', displayName: 'Fallback Friend', avatarUrl: null, backgroundUrl: null,
      bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
      friendCount: 0, postCount: 0, followerCount: 0, followingCount: 0,
    }])

    render(<ProfilePage
      profile={{
        id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner', avatarUrl: null, backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
        friendCount: 1, postCount: 0, followerCount: 0, followingCount: 0,
      }}
      loading={false}
      error={null}
      canEdit
      viewerId="me"
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onMessage={vi.fn()}
    />)

    expect(await screen.findByText('Fallback Friend')).toBeInTheDocument()
    expect(socialMocks.getRelationProfiles).toHaveBeenCalledWith('me', 0, 100)
  })

  it('renders the owner photo, connection and reel collections with their requested controls', async () => {
    const friendProfile = {
      id: 'friend-1', username: 'friend', email: '', displayName: 'Friend One', avatarUrl: '/friend.jpg', backgroundUrl: null,
      bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
      friendCount: 2, postCount: 0, followerCount: 0, followingCount: 0,
    }
    const videoPost = {
      __typename: 'FeedPostDetail' as const,
      id: 'post-video', type: 1, content: '', privacy: 0, create: '2026-07-24T12:00:00Z',
      author: { id: 'me', name: 'Owner', avatar: '', isVerified: false, canFollow: false },
      media: [{ id: 'video-media', type: 1, url: '/video.mp4' }], mentions: [], taggedUsers: [], sharedSource: null,
    }
    socialMocks.getProfilePosts.mockResolvedValue({ items: [videoPost], endCursor: null, hasNextPage: false })
    socialMocks.getUserPhotos.mockResolvedValue({
      items: [{ media: { id: 'photo-media', type: 0, url: '/photo.jpg' }, contentId: 'photo-post', contentType: 1, createdAt: '2026-07-24T13:00:00Z', authorId: 'me', groupId: null }],
      endCursor: null,
      hasNextPage: false,
    })
    socialMocks.getProfileReels.mockResolvedValue({
      items: [{ id: 'reel-1', type: 4, content: '', privacy: 0, createdAt: '2026-07-24T11:00:00Z', authorId: 'me', media: [{ id: 'reel-media', type: 1, url: '/reel.mp4' }] }],
      endCursor: null,
      hasNextPage: false,
    })
    socialMocks.getContentViewCounts.mockResolvedValue({ 'reel-1': 12 })
    socialMocks.getProfileConnections.mockResolvedValue([{ profile: friendProfile, mutualFriendCount: 2 }])
    searchMocks.searchProfileConnections.mockResolvedValue([friendProfile])

    const { container } = render(<ProfilePage
      profile={{
        id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner', avatarUrl: null, backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
        friendCount: 1, postCount: 1, followerCount: 1, followingCount: 1,
      }}
      loading={false}
      error={null}
      canEdit
      viewerId="me"
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onMessage={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'profileTabPhotos' }))
    expect(await screen.findByText('profileMediaAll')).toBeInTheDocument()
    expect(screen.getByText('videos')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'edit' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'edit' }))
    expect(screen.getByRole('menuitem', { name: /profileSetAsAvatar/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /profileSetAsCover/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /profileSetAsAvatar/ }))
    await waitFor(() => expect(socialMocks.changeUserAvatar).toHaveBeenCalledWith('me', '/photo.jpg', null, 0))
    fireEvent.click(screen.getByRole('button', { name: 'profileAddPhotoVideo' }))
    expect(container.querySelector('[data-testid="profile-post-composer"][data-trigger-only="true"]')).toHaveAttribute('data-open-request', '1')

    fireEvent.click(screen.getByRole('button', { name: 'profileTabFriends' }))
    expect(await screen.findByText('profileAllFriends')).toBeInTheDocument()
    expect(screen.getByText('following')).toBeInTheDocument()
    expect(screen.getByText('profileFollowers')).toBeInTheDocument()
    const search = screen.getByPlaceholderText('search')
    fireEvent.change(search, { target: { value: 'F' } })
    await waitFor(() => expect(searchMocks.searchProfileConnections).toHaveBeenCalledWith('friends', 'F', 1, 100))
    expect(screen.getByText('mutualFriendsCount')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'profileTabReels' }))
    expect(await screen.findByText('profileYourReels')).toBeInTheDocument()
    expect(screen.getByText('profileSavedReels')).toBeInTheDocument()
    expect(await screen.findByText('12')).toBeInTheDocument()
  })

  it('runs friend, following and follower actions from the profile connection cards', async () => {
    const connectionProfile = (id: string, name: string) => ({
      id, username: id, email: '', displayName: name, avatarUrl: null, backgroundUrl: null,
      bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
      friendCount: 0, postCount: 0, followerCount: 0, followingCount: 0,
    })
    socialMocks.getProfileConnections.mockImplementation(async (_userId: string, type: string) => {
      if (type === 'following') return [{ profile: connectionProfile('following-1', 'Following User'), mutualFriendCount: 0 }]
      if (type === 'followers') return [
        { profile: connectionProfile('follower-1', 'Follower One'), mutualFriendCount: 0 },
        { profile: connectionProfile('follower-2', 'Follower Two'), mutualFriendCount: 0 },
      ]
      return [
        { profile: connectionProfile('friend-1', 'Friend One'), mutualFriendCount: 1 },
        { profile: connectionProfile('friend-2', 'Friend Two'), mutualFriendCount: 0 },
      ]
    })

    const { container } = render(<ProfilePage
      profile={{
        id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner', avatarUrl: null, backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
        friendCount: 2, postCount: 0, followerCount: 2, followingCount: 1,
      }}
      loading={false}
      error={null}
      canEdit
      viewerId="me"
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onMessage={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'profileTabFriends' }))
    expect(await screen.findByText('Friend One')).toBeInTheDocument()
    const friendOne = screen.getByText('Friend One').closest('article')!
    fireEvent.click(within(friendOne).getByRole('button', { name: 'more' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /removeFriend/ }))
    await waitFor(() => expect(socialMocks.unfriend).toHaveBeenCalledWith('me', 'friend-1'))
    await waitFor(() => expect(screen.queryByText('Friend One')).not.toBeInTheDocument())

    const card = container.querySelector<HTMLElement>('.self-profile-connections-tab')!
    fireEvent.click(within(card).getByRole('button', { name: 'following' }))
    expect(await screen.findByText('Following User')).toBeInTheDocument()
    const followingRow = screen.getByText('Following User').closest('article')!
    const followToggle = followingRow.querySelector<HTMLButtonElement>('.self-profile-follow-toggle')!
    fireEvent.click(followToggle)
    await waitFor(() => expect(socialMocks.unfollowUser).toHaveBeenCalledWith('me', 'following-1'))
    expect(followToggle).toHaveTextContent('follow')
    fireEvent.click(followToggle)
    await waitFor(() => expect(socialMocks.followUser).toHaveBeenCalledWith('me', 'following-1'))
    expect(followToggle).toHaveTextContent('following')

    fireEvent.click(within(card).getByRole('button', { name: 'profileFollowers' }))
    expect(await screen.findByText('Follower One')).toBeInTheDocument()
    const followerOne = screen.getByText('Follower One').closest('article')!
    fireEvent.click(within(followerOne).getByRole('button', { name: 'more' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /addFriend/ }))
    await waitFor(() => expect(socialMocks.sendFriendRequest).toHaveBeenCalledWith('me', 'follower-1'))
    fireEvent.click(within(followerOne).getByRole('button', { name: 'more' }))
    expect(screen.getByRole('menuitem', { name: /requestSent/ })).toBeDisabled()

    const followerTwo = screen.getByText('Follower Two').closest('article')!
    fireEvent.click(within(followerTwo).getByRole('button', { name: 'more' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /block/ }))
    await waitFor(() => expect(socialMocks.blockUser).toHaveBeenCalledWith('me', 'follower-2'))
    await waitFor(() => expect(screen.queryByText('Follower Two')).not.toBeInTheDocument())
  })

  it('uploads, crops and publishes a cover directly from the profile menu', async () => {
    const profile = {
      id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
      backgroundUrl: null, bio: null, location: null, birthDate: null, gender: null,
      createdAt: '2026-01-01T00:00:00Z', privacy: 0, isVerified: false, friendCount: 0, postCount: 0,
      followerCount: 0, followingCount: 0,
    }
    const updated = { ...profile, backgroundUrl: '/media/cover-cropped.jpg' }
    apiMocks.uploadMediaFiles.mockResolvedValue([
      { url: '/media/cover-original.jpg', type: 'image', contentType: 'image/jpeg', size: 8, name: 'cover.jpg' },
      { url: '/media/cover-cropped.jpg', type: 'image', contentType: 'image/jpeg', size: 7, name: 'cover-cropped.jpg' },
    ])
    socialMocks.changeUserBackground.mockResolvedValue(updated)
    const profileUpdated = vi.fn()
    window.addEventListener('fakebook:profile-updated', profileUpdated)
    const { container } = render(<ProfilePage profile={profile} loading={false} error={null} canEdit viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()} />)
    expect(container.querySelector('.self-profile-stats')).not.toBeInTheDocument()
    expect(container.querySelector('.self-profile-avatar-wrap')).not.toHaveClass('has-story')
    expect(container.querySelector('.self-profile-avatar-wrap')).toHaveClass('no-story')

    fireEvent.click(screen.getByRole('button', { name: 'profileAddCover' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'profileUploadCover' }))
    const original = new File(['original'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(container.querySelector<HTMLInputElement>('.self-profile-cover-file-input')!, { target: { files: [original] } })
    fireEvent.click(await screen.findByRole('button', { name: 'confirmCoverCrop' }))

    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalled())
    expect(apiMocks.uploadMediaFiles.mock.calls[0][0][0]).toBe(original)
    await waitFor(() => expect(socialMocks.changeUserBackground).toHaveBeenCalledWith('me', '/media/cover-cropped.jpg', '/media/cover-original.jpg', 0))
    expect(profileUpdated).toHaveBeenCalled()
    expect(apiMocks.cancelPendingMedia).not.toHaveBeenCalled()
    window.removeEventListener('fakebook:profile-updated', profileUpdated)
  })

  it('scrolls both owner-profile columns together and clamps the shorter column at its end', async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight')
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('scrollY', 800)
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1600 })
    const { container, unmount } = render(<ProfilePage
      profile={{
        id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
        backgroundUrl: null, bio: null, location: null, birthDate: null, gender: null,
        createdAt: '2026-01-01T00:00:00Z', privacy: 0, isVerified: false, friendCount: 0, postCount: 0,
        followerCount: 0, followingCount: 0,
      }}
      loading={false}
      error={null}
      canEdit
      viewerId="me"
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onMessage={vi.fn()}
    />)
    const grid = container.querySelector<HTMLElement>('.self-profile-destination-grid.tab-posts')!
    const infoColumn = container.querySelector<HTMLElement>('.self-profile-left-column')!
    const postColumn = container.querySelector<HTMLElement>('.profile-post-list')!
    Object.defineProperties(infoColumn, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1000 },
    })
    Object.defineProperties(postColumn, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 2000 },
    })
    infoColumn.scrollTop = 400
    postColumn.scrollTop = 300

    fireEvent.wheel(grid, { deltaY: 250 })
    await waitFor(() => {
      expect(infoColumn.scrollTop).toBe(500)
      expect(postColumn.scrollTop).toBeCloseTo(550, 1)
    })

    fireEvent.wheel(grid, { deltaY: 250 })
    await waitFor(() => {
      expect(infoColumn.scrollTop).toBe(500)
      expect(postColumn.scrollTop).toBeCloseTo(800, 1)
    })

    unmount()
    if (scrollHeightDescriptor) Object.defineProperty(document.documentElement, 'scrollHeight', scrollHeightDescriptor)
    else Reflect.deleteProperty(document.documentElement, 'scrollHeight')
    vi.unstubAllGlobals()
  })
})

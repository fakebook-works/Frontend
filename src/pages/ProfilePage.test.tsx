// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const socialMocks = vi.hoisted(() => ({
  getProfilePosts: vi.fn(),
  getProfileAvatarSource: vi.fn(),
  getProfileRelationshipState: vi.fn(),
  getRelationProfiles: vi.fn(),
  getFriendProfilesWithMutualCounts: vi.fn(),
  getProfileFriends: vi.fn(),
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
  cancelFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  unfriend: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}))
const apiMocks = vi.hoisted(() => ({
  myStories: vi.fn(),
  homeStories: vi.fn(),
  postDetail: vi.fn(),
  uploadMediaFiles: vi.fn(),
  cancelPendingMedia: vi.fn(),
}))
const searchMocks = vi.hoisted(() => ({ searchProfileConnections: vi.fn() }))
const cropMocks = vi.hoisted(() => ({ cropImageFile: vi.fn() }))
const i18nMocks = vi.hoisted(() => ({ t: (key: string) => key, locale: 'en' }))

vi.mock('../api/social', () => ({
  socialApi: {
    ...socialMocks,
  },
}))
vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/search', () => ({ searchApi: searchMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: i18nMocks.t, locale: i18nMocks.locale }) }))
vi.mock('../lib/imageCrop', () => ({ cropImageFile: cropMocks.cropImageFile }))
vi.mock('./GatewayHomePage', () => ({ GatewayPostCard: () => null, PostComposer: ({ triggerOnly, externalOpenRequest }: { triggerOnly?: boolean; externalOpenRequest?: number }) => <div data-testid="profile-post-composer" data-trigger-only={triggerOnly ? 'true' : 'false'} data-open-request={externalOpenRequest ?? 0} /> }))
vi.mock('../components/StoryViewerPage', () => ({
  StoryViewerPage: ({ buckets, initialBucketId, onViewed }: { buckets: Array<{ author: { id: string }; stories: Array<{ id: string }> }>; initialBucketId: string; onViewed?: (storyId: string) => void }) => <div data-testid="profile-story-viewer" data-initial-bucket={initialBucketId} data-bucket-order={buckets.map((bucket) => bucket.author.id).join(',')}><button type="button" onClick={() => onViewed?.(buckets[0]?.stories[0]?.id ?? '')}>mark-first-story-viewed</button>{buckets[0]?.stories[1] && <button type="button" onClick={() => onViewed?.(buckets[0].stories[1].id)}>mark-second-story-viewed</button>}</div>,
}))
vi.mock('../components/PostPhotoViewer', () => ({
  PostPhotoViewer: ({ contentId, initialMediaId }: { contentId: string; initialMediaId: string }) => (
    <div data-testid="profile-photo-viewer" data-content-id={contentId} data-media-id={initialMediaId} />
  ),
}))
vi.mock('../components/ContentActions', () => ({
  ContentDetailOverlay: ({ contentId, onClose }: { contentId: string; onClose: () => void }) => (
    <div data-testid="profile-content-detail" data-content-id={contentId}><button type="button" onClick={onClose}>close-profile-detail</button></div>
  ),
}))

describe('ProfilePage messaging', () => {
  beforeEach(() => {
    i18nMocks.locale = 'en'
    localStorage.clear()
    sessionStorage.clear()
    socialMocks.getProfilePosts.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getProfileAvatarSource.mockReset().mockResolvedValue(null)
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({
      friendship: 'friend',
      isFollowing: false,
      followsViewer: false,
      isBlocked: false,
      isBlockedBy: false,
    })
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([])
    socialMocks.getFriendProfilesWithMutualCounts.mockReset().mockResolvedValue([])
    socialMocks.getProfileFriends.mockReset().mockResolvedValue([])
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
    socialMocks.cancelFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.acceptFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.rejectFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.unfriend.mockReset().mockResolvedValue(true)
    socialMocks.followUser.mockReset().mockResolvedValue(true)
    socialMocks.unfollowUser.mockReset().mockResolvedValue(true)
    socialMocks.blockUser.mockReset().mockResolvedValue(true)
    socialMocks.unblockUser.mockReset().mockResolvedValue(true)
    searchMocks.searchProfileConnections.mockReset().mockResolvedValue([])
    apiMocks.myStories.mockReset().mockResolvedValue(null)
    apiMocks.homeStories.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    apiMocks.postDetail.mockReset().mockResolvedValue(null)
    apiMocks.uploadMediaFiles.mockReset()
    apiMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
    cropMocks.cropImageFile.mockReset().mockResolvedValue(new File(['cropped'], 'cover-cropped.jpg', { type: 'image/jpeg' }))
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:cover-preview') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  afterEach(() => cleanup())

  it('shows a stable profile-shaped skeleton while either owner or visitor data is loading', () => {
    const { container, rerender } = render(<ProfilePage profile={null} loading error={null} canEdit viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()} />)
    const ownerSkeleton = container.querySelector('.profile-page-skeleton')!
    expect(ownerSkeleton).toHaveAttribute('aria-busy', 'true')
    expect(ownerSkeleton.querySelector('.profile-skeleton-cover')).toBeInTheDocument()
    expect(ownerSkeleton.querySelector('.profile-skeleton-avatar')).toBeInTheDocument()
    expect(ownerSkeleton.querySelector('.profile-skeleton-left')).toBeInTheDocument()
    expect(ownerSkeleton.querySelector('.profile-skeleton-posts')).toBeInTheDocument()
    expect(ownerSkeleton.querySelector('.spinner')).not.toBeInTheDocument()

    rerender(<ProfilePage profile={null} loading error={null} canEdit={false} viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()} />)
    expect(container.querySelector('.profile-page-skeleton')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.profile-skeleton-tools')).toBeInTheDocument()
  })

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

  it('reuses the owner profile shell while hiding every private editing control for a visitor', async () => {
    socialMocks.getProfileRelationshipState.mockResolvedValue({
      friendship: 'none',
      isFollowing: false,
      followsViewer: true,
      isBlocked: false,
      isBlockedBy: false,
    })
    socialMocks.getProfileFriends.mockResolvedValue([{
      profile: {
        id: 'visible-friend', username: 'visible-friend', email: '', displayName: 'Visible Friend', avatarUrl: '/friend.jpg',
        backgroundUrl: null, bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0,
        isVerified: false, friendCount: 0, postCount: 0, followerCount: 0, followingCount: 0,
      },
      mutualFriendCount: 2,
    }])
    const { container } = render(<ProfilePage
      profile={{
        id: 'creator-1', username: 'creator', email: 'creator@example.com', displayName: 'Creator Name', avatarUrl: '/creator.jpg',
        backgroundUrl: '/cover.jpg', bio: 'Creator bio', location: 'Ha Noi', birthDate: '2000-01-01', gender: 'female',
        createdAt: '2026-01-01T00:00:00Z', privacy: 1, isVerified: true, friendCount: 4, postCount: 2,
        followerCount: 8, followingCount: 3,
      }}
      loading={false}
      error={null}
      canEdit={false}
      viewerId="me"
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onMessage={vi.fn()}
    />)

    await screen.findByRole('button', { name: 'profileAddFriend' })
    expect(container.querySelector('.profile-destination')).toHaveClass('self-profile-page', 'visitor-profile-page')
    expect(container.querySelector('.self-profile-cover-ambient')).toBeInTheDocument()
    expect(container.querySelector('.self-profile-avatar-wrap')).toBeInTheDocument()
    expect(container.querySelector('.profile-destination-title')).toHaveTextContent('profileFriendStat')
    expect(container.querySelector('.profile-destination-title')).toHaveTextContent('profileFollowerStat')
    expect(container.querySelector('.profile-destination-title')).toHaveTextContent('Creator bio')
    expect(screen.getByText('followsYou')).toBeInTheDocument()
    expect(Array.from(container.querySelectorAll('.self-profile-tab-option')).map((button) => button.textContent)).toEqual([
      'profileTabAll', 'profileTabAbout', 'profileTabPhotos', 'profileTabFriends', 'profileTabReels', 'profileTabGroups',
    ])
    expect(screen.queryByRole('button', { name: 'profileEditAvatar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'profileEditCover' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'profileAddStory' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'profileEditPage' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('profile-post-composer')).not.toBeInTheDocument()
    const visitorPostTools = container.querySelector<HTMLElement>('.self-profile-post-tools')!
    expect(visitorPostTools).toBeInTheDocument()
    expect(within(visitorPostTools).getByText('profilePostFilters')).toBeInTheDocument()
    expect(within(visitorPostTools).getByText('profileListView')).toBeInTheDocument()
    expect(within(visitorPostTools).getByText('profileGridView')).toBeInTheDocument()
    expect(within(visitorPostTools).queryByText('profileManagePosts')).not.toBeInTheDocument()
    expect(container.querySelector('.self-profile-info-edit-icon')).not.toBeInTheDocument()
    expect(container.querySelector('.self-profile-intro-card')).toBeInTheDocument()
    expect(screen.getByText('profileContactInfo')).toBeInTheDocument()
    expect(container.querySelector('a[href="mailto:creator@example.com"]')).toBeInTheDocument()
    expect(container.querySelector('.self-profile-friends-card')).toBeInTheDocument()
    expect(await screen.findByText('Visible Friend')).toBeInTheDocument()
    expect(screen.getByText('mutualFriendsCount')).toBeInTheDocument()
    expect(socialMocks.getProfileFriends).toHaveBeenCalledWith('creator-1', 100)

    fireEvent.click(screen.getByRole('button', { name: 'profileTabFriends' }))
    expect(await screen.findByText('Visible Friend')).toBeInTheDocument()
    expect(socialMocks.getProfileFriends).toHaveBeenCalledWith('creator-1', 200)
    expect(searchMocks.searchProfileConnections).not.toHaveBeenCalled()
  })

  it('shows a blue story ring for an unseen friend bucket, opens that friend first and turns gray only after every new card is viewed', async () => {
    apiMocks.homeStories.mockResolvedValue({
      items: [
        {
          author: { id: 'friend-1', name: 'Lan Nguyen', avatar: '/friend.jpg', isVerified: false },
          latestCreate: '2026-07-29T02:00:00Z',
          hasUnseen: true,
          unseenCount: 2,
          stories: [
            { __typename: 'NormalStory', id: 'story-a', content: '', create: '2026-07-29T02:00:00Z', media: [{ id: 'media-a', type: 0, url: '/story-a.jpg' }] },
            { __typename: 'NormalStory', id: 'story-b', content: '', create: '2026-07-29T01:00:00Z', media: [{ id: 'media-b', type: 0, url: '/story-b.jpg' }] },
          ],
        },
        {
          author: { id: 'friend-2', name: 'Minh', avatar: '/friend-2.jpg', isVerified: false },
          latestCreate: '2026-07-29T00:00:00Z',
          hasUnseen: false,
          unseenCount: 0,
          stories: [{ __typename: 'NormalStory', id: 'story-c', content: '', create: '2026-07-29T00:00:00Z', media: [{ id: 'media-c', type: 0, url: '/story-c.jpg' }] }],
        },
      ],
      endCursor: null,
      hasNextPage: false,
    })
    const { container } = render(<ProfilePage
      profile={{
        id: 'friend-1', username: 'lan', email: 'lan@example.com', displayName: 'Lan Nguyen', avatarUrl: '/friend.jpg', backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
        friendCount: 1, postCount: 0, followerCount: 0, followingCount: 0,
      }}
      loading={false} error={null} canEdit={false} viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()}
    />)

    const avatarWrap = container.querySelector('.self-profile-avatar-wrap')!
    await waitFor(() => expect(avatarWrap).toHaveClass('has-unseen-story'))
    fireEvent.click(screen.getByRole('button', { name: 'profileAvatarOptions' }))
    expect(screen.getByRole('menuitem', { name: 'profileViewStory' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'profileViewAvatar' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'profileChooseAvatar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'profileViewStory' }))

    const viewer = await screen.findByTestId('profile-story-viewer')
    expect(viewer).toHaveAttribute('data-initial-bucket', 'friend-1')
    expect(viewer).toHaveAttribute('data-bucket-order', 'friend-1,friend-2')
    fireEvent.click(screen.getByRole('button', { name: 'mark-first-story-viewed' }))
    expect(avatarWrap).toHaveClass('has-unseen-story')
    fireEvent.click(screen.getByRole('button', { name: 'mark-second-story-viewed' }))
    await waitFor(() => expect(avatarWrap).toHaveClass('has-seen-story'))
  })

  it('does not expose a story ring or story action for an unrelated profile', async () => {
    socialMocks.getProfileRelationshipState.mockResolvedValue({
      friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false,
    })
    const { container } = render(<ProfilePage
      profile={{
        id: 'stranger-1', username: 'stranger', email: '', displayName: 'Stranger', avatarUrl: '/stranger.jpg', backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
        friendCount: 0, postCount: 0, followerCount: 0, followingCount: 0,
      }}
      loading={false} error={null} canEdit={false} viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()}
    />)

    await screen.findByRole('button', { name: 'profileAddFriend' })
    const avatarWrap = container.querySelector('.self-profile-avatar-wrap')!
    expect(avatarWrap).toHaveClass('no-story')
    expect(avatarWrap).not.toHaveClass('has-unseen-story', 'has-seen-story')
    expect(apiMocks.homeStories).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'profileAvatarOptions' }))
    expect(screen.queryByRole('menuitem', { name: 'profileViewStory' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'profileViewAvatar' })).toBeInTheDocument()
  })

  it('opens the exact authorized avatar source instead of guessing by caption or URL', async () => {
    const contentId = '9007199254740993123'
    const mediaId = '9007199254740993124'
    socialMocks.getProfileAvatarSource.mockResolvedValue({ contentId, mediaId })
    apiMocks.postDetail.mockResolvedValue({
      __typename: 'FeedPostDetail',
      id: contentId,
      type: 2,
      content: 'caption may be changed freely',
      privacy: 0,
      create: '2026-07-29T10:00:00Z',
      author: { id: 'friend-1', name: 'Friend', avatar: '', isVerified: false, canFollow: false },
      media: [{ id: mediaId, type: 0, url: '/media/original-avatar.jpg' }],
      mentions: [],
      taggedUsers: [],
      sharedSource: null,
    })
    render(<ProfilePage
      profile={{
        id: 'friend-1', username: 'friend', email: '', displayName: 'Friend', avatarUrl: '/media/cropped-avatar.jpg',
        backgroundUrl: null, bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0,
        isVerified: false, friendCount: 0, postCount: 1, followerCount: 0, followingCount: 0,
      }}
      loading={false}
      error={null}
      canEdit={false}
      viewerId="me"
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onMessage={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'profileAvatarOptions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'profileViewAvatar' }))

    const viewer = await screen.findByTestId('profile-photo-viewer')
    expect(viewer).toHaveAttribute('data-content-id', contentId)
    expect(viewer).toHaveAttribute('data-media-id', mediaId)
    expect(socialMocks.getProfileAvatarSource).toHaveBeenCalledWith('friend-1')
    expect(apiMocks.postDetail).toHaveBeenCalledWith(contentId)
  })

  it('renders advanced-account follow, friend request and message states from the relationship contract', async () => {
    socialMocks.getProfileRelationshipState.mockResolvedValue({
      friendship: 'none', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false,
    })
    const onMessage = vi.fn().mockResolvedValue(undefined)
    render(<ProfilePage
      profile={{
        id: 'advanced-1', username: 'advanced', email: '', displayName: 'Advanced User', avatarUrl: null, backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 1, isVerified: false,
        friendCount: 0, postCount: 0, followerCount: 0, followingCount: 0,
      }}
      loading={false} error={null} canEdit={false} viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={onMessage}
    />)

    const followButton = await screen.findByRole('button', { name: 'follow' })
    const addFriendButton = screen.getByRole('button', { name: 'profileAddFriend' })
    const initialMessageButton = screen.getByRole('button', { name: 'messageUser' })
    expect(followButton).toHaveClass('btn-primary')
    expect(addFriendButton).toHaveClass('btn-primary')
    expect(initialMessageButton).toHaveClass('btn-soft')

    fireEvent.click(addFriendButton)
    await waitFor(() => expect(socialMocks.sendFriendRequest).toHaveBeenCalledWith('me', 'advanced-1'))
    const cancelButton = await screen.findByRole('button', { name: 'profileCancelRequest' })
    expect(cancelButton).toHaveClass('btn-soft')
    expect(screen.getByRole('button', { name: 'follow' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'messageUser' })).toHaveClass('btn-primary')

    fireEvent.click(cancelButton)
    await waitFor(() => expect(socialMocks.cancelFriendRequest).toHaveBeenCalledWith('me', 'advanced-1'))
    expect(await screen.findByRole('button', { name: 'profileAddFriend' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'follow' }))
    await waitFor(() => expect(socialMocks.followUser).toHaveBeenCalledWith('me', 'advanced-1'))
    const followingButton = await screen.findByRole('button', { name: 'following' })
    expect(followingButton).toHaveClass('btn-soft')
    expect(screen.getByRole('button', { name: 'profileAddFriend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'messageUser' })).toHaveClass('btn-primary')

    fireEvent.click(followingButton)
    const followingMenu = screen.getByRole('menu')
    expect(within(followingMenu).getByRole('menuitem', { name: /profileUnfollow/ })).toBeInTheDocument()
    expect(within(followingMenu).getByRole('menuitem', { name: /block/ })).toBeInTheDocument()
    fireEvent.click(within(followingMenu).getByRole('menuitem', { name: /profileUnfollow/ }))
    await waitFor(() => expect(socialMocks.unfollowUser).toHaveBeenCalledWith('me', 'advanced-1'))
  })

  it('hides follow for normal accounts and exposes friend and profile block menus', async () => {
    socialMocks.getProfileRelationshipState.mockResolvedValue({
      friendship: 'friend', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false,
    })
    const { container } = render(<ProfilePage
      profile={{
        id: 'normal-1', username: 'normal', email: '', displayName: 'Normal User', avatarUrl: null, backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
        friendCount: 1, postCount: 0, followerCount: 0, followingCount: 0,
      }}
      loading={false} error={null} canEdit={false} viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()}
    />)

    const friendButton = await screen.findByRole('button', { name: 'profileFriendsButton' })
    expect(friendButton).toHaveClass('btn-soft')
    expect(screen.getByRole('button', { name: 'messageUser' })).toHaveClass('btn-primary')
    expect(screen.queryByRole('button', { name: 'follow' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'following' })).not.toBeInTheDocument()

    fireEvent.click(friendButton)
    let menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /removeFriend/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /block/ })).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('menuitem', { name: /removeFriend/ }))
    await waitFor(() => expect(socialMocks.unfriend).toHaveBeenCalledWith('me', 'normal-1'))
    expect(await screen.findByRole('button', { name: 'profileAddFriend' })).toBeInTheDocument()

    const tabMore = container.querySelector<HTMLButtonElement>('.visitor-profile-tab-menu > .self-profile-tab-more')!
    fireEvent.click(tabMore)
    menu = screen.getByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem', { name: /block/ }))
    await waitFor(() => expect(socialMocks.blockUser).toHaveBeenCalledWith('me', 'normal-1'))
  })

  it('removes the following presentation as soon as an incoming request becomes a friendship', async () => {
    socialMocks.getProfileRelationshipState.mockResolvedValue({
      friendship: 'incoming', isFollowing: true, followsViewer: false, isBlocked: false, isBlockedBy: false,
    })
    render(<ProfilePage
      profile={{
        id: 'requester-1', username: 'requester', email: '', displayName: 'Requester', avatarUrl: null, backgroundUrl: null,
        bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 1, isVerified: false,
        friendCount: 0, postCount: 0, followerCount: 0, followingCount: 0,
      }}
      loading={false} error={null} canEdit={false} viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()}
    />)

    expect(await screen.findByRole('button', { name: 'following' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(socialMocks.acceptFriendRequest).toHaveBeenCalledWith('requester-1', 'me'))
    expect(await screen.findByRole('button', { name: 'profileFriendsButton' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'following' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'follow' })).not.toBeInTheDocument()
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
    expect(container.querySelector('.self-profile-avatar-wrap')).toHaveClass('has-seen-story')
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
    expect(screen.getByRole('menu').parentElement).toBe(document.body)
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
    await waitFor(() => expect(socialMocks.changeUserAvatar).toHaveBeenCalledWith(
      'me',
      '/photo.jpg',
      null,
      0,
      { contentId: 'photo-post', mediaId: 'photo-media' },
    ))
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

  it('previews, positions and publicly publishes an uploaded cover from the profile itself', async () => {
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
    expect(container.querySelector('.self-profile-avatar-wrap')).not.toHaveClass('has-unseen-story', 'has-seen-story')
    expect(container.querySelector('.self-profile-avatar-wrap')).toHaveClass('no-story')

    fireEvent.click(screen.getByRole('button', { name: 'profileAddCover' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'profileUploadCover' }))
    const original = new File(['original'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(container.querySelector<HTMLInputElement>('.self-profile-cover-file-input')!, { target: { files: [original] } })
    const preview = container.querySelector<HTMLElement>('.self-profile-cover-preview')!
    expect(preview).toBeInTheDocument()
    const previewImage = preview.querySelector('img')!
    expect(previewImage).toHaveAttribute('src', 'blob:cover-preview')
    Object.defineProperty(preview, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 900, height: 300, top: 0, right: 900, bottom: 300, left: 0, x: 0, y: 0, toJSON: () => ({}) }) })
    Object.defineProperty(previewImage, 'naturalWidth', { configurable: true, value: 1600 })
    Object.defineProperty(previewImage, 'naturalHeight', { configurable: true, value: 900 })
    fireEvent.load(previewImage)
    fireEvent(window, new Event('resize'))
    expect(screen.queryByRole('button', { name: 'profileAddCover' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'storyZoomOut' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'storyZoomIn' }))
    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 145, clientY: 100 })
    fireEvent.pointerUp(preview, { pointerId: 1, clientX: 145, clientY: 100 })
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(cropMocks.cropImageFile).toHaveBeenCalledWith(original, 3, 1.2, -50, 0, 1600))
    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalled())
    expect(apiMocks.uploadMediaFiles.mock.calls[0][0][0]).toBe(original)
    await waitFor(() => expect(socialMocks.changeUserBackground).toHaveBeenCalledWith('me', '/media/cover-cropped.jpg', '/media/cover-original.jpg', 0))
    expect(profileUpdated).toHaveBeenCalled()
    expect(apiMocks.cancelPendingMedia).not.toHaveBeenCalled()
    window.removeEventListener('fakebook:profile-updated', profileUpdated)
  })

  it('cancels an inline cover preview without changing the saved cover', () => {
    const profile = {
      id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
      backgroundUrl: '/media/current-cover.jpg', bio: null, location: null, birthDate: null, gender: null,
      createdAt: '2026-01-01T00:00:00Z', privacy: 0, isVerified: false, friendCount: 0, postCount: 0,
      followerCount: 0, followingCount: 0,
    }
    const { container } = render(<ProfilePage profile={profile} loading={false} error={null} canEdit viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'profileEditCover' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'profileUploadCover' }))
    fireEvent.change(container.querySelector<HTMLInputElement>('.self-profile-cover-file-input')!, { target: { files: [new File(['next'], 'next.jpg', { type: 'image/jpeg' })] } })
    expect(container.querySelector('.self-profile-cover-preview')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))

    expect(container.querySelector('.self-profile-cover-preview')).not.toBeInTheDocument()
    expect(container.querySelector<HTMLElement>('.profile-cover')?.style.backgroundImage).toContain('/media/current-cover.jpg')
    expect(socialMocks.changeUserBackground).not.toHaveBeenCalled()
  })

  it('opens the avatar menu and publishes an uploaded original after inline circular positioning', async () => {
    const profile = {
      id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: '/media/current-avatar.jpg',
      backgroundUrl: null, bio: 'Owner bio', location: null, birthDate: null, gender: null,
      createdAt: '2026-01-01T00:00:00Z', privacy: 0, isVerified: false, friendCount: 0, postCount: 0,
      followerCount: 0, followingCount: 0,
    }
    const updated = { ...profile, avatarUrl: '/media/avatar-cropped.jpg' }
    const original = new File(['avatar-original'], 'avatar.jpg', { type: 'image/jpeg' })
    const cropped = new File(['avatar-cropped'], 'avatar-cropped.jpg', { type: 'image/jpeg' })
    cropMocks.cropImageFile.mockResolvedValue(cropped)
    apiMocks.uploadMediaFiles.mockResolvedValue([
      { url: '/media/avatar-original.jpg', type: 'image', contentType: 'image/jpeg', size: 15, name: 'avatar.jpg' },
      { url: '/media/avatar-cropped.jpg', type: 'image', contentType: 'image/jpeg', size: 14, name: 'avatar-cropped.jpg' },
    ])
    socialMocks.changeUserAvatar.mockResolvedValue(updated)
    const onEdit = vi.fn()
    const profileUpdated = vi.fn()
    window.addEventListener('fakebook:profile-updated', profileUpdated)
    const { container } = render(<ProfilePage profile={profile} loading={false} error={null} canEdit viewerId="me" onEdit={onEdit} onNavigate={vi.fn()} onMessage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'profileEditAvatar' }))
    expect(screen.getByRole('menuitem', { name: 'profileChooseAvatar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'profileUploadAvatar' }))
    fireEvent.change(container.querySelector<HTMLInputElement>('.self-profile-avatar-file-input')!, { target: { files: [original] } })

    const avatarWrap = container.querySelector<HTMLElement>('.self-profile-avatar-wrap')!
    const preview = container.querySelector<HTMLElement>('.self-profile-avatar-preview')!
    const previewImage = preview.querySelector('img')!
    expect(avatarWrap).toHaveClass('editing-avatar')
    expect(container.querySelector('.self-profile-avatar-edit-controls')).toBeInTheDocument()
    expect(onEdit).not.toHaveBeenCalled()
    Object.defineProperty(preview, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 190, height: 190, top: 0, right: 190, bottom: 190, left: 0, x: 0, y: 0, toJSON: () => ({}) }) })
    Object.defineProperty(previewImage, 'naturalWidth', { configurable: true, value: 1600 })
    Object.defineProperty(previewImage, 'naturalHeight', { configurable: true, value: 900 })
    fireEvent.load(previewImage)
    fireEvent(window, new Event('resize'))
    fireEvent.click(screen.getByRole('button', { name: 'storyZoomIn' }))
    fireEvent.pointerDown(preview, { pointerId: 2, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(preview, { pointerId: 2, clientX: 145, clientY: 100 })
    fireEvent.pointerUp(preview, { pointerId: 2, clientX: 145, clientY: 100 })
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(cropMocks.cropImageFile).toHaveBeenCalled())
    const cropCall = cropMocks.cropImageFile.mock.calls[0]
    expect(cropCall[0]).toBe(original)
    expect(cropCall[1]).toBe(1)
    expect(cropCall[2]).toBe(1.2)
    expect(cropCall[3]).not.toBe(0)
    expect(cropCall[5]).toBe(1024)
    await waitFor(() => expect(socialMocks.changeUserAvatar).toHaveBeenCalledWith('me', '/media/avatar-cropped.jpg', '/media/avatar-original.jpg', 0))
    expect(apiMocks.uploadMediaFiles).toHaveBeenCalledWith([original, cropped])
    expect(profileUpdated).toHaveBeenCalled()
    await waitFor(() => expect(avatarWrap).not.toHaveClass('editing-avatar'))
    window.removeEventListener('fakebook:profile-updated', profileUpdated)
  })

  it('uses an existing authorized photo for the avatar without attaching an original activity image', async () => {
    const profile = {
      id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
      backgroundUrl: null, bio: null, location: null, birthDate: null, gender: null,
      createdAt: '2026-01-01T00:00:00Z', privacy: 0, isVerified: false, friendCount: 0, postCount: 0,
      followerCount: 0, followingCount: 0,
    }
    socialMocks.getMyFeedPhotoCandidates.mockResolvedValue({
      items: [{ media: { id: 'photo-1', type: 0, url: '/media/existing.jpg' }, contentId: 'post-1', contentType: 1, createdAt: '', authorId: 'me', groupId: null }],
      endCursor: null,
      hasNextPage: false,
    })
    const cropped = new File(['existing-cropped'], 'existing-cropped.jpg', { type: 'image/jpeg' })
    cropMocks.cropImageFile.mockResolvedValue(cropped)
    apiMocks.uploadMediaFiles.mockResolvedValue([{ url: '/media/existing-cropped.jpg', type: 'image', contentType: 'image/jpeg', size: 16, name: 'existing-cropped.jpg' }])
    socialMocks.changeUserAvatar.mockResolvedValue({ ...profile, avatarUrl: '/media/existing-cropped.jpg' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['existing'], { type: 'image/jpeg' }), { status: 200 }))
    const { container } = render(<ProfilePage profile={profile} loading={false} error={null} canEdit viewerId="me" onEdit={vi.fn()} onNavigate={vi.fn()} onMessage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'profileEditAvatar' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'profileChooseAvatar' }))
    const picker = await screen.findByRole('dialog', { name: 'profileChooseAvatar' })
    fireEvent.click(picker.querySelector<HTMLButtonElement>('.existing-photo-grid button')!)
    await waitFor(() => expect(container.querySelector('.self-profile-avatar-preview')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(apiMocks.uploadMediaFiles).toHaveBeenCalledWith([cropped]))
    await waitFor(() => expect(socialMocks.changeUserAvatar).toHaveBeenCalledWith(
      'me',
      '/media/existing-cropped.jpg',
      null,
      0,
      { contentId: 'post-1', mediaId: 'photo-1' },
    ))
    fetchMock.mockRestore()
  })

  it('groups feed posts and reels by month in grid view and separates media from detail navigation', async () => {
    i18nMocks.locale = 'vi-VN'
    socialMocks.getProfilePosts.mockResolvedValue({
      items: [
        {
          __typename: 'FeedPostDetail', id: 'feed-july', type: 1, content: 'Ảnh tháng bảy', privacy: 2,
          create: '2026-07-15T12:00:00Z', author: { id: 'me', name: 'Owner Name', avatar: '/owner.jpg', isVerified: false },
          media: [{ id: 'video-july', type: 1, url: '/july.mp4' }],
        },
        {
          __typename: 'ReelDetail', id: 'reel-july', type: 2, content: 'Reel tháng bảy', privacy: 1,
          create: '2026-07-12T12:00:00Z', author: { id: 'me', name: 'Owner Name', avatar: '/owner.jpg', isVerified: false },
          media: [{ id: 'reel-video', type: 1, url: '/reel.mp4' }], aspectRatio: 0.5625, focalPointX: 0, focalPointY: 0,
        },
        {
          __typename: 'FeedPostDetail', id: 'text-june', type: 1, content: 'Bài không có media', privacy: 3,
          create: '2026-06-15T12:00:00Z', author: { id: 'me', name: 'Owner Name', avatar: '/owner.jpg', isVerified: false }, media: [],
        },
        {
          __typename: 'FeedPostDetail', id: 'background-june', type: 1, content: '[[post-bg:v1:ocean]]\nBài có nền', privacy: 0,
          create: '2026-06-10T12:00:00Z', author: { id: 'me', name: 'Owner Name', avatar: '/owner.jpg', isVerified: false }, media: [],
        },
      ],
      endCursor: null,
      hasNextPage: false,
    })
    const onNavigate = vi.fn()
    const { container } = render(<ProfilePage
      profile={{
        id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: '/owner.jpg',
        backgroundUrl: null, bio: null, location: null, birthDate: null, gender: null, createdAt: '2026-01-01T00:00:00Z',
        privacy: 0, isVerified: false, friendCount: 0, postCount: 4, followerCount: 0, followingCount: 0,
      }}
      loading={false} error={null} canEdit viewerId="me" onEdit={vi.fn()} onNavigate={onNavigate} onMessage={vi.fn()}
    />)

    await waitFor(() => expect(socialMocks.getProfilePosts).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'profileGridView' }))

    const july = await screen.findByRole('heading', { name: /tháng 7.*2026/i })
    const june = screen.getByRole('heading', { name: /tháng 6.*2026/i })
    expect(july.compareDocumentPosition(june) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const feedCard = container.querySelector<HTMLElement>('[data-post-id="feed-july"]')!
    const reelCard = container.querySelector<HTMLElement>('[data-post-id="reel-july"]')!
    const plainCard = container.querySelector<HTMLElement>('[data-post-id="text-june"]')!
    const backgroundCard = container.querySelector<HTMLElement>('[data-post-id="background-june"]')!
    expect(feedCard).toBeInTheDocument()
    expect(reelCard).toHaveClass('is-reel')
    expect(feedCard.querySelector('.profile-post-grid-footer .avatar')).toBeInTheDocument()
    expect(feedCard.querySelector('.profile-post-grid-meta svg')).toBeInTheDocument()
    expect(container.querySelectorAll('.profile-post-grid-video-mark')).toHaveLength(2)
    expect(feedCard.querySelector('time')).not.toHaveTextContent('2026-07-15T12:00:00Z')
    expect(plainCard.querySelector('.profile-post-grid-text')).toHaveClass('plain-text')
    expect(backgroundCard.querySelector<HTMLElement>('.profile-post-grid-text')?.style.background).toContain('linear-gradient')

    const feedVideoButton = feedCard.querySelector<HTMLButtonElement>('.profile-post-grid-media-item')!
    const feedVideo = feedVideoButton.querySelector('video')!
    const playPreview = vi.spyOn(feedVideo, 'play').mockResolvedValue(undefined)
    const pausePreview = vi.spyOn(feedVideo, 'pause').mockImplementation(() => undefined)
    fireEvent.mouseEnter(feedVideoButton)
    expect(playPreview).toHaveBeenCalledTimes(1)
    fireEvent.mouseLeave(feedVideoButton)
    expect(pausePreview).toHaveBeenCalledTimes(1)
    expect(feedVideo.currentTime).toBe(0)

    fireEvent.click(reelCard.querySelector<HTMLButtonElement>('.profile-post-grid-media-item')!)
    expect(screen.queryByTestId('profile-content-detail')).not.toBeInTheDocument()
    expect(onNavigate).not.toHaveBeenCalled()

    fireEvent.click(feedVideoButton)
    expect(await screen.findByTestId('profile-photo-viewer')).toHaveAttribute('data-content-id', 'feed-july')
    fireEvent.click(feedCard.querySelector<HTMLButtonElement>('.profile-post-grid-footer')!)
    expect(await screen.findByTestId('profile-content-detail')).toHaveAttribute('data-content-id', 'feed-july')
    fireEvent.click(screen.getByRole('button', { name: 'close-profile-detail' }))
    await waitFor(() => expect(screen.queryByTestId('profile-content-detail')).not.toBeInTheDocument())

    fireEvent.click(plainCard.querySelector<HTMLButtonElement>('.profile-post-grid-text')!)
    expect(await screen.findByTestId('profile-content-detail')).toHaveAttribute('data-content-id', 'text-june')
    expect(onNavigate).not.toHaveBeenCalled()
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

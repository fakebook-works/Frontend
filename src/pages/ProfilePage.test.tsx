// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const socialMocks = vi.hoisted(() => ({
  getProfilePosts: vi.fn(),
  getProfileRelationshipState: vi.fn(),
  getRelationProfiles: vi.fn(),
  getUserPhotos: vi.fn(),
  getMyFeedPhotoCandidates: vi.fn(),
  getProfileReels: vi.fn(),
  changeUserBackground: vi.fn(),
}))
const apiMocks = vi.hoisted(() => ({ myStories: vi.fn(), uploadMediaFiles: vi.fn(), cancelPendingMedia: vi.fn() }))

vi.mock('../api/social', () => ({
  socialApi: {
    ...socialMocks,
    sendFriendRequest: vi.fn(),
    cancelFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    unfriend: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}))
vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en' }) }))
vi.mock('../components/ImageCropModal', () => ({ ImageCropModal: ({ file, onConfirm }: { file: File; onConfirm: (original: File, cropped: File) => Promise<void> | void }) => <button type="button" onClick={() => void onConfirm(file, new File(['cropped'], 'cover-cropped.jpg', { type: 'image/jpeg' }))}>confirmCoverCrop</button> }))
vi.mock('./GatewayHomePage', () => ({ GatewayPostCard: () => null, PostComposer: () => <div data-testid="profile-post-composer" /> }))

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
    socialMocks.getUserPhotos.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getMyFeedPhotoCandidates.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getProfileReels.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.changeUserBackground.mockReset()
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
    socialMocks.getRelationProfiles.mockResolvedValue([{
      id: 'friend-1', username: 'lan', email: '', displayName: 'Lan Nguyen', avatarUrl: null, backgroundUrl: null,
      bio: null, location: null, birthDate: null, gender: null, createdAt: '', privacy: 0, isVerified: false,
      friendCount: 2, postCount: 0, followerCount: 0, followingCount: 0,
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
    const onEdit = vi.fn()
    const { container } = render(<ProfilePage
      profile={{
        id: 'me', username: 'owner', email: 'owner@example.com', displayName: 'Owner Name', avatarUrl: null,
        backgroundUrl: null, bio: 'Owner bio', location: 'Ha Noi', birthDate: '2000-01-01', gender: null,
        createdAt: '2026-01-01T00:00:00Z', privacy: 0, isVerified: true, friendCount: 1, postCount: 0,
        followerCount: 2, followingCount: 3,
      }}
      loading={false}
      error={null}
      canEdit
      viewerId="me"
      onEdit={onEdit}
      onNavigate={vi.fn()}
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
    expect(await screen.findByText('Lan Nguyen')).toBeInTheDocument()
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
    expect(container.querySelector('.self-profile-avatar-wrap')).toHaveClass('has-story')
    expect(screen.getByRole('button', { name: 'profileEditAvatar' }).querySelector('.self-profile-cover-camera-icon')).toBeInTheDocument()
    expect(container.querySelectorAll('.self-profile-header-actions > button')).toHaveLength(2)
    expect(container.querySelector('.self-profile-header-actions > details')).not.toBeInTheDocument()

    fireEvent.click(coverButton)
    expect(screen.getByRole('menuitem', { name: 'profileChooseCover' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'profileUploadCover' })).toBeInTheDocument()
    expect(onEdit).not.toHaveBeenCalled()
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
})

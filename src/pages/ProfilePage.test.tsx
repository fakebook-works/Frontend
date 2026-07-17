// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const socialMocks = vi.hoisted(() => ({
  getProfilePosts: vi.fn(),
  getProfileRelationshipState: vi.fn(),
}))

vi.mock('../api/social', () => ({
  socialApi: {
    ...socialMocks,
    getRelationProfiles: vi.fn(),
    getUserPhotos: vi.fn(),
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
vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en' }) }))
vi.mock('./GatewayHomePage', () => ({ GatewayPostCard: () => null }))

describe('ProfilePage messaging', () => {
  beforeEach(() => {
    socialMocks.getProfilePosts.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({
      friendship: 'friend',
      isFollowing: false,
      followsViewer: false,
      isBlocked: false,
      isBlockedBy: false,
    })
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
})

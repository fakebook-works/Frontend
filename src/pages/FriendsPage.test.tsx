// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocialProfile } from '../api/social'
import { FriendsPage } from './FriendsPage'

const socialMocks = vi.hoisted(() => ({
  getFriendSuggestions: vi.fn(),
  getRelationProfiles: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  unfriend: vi.fn(),
  unblockUser: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string, values?: Record<string, unknown>) => values?.count == null ? key : `${key}:${values.count}`)

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({
  useI18n: () => ({ t: translate }),
}))

const candidate: SocialProfile = {
  id: '3', username: 'candidate', email: '', displayName: 'Candidate User', avatarUrl: '/candidate.jpg',
  backgroundUrl: null, isVerified: true, bio: null, birthDate: null, gender: null, location: null,
  createdAt: '2026-01-01', friendCount: 4, followerCount: 9, followingCount: 2, postCount: 0, privacy: 0,
}

describe('FriendsPage redesign', () => {
  beforeEach(() => {
    socialMocks.getFriendSuggestions.mockReset().mockResolvedValue([{
      profile: candidate,
      mutualFriendCount: 1,
      mutualFriends: [{ id: '2', username: 'mutual', displayName: 'Mutual Friend', avatarUrl: '/mutual.jpg', isVerified: false }],
    }])
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([candidate])
    socialMocks.sendFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.acceptFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.rejectFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.cancelFriendRequest.mockReset().mockResolvedValue(true)
    socialMocks.unfriend.mockReset().mockResolvedValue(true)
    socialMocks.unblockUser.mockReset().mockResolvedValue(true)
  })

  afterEach(cleanup)

  it('renders the requested sidebar and suggestion home without a see-all link', async () => {
    const onNavigate = vi.fn()
    const onMessage = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<FriendsPage userId="1" section="home" onNavigate={onNavigate} onMessage={onMessage} />)

    await waitFor(() => expect(socialMocks.getFriendSuggestions).toHaveBeenCalledWith('1', 36))
    const labels = [...container.querySelectorAll('.friends-page-sidebar nav strong')].map((item) => item.textContent)
    expect(labels).toEqual(['friendsHome', 'incomingRequests', 'sentRequests', 'allFriends', 'blockedPeople'])
    expect(container.querySelector('.friends-page-sidebar > header button')).not.toBeInTheDocument()
    expect(container.querySelector('.friends-page-sidebar nav > button > svg')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'friendSuggestionsTitle' })).toBeInTheDocument()
    expect(screen.queryByText('seeAll')).not.toBeInTheDocument()
    expect(container.querySelector('.friend-mutual-tooltip')).toHaveTextContent('Mutual Friend')
    expect(container.querySelector('.friend-profile-popover')).toHaveTextContent('Mutual Friend')

    const card = container.querySelector('.friend-discovery-card')!
    fireEvent.click(card.querySelector<HTMLButtonElement>('.friend-card-actions .primary')!)
    await waitFor(() => expect(socialMocks.sendFriendRequest).toHaveBeenCalledWith('1', '3'))
    await waitFor(() => expect(container.querySelector('.friend-discovery-card')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /sentRequests/ }))
    expect(onNavigate).toHaveBeenCalledWith('/friends/outgoing')
  })

  it('loads received requests and confirms them from their card', async () => {
    const { container } = render(<FriendsPage userId="1" section="incoming" onNavigate={vi.fn()} />)

    await waitFor(() => expect(socialMocks.getRelationProfiles).toHaveBeenCalledWith('1', 2, 100))
    fireEvent.click(container.querySelector<HTMLButtonElement>('.friend-card-actions .primary')!)
    await waitFor(() => expect(socialMocks.acceptFriendRequest).toHaveBeenCalledWith('3', '1'))
    await waitFor(() => expect(container.querySelector('.friend-discovery-card')).not.toBeInTheDocument())
  })

  it('ignores a slow response from the previous section after navigation', async () => {
    let resolveSuggestions!: (value: Array<{ profile: SocialProfile; mutualFriendCount: number; mutualFriends: [] }>) => void
    socialMocks.getFriendSuggestions.mockReturnValue(new Promise((resolve) => { resolveSuggestions = resolve }))
    const { container, rerender } = render(<FriendsPage userId="1" section="home" onNavigate={vi.fn()} />)
    await waitFor(() => expect(socialMocks.getFriendSuggestions).toHaveBeenCalled())

    rerender(<FriendsPage userId="1" section="incoming" onNavigate={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('.friend-card-name')).toHaveTextContent('Candidate User'))

    await act(async () => {
      resolveSuggestions([{
        profile: { ...candidate, id: '4', displayName: 'Stale Suggestion' },
        mutualFriendCount: 0,
        mutualFriends: [],
      }])
    })

    expect(container.querySelector('.friend-card-name')).toHaveTextContent('Candidate User')
    expect(container).not.toHaveTextContent('Stale Suggestion')
  })

  it.each([
    ['outgoing', 1, 'cancel'],
    ['friends', 0, 'unfriend'],
    ['blocked', 5, 'unblock'],
  ] as const)('loads and performs the %s section action', async (section, associationType, action) => {
    const { container } = render(<FriendsPage userId="1" section={section} onNavigate={vi.fn()} />)

    await waitFor(() => expect(socialMocks.getRelationProfiles).toHaveBeenCalledWith('1', associationType, 100))
    const actionButton = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>('.friend-card-actions button')
      expect(button).not.toBeNull()
      return button!
    })
    fireEvent.click(actionButton)

    if (action === 'cancel') {
      await waitFor(() => expect(socialMocks.cancelFriendRequest).toHaveBeenCalledWith('1', '3'))
    } else if (action === 'unfriend') {
      await waitFor(() => expect(socialMocks.unfriend).toHaveBeenCalledWith('1', '3'))
    } else {
      await waitFor(() => expect(socialMocks.unblockUser).toHaveBeenCalledWith('1', '3'))
    }
    await waitFor(() => expect(container.querySelector('.friend-discovery-card')).not.toBeInTheDocument())
  })
})

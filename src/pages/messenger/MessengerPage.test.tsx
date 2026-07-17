// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessengerPage } from './MessengerPage'

const messengerMocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  createDirectConversation: vi.fn(),
  createGroupConversation: vi.fn(),
}))

vi.mock('../../api/client', () => ({ api: { uploadMedia: vi.fn(), uploadMediaFiles: vi.fn(), finalizePendingMedia: vi.fn(), cancelPendingMedia: vi.fn() } }))
vi.mock('../../api/messenger', () => ({ messengerApi: {
  conversations: messengerMocks.conversations,
  messages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
  createDirectConversation: messengerMocks.createDirectConversation,
  createGroupConversation: messengerMocks.createGroupConversation,
  leaveConversation: vi.fn(),
  subscribeInbox: vi.fn(() => vi.fn()),
  subscribeConversation: vi.fn(() => vi.fn()),
} }))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('Messenger unavailable state', () => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  beforeEach(() => {
    messengerMocks.conversations.mockReset().mockRejectedValue(new Error('offline'))
    messengerMocks.createDirectConversation.mockReset()
    messengerMocks.createGroupConversation.mockReset()
  })
  afterEach(cleanup)

  it('shows an honest unavailable state instead of generated conversations', async () => {
    render(<MessengerPage me={{ id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }} friends={[]} onOpenProfile={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('messengerUnavailable')).toBeInTheDocument())
    expect(screen.queryByText('Linh Tran')).not.toBeInTheDocument()
    expect(screen.queryByText('messengerPreviewMessage')).not.toBeInTheDocument()
  })

  it('asks the server for the canonical direct conversation even when a group chat contains that friend', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friend = { id: 'friend', username: 'friend', displayName: 'Friend', avatarUrl: null }
    const groupConversation = { id: 'group-1', participants: [me, friend, { id: 'third', username: 'third', displayName: 'Third', avatarUrl: null }], title: 'Group', avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null }
    const directConversation = { ...groupConversation, id: 'direct-1', participants: [me, friend], title: null }
    messengerMocks.conversations.mockResolvedValue([groupConversation])
    messengerMocks.createDirectConversation.mockResolvedValue(directConversation)

    render(<MessengerPage me={me} friends={[friend]} onOpenProfile={vi.fn()} />)
    await screen.findAllByText('Group')
    fireEvent.click(screen.getByRole('button', { name: 'newMessage' }))
    fireEvent.click(screen.getByRole('button', { name: /Friend/ }))

    await waitFor(() => expect(messengerMocks.createDirectConversation).toHaveBeenCalledWith('friend', 'me'))
  })

  it('creates a group conversation from the selected friends', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friends = [
      { id: 'friend-1', username: 'friend-1', displayName: 'Friend One', avatarUrl: null },
      { id: 'friend-2', username: 'friend-2', displayName: 'Friend Two', avatarUrl: null },
    ]
    const group = { id: 'group-1', type: 'GROUP' as const, participants: [me, ...friends], title: 'Weekend', avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null }
    messengerMocks.conversations.mockResolvedValue([])
    messengerMocks.createGroupConversation.mockResolvedValue(group)

    render(<MessengerPage me={me} friends={friends} onOpenProfile={vi.fn()} />)
    await screen.findByRole('button', { name: 'newMessage' })
    fireEvent.click(screen.getByRole('button', { name: 'newMessage' }))
    fireEvent.click(screen.getByRole('button', { name: 'createGroupChat' }))
    fireEvent.change(screen.getByPlaceholderText('groupChatNamePlaceholder'), { target: { value: 'Weekend' } })
    fireEvent.click(screen.getByRole('button', { name: /Friend One/ }))
    fireEvent.click(screen.getByRole('button', { name: /Friend Two/ }))
    fireEvent.click(screen.getByRole('button', { name: 'startGroupChat' }))

    await waitFor(() => expect(messengerMocks.createGroupConversation).toHaveBeenCalledWith('Weekend', ['friend-1', 'friend-2'], 'me'))
  })
})

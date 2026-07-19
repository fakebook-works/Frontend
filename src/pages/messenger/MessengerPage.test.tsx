// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessengerPage } from './MessengerPage'

const messengerMocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  messages: vi.fn(),
  message: vi.fn(),
  sendMessage: vi.fn(),
  createDirectConversation: vi.fn(),
  createGroupConversation: vi.fn(),
  markRead: vi.fn(),
}))
const searchFriends = vi.hoisted(() => vi.fn())
const uploadMocks = vi.hoisted(() => ({
  uploadMediaFiles: vi.fn(),
  finalizePendingMedia: vi.fn(),
  cancelPendingMedia: vi.fn(),
}))

vi.mock('../../api/client', () => ({ api: uploadMocks }))
vi.mock('../../api/messenger', () => ({ messengerApi: {
  conversations: messengerMocks.conversations,
  messages: messengerMocks.messages,
  message: messengerMocks.message,
  sendMessage: messengerMocks.sendMessage,
  createDirectConversation: messengerMocks.createDirectConversation,
  createGroupConversation: messengerMocks.createGroupConversation,
  markRead: messengerMocks.markRead,
  leaveConversation: vi.fn(),
  presence: vi.fn().mockResolvedValue([]),
  setTyping: vi.fn().mockResolvedValue(undefined),
  subscribeInbox: vi.fn(() => vi.fn()),
  subscribeConversation: vi.fn(() => vi.fn()),
  subscribePresence: vi.fn(() => vi.fn()),
} }))
vi.mock('../../api/search', () => ({ searchApi: { searchFriends } }))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('Messenger unavailable state', () => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  beforeEach(() => {
    messengerMocks.conversations.mockReset().mockRejectedValue(new Error('offline'))
    messengerMocks.messages.mockReset().mockResolvedValue([])
    messengerMocks.message.mockReset()
    messengerMocks.sendMessage.mockReset()
    messengerMocks.createDirectConversation.mockReset()
    messengerMocks.createGroupConversation.mockReset()
    messengerMocks.markRead.mockReset().mockResolvedValue(undefined)
    searchFriends.mockReset().mockResolvedValue([])
    uploadMocks.uploadMediaFiles.mockReset()
    uploadMocks.finalizePendingMedia.mockReset().mockResolvedValue(undefined)
    uploadMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
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

  it('finds a friend outside the initially loaded page before opening a direct conversation', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const remoteFriend = { id: 'remote', username: 'remote', displayName: 'Remote Friend', avatarUrl: null }
    const directConversation = { id: 'direct-remote', type: 'DIRECT' as const, participants: [me, remoteFriend], title: null, avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null }
    messengerMocks.conversations.mockResolvedValue([])
    searchFriends.mockResolvedValue([remoteFriend])
    messengerMocks.createDirectConversation.mockResolvedValue(directConversation)

    render(<MessengerPage me={me} friends={[]} onOpenProfile={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'newMessage' }))
    fireEvent.change(screen.getByPlaceholderText('searchFriends'), { target: { value: 'r' } })

    await waitFor(() => expect(searchFriends).toHaveBeenCalledWith('r', 1, 30))
    fireEvent.click(await screen.findByRole('button', { name: /Remote Friend/ }))
    await waitFor(() => expect(messengerMocks.createDirectConversation).toHaveBeenCalledWith('remote', 'me'))
  })

  it('keeps pending media attached to the conversation where it was selected', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friendOne = { id: 'friend-1', username: 'friend-1', displayName: 'Friend One', avatarUrl: null }
    const friendTwo = { id: 'friend-2', username: 'friend-2', displayName: 'Friend Two', avatarUrl: null }
    messengerMocks.conversations.mockResolvedValue([
      { id: 'conversation-1', type: 'DIRECT', participants: [me, friendOne], title: null, avatarUrl: null, updatedAt: '2026-01-02', unreadCount: 0, lastMessage: null },
      { id: 'conversation-2', type: 'DIRECT', participants: [me, friendTwo], title: null, avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null },
    ])
    uploadMocks.uploadMediaFiles.mockResolvedValue([{
      url: '/media/files/first.png',
      type: 'image',
      contentType: 'image/png',
      size: 5,
      name: 'first.png',
      assetId: 'asset-first',
      state: 'pending',
    }])

    const { container } = render(<MessengerPage me={me} friends={[friendOne, friendTwo]} onOpenProfile={vi.fn()} />)
    await screen.findAllByText('Friend One')
    const fileInput = container.querySelector<HTMLInputElement>('.messenger-file-input')!
    fireEvent.change(fileInput, { target: { files: [new File(['image'], 'first.png', { type: 'image/png' })] } })
    expect(await screen.findByText('first.png')).toBeInTheDocument()

    const row = (name: string) => screen.getAllByRole('button').find((button) => button.classList.contains('messenger-row') && button.textContent?.includes(name))!
    fireEvent.click(row('Friend Two'))
    expect(screen.queryByText('first.png')).not.toBeInTheDocument()
    fireEvent.click(row('Friend One'))
    expect(await screen.findByText('first.png')).toBeInTheDocument()
    expect(uploadMocks.cancelPendingMedia).not.toHaveBeenCalled()
  })
})

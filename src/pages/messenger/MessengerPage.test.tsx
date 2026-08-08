// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessengerRealtimeEvent } from '../../api/messenger'
import { MessengerPage } from './MessengerPage'

const messengerMocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  messages: vi.fn(),
  message: vi.fn(),
  sendMessage: vi.fn(),
  createDirectConversation: vi.fn(),
  createGroupConversation: vi.fn(),
  leaveConversation: vi.fn(),
  markDelivered: vi.fn(),
  markRead: vi.fn(),
  subscribeInbox: vi.fn(),
  subscribeConversations: vi.fn(),
  subscribePresence: vi.fn(),
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
  markDelivered: messengerMocks.markDelivered,
  markRead: messengerMocks.markRead,
  leaveConversation: messengerMocks.leaveConversation,
  presence: vi.fn().mockResolvedValue([]),
  setTyping: vi.fn().mockResolvedValue(undefined),
  subscribeInbox: messengerMocks.subscribeInbox,
  subscribeConversations: messengerMocks.subscribeConversations,
  subscribePresence: messengerMocks.subscribePresence,
} }))
vi.mock('../../api/search', () => ({ searchApi: { searchFriends } }))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

let inboxListener: ((event: MessengerRealtimeEvent) => void) | null = null
let conversationListener: ((event: MessengerRealtimeEvent) => void) | null = null

describe('Messenger unavailable state', () => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((file: File) => `blob:${file.name}`) })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    messengerMocks.conversations.mockReset().mockRejectedValue(new Error('offline'))
    messengerMocks.messages.mockReset().mockResolvedValue([])
    messengerMocks.message.mockReset()
    messengerMocks.sendMessage.mockReset()
    messengerMocks.createDirectConversation.mockReset()
    messengerMocks.createGroupConversation.mockReset()
    messengerMocks.leaveConversation.mockReset().mockResolvedValue(undefined)
    messengerMocks.markDelivered.mockReset().mockResolvedValue(undefined)
    messengerMocks.markRead.mockReset().mockResolvedValue(undefined)
    inboxListener = null
    conversationListener = null
    messengerMocks.subscribeInbox.mockReset().mockImplementation((listener) => {
      inboxListener = listener
      return () => { if (inboxListener === listener) inboxListener = null }
    })
    messengerMocks.subscribeConversations.mockReset().mockImplementation((_conversationIds, listener) => {
      conversationListener = listener
      return () => { if (conversationListener === listener) conversationListener = null }
    })
    messengerMocks.subscribePresence.mockReset().mockReturnValue(() => undefined)
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

  it('filters the full Messenger list by unread and group conversations', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const unreadFriend = { id: 'unread', username: 'unread', displayName: 'Unread Friend', avatarUrl: null }
    const readFriend = { id: 'read', username: 'read', displayName: 'Read Friend', avatarUrl: null }
    const groupFriend = { id: 'group-friend', username: 'group-friend', displayName: 'Group Friend', avatarUrl: null }
    messengerMocks.conversations.mockResolvedValue([
      { id: 'unread-chat', type: 'DIRECT', participants: [me, unreadFriend], title: null, avatarUrl: null, updatedAt: '2026-01-03', unreadCount: 2, lastMessage: null },
      { id: 'read-chat', type: 'DIRECT', participants: [me, readFriend], title: null, avatarUrl: null, updatedAt: '2026-01-02', unreadCount: 0, lastMessage: null },
      { id: 'group-chat', type: 'GROUP', participants: [me, groupFriend], title: 'Weekend Group', avatarUrl: null, updatedAt: '2026-01-01', unreadCount: 0, lastMessage: null },
    ])

    const { container } = render(<MessengerPage me={me} friends={[unreadFriend, readFriend, groupFriend]} onOpenProfile={vi.fn()} />)
    await screen.findAllByText('Unread Friend')
    const visibleRows = () => [...container.querySelectorAll('.messenger-row')].map((row) => row.textContent)
    expect(visibleRows()).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'unreadOnly' }))
    expect(visibleRows()).toHaveLength(1)
    expect(visibleRows()[0]).toContain('Unread Friend')

    fireEvent.click(screen.getByRole('button', { name: 'groupChats' }))
    expect(visibleRows()).toHaveLength(1)
    expect(visibleRows()[0]).toContain('Weekend Group')
    fireEvent.click(container.querySelector<HTMLButtonElement>('.messenger-row')!)
    expect(await screen.findByText('manageGroup')).toBeInTheDocument()
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
    uploadMocks.uploadMediaFiles.mockReturnValue(new Promise(() => undefined))

    const { container } = render(<MessengerPage me={me} friends={[friendOne, friendTwo]} onOpenProfile={vi.fn()} />)
    await screen.findAllByText('Friend One')
    const fileInput = container.querySelector<HTMLInputElement>('.messenger-file-input')!
    fireEvent.change(fileInput, { target: { files: [new File(['image'], 'first.png', { type: 'image/png' })] } })
    expect(await screen.findByText('first.png')).toBeInTheDocument()
    expect(uploadMocks.uploadMediaFiles).not.toHaveBeenCalled()

    const row = (name: string) => screen.getAllByRole('button').find((button) => button.classList.contains('messenger-row') && button.textContent?.includes(name))!
    fireEvent.click(row('Friend Two'))
    expect(screen.queryByText('first.png')).not.toBeInTheDocument()
    fireEvent.click(row('Friend One'))
    expect(await screen.findByText('first.png')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'sendMessage' }))

    await waitFor(() => expect(uploadMocks.uploadMediaFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'first.png', type: 'image/png' }),
    ]))
    expect(uploadMocks.cancelPendingMedia).not.toHaveBeenCalled()
  })

  it('caps local previews before upload so a later selection cannot create orphan pending assets', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friend = { id: 'friend-1', username: 'friend-1', displayName: 'Friend One', avatarUrl: null }
    messengerMocks.conversations.mockResolvedValue([
      { id: 'conversation-1', type: 'DIRECT', participants: [me, friend], title: null, avatarUrl: null, updatedAt: '2026-01-02', unreadCount: 0, lastMessage: null },
    ])
    uploadMocks.uploadMediaFiles.mockReturnValue(new Promise(() => undefined))

    const { container } = render(<MessengerPage me={me} friends={[friend]} onOpenProfile={vi.fn()} />)
    await screen.findAllByText('Friend One')
    const fileInput = container.querySelector<HTMLInputElement>('.messenger-file-input')!
    const files = Array.from({ length: 12 }, (_, index) => new File(['image'], `image-${index}.png`, { type: 'image/png' }))
    fireEvent.change(fileInput, { target: { files: files.slice(0, 6) } })
    fireEvent.change(fileInput, { target: { files: files.slice(6) } })

    await waitFor(() => expect(container.querySelectorAll('.attachment-chip')).toHaveLength(10))
    fireEvent.click(screen.getByRole('button', { name: 'sendMessage' }))
    await waitFor(() => expect(uploadMocks.uploadMediaFiles).toHaveBeenCalledWith(
      expect.arrayContaining(files.slice(0, 10)),
    ))
    expect(uploadMocks.uploadMediaFiles.mock.calls[0][0]).toHaveLength(10)
  })

  it('keeps an initially selected conversation unread until the user clicks the thread', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friend = { id: 'friend', username: 'friend', displayName: 'Friend', avatarUrl: null }
    const message = {
      id: 'message-9', conversationId: 'conversation-9', sequence: '9', sender: friend, body: 'Unread thread',
      createdAt: '2026-07-20T00:00:00Z', status: 'delivered' as const, attachments: [], reactions: [], deleted: false,
    }
    messengerMocks.conversations.mockResolvedValue([{
      id: 'conversation-9', type: 'DIRECT', participants: [me, friend], title: null, avatarUrl: null,
      updatedAt: message.createdAt, unreadCount: 1, lastMessage: message,
    }])
    messengerMocks.messages.mockResolvedValue([message])
    render(<MessengerPage me={me} friends={[friend]} onOpenProfile={vi.fn()} />)

    await screen.findByText('Unread thread')
    expect(messengerMocks.markRead).not.toHaveBeenCalled()

    fireEvent.click(document.querySelector('.messenger-messages')!)
    await waitFor(() => expect(messengerMocks.markRead).toHaveBeenCalledWith('conversation-9', '9'))
  })

  it('opens the full-page profile only from the thread avatar', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friend = { id: 'friend', username: 'friend', displayName: 'Friend', avatarUrl: null }
    messengerMocks.conversations.mockResolvedValue([{
      id: 'conversation-profile', type: 'DIRECT', participants: [me, friend], title: null, avatarUrl: null,
      updatedAt: '2026-07-20T00:00:00Z', unreadCount: 0, lastMessage: null,
    }])
    const onOpenProfile = vi.fn()
    const { container } = render(<MessengerPage me={me} friends={[friend]} onOpenProfile={onOpenProfile} />)
    await screen.findAllByText('Friend')

    fireEvent.click(container.querySelector('.messenger-thread .messenger-id > span')!)
    expect(onOpenProfile).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('.messenger-thread .messenger-id-avatar')!)
    expect(onOpenProfile).toHaveBeenCalledWith('friend')
  })

  it('releases the pending preview URL after leaving a group conversation', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friend = { id: 'friend-1', username: 'friend-1', displayName: 'Friend One', avatarUrl: null }
    messengerMocks.conversations.mockResolvedValue([{
      id: 'group-leave', type: 'GROUP' as const, participants: [me, friend], title: 'Leave Group', avatarUrl: null,
      updatedAt: '2026-01-02', unreadCount: 0, lastMessage: null,
    }])

    const { container } = render(<MessengerPage me={me} friends={[friend]} onOpenProfile={vi.fn()} />)
    await screen.findAllByText('Leave Group')
    fireEvent.change(container.querySelector<HTMLInputElement>('.messenger-file-input')!, {
      target: { files: [new File(['image'], 'leave-group.png', { type: 'image/png' })] },
    })
    expect(await screen.findByText('leave-group.png')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'leaveConversation' }))

    await waitFor(() => expect(messengerMocks.leaveConversation).toHaveBeenCalledWith('group-leave', me.id))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:leave-group.png'))
    expect(screen.queryByText('leave-group.png')).not.toBeInTheDocument()
  })

  it('runs inbox and selected-conversation side effects for the same outbox event', async () => {
    const me = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
    const friend = { id: 'friend', username: 'friend', displayName: 'Friend', avatarUrl: null }
    const message = {
      id: 'shared-message', conversationId: 'conversation-shared', sequence: '12', sender: friend,
      body: 'Shared event', createdAt: '2026-07-20T00:00:00Z', status: 'delivered' as const,
      attachments: [], reactions: [], deleted: false,
    }
    messengerMocks.conversations.mockResolvedValue([{
      id: 'conversation-shared', type: 'DIRECT' as const, participants: [me, friend], title: null, avatarUrl: null,
      updatedAt: message.createdAt, unreadCount: 0, lastMessage: message,
    }])
    messengerMocks.messages.mockResolvedValue([message])
    messengerMocks.message.mockResolvedValue(message)
    render(<MessengerPage me={me} friends={[friend]} onOpenProfile={vi.fn()} />)
    await screen.findByText('Shared event')
    await waitFor(() => {
      expect(inboxListener).not.toBeNull()
      expect(conversationListener).not.toBeNull()
    })
    const conversationCallsBeforeEvent = messengerMocks.conversations.mock.calls.length
    const event: MessengerRealtimeEvent = {
      eventId: 'shared-event', kind: 'MESSAGE_ADDED', conversationId: message.conversationId,
      messageId: message.id, userId: friend.id, sequence: message.sequence,
      occurredAt: message.createdAt, expiresAt: null,
    }

    await act(async () => {
      conversationListener?.(event)
      inboxListener?.(event)
    })

    await waitFor(() => expect(messengerMocks.message).toHaveBeenCalledWith(message.id, me.id))
    await waitFor(() => expect(messengerMocks.conversations.mock.calls.length).toBeGreaterThan(conversationCallsBeforeEvent))
  })
})

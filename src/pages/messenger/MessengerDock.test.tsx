// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { MessengerDock, type MessengerDockHandle } from './MessengerDock'

const messengerMocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  messages: vi.fn(),
  message: vi.fn(),
  createDirectConversation: vi.fn(),
  createGroupConversation: vi.fn(),
  sendMessage: vi.fn(),
  presence: vi.fn(),
  markDelivered: vi.fn(),
  markRead: vi.fn(),
  setTyping: vi.fn(),
  subscribeInbox: vi.fn(),
  subscribeConversations: vi.fn(),
  subscribePresence: vi.fn(),
}))
const socialMocks = vi.hoisted(() => ({ getProfileRelationshipState: vi.fn() }))
const uploadMocks = vi.hoisted(() => ({
  uploadMediaFiles: vi.fn(),
  finalizePendingMedia: vi.fn(),
  cancelPendingMedia: vi.fn(),
}))
const soundMocks = vi.hoisted(() => ({
  playIncomingMessageSound: vi.fn(),
  playLikeSound: vi.fn(),
}))

vi.mock('../../api/messenger', () => ({ messengerApi: messengerMocks }))
vi.mock('../../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../../api/client', () => ({ api: uploadMocks }))
vi.mock('../../lib/sounds', () => soundMocks)
vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const me: UserSummary = {
  id: '1',
  username: 'me',
  displayName: 'Me',
  avatarUrl: null,
  isVerified: false,
}

function friend(id: string): UserSummary {
  return {
    id,
    username: `friend-${id}`,
    displayName: `Friend ${id}`,
    avatarUrl: null,
    isVerified: false,
  }
}

function directConversation(friendId: string): MessengerConversationDto {
  return {
    id: `conversation-${friendId}`,
    type: 'DIRECT',
    participants: [me, friend(friendId)],
    title: null,
    avatarUrl: null,
    updatedAt: '2026-07-18T00:00:00.000Z',
    unreadCount: 0,
    lastMessage: null,
  }
}

function groupConversation(friendIds: string[]): MessengerConversationDto {
  return {
    id: `group-${friendIds.join('-')}`,
    type: 'GROUP',
    participants: [me, ...friendIds.map(friend)],
    title: 'defaultGroupChatName',
    avatarUrl: null,
    updatedAt: '2026-07-18T00:00:00.000Z',
    unreadCount: 0,
    lastMessage: null,
  }
}

function Harness({ onOpenProfile = () => undefined, hidden = false, showComposeRail = false, layout = 'default', friends = [] }: { onOpenProfile?: (id: string) => void; hidden?: boolean; showComposeRail?: boolean; layout?: 'default' | 'media-viewer'; friends?: UserSummary[] } = {}) {
  const dock = useRef<MessengerDockHandle>(null)
  return <>
    {['2', '3', '4', '5'].map((id) => <button key={id} type="button" onClick={() => void dock.current?.openDirect(id)}>open-{id}</button>)}
    <MessengerDock
      ref={dock}
      me={me}
      friends={friends}
      panelOpen={false}
      hidden={hidden}
      showComposeRail={showComposeRail}
      layout={layout}
      onPanelClose={() => undefined}
      onOpenAll={() => undefined}
      onOpenProfile={onOpenProfile}
    />
  </>
}

function PanelHarness() {
  return <MessengerDock
    me={me}
    friends={[]}
    panelOpen
    onPanelClose={() => undefined}
    onOpenAll={() => undefined}
    onOpenProfile={() => undefined}
  />
}

function TogglePanelHarness({ open }: { open: boolean }) {
  return <MessengerDock
    me={me}
    friends={[]}
    panelOpen={open}
    onPanelClose={() => undefined}
    onOpenAll={() => undefined}
    onOpenProfile={() => undefined}
  />
}

describe('MessengerDock overflow windows', () => {
  let inboxListener: ((event: Record<string, string | null>) => void) | null
  let presenceListener: ((event: Record<string, string | null>) => void) | null
  const conversationListeners = new Map<string, (event: Record<string, string | null>) => void>()

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((file: File) => `blob:${file.name}`) })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    messengerMocks.conversations.mockReset().mockResolvedValue([])
    messengerMocks.messages.mockReset().mockResolvedValue([])
    messengerMocks.message.mockReset()
    messengerMocks.createDirectConversation.mockReset().mockImplementation(async (id: string) => directConversation(id))
    messengerMocks.createGroupConversation.mockReset()
    messengerMocks.sendMessage.mockReset()
    messengerMocks.presence.mockReset().mockResolvedValue([])
    messengerMocks.markDelivered.mockReset().mockResolvedValue(undefined)
    messengerMocks.markRead.mockReset().mockResolvedValue(undefined)
    messengerMocks.setTyping.mockReset().mockResolvedValue(undefined)
    inboxListener = null
    presenceListener = null
    conversationListeners.clear()
    messengerMocks.subscribeInbox.mockReset().mockImplementation((listener) => {
      inboxListener = listener
      return () => undefined
    })
    // One stream now carries every open chat, so the mock fans the single listener out
    // to each id the component asked for.
    messengerMocks.subscribeConversations.mockReset().mockImplementation((conversationIds, listener) => {
      conversationIds.forEach((conversationId: string) => conversationListeners.set(conversationId, listener))
      return () => conversationIds.forEach((conversationId: string) => conversationListeners.delete(conversationId))
    })
    messengerMocks.subscribePresence.mockReset().mockImplementation((_ids, listener) => {
      presenceListener = listener
      return () => undefined
    })
    uploadMocks.uploadMediaFiles.mockReset()
    uploadMocks.finalizePendingMedia.mockReset().mockResolvedValue(undefined)
    uploadMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
    soundMocks.playIncomingMessageSound.mockReset()
    soundMocks.playLikeSound.mockReset()
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({
      friendship: 'friend',
      isFollowing: false,
      followsViewer: false,
      isBlocked: false,
      isBlockedBy: false,
    })
  })

  afterEach(() => {
    cleanup()
    document.body.classList.remove('post-photo-viewer-open', 'reels-comments-open', 'mini-chat-bubble-rail-open')
    vi.unstubAllGlobals()
  })

  it('holds no realtime connections while hidden', async () => {
    // On /messenger the dock renders null and MessengerPage is mounted with its own
    // streams. Browsers cap connections per origin, so keeping these open would spend the
    // budget on something that cannot be displayed.
    render(<Harness hidden />)

    // The harness buttons render regardless of the dock, so finding one proves React has
    // committed and effects have run.
    await screen.findByRole('button', { name: 'open-2' })
    expect(messengerMocks.subscribeInbox).not.toHaveBeenCalled()
    expect(messengerMocks.subscribeConversations).not.toHaveBeenCalled()
    expect(messengerMocks.subscribePresence).not.toHaveBeenCalled()
  })

  it('always renders the compose rail with the home-aligned dock layout on Home', () => {
    const { container } = render(<Harness showComposeRail />)

    expect(screen.getByRole('button', { name: 'newMessage' })).toBeInTheDocument()
    expect(container.querySelector('.mini-chat-region')).toHaveClass('has-bubble-rail', 'home-compose-rail')
    expect(container.querySelector('.mini-chat-compose-icon')).toBeInTheDocument()
  })

  it('keeps the pinned compose button visible while the dock conversation panel is open', async () => {
    const { container } = render(<Harness showComposeRail friends={[friend('2')]} />)
    const composeButton = screen.getByRole('button', { name: 'newMessage' })

    fireEvent.click(composeButton)

    const panel = await screen.findByRole('dialog', { name: 'createConversation' })
    expect(panel).toHaveClass('mini-chat-window', 'new-conversation-window')
    expect(panel.closest('.mini-chat-windows')).toBeInTheDocument()
    expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument()
    expect(composeButton).toBeVisible()

    fireEvent.click(within(panel).getByRole('button', { name: 'close' }))
    expect(screen.queryByRole('dialog', { name: 'createConversation' })).not.toBeInTheDocument()
    expect(composeButton).toBeVisible()
  })

  it('waits for confirmation before opening the selected direct conversation', async () => {
    render(<Harness showComposeRail friends={[friend('2'), friend('3')]} />)
    fireEvent.click(screen.getByRole('button', { name: 'newMessage' }))
    const panel = await screen.findByRole('dialog', { name: 'createConversation' })
    const friendRow = within(panel).getByRole('button', { name: /Friend 2/ })
    const confirm = within(panel).getByRole('button', { name: 'confirmConversation' })

    expect(confirm).toBeDisabled()
    fireEvent.click(friendRow)
    expect(friendRow).toHaveAttribute('aria-pressed', 'true')
    expect(confirm).toBeEnabled()
    expect(messengerMocks.createDirectConversation).not.toHaveBeenCalled()

    fireEvent.click(confirm)

    await waitFor(() => expect(messengerMocks.createDirectConversation).toHaveBeenCalledWith('2', me.id))
    expect(messengerMocks.createGroupConversation).not.toHaveBeenCalled()
    expect(await screen.findByRole('region', { name: 'Friend 2' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'createConversation' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'newMessage' })).toBeVisible()
  })

  it('hides the floating message composer after the viewer blocks the direct participant', async () => {
    messengerMocks.createDirectConversation.mockResolvedValue({
      ...directConversation('2'),
      viewerHasBlockedDirectUser: true,
    })
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))

    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    expect(within(chat).getByText('messengerBlockedByYou')).toBeInTheDocument()
    expect(chat.querySelector('.mini-chat-compose')).not.toBeInTheDocument()
    expect(within(chat).queryByPlaceholderText('Aa')).not.toBeInTheDocument()
  })

  it('creates a default-named group after confirming multiple selected friends', async () => {
    const createdGroup = groupConversation(['2', '3'])
    messengerMocks.createGroupConversation.mockResolvedValue(createdGroup)
    render(<Harness showComposeRail friends={[friend('2'), friend('3')]} />)
    fireEvent.click(screen.getByRole('button', { name: 'newMessage' }))
    const panel = await screen.findByRole('dialog', { name: 'createConversation' })

    fireEvent.click(within(panel).getByRole('button', { name: /Friend 2/ }))
    fireEvent.click(within(panel).getByRole('button', { name: /Friend 3/ }))
    expect(messengerMocks.createGroupConversation).not.toHaveBeenCalled()
    fireEvent.click(within(panel).getByRole('button', { name: 'confirmConversation' }))

    await waitFor(() => expect(messengerMocks.createGroupConversation).toHaveBeenCalledWith('defaultGroupChatName', ['2', '3'], me.id))
    expect(messengerMocks.createDirectConversation).not.toHaveBeenCalled()
    expect(await screen.findByRole('region', { name: 'defaultGroupChatName' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'createConversation' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'newMessage' })).toBeVisible()
  })

  it('keeps three full windows and moves the least-recent chat into an avatar bubble', async () => {
    messengerMocks.createDirectConversation.mockImplementation(async (id: string) => ({
      ...directConversation(id),
      unreadCount: id === '2' ? 8 : 0,
    }))
    const { container } = render(<Harness />)

    for (const id of ['2', '3', '4']) {
      fireEvent.click(screen.getByRole('button', { name: `open-${id}` }))
      await screen.findByRole('region', { name: `Friend ${id}` })
    }
    expect(container.querySelectorAll('.mini-chat-window')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'open-5' }))
    await screen.findByRole('region', { name: 'Friend 5' })

    expect(container.querySelectorAll('.mini-chat-window')).toHaveLength(3)
    expect(screen.queryByRole('region', { name: 'Friend 2' })).not.toBeInTheDocument()
    const oldestBubble = screen.getByRole('button', { name: 'messages: Friend 2' })
    expect(oldestBubble).toHaveClass('mini-chat-overflow-avatar')
    expect(oldestBubble.querySelector('b')).not.toBeInTheDocument()

    fireEvent.click(oldestBubble)

    await screen.findByRole('region', { name: 'Friend 2' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'messages: Friend 3' })).toBeInTheDocument())
    expect(container.querySelectorAll('.mini-chat-window')).toHaveLength(3)
  })

  it('turns the minimize action into an avatar bubble and restores it on click', async () => {
    const { container } = render(<Harness />)
    expect(container.querySelector('.mini-chat-bubble-rail')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('mini-chat-bubble-rail-open')

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })

    fireEvent.click(within(chat).getByRole('button', { name: 'minimize' }))

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Friend 2' })).not.toBeInTheDocument())
    expect(container.querySelector('.mini-chat-bubble-rail')).toBeInTheDocument()
    expect(document.body).toHaveClass('mini-chat-bubble-rail-open')
    const bubble = screen.getByRole('button', { name: 'messages: Friend 2' })
    fireEvent.click(bubble)
    expect(await screen.findByRole('region', { name: 'Friend 2' })).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.mini-chat-bubble-rail')).not.toBeInTheDocument())
    expect(document.body).not.toHaveClass('mini-chat-bubble-rail-open')
  })

  it('keeps the real online presence indicator on a minimized chat avatar', async () => {
    messengerMocks.presence.mockResolvedValue([{
      userId: '2',
      isOnline: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      updatedAt: new Date().toISOString(),
    }])
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    await waitFor(() => expect(messengerMocks.presence).toHaveBeenCalledWith(['2']))
    fireEvent.click(within(chat).getByRole('button', { name: 'minimize' }))

    const bubble = await screen.findByRole('button', { name: 'messages: Friend 2' })
    expect(bubble.querySelector('.avatar-dot')).toBeInTheDocument()
  })

  it('keeps one full chat and shows the compose rail while the photo viewer is open', async () => {
    document.body.classList.add('post-photo-viewer-open')
    const { container } = render(<Harness />)
    expect(container.querySelector('.mini-chat-bubble-rail')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'newMessage' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    expect(await screen.findByRole('region', { name: 'Friend 2' })).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.mini-chat-bubble-rail')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'newMessage' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'messages: Friend 2' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'open-3' }))
    expect(await screen.findByRole('region', { name: 'Friend 3' })).toBeInTheDocument()
    expect(container.querySelectorAll('.mini-chat-window')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'messages: Friend 2' })).toBeInTheDocument()
  })

  it('uses the same one-window compose rail when a media route requests the photo-viewer layout', async () => {
    const { container } = render(<Harness layout="media-viewer" />)

    expect(container.querySelector('.mini-chat-region')).toHaveClass('media-viewer-compose-rail')
    expect(container.querySelector('.mini-chat-region')).not.toHaveClass('has-bubble-rail')
    expect(container.querySelector('.mini-chat-region')).toHaveAttribute('data-layout', 'media-viewer')
    expect(screen.queryByRole('button', { name: 'newMessage' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    expect(await screen.findByRole('region', { name: 'Friend 2' })).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.mini-chat-region')).toHaveClass('has-bubble-rail'))
    expect(screen.getByRole('button', { name: 'newMessage' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'open-3' }))
    expect(await screen.findByRole('region', { name: 'Friend 3' })).toBeInTheDocument()
    expect(container.querySelectorAll('.mini-chat-window')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'messages: Friend 2' })).toBeInTheDocument()
  })

  it('adds and removes the media chat rail together with the Reel comments sidebar', async () => {
    const { container } = render(<Harness />)
    expect(container.querySelector('.mini-chat-region')).not.toHaveClass('media-viewer-compose-rail')

    document.body.classList.add('reels-comments-open')
    await waitFor(() => expect(container.querySelector('.mini-chat-region')).toHaveClass('media-viewer-compose-rail'))
    expect(container.querySelector('.mini-chat-region')).not.toHaveClass('has-bubble-rail')
    expect(screen.queryByRole('button', { name: 'newMessage' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    expect(await screen.findByRole('region', { name: 'Friend 2' })).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.mini-chat-region')).toHaveClass('has-bubble-rail'))
    expect(screen.getByRole('button', { name: 'newMessage' })).toBeInTheDocument()

    document.body.classList.remove('reels-comments-open')
    await waitFor(() => expect(container.querySelector('.mini-chat-region')).not.toHaveClass('has-bubble-rail', 'media-viewer-compose-rail'))
    expect(screen.queryByRole('button', { name: 'newMessage' })).not.toBeInTheDocument()
  })

  it('shows the current friendship state in the conversation introduction', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    expect(await screen.findByText('friendsOnFakebook')).toBeInTheDocument()

    cleanup()
    socialMocks.getProfileRelationshipState.mockResolvedValue({
      friendship: 'none',
      isFollowing: false,
      followsViewer: false,
      isBlocked: false,
      isBlockedBy: false,
    })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    expect(await screen.findByText('notFriendsOnFakebook')).toBeInTheDocument()
  })

  it('shows sent text on the newest pending message and the reader avatar on the newest read message', async () => {
    messengerMocks.messages.mockResolvedValue([
      {
        id: 'read-message', conversationId: 'conversation-2', sequence: '1', sender: me, body: 'Đã đọc',
        createdAt: '2026-07-18T00:00:00Z', status: 'read', attachments: [], reactions: [], deleted: false,
      },
      {
        id: 'sent-message', conversationId: 'conversation-2', sequence: '2', sender: me, body: 'Mới gửi',
        createdAt: '2026-07-18T00:01:00Z', status: 'sent', attachments: [], reactions: [], deleted: false,
      },
    ])
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })

    expect(await within(chat).findByText('Đã gửi')).toBeInTheDocument()
    expect(chat.querySelector('[title="Friend 2 đã xem"]')).toBeInTheDocument()
    expect(messengerMocks.markRead).not.toHaveBeenCalled()
  })

  it('keeps a mini chat pinned to the bottom when reply opens there', async () => {
    const messages: MessengerMessageDto[] = [
      {
        id: 'message-1', conversationId: 'conversation-2', sequence: '1', sender: friend('2'), body: 'First',
        createdAt: '2026-07-18T00:00:00Z', status: 'read', attachments: [], reactions: [], deleted: false,
      },
      {
        id: 'message-2', conversationId: 'conversation-2', sequence: '2', sender: me, body: 'Latest',
        createdAt: '2026-07-18T00:01:00Z', status: 'read', attachments: [], reactions: [], deleted: false,
      },
    ]
    messengerMocks.messages.mockResolvedValue(messages)
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    await within(chat).findByText('Latest')
    const list = chat.querySelector<HTMLElement>('.mini-chat-messages')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1_000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 300 })
    list.scrollTop = 700

    const replyButtons = chat.querySelectorAll<HTMLButtonElement>('.message-action-button.reply')
    fireEvent.click(replyButtons[replyButtons.length - 1])

    expect(chat.querySelector('.mini-replying-bar')).toBeInTheDocument()
    expect(list.scrollTop).toBe(1_000)
  })

  it('navigates from a mini chat reply preview to the original message', async () => {
    const messages: MessengerMessageDto[] = [
      {
        id: 'original', conversationId: 'conversation-2', sequence: '1', sender: friend('2'), body: 'Original',
        createdAt: '2026-07-18T00:00:00Z', status: 'read', attachments: [], reactions: [], deleted: false,
      },
      {
        id: 'reply', conversationId: 'conversation-2', sequence: '2', sender: me, body: 'Reply', replyToMessageId: 'original',
        createdAt: '2026-07-18T00:01:00Z', status: 'read', attachments: [], reactions: [], deleted: false,
      },
    ]
    messengerMocks.messages.mockResolvedValue(messages)
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    await within(chat).findByText('Reply')
    const original = chat.querySelector<HTMLElement>('[data-message-id="original"]')!
    const scrollIntoView = vi.fn()
    Object.defineProperty(original, 'scrollIntoView', { configurable: true, value: scrollIntoView })

    fireEvent.click(chat.querySelector<HTMLElement>('.message-reply-source[role="button"]')!)

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(original).toHaveClass('reply-navigation-target')
  })

  it('opens and promotes a chat when an incoming message arrives', async () => {
    const incomingMessage: MessengerMessageDto = {
      id: 'message-1', conversationId: 'conversation-2', sequence: '1', sender: friend('2'), body: 'Incoming',
      createdAt: '2026-07-18T00:00:00Z', status: 'delivered', attachments: [], reactions: [], deleted: false,
    }
    const incomingConversation = { ...directConversation('2'), unreadCount: 1, lastMessage: incomingMessage }
    messengerMocks.conversations.mockResolvedValue([incomingConversation])
    messengerMocks.messages.mockResolvedValue([incomingMessage])
    render(<Harness />)
    await waitFor(() => expect(inboxListener).not.toBeNull())

    await act(async () => {
      inboxListener?.({
        eventId: 'incoming-1',
        kind: 'MESSAGE_ADDED',
        conversationId: incomingConversation.id,
        messageId: 'message-1',
        userId: '2',
        sequence: '1',
        occurredAt: '2026-07-18T00:00:00Z',
        expiresAt: null,
      })
    })

    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    expect(chat).toHaveClass('has-attention')
    expect(messengerMocks.messages).toHaveBeenCalledWith(incomingConversation.id, me.id)
    expect(soundMocks.playIncomingMessageSound).toHaveBeenCalledTimes(1)
    expect(messengerMocks.markRead).not.toHaveBeenCalled()

    await within(chat).findByText('Incoming')
    fireEvent.click(within(chat).getByPlaceholderText('Aa'))
    await waitFor(() => expect(messengerMocks.markRead).toHaveBeenCalledWith(incomingConversation.id, '1'))
    await waitFor(() => expect(chat).not.toHaveClass('has-attention'))
  })

  it('does not mark an automatically opened incoming chat read from minimize', async () => {
    const incomingMessage: MessengerMessageDto = {
      id: 'message-controls', conversationId: 'conversation-2', sequence: '7', sender: friend('2'), body: 'Unread controls',
      createdAt: '2026-07-18T00:00:00Z', status: 'delivered', attachments: [], reactions: [], deleted: false,
    }
    const incomingConversation = { ...directConversation('2'), unreadCount: 1, lastMessage: incomingMessage }
    messengerMocks.conversations.mockResolvedValue([incomingConversation])
    messengerMocks.messages.mockResolvedValue([incomingMessage])
    render(<Harness />)
    await waitFor(() => expect(inboxListener).not.toBeNull())

    await act(async () => {
      inboxListener?.({
        eventId: 'incoming-controls', kind: 'MESSAGE_ADDED', conversationId: incomingConversation.id,
        messageId: incomingMessage.id, userId: '2', sequence: '7', occurredAt: incomingMessage.createdAt, expiresAt: null,
      })
    })
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    await within(chat).findByText('Unread controls')

    fireEvent.click(within(chat).getByRole('button', { name: 'minimize' }))
    expect(messengerMocks.markRead).not.toHaveBeenCalled()
  })

  it('shows unread state and a rich hover preview on a bubble and lets the bubble be closed directly', async () => {
    const incomingMessage: MessengerMessageDto = {
      id: 'message-bubble', conversationId: 'conversation-2', sequence: '9', sender: friend('2'), body: 'Nội dung mới nhất',
      createdAt: '2026-07-18T00:00:00Z', status: 'delivered', attachments: [], reactions: [], deleted: false,
    }
    const incomingConversation = { ...directConversation('2'), unreadCount: 3, lastMessage: incomingMessage }
    messengerMocks.conversations.mockResolvedValue([incomingConversation])
    messengerMocks.messages.mockResolvedValue([incomingMessage])
    render(<Harness />)
    await waitFor(() => expect(inboxListener).not.toBeNull())

    await act(async () => {
      inboxListener?.({
        eventId: 'incoming-bubble', kind: 'MESSAGE_ADDED', conversationId: incomingConversation.id,
        messageId: incomingMessage.id, userId: '2', sequence: '9', occurredAt: incomingMessage.createdAt, expiresAt: null,
      })
    })
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    fireEvent.click(within(chat).getByRole('button', { name: 'minimize' }))

    const bubble = await screen.findByRole('button', { name: 'messages: Friend 2' })
    const bubbleItem = bubble.closest('.mini-chat-bubble-item') as HTMLElement
    expect(bubbleItem).toHaveClass('has-unread')
    expect(within(bubbleItem).getByText('3')).toHaveClass('mini-chat-bubble-unread-count')
    expect(bubble.querySelector('.avatar')).not.toHaveAttribute('title')

    fireEvent.mouseEnter(bubbleItem)
    const preview = document.querySelector('.mini-chat-bubble-preview') as HTMLElement
    expect(preview).toHaveTextContent('Friend 2')
    expect(preview).toHaveTextContent('Nội dung mới nhất')
    expect(preview.querySelector('.mini-chat-bubble-preview-unread')).toBeInTheDocument()

    const dismiss = within(bubbleItem).getByRole('button', { name: 'close: Friend 2' })
    expect(dismiss.querySelector('.mini-chat-bubble-close-circle')).toBeInTheDocument()
    fireEvent.click(dismiss)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'messages: Friend 2' })).not.toBeInTheDocument())
    expect(document.querySelector('.mini-chat-bubble-preview')).not.toBeInTheDocument()
    expect(document.querySelector('.mini-chat-bubble-rail')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('mini-chat-bubble-rail-open')
    expect(messengerMocks.markRead).not.toHaveBeenCalled()
  })

  it('summarizes own media and reaction activity in the bubble preview without bolding the prefix', async () => {
    const mediaMessage: MessengerMessageDto = {
      id: 'own-media', conversationId: 'conversation-2', sequence: '10', sender: me, body: '',
      createdAt: '2026-07-18T00:00:00Z', status: 'sent', reactions: [], deleted: false,
      attachments: [{ url: '/photo.jpg', type: 'image', contentType: 'image/jpeg', size: 12, name: 'photo.jpg' }],
    }
    messengerMocks.createDirectConversation.mockResolvedValue({ ...directConversation('2'), lastMessage: mediaMessage })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    fireEvent.click(within(chat).getByRole('button', { name: 'minimize' }))
    const mediaBubbleItem = (await screen.findByRole('button', { name: 'messages: Friend 2' })).closest('.mini-chat-bubble-item') as HTMLElement
    fireEvent.mouseEnter(mediaBubbleItem)
    let preview = document.querySelector('.mini-chat-bubble-preview') as HTMLElement
    expect(preview.querySelector('.mini-chat-bubble-preview-own')).toHaveTextContent('you:')
    expect(preview.querySelector('.mini-chat-bubble-preview-message')).toHaveTextContent('sentPhotoPreview')
    fireEvent.mouseLeave(mediaBubbleItem)

    const reactedMessage: MessengerMessageDto = {
      ...mediaMessage,
      id: 'reacted-message',
      conversationId: 'conversation-3',
      body: 'Original message',
      sender: friend('3'),
      reactions: [{ userId: me.id, emoji: '❤️', updatedAt: '2026-07-18T00:01:00Z' }],
    }
    messengerMocks.createDirectConversation.mockResolvedValue({ ...directConversation('3'), lastMessage: reactedMessage })
    fireEvent.click(screen.getByRole('button', { name: 'open-3' }))
    const reactedChat = await screen.findByRole('region', { name: 'Friend 3' })
    fireEvent.click(within(reactedChat).getByRole('button', { name: 'minimize' }))
    const reactionBubbleItem = (await screen.findByRole('button', { name: 'messages: Friend 3' })).closest('.mini-chat-bubble-item') as HTMLElement
    fireEvent.mouseEnter(reactionBubbleItem)
    preview = document.querySelector('.mini-chat-bubble-preview') as HTMLElement
    expect(preview.querySelector('.mini-chat-bubble-preview-own')).toHaveTextContent('you:')
    expect(preview.querySelector('.mini-chat-bubble-preview-message')).toHaveTextContent('reactedToMessagePreview')
  })

  it('does not mark an automatically opened incoming chat read from close', async () => {
    const incomingMessage: MessengerMessageDto = {
      id: 'message-close', conversationId: 'conversation-2', sequence: '8', sender: friend('2'), body: 'Unread close',
      createdAt: '2026-07-18T00:00:00Z', status: 'delivered', attachments: [], reactions: [], deleted: false,
    }
    const incomingConversation = { ...directConversation('2'), unreadCount: 1, lastMessage: incomingMessage }
    messengerMocks.conversations.mockResolvedValue([incomingConversation])
    messengerMocks.messages.mockResolvedValue([incomingMessage])
    render(<Harness />)
    await waitFor(() => expect(inboxListener).not.toBeNull())

    await act(async () => {
      inboxListener?.({
        eventId: 'incoming-close', kind: 'MESSAGE_ADDED', conversationId: incomingConversation.id,
        messageId: incomingMessage.id, userId: '2', sequence: '8', occurredAt: incomingMessage.createdAt, expiresAt: null,
      })
    })
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    await within(chat).findByText('Unread close')

    fireEvent.click(within(chat).getByRole('button', { name: 'close' }))
    expect(messengerMocks.markRead).not.toHaveBeenCalled()
  })

  it('opens a profile only from the header avatar, not from the name', async () => {
    const onOpenProfile = vi.fn()
    render(<Harness onOpenProfile={onOpenProfile} />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })

    fireEvent.click(chat.querySelector('.mini-chat-name')!)
    expect(onOpenProfile).not.toHaveBeenCalled()
    fireEvent.click(chat.querySelector('.mini-chat-id')!)
    expect(onOpenProfile).toHaveBeenCalledWith('2')
  })

  it('keeps the compact panel free of unread-number badges and the extra filter menu', async () => {
    const updatedAt = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString()
    const preview: MessengerMessageDto = {
      id: 'panel-message', conversationId: 'conversation-2', sequence: '4', sender: friend('2'), body: 'Panel preview',
      createdAt: updatedAt, status: 'delivered', attachments: [], reactions: [], deleted: false,
    }
    messengerMocks.conversations.mockResolvedValue([{
      ...directConversation('2'), updatedAt, unreadCount: 4, lastMessage: preview,
    }])
    render(<PanelHarness />)

    const dialog = await screen.findByRole('dialog', { name: 'messages' })
    const row = await within(dialog).findByRole('button', { name: /Friend 2/ })
    expect(row.querySelector('b')).not.toBeInTheDocument()
    expect(row.querySelector('.avatar')).toHaveStyle({ width: '48px', height: '48px' })
    expect(within(row).getByText(/2 tuần trước/)).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: 'messengerSettings' })).toHaveLength(1)
  })

  it('refreshes the complete conversation list every time the header panel reopens', async () => {
    const group = groupConversation(['3'])
    const direct = directConversation('2')
    messengerMocks.conversations
      .mockResolvedValueOnce([group])
      .mockResolvedValueOnce([direct, group])
    const { rerender } = render(<TogglePanelHarness open />)

    await screen.findByRole('button', { name: /defaultGroupChatName/ })
    expect(messengerMocks.conversations).toHaveBeenLastCalledWith('1', 100)

    rerender(<TogglePanelHarness open={false} />)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'messages' })).not.toBeInTheDocument())
    rerender(<TogglePanelHarness open />)

    expect(await screen.findByRole('button', { name: /Friend 2/ })).toBeInTheDocument()
    expect(messengerMocks.conversations).toHaveBeenCalledTimes(2)
  })

  it('shows the attachment kind instead of the empty-conversation fallback for a media-only latest message', async () => {
    const latest: MessengerMessageDto = {
      id: 'panel-audio', conversationId: 'conversation-2', sequence: '5', sender: friend('2'), body: '',
      createdAt: new Date().toISOString(), status: 'delivered', reactions: [], deleted: false,
      attachments: [{ url: '/voice.webm', type: 'audio', contentType: 'audio/webm', size: 10, name: 'voice.webm' }],
    }
    messengerMocks.conversations.mockResolvedValue([{ ...directConversation('2'), lastMessage: latest }])
    render(<PanelHarness />)

    const dialog = await screen.findByRole('dialog', { name: 'messages' })
    expect(await within(dialog).findByText(/sentVoicePreview/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/startConversation/)).not.toBeInTheDocument()
  })

  it('uses real presence and displays realtime typing without refetching messages', async () => {
    const lastActiveAt = new Date(Date.now() - 35 * 60_000).toISOString()
    messengerMocks.presence.mockResolvedValue([{
      userId: '2',
      isOnline: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      updatedAt: lastActiveAt,
    }])
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    await waitFor(() => expect(presenceListener).not.toBeNull())
    await waitFor(() => expect(conversationListeners.get('conversation-2')).toBeDefined())
    const messageCallsBeforeTyping = messengerMocks.messages.mock.calls.length

    act(() => {
      presenceListener?.({
        eventId: 'presence-offline-1',
        kind: 'PRESENCE_CHANGED',
        conversationId: null,
        messageId: null,
        userId: '2',
        sequence: null,
        occurredAt: new Date().toISOString(),
        expiresAt: null,
      })
    })
    expect(within(chat).getByText('activeMinutesAgo')).toBeInTheDocument()

    act(() => {
      presenceListener?.({
        eventId: 'presence-online-1',
        kind: 'PRESENCE_CHANGED',
        conversationId: null,
        messageId: null,
        userId: '2',
        sequence: null,
        occurredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    })
    expect(within(chat).getByText('activeNow')).toBeInTheDocument()

    act(() => {
      conversationListeners.get('conversation-2')?.({
        eventId: 'typing-1',
        kind: 'TYPING_CHANGED',
        conversationId: 'conversation-2',
        messageId: null,
        userId: '2',
        sequence: null,
        occurredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8_000).toISOString(),
      })
    })

    expect(within(chat).getByText('typingNow')).toBeInTheDocument()
    expect(within(chat).getByLabelText('Friend 2 typingNow')).toBeInTheDocument()
    expect(messengerMocks.messages.mock.calls.length).toBe(messageCallsBeforeTyping)

    fireEvent.change(within(chat).getByPlaceholderText('Aa'), { target: { value: 'Hi' } })
    await waitFor(() => expect(messengerMocks.setTyping).toHaveBeenCalledWith('conversation-2', true))
  })

  it('collapses the three composer tools into a plus after the first character', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    const textarea = within(chat).getByPlaceholderText('Aa')

    expect(within(chat).getByRole('button', { name: 'recordVoice' })).toBeInTheDocument()
    expect(within(chat).getByLabelText('addAttachment')).toBeInTheDocument()
    expect(within(chat).getByRole('button', { name: 'stickers' })).toBeInTheDocument()
    expect(chat.querySelector('.mini-compose-more-btn')).not.toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'H' } })

    expect(chat.querySelector('.mini-chat-compose')).toHaveClass('is-writing')
    const more = chat.querySelector<HTMLButtonElement>('.mini-compose-more-btn')!
    expect(more).toBeInTheDocument()
    expect(within(chat).queryByRole('button', { name: 'recordVoice' })).not.toBeInTheDocument()

    fireEvent.click(more)
    const menu = within(chat).getByRole('group', { name: 'more' })
    expect(within(menu).getByRole('button', { name: 'recordVoice' })).toBeInTheDocument()
    expect(within(menu).getByLabelText('addAttachment')).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'stickers' })).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: '' } })
    expect(chat.querySelector('.mini-chat-compose')).not.toHaveClass('is-writing')
    expect(chat.querySelector('.mini-compose-more-btn')).not.toBeInTheDocument()
    expect(within(chat).getByRole('button', { name: 'recordVoice' })).toBeInTheDocument()
  })

  it('grows the message textarea upward to eight lines, then scrolls without a visible bar', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    const textarea = within(chat).getByPlaceholderText('Aa') as HTMLTextAreaElement
    let measuredHeight = 36
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => measuredHeight })

    measuredHeight = 420
    fireEvent.change(textarea, { target: { value: Array.from({ length: 10 }, (_, index) => `line ${index}`).join('\n') } })
    expect(Number.parseFloat(textarea.style.height)).toBeGreaterThan(36)
    expect(Number.parseFloat(textarea.style.height)).toBeLessThan(420)
    expect(textarea.style.overflowY).toBe('auto')

    measuredHeight = 36
    fireEvent.change(textarea, { target: { value: 'short' } })
    expect(textarea.style.height).toBe('36px')
    expect(textarea.style.overflowY).toBe('hidden')
  })

  it('sends with Enter while Shift+Enter remains available for a new line', async () => {
    messengerMocks.sendMessage.mockResolvedValue({
      id: 'sent-text', conversationId: 'conversation-2', sender: me, body: 'Hello',
      createdAt: new Date().toISOString(), status: 'sent', attachments: [],
    })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    const textarea = within(chat).getByPlaceholderText('Aa')
    fireEvent.change(textarea, { target: { value: 'Hello' } })

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(messengerMocks.sendMessage).not.toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => expect(messengerMocks.sendMessage).toHaveBeenCalledWith(
      'conversation-2', me, expect.objectContaining({ body: 'Hello' }),
    ))
  })

  it('records, uploads and sends a real voice message from the microphone control', async () => {
    const stopTrack = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
    })
    class FakeMediaRecorder {
      static isTypeSupported() { return true }
      state: RecordingState = 'inactive'
      mimeType: string
      private listeners = new Map<string, Array<(event: { data: Blob }) => void>>()
      constructor(_stream: MediaStream, options: MediaRecorderOptions) { this.mimeType = options.mimeType ?? 'audio/webm' }
      addEventListener(name: string, listener: EventListenerOrEventListenerObject) {
        const callback = listener as unknown as (event: { data: Blob }) => void
        this.listeners.set(name, [...(this.listeners.get(name) ?? []), callback])
      }
      start() { this.state = 'recording' }
      stop() {
        this.state = 'inactive'
        this.listeners.get('dataavailable')?.forEach((listener) => listener({ data: new Blob(['voice'], { type: 'audio/webm' }) }))
        this.listeners.get('stop')?.forEach((listener) => listener({ data: new Blob() }))
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    uploadMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'http://localhost/media/files/voice.webm',
      type: 'audio',
      contentType: 'audio/webm',
      size: 5,
      name: 'voice.webm',
      assetId: 'voice-asset',
      state: 'pending',
    }])
    messengerMocks.sendMessage.mockResolvedValue({
      id: 'voice-message',
      conversationId: 'conversation-2',
      sender: me,
      body: '',
      createdAt: new Date().toISOString(),
      status: 'sent',
      attachments: [],
    })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })

    fireEvent.click(within(chat).getByRole('button', { name: 'recordVoice' }))
    expect(await within(chat).findByRole('button', { name: 'cancel' })).toBeInTheDocument()
    expect(within(chat).getByRole('button', { name: 'sendMessage' })).toBeInTheDocument()
    expect(within(chat).getByText('0:00')).toBeInTheDocument()
    expect(within(chat).getByRole('progressbar', { name: 'recordVoice 4:00' })).toHaveAttribute('aria-valuemax', '240000')
    expect(chat.querySelector('.mini-chat-voice-compose')).toBeInTheDocument()
    fireEvent.click(await within(chat).findByRole('button', { name: 'stopRecording' }))

    await waitFor(() => expect(uploadMocks.uploadMediaFiles).toHaveBeenCalled())
    await waitFor(() => expect(messengerMocks.sendMessage).toHaveBeenCalledWith(
      'conversation-2',
      me,
      expect.objectContaining({ attachments: [expect.objectContaining({ type: 'audio', mediaType: 'audio', url: expect.not.stringContaining('kind=audio') })] }),
    ))
    expect(stopTrack).toHaveBeenCalled()
  })

  it('shows selected photos inside the composer instead of a detached filename strip', async () => {
    uploadMocks.uploadMediaFiles.mockReturnValue(new Promise(() => undefined))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    const attachmentControl = within(chat).getByLabelText('addAttachment')
    const input = attachmentControl instanceof HTMLInputElement
      ? attachmentControl
      : attachmentControl.querySelector<HTMLInputElement>('input')!

    fireEvent.change(input, { target: { files: [new File(['image'], 'preview.png', { type: 'image/png' })] } })

    const preview = await within(chat).findByRole('img', { name: 'preview.png' })
    expect(preview).toHaveAttribute('src', 'blob:preview.png')
    expect(preview.closest('.mini-compose-body')).toBeInTheDocument()
    expect(within(chat).queryByText('preview.png')).not.toBeInTheDocument()
    expect(uploadMocks.uploadMediaFiles).not.toHaveBeenCalled()
    expect(within(chat).getByRole('button', { name: 'removeMedia' })).toBeInTheDocument()

    fireEvent.click(within(chat).getByRole('button', { name: 'sendMessage' }))

    await waitFor(() => expect(uploadMocks.uploadMediaFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'preview.png', type: 'image/png' }),
    ]))
  })

  it('pastes a copied image into the floating chat attachment preview', async () => {
    uploadMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'http://localhost/media/files/clipboard.png',
      type: 'image', contentType: 'image/png', size: 12, name: 'clipboard.png',
      assetId: 'clipboard-asset', state: 'pending',
    }])
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    const image = new File(['clipboard'], 'clipboard.png', { type: 'image/png' })

    fireEvent.paste(within(chat).getByPlaceholderText('Aa'), { clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      files: [image],
      getData: () => 'https://example.com/clipboard.png',
    } })

    expect(uploadMocks.uploadMediaFiles).not.toHaveBeenCalled()
    expect(await within(chat).findByRole('img', { name: 'clipboard.png' })).toBeInTheDocument()
  })
})

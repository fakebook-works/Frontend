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
  markRead: vi.fn(),
  setTyping: vi.fn(),
  subscribeInbox: vi.fn(),
  subscribeConversation: vi.fn(),
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

function Harness({ onOpenProfile = () => undefined }: { onOpenProfile?: (id: string) => void } = {}) {
  const dock = useRef<MessengerDockHandle>(null)
  return <>
    {['2', '3', '4', '5'].map((id) => <button key={id} type="button" onClick={() => void dock.current?.openDirect(id)}>open-{id}</button>)}
    <MessengerDock
      ref={dock}
      me={me}
      friends={[]}
      panelOpen={false}
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

describe('MessengerDock overflow windows', () => {
  let inboxListener: ((event: Record<string, string | null>) => void) | null
  let presenceListener: ((event: Record<string, string | null>) => void) | null
  const conversationListeners = new Map<string, (event: Record<string, string | null>) => void>()

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    messengerMocks.conversations.mockReset().mockResolvedValue([])
    messengerMocks.messages.mockReset().mockResolvedValue([])
    messengerMocks.message.mockReset()
    messengerMocks.createDirectConversation.mockReset().mockImplementation(async (id: string) => directConversation(id))
    messengerMocks.createGroupConversation.mockReset()
    messengerMocks.sendMessage.mockReset()
    messengerMocks.presence.mockReset().mockResolvedValue([])
    messengerMocks.markRead.mockReset().mockResolvedValue(undefined)
    messengerMocks.setTyping.mockReset().mockResolvedValue(undefined)
    inboxListener = null
    presenceListener = null
    conversationListeners.clear()
    messengerMocks.subscribeInbox.mockReset().mockImplementation((listener) => {
      inboxListener = listener
      return () => undefined
    })
    messengerMocks.subscribeConversation.mockReset().mockImplementation((conversationId, listener) => {
      conversationListeners.set(conversationId, listener)
      return () => conversationListeners.delete(conversationId)
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
    vi.unstubAllGlobals()
  })

  it('keeps three full windows and moves the least-recent chat into an avatar bubble', async () => {
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

    fireEvent.click(oldestBubble)

    await screen.findByRole('region', { name: 'Friend 2' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'messages: Friend 3' })).toBeInTheDocument())
    expect(container.querySelectorAll('.mini-chat-window')).toHaveLength(3)
  })

  it('turns the minimize action into an avatar bubble and restores it on click', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })

    fireEvent.click(within(chat).getByRole('button', { name: 'minimize' }))

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Friend 2' })).not.toBeInTheDocument())
    const bubble = screen.getByRole('button', { name: 'messages: Friend 2' })
    fireEvent.click(bubble)
    expect(await screen.findByRole('region', { name: 'Friend 2' })).toBeInTheDocument()
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
    uploadMocks.uploadMediaFiles.mockResolvedValue([{
      url: 'http://localhost/media/files/preview.png',
      type: 'image',
      contentType: 'image/png',
      size: 12,
      name: 'preview.png',
      assetId: 'preview-asset',
      state: 'pending',
    }])
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open-2' }))
    const chat = await screen.findByRole('region', { name: 'Friend 2' })
    const attachmentControl = within(chat).getByLabelText('addAttachment')
    const input = attachmentControl instanceof HTMLInputElement
      ? attachmentControl
      : attachmentControl.querySelector<HTMLInputElement>('input')!

    fireEvent.change(input, { target: { files: [new File(['image'], 'preview.png', { type: 'image/png' })] } })

    const preview = await within(chat).findByRole('img', { name: 'preview.png' })
    expect(preview.closest('.mini-compose-body')).toBeInTheDocument()
    expect(within(chat).queryByText('preview.png')).not.toBeInTheDocument()
    expect(within(chat).getByRole('button', { name: 'removeMedia' })).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { MessageThread } from './MessageThread'

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const me: UserSummary = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
const friend: UserSummary = { id: 'friend', username: 'friend', displayName: 'Friend', avatarUrl: null }
const conversation: MessengerConversationDto = {
  id: 'conversation-1',
  type: 'DIRECT',
  participants: [me, friend],
  title: null,
  avatarUrl: null,
  updatedAt: '2026-07-19T00:00:00.000Z',
  unreadCount: 0,
  lastMessage: null,
}

function makeMessage(id: string, sender: UserSummary, body: string, replyToMessageId?: string): MessengerMessageDto {
  return {
    id,
    conversationId: conversation.id,
    sequence: id === 'original' ? '1' : '2',
    sender,
    body,
    replyToMessageId,
    createdAt: '2026-07-19T00:00:00.000Z',
    status: 'read',
    attachments: [],
    reactions: [],
    deleted: false,
  }
}

function Harness({
  messages,
  onEditMessage = () => undefined,
  onAttachFiles = () => undefined,
  initialComposeError = null,
}: {
  messages: MessengerMessageDto[]
  onEditMessage?: (message: MessengerMessageDto, text: string) => void | Promise<void>
  onAttachFiles?: (files: FileList | File[] | null) => void | Promise<void>
  initialComposeError?: string | null
}) {
  const [replyTarget, setReplyTarget] = useState<MessengerMessageDto | null>(null)
  const [composeError, setComposeError] = useState<string | null>(initialComposeError)
  return <MessageThread
    me={me}
    conversation={conversation}
    messages={messages}
    draft=""
    pendingAttachments={[]}
    pendingUploadPreviews={[]}
    uploading={false}
    apiState="gateway"
    showDetail={false}
    typingUserId={null}
    replyTarget={replyTarget}
    onInteract={() => undefined}
    onDraftChange={() => undefined}
    composeError={composeError}
    onComposeErrorChange={setComposeError}
    onAttachFiles={onAttachFiles}
    onRemoveAttachment={() => undefined}
    onRemovePendingUpload={() => undefined}
    onSubmit={(event) => event.preventDefault()}
    onSendLike={() => undefined}
    onReplyMessage={setReplyTarget}
    onCancelReply={() => setReplyTarget(null)}
    onReactMessage={() => undefined}
    onRecallMessage={() => undefined}
    onEditMessage={onEditMessage}
    onForwardMessage={() => undefined}
    onOpenProfile={() => undefined}
    onToggleDetail={() => undefined}
    onBack={() => undefined}
  />
}

function setScrollGeometry(element: HTMLElement, scrollHeight: number, clientHeight: number, scrollTop: number) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight })
  element.scrollTop = scrollTop
}

describe('MessageThread reply navigation', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(cleanup)

  it('routes a copied binary image through the normal attachment callback', () => {
    const onAttachFiles = vi.fn()
    render(<Harness messages={[]} onAttachFiles={onAttachFiles} />)
    const image = new File(['clipboard'], 'messenger-clipboard.png', { type: 'image/png' })

    fireEvent.paste(screen.getByPlaceholderText('Aa'), { clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      files: [image],
      getData: () => 'https://example.com/messenger-clipboard.png',
    } })

    expect(onAttachFiles).toHaveBeenCalledWith([image])
  })

  it('applies the canonical message limit and renders the conversation-scoped error', () => {
    render(<Harness messages={[]} initialComposeError="inputTooLong" />)

    expect(screen.getByPlaceholderText('Aa')).not.toHaveAttribute('maxLength')
    expect(screen.getByRole('alert')).toHaveTextContent('inputTooLong')
  })

  it('renders structured group activity as a centered non-actionable system line', () => {
    const systemMessage: MessengerMessageDto = {
      ...makeMessage('system-1', me, ''),
      kind: 'SYSTEM',
      systemEvent: 'MEMBER_ADDED',
      systemSubject: friend,
    }
    const { container } = render(<Harness messages={[systemMessage]} />)

    expect(container.querySelector('.message-system-line')).toBeInTheDocument()
    expect(container.querySelector('.message-action-rail')).toBeNull()
    expect(container.querySelector('.message-avatar-slot')).toBeNull()
  })

  it('keeps the newest message visible when reply opens while the thread is at the bottom', () => {
    const messages = [makeMessage('original', friend, 'First'), makeMessage('latest', me, 'Latest')]
    const { container } = render(<Harness messages={messages} />)
    const list = container.querySelector<HTMLElement>('.messenger-messages')!
    setScrollGeometry(list, 1_000, 400, 600)

    const replyButtons = container.querySelectorAll<HTMLButtonElement>('.message-action-button.reply')
    fireEvent.click(replyButtons[replyButtons.length - 1])

    expect(container.querySelector('.messenger-replying-bar')).toBeInTheDocument()
    expect(list.scrollTop).toBe(1_000)
  })

  it('does not pull the user to the bottom when replying while reading older messages', () => {
    const messages = [makeMessage('original', friend, 'First'), makeMessage('latest', me, 'Latest')]
    const { container } = render(<Harness messages={messages} />)
    const list = container.querySelector<HTMLElement>('.messenger-messages')!
    setScrollGeometry(list, 1_000, 400, 300)

    fireEvent.click(container.querySelector<HTMLButtonElement>('.message-action-button.reply')!)

    expect(container.querySelector('.messenger-replying-bar')).toBeInTheDocument()
    expect(list.scrollTop).toBe(300)
  })

  it('scrolls to and highlights the original message from a sent reply preview', () => {
    const messages = [
      makeMessage('original', friend, 'Original message'),
      makeMessage('reply', me, 'Reply message', 'original'),
    ]
    const { container } = render(<Harness messages={messages} />)
    const original = container.querySelector<HTMLElement>('[data-message-id="original"]')!
    const scrollIntoView = vi.fn()
    Object.defineProperty(original, 'scrollIntoView', { configurable: true, value: scrollIntoView })

    fireEvent.click(container.querySelector<HTMLElement>('.message-reply-source[role="button"]')!)

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(original).toHaveClass('reply-navigation-target')
  })

  it('edits through the normal composer and cancels by clicking the blue message marker', async () => {
    const onEditMessage = vi.fn()
    const editable = {
      ...makeMessage('editable', me, 'Nội dung ban đầu'),
      createdAt: new Date().toISOString(),
    }
    const earlier = { ...makeMessage('earlier', friend, 'Tin nhắn khác'), createdAt: new Date().toISOString() }
    const { container } = render(<Harness messages={[earlier, editable]} onEditMessage={onEditMessage} />)

    const moreButtons = container.querySelectorAll<HTMLButtonElement>('.message-action-button.more')
    fireEvent.click(moreButtons[moreButtons.length - 1])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chỉnh sửa' }))

    expect(container.querySelector('.message-inline-editor')).toBeNull()
    expect(container.querySelector('.messenger-editing-bar')).toHaveTextContent('Đang chỉnh sửa')
    expect(container.querySelector('.messenger-editing-bar .message-reply-preview.composer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đang được chỉnh sửa' })).toBeInTheDocument()
    expect(container.querySelector('.messenger-messages')).toHaveClass('has-edit-focus')
    expect(container.querySelector('[data-message-id="earlier"]')).toHaveAttribute('inert')
    expect(container.querySelector('[data-message-id="editable"]')).toHaveClass('is-editing')
    expect(container.querySelector('[data-message-id="editable"]')).not.toHaveAttribute('inert')
    const composer = container.querySelector<HTMLInputElement>('.messenger-input-wrap input')!
    expect(composer).toHaveValue('Nội dung ban đầu')

    fireEvent.change(composer, { target: { value: 'Nội dung mới' } })
    fireEvent.submit(container.querySelector<HTMLFormElement>('.messenger-compose')!)
    await waitFor(() => expect(onEditMessage).toHaveBeenCalledWith(editable, 'Nội dung mới'))

    const refreshedMoreButtons = container.querySelectorAll<HTMLButtonElement>('.message-action-button.more')
    fireEvent.click(refreshedMoreButtons[refreshedMoreButtons.length - 1])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chỉnh sửa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đang được chỉnh sửa' }))
    expect(container.querySelector('.messenger-editing-bar')).toBeNull()
    expect(container.querySelector('.messenger-messages')).not.toHaveClass('has-edit-focus')
    expect(container.querySelector('[data-message-id="earlier"]')).not.toHaveAttribute('inert')
  })

  it('reveals edit history oldest to newest as faded message bubbles', () => {
    const edited = {
      ...makeMessage('edited', me, 'Bản hiện tại'),
      editedAt: '2026-07-19T00:03:00.000Z',
      editHistory: [
        { text: 'Bản đầu', versionAt: '2026-07-19T00:00:00.000Z' },
        { text: 'Bản thứ hai', versionAt: '2026-07-19T00:02:00.000Z' },
      ],
    }
    const { container } = render(<Harness messages={[edited]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Đã chỉnh sửa' }))

    const revisions = Array.from(container.querySelectorAll('.message-edit-history-bubble'))
    expect(revisions.map((element) => element.textContent)).toEqual(['Bản đầu', 'Bản thứ hai'])
    expect(screen.getByRole('button', { name: 'Ẩn lịch sử chỉnh sửa' })).toBeInTheDocument()
  })
})
